import { Link, Navigate } from 'react-router-dom';
import { Bot, MessageSquare, Shield, BarChart3, Key, ChevronDown, Sparkles, Zap, ArrowRight, Check, X, Clock, Server, Terminal, MousePointerClick, Layers, GitBranch } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';

/* ── Data ── */
const features = [
  { icon: Zap, title: 'Live in 60 Seconds', desc: 'Create and deploy your AI employee in under a minute. No setup, no DevOps.' },
  { icon: MessageSquare, title: 'Telegram & WhatsApp', desc: 'Paste a bot token and your AI is live on messaging instantly.' },
  { icon: Sparkles, title: 'Skill Marketplace', desc: 'Add coding, web browsing, email, and more skills to supercharge your agents.' },
  { icon: Key, title: 'Your API Key, Your Costs', desc: 'Bring your own OpenAI or Anthropic key. Pay the AI provider directly.' },
  { icon: Shield, title: 'Encrypted & Isolated', desc: 'Each agent runs in its own secure environment. AES-256 encrypted at rest.' },
  { icon: BarChart3, title: 'Real-time Logs', desc: 'See every message, every action, every connection — all in real time.' },
];

const plans = [
  { name: 'Free', price: '0', employees: 'Explore the platform', features: ['Dashboard access', 'Browse marketplace', 'No AI employees'], popular: false },
  { name: 'Pro', price: '25', employees: '2 AI employees', features: ['Dedicated container resources', 'Telegram + WhatsApp channels', 'All marketplace skills', 'Priority support'], popular: true },
];

const faqs = [
  { q: 'What is LikelyClaw?', a: 'LikelyClaw is a managed AI employee platform. Our agents can browse the web, send messages, write code, and automate tasks. We handle all the infrastructure — you just create, connect, and go.' },
  { q: 'What AI models do you support?', a: 'OpenAI (GPT-4o, GPT-4), Anthropic (Claude), and Google AI. You bring your own API key.' },
  { q: 'Do I need my own API key?', a: 'Yes. You provide your own OpenAI, Anthropic, or Google API key. This means you pay the AI provider directly and have full control over costs.' },
  { q: 'Is my data secure?', a: 'Yes. Each AI employee runs in a fully isolated, secure environment. All API keys and tokens are AES-256 encrypted. We never see your credentials in plain text.' },
  { q: 'Can I cancel anytime?', a: 'Yes. No lock-in contracts. Cancel your subscription at any time and it stays active until the end of your billing period.' },
];

const stats = [
  { value: '60s', label: 'Agent deploy time' },
  { value: '99.9%', label: 'Platform uptime' },
  { value: '256-bit', label: 'AES encryption' },
  { value: '24/7', label: 'Always running' },
];

/* ── Scroll reveal hook ── */
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { el.classList.add('visible'); obs.unobserve(el); } },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

