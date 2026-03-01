#!/usr/bin/env node
/**
 * One-time script to create Razorpay subscription plans.
 * Run: node backend/scripts/create-razorpay-plans.js
 * 
 * This creates 3 monthly plans in Razorpay and outputs the plan IDs
 * to add to your .env file.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const Razorpay = require('razorpay');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Plan definitions — amounts in paise (INR) — Razorpay India only supports INR
// Frontend displays USD ($12/$24/$60), Razorpay charges INR equivalent
const plans = [
  {
    name: 'Starter',
    envKey: 'RAZORPAY_PLAN_BASIC',
    period: 'monthly',
    interval: 1,
    amount: 149900,  // ₹1499/month
    currency: 'INR',
    description: 'LikelyClaw Starter — 1 AI Employee',
    notes: { plan_key: 'basic', employees: '1' }
  },
  {
    name: 'Pro',
    envKey: 'RAZORPAY_PLAN_PRO',
    period: 'monthly',
    interval: 1,
    amount: 214900,  // ₹2149/month (~$25 USD at ₹86/USD)
    currency: 'INR',
    description: 'LikelyClaw Pro — 2 AI Employees',
    notes: { plan_key: 'pro', employees: '2' }
  },
  {
    name: 'Business',
    envKey: 'RAZORPAY_PLAN_BUSINESS',
    period: 'monthly',
    interval: 1,
    amount: 599900,  // ₹5999/month
    currency: 'INR',
    description: 'LikelyClaw Business — 10 AI Employees',
    notes: { plan_key: 'business', employees: '10' }
  }
];

async function createPlans() {
  console.log('Creating Razorpay subscription plans...\n');
  console.log('Using key:', process.env.RAZORPAY_KEY_ID);
  console.log('');

  const envLines = [];

  for (const plan of plans) {
    try {
      const created = await razorpay.plans.create({
        period: plan.period,
        interval: plan.interval,
        item: {
          name: plan.name,
          amount: plan.amount,
          currency: plan.currency,
          description: plan.description
        },
        notes: plan.notes
      });

      console.log(`✅ ${plan.name}: ${created.id} (₹${plan.amount / 100}/month ≈ $${Math.round(plan.amount / 100 / 84)}/month)`);
      envLines.push(`${plan.envKey}=${created.id}`);
    } catch (err) {
      console.error(`❌ ${plan.name}: ${err.message}`);
    }
  }

  console.log('\n========================================');
  console.log('Add these to your backend .env file:');
  console.log('========================================\n');
  envLines.forEach(line => console.log(line));
  console.log('');
}

createPlans().catch(console.error);
