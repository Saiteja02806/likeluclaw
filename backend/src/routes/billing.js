const express = require('express');
const crypto = require('crypto');
const authMiddleware = require('../middleware/auth');
const { supabaseAdmin } = require('../config/supabase');
const logger = require('../config/logger');
const k8s = require('../lib/k8s-utils');

const router = express.Router();

// Initialize Razorpay
let razorpay;
try {
  const Razorpay = require('razorpay');
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });
} catch {
  logger.warn('Razorpay not configured — billing routes will return errors');
}

// Plan configuration (INR — $25 USD at ₹86/USD = ₹2149/month)
const PLAN_CONFIG = {
  pro: { planId: process.env.RAZORPAY_PLAN_PRO, limit: 1, price: 2149 }
};

// Server capacity: max pro users this server can handle
const MAX_PRO_USERS = parseInt(process.env.MAX_PRO_USERS || '3');

// GET /api/billing/capacity — Check server capacity (public, no auth needed for landing page)
router.get('/capacity', async (req, res) => {
  try {
    const { count } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('plan', 'pro');

    const proUsers = count || 0;
    const spotsLeft = Math.max(0, MAX_PRO_USERS - proUsers);

    res.json({
      maxProUsers: MAX_PRO_USERS,
      currentProUsers: proUsers,
      spotsLeft,
      isFull: spotsLeft === 0
    });
  } catch (err) {
    logger.error('Capacity check error', { error: err.message });
    res.json({ maxProUsers: MAX_PRO_USERS, currentProUsers: 0, spotsLeft: MAX_PRO_USERS, isFull: false });
  }
});

// POST /api/billing/subscribe — Create Razorpay subscription
router.post('/subscribe', authMiddleware, async (req, res) => {
  try {
    if (!razorpay) {
      return res.status(503).json({ error: 'Payment system not configured' });
    }

    const { plan } = req.body;
    const validPlans = ['pro'];

    if (!plan || !validPlans.includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan. Only "pro" plan is available.' });
    }

    const planConfig = PLAN_CONFIG[plan];
    if (!planConfig.planId || planConfig.planId.includes('placeholder')) {
      return res.status(503).json({ error: 'Razorpay plans not configured yet' });
    }

    // Server capacity check: block new pro subscriptions when server is full
    const { data: userProfile } = await supabaseAdmin
      .from('profiles')
      .select('plan')
      .eq('id', req.user.id)
      .single();

    if (userProfile?.plan !== 'pro') {
      // Only check capacity for NEW pro users (not existing pro users renewing)
      const { count: proCount } = await supabaseAdmin
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('plan', 'pro');

      if ((proCount || 0) >= MAX_PRO_USERS) {
        logger.warn('Pro subscription blocked — server at capacity', { userId: req.user.id, proCount });
        return res.status(503).json({
          error: 'All Pro spots are currently taken. Please join the waitlist or try again later.'
        });
      }
    }

    // Get user profile
    const { data: profile } = await req.supabase
      .from('profiles')
      .select('razorpay_customer_id, full_name')
      .eq('id', req.user.id)
      .single();

    // Create or reuse Razorpay customer
    let customerId = profile?.razorpay_customer_id;

    if (!customerId) {
      const customer = await razorpay.customers.create({
        name: profile?.full_name || 'Customer',
        email: req.user.email,
        notes: { supabase_user_id: req.user.id }
      });
      customerId = customer.id;

      await supabaseAdmin
        .from('profiles')
        .update({ razorpay_customer_id: customerId })
        .eq('id', req.user.id);
    }

    // Create Razorpay subscription (link to customer)
    const subscription = await razorpay.subscriptions.create({
      plan_id: planConfig.planId,
      customer_id: customerId,
      customer_notify: 1,
      total_count: 120, // Max billing cycles (10 years monthly)
      notes: {
        user_id: req.user.id,
        plan
      }
    });

    await supabaseAdmin.from('activity_logs').insert({
      user_id: req.user.id,
      action: 'billing.subscription_initiated',
      details: { plan, subscription_id: subscription.id }
    });

    // Return subscription_id for frontend Razorpay Checkout
    res.json({
      subscription_id: subscription.id,
      razorpay_key: process.env.RAZORPAY_KEY_ID,
      plan,
      amount: planConfig.price
    });
  } catch (err) {
    logger.error('Subscribe error', { error: err.message });
    res.status(500).json({ error: 'Failed to create subscription' });
  }
});

