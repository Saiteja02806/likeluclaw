import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

function getPasswordStrength(pw: string): { label: string; color: string; width: string } {
  if (pw.length < 8) return { label: 'Too short', color: 'bg-danger', width: 'w-1/4' };
  let score = 0;
  if (/[a-z]/.test(pw)) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;
  if (score <= 1) return { label: 'Weak', color: 'bg-danger', width: 'w-1/3' };
  if (score <= 2) return { label: 'Medium', color: 'bg-warning', width: 'w-2/3' };
  return { label: 'Strong', color: 'bg-success', width: 'w-full' };
}

export default function Signup() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  if (authLoading) return null;
  if (user) return <Navigate to="/dashboard" replace />;

  const strength = getPasswordStrength(password);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!fullName.trim()) { toast.error('Full name is required'); return; }
    if (password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    if (password !== confirm) { toast.error('Passwords do not match'); return; }

    setLoading(true);
    const { error } = await signUp(email, password, fullName);

    if (error) {
      toast.error(error);
      setLoading(false);
    } else {
      toast.success('Account created! Check your email for verification, then log in.');
      setTimeout(() => navigate('/login'), 3000);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fffdfa] px-4 relative overflow-hidden">
      <div className="absolute w-[500px] h-[500px] bg-orange-400/[0.07] rounded-full blur-[140px] top-[-15%] right-[-10%] pointer-events-none" />
      <div className="absolute w-[300px] h-[300px] bg-orange-300/[0.05] rounded-full blur-[100px] bottom-[-10%] left-[-5%] pointer-events-none" />
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center justify-center gap-2 mb-3 hover:opacity-80 transition-opacity">
            <img src="/logo.svg?v=3" alt="LikelyClaw" className="h-8 w-auto" />
            <span className="text-xl font-bold text-[#0a0a0a]">LikelyClaw</span>
          </Link>
          <p className="text-gray-400 text-sm">Create your account</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-black/[0.07] p-7 space-y-5 border-t-2 border-t-orange-400/50">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="signup-name" className="block text-sm font-semibold mb-1.5 text-[#0a0a0a]">Full Name</label>
              <input id="signup-name" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required
                className="w-full px-4 py-3 border border-black/[0.1] rounded-xl text-sm bg-[#fffdfa] text-[#0a0a0a] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400/50 transition-all"
                placeholder="John Doe" />
            </div>

            <div>
              <label htmlFor="signup-email" className="block text-sm font-semibold mb-1.5 text-[#0a0a0a]">Email</label>
              <input id="signup-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                className="w-full px-4 py-3 border border-black/[0.1] rounded-xl text-sm bg-[#fffdfa] text-[#0a0a0a] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400/50 transition-all"
                placeholder="you@example.com" />
            </div>

            <div>
              <label htmlFor="signup-password" className="block text-sm font-semibold mb-1.5 text-[#0a0a0a]">Password</label>
              <input id="signup-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                className="w-full px-4 py-3 border border-black/[0.1] rounded-xl text-sm bg-[#fffdfa] text-[#0a0a0a] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400/50 transition-all"
                placeholder="Min 8 characters" />
              {password.length > 0 && (
                <div className="mt-2">
                  <div className="h-1.5 bg-black/[0.06] rounded-full overflow-hidden">
                    <div className={`h-full ${strength.color} ${strength.width} transition-all duration-300 rounded-full`} />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{strength.label}</p>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="signup-confirm" className="block text-sm font-semibold mb-1.5 text-[#0a0a0a]">Confirm Password</label>
              <input id="signup-confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required
                className="w-full px-4 py-3 border border-black/[0.1] rounded-xl text-sm bg-[#fffdfa] text-[#0a0a0a] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400/50 transition-all"
                placeholder="••••••••" />
            </div>

            <button type="submit" disabled={loading}
              className="flex items-center justify-center gap-2 w-full bg-[#0a0a0a] hover:bg-[#222] text-white py-3 rounded-xl text-sm font-semibold transition-all duration-200 disabled:opacity-50 cursor-pointer shadow-sm active:scale-[0.98] btn-glow">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-400">
            Already have an account?{' '}
            <Link to="/login" className="text-orange-500 hover:underline font-semibold">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
