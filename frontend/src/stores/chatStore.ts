/**
 * Global Chat Store (Zustand)
 * 
 * Persists chat state (messages, SSE connection, sending status) across
 * React Router navigation. When user navigates away from /chat during
 * an active request, the SSE EventSource stays alive in this store.
 * When they navigate back, Chat.tsx reads from this store and shows
 * the live/completed response.
 */
import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

const API_URL = import.meta.env.VITE_API_URL !== undefined ? import.meta.env.VITE_API_URL : 'http://localhost:3000';

export interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

export type AgentPhase = 'idle' | 'connecting' | 'thinking' | 'tool-call' | 'streaming' | 'error';

interface ChatStore {
  // State
  messages: ChatMsg[];
  sending: boolean;
  agentPhase: AgentPhase;
  agentDetail: string;
  streamingText: string;
  error: string | null;
  activeChatId: string | null;
  historyLoaded: boolean;

  // Internal refs (not reactive, just stored)
  _eventSource: EventSource | null;
  _streamingChunks: string[];
  _elapsedTimer: ReturnType<typeof setInterval> | null;
  elapsed: number;

  // Actions
  loadHistory: () => Promise<void>;
  sendMessage: (text: string, isAvailable: boolean) => Promise<void>;
  clearHistory: () => Promise<void>;
  cleanup: () => void;
  _startStream: (chatId: string) => Promise<void>;
  _stopStream: () => void;
  _startElapsed: () => void;
  _stopElapsed: () => void;
  _recoverFromDB: () => Promise<void>;
}

