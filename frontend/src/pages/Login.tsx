import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const { signIn, resetPassword, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  if (authLoading) return null;
  if (user) return <Navigate to="/dashboard" replace />;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    if (error) {
      toast.error(error);
      setLoading(false);
    } else {
      navigate('/dashboard');
    }
  };

  const handleResetPassword = async () => {
    if (!resetEmail.trim()) {
      toast.error('Enter your email address');
      return;
    }
    const { error } = await resetPassword(resetEmail.trim());
    if (error) {
      toast.error(error);
    } else {
      toast.success('Password reset link sent to your email');
      setShowReset(false);
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
          <p className="text-gray-400 text-sm">Sign in to your account</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-black/[0.07] p-7 space-y-5 border-t-2 border-t-orange-400/50">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="login-email" className="block text-sm font-semibold mb-1.5 text-[#0a0a0a]">Email</label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 border border-black/[0.1] rounded-xl text-sm bg-[#fffdfa] text-[#0a0a0a] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400/50 transition-all"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="login-password" className="block text-sm font-semibold text-[#0a0a0a]">Password</label>
                <button
                  type="button"
                  onClick={() => { setShowReset(true); setResetEmail(email); }}
                  className="text-xs text-orange-500 hover:underline cursor-pointer font-medium"
                >
                  Forgot password?
                </button>
              </div>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 border border-black/[0.1] rounded-xl text-sm bg-[#fffdfa] text-[#0a0a0a] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400/50 transition-all"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center gap-2 w-full bg-[#0a0a0a] hover:bg-[#222] text-white py-3 rounded-xl text-sm font-semibold transition-all duration-200 disabled:opacity-50 cursor-pointer shadow-sm active:scale-[0.98] btn-glow focus-ring"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? 'Signing in...' : 'Log In'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-400">
            Don't have an account?{' '}
            <Link to="/signup" className="text-orange-500 hover:underline font-semibold">
              Sign up
            </Link>
          </p>
        </div>

        {/* Forgot Password Modal */}
        {showReset && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <button type="button" className="absolute inset-0 bg-black/20 backdrop-blur-sm border-none p-0 cursor-default" onClick={() => setShowReset(false)} aria-label="Close modal" />
            <div className="relative bg-white border border-black/[0.07] rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-lg">
              <h3 className="font-bold text-[#0a0a0a]">Reset Password</h3>
              <p className="text-sm text-gray-400">Enter your email and we'll send a reset link.</p>
              <input
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                className="w-full px-4 py-3 border border-black/[0.1] rounded-xl text-sm bg-[#fffdfa] text-[#0a0a0a] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400/50 transition-all"
                placeholder="you@example.com"
              />
              <div className="flex gap-2">
                <button onClick={() => setShowReset(false)} className="flex-1 py-3 rounded-xl text-sm border border-black/[0.1] text-gray-500 hover:bg-gray-50 cursor-pointer transition-all active:scale-[0.98]">Cancel</button>
                <button onClick={handleResetPassword} className="flex-1 py-3 rounded-xl text-sm bg-[#0a0a0a] text-white font-semibold hover:bg-[#222] cursor-pointer transition-all active:scale-[0.98] shadow-sm">Send Link</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
