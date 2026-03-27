import { useRef, useEffect, useState, useCallback, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useChatStore } from '../stores/chat';
import type { ChatMessage, MCPActivityItem } from '../../../shared/src/index';

// ─── MCP Activity Log ─────────────────────────────────────────

const MCPActivityLog = memo(function MCPActivityLog({ activities }: { activities: MCPActivityItem[] }) {
  const [expanded, setExpanded] = useState(false);

  if (activities.length === 0) return null;

  return (
    <div className="mcp-activity-log my-2 max-w-[75%] ml-11">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700
                   transition-colors py-1 px-2 rounded-md hover:bg-surface-2 group"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
             className="text-indigo-400 group-hover:text-indigo-500">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
        <span className="font-medium">MCP Activity</span>
        <span className="text-gray-400">({activities.length})</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2" className={`transition-transform ${expanded ? 'rotate-180' : ''}`}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {expanded && (
        <div className="mt-1 border border-surface-3 rounded-lg bg-white/60 backdrop-blur-sm
                        overflow-hidden divide-y divide-surface-3 animate-slide-up">
          {activities.map(a => (
            <div key={a.id} className="px-3 py-2 flex items-start gap-2 text-xs">
              {a.direction === 'sent' ? (
                <span className="mcp-badge mcp-badge-sent shrink-0 mt-0.5">SENT</span>
              ) : (
                <span className="mcp-badge mcp-badge-received shrink-0 mt-0.5">RECV</span>
              )}
              <div className="min-w-0">
                <span className="font-mono text-indigo-600 font-medium">{a.toolName}</span>
                <p className="text-gray-500 mt-0.5 break-words leading-relaxed">{a.summary}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

// ─── Message Bubble ───────────────────────────────────────────

const MessageBubble = memo(function MessageBubble({ message, activities }: { message: ChatMessage; activities?: MCPActivityItem[] }) {
  const isUser = message.role === 'user';

  return (
  <>
    <div className={`flex gap-3 animate-slide-up ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center shrink-0 mt-1">
          <svg width="16" height="16" viewBox="0 0 32 32" fill="none">
            <path d="M4 16h6l4-10 6 20 4-10h6" stroke="#4263eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      )}

      <div
        className={`max-w-[75%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-brand-600 text-white rounded-br-md'
            : 'bg-white border border-surface-3 shadow-soft rounded-bl-md'
        }`}
      >
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        ) : message.content ? (
          <div className="prose text-sm">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        ) : (
          <div className="typing-dots py-1">
            <span></span><span></span><span></span>
          </div>
        )}
      </div>

      {isUser && (
        <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center shrink-0 mt-1">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
          </svg>
        </div>
      )}
    </div>
    {!isUser && activities && activities.length > 0 && (
      <MCPActivityLog activities={activities} />
    )}
  </>
  );
});

// ─── Chat Panel ───────────────────────────────────────────────

export function ChatPanel() {
  const messages = useChatStore(s => s.messages);
  const mcpActivities = useChatStore(s => s.mcpActivities);
  const isStreaming = useChatStore(s => s.isStreaming);
  const sendMessage = useChatStore(s => s.sendMessage);
  const clearMessages = useChatStore(s => s.clearMessages);

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + 'px';
    }
  }, [input]);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    setInput('');
    sendMessage(trimmed);
  }, [input, isStreaming, sendMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-surface-1">
      {/* ─── Messages Area ─────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-brand-100 flex items-center justify-center mb-4">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <path d="M4 16h6l4-10 6 20 4-10h6" stroke="#4263eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">MCP Chat</h2>
            <p className="text-sm text-gray-400 max-w-sm">
              Start a conversation or use a predefined prompt from the left panel.
              Upload context files and connect to Dynatrace for enhanced insights.
            </p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.map(msg => (
              <MessageBubble key={msg.id} message={msg} activities={mcpActivities[msg.id]} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* ─── Input Area ────────────────────────────────────── */}
      <div className="shrink-0 border-t border-surface-3 bg-white px-6 py-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end gap-3">
            {messages.length > 0 && (
              <button
                onClick={clearMessages}
                className="shrink-0 p-2 text-gray-400 hover:text-gray-600 hover:bg-surface-2
                           rounded-lg transition-colors"
                title="Clear chat"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                </svg>
              </button>
            )}

            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message... (Shift+Enter for new line)"
                rows={1}
                className="w-full resize-none rounded-xl border border-surface-3 bg-surface-1
                           px-4 py-3 text-sm text-gray-900 placeholder-gray-400
                           focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400
                           transition-all duration-200"
              />
            </div>

            <button
              onClick={handleSend}
              disabled={!input.trim() || isStreaming}
              className="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl
                         bg-brand-600 text-white hover:bg-brand-700
                         disabled:opacity-40 disabled:cursor-not-allowed
                         transition-all duration-200 shadow-soft"
            >
              {isStreaming ? (
                <div className="typing-dots">
                  <span className="!bg-white !w-1.5 !h-1.5"></span>
                  <span className="!bg-white !w-1.5 !h-1.5"></span>
                  <span className="!bg-white !w-1.5 !h-1.5"></span>
                </div>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
