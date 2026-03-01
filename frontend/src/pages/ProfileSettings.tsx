import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Loader2, Save, AlertTriangle, User, Lock, Mail, Trash2, LogOut } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';

export default function ProfileSettings() {
  const { user, resetPassword, signOut } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [saving, setSaving] = useState(false);
  const [formInit, setFormInit] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: api.getProfile,
  });

  if (profile && !formInit) {
    setFullName(profile.full_name || '');
    setFormInit(true);
  }

  const handleSave = async () => {
    if (!fullName.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      await api.updateProfile({ full_name: fullName.trim() });
      toast.success('Profile saved!');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (!user?.email) return;
    const { error } = await resetPassword(user.email);
    if (error) {
      toast.error(error);
    } else {
      toast.success('Password reset link sent to your email');
    }
  };

  const handleDeleteAccount = () => {
    const confirmed = prompt('This will delete all your employees, data, and configurations.\nType DELETE to confirm.');
    if (confirmed !== 'DELETE') return;
    toast.error('Account deletion is not yet implemented. Contact support.');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Header */}
      <div>
        <p className="text-sm text-zinc-500 mb-1">Account</p>
        <h1 className="text-3xl font-bold text-white tracking-tight">Profile</h1>
        <p className="text-zinc-500 text-[15px] mt-2">Manage your personal information and security</p>
      </div>

      {/* Avatar + Name section */}
      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-6 space-y-5">
        <div className="flex items-center gap-4 pb-5 border-b border-zinc-800/60">
          <div className="h-14 w-14 rounded-2xl bg-amber-500/10 flex items-center justify-center shrink-0">
            <User className="h-7 w-7 text-amber-400" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-white text-lg">{profile?.full_name || 'Your Name'}</div>
            <div className="text-sm text-zinc-500 truncate">{user?.email}</div>
          </div>
          <Link to="/billing" className="ml-auto">
            <span className="text-xs font-medium text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full capitalize border border-amber-500/10 hover:bg-amber-500/20 transition-colors cursor-pointer">
              {profile?.plan || 'free'}
            </span>
          </Link>
        </div>

        <div>
          <label htmlFor="prof-name" className="block text-sm font-semibold text-white mb-2">Full Name</label>
          <input id="prof-name" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
            className="w-full px-4 py-3 border border-zinc-700 rounded-xl text-sm bg-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/50 transition-all" />
        </div>

        <div>
          <label className="block text-sm font-semibold text-white mb-2">
            <span className="flex items-center gap-2">
              <Mail className="h-3.5 w-3.5 text-zinc-500" /> Email
            </span>
          </label>
          <input type="email" value={user?.email || ''} disabled
            className="w-full px-4 py-3 border border-zinc-800 rounded-xl text-sm bg-zinc-800/50 text-zinc-500 cursor-not-allowed" />
          <p className="text-xs text-zinc-600 mt-1.5">Email address cannot be changed</p>
        </div>

        <button onClick={handleSave} disabled={saving}
          className="flex items-center justify-center gap-2 w-full bg-white hover:bg-zinc-200 text-black py-3 rounded-xl text-sm font-semibold transition-all duration-200 disabled:opacity-50 cursor-pointer shadow-md shadow-white/10 active:scale-[0.98] btn-glow">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Changes
        </button>
      </div>

      {/* Security */}
      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Lock className="h-5 w-5 text-zinc-400" />
          <h3 className="font-semibold text-white">Security</h3>
        </div>
        <p className="text-sm text-zinc-500 mb-4 leading-relaxed">We'll send a password reset link to your email address.</p>
        <button onClick={handleResetPassword}
          className="border border-zinc-700/80 text-zinc-300 hover:text-white hover:border-zinc-600 hover:bg-zinc-800/80 px-5 py-3 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer active:scale-[0.98]">
          Reset Password
        </button>
      </div>

      {/* Sign Out */}
      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-6">
        <div className="flex items-center gap-3 mb-4">
          <LogOut className="h-5 w-5 text-zinc-400" />
          <h3 className="font-semibold text-white">Sign Out</h3>
        </div>
        <p className="text-sm text-zinc-500 mb-4 leading-relaxed">Sign out of your LikelyClaw account on this device.</p>
        <button onClick={async () => { await signOut(); navigate('/login'); }}
          className="border border-zinc-700/80 text-zinc-300 hover:text-white hover:border-zinc-600 hover:bg-zinc-800/80 px-5 py-3 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer active:scale-[0.98]">
          Sign Out
        </button>
      </div>

      {/* Danger Zone */}
      <div className="rounded-2xl border border-red-500/15 bg-red-500/[0.03] p-6">
        <div className="flex items-center gap-3 mb-3">
          <AlertTriangle className="h-5 w-5 text-red-400" />
          <h3 className="font-semibold text-red-400">Danger Zone</h3>
        </div>
        <p className="text-sm text-zinc-500 mb-4 leading-relaxed">
          Permanently delete your account, all employees, data, and configurations. This action cannot be undone.
        </p>
        <button onClick={handleDeleteAccount}
          className="flex items-center gap-2 text-red-400 border border-red-500/20 hover:bg-red-500/10 px-5 py-3 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer active:scale-[0.98]">
          <Trash2 className="h-3.5 w-3.5" />
          Delete Account
        </button>
      </div>
    </div>
  );
}
