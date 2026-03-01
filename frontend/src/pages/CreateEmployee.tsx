import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, AlertTriangle, ChevronDown } from 'lucide-react';

const roles = ['General', 'Sales', 'Support', 'Marketing', 'Developer', 'Custom'];
const planLimits: Record<string, number> = { free: 0, pro: 2 };

const personalityPresets = [
  { value: 'professional', label: 'Professional', icon: '💼' },
  { value: 'casual', label: 'Casual & Witty', icon: '😎' },
  { value: 'concise', label: 'Concise', icon: '⚡' },
  { value: 'warm', label: 'Warm & Supportive', icon: '🤗' },
  { value: 'custom', label: 'Custom', icon: '✏️' },
];

export default function CreateEmployee() {
  const [name, setName] = useState('');
  const [role, setRole] = useState('General');
  const [personality, setPersonality] = useState('professional');
  const [customSoul, setCustomSoul] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [triggerPrefix, setTriggerPrefix] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: api.getProfile,
  });

  const { data: empData } = useQuery({
    queryKey: ['employees'],
    queryFn: () => api.listEmployees().catch(() => ({ employees: [] })),
  });

  const employees = empData?.employees || [];
  const maxEmployees = planLimits[profile?.plan || 'free'] || 0;
  const atLimit = employees.length >= maxEmployees;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error('Give your employee a name'); return; }

    setLoading(true);
    try {
      const data = await api.createEmployee({
        name: name.trim(),
        role,
        trigger_prefix: triggerPrefix.trim() || undefined,
        personality_preset: personality,
        soul_md_custom: personality === 'custom' ? customSoul : undefined,
      });
      toast.success(`${name.trim()} is being deployed!`);
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      navigate(`/employees/${data.employee?.id || data.id}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create employee');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/dashboard" className="text-zinc-500 hover:text-amber-400 transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">New Employee</h1>
          <p className="text-sm text-zinc-500">Deploy an AI agent for Telegram</p>
        </div>
      </div>

      {/* Warnings */}
      {!profile?.has_api_key && (
        <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
          <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-400">API key required</p>
            <p className="text-xs text-zinc-500 mt-0.5">
              Set up your AI API key first.{' '}
              <Link to="/settings/api-keys" className="text-amber-400 hover:underline">Go to Settings</Link>
            </p>
          </div>
        </div>
      )}

      {atLimit && (
        <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
          <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-400">Employee limit reached</p>
            <p className="text-xs text-zinc-500 mt-0.5">
              Your {profile?.plan || 'free'} plan allows {maxEmployees}.{' '}
              <Link to="/billing" className="text-amber-400 hover:underline">Upgrade</Link>
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-6 space-y-5">
        {/* Name */}
        <div>
          <label htmlFor="emp-name" className="block text-sm font-medium mb-1.5 text-zinc-300">Name</label>
          <input id="emp-name" type="text" value={name} onChange={(e) => setName(e.target.value)} required maxLength={50}
            className="w-full px-4 py-3 border border-zinc-700/80 rounded-xl text-sm bg-zinc-800/80 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/50 transition-all"
            placeholder="e.g., Amy, Support Bot, Sales Agent" />
          <div className="flex justify-end mt-1"><span className={`text-[11px] ${name.length > 40 ? 'text-amber-400' : 'text-zinc-600'}`}>{name.length}/50</span></div>
        </div>

        {/* Role — dropdown */}
        <div>
          <label htmlFor="emp-role" className="block text-sm font-medium mb-1.5 text-zinc-300">Role</label>
          <select id="emp-role" value={role} onChange={(e) => setRole(e.target.value)}
            className="w-full px-4 py-3 border border-zinc-700/80 rounded-xl text-sm bg-zinc-800/80 text-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/50 transition-all appearance-none cursor-pointer">
            {roles.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        {/* Personality — compact grid */}
        <div>
          <label className="block text-sm font-medium mb-2 text-zinc-300">Personality</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {personalityPresets.map((p) => (
              <button key={p.value} type="button" onClick={() => setPersonality(p.value)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-left transition-all text-sm cursor-pointer ${
                  personality === p.value
                    ? 'border-amber-500/50 bg-amber-500/5 ring-1 ring-amber-500/20'
                    : 'border-zinc-700/80 bg-zinc-800/30 hover:border-zinc-600'
                }`}>
                <span>{p.icon}</span>
                <span className={`text-xs font-medium ${personality === p.value ? 'text-amber-400' : 'text-zinc-300'}`}>{p.label}</span>
              </button>
            ))}
          </div>
          {personality === 'custom' && (
            <textarea value={customSoul} onChange={(e) => setCustomSoul(e.target.value)} rows={5} maxLength={5000}
              className="w-full mt-2 px-3 py-2.5 border border-zinc-700 rounded-xl text-sm bg-zinc-800 text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/50 resize-y font-mono leading-relaxed"
              placeholder={"# Soul\n\n## Personality\nDescribe who your AI employee is...\n\n## Rules\n- Your rules here"} />
          )}
        </div>

        {/* Advanced Options (collapsible) */}
        <div className="border-t border-zinc-800/80 pt-4">
          <button type="button" onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer">
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
            Advanced options
          </button>

          {showAdvanced && (
            <div className="mt-3">
              <label htmlFor="emp-trigger" className="block text-sm font-medium mb-1.5 text-zinc-300">Trigger Prefix</label>
              <input id="emp-trigger" type="text" value={triggerPrefix} onChange={(e) => setTriggerPrefix(e.target.value)}
                className="w-full px-4 py-2.5 border border-zinc-700 rounded-xl text-sm bg-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/50 transition-all"
                placeholder='e.g., "Support:" — only responds to messages starting with this' />
              <p className="text-xs text-zinc-600 mt-1.5">Leave empty to respond to all messages.</p>
            </div>
          )}
        </div>

        {/* Submit */}
        <button type="submit" disabled={loading || atLimit || !profile?.has_api_key}
          className="flex items-center justify-center gap-2 w-full bg-white hover:bg-zinc-200 text-black py-3 rounded-xl text-sm font-semibold transition-all duration-200 disabled:opacity-50 cursor-pointer shadow-md shadow-white/10 active:scale-[0.98] btn-glow">
          {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Deploying...</> : 'Create Employee'}
        </button>
        <p className="text-center text-[11px] text-zinc-600 -mt-2">Deploys in ~60 seconds</p>
      </form>
    </div>
  );
}