export const useChatStore = create<ChatStore>()((set, get) => ({
  // Initial state
  messages: [],
  sending: false,
  agentPhase: 'idle',
  agentDetail: '',
  streamingText: '',
  error: null,
  activeChatId: null,
  historyLoaded: false,
  _eventSource: null,
  _streamingChunks: [],
  _elapsedTimer: null,
  elapsed: 0,

  loadHistory: async () => {
    if (get().historyLoaded) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`${API_URL}/api/chat/history`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      const data = await res.json();
      if (data.messages?.length) {
        set({
          messages: data.messages.map((m: { role: string; content: string }) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })),
          historyLoaded: true,
        });
      } else {
        set({ historyLoaded: true });
      }
    } catch {
      set({ historyLoaded: true });
    }
  },

  sendMessage: async (text: string, isAvailable: boolean) => {
    const state = get();
    if (!text.trim() || state.sending || !isAvailable) return;

    // Prevent duplicate sends — if there's already an active chat, ignore
    if (state.activeChatId && state.sending) return;

    set({
      messages: [...state.messages, { role: 'user', content: text }],
      sending: true,
      agentPhase: 'connecting',
      agentDetail: 'Sending...',
      error: null,
      streamingText: '',
    });

    get()._startElapsed();

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const res = await fetch(`${API_URL}/api/chat/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ message: text }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'API request failed');

      if (data.chatId) {
        set({ activeChatId: data.chatId });
        await get()._startStream(data.chatId);
      } else if (data.response) {
        set({
          messages: [...get().messages, { role: 'assistant', content: data.response }],
          sending: false,
          agentPhase: 'idle',
          agentDetail: '',
          activeChatId: null,
        });
        get()._stopElapsed();
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Failed to send message';
      set({
        error: errMsg,
        sending: false,
        agentPhase: 'idle',
        agentDetail: '',
        activeChatId: null,
      });
      get()._stopElapsed();
    }
  },

  _startStream: async (chatId: string) => {
    const state = get();

    // Close any existing EventSource
    if (state._eventSource) {
      state._eventSource.close();
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const chunks: string[] = [];
    set({ _streamingChunks: chunks });

    const streamUrl = `${API_URL}/api/chat/stream/${chatId}`;
    const es = new EventSource(`${streamUrl}?token=${session.access_token}`);
    set({ _eventSource: es });

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.state === 'done') {
          set({
            messages: [...get().messages, { role: 'assistant', content: data.detail }],
            sending: false,
            agentPhase: 'idle',
            agentDetail: '',
            streamingText: '',
            activeChatId: null,
            _streamingChunks: [],
          });
          get()._stopElapsed();
          get()._stopStream();
          return;
        }

        if (data.state === 'error') {
          set({
            error: data.detail || 'Agent error',
            sending: false,
            agentPhase: 'error',
            agentDetail: '',
            streamingText: '',
            activeChatId: null,
            _streamingChunks: [],
          });
          get()._stopElapsed();
          get()._stopStream();
          return;
        }

        if (data.state === 'connecting' || data.state === 'authenticating') {
          set({ agentPhase: 'connecting', agentDetail: data.detail || 'Connecting...' });
          return;
        }

        if (data.state === 'thinking' || data.state === 'processing') {
          set({ agentPhase: 'thinking', agentDetail: data.detail || 'Thinking...' });
          return;
        }

        if (data.state === 'tool-call' || data.state === 'tool-result') {
          set({ agentPhase: 'tool-call', agentDetail: data.detail || 'Running integration...' });
          return;
        }

        if (data.state === 'streaming') {
          const currentChunks = get()._streamingChunks;
          currentChunks.push(data.detail || '');
          set({
            agentPhase: 'streaming',
            streamingText: currentChunks.join(''),
            _streamingChunks: currentChunks,
          });
          return;
        }

        set({ agentDetail: data.detail || 'Processing...' });
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      // SSE auto-reconnects by default. Only clean up if truly closed.
      setTimeout(() => {
        if (es.readyState === EventSource.CLOSED) {
          const currentState = get();
          // Only reset if this is still the active stream
          if (currentState._eventSource === es) {
            // If we were sending, try to recover from DB
            if (currentState.sending) {
              get()._recoverFromDB();
            }
            set({
              sending: false,
              agentPhase: 'idle',
              agentDetail: '',
              streamingText: '',
              activeChatId: null,
              _streamingChunks: [],
              _eventSource: null,
            });
            get()._stopElapsed();
          }
        }
      }, 5000);
    };
  },

  _stopStream: () => {
    const es = get()._eventSource;
    if (es) {
      es.close();
      set({ _eventSource: null });
    }
  },

  _startElapsed: () => {
    get()._stopElapsed();
    set({ elapsed: 0 });
    const timer = setInterval(() => {
      set({ elapsed: get().elapsed + 1 });
    }, 1000);
    set({ _elapsedTimer: timer });
  },

  _stopElapsed: () => {
    const timer = get()._elapsedTimer;
    if (timer) {
      clearInterval(timer);
      set({ _elapsedTimer: null, elapsed: 0 });
    }
  },

  /**
   * If the SSE connection drops (e.g. network issue), try to recover
   * the last assistant message from the DB.
   */
  _recoverFromDB: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`${API_URL}/api/chat/history?limit=2`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      const data = await res.json();
      if (data.messages?.length) {
        const lastMsg = data.messages[data.messages.length - 1];
        if (lastMsg.role === 'assistant') {
          // Check if we already have this message
          const currentMessages = get().messages;
          const lastCurrentMsg = currentMessages[currentMessages.length - 1];
          if (!lastCurrentMsg || lastCurrentMsg.role !== 'assistant' || lastCurrentMsg.content !== lastMsg.content) {
            set({
              messages: [...currentMessages, { role: 'assistant', content: lastMsg.content }],
            });
          }
        }
      }
    } catch {
      // silent recovery failure
    }
  },

  clearHistory: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await fetch(`${API_URL}/api/chat/history`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      get()._stopStream();
      get()._stopElapsed();
      set({
        messages: [],
        sending: false,
        agentPhase: 'idle',
        agentDetail: '',
        streamingText: '',
        error: null,
        activeChatId: null,
        _streamingChunks: [],
      });
    } catch {
      // silent
    }
  },

  cleanup: () => {
    get()._stopStream();
    get()._stopElapsed();
  },
}));
