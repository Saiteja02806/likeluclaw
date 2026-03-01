import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Bot, Plus, Wifi, WifiOff, ArrowRight, Crown, Sparkles, MessageSquare, Zap, Key, ChevronRight, Activity, Shield } from 'lucide-react';

interface Employee {
  id: string;
  name: string;
  role: string;
  status: string;
  whatsapp_connected: boolean;
  telegram_connected: boolean;
  created_at: string;
}

interface Profile {
  full_name: string;
  email: string;
  plan: string;
  has_api_key: boolean;
}



const statusConfig: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  running:      { bg: 'bg-emerald-50', text: 'text-emerald-600', dot: 'bg-emerald-500', label: 'Running' },
  provisioning: { bg: 'bg-orange-50', text: 'text-orange-500', dot: 'bg-orange-400', label: 'Starting' },
  stopped:      { bg: 'bg-gray-100', text: 'text-gray-500', dot: 'bg-gray-400', label: 'Stopped' },
  error:        { bg: 'bg-red-50', text: 'text-red-500', dot: 'bg-red-400', label: 'Error' },
};

function FreeDashboard({ profile }: { profile: Profile }) {
  return (
    <div className="space-y-8">
      {/* Greeting */}
      <div>
        <p className="text-sm text-gray-400 mb-1">{new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening'}</p>
        <h1 className="text-3xl font-bold text-[#0a0a0a] tracking-tight">
          {profile?.full_name || 'Welcome'}
        </h1>
      </div>

      {/* Hero upgrade card */}
      <div className="relative overflow-hidden rounded-2xl border border-orange-200/60 bg-white p-8 md:p-10 shadow-sm glow-orange">
        <div className="absolute top-0 right-0 w-80 h-80 bg-orange-400/[0.06] rounded-full blur-[100px] -translate-y-1/3 translate-x-1/4" />
        <div className="relative">
          <div className="inline-flex items-center gap-1.5 bg-orange-50 text-orange-600 px-3 py-1 rounded-full text-xs font-semibold mb-5 border border-orange-200/60">
            <Crown className="h-3 w-3" /> Free Plan
          </div>
          <h2 className="text-2xl font-bold text-[#0a0a0a] mb-3 tracking-tight">Unlock AI Employees</h2>
          <p className="text-gray-500 text-[15px] leading-relaxed max-w-md mb-8">
            Deploy dedicated AI employees that handle WhatsApp and Telegram conversations around the clock.
          </p>
          <Link to="/billing"
            className="inline-flex items-center gap-2 bg-[#0a0a0a] hover:bg-[#222] text-white px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-200 shadow-sm active:scale-[0.97] btn-glow">
            View Plans <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* Feature cards */}
      <div>
        <h2 className="text-[15px] font-bold text-[#0a0a0a] mb-4 tracking-tight">What you get with Pro</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { icon: Bot, title: 'AI Agents', desc: 'Dedicated AI environment per employee' },
            { icon: MessageSquare, title: 'Messaging', desc: 'WhatsApp & Telegram in a few clicks' },
            { icon: Sparkles, title: 'Skills', desc: 'Email, calendar, CRM and more' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="group rounded-2xl border border-black/[0.07] bg-white p-5 hover:shadow-md transition-all duration-300 card-hover shadow-sm">
              <div className="h-10 w-10 rounded-xl bg-orange-50 flex items-center justify-center mb-4">
                <Icon className="h-5 w-5 text-orange-500" />
              </div>
              <h3 className="text-sm font-bold text-[#0a0a0a] mb-1">{title}</h3>
              <p className="text-xs text-gray-400 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Account summary */}
      <div className="rounded-2xl border border-black/[0.07] bg-white p-6 shadow-sm">
        <h3 className="text-sm font-bold text-[#0a0a0a] mb-4">Account</h3>
        <div className="grid grid-cols-2 gap-6 text-sm">
          <div>
            <span className="text-xs text-gray-400 uppercase tracking-wider font-medium">Email</span>
            <p className="font-semibold text-[#0a0a0a] mt-1">{profile?.email}</p>
          </div>
          <div>
            <span className="text-xs text-gray-400 uppercase tracking-wider font-medium">Plan</span>
            <p className="font-semibold text-[#0a0a0a] mt-1 capitalize">{profile?.plan || 'free'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data: profile, isLoading: profileLoading } = useQuery<Profile>({
    queryKey: ['profile'],
    queryFn: api.getProfile,
    staleTime: 30_000,
  });

  const isPremium = profile?.plan && profile.plan !== 'free';

  const { data: empData, isLoading: empLoading } = useQuery<{ employees: Employee[] }>({
    queryKey: ['employees'],
    queryFn: () => api.listEmployees().catch(() => ({ employees: [] })),
    staleTime: 30_000,
    enabled: !!isPremium,
  });

  const employees = empData?.employees || [];
  const loading = profileLoading || (isPremium && empLoading);

  if (loading) {
    return (
      <div className="space-y-8">
        <div>
          <div className="skeleton h-4 w-24 mb-2" />
          <div className="skeleton h-8 w-48" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <div key={i} className="rounded-2xl border border-black/[0.07] bg-white p-4 shadow-sm"><div className="skeleton h-3 w-16 mb-3" /><div className="skeleton h-7 w-12" /></div>)}
        </div>
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="rounded-2xl border border-black/[0.07] bg-white p-4 shadow-sm flex items-center gap-4"><div className="skeleton h-10 w-10 rounded-xl shrink-0" /><div className="flex-1"><div className="skeleton h-4 w-32 mb-2" /><div className="skeleton h-3 w-20" /></div></div>)}
        </div>
      </div>
    );
  }

  if (!isPremium) {
    return <FreeDashboard profile={profile!} />;
  }

  const runningCount = employees.filter(e => e.status === 'running').length;
  const hasChannel = employees.some(e => e.telegram_connected || e.whatsapp_connected);
  const canCreate = employees.length < 1;

  const onboardingSteps = [
    { done: true, label: 'Create account', icon: Shield },
    { done: !!profile?.has_api_key, label: 'Set up API key', link: '/settings/api-keys', icon: Key },
    { done: employees.length > 0, label: 'Create your first employee', link: '/employees/new', icon: Bot },
    { done: hasChannel, label: 'Connect a channel', link: employees[0] ? `/employees/${employees[0].id}` : null, icon: MessageSquare },
  ];
  const allDone = onboardingSteps.every((s) => s.done);
  const completedCount = onboardingSteps.filter((s) => s.done).length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-400 mb-1">{new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening'}</p>
          <h1 className="text-3xl font-bold text-[#0a0a0a] tracking-tight">
            {profile?.full_name ? `${profile.full_name}` : 'Welcome back'}
          </h1>
        </div>
        {canCreate && (
          <Link to="/employees/new"
            className="hidden sm:inline-flex items-center gap-2 bg-[#0a0a0a] hover:bg-[#222] text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 shadow-sm active:scale-[0.97] btn-glow">
            <Plus className="h-4 w-4" /> New Employee
          </Link>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-black/[0.07] bg-white p-4 shadow-sm card-hover">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Status</span>
            <Activity className="h-4 w-4 text-gray-300" />
          </div>
          <div className="flex items-baseline gap-2">
            {employees.length > 0 ? (
              <>
                <span className="text-2xl font-bold text-emerald-600 font-mono">{runningCount > 0 ? 'Online' : 'Stopped'}</span>
                {runningCount > 0 && <span className="text-xs text-emerald-500 font-medium">active</span>}
              </>
            ) : (
              <span className="text-xl font-bold text-gray-400">No agent</span>
            )}
          </div>
        </div>
        <div className="rounded-2xl border border-black/[0.07] bg-white p-4 shadow-sm card-hover">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Plan</span>
            <Zap className="h-4 w-4 text-gray-300" />
          </div>
          <div className="text-2xl font-bold text-[#0a0a0a] capitalize">{profile?.plan}</div>
        </div>
        <div className="rounded-2xl border border-black/[0.07] bg-white p-4 shadow-sm card-hover">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">API Key</span>
            <Key className="h-4 w-4 text-gray-300" />
          </div>
          {profile?.has_api_key ? (
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-sm font-semibold text-emerald-600">Connected</span>
            </div>
          ) : (
            <Link to="/settings/api-keys" className="flex items-center gap-2 group">
              <span className="h-2 w-2 rounded-full bg-orange-400 animate-pulse" />
              <span className="text-sm font-semibold text-orange-500 group-hover:underline">Set up</span>
            </Link>
          )}
        </div>
      </div>

      {/* Onboarding checklist */}
      {!allDone && (
        <div className="rounded-2xl border border-orange-200/60 bg-orange-50/40 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-sm text-[#0a0a0a]">Get started</h3>
            <span className="text-xs text-gray-400 font-medium">{completedCount}/{onboardingSteps.length} complete</span>
          </div>
          <div className="h-1.5 bg-black/[0.06] rounded-full mb-5 overflow-hidden">
            <div className="h-full bg-orange-500 rounded-full transition-all duration-500" style={{ width: `${(completedCount / onboardingSteps.length) * 100}%` }} />
          </div>
          <div className="space-y-2">
            {onboardingSteps.map((step, i) => (
              <div key={i} className={`flex items-center justify-between rounded-xl px-4 py-3 transition-colors ${step.done ? 'opacity-40' : 'bg-white border border-black/[0.05]'}`}>
                <div className="flex items-center gap-3">
                  {step.done ? (
                    <span className="h-6 w-6 rounded-full bg-orange-100 text-orange-500 flex items-center justify-center text-xs font-bold">&#10003;</span>
                  ) : (
                    <span className="h-6 w-6 rounded-full border border-black/[0.1] bg-gray-50 flex items-center justify-center">
                      <step.icon className="h-3 w-3 text-gray-400" />
                    </span>
                  )}
                  <span className={`text-sm font-medium ${step.done ? 'text-gray-400 line-through' : 'text-[#0a0a0a]'}`}>{step.label}</span>
                </div>
                {!step.done && step.link && (
                  <Link to={step.link} className="text-orange-500 text-xs font-semibold hover:text-orange-600 flex items-center gap-1 transition-colors">
                    Start <ChevronRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Employee list */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[15px] font-bold text-[#0a0a0a] tracking-tight">Your AI Agent</h2>
        </div>

        {employees.length === 0 ? (
          <div className="rounded-2xl border border-black/[0.07] border-dashed bg-white p-12 text-center shadow-sm">
            <div className="h-14 w-14 rounded-2xl bg-gray-50 border border-black/[0.07] flex items-center justify-center mx-auto mb-4">
              <Bot className="h-7 w-7 text-gray-300" />
            </div>
            <p className="text-[#0a0a0a] text-sm mb-1 font-semibold">No employees yet</p>
            <p className="text-gray-400 text-xs mb-6">Create your first AI agent to get started</p>
            <Link to="/employees/new"
              className="inline-flex items-center gap-2 bg-[#0a0a0a] hover:bg-[#222] text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 shadow-sm">
              <Plus className="h-4 w-4" /> Create Employee
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {employees.map((emp) => {
              const sc = statusConfig[emp.status] || statusConfig.stopped;
              return (
                <Link key={emp.id} to={`/employees/${emp.id}`}
                  className="group flex items-center justify-between rounded-2xl border border-black/[0.07] bg-white p-4 hover:shadow-md hover:border-black/[0.1] transition-all duration-200 shadow-sm">
                  <div className="flex items-center gap-3.5">
                    <div className="h-11 w-11 bg-orange-50 rounded-xl flex items-center justify-center group-hover:bg-orange-100 transition-colors">
                      <Bot className="h-5 w-5 text-orange-500" />
                    </div>
                    <div>
                      <div className="font-bold text-[#0a0a0a] text-[15px]">{emp.name}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{emp.role || 'General Assistant'}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="hidden sm:flex items-center gap-1.5">
                      {emp.telegram_connected ? (
                        <span className="h-7 w-7 rounded-lg bg-emerald-50 flex items-center justify-center" title="Telegram connected">
                          <Wifi className="h-3.5 w-3.5 text-emerald-500" />
                        </span>
                      ) : (
                        <span className="h-7 w-7 rounded-lg bg-gray-100 flex items-center justify-center" title="Telegram not connected">
                          <WifiOff className="h-3.5 w-3.5 text-gray-300" />
                        </span>
                      )}
                    </div>
                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${sc.bg} ${sc.text}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${sc.dot} ${emp.status === 'running' ? 'animate-pulse' : ''}`} />
                      {sc.label}
                    </span>
                    <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
                  </div>
                </Link>
              );
            })}

            {canCreate && (
              <Link to="/employees/new"
                className="sm:hidden flex items-center justify-center gap-2 bg-[#0a0a0a] hover:bg-[#222] text-white px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 shadow-sm">
                <Plus className="h-4 w-4" /> New Employee
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
