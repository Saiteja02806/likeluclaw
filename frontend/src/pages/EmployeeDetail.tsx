import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import {
  Bot, ArrowLeft, Loader2, Trash2, Wifi, WifiOff,
  MessageSquare, Send, Save, ArrowRight, AlertTriangle,
} from 'lucide-react';

interface Employee {
  id: string;
  name: string;
  role: string;
  status: string;
  system_prompt: string;
  trigger_prefix: string;
  personality_preset: string;
  soul_md_custom: string | null;
  whatsapp_connected: boolean;
  telegram_connected: boolean;
  skills?: { id: string; skill_id: string; status: string; skills: { name: string; slug: string; icon: string } }[];
  created_at: string;
}

const personalityPresets = [
  { value: 'professional', label: 'Professional', icon: '💼', desc: 'Clear, reliable, and direct.' },
  { value: 'casual', label: 'Casual & Witty', icon: '😎', desc: 'Opinionated, sharp humor.' },
  { value: 'concise', label: 'Concise', icon: '⚡', desc: 'Brevity is law.' },
  { value: 'warm', label: 'Warm & Supportive', icon: '🤗', desc: 'Empathetic and encouraging.' },
  { value: 'custom', label: 'Custom', icon: '✏️', desc: 'Write your own SOUL.md.' },
];

interface LogEntry {
  id: string;
  action: string;
  success: boolean;
  created_at: string;
}

const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
  running:      { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  provisioning: { bg: 'bg-amber-500/10', text: 'text-amber-400', dot: 'bg-amber-500' },
  stopped:      { bg: 'bg-zinc-500/10', text: 'text-zinc-400', dot: 'bg-zinc-500' },
  error:        { bg: 'bg-red-500/10', text: 'text-red-400', dot: 'bg-red-400' },
};

const roles = ['General', 'Sales', 'Support', 'Marketing', 'Developer', 'Custom'];