// POST /api/billing/verify — Verify Razorpay payment after checkout
router.post('/verify', authMiddleware, async (req, res) => {
  try {
    const {
      razorpay_payment_id,
      razorpay_subscription_id,
      razorpay_signature,
      plan
    } = req.body;

    if (!razorpay_payment_id || !razorpay_subscription_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Missing payment verification fields' });
    }

    // Verify signature: HMAC SHA256 of (payment_id + "|" + subscription_id)
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_payment_id}|${razorpay_subscription_id}`)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      logger.warn('Razorpay payment verification failed', { razorpay_payment_id });
      return res.status(400).json({ error: 'Payment verification failed' });
    }

    // Payment verified — determine plan from Razorpay subscription notes (not frontend)
    const validPlans = ['pro'];
    let verifiedPlan = 'pro';
    if (razorpay) {
      try {
        const sub = await razorpay.subscriptions.fetch(razorpay_subscription_id);
        const notePlan = sub.notes?.plan;
        if (notePlan && validPlans.includes(notePlan)) {
          verifiedPlan = notePlan;
        } else if (validPlans.includes(plan)) {
          verifiedPlan = plan; // Fallback to frontend-supplied plan if notes missing
        }
      } catch {
        // If fetch fails, fall back to frontend-supplied plan (already signature-verified)
        verifiedPlan = validPlans.includes(plan) ? plan : 'basic';
      }
    } else {
      verifiedPlan = validPlans.includes(plan) ? plan : 'basic';
    }

    await supabaseAdmin
      .from('profiles')
      .update({
        plan: verifiedPlan,
        razorpay_subscription_id
      })
      .eq('id', req.user.id);

    await supabaseAdmin.from('activity_logs').insert({
      user_id: req.user.id,
      action: 'billing.subscription_created',
      details: {
        plan: verifiedPlan,
        subscription_id: razorpay_subscription_id,
        payment_id: razorpay_payment_id
      }
    });

    logger.info('Subscription created via Razorpay', {
      userId: req.user.id,
      plan: verifiedPlan,
      subscriptionId: razorpay_subscription_id
    });

    res.json({ success: true, plan: verifiedPlan });
  } catch (err) {
    logger.error('Payment verify error', { error: err.message });
    res.status(500).json({ error: 'Payment verification failed' });
  }
});

// POST /api/billing/webhook — Razorpay webhook handler
// Note: express.raw() is applied in server.js for this route BEFORE express.json()
router.post('/webhook', async (req, res) => {
  try {
    // req.body is a Buffer from express.raw() in server.js
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));

    // Verify webhook signature (MANDATORY in production)
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const receivedSignature = req.headers['x-razorpay-signature'];

    if (!webhookSecret) {
      logger.error('RAZORPAY_WEBHOOK_SECRET not configured — rejecting webhook');
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    if (!receivedSignature) {
      logger.warn('Razorpay webhook missing signature header');
      return res.status(400).json({ error: 'Missing signature' });
    }

    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    if (expectedSignature !== receivedSignature) {
      logger.warn('Razorpay webhook signature verification failed');
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const payload = JSON.parse(rawBody);
    const event = payload.event;
    const entity = payload.payload?.subscription?.entity || payload.payload?.payment?.entity;

    logger.info('Razorpay webhook received', { event });

    switch (event) {
      case 'subscription.activated': {
        // Subscription successfully started
        const subscriptionId = entity?.id;
        const notes = entity?.notes;
        const userId = notes?.user_id;
        const plan = notes?.plan;

        if (userId && plan) {
          await supabaseAdmin
            .from('profiles')
            .update({
              plan,
              razorpay_subscription_id: subscriptionId
            })
            .eq('id', userId);

          await supabaseAdmin.from('activity_logs').insert({
            user_id: userId,
            action: 'billing.subscription_activated',
            details: { plan, subscription_id: subscriptionId }
          });

          logger.info('Subscription activated', { userId, plan });
        }
        break;
      }

      case 'subscription.charged': {
        // Recurring payment succeeded
        const notes = entity?.notes;
        const userId = notes?.user_id;

        if (userId) {
          await supabaseAdmin.from('activity_logs').insert({
            user_id: userId,
            action: 'billing.payment_succeeded',
            details: { subscription_id: entity?.id }
          });

          logger.info('Recurring payment succeeded', { userId });
        }
        break;
      }

      case 'subscription.halted': {
        // Payment failed after retries — stop containers to prevent resource waste
        const subscriptionId = entity?.id;

        // Find user by razorpay_subscription_id
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('razorpay_subscription_id', subscriptionId)
          .single();

        if (profile) {
          // Delete K8s agent pod (user isn't paying)
          await k8s.deleteAgent(profile.id).catch(e =>
            logger.warn('K8s delete on halt failed', { userId: profile.id, error: e.message })
          );

          await supabaseAdmin
            .from('employees')
            .update({ status: 'stopped' })
            .eq('user_id', profile.id)
            .eq('status', 'running');

          await supabaseAdmin.from('activity_logs').insert({
            user_id: profile.id,
            action: 'billing.payment_failed',
            success: false,
            details: { subscription_id: subscriptionId }
          });

          logger.warn('Payment failed — subscription halted, K8s agent deleted', {
            userId: profile.id,
            subscriptionId
          });
        }
        break;
      }

      case 'subscription.cancelled':
      case 'subscription.completed': {
        // Subscription ended
        const subscriptionId = entity?.id;

        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('razorpay_subscription_id', subscriptionId)
          .single();

        if (profile) {
          // Downgrade to free plan
          await supabaseAdmin
            .from('profiles')
            .update({ plan: 'free', razorpay_subscription_id: null })
            .eq('id', profile.id);

          // Delete K8s agent pod for this user
          await k8s.deleteAgent(profile.id).catch(e =>
            logger.warn('K8s delete on cancel failed', { userId: profile.id, error: e.message })
          );

          await supabaseAdmin
            .from('employees')
            .update({ status: 'stopped' })
            .eq('user_id', profile.id)
            .eq('status', 'running');

          logger.info('K8s agent deleted on subscription cancellation', { userId: profile.id });

          await supabaseAdmin.from('activity_logs').insert({
            user_id: profile.id,
            action: 'billing.subscription_cancelled',
            details: { subscription_id: subscriptionId }
          });

          logger.info('Subscription cancelled/completed', { userId: profile.id });
        }
        break;
      }
    }

    res.json({ received: true });
  } catch (err) {
    logger.error('Webhook processing error', { error: err.message });
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// GET /api/billing/subscription — Get current subscription info
router.get('/subscription', authMiddleware, async (req, res) => {
  try {
    const { data: profile } = await req.supabase
      .from('profiles')
      .select('plan, razorpay_customer_id, razorpay_subscription_id')
      .eq('id', req.user.id)
      .single();

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    let subscription = null;
    if (razorpay && profile.razorpay_subscription_id) {
      try {
        const sub = await razorpay.subscriptions.fetch(profile.razorpay_subscription_id);
        subscription = {
          status: sub.status, // created, authenticated, active, halted, cancelled, completed
          current_start: sub.current_start,
          current_end: sub.current_end,
          charge_at: sub.charge_at,
          remaining_count: sub.remaining_count
        };
      } catch {
        subscription = null;
      }
    }

    const planLimits = { free: 0, pro: 1 };
    const planPrices = { free: 0, pro: 2149 };

    res.json({
      plan: profile.plan,
      max_employees: planLimits[profile.plan] || 0,
      price_monthly: planPrices[profile.plan] || 0,
      subscription
    });
  } catch (err) {
    logger.error('Get subscription error', { error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/billing/cancel — Cancel current subscription
router.post('/cancel', authMiddleware, async (req, res) => {
  try {
    if (!razorpay) {
      return res.status(503).json({ error: 'Payment system not configured' });
    }

    const { data: profile } = await req.supabase
      .from('profiles')
      .select('razorpay_subscription_id')
      .eq('id', req.user.id)
      .single();

    if (!profile?.razorpay_subscription_id) {
      return res.status(400).json({ error: 'No active subscription found' });
    }

    // Cancel at end of current billing cycle (cancel_at_cycle_end = true)
    await razorpay.subscriptions.cancel(profile.razorpay_subscription_id, {
      cancel_at_cycle_end: 1
    });

    await supabaseAdmin.from('activity_logs').insert({
      user_id: req.user.id,
      action: 'billing.subscription_cancel_requested',
      details: { subscription_id: profile.razorpay_subscription_id }
    });

    res.json({ success: true, message: 'Subscription will cancel at end of billing period' });
  } catch (err) {
    logger.error('Cancel subscription error', { error: err.message });
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

module.exports = router;
