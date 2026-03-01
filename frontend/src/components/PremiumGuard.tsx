import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Link } from 'react-router-dom';
import { Crown, Zap, Shield, Bot, ArrowRight, Loader2 } from 'lucide-react';

const features = [
  { icon: Bot, title: 'AI Employees', desc: 'Each employee runs in a dedicated, secure environment' },
  { icon: Zap, title: 'Channel Connections', desc: 'Connect WhatsApp & Telegram instantly' },
  { icon: Shield, title: 'Skill Marketplace', desc: 'Add powerful capabilities to your agents' },
];

export default function PremiumGuard({ children }: { children: React.ReactNode }) {
  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.getProfile(),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const plan = profile?.plan || 'free';
  const isPremium = plan !== 'free';

  if (isPremium) {
    return <>{children}</>;
  }

  return (
    <div className="max-w-xl mx-auto py-12 px-4">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-zinc-900 mb-5">
          <Crown className="h-8 w-8 text-amber-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Upgrade to Get Started</h1>
        <p className="text-zinc-400 text-[15px] leading-relaxed max-w-md mx-auto">
          This feature is available on paid plans. Subscribe to unlock AI employees, channel integrations, and more.
        </p>
      </div>

      <div className="bg-zinc-900 rounded-xl border border-zinc-800 divide-y divide-zinc-800 mb-8">
        {features.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="flex items-start gap-4 p-4">
            <div className="h-9 w-9 rounded-lg bg-zinc-900 flex items-center justify-center shrink-0 mt-0.5">
              <Icon className="h-4.5 w-4.5 text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-200">{title}</p>
              <p className="text-xs text-zinc-500 mt-0.5">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col items-center gap-3">
        <Link
          to="/billing"
          className="inline-flex items-center gap-2 bg-white hover:bg-zinc-200 text-black px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-200 shadow-md shadow-white/10 active:scale-[0.97] btn-glow"
        >
          View Plans & Upgrade
          <ArrowRight className="h-4 w-4" />
        </Link>
        <p className="text-xs text-zinc-400">Plans start at ₹1,499/month</p>
      </div>
    </div>
  );
}
