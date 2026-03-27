import { create } from 'zustand';
import { nanoid } from 'nanoid';
import type { ChatMessage, ChatStreamEvent, ContextFile, MCPActivityItem } from '../../../shared/src/index';

interface MCPToolInfo {
  name: string;
  description?: string;
}

interface DtctlInfo {
  installed: boolean;
  version?: string;
  currentContext?: string;
  contextDescription?: string;
  whoami?: string;
  authenticated: boolean;
}

interface ChatState {
  messages: ChatMessage[];
  mcpActivities: Record<string, MCPActivityItem[]>;  // keyed by assistant message ID
  isStreaming: boolean;
  selectedModel: string;
  contextFiles: ContextFile[];
  mcpConfig: { mcpServerUrl: string; bearerToken: string } | null;
  mcpConnected: boolean;
  mcpTools: MCPToolInfo[];
  dtctlInfo: DtctlInfo | null;
  dtctlLoading: boolean;

  addMessage: (role: ChatMessage['role'], content: string) => string;
  updateMessage: (id: string, content: string) => void;
  appendToMessage: (id: string, delta: string) => void;
  clearMessages: () => void;
  setModel: (model: string) => void;
  setContextFiles: (files: ContextFile[]) => void;
  setMCPConfig: (config: { mcpServerUrl: string; bearerToken: string } | null) => void;
  setMCPConnected: (connected: boolean) => void;
  setMCPTools: (tools: MCPToolInfo[]) => void;
  addMCPActivity: (assistantId: string, activity: MCPActivityItem) => void;
  checkDtctl: () => Promise<void>;
  installDtctl: () => Promise<{ ok: boolean; error?: string }>;
  dtctlLogin: (environmentUrl: string) => Promise<{ ok: boolean; error?: string }>;
  dtctlLogout: () => Promise<void>;

  sendMessage: (content: string) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  mcpActivities: {},
  isStreaming: false,
  selectedModel: 'gpt-4o',
  contextFiles: [],
  mcpConfig: null,
  mcpConnected: false,
  mcpTools: [],
  dtctlInfo: null,
  dtctlLoading: false,

  addMessage: (role, content) => {
    const id = nanoid();
    const message: ChatMessage = { id, role, content, timestamp: Date.now() };
    set(state => ({ messages: [...state.messages, message] }));
    return id;
  },

  updateMessage: (id, content) => {
    set(state => ({
      messages: state.messages.map(m => (m.id === id ? { ...m, content } : m)),
    }));
  },

  appendToMessage: (id, delta) => {
    set(state => ({
      messages: state.messages.map(m => (m.id === id ? { ...m, content: m.content + delta } : m)),
    }));
  },

  clearMessages: () => set({ messages: [], mcpActivities: {} }),

  setModel: (model) => set({ selectedModel: model }),

  setContextFiles: (files) => set({ contextFiles: files }),

  setMCPConfig: (config) => set({ mcpConfig: config }),

  setMCPConnected: (connected) => set({ mcpConnected: connected }),

  setMCPTools: (tools) => set({ mcpTools: tools }),

  addMCPActivity: (assistantId, activity) => {
    set(state => ({
      mcpActivities: {
        ...state.mcpActivities,
        [assistantId]: [...(state.mcpActivities[assistantId] ?? []), activity],
      },
    }));
  },

  checkDtctl: async () => {
    set({ dtctlLoading: true });
    try {
      const res = await fetch('/api/dtctl/status', { credentials: 'include' });
      if (res.ok) {
        const info = await res.json();
        set({ dtctlInfo: info });
      } else {
        set({ dtctlInfo: { installed: false, authenticated: false } });
      }
    } catch {
      set({ dtctlInfo: { installed: false, authenticated: false } });
    } finally {
      set({ dtctlLoading: false });
    }
  },

  installDtctl: async () => {
    set({ dtctlLoading: true });
    try {
      const res = await fetch('/api/dtctl/install', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        set({ dtctlInfo: data });
        return { ok: true };
      } else {
        return { ok: false, error: data.error || 'Installation failed' };
      }
    } catch {
      return { ok: false, error: 'Installation request failed' };
    } finally {
      set({ dtctlLoading: false });
    }
  },

  dtctlLogin: async (environmentUrl: string) => {
    set({ dtctlLoading: true });
    try {
      const res = await fetch('/api/dtctl/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ environmentUrl }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        set({ dtctlInfo: data.context });
        return { ok: true };
      } else {
        return { ok: false, error: data.error || 'Login failed' };
      }
    } catch {
      return { ok: false, error: 'Login request failed' };
    } finally {
      set({ dtctlLoading: false });
    }
  },

  dtctlLogout: async () => {
    try {
      await fetch('/api/dtctl/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch { /* ignore */ }
    // Refresh status
    get().checkDtctl();
  },

  sendMessage: async (content: string) => {
    const state = get();
    if (state.isStreaming) return;

    // Add user message
    state.addMessage('user', content);

    // Create placeholder for assistant response
    const assistantId = get().addMessage('assistant', '');
    set({ isStreaming: true });

    try {
      // Build context payload
      const contextPayload = {
        files: state.contextFiles,
      };

      // Build MCP config if connected
      const mcpConfig = state.mcpConnected && state.mcpConfig
        ? { mcpServerUrl: state.mcpConfig.mcpServerUrl, bearerToken: state.mcpConfig.bearerToken }
        : undefined;

      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          messages: get().messages.filter(m => m.id !== assistantId),
          model: state.selectedModel,
          context: contextPayload,
          mcpConfig,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        get().updateMessage(assistantId, `Error: ${err.error || 'Failed to get response'}`);
        set({ isStreaming: false });
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        get().updateMessage(assistantId, 'Error: No response stream');
        set({ isStreaming: false });
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          try {
            const event: ChatStreamEvent = JSON.parse(trimmed.slice(6));

            if (event.type === 'delta' && event.content) {
              get().appendToMessage(assistantId, event.content);
            } else if (event.type === 'context_warning') {
              get().appendToMessage(assistantId, `\n\n> ⚠️ **Context Warning:** ${event.content}\n\n`);
            } else if (event.type === 'mcp_message') {
              get().addMCPActivity(assistantId, {
                id: nanoid(),
                direction: event.direction ?? 'sent',
                toolName: event.toolName ?? 'unknown',
                summary: event.summary ?? event.content ?? '',
                timestamp: Date.now(),
              });
            } else if (event.type === 'tool_call') {
              // Show tool call indicator in the message
              if (event.status === 'calling') {
                get().appendToMessage(assistantId, `\n\n> **Calling tool:** \`${event.toolName}\`...\n`);
              } else if (event.status === 'done') {
                get().appendToMessage(assistantId, `> Tool \`${event.toolName}\` completed.\n\n`);
              } else if (event.status === 'error') {
                get().appendToMessage(assistantId, `> Tool \`${event.toolName}\` failed: ${event.error}\n\n`);
              }
            } else if (event.type === 'error') {
              get().appendToMessage(assistantId, `\n\nError: ${event.error}`);
            }
          } catch {
            // Skip malformed events
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      get().updateMessage(assistantId, `Error: ${message}`);
    } finally {
      set({ isStreaming: false });
    }
  },
}));
