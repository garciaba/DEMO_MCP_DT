import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '../stores/auth';

export function LoginScreen() {
  const { deviceCode, loading, error, clientId, setClientId, startDeviceFlow, pollForToken, clearError } = useAuthStore();
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Poll for token once device code is available
  useEffect(() => {
    if (!deviceCode) return;
    let cancelled = false;
    let delay = (deviceCode.interval || 5) * 1000;

    const poll = async () => {
      if (cancelled) return;
      const result = await pollForToken(deviceCode.device_code);
      if (cancelled) return;
      if (result === true) return; // done or error — stop
      if (result === 'slow_down') delay += 5000; // back off
      pollRef.current = setTimeout(poll, delay);
    };

    pollRef.current = setTimeout(poll, delay);

    return () => {
      cancelled = true;
      if (pollRef.current) {
        clearTimeout(pollRef.current as ReturnType<typeof setTimeout>);
        pollRef.current = null;
      }
    };
  }, [deviceCode, pollForToken]);

  const handleCopyCode = useCallback(() => {
    if (deviceCode?.user_code) {
      navigator.clipboard.writeText(deviceCode.user_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [deviceCode]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-1">
      <div className="w-full max-w-md animate-fade-in">
        <div className="bg-white rounded-2xl shadow-elevated p-8 border border-surface-3">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 rounded-xl bg-brand-600 flex items-center justify-center mb-4 shadow-medium">
              <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
                <path d="M4 16h6l4-10 6 20 4-10h6" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">MCP Chat Client</h1>
            <p className="text-sm text-gray-500 mt-1">Copilot + Dynatrace Integration Demo</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 flex items-center justify-between">
              <span>{error}</span>
              <button onClick={clearError} className="text-red-400 hover:text-red-600 ml-2">✕</button>
            </div>
          )}

          {!deviceCode ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">GitHub Client ID</label>
                <input
                  type="text"
                  value={clientId}
                  onChange={e => setClientId(e.target.value)}
                  placeholder="Ov23li..."
                  className="w-full px-3 py-2.5 text-sm border border-surface-3 rounded-lg
                             focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400
                             bg-surface-1 transition-all font-mono"
                />
                <p className="text-xs text-gray-400 mt-1">
                  From your <a href="https://github.com/settings/developers" target="_blank" rel="noopener noreferrer" className="text-brand-500 hover:underline">GitHub OAuth App</a>
                </p>
              </div>

              <button
                onClick={startDeviceFlow}
                disabled={loading || !clientId.trim()}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-gray-900 text-white rounded-xl
                           hover:bg-gray-800 transition-all duration-200 font-medium text-sm
                           disabled:opacity-50 disabled:cursor-not-allowed shadow-soft"
              >
              {loading ? (
                <div className="typing-dots">
                  <span></span><span></span><span></span>
                </div>
              ) : (
                <>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                  </svg>
                  Sign in with GitHub
                </>
              )}
              </button>
            </div>
          ) : (
            <div className="text-center animate-slide-up">
              <p className="text-sm text-gray-500 mb-3">Enter this code at GitHub:</p>

              <div
                onClick={handleCopyCode}
                className="inline-block px-6 py-3 bg-surface-2 rounded-xl font-mono text-2xl font-bold
                           text-brand-700 cursor-pointer hover:bg-surface-3 transition-colors
                           tracking-widest select-all"
              >
                {deviceCode.user_code}
              </div>

              <p className="text-xs text-gray-400 mt-2">
                {copied ? '✓ Copied!' : 'Click to copy'}
              </p>

              <a
                href={deviceCode.verification_uri}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg
                           hover:bg-brand-700 transition-colors text-sm font-medium"
              >
                Open GitHub
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/>
                </svg>
              </a>

              <div className="mt-6 flex items-center justify-center gap-2 text-sm text-gray-400">
                <div className="typing-dots">
                  <span></span><span></span><span></span>
                </div>
                <span>Waiting for authorization...</span>
              </div>
            </div>
          )}

          <p className="text-xs text-gray-400 text-center mt-6">
            Requires a GitHub Copilot license
          </p>
        </div>
      </div>
    </div>
  );
}
