import { useAuthStore } from '../stores/auth';
import { LeftPanel } from './LeftPanel';
import { ChatPanel } from './ChatPanel';
import { RightPanel } from './RightPanel';

export function ChatLayout() {
  const user = useAuthStore(s => s.status.user);
  const anthropicUser = useAuthStore(s => s.status.anthropicUser);
  const provider = useAuthStore(s => s.status.provider);
  const logout = useAuthStore(s => s.logout);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-surface-1">
      {/* ─── Top Bar ─────────────────────────────────────────── */}
      <header className="h-14 flex items-center justify-between px-5 border-b border-surface-3 bg-white shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
              <path d="M4 16h6l4-10 6 20 4-10h6" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className="text-base font-semibold text-gray-900">MCP Chat</h1>
          <span className="text-xs text-gray-400 bg-surface-2 px-2 py-0.5 rounded-full">Dynatrace Demo</span>
        </div>

        <div className="flex items-center gap-3">
          {provider === 'anthropic' && anthropicUser ? (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full ring-2 ring-surface-3 bg-[#D4A27F] flex items-center justify-center">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
                  <path d="M13.827 3.52h3.603L24 20.48h-3.603l-6.57-16.96zm-7.258 0h3.767L16.906 20.48h-3.674l-1.503-4.076H5.248l-1.5 4.076H0L6.569 3.52zm1.04 4.777L5.247 14.14h4.755L7.609 8.297z"/>
                </svg>
              </div>
              <span className="text-sm text-gray-600 font-medium">{anthropicUser.name}</span>
            </div>
          ) : user ? (
            <div className="flex items-center gap-2">
              <img
                src={user.avatar_url}
                alt={user.login}
                className="w-7 h-7 rounded-full ring-2 ring-surface-3"
              />
              <span className="text-sm text-gray-600 font-medium">{user.login}</span>
            </div>
          ) : null}
          <button
            onClick={logout}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors px-2 py-1 rounded hover:bg-surface-2"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* ─── Main Area ───────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">
        <LeftPanel />
        <ChatPanel />
        <RightPanel />
      </div>
    </div>
  );
}
