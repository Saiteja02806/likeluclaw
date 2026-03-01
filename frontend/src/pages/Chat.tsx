import { useEffect, useRef, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useChatStore, type ChatMsg, type AgentPhase } from '@/stores/chatStore';
import { Loader2, Trash2, Sparkles, ArrowUp, Mail, Calendar, FileSpreadsheet, HardDrive, Copy, Check, Plus } from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/* Minimal shimmer bar for thinking state */
function ShimmerBar({ color = 'amber' }: { color?: 'amber' | 'blue' }) {
  const gradient = color === 'blue'
    ? 'from-transparent via-blue-400/40 to-transparent'
    : 'from-transparent via-amber-400/40 to-transparent';
  return (
    <div className="h-[2px] w-32 rounded-full bg-zinc-800/60 overflow-hidden">
      <div className={`h-full w-1/3 bg-gradient-to-r ${gradient} rounded-full`} style={{ animation: 'shimmer-slide 1.5s ease-in-out infinite' }} />
    </div>
  );
}

const SUGGESTIONS = [
  { icon: Mail, label: 'Check my emails', prompt: 'Check my inbox for recent emails', color: 'from-violet-500/20 to-violet-600/10 border-violet-500/20' },
  { icon: Calendar, label: 'Upcoming events', prompt: 'Show my upcoming calendar events', color: 'from-purple-500/20 to-purple-600/10 border-purple-500/20' },
  { icon: FileSpreadsheet, label: 'My spreadsheets', prompt: 'List my recent spreadsheets', color: 'from-indigo-500/20 to-indigo-600/10 border-indigo-500/20' },
  { icon: HardDrive, label: 'Search files', prompt: 'Search my drive for recent files', color: 'from-fuchsia-500/20 to-fuchsia-600/10 border-fuchsia-500/20' },
];

