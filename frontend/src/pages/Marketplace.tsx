import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { usePlan } from '@/lib/usePlan';
import { toast } from 'sonner';
import { ShoppingBag, Loader2, Download, AlertCircle, Sparkles, Search, Check, AlertTriangle, ExternalLink, Trash2, X, Globe, Key, ArrowRight, Plug, Crown } from 'lucide-react';

const SpotifyIcon = ({ className = '' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
  </svg>
);

const XIcon = ({ className = '' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

const skillIconMap: Record<string, React.ReactNode> = {
  'spotify': <SpotifyIcon className="h-6 w-6 text-[#1DB954]" />,
  'twitter': <XIcon className="h-5 w-5 text-white" />,
  'gmail': <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none"><rect x="2" y="4" width="20" height="16" rx="2.5" stroke="#A78BFA" strokeWidth="1.8"/><path d="M2 7l10 6.5L22 7" stroke="#8B5CF6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  'calendar': <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="2.5" stroke="#A78BFA" strokeWidth="1.8"/><path d="M3 9h18" stroke="#A78BFA" strokeWidth="1.8"/><path d="M8 2v4M16 2v4" stroke="#8B5CF6" strokeWidth="1.8" strokeLinecap="round"/><rect x="7" y="12" width="3" height="2.5" rx="0.5" fill="#8B5CF6"/></svg>,
  'coding': <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none"><polyline points="16,18 22,12 16,6" stroke="#A78BFA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><polyline points="8,6 2,12 8,18" stroke="#A78BFA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><line x1="14" y1="4" x2="10" y2="20" stroke="#A78BFA" strokeWidth="2" strokeLinecap="round"/></svg>,
  'web-browser': <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#60A5FA" strokeWidth="2"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" stroke="#60A5FA" strokeWidth="2"/></svg>,
  'general-chat': <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="#A3A3A3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="9" cy="10" r="1" fill="#A3A3A3"/><circle cx="12" cy="10" r="1" fill="#A3A3A3"/><circle cx="15" cy="10" r="1" fill="#A3A3A3"/></svg>,
  'sales-crm': <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none"><rect x="2" y="3" width="20" height="18" rx="2" stroke="#F59E0B" strokeWidth="2"/><path d="M8 7v10M12 10v7M16 5v12" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round"/></svg>,
  'news': <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none"><path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" stroke="#F87171" strokeWidth="2"/><path d="M6 8h4v4H6z" stroke="#F87171" strokeWidth="2"/><path d="M14 8h4M14 12h4M6 16h12" stroke="#F87171" strokeWidth="2" strokeLinecap="round"/></svg>,
  'weather': <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="10" r="4" stroke="#FBBF24" strokeWidth="2"/><path d="M12 2v2M12 16v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 10h2M20 10h2M4.93 15.07l1.41-1.41M17.66 2.34l1.41 1.41" stroke="#FBBF24" strokeWidth="2" strokeLinecap="round"/><path d="M6 19a4 4 0 0 1 4-4h4a4 4 0 0 1 0 8H10a4 4 0 0 1-4-4z" stroke="#94A3B8" strokeWidth="2"/></svg>,
  'deep-research': <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="#818CF8" strokeWidth="2"/><path d="M21 21l-4.35-4.35" stroke="#818CF8" strokeWidth="2" strokeLinecap="round"/><path d="M11 8v6M8 11h6" stroke="#818CF8" strokeWidth="2" strokeLinecap="round"/></svg>,
  'mcp-bridge': <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none"><rect x="2" y="2" width="8" height="8" rx="2" stroke="#34D399" strokeWidth="2"/><rect x="14" y="14" width="8" height="8" rx="2" stroke="#34D399" strokeWidth="2"/><path d="M10 6h4M6 10v4M18 10v4M10 18h4" stroke="#34D399" strokeWidth="2" strokeLinecap="round"/><circle cx="12" cy="12" r="2" fill="#34D399"/></svg>,
  'friend': <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none"><path d="M7 11l3.5 3.5c.3.3.7.3 1 0l-1-1" stroke="#F59E0B" strokeWidth="0"/><path d="M20 8.5c0-.83-.67-1.5-1.5-1.5h-1.24c-.33 0-.65.13-.88.37L14.5 9.25l-1.88-1.88A1.25 1.25 0 0 0 11.75 7H10.5C9.67 7 9 7.67 9 8.5v.75L5.37 12.87a1.25 1.25 0 0 0 0 1.77l3 3a1.25 1.25 0 0 0 1.76 0L13.5 14.25l3.63 3.63a1.25 1.25 0 0 0 1.77 0l3-3a1.25 1.25 0 0 0 0-1.76L20 11.25V8.5z" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" stroke="#F59E0B" strokeWidth="1.5" fill="none"/></svg>,
  'ai-lover': <svg className="h-6 w-6" viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" fill="#F472B6" stroke="#F472B6" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/></svg>,
};

interface Skill {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  price_monthly: number;
  icon: string | null;
  needs_credentials: boolean;
  credential_type: string | null;
}

interface Employee {
  id: string;
  name: string;
}

interface InstalledSkill {
  id: string;
  status: string;
  skills: { id: string; slug: string };
}

const categoryIcons: Record<string, string> = {
  general: '💬', development: '👨‍💻', productivity: '📅', business: '🏢', utilities: '⚙️', research: '🌐', entertainment: '🎵', social: '👥',
};

const categories = ['all', 'general', 'development', 'productivity', 'business', 'utilities', 'research', 'entertainment', 'social'];

export default function Marketplace() {
  const { isPremium } = usePlan();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [installingSkill, setInstallingSkill] = useState<string | null>(null);
  const [uninstallingSkill, setUninstallingSkill] = useState<string | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [braveModalOpen, setBraveModalOpen] = useState(false);
  const [braveApiKey, setBraveApiKey] = useState('');
  const [braveSubmitting, setBraveSubmitting] = useState(false);
  const [, setPendingBraveSkill] = useState<Skill | null>(null);
  const [twitterModalOpen, setTwitterModalOpen] = useState(false);
  const [twitterToken, setTwitterToken] = useState('');
  const [twitterSubmitting, setTwitterSubmitting] = useState(false);
  const [spotifyModalOpen, setSpotifyModalOpen] = useState(false);
  const [spotifyClientId, setSpotifyClientId] = useState('');
  const [spotifyClientSecret, setSpotifyClientSecret] = useState('');
  const [spotifySubmitting, setSpotifySubmitting] = useState(false);
  const queryClient = useQueryClient();

  // Listen for OAuth popup completion
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'oauth_success') {
        toast.success('Google account connected successfully!');
        queryClient.invalidateQueries({ queryKey: ['installed-skills', selectedEmployee] });
        queryClient.invalidateQueries({ queryKey: ['employee', selectedEmployee] });
      } else if (event.data?.type === 'oauth_error') {
        toast.error('Google connection failed: ' + (event.data.error || 'Unknown error'));
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [queryClient, selectedEmployee]);

  const { data: skillsData, isLoading: skillsLoading, error: skillsError } = useQuery({
    queryKey: ['skills'],
    queryFn: () => api.listSkills(),
  });

  const { data: empData } = useQuery({
    queryKey: ['employees'],
    queryFn: () => api.listEmployees().catch(() => ({ employees: [] })),
  });

  // Fetch installed skills for the selected employee
  const { data: installedData } = useQuery({
    queryKey: ['installed-skills', selectedEmployee],
    queryFn: () => api.getInstalledSkills(selectedEmployee),
    enabled: !!selectedEmployee,
  });

  const skills: Skill[] = skillsData?.skills || [];
  const employees: Employee[] = empData?.employees || [];
  const installedSkills: InstalledSkill[] = installedData?.installed_skills || [];

  // Auto-select when there's exactly 1 employee — no need to force user to pick
  useEffect(() => {
    if (employees.length === 1 && !selectedEmployee) {
      setSelectedEmployee(employees[0].id);
    }
  }, [employees, selectedEmployee]);

  // Build a map: skillId → status
  const installedMap = new Map<string, string>();
  for (const is of installedSkills) {
    installedMap.set(is.skills?.id || '', is.status);
  }

  const filteredSkills = selectedCategory === 'all'
    ? skills
    : skills.filter((s) => s.category === selectedCategory);

  const handleInstall = async (skill: Skill) => {
    if (!selectedEmployee) {
      toast.error('Select an employee first');
      return;
    }
    await doInstall(skill);
  };

  const doInstall = async (skill: Skill) => {
    setInstallingSkill(skill.id);
    try {
      const result = await api.installSkill(selectedEmployee, skill.id);
      queryClient.invalidateQueries({ queryKey: ['installed-skills', selectedEmployee] });
      queryClient.invalidateQueries({ queryKey: ['employee', selectedEmployee] });

      if (result.needs_setup && result.credential_type === 'google_oauth') {
        // Google OAuth skills now use Composio — redirect to Integrations page
        toast.success('Skill installed! Connect your Google account via Integrations.');
        window.location.href = '/integrations';
      } else if (result.needs_setup && result.credential_type === 'brave_api_key') {
        setPendingBraveSkill(skill);
        setBraveApiKey('');
        setBraveModalOpen(true);
      } else if (result.needs_setup && result.credential_type === 'twitter_api_key') {
        setTwitterToken('');
        setTwitterModalOpen(true);
      } else if (result.needs_setup && result.credential_type === 'spotify_api_key') {
        setSpotifyClientId('');
        setSpotifyClientSecret('');
        setSpotifyModalOpen(true);
      } else if (result.needs_setup && result.credential_type === 'mcp_server_url') {
        toast.success('MCP Bridge installed! Go to Integrations to add servers.');
      } else if (result.needs_setup) {
        toast.success('Skill installed! Credentials setup required.');
      } else if (result.auto_configured) {
        toast.success(`${skill.name} installed! Brave API key auto-configured from existing setup.`);
      } else {
        toast.success('Skill installed successfully!');
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to install skill');
    } finally {
      setInstallingSkill(null);
    }
  };

  const handleUninstall = async (skillId: string) => {
    if (!selectedEmployee) return;
    setUninstallingSkill(skillId);
    try {
      await api.uninstallSkill(selectedEmployee, skillId);
      toast.success('Skill removed');
      queryClient.invalidateQueries({ queryKey: ['installed-skills', selectedEmployee] });
      queryClient.invalidateQueries({ queryKey: ['employee', selectedEmployee] });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove skill');
    } finally {
      setUninstallingSkill(null);
    }
  };

  const handleSetupCredentials = async (skill: Skill) => {
    if (!selectedEmployee) return;
    if (skill.credential_type === 'google_oauth') {
      // Google OAuth skills now use Composio — redirect to Integrations page
      toast.info('Connect your Google account via the Integrations page.');
      window.location.href = '/integrations';
    } else if (skill.credential_type === 'brave_api_key') {
      setPendingBraveSkill(skill);
      setBraveApiKey('');
      setBraveModalOpen(true);
    } else if (skill.credential_type === 'twitter_api_key') {
      setTwitterToken('');
      setTwitterModalOpen(true);
    } else if (skill.credential_type === 'spotify_api_key') {
      setSpotifyClientId('');
      setSpotifyClientSecret('');
      setSpotifyModalOpen(true);
    } else if (skill.credential_type === 'mcp_server_url') {
      window.location.href = '/integrations';
    } else {
      toast.info('Custom credential setup coming soon.');
    }
  };

  const handleBraveSubmit = async () => {
    if (!braveApiKey.trim() || !selectedEmployee) return;
    setBraveSubmitting(true);
    try {
      await api.configureBrave(selectedEmployee, braveApiKey.trim());
      toast.success('Web search configured! Your agent can now browse the web.');
      setBraveModalOpen(false);
      setBraveApiKey('');
      setPendingBraveSkill(null);
      queryClient.invalidateQueries({ queryKey: ['installed-skills', selectedEmployee] });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to configure web search');
    } finally {
      setBraveSubmitting(false);
    }
  };

  const handleTwitterSubmit = async () => {
    if (!twitterToken.trim() || !selectedEmployee) return;
    setTwitterSubmitting(true);
    try {
      await api.configureTwitter(selectedEmployee, twitterToken.trim());
      toast.success('Twitter configured! Your agent can now search tweets and profiles.');
      setTwitterModalOpen(false);
      setTwitterToken('');
      queryClient.invalidateQueries({ queryKey: ['installed-skills', selectedEmployee] });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to configure Twitter');
    } finally {
      setTwitterSubmitting(false);
    }
  };

  const handleSpotifySubmit = async () => {
    if (!spotifyClientId.trim() || !spotifyClientSecret.trim() || !selectedEmployee) return;
    setSpotifySubmitting(true);
    try {
      await api.configureSpotify(selectedEmployee, spotifyClientId.trim(), spotifyClientSecret.trim());
      toast.success('Spotify configured! Your agent can now search music and artists.');
      setSpotifyModalOpen(false);
      setSpotifyClientId('');
      setSpotifyClientSecret('');
      queryClient.invalidateQueries({ queryKey: ['installed-skills', selectedEmployee] });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to configure Spotify');
    } finally {
      setSpotifySubmitting(false);
    }
  };


  const getSkillStatus = (skillId: string) => installedMap.get(skillId) || null;

  if (skillsLoading) {
    return (
      <div className="space-y-8">
        <div>
          <div className="skeleton h-4 w-16 mb-2" />
          <div className="skeleton h-8 w-56 mb-2" />
          <div className="skeleton h-4 w-72" />
        </div>
        <div className="flex gap-2">{[1,2,3,4,5].map(i => <div key={i} className="skeleton h-9 w-24 rounded-xl" />)}</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-5">
              <div className="skeleton h-8 w-8 rounded-lg mb-3" />
              <div className="skeleton h-4 w-28 mb-2" />
              <div className="skeleton h-3 w-full mb-1" />
              <div className="skeleton h-3 w-3/4 mb-4" />
              <div className="skeleton h-10 w-full rounded-xl mt-4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="h-4 w-4 text-amber-400" />
          <p className="text-sm text-zinc-500">Explore</p>
        </div>
        <h1 className="text-3xl font-bold text-white tracking-tight">Skill Marketplace</h1>
        <p className="text-zinc-500 text-[15px] mt-2 leading-relaxed">
          Supercharge your AI employees with new capabilities
        </p>
      </div>

      {/* Error banner */}
      {skillsError && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/[0.04] p-4 flex items-center gap-3 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Failed to load skills. Please refresh the page.
        </div>
      )}

      {/* No employees banner */}
      {employees.length === 0 && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-5 flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
            <AlertCircle className="h-5 w-5 text-amber-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-white">Create an employee first</p>
            <p className="text-xs text-zinc-400 mt-0.5">You need at least one AI employee to install skills on.</p>
          </div>
          <Link to="/employees/new" className="px-4 py-2 bg-white hover:bg-zinc-200 text-black text-sm font-semibold rounded-xl transition-all shrink-0 shadow-md shadow-white/10">
            Create Employee
          </Link>
        </div>
      )}

      {/* Employee selector — auto-selected when only 1 employee, dropdown when 2+ */}
      {employees.length === 1 && (
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-4 flex items-center gap-3">
          <span className="text-sm font-medium text-zinc-300">Installing skills on:</span>
          <span className="text-sm font-semibold text-white">{employees[0].name}</span>
        </div>
      )}
      {employees.length > 1 && (
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <label htmlFor="mp-emp" className="text-sm font-medium text-zinc-300 shrink-0">Install skills on:</label>
          <select id="mp-emp" value={selectedEmployee} onChange={(e) => setSelectedEmployee(e.target.value)}
            className="flex-1 px-4 py-3 border border-zinc-700/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400/50 bg-zinc-800/80 text-white transition-all">
            <option value="">Choose an employee...</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
      )}

      {/* Category filters */}
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button key={cat} onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer capitalize active:scale-[0.97] ${
              selectedCategory === cat
                ? 'bg-white text-black shadow-md shadow-white/10'
                : 'bg-zinc-900/50 text-zinc-400 border border-zinc-800/80 hover:border-zinc-700 hover:text-zinc-200'
            }`}>
            {cat === 'all' ? '🔥' : categoryIcons[cat] || '📦'} {cat}
          </button>
        ))}
      </div>

      {/* Skills grid */}
      {filteredSkills.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800/80 border-dashed bg-zinc-900/30 p-12 text-center">
          <div className="h-14 w-14 rounded-2xl bg-zinc-800/80 flex items-center justify-center mx-auto mb-4">
            {skills.length === 0 ? <ShoppingBag className="h-7 w-7 text-zinc-500" /> : <Search className="h-7 w-7 text-zinc-500" />}
          </div>
          <p className="text-zinc-400 text-sm font-medium mb-1">
            {skills.length === 0 ? 'No skills available yet' : 'No skills found'}
          </p>
          <p className="text-zinc-600 text-xs">
            {skills.length === 0 ? 'New skills are added regularly — check back soon' : 'Try selecting a different category above'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredSkills.map((skill) => {
            const status = getSkillStatus(skill.id);
            const isInstalled = !!status;
            const isPending = status === 'pending_setup';
            const isError = status === 'error';

            return (
              <div key={skill.id} className={`group rounded-2xl border bg-zinc-900/50 p-5 flex flex-col transition-all duration-200 ${
                isInstalled ? 'border-amber-400/30' : 'border-zinc-800/80 hover:border-zinc-700'
              }`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="h-10 w-10 rounded-xl bg-zinc-800/80 flex items-center justify-center">
                    {skillIconMap[skill.slug] || <span className="text-xl">{skill.icon || categoryIcons[skill.category] || '🧩'}</span>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {isInstalled && !isPending && !isError && (
                      <span className="text-[10px] font-medium text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-md flex items-center gap-1">
                        <Check className="h-2.5 w-2.5" /> Installed
                      </span>
                    )}
                    {isPending && (
                      <span className="text-[10px] font-medium text-amber-400 bg-amber-500/10 px-2 py-1 rounded-md flex items-center gap-1">
                        <AlertTriangle className="h-2.5 w-2.5" /> Setup Required
                      </span>
                    )}
                    {isError && (
                      <span className="text-[10px] font-medium text-red-400 bg-red-400/10 px-2 py-1 rounded-md flex items-center gap-1">
                        <AlertCircle className="h-2.5 w-2.5" /> Error
                      </span>
                    )}
                    <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider bg-zinc-800/80 px-2 py-1 rounded-md">{skill.category}</span>
                  </div>
                </div>
                <h3 className="font-semibold text-[15px] text-white mb-1">{skill.name}</h3>
                <p className="text-xs text-zinc-500 flex-1 leading-relaxed">{skill.description}</p>
                {skill.credential_type === 'brave_api_key' && !isInstalled && (
                  <div className="flex items-center gap-1.5 mt-2 px-2.5 py-1.5 rounded-lg bg-amber-500/[0.06] border border-amber-500/15 w-fit">
                    <Key className="h-3 w-3 text-amber-400 shrink-0" />
                    <span className="text-[10px] font-medium text-amber-400/90">Requires Brave API Key</span>
                  </div>
                )}
                {skill.credential_type === 'twitter_api_key' && !isInstalled && (
                  <div className="flex items-center gap-1.5 mt-2 px-2.5 py-1.5 rounded-lg bg-zinc-800/60 border border-zinc-700/40 w-fit">
                    <XIcon className="h-3 w-3 text-white shrink-0" />
                    <span className="text-[10px] font-medium text-zinc-300">Requires X API Key</span>
                  </div>
                )}
                {skill.credential_type === 'spotify_api_key' && !isInstalled && (
                  <div className="flex items-center gap-1.5 mt-2 px-2.5 py-1.5 rounded-lg bg-[#1DB954]/[0.08] border border-[#1DB954]/20 w-fit">
                    <SpotifyIcon className="h-3 w-3 text-[#1DB954] shrink-0" />
                    <span className="text-[10px] font-medium text-[#1DB954]/90">Requires Spotify API Key</span>
                  </div>
                )}
                <div className="mt-4 pt-4 border-t border-zinc-800/60">
                  {!isPremium ? (
                    <Link
                      to="/billing"
                      className="flex items-center justify-center gap-2 w-full text-sm bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black py-2.5 rounded-xl transition-all duration-200 cursor-pointer font-semibold shadow-md shadow-amber-500/20 active:scale-[0.97]"
                    >
                      <Crown className="h-3.5 w-3.5" />
                      Upgrade to Install
                    </Link>
                  ) : !isInstalled ? (
                    <button
                      onClick={() => handleInstall(skill)}
                      disabled={installingSkill === skill.id || !selectedEmployee}
                      className="flex items-center justify-center gap-2 w-full text-sm bg-white hover:bg-zinc-200 text-black py-2.5 rounded-xl transition-all duration-200 disabled:opacity-40 cursor-pointer font-semibold shadow-md shadow-white/10 active:scale-[0.97]"
                    >
                      {installingSkill === skill.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                      Install
                    </button>
                  ) : isPending ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSetupCredentials(skill)}
                        className="flex items-center justify-center gap-2 flex-1 text-sm bg-white hover:bg-zinc-200 text-black py-2.5 rounded-xl transition-all duration-200 cursor-pointer font-medium shadow-md shadow-white/10"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Connect Account
                      </button>
                      <button
                        onClick={() => handleUninstall(skill.id)}
                        disabled={uninstallingSkill === skill.id}
                        className="flex items-center justify-center px-3 text-sm bg-zinc-800 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 py-2.5 rounded-xl transition-all duration-200 cursor-pointer"
                      >
                        {uninstallingSkill === skill.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      {skill.credential_type === 'mcp_server_url' ? (
                        <Link
                          to="/integrations"
                          className="flex items-center justify-center gap-2 flex-1 text-sm bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 py-2.5 rounded-xl transition-all duration-200 cursor-pointer font-medium border border-emerald-500/20"
                        >
                          <Plug className="h-3.5 w-3.5" /> Manage in Integrations
                        </Link>
                      ) : (
                        <div className="flex items-center justify-center gap-2 flex-1 text-sm text-emerald-400 py-2.5 rounded-xl font-medium">
                          <Check className="h-3.5 w-3.5" /> Active
                        </div>
                      )}
                      <button
                        onClick={() => handleUninstall(skill.id)}
                        disabled={uninstallingSkill === skill.id}
                        className="flex items-center justify-center px-3 text-sm bg-zinc-800 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 py-2.5 rounded-xl transition-all duration-200 cursor-pointer"
                      >
                        {uninstallingSkill === skill.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {/* Brave API Key Modal */}
      {braveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <Globe className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Set Up Brave Search</h3>
                  <p className="text-xs text-zinc-500">Required for Web Browser, Weather & News skills</p>
                </div>
              </div>
              <button onClick={() => setBraveModalOpen(false)} className="p-2 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer">
                <X className="h-4 w-4 text-zinc-400" />
              </button>
            </div>

            {/* Instructions */}
            <div className="p-5 space-y-4">
              <div className="rounded-xl bg-zinc-800/50 border border-zinc-700/50 p-4 space-y-3">
                <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Key className="h-3.5 w-3.5 text-amber-400" />
                  How to get your free API key
                </h4>
                <ol className="text-xs text-zinc-400 space-y-2 list-decimal list-inside">
                  <li>Go to <a href="https://brave.com/search/api/" target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:text-amber-300 underline">brave.com/search/api</a></li>
                  <li>Click <strong className="text-zinc-300">"Get Started"</strong> and create a free account</li>
                  <li>Choose the <strong className="text-zinc-300">"Free"</strong> plan — gives you <strong className="text-amber-400">2,000 searches/month</strong> at no cost</li>
                  <li>Go to <strong className="text-zinc-300">Dashboard → API Keys</strong></li>
                  <li>Copy your API key and paste it below</li>
                </ol>
              </div>

              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/[0.06] border border-emerald-500/20">
                <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <p className="text-xs text-emerald-400">Free tier includes 2,000 queries/month — no credit card needed</p>
              </div>

              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/[0.06] border border-blue-500/20">
                <Globe className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                <p className="text-xs text-blue-400">One key powers all search skills — Weather, News & Web Browser</p>
              </div>

              {/* API Key Input */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Brave Search API Key</label>
                <input
                  type="password"
                  value={braveApiKey}
                  onChange={(e) => setBraveApiKey(e.target.value)}
                  placeholder="BSA..."
                  className="w-full px-4 py-3 border border-zinc-700/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400/50 bg-zinc-800/80 text-white placeholder-zinc-600 transition-all"
                  onKeyDown={(e) => e.key === 'Enter' && handleBraveSubmit()}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-5 border-t border-zinc-800">
              <button
                onClick={() => window.open('https://brave.com/search/api/', '_blank')}
                className="flex items-center gap-2 text-xs text-zinc-400 hover:text-amber-400 transition-colors cursor-pointer"
              >
                <ExternalLink className="h-3 w-3" />
                Open Brave Search API
              </button>
              <button
                onClick={handleBraveSubmit}
                disabled={!braveApiKey.trim() || braveSubmitting}
                className="flex items-center gap-2 px-5 py-2.5 bg-white hover:bg-zinc-200 text-black rounded-xl text-sm font-semibold transition-all duration-200 disabled:opacity-40 cursor-pointer shadow-md shadow-white/10 active:scale-[0.97] btn-glow"
              >
                {braveSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
                Activate Web Search
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Twitter API Key Modal */}
      {twitterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-zinc-800 flex items-center justify-center">
                  <XIcon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Set Up X (Twitter)</h3>
                  <p className="text-xs text-zinc-500">Required for searching tweets, reading timelines & profiles</p>
                </div>
              </div>
              <button onClick={() => setTwitterModalOpen(false)} className="p-2 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer">
                <X className="h-4 w-4 text-zinc-400" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="rounded-xl bg-zinc-800/50 border border-zinc-700/50 p-4 space-y-3">
                <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Key className="h-3.5 w-3.5 text-sky-400" />
                  How to get your Bearer Token
                </h4>
                <ol className="text-xs text-zinc-400 space-y-2 list-decimal list-inside">
                  <li>Go to <a href="https://developer.x.com/en/portal/dashboard" target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:text-sky-300 underline">developer.x.com</a></li>
                  <li>Sign up for a <strong className="text-zinc-300">Free developer account</strong></li>
                  <li>Create a new <strong className="text-zinc-300">Project & App</strong></li>
                  <li>Go to <strong className="text-zinc-300">Keys and Tokens → Bearer Token</strong></li>
                  <li>Copy and paste below</li>
                </ol>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/[0.06] border border-amber-500/20">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                <p className="text-xs text-amber-400">Free tier: search & read only. Posting requires Basic tier ($100/mo from X).</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Twitter Bearer Token</label>
                <input
                  type="password"
                  value={twitterToken}
                  onChange={(e) => setTwitterToken(e.target.value)}
                  placeholder="AAAA..."
                  className="w-full px-4 py-3 border border-zinc-700/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400/50 bg-zinc-800/80 text-white placeholder-zinc-600 transition-all"
                  onKeyDown={(e) => e.key === 'Enter' && twitterToken.trim() && handleTwitterSubmit()}
                />
              </div>
            </div>
            <div className="flex items-center justify-between p-5 border-t border-zinc-800">
              <button
                onClick={() => window.open('https://developer.x.com/en/portal/dashboard', '_blank')}
                className="flex items-center gap-2 text-xs text-zinc-400 hover:text-sky-400 transition-colors cursor-pointer"
              >
                <ExternalLink className="h-3 w-3" />
                Open X Developer Portal
              </button>
              <button
                onClick={handleTwitterSubmit}
                disabled={!twitterToken.trim() || twitterSubmitting}
                className="flex items-center gap-2 px-5 py-2.5 bg-white hover:bg-zinc-200 text-black rounded-xl text-sm font-semibold transition-all duration-200 disabled:opacity-40 cursor-pointer shadow-md shadow-white/10 active:scale-[0.97] btn-glow"
              >
                {twitterSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
                Activate Twitter
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Spotify API Key Modal */}
      {spotifyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-[#1DB954]/10 flex items-center justify-center">
                  <SpotifyIcon className="h-5 w-5 text-[#1DB954]" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Set Up Spotify</h3>
                  <p className="text-xs text-zinc-500">Required for searching music, artists & playlists</p>
                </div>
              </div>
              <button onClick={() => setSpotifyModalOpen(false)} className="p-2 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer">
                <X className="h-4 w-4 text-zinc-400" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="rounded-xl bg-zinc-800/50 border border-zinc-700/50 p-4 space-y-3">
                <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Key className="h-3.5 w-3.5 text-green-400" />
                  How to get your Spotify API credentials
                </h4>
                <ol className="text-xs text-zinc-400 space-y-2 list-decimal list-inside">
                  <li>Go to <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-green-400 hover:text-green-300 underline">developer.spotify.com</a></li>
                  <li>Log in and click <strong className="text-zinc-300">"Create App"</strong></li>
                  <li>Set any name & description, set Redirect URI to <strong className="text-zinc-300">http://localhost</strong></li>
                  <li>Open your app → <strong className="text-zinc-300">Settings</strong></li>
                  <li>Copy <strong className="text-zinc-300">Client ID</strong> and <strong className="text-zinc-300">Client Secret</strong></li>
                </ol>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/[0.06] border border-emerald-500/20">
                <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <p className="text-xs text-emerald-400">Free Spotify developer account — no payment required</p>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">Client ID</label>
                  <input
                    type="text"
                    value={spotifyClientId}
                    onChange={(e) => setSpotifyClientId(e.target.value)}
                    placeholder="e.g. a1b2c3d4e5f6..."
                    className="w-full px-4 py-3 border border-zinc-700/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400/50 bg-zinc-800/80 text-white placeholder-zinc-600 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">Client Secret</label>
                  <input
                    type="password"
                    value={spotifyClientSecret}
                    onChange={(e) => setSpotifyClientSecret(e.target.value)}
                    placeholder="e.g. x9y8z7w6..."
                    className="w-full px-4 py-3 border border-zinc-700/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400/50 bg-zinc-800/80 text-white placeholder-zinc-600 transition-all"
                    onKeyDown={(e) => e.key === 'Enter' && spotifyClientId.trim() && spotifyClientSecret.trim() && handleSpotifySubmit()}
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between p-5 border-t border-zinc-800">
              <button
                onClick={() => window.open('https://developer.spotify.com/dashboard', '_blank')}
                className="flex items-center gap-2 text-xs text-zinc-400 hover:text-green-400 transition-colors cursor-pointer"
              >
                <ExternalLink className="h-3 w-3" />
                Open Spotify Dashboard
              </button>
              <button
                onClick={handleSpotifySubmit}
                disabled={!spotifyClientId.trim() || !spotifyClientSecret.trim() || spotifySubmitting}
                className="flex items-center gap-2 px-5 py-2.5 bg-white hover:bg-zinc-200 text-black rounded-xl text-sm font-semibold transition-all duration-200 disabled:opacity-40 cursor-pointer shadow-md shadow-white/10 active:scale-[0.97] btn-glow"
              >
                {spotifySubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
                Activate Spotify
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