function Reveal({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useReveal();
  return <div ref={ref} className={`reveal ${className}`}>{children}</div>;
}

/* ── Floating Orb ── */
function Orb({ className }: { className: string }) {
  return <div className={`absolute rounded-full pointer-events-none ${className}`} />;
}

export default function Landing() {
  const { user, loading: authLoading } = useAuth();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!authLoading && user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-[#fffdfa] text-[#0a0a0a] overflow-hidden">
      {/* ═══════════ Floating Nav ═══════════ */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled ? 'bg-white/90 backdrop-blur-xl shadow-sm border-b border-black/[0.06]' : 'bg-transparent'
      }`}>
        <div className="flex items-center justify-between max-w-6xl mx-auto px-6 py-4">
          <Link to="/" className="flex items-center gap-2.5 group">
            <img src="/logo.svg?v=3" alt="LikelyClaw" className="h-8 w-auto" />
            <span className="text-lg font-bold tracking-tight text-[#0a0a0a]">LikelyClaw</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm text-gray-500 hover:text-[#0a0a0a] transition-colors duration-300">Log in</Link>
            <Link to="/signup" className="bg-[#0a0a0a] hover:bg-[#222] text-white px-5 py-2 rounded-full text-sm font-semibold transition-all duration-300 shadow-sm btn-glow">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* ═══════════ Hero ═══════════ */}
      <section className="relative min-h-screen flex items-center justify-center pt-20">
        {/* Ambient orbs on light bg */}
        <Orb className="w-[600px] h-[600px] bg-orange-400/[0.08] blur-[140px] top-[0%] left-[-10%] animate-pulse-glow" />
        <Orb className="w-[400px] h-[400px] bg-orange-300/[0.06] blur-[100px] bottom-[5%] right-[-5%] animate-pulse-glow delay-1000" />

        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
          {/* Badge */}
          <div className="animate-fade-in-up inline-flex items-center gap-2 bg-orange-50 border border-orange-200/60 rounded-full px-5 py-2 mb-6">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500" />
            </span>
            <span className="text-sm text-orange-700 font-medium">AI employees that work while you sleep</span>
          </div>

          {/* Main heading */}
          <h1 className="animate-fade-in-up delay-100 text-5xl md:text-6xl lg:text-[5rem] font-extrabold leading-[1.1] tracking-tight mb-6 text-[#0a0a0a]" style={{ opacity: 0 }}>
            Your AI Employees,<br />
            <span className="text-gradient">Live in 60 Seconds.</span>
          </h1>

          <p className="animate-fade-in-up delay-300 text-lg md:text-xl text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed" style={{ opacity: 0 }}>
            Deploy OpenClaw-powered AI agents on Telegram and WhatsApp instantly.
            No servers. No DevOps. No 60-minute setup guides.
          </p>

          {/* CTA buttons */}
          <div className="animate-fade-in-up delay-500 flex flex-col sm:flex-row items-center justify-center gap-4" style={{ opacity: 0 }}>
            <Link to="/signup"
              className="group bg-[#0a0a0a] hover:bg-[#222] text-white px-8 py-3.5 rounded-full font-semibold text-[15px] transition-all duration-300 shadow-md hover:scale-[1.02] btn-glow flex items-center gap-2">
              Start Building Free
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a href="#compare"
              className="group border border-black/10 bg-white hover:bg-gray-50 px-8 py-3.5 rounded-full font-medium text-[15px] text-gray-600 hover:text-[#0a0a0a] transition-all duration-300 flex items-center gap-2">
              See the Difference
              <ChevronDown className="h-4 w-4 group-hover:translate-y-0.5 transition-transform" />
            </a>
          </div>

          {/* Stats bar */}
          <div className="animate-fade-in-up delay-700 mt-16 flex items-center justify-center gap-8 md:gap-16" style={{ opacity: 0 }}>
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-2xl md:text-3xl font-black text-gradient font-mono">{s.value}</div>
                <div className="text-xs text-gray-400 mt-1 font-medium">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#fffdfa] to-transparent" />
      </section>

      {/* ═══════════ OpenClaw vs LikelyClaw COMPARISON ═══════════ */}
      <section id="compare" className="relative py-28">
        <Orb className="w-[500px] h-[500px] bg-orange-400/[0.06] blur-[120px] top-[10%] right-[-5%] animate-pulse-glow" />

        <Reveal>
          <div className="max-w-5xl mx-auto px-6">
            <div className="text-center mb-14">
              <span className="text-xs uppercase tracking-[0.2em] text-orange-500 font-bold">Why LikelyClaw</span>
              <h2 className="text-4xl md:text-5xl font-extrabold mt-3 mb-4 text-[#0a0a0a]">OpenClaw takes hours.<br />We take 60 seconds.</h2>
              <p className="text-gray-400 max-w-xl mx-auto">OpenClaw is an amazing open-source AI agent framework. Self-hosting it takes real technical work. LikelyClaw removes all of that complexity.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Self-hosting OpenClaw */}
              <div className="rounded-2xl border border-black/[0.07] bg-white p-7 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-9 w-9 rounded-xl bg-gray-100 flex items-center justify-center">
                    <Terminal className="h-4 w-4 text-gray-500" />
                  </div>
                  <div>
                    <div className="font-bold text-[#0a0a0a] text-[15px]">Self-hosting OpenClaw</div>
                    <div className="text-xs text-gray-400 mt-0.5">DIY approach</div>
                  </div>
                  <div className="ml-auto font-mono text-sm font-bold text-gray-400">~60 min</div>
                </div>
                <ul className="space-y-3">
                  {[
                    { icon: Server, text: 'Provision a VPS or cloud server' },
                    { icon: Terminal, text: 'Install Docker, Node.js, dependencies' },
                    { icon: GitBranch, text: 'Clone & configure OpenClaw repo' },
                    { icon: Key, text: 'Manually wire API keys & config files' },
                    { icon: Layers, text: 'Set up Nginx, SSL, reverse proxy' },
                    { icon: MessageSquare, text: 'Configure Telegram/WhatsApp channels' },
                    { icon: Shield, text: 'Handle security, backups, updates yourself' },
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-gray-500">
                      <div className="h-5 w-5 rounded-md bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
                        <item.icon className="h-3 w-3 text-gray-400" />
                      </div>
                      {item.text}
                    </li>
                  ))}
                </ul>
                <div className="mt-6 pt-5 border-t border-black/[0.06] flex items-center gap-2 text-sm text-gray-400">
                  <Clock className="h-4 w-4 shrink-0" />
                  Requires DevOps knowledge. Ongoing maintenance burden.
                </div>
              </div>

              {/* LikelyClaw */}
              <div className="rounded-2xl border border-orange-200/60 bg-white p-7 shadow-sm glow-orange relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-orange-400/[0.06] blur-[60px] rounded-full -translate-y-1/2 translate-x-1/4" />
                <div className="relative">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="h-9 w-9 rounded-xl bg-orange-50 flex items-center justify-center">
                      <MousePointerClick className="h-4 w-4 text-orange-500" />
                    </div>
                    <div>
                      <div className="font-bold text-[#0a0a0a] text-[15px]">LikelyClaw</div>
                      <div className="text-xs text-orange-400 mt-0.5 font-medium">Managed platform</div>
                    </div>
                    <div className="ml-auto font-mono text-sm font-black text-orange-500">60 sec</div>
                  </div>
                  <ul className="space-y-3">
                    {[
                      { text: 'Sign up — 10 seconds', done: true },
                      { text: 'Name your AI employee — 10 seconds', done: true },
                      { text: 'Paste your API key — 10 seconds', done: true },
                      { text: 'Connect Telegram bot token — 10 seconds', done: true },
                      { text: 'Your AI is live and responding — done', done: true },
                    ].map((item, i) => (
                      <li key={i} className="flex items-center gap-3 text-sm text-[#0a0a0a] font-medium">
                        <div className="h-5 w-5 rounded-full bg-orange-500 flex items-center justify-center shrink-0">
                          <Check className="h-3 w-3 text-white" />
                        </div>
                        {item.text}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-6 pt-5 border-t border-orange-100 flex items-center gap-2 text-sm text-orange-600 font-medium">
                    <Zap className="h-4 w-4 shrink-0" />
                    Zero server knowledge required. We handle everything.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ═══════════ Competitor Price Comparison ═══════════ */}
      <section className="relative py-20 bg-[#faf9f6]">
        <Reveal>
          <div className="max-w-4xl mx-auto px-6">
            <div className="text-center mb-12">
              <span className="text-xs uppercase tracking-[0.2em] text-orange-500 font-bold">Pricing Comparison</span>
              <h2 className="text-3xl md:text-4xl font-extrabold mt-3 mb-3 text-[#0a0a0a]">The most affordable way<br />to run OpenClaw agents</h2>
              <p className="text-gray-400 text-sm max-w-md mx-auto">Compared to other managed OpenClaw platforms, LikelyClaw costs significantly less.</p>
            </div>

            <div className="rounded-2xl border border-black/[0.07] bg-white shadow-sm overflow-hidden">
              {/* Table header */}
              <div className="grid grid-cols-4 bg-gray-50 border-b border-black/[0.06] px-6 py-3 text-xs font-bold uppercase tracking-wider text-gray-400">
                <div className="col-span-1">Platform</div>
                <div className="text-center">Deploy time</div>
                <div className="text-center">Price/mo</div>
                <div className="text-center">Managed</div>
              </div>

              {[
                { name: 'Self-hosted OpenClaw', time: '~60 min', price: 'Server cost + your time', managed: false, highlight: false },
                { name: 'Other OpenClaw wrappers', time: '~10 min', price: '$49–$199/mo', managed: true, highlight: false },
                { name: 'LikelyClaw', time: '60 sec', price: '$25/mo', managed: true, highlight: true },
              ].map((row, i) => (
                <div key={i} className={`grid grid-cols-4 px-6 py-4 border-b last:border-0 border-black/[0.05] items-center ${row.highlight ? 'bg-orange-50/50' : ''}`}>
                  <div className="col-span-1 flex items-center gap-2">
                    {row.highlight && <span className="h-2 w-2 rounded-full bg-orange-500" />}
                    <span className={`text-sm font-semibold ${row.highlight ? 'text-orange-600' : 'text-gray-600'}`}>{row.name}</span>
                  </div>
                  <div className={`text-center font-mono text-sm font-bold ${row.highlight ? 'text-orange-500' : 'text-gray-400'}`}>{row.time}</div>
                  <div className={`text-center text-sm font-bold ${row.highlight ? 'text-orange-600' : 'text-gray-400'}`}>{row.price}</div>
                  <div className="text-center">
                    {row.managed
                      ? <Check className="h-4 w-4 text-emerald-500 mx-auto" />
                      : <X className="h-4 w-4 text-gray-300 mx-auto" />
                    }
                  </div>
                </div>
              ))}
            </div>

            <p className="text-center text-xs text-gray-400 mt-4">Prices as of early 2025. "Other wrappers" refers to generic managed OpenClaw/agent hosting services.</p>
          </div>
        </Reveal>
      </section>

      {/* ═══════════ How It Works ═══════════ */}
      <section id="how-it-works" className="relative py-28">
        <Reveal>
          <div className="max-w-5xl mx-auto px-6">
            <div className="text-center mb-14">
              <span className="text-xs uppercase tracking-[0.2em] text-orange-500 font-bold">Simple Setup</span>
              <h2 className="text-4xl md:text-5xl font-extrabold mt-3 mb-4 text-[#0a0a0a]">Three steps to your AI employee</h2>
              <p className="text-gray-400 max-w-lg mx-auto">From signup to live AI employee in under a minute. No technical knowledge required.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {[
                { step: '01', title: 'Create Employee', desc: 'Give it a name, role, and personality. Your AI employee is provisioned in seconds on our Kubernetes cluster.', icon: Bot },
                { step: '02', title: 'Connect a Channel', desc: 'Paste a Telegram bot token or connect WhatsApp. One click — your AI employee is live on messaging.', icon: MessageSquare },
                { step: '03', title: 'AI Works 24/7', desc: 'Your AI employee responds, remembers context, and runs tasks around the clock — autonomously.', icon: Zap },
              ].map((item, i) => (
                <div key={item.step}
                  className="group relative bg-white rounded-2xl p-8 border border-black/[0.07] shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 card-hover"
                  style={{ animationDelay: `${i * 150}ms` }}>
                  <div className="text-[4rem] font-black text-black/[0.04] absolute top-4 right-6 leading-none select-none font-mono">
                    {item.step}
                  </div>
                  <div className="relative">
                    <div className="h-11 w-11 rounded-xl bg-orange-50 flex items-center justify-center mb-5 group-hover:bg-orange-100 transition-colors duration-300">
                      <item.icon className="h-5 w-5 text-orange-500" />
                    </div>
                    <h3 className="text-[15px] font-bold mb-2 text-[#0a0a0a]">{item.title}</h3>
                    <p className="text-sm text-gray-400 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      {/* ═══════════ Features ═══════════ */}
      <section className="relative py-20 bg-[#faf9f6]">
        <Reveal>
          <div className="max-w-5xl mx-auto px-6">
            <div className="text-center mb-14">
              <span className="text-xs uppercase tracking-[0.2em] text-orange-500 font-bold">Capabilities</span>
              <h2 className="text-4xl md:text-5xl font-extrabold mt-3 mb-4 text-[#0a0a0a]">Everything included</h2>
              <p className="text-gray-400 max-w-lg mx-auto">Enterprise-grade AI agent infrastructure, fully managed for you</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {features.map((f, i) => (
                <div key={f.title}
                  className="group bg-white rounded-2xl p-6 border border-black/[0.07] shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 card-hover"
                  style={{ animationDelay: `${i * 100}ms` }}>
                  <div className="h-10 w-10 rounded-xl bg-orange-50 flex items-center justify-center mb-4 group-hover:bg-orange-100 transition-colors duration-300">
                    <f.icon className="h-5 w-5 text-orange-500" />
                  </div>
                  <h3 className="font-bold text-[#0a0a0a] mb-1.5 text-[15px]">{f.title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      {/* ═══════════ Pricing ═══════════ */}
      <section className="relative py-28">
        <Orb className="w-[500px] h-[500px] bg-orange-400/[0.06] blur-[120px] bottom-[0%] left-[20%] animate-pulse-glow" />

        <Reveal>
          <div className="max-w-5xl mx-auto px-6">
            <div className="text-center mb-14">
              <span className="text-xs uppercase tracking-[0.2em] text-orange-500 font-bold">Pricing</span>
              <h2 className="text-4xl md:text-5xl font-extrabold mt-3 mb-4 text-[#0a0a0a]">Simple, transparent pricing</h2>
              <p className="text-gray-400 max-w-lg mx-auto">Every plan includes managed hosting, dashboard, and all integrations. No hidden fees.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start max-w-2xl mx-auto">
              {plans.map((plan) => (
                <div key={plan.name}
                  className={`relative group bg-white rounded-2xl p-7 border transition-all duration-300 hover:-translate-y-1 shadow-sm ${
                    plan.popular
                      ? 'border-orange-300/60 glow-orange shadow-md'
                      : 'border-black/[0.07]'
                  }`}>
                  {plan.popular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                      <span className="bg-gradient-to-r from-orange-500 to-orange-400 text-white text-xs px-4 py-1 rounded-full font-bold shadow-sm shadow-orange-300/30">
                        Most Popular
                      </span>
                    </div>
                  )}
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-[#0a0a0a]">{plan.name}</h3>
                    <p className="text-xs text-gray-400 mt-1">{plan.employees}</p>
                    <div className="mt-4 flex items-baseline gap-1">
                      <span className="text-4xl font-extrabold text-[#0a0a0a]">${plan.price}</span>
                      <span className="text-gray-400 text-sm">/month</span>
                    </div>
                  </div>
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2.5 text-sm text-gray-500">
                        <Check className="h-4 w-4 text-orange-500 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link to={`/signup?plan=${plan.name.toLowerCase()}`}
                    className={`block text-center py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${
                      plan.popular
                        ? 'bg-[#0a0a0a] hover:bg-[#222] text-white shadow-sm hover:scale-[1.02]'
                        : 'border border-black/[0.1] bg-transparent text-gray-500 hover:text-[#0a0a0a] hover:bg-gray-50'
                    }`}>
                    Get Started
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      {/* ═══════════ FAQ ═══════════ */}
      <section className="relative py-20 bg-[#faf9f6]">
        <Reveal>
          <div className="max-w-2xl mx-auto px-6">
            <div className="text-center mb-14">
              <span className="text-xs uppercase tracking-[0.2em] text-orange-500 font-bold">FAQ</span>
              <h2 className="text-4xl md:text-5xl font-extrabold mt-3 text-[#0a0a0a]">Got questions?</h2>
            </div>

            <div className="space-y-2">
              {faqs.map((faq, i) => (
                <div key={i} className="bg-white rounded-xl border border-black/[0.07] shadow-sm overflow-hidden transition-all duration-300">
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="flex items-center justify-between w-full p-5 text-left text-[15px] font-semibold text-[#0a0a0a] cursor-pointer"
                  >
                    {faq.q}
                    <ChevronDown className={`h-4 w-4 text-gray-400 shrink-0 ml-4 transition-transform duration-300 ${openFaq === i ? 'rotate-180' : ''}`} />
                  </button>
                  <div className={`overflow-hidden transition-all duration-300 ${openFaq === i ? 'max-h-48 pb-5' : 'max-h-0'}`}>
                    <div className="px-5 text-sm text-gray-400 leading-relaxed">{faq.a}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      {/* ═══════════ Final CTA ═══════════ */}
      <section className="relative py-28">
        <Orb className="w-[600px] h-[600px] bg-orange-400/[0.07] blur-[140px] top-[20%] left-[20%] animate-pulse-glow" />

        <Reveal>
          <div className="max-w-3xl mx-auto px-6 text-center">
            <div className="inline-flex items-center gap-2 bg-orange-50 border border-orange-200/60 rounded-full px-4 py-1.5 mb-6 text-xs font-semibold text-orange-600 uppercase tracking-wider">
              <Zap className="h-3 w-3" /> No DevOps required
            </div>
            <h2 className="text-4xl md:text-5xl font-extrabold mb-5 text-[#0a0a0a]">
              Deploy your AI workforce<br /><span className="text-gradient">in the next 60 seconds.</span>
            </h2>
            <p className="text-gray-400 text-lg mb-10 max-w-xl mx-auto">
              Join LikelyClaw and have your first AI employee live on Telegram — right now.
            </p>
            <Link to="/signup"
              className="group inline-flex items-center gap-2 bg-[#0a0a0a] hover:bg-[#222] text-white px-10 py-4 rounded-full font-bold text-base transition-all duration-300 shadow-md hover:scale-[1.02] btn-glow">
              Get Started — It's Free
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <p className="text-xs text-gray-400 mt-4">No credit card required · Cancel anytime</p>
          </div>
        </Reveal>
      </section>

      {/* ═══════════ Footer ═══════════ */}
      <footer className="border-t border-black/[0.06] bg-white py-10">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <img src="/logo.svg?v=3" alt="LikelyClaw" className="h-7 w-auto" />
              <span className="font-bold text-[#0a0a0a]">LikelyClaw</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-gray-400">
              <Link to="/privacy" className="hover:text-[#0a0a0a] transition-colors duration-300">Privacy Policy</Link>
              <Link to="/terms" className="hover:text-[#0a0a0a] transition-colors duration-300">Terms of Service</Link>
              <a href="mailto:support@likelyclaw.com" className="hover:text-[#0a0a0a] transition-colors duration-300">Contact</a>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t border-black/[0.04] text-center">
            <p className="text-xs text-gray-400">&copy; {new Date().getFullYear()} LikelyClaw. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