export default function Chat() {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Global store — survives navigation
  const messages = useChatStore(s => s.messages);
  const sending = useChatStore(s => s.sending);
  const agentPhase = useChatStore(s => s.agentPhase);
  const agentDetail = useChatStore(s => s.agentDetail);
  const streamingText = useChatStore(s => s.streamingText);
  const error = useChatStore(s => s.error);
  const elapsed = useChatStore(s => s.elapsed);
  const historyLoaded = useChatStore(s => s.historyLoaded);
  const storeSendMessage = useChatStore(s => s.sendMessage);
  const storeClearHistory = useChatStore(s => s.clearHistory);
  const storeLoadHistory = useChatStore(s => s.loadHistory);

  const { data: status } = useQuery({
    queryKey: ['chat-status'],
    queryFn: () => api.getChatStatus().catch(() => ({ available: false, connectedApps: [] })),
    refetchInterval: 30000,
  });

  const isAvailable = status?.available ?? false;
  const connectedApps: string[] = status?.connectedApps || [];

  // Load history from DB on first mount (store handles dedup)
  useEffect(() => {
    storeLoadHistory();
  }, [storeLoadHistory]);

  // Auto-scroll
  useEffect(() => {
    if (scrollAreaRef.current) {
      const el = scrollAreaRef.current;
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, sending, agentPhase, streamingText]);

  // Auto-focus input when idle
  useEffect(() => {
    if (!sending && isAvailable) inputRef.current?.focus();
  }, [sending, isAvailable]);

  // NOTE: No useEffect cleanup for EventSource — the store owns it and keeps it alive across navigation

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
    storeSendMessage(text, isAvailable);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClearHistory = async () => {
    if (!confirm('Clear all chat history?')) return;
    try {
      await storeClearHistory();
      toast.success('Chat history cleared');
    } catch {
      toast.error('Failed to clear history');
    }
  };

  const handleSuggestion = (prompt: string) => {
    setInput('');
    storeSendMessage(prompt, isAvailable);
  };

  const handleNewChat = async () => {
    try {
      await storeClearHistory();
      toast.success('New chat started');
    } catch {
      toast.error('Failed to start new chat');
    }
  };

  const loadingHistory = !historyLoaded;
  const showEmptyState = !loadingHistory && messages.length === 0 && !sending;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-zinc-800/40 shrink-0 bg-gradient-to-r from-[#0A0A0A] via-[#0d0d0d] to-[#0A0A0A] backdrop-blur-xl z-10">
        <div className="flex items-center gap-2.5">
          <div className={`h-2 w-2 rounded-full ${isAvailable ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
          <div>
            <h1 className="text-sm font-semibold text-white leading-tight">AI Assistant</h1>
            <span className="text-[11px] text-zinc-500">
              {isAvailable
                ? connectedApps.length > 0
                  ? `${connectedApps.length} app${connectedApps.length > 1 ? 's' : ''} connected`
                  : 'Ready'
                : 'Offline'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {messages.length > 0 && (
            <button
              onClick={handleNewChat}
              disabled={sending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-zinc-400 hover:text-white bg-zinc-800/60 hover:bg-zinc-700/70 rounded-lg transition-all cursor-pointer disabled:opacity-40 border border-zinc-700/30 hover:border-zinc-600/50"
              title="New chat"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">New</span>
            </button>
          )}
          {messages.length > 0 && (
            <button
              onClick={handleClearHistory}
              className="p-2 text-zinc-600 hover:text-red-400 transition-colors cursor-pointer rounded-lg hover:bg-red-500/10"
              title="Clear chat"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Messages area — only this scrolls */}
      <div ref={scrollAreaRef} className="flex-1 overflow-y-auto min-h-0 scroll-smooth">
        {loadingHistory ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-5 w-5 text-zinc-600 animate-spin" />
          </div>
        ) : showEmptyState ? (
          <div className="flex flex-col items-center justify-center h-full px-4 py-12">
            <div className="mb-1">
              <Sparkles className="h-5 w-5 text-amber-400/60" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-1.5 tracking-tight">How can I help you?</h2>
            <p className="text-zinc-500 text-[13px] max-w-xs text-center mb-8 leading-relaxed">
              {isAvailable
                ? 'Manage emails, calendar, spreadsheets, and more.'
                : 'Start an AI employee from the Dashboard to begin.'}
            </p>

            {isAvailable && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
                {SUGGESTIONS.map(({ icon: Icon, label, prompt, color }) => (
                  <button
                    key={label}
                    onClick={() => handleSuggestion(prompt)}
                    className={`flex items-center gap-3 px-4 py-3.5 rounded-xl bg-gradient-to-br ${color} border hover:scale-[1.02] hover:shadow-lg transition-all text-left group cursor-pointer active:scale-[0.98]`}
                  >
                    <div className="h-9 w-9 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                      <Icon className="h-4.5 w-4.5 text-zinc-300" />
                    </div>
                    <span className="text-[13px] font-medium text-zinc-300 group-hover:text-white transition-colors">{label}</span>
                  </button>
                ))}
              </div>
            )}

            {connectedApps.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-6 justify-center">
                {connectedApps.map(app => (
                  <span key={app} className="px-2.5 py-1 text-[10px] font-medium text-zinc-500 bg-zinc-800/50 rounded-full capitalize border border-zinc-800/60">
                    {app.replace('google', 'Google ')}
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="max-w-3xl mx-auto w-full px-4 md:px-6 py-4">
            {messages.map((msg, i) => (
              <MessageBubble key={i} message={msg} />
            ))}

            {/* Streaming text (real-time response as it arrives) */}
            {sending && streamingText && (
              <div className="py-3 animate-fade-in">
                <div className="bg-zinc-900/30 rounded-2xl px-4 py-3 border border-zinc-800/30">
                  <div className="chat-markdown text-[14px] text-zinc-300 leading-relaxed">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingText}</ReactMarkdown>
                  </div>
                  <span className="inline-block w-[2px] h-4 bg-amber-400/70 ml-0.5 animate-pulse" />
                </div>
              </div>
            )}

            {/* Agent status indicator */}
            {sending && !streamingText && (
              <div className="py-3 animate-fade-in">
                <ThinkingIndicator phase={agentPhase} detail={agentDetail} elapsed={elapsed} />
              </div>
            )}

            <div ref={messagesEndRef} className="h-6" />
          </div>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="shrink-0 px-4 pb-1">
          <div className="max-w-3xl mx-auto">
            <div className="px-4 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400 shrink-0" />
              {error}
            </div>
          </div>
        </div>
      )}

      {/* Input — always at bottom */}
      <div className="shrink-0 px-4 pb-4 pt-2 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/98 to-transparent">
        <div className="max-w-3xl mx-auto w-full">
          <div className="relative bg-zinc-900/95 border border-zinc-800/80 rounded-2xl focus-within:border-amber-500/30 focus-within:shadow-lg focus-within:shadow-amber-500/10 transition-all backdrop-blur-md">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isAvailable ? 'Ask me anything...' : 'AI employee is offline'}
              disabled={!isAvailable || sending}
              rows={1}
              className="w-full bg-transparent text-[14px] text-white placeholder-zinc-600 focus:outline-none resize-none disabled:opacity-40 px-4 py-3.5 pr-14 min-h-[48px] max-h-[160px]"
              onInput={(e) => {
                const t = e.target as HTMLTextAreaElement;
                t.style.height = 'auto';
                t.style.height = Math.min(t.scrollHeight, 160) + 'px';
              }}
            />
            <div className="absolute bottom-2.5 right-2.5">
              <button
                onClick={handleSend}
                disabled={!isAvailable || !input.trim() || sending}
                className="h-9 w-9 flex items-center justify-center rounded-xl bg-amber-500 hover:bg-amber-400 text-black transition-all disabled:opacity-20 disabled:hover:bg-amber-500 cursor-pointer active:scale-95 shadow-md shadow-amber-500/20"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4 font-bold" />}
              </button>
            </div>
          </div>
          <p className="text-[10px] text-zinc-600 mt-2 text-center select-none">
            Responses may not always be accurate. Only connected apps are available.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Minimal Thinking Indicator (Apple-style) ── */
function ThinkingIndicator({ phase, detail, elapsed }: { phase: AgentPhase; detail: string; elapsed: number }) {
  const label = phase === 'connecting' ? 'Connecting'
    : phase === 'thinking' ? (elapsed > 10 ? 'Still thinking' : 'Thinking')
    : phase === 'tool-call' ? (detail || 'Running tool')
    : phase === 'streaming' ? 'Writing'
    : 'Processing';

  const shimmerColor = phase === 'tool-call' ? 'blue' : 'amber';

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-zinc-900/30 rounded-2xl border border-zinc-800/30">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <div className="flex gap-[3px] items-center">
            <span className="h-[5px] w-[5px] rounded-full bg-amber-400/80 animate-pulse" />
            <span className="h-[5px] w-[5px] rounded-full bg-amber-400/60 animate-pulse" style={{ animationDelay: '200ms' }} />
            <span className="h-[5px] w-[5px] rounded-full bg-amber-400/40 animate-pulse" style={{ animationDelay: '400ms' }} />
          </div>
          <span className="text-[13px] text-zinc-400 font-medium">{label}</span>
          {elapsed > 3 && (
            <span className="text-[11px] text-zinc-600 tabular-nums">{elapsed}s</span>
          )}
        </div>
        <ShimmerBar color={shimmerColor} />
      </div>
    </div>
  );
}

/* ── Code Block with Copy Button ── */
function CodeBlock({ children, className }: { children: React.ReactNode; className?: string }) {
  const [copied, setCopied] = useState(false);
  const codeText = String(children).replace(/\n$/, '');
  const language = className?.replace('language-', '') || '';

  const handleCopy = () => {
    navigator.clipboard.writeText(codeText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-3 rounded-xl overflow-hidden border border-zinc-800/80">
      {language && (
        <div className="flex items-center justify-between px-4 py-2 bg-zinc-800/60 border-b border-zinc-800/60">
          <span className="text-[11px] text-zinc-500 font-mono">{language}</span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
          >
            {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      )}
      <pre className="overflow-x-auto p-4 bg-[#0d0d0d] text-[13px] leading-relaxed">
        <code className={`${className || ''} text-zinc-300`}>{children}</code>
      </pre>
      {!language && (
        <button
          onClick={handleCopy}
          className="absolute top-2 right-2 p-1.5 rounded-md bg-zinc-800/80 text-zinc-500 hover:text-zinc-300 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
        </button>
      )}
    </div>
  );
}

/* ── Message Bubble with Markdown ── */
function MessageBubble({ message }: { message: ChatMsg }) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="py-1.5 flex justify-end">
        <div className="max-w-[80%] bg-zinc-800/60 rounded-2xl rounded-br-sm px-4 py-2.5">
          <p className="text-[14px] text-zinc-200 leading-relaxed whitespace-pre-wrap break-words">
            {message.content}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-1.5">
      <div className="bg-zinc-900/30 rounded-2xl rounded-tl-sm px-4 py-3 border border-zinc-800/30">
        <MarkdownContent content={message.content} />
      </div>
    </div>
  );
}

/* ── Markdown renderer with custom components ── */
function MarkdownContent({ content }: { content: string }) {
  const components = useMemo(() => ({
    p: ({ children, ...props }: React.ComponentProps<'p'>) => (
      <p className="text-[14px] text-zinc-300 leading-relaxed mb-3 last:mb-0" {...props}>{children}</p>
    ),
    strong: ({ children, ...props }: React.ComponentProps<'strong'>) => (
      <strong className="font-semibold text-white" {...props}>{children}</strong>
    ),
    em: ({ children, ...props }: React.ComponentProps<'em'>) => (
      <em className="italic text-zinc-200" {...props}>{children}</em>
    ),
    a: ({ href, children, ...props }: React.ComponentProps<'a'>) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-amber-400 hover:text-amber-300 underline underline-offset-2 decoration-amber-400/30 hover:decoration-amber-300/50 transition-colors"
        {...props}
      >
        {children}
      </a>
    ),
    h1: ({ children, ...props }: React.ComponentProps<'h1'>) => (
      <h1 className="text-lg font-bold text-white mt-4 mb-2 first:mt-0" {...props}>{children}</h1>
    ),
    h2: ({ children, ...props }: React.ComponentProps<'h2'>) => (
      <h2 className="text-base font-bold text-white mt-4 mb-2 first:mt-0" {...props}>{children}</h2>
    ),
    h3: ({ children, ...props }: React.ComponentProps<'h3'>) => (
      <h3 className="text-sm font-bold text-white mt-3 mb-1.5 first:mt-0" {...props}>{children}</h3>
    ),
    ul: ({ children, ...props }: React.ComponentProps<'ul'>) => (
      <ul className="list-disc list-outside pl-5 mb-3 space-y-1.5 text-[14px] text-zinc-300" {...props}>{children}</ul>
    ),
    ol: ({ children, ...props }: React.ComponentProps<'ol'>) => (
      <ol className="list-decimal list-outside pl-5 mb-3 space-y-1.5 text-[14px] text-zinc-300" {...props}>{children}</ol>
    ),
    li: ({ children, ...props }: React.ComponentProps<'li'>) => (
      <li className="leading-relaxed" {...props}>{children}</li>
    ),
    blockquote: ({ children, ...props }: React.ComponentProps<'blockquote'>) => (
      <blockquote className="border-l-2 border-amber-500/40 pl-4 my-3 text-zinc-400 italic" {...props}>{children}</blockquote>
    ),
    hr: (props: React.ComponentProps<'hr'>) => (
      <hr className="border-zinc-800 my-4" {...props} />
    ),
    code: ({ className, children, ...props }: React.ComponentProps<'code'> & { inline?: boolean }) => {
      const isBlock = className?.startsWith('language-') || (typeof children === 'string' && children.includes('\n'));
      if (isBlock) {
        return <CodeBlock className={className}>{children}</CodeBlock>;
      }
      return (
        <code className="px-1.5 py-0.5 text-[13px] font-mono bg-zinc-800/80 text-amber-300 rounded-md border border-zinc-700/50" {...props}>
          {children}
        </code>
      );
    },
    pre: ({ children }: React.ComponentProps<'pre'>) => <>{children}</>,
    table: ({ children, ...props }: React.ComponentProps<'table'>) => (
      <div className="overflow-x-auto my-3 rounded-lg border border-zinc-800/80">
        <table className="min-w-full text-sm" {...props}>{children}</table>
      </div>
    ),
    th: ({ children, ...props }: React.ComponentProps<'th'>) => (
      <th className="px-3 py-2 bg-zinc-800/50 text-left text-xs font-semibold text-zinc-300 border-b border-zinc-800" {...props}>{children}</th>
    ),
    td: ({ children, ...props }: React.ComponentProps<'td'>) => (
      <td className="px-3 py-2 text-zinc-400 border-b border-zinc-800/50" {...props}>{children}</td>
    ),
  }), []);

  return (
    <div className="chat-markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