export default function EmployeeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('General');
  const [editPrompt, setEditPrompt] = useState('');
  const [editTrigger, setEditTrigger] = useState('');
  const [editPersonality, setEditPersonality] = useState('professional');
  const [editCustomSoul, setEditCustomSoul] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [disconnectingTg, setDisconnectingTg] = useState(false);
  const [formInit, setFormInit] = useState(false);

  const { data: empData, isLoading } = useQuery({
    queryKey: ['employee', id],
    queryFn: () => api.getEmployee(id!),
    enabled: !!id,
    refetchInterval: 3_000,
    refetchOnWindowFocus: true,
  });

  const { data: logsData } = useQuery({
    queryKey: ['employee-logs', id],
    queryFn: () => api.getLogs(id!, 5),
    enabled: !!id,
  });

  const employee: Employee | null = empData?.employee || empData || null;
  const recentLogs: LogEntry[] = (logsData?.logs || logsData || []).slice(0, 5);

  // Init form fields once employee loads
  if (employee && !formInit) {
    setEditName(employee.name || '');
    setEditRole(employee.role || 'General');
    setEditPrompt(employee.system_prompt || '');
    setEditTrigger(employee.trigger_prefix || '');
    setEditPersonality(employee.personality_preset || 'professional');
    setEditCustomSoul(employee.soul_md_custom || '');
    setFormInit(true);
  }

  const handleSave = async () => {
    if (!editName.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      await api.updateEmployee(id!, {
        name: editName.trim(),
        role: editRole,
        system_prompt: editPrompt.trim(),
        trigger_prefix: editTrigger.trim() || undefined,
        personality_preset: editPersonality,
        soul_md_custom: editPersonality === 'custom' ? editCustomSoul : undefined,
      });
      toast.success('Settings saved! Container will restart to apply changes.');
      queryClient.invalidateQueries({ queryKey: ['employee', id] });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = prompt('Type DELETE to confirm');
    if (confirmed !== 'DELETE') return;
    setDeleting(true);
    try {
      await api.deleteEmployee(id!);
      toast.success('Employee deleted');
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      navigate('/dashboard');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
      setDeleting(false);
    }
  };

  const handleDisconnectTg = async () => {
    if (!confirm('Disconnect Telegram?')) return;
    setDisconnectingTg(true);
    try {
      await api.disconnectTelegram(id!);
      toast.success('Telegram disconnected');
      queryClient.invalidateQueries({ queryKey: ['employee', id] });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to disconnect');
    } finally {
      setDisconnectingTg(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="skeleton h-5 w-5 rounded" />
          <div className="skeleton h-10 w-10 rounded-full" />
          <div><div className="skeleton h-6 w-40 mb-2" /><div className="skeleton h-4 w-20 rounded-full" /></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1,2].map(i => <div key={i} className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-5"><div className="skeleton h-5 w-24 mb-4" /><div className="skeleton h-10 w-full rounded-xl" /></div>)}
        </div>
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-6 space-y-4">
          <div className="skeleton h-5 w-32 mb-2" />
          {[1,2,3].map(i => <div key={i}><div className="skeleton h-3 w-16 mb-2" /><div className="skeleton h-10 w-full rounded-xl" /></div>)}
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="space-y-4">
        <Link to="/dashboard" className="flex items-center gap-2 text-muted hover:text-primary text-sm">
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Link>
        <div className="bg-red-500/[0.06] text-red-400 p-4 rounded-xl border border-red-500/20">Employee not found</div>
      </div>
    );
  }

  const sc = statusConfig[employee.status] || statusConfig.stopped;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/dashboard" className="text-muted hover:text-primary transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{employee.name}</h1>
            <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />
              {employee.status}
            </span>
          </div>
        </div>
      </div>

      {/* Web Chat CTA — Disabled, focusing on Telegram bot */}
      {/* {employee.status === 'running' && (
        <Link to={`/chat/${id}`}
          className="flex items-center justify-between rounded-2xl border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 p-5 transition-all group">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
              <MessageSquare className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Chat with {employee.name}</h3>
              <p className="text-xs text-zinc-500 mt-0.5">Talk to your AI employee directly from the browser</p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-amber-400 group-hover:translate-x-1 transition-transform" />
        </Link>
      )} */}

      {/* Channel connections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-5 opacity-50 pointer-events-none select-none">
          <div className="flex items-center gap-3 mb-4">
            <MessageSquare className="h-5 w-5 text-zinc-600" />
            <h3 className="font-semibold text-zinc-500">WhatsApp</h3>
            <span className="ml-auto inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400/80 border border-amber-500/20">Coming Soon</span>
          </div>
          <div
            className="flex items-center justify-center gap-2 w-full bg-zinc-800 text-zinc-500 py-2.5 rounded-xl text-sm font-semibold cursor-not-allowed">
            <MessageSquare className="h-4 w-4" /> Connect WhatsApp <ArrowRight className="h-3.5 w-3.5" />
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-5">
          <div className="flex items-center gap-3 mb-4">
            <Send className="h-5 w-5 text-blue-400" />
            <h3 className="font-semibold">Telegram</h3>
            {employee.telegram_connected ? (
              <span className="ml-auto flex items-center gap-1 text-xs text-success"><Wifi className="h-3.5 w-3.5" /> Connected</span>
            ) : (
              <span className="ml-auto flex items-center gap-1 text-xs text-muted"><WifiOff className="h-3.5 w-3.5" /> Not connected</span>
            )}
          </div>
          {employee.telegram_connected ? (
            <button onClick={handleDisconnectTg} disabled={disconnectingTg}
              className="text-xs text-danger hover:underline cursor-pointer disabled:opacity-50">
              {disconnectingTg ? 'Disconnecting...' : 'Disconnect Telegram'}
            </button>
          ) : (
            <Link to={`/connect/telegram/${id}`}
              className="flex items-center justify-center gap-2 w-full bg-white hover:bg-zinc-200 text-black py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 active:scale-[0.97] shadow-md shadow-white/10 btn-glow">
              <Send className="h-4 w-4 text-blue-600" /> Connect Telegram <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </div>

      {/* Settings form */}
      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-6 space-y-4">
        <h3 className="font-semibold text-white">Employee Settings</h3>

        <div>
          <label htmlFor="det-name" className="block text-sm font-medium mb-1.5 text-zinc-300">Name</label>
          <input id="det-name" type="text" value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={50}
            className="w-full px-4 py-3 border border-zinc-700/80 rounded-xl text-sm bg-zinc-800/80 text-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/50 transition-all" />
        </div>

        <div>
          <label htmlFor="det-role" className="block text-sm font-medium mb-1.5 text-zinc-300">Role</label>
          <select id="det-role" value={editRole} onChange={(e) => setEditRole(e.target.value)}
            className="w-full px-4 py-3 border border-zinc-700/80 rounded-xl text-sm bg-zinc-800/80 text-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/50 transition-all appearance-none cursor-pointer">
            {roles.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor="det-trigger" className="block text-sm font-medium mb-1.5 text-zinc-300">Trigger Prefix <span className="text-zinc-500 font-normal">(optional)</span></label>
          <input id="det-trigger" type="text" value={editTrigger} onChange={(e) => setEditTrigger(e.target.value)}
            className="w-full px-4 py-3 border border-zinc-700/80 rounded-xl text-sm bg-zinc-800/80 text-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/50 transition-all" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 text-zinc-300">Personality (SOUL.md)</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {personalityPresets.map((p) => (
              <button key={p.value} type="button" onClick={() => setEditPersonality(p.value)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-all text-sm cursor-pointer active:scale-[0.97] ${
                  editPersonality === p.value
                    ? 'border-amber-500/50 bg-amber-500/5 ring-1 ring-amber-500/20'
                    : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'
                }`}>
                <span>{p.icon}</span>
                <div className="min-w-0">
                  <span className={`text-xs font-medium ${editPersonality === p.value ? 'text-amber-400' : 'text-zinc-300'}`}>{p.label}</span>
                </div>
              </button>
            ))}
          </div>
          {editPersonality === 'custom' && (
            <textarea value={editCustomSoul} onChange={(e) => setEditCustomSoul(e.target.value)} rows={8} maxLength={5000}
              className="w-full mt-2 px-4 py-3 border border-zinc-700/80 rounded-xl text-sm bg-zinc-800/80 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/50 transition-all resize-y font-mono"
              placeholder="# Soul\n\n## Personality\n...\n\n## Rules\n- ..." />
          )}
          <p className="text-xs text-zinc-500 mt-1">Defines tone, style, and personality rules. Applied via SOUL.md in the agent workspace.</p>
        </div>

        <button onClick={handleSave} disabled={saving}
          className="flex items-center justify-center gap-2 w-full bg-white hover:bg-zinc-200 text-black px-5 py-3 rounded-xl text-sm font-semibold transition-all duration-200 disabled:opacity-50 cursor-pointer shadow-md shadow-white/10 active:scale-[0.98] btn-glow">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Changes
        </button>
      </div>

      {/* Installed Skills */}
      {employee.skills && employee.skills.length > 0 && (
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-white">Installed Skills</h3>
            <Link to={`/marketplace?employee=${id}`} className="text-xs text-amber-400 hover:text-amber-300 transition-colors">+ Add Skills</Link>
          </div>
          <div className="space-y-2">
            {employee.skills.map((skill) => (
              <div key={skill.id} className="flex items-center justify-between py-2.5 border-b border-zinc-800/60 last:border-0">
                <div className="flex items-center gap-2.5">
                  <span className="text-lg">{skill.skills?.icon || '🧩'}</span>
                  <span className="text-sm text-zinc-200">{skill.skills?.name || 'Unknown skill'}</span>
                </div>
                <button onClick={async () => {
                  try { await api.uninstallSkill(id!, skill.skill_id); toast.success('Skill removed'); queryClient.invalidateQueries({ queryKey: ['employee', id] }); }
                  catch { toast.error('Failed to remove skill'); }
                }} className="text-xs text-red-400 hover:text-red-300 cursor-pointer transition-colors">Remove</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      {recentLogs.length > 0 && (
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-white">Recent Activity</h3>
            <Link to={`/logs?employee=${id}`} className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors">
              View All <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {recentLogs.map((log) => (
              <div key={log.id} className="flex items-center justify-between py-1.5 text-sm">
                <div className="flex items-center gap-2">
                  <span className={`h-1.5 w-1.5 rounded-full ${log.success !== false ? 'bg-success' : 'bg-danger'}`} />
                  <span>{log.action}</span>
                </div>
                <span className="text-xs text-muted">{new Date(log.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Danger zone */}
      <div className="rounded-2xl border border-red-500/15 bg-red-500/[0.03] p-6">
        <div className="flex items-center gap-3 mb-3">
          <AlertTriangle className="h-5 w-5 text-red-400" />
          <h3 className="font-semibold text-red-400">Danger Zone</h3>
        </div>
        <p className="text-sm text-zinc-500 mb-4 leading-relaxed">This will stop the container and remove all data. This action cannot be undone.</p>
        <button onClick={handleDelete} disabled={deleting}
          className="flex items-center gap-2 text-red-400 border border-red-500/20 hover:bg-red-500/10 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer disabled:opacity-50">
          {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          Delete Employee
        </button>
      </div>
    </div>
  );
}
