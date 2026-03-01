import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Loader2, Save, Eye, EyeOff, ExternalLink, Trash2, Shield, CheckCircle2, AlertCircle, ChevronRight, ToggleLeft, ToggleRight } from 'lucide-react';

const providers: { value: string; label: string; placeholder: string; helpUrl: string; desc: string }[] = [
  { value: 'openai', label: 'OpenAI', placeholder: 'sk-...', helpUrl: 'https://platform.openai.com/api-keys', desc: 'GPT-4o Mini, GPT-5.2' },
  { value: 'anthropic', label: 'Anthropic', placeholder: 'sk-ant-...', helpUrl: 'https://console.anthropic.com/settings/keys', desc: 'Claude Haiku, Claude Opus' },
  { value: 'google', label: 'Google AI', placeholder: 'AIza...', helpUrl: 'https://aistudio.google.com/apikey', desc: 'Gemini Flash, Gemini 3.0' },
];

export default function ApiKeys() {
  const [apiKey, setApiKey] = useState('');
  const [provider, setProvider] = useState('openai');
  const [tier, setTier] = useState<'budget' | 'premium'>('budget');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [longContext, setLongContext] = useState(false);
  const [togglingContext, setTogglingContext] = useState(false);
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: api.getProfile,
  });

  const hasKey = profile?.has_api_key || false;
  const currentProvider = providers.find((p) => p.value === provider) || providers[0];

  useEffect(() => {
    if (!profile) return;
    if (profile.api_key_provider && typeof profile.api_key_provider === 'string') {
      setProvider(profile.api_key_provider);
    }
    if (profile.api_model_tier === 'budget' || profile.api_model_tier === 'premium') {
      setTier(profile.api_model_tier);
    }
    setLongContext(!!profile.long_context);
  }, [profile]);

  const tierLabels: Record<string, { budget: string; premium: string }> = {
    openai: { budget: 'GPT-4o Mini', premium: 'GPT-5.2' },
    anthropic: { budget: 'Claude Haiku', premium: 'Claude Opus' },
    google: { budget: 'Gemini Flash', premium: 'Gemini 3.0' }
  };
  const tierLabel = tierLabels[provider] || tierLabels.openai;

  const handleSave = async () => {
    if (!apiKey.trim()) { toast.error('API key is required'); return; }
    setSaving(true);
    try {
      await api.saveApiKey(apiKey.trim(), provider, tier);
      toast.success('API key saved!');
      setApiKey('');
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!confirm('Remove your API key? Your AI employees will stop working.')) return;
    setRemoving(true);
    try {
      await api.removeApiKey();
      toast.success('API key removed');
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove');
    } finally {
      setRemoving(false);
    }
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
        <p className="text-sm text-zinc-500 mb-1">Settings</p>
        <h1 className="text-3xl font-bold text-white tracking-tight">API Keys</h1>
        <p className="text-zinc-500 text-[15px] mt-2 leading-relaxed">
          Your AI employees use this key to generate responses. You pay the provider directly — full cost transparency.
        </p>
      </div>

      {/* Status card */}
      <div className={`rounded-2xl border p-5 flex items-center gap-4 ${
        hasKey ? 'border-emerald-500/20 bg-emerald-500/[0.04]' : 'border-amber-500/20 bg-amber-500/[0.04]'
      }`}>
        <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${
          hasKey ? 'bg-emerald-500/10' : 'bg-amber-500/10'
        }`}>
          {hasKey ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <AlertCircle className="h-5 w-5 text-amber-400" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className={`font-semibold text-sm ${hasKey ? 'text-emerald-400' : 'text-amber-400'}`}>
            {hasKey ? 'API Key Active' : 'No API Key Configured'}
          </div>
          <div className="text-xs text-zinc-500 mt-0.5">
            {hasKey ? 'Encrypted with AES-256 · Stored securely' : 'Add your key below to activate AI employees'}
          </div>
        </div>
        {hasKey && (
          <button onClick={handleRemove} disabled={removing}
            className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 px-3 py-2 rounded-lg transition-all cursor-pointer disabled:opacity-50 shrink-0">
            {removing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
            Remove
          </button>
        )}
      </div>

      {/* Provider selection */}
      <div>
        <label className="block text-sm font-semibold text-white mb-3">Choose Provider</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {providers.map((p) => (
            <button key={p.value} onClick={() => setProvider(p.value)}
              className={`text-left rounded-xl border p-4 transition-all duration-200 cursor-pointer active:scale-[0.97] ${
                provider === p.value
                  ? 'border-amber-500/40 bg-amber-500/[0.06]'
                  : 'border-zinc-800/80 bg-zinc-900/50 hover:border-zinc-700'
              }`}>
              <div className={`text-sm font-semibold mb-0.5 ${provider === p.value ? 'text-amber-400' : 'text-white'}`}>{p.label}</div>
              <div className="text-xs text-zinc-500">{p.desc}</div>
            </button>
          ))}
        </div>
        <a href={currentProvider.helpUrl} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 mt-3 transition-colors">
          Get a {currentProvider.label} API key <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {/* Model tier selection */}
      <div>
        <label className="block text-sm font-semibold text-white mb-3">Choose Model Tier</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button onClick={() => setTier('budget')}
            className={`text-left rounded-xl border p-4 transition-all duration-200 cursor-pointer active:scale-[0.97] ${
              tier === 'budget'
                ? 'border-amber-500/40 bg-amber-500/[0.06]'
                : 'border-zinc-800/80 bg-zinc-900/50 hover:border-zinc-700'
            }`}>
            <div className={`text-sm font-semibold mb-0.5 ${tier === 'budget' ? 'text-amber-400' : 'text-white'}`}>Budget</div>
            <div className="text-xs text-zinc-500">{tierLabel.budget} · Lower cost</div>
          </button>
          <button onClick={() => setTier('premium')}
            className={`text-left rounded-xl border p-4 transition-all duration-200 cursor-pointer active:scale-[0.97] ${
              tier === 'premium'
                ? 'border-amber-500/40 bg-amber-500/[0.06]'
                : 'border-zinc-800/80 bg-zinc-900/50 hover:border-zinc-700'
            }`}>
            <div className={`text-sm font-semibold mb-0.5 ${tier === 'premium' ? 'text-amber-400' : 'text-white'}`}>Premium</div>
            <div className="text-xs text-zinc-500">{tierLabel.premium} · Best quality</div>
          </button>
        </div>
        <div className="text-xs text-zinc-500 mt-2">
          Your provider charges you directly. Premium tiers can be significantly more expensive.
        </div>
      </div>

      {/* Long Context Toggle */}
      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-sm font-semibold text-white">Long Context Mode</h3>
              {longContext && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  ON
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed">
              {longContext
                ? 'Keeping last 50 messages in context. Better memory, higher token usage.'
                : 'Keeping last 10 messages in context. Lower cost, faster responses.'}
            </p>
          </div>
          <button
            onClick={async () => {
              setTogglingContext(true);
              try {
                const newVal = !longContext;
                await api.toggleLongContext(newVal);
                setLongContext(newVal);
                queryClient.invalidateQueries({ queryKey: ['profile'] });
                toast.success(newVal ? 'Long context enabled' : 'Long context disabled');
              } catch (err: unknown) {
                toast.error(err instanceof Error ? err.message : 'Failed to toggle');
              } finally {
                setTogglingContext(false);
              }
            }}
            disabled={togglingContext}
            className="ml-4 shrink-0 cursor-pointer transition-all duration-200 hover:opacity-80 disabled:opacity-50"
          >
            {togglingContext ? (
              <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
            ) : longContext ? (
              <ToggleRight className="h-8 w-8 text-amber-400" />
            ) : (
              <ToggleLeft className="h-8 w-8 text-zinc-600" />
            )}
          </button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className={`rounded-lg border p-2.5 text-center transition-all ${
            !longContext ? 'border-amber-500/30 bg-amber-500/[0.06]' : 'border-zinc-800/60 bg-zinc-800/30'
          }`}>
            <div className={`text-xs font-semibold ${!longContext ? 'text-amber-400' : 'text-zinc-500'}`}>Short</div>
            <div className="text-[11px] text-zinc-500 mt-0.5">10 messages · Lower cost</div>
          </div>
          <div className={`rounded-lg border p-2.5 text-center transition-all ${
            longContext ? 'border-amber-500/30 bg-amber-500/[0.06]' : 'border-zinc-800/60 bg-zinc-800/30'
          }`}>
            <div className={`text-xs font-semibold ${longContext ? 'text-amber-400' : 'text-zinc-500'}`}>Long</div>
            <div className="text-[11px] text-zinc-500 mt-0.5">50 messages · Better memory</div>
          </div>
        </div>
      </div>

      {/* API Key input */}
      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-6 space-y-4">
        <div>
          <label htmlFor="api-key" className="block text-sm font-semibold text-white mb-2">
            {hasKey ? 'Replace API Key' : 'Enter API Key'}
          </label>
          <div className="relative">
            <input id="api-key" type={showKey ? 'text' : 'password'} value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full px-4 py-3 pr-11 border border-zinc-700 rounded-xl text-sm bg-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/50 transition-all"
              placeholder={currentProvider.placeholder} />
            <button type="button" onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 cursor-pointer transition-colors">
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <button onClick={handleSave} disabled={saving || !apiKey.trim()}
          className="flex items-center justify-center gap-2 w-full bg-white hover:bg-zinc-200 text-black py-3 rounded-xl text-sm font-semibold transition-all duration-200 disabled:opacity-40 cursor-pointer shadow-md shadow-white/10 active:scale-[0.98] btn-glow">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {hasKey ? 'Update API Key' : 'Save API Key'}
        </button>
      </div>

      {/* Security info */}
      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="h-5 w-5 text-zinc-400" />
          <h3 className="text-sm font-semibold text-white">How we protect your key</h3>
        </div>
        <div className="space-y-3">
          {[
            'AES-256 encryption at rest — industry standard',
            'Key is never logged or exposed in plain text',
            'Only your AI containers can decrypt and use it',
            'You can remove it anytime — instant revocation',
          ].map((item) => (
            <div key={item} className="flex items-start gap-2.5">
              <ChevronRight className="h-3.5 w-3.5 text-amber-400 mt-0.5 shrink-0" />
              <span className="text-sm text-zinc-400 leading-relaxed">{item}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
