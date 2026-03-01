import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { CreditCard, Loader2, Check, Zap, AlertTriangle } from 'lucide-react';

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void; on: (event: string, handler: () => void) => void };
  }
}

interface Subscription {
  plan: string;
  max_employees: number;
  price_monthly: number;
  subscription: {
    status: string;
    current_end: number;
  } | null;
}

interface ServerCapacity {
  maxProUsers: number;
  currentProUsers: number;
  spotsLeft: number;
  isFull: boolean;
}

const plans = [
  {
    id: 'pro', name: 'Pro', price: '25', employees: 2,
    features: ['2 AI Employees', 'Dedicated server resources', 'All marketplace skills', 'Telegram (WhatsApp soon)', 'Priority support'],
  },
];

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) { resolve(true); return; }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

export default function Billing() {
  const [subscribing, setSubscribing] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const queryClient = useQueryClient();

  const { data: subscription, isLoading } = useQuery<Subscription>({
    queryKey: ['subscription'],
    queryFn: () => api.getSubscription().catch(() => ({ plan: 'free', max_employees: 0, price_monthly: 0, subscription: null })),
  });

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: api.getProfile,
  });

  const { data: capacity } = useQuery<ServerCapacity>({
    queryKey: ['serverCapacity'],
    queryFn: () => api.getServerCapacity().catch(() => ({ maxProUsers: 3, currentProUsers: 0, spotsLeft: 3, isFull: false })),
    refetchInterval: 30000,
  });

  // Preload Razorpay script
  useEffect(() => { loadRazorpayScript(); }, []);

  const handleSubscribe = async (planId: string) => {
    setSubscribing(planId);

    try {
      // Step 1: Create subscription on backend
      const data = await api.subscribe(planId);

      if (!data.subscription_id) {
        toast.success('Plan updated!');
        queryClient.invalidateQueries({ queryKey: ['subscription'] });
        queryClient.invalidateQueries({ queryKey: ['profile'] });
        setSubscribing('');
        return;
      }

      // Step 2: Load Razorpay script
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        toast.error('Failed to load payment gateway. Please try again.');
        setSubscribing('');
        return;
      }

      // Step 3: Open Razorpay popup
      const razorpayKeyId = import.meta.env.VITE_RAZORPAY_KEY_ID;
      if (!razorpayKeyId) {
        toast.error('Payment gateway not configured. Contact support.');
        setSubscribing('');
        return;
      }

      const rzp = new window.Razorpay({
        key: razorpayKeyId,
        subscription_id: data.subscription_id,
        name: 'LikelyClaw',
        description: `${planId.charAt(0).toUpperCase() + planId.slice(1)} Plan`,
        prefill: {
          email: profile?.email || '',
          name: profile?.full_name || '',
        },
        theme: { color: '#D97706' },
        handler: async (response: { razorpay_payment_id: string; razorpay_subscription_id: string; razorpay_signature: string }) => {
          try {
            await api.verifyPayment({
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_subscription_id: response.razorpay_subscription_id,
              razorpay_signature: response.razorpay_signature,
              plan: planId,
            });
            toast.success('Payment successful! Plan upgraded.');
            queryClient.invalidateQueries({ queryKey: ['subscription'] });
            queryClient.invalidateQueries({ queryKey: ['profile'] });
          } catch {
            toast.error('Payment verification failed. Contact support if charged.');
          }
        },
        modal: {
          ondismiss: () => {
            toast.info('Payment cancelled');
          },
        },
      });

      rzp.on('payment.failed', () => {
        toast.error('Payment failed. Please try again.');
      });

      rzp.open();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to subscribe');
    } finally {
      setSubscribing('');
    }
  };

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel your subscription?')) return;
    setCancelling(true);
    try {
      await api.cancelSubscription();
      toast.success('Subscription will cancel at end of billing period.');
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to cancel');
    } finally {
      setCancelling(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const currentPlan = subscription?.plan || 'free';
  const nextBilling = subscription?.subscription?.current_end
    ? new Date(subscription.subscription.current_end * 1000).toLocaleDateString()
    : null;
  const serverFull2 = capacity?.isFull && currentPlan !== 'pro';
  const spotsLeft2 = capacity?.spotsLeft ?? 3;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-zinc-500 mb-1">Settings</p>
        <h1 className="text-3xl font-bold text-white tracking-tight">Billing & Plans</h1>
        <p className="text-zinc-500 text-[15px] mt-2">
          Current plan: <span className="font-semibold capitalize">{currentPlan}</span>
          {subscription?.subscription?.status && (
            <span className="ml-2 text-xs bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full">
              {subscription.subscription.status}
            </span>
          )}
          {nextBilling && (
            <span className="ml-2 text-xs text-zinc-500">Next billing: {nextBilling}</span>
          )}
        </p>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
        {/* Free Plan */}
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-5">
          <div className="mb-5">
            <h3 className="text-lg font-bold text-white">Free</h3>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-4xl font-extrabold text-white">$0</span>
              <span className="text-zinc-500 text-sm">/mo</span>
            </div>
            <div className="text-xs text-zinc-500 mt-1.5">Explore the platform</div>
          </div>
          <ul className="space-y-2 mb-6">
            {['Dashboard access', 'Browse marketplace', 'No AI employees'].map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm text-zinc-300">
                <Check className="h-4 w-4 text-zinc-600 shrink-0" /> {f}
              </li>
            ))}
          </ul>
          {currentPlan === 'free' ? (
            <div className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Check className="h-4 w-4" /> Current Plan
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium text-zinc-500 border border-zinc-800">
              Free Tier
            </div>
          )}
        </div>

        {/* Pro Plan */}
        {plans.map((plan) => {
          const isCurrent = currentPlan === plan.id;
          return (
            <div key={plan.id}
              className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.03] shadow-lg shadow-amber-500/5 p-5 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-black text-xs px-3 py-1 rounded-full font-semibold">
                {serverFull2 ? 'Sold Out' : spotsLeft2 <= 2 ? `Only ${spotsLeft2} spot${spotsLeft2 === 1 ? '' : 's'} left` : 'Recommended'}
              </div>
              <div className="mb-5">
                <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-xs text-zinc-500">$</span>
                  <span className="text-4xl font-extrabold text-white">{plan.price}</span>
                  <span className="text-zinc-500 text-sm">/mo</span>
                </div>
                <div className="text-xs text-zinc-500 mt-1.5">
                  {plan.employees} AI employee{plan.employees > 1 ? 's' : ''} · Billed in INR via Razorpay
                </div>
              </div>
              <ul className="space-y-2 mb-6">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-zinc-300">
                    <Check className="h-4 w-4 text-emerald-400 shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              {isCurrent ? (
                <div className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Check className="h-4 w-4" /> Current Plan
                </div>
              ) : serverFull2 ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                    <AlertTriangle className="h-4 w-4" /> All Spots Taken
                  </div>
                  <p className="text-xs text-zinc-500 text-center">All Pro spots are currently occupied. Contact support or check back later.</p>
                </div>
              ) : (
                <button onClick={() => handleSubscribe(plan.id)} disabled={!!subscribing}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer disabled:opacity-50 active:scale-[0.97] bg-white hover:bg-zinc-200 text-black shadow-md shadow-white/10">
                  {subscribing === plan.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                  {currentPlan === 'free' ? 'Get Started' : 'Switch Plan'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Cancel */}
      {currentPlan !== 'free' && (
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-zinc-500" />
              <div>
                <div className="font-medium text-sm text-white">Cancel Subscription</div>
                <div className="text-xs text-zinc-500">Your plan remains active until the end of the billing period</div>
              </div>
            </div>
            <button onClick={handleCancel} disabled={cancelling}
              className="text-red-500 hover:bg-red-950/50 px-4 py-2 rounded-lg text-sm transition-colors cursor-pointer disabled:opacity-50">
              {cancelling ? 'Cancelling...' : 'Cancel Plan'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
