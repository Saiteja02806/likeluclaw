import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Send } from 'lucide-react';

export default function ConnectTelegram() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    const trimmed = token.trim();
    if (!trimmed) {
      toast.error('Please enter a bot token');
      return;
    }
    if (!/^\d+:[A-Za-z0-9_-]+$/.test(trimmed)) {
      toast.error('Invalid token format. It should look like: 7123456789:AAH3k5Lz...');
      return;
    }

    setLoading(true);
    try {
      await api.connectTelegram(id!, trimmed);
      toast.success('Telegram bot connected!');
      await queryClient.invalidateQueries({ queryKey: ['employee', id] });
      navigate(`/employees/${id}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to connect Telegram');
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to={`/employees/${id}`} className="text-zinc-400 hover:text-white transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Connect Telegram Bot</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Step 1 of 1 · Paste your bot token</p>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-6 max-w-lg space-y-6">
        {/* Step 1 */}
        <div>
          <h3 className="font-semibold text-sm mb-3 text-white">Step 1: Create a bot on Telegram</h3>
          <ol className="text-sm text-zinc-400 space-y-1.5 list-decimal list-inside">
            <li>Open Telegram on your phone</li>
            <li>Search for <strong className="text-amber-400">@BotFather</strong></li>
            <li>Send: <code className="bg-zinc-800 text-amber-400 px-1.5 py-0.5 rounded text-xs border border-zinc-700">/newbot</code></li>
            <li>Choose a name (e.g., "My AI Assistant")</li>
            <li>Choose a username (must end in "bot")</li>
            <li>Copy the bot token BotFather gives you</li>
          </ol>
        </div>

        {/* Step 2 */}
        <div>
          <h3 className="font-semibold text-sm mb-3 text-white">Step 2: Paste the token here</h3>
          <label htmlFor="tg-token" className="block text-sm font-medium mb-1.5 text-zinc-300">Bot Token</label>
          <input
            id="tg-token"
            type="text"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="w-full px-4 py-3 border border-zinc-700/80 rounded-xl text-sm bg-zinc-800/80 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-400/20 focus:border-blue-400/50 transition-all font-mono"
            placeholder="7123456789:AAH3k5Lz1PxR9mN..."
          />
          <p className="text-xs text-zinc-500 mt-1.5">Your token is encrypted and stored securely.</p>
        </div>

        <button
          onClick={handleConnect}
          disabled={loading}
          className="flex items-center justify-center gap-2 w-full bg-white hover:bg-zinc-200 text-black py-3 rounded-xl text-sm font-semibold transition-all duration-200 disabled:opacity-50 cursor-pointer shadow-md shadow-white/10 active:scale-[0.98] btn-glow"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {loading ? 'Connecting...' : 'Connect Telegram'}
        </button>
      </div>
    </div>
  );
}
