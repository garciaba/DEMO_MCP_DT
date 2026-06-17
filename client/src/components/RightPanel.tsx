import { useState, useCallback, useEffect, type ReactNode } from 'react';
import { useChatStore } from '../stores/chat';
import { AVAILABLE_MODELS } from '../../../shared/src/index';

// ─── Chevron icon ─────────────────────────────────────────────

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      className={`shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

// ─── Collapsible Section wrapper ──────────────────────────────

function Section({
  title,
  defaultOpen = false,
  badge,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  badge?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-t border-surface-3 pt-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1 hover:text-gray-600 transition-colors"
      >
        <span className="flex items-center gap-2 min-w-0">
          {title}
          {badge}
        </span>
        <ChevronIcon open={open} />
      </button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  );
}

// ─── Model Selector (dropdown + dynamic load) ─────────────────

interface RemoteModel {
  id: string;
  name: string;
  version?: string;
}

function ModelSelector() {
  const selectedModel = useChatStore(s => s.selectedModel);
  const setModel = useChatStore(s => s.setModel);
  const [models, setModels] = useState<RemoteModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Fetch models from the API (works for both GitHub Copilot and Anthropic)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/models', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && Array.isArray(data.models) && data.models.length > 0) {
            setModels(data.models);
            setLoaded(true);
            // Auto-select first model if current selection isn't in the list
            const ids = data.models.map((m: RemoteModel) => m.id);
            if (!ids.includes(selectedModel) && data.models.length > 0) {
              setModel(data.models[0].id);
            }
          }
        }
      } catch {
        // will fall back to static list
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Merge: remote models first, fall back to static
  const displayModels = loaded
    ? models
    : AVAILABLE_MODELS.map(m => ({ id: m.id, name: m.name }));

  const currentLabel = displayModels.find(m => m.id === selectedModel)?.name ?? selectedModel;

  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
        Model
      </h3>
      <div className="relative">
        <select
          value={selectedModel}
          onChange={e => setModel(e.target.value)}
          disabled={loading}
          className="w-full appearance-none px-3 py-2 pr-8 text-sm bg-surface-1 border border-surface-3 rounded-lg
                     focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400
                     transition-all disabled:opacity-50 truncate"
        >
          {displayModels.map(m => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        {/* Custom dropdown arrow */}
        <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
          {loading ? (
            <svg className="animate-spin h-3.5 w-3.5 text-gray-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
              <path d="M6 9l6 6 6-6" />
            </svg>
          )}
        </div>
      </div>
      {loaded && (
        <p className="text-[10px] text-gray-400 mt-1">{displayModels.length} model{displayModels.length !== 1 ? 's' : ''} available</p>
      )}
    </div>
  );
}

// ─── Dynatrace MCP Config ─────────────────────────────────────

function DynatraceConfig() {
  const mcpConfig = useChatStore(s => s.mcpConfig);
  const mcpConnected = useChatStore(s => s.mcpConnected);
  const mcpTools = useChatStore(s => s.mcpTools);
  const setMCPConfig = useChatStore(s => s.setMCPConfig);
  const setMCPConnected = useChatStore(s => s.setMCPConnected);
  const setMCPTools = useChatStore(s => s.setMCPTools);

  const [mcpServerUrl, setMcpServerUrl] = useState(mcpConfig?.mcpServerUrl ?? '');
  const [bearerToken, setBearerToken] = useState(mcpConfig?.bearerToken ?? '');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = useCallback(async () => {
    if (!mcpServerUrl || !bearerToken) return;

    setConnecting(true);
    setError(null);

    try {
      const res = await fetch('/api/dynatrace/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ mcpServerUrl, bearerToken }),
      });

      const data = await res.json();

      if (res.ok) {
        setMCPConfig({ mcpServerUrl, bearerToken });
        setMCPConnected(true);
        setMCPTools(data.tools ?? []);
      } else {
        setError(data.error || 'Connection failed');
        setMCPConnected(false);
      }
    } catch {
      setError('Failed to connect');
      setMCPConnected(false);
    } finally {
      setConnecting(false);
    }
  }, [mcpServerUrl, bearerToken, setMCPConfig, setMCPConnected, setMCPTools]);

  const handleDisconnect = useCallback(async () => {
    try {
      await fetch('/api/dynatrace/disconnect', {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // ignore
    }
    setMCPConfig(null);
    setMCPConnected(false);
    setMCPTools([]);
    setMcpServerUrl('');
    setBearerToken('');
    setError(null);
  }, [setMCPConfig, setMCPConnected, setMCPTools]);

  return (
    <div className="min-w-0">
      {mcpConnected ? (
        <div className="space-y-3">
          <div className="px-3 py-2 bg-green-50 rounded-lg border border-green-100">
            <div className="flex items-center gap-2 text-sm text-green-700 font-medium">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                <path d="M22 4L12 14.01l-3-3"/>
              </svg>
              Connected &middot; {mcpTools.length} tool{mcpTools.length !== 1 ? 's' : ''}
            </div>
          </div>

          {mcpTools.length > 0 && (
            <div className="max-h-32 overflow-y-auto space-y-1">
              {mcpTools.map((t) => (
                <div key={t.name} className="px-2 py-1 bg-surface-2 rounded text-xs min-w-0">
                  <span className="font-medium text-gray-700 truncate block">{t.name}</span>
                  {t.description && (
                    <p className="text-gray-400 mt-0.5 line-clamp-1 break-all">{t.description}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          <button
            onClick={handleDisconnect}
            className="w-full text-xs text-gray-400 hover:text-red-500 transition-colors py-1"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">MCP Server URL</label>
            <input
              type="url"
              value={mcpServerUrl}
              onChange={e => setMcpServerUrl(e.target.value)}
              placeholder="https://…/mcp"
              className="w-full px-3 py-2 text-sm border border-surface-3 rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400
                         bg-surface-1 transition-all truncate"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Bearer Token</label>
            <input
              type="password"
              value={bearerToken}
              onChange={e => setBearerToken(e.target.value)}
              placeholder="dt0c01.••••••••"
              className="w-full px-3 py-2 text-sm border border-surface-3 rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400
                         bg-surface-1 transition-all"
            />
          </div>

          {error && (
            <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg break-words">{error}</p>
          )}

          <button
            onClick={handleConnect}
            disabled={!mcpServerUrl || !bearerToken || connecting}
            className="w-full px-3 py-2 text-sm font-medium bg-dt-purple text-white rounded-lg
                       hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {connecting ? 'Connecting…' : 'Connect'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── dtctl Status ─────────────────────────────────────────────

function DtctlPanel() {
  const dtctlInfo = useChatStore(s => s.dtctlInfo);
  const dtctlLoading = useChatStore(s => s.dtctlLoading);
  const checkDtctl = useChatStore(s => s.checkDtctl);
  const dtctlLogin = useChatStore(s => s.dtctlLogin);
  const dtctlLogout = useChatStore(s => s.dtctlLogout);
  const installDtctl = useChatStore(s => s.installDtctl);

  const [envUrl, setEnvUrl] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [installError, setInstallError] = useState<string | null>(null);

  useEffect(() => {
    checkDtctl();
  }, [checkDtctl]);

  const isAuthenticated = dtctlInfo?.installed && dtctlInfo?.authenticated;

  const handleLogin = useCallback(async () => {
    if (!envUrl) return;
    setLoginError(null);
    const result = await dtctlLogin(envUrl);
    if (!result.ok) {
      setLoginError(result.error ?? 'Login failed');
    } else {
      setEnvUrl('');
    }
  }, [envUrl, dtctlLogin]);

  const handleLogout = useCallback(async () => {
    setLoginError(null);
    await dtctlLogout();
  }, [dtctlLogout]);

  return (
    <div className="min-w-0">
      {dtctlLoading ? (
        <div className="px-3 py-2 bg-surface-2 rounded-lg text-xs text-gray-500 flex items-center gap-2">
          <svg className="animate-spin h-3.5 w-3.5 text-brand-500 shrink-0" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          {dtctlInfo?.installed ? 'Logging in via browser…' : 'Checking dtctl…'}
        </div>
      ) : !dtctlInfo?.installed ? (
        /* ─── Not installed ─────────────────────────────────── */
        <div className="space-y-2">
          <p className="text-xs text-amber-700 bg-amber-50 rounded-lg border border-amber-100 px-3 py-2">
            dtctl not found. Click below to install.
          </p>
          {installError && (
            <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg break-words">{installError}</p>
          )}
          <button
            onClick={async () => {
              setInstallError(null);
              const result = await installDtctl();
              if (!result.ok) setInstallError(result.error ?? 'Install failed');
            }}
            className="w-full px-3 py-2 text-sm font-medium bg-brand-600 text-white rounded-lg
                       hover:opacity-90 transition-all flex items-center justify-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
            </svg>
            Install dtctl
          </button>
        </div>
      ) : isAuthenticated ? (
        /* ─── Authenticated — compact single card ───────────── */
        <div className="space-y-2">
          <div className="px-3 py-2 bg-green-50 rounded-lg border border-green-100 space-y-1">
            <div className="flex items-center gap-2 text-xs text-green-700 font-medium">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                <path d="M22 4L12 14.01l-3-3"/>
              </svg>
              Authenticated
            </div>
            {dtctlInfo.version && (
              <p className="text-[10px] text-green-600 font-mono truncate">{dtctlInfo.version}</p>
            )}
            {dtctlInfo.currentContext && (
              <p className="text-[10px] text-gray-500 truncate">
                <span className="font-medium text-gray-600">Ctx:</span> {dtctlInfo.currentContext}
              </p>
            )}
            {dtctlInfo.whoami && (
              <p className="text-[10px] text-gray-500 truncate">
                <span className="font-medium text-gray-600">User:</span> {dtctlInfo.whoami}
              </p>
            )}
            {dtctlInfo.contextDescription && (
              <p className="text-[10px] text-gray-400 font-mono truncate" title={dtctlInfo.contextDescription}>
                {dtctlInfo.contextDescription}
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => checkDtctl()}
              className="flex-1 text-xs text-gray-400 hover:text-brand-600 transition-colors py-1"
            >
              Refresh
            </button>
            <button
              onClick={handleLogout}
              className="flex-1 text-xs text-gray-400 hover:text-red-500 transition-colors py-1"
            >
              Logout
            </button>
          </div>
        </div>
      ) : (
        /* ─── Installed but not authenticated ───────────────── */
        <div className="space-y-2">
          <p className="text-xs text-gray-500 bg-surface-2 px-3 py-2 rounded-lg">
            Log in to your Dynatrace environment via OAuth.
          </p>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Environment URL</label>
            <input
              type="url"
              value={envUrl}
              onChange={e => setEnvUrl(e.target.value)}
              placeholder="https://abc12345.apps.dynatrace.com"
              className="w-full px-3 py-2 text-sm border border-surface-3 rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400
                         bg-surface-1 transition-all truncate"
            />
          </div>
          {loginError && (
            <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg break-words">{loginError}</p>
          )}
          <button
            onClick={handleLogin}
            disabled={!envUrl}
            className="w-full px-3 py-2 text-sm font-medium bg-dt-purple text-white rounded-lg
                       hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed
                       flex items-center justify-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3"/>
            </svg>
            Login via OAuth
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Observability / Telemetry Config ─────────────────────────

function ObservabilityConfig() {
  const [endpoint, setEndpoint] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  // Load current config on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/telemetry/config', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setEndpoint(data.endpoint ?? '');
          setEnabled(data.enabled ?? false);
          setHasToken(data.hasToken ?? false);
          // Don't populate apiToken — it's masked from server
        }
      } catch {
        // ignore — will show empty form
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/telemetry/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ endpoint, apiToken, enabled }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to save');
      } else {
        setSuccess('Configuration saved');
        setHasToken(data.hasToken);
        setDirty(false);
        setApiToken(''); // Clear local token input after save
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  }, [endpoint, apiToken, enabled]);

  const handleTest = useCallback(async () => {
    setTesting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/telemetry/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          endpoint: endpoint || undefined,
          apiToken: apiToken || undefined,
        }),
      });

      const data = await res.json();
      const statusInfo = data.status ? ` [HTTP ${data.status}]` : '';
      if (data.ok) {
        setSuccess(`${data.message || 'Connection OK'}${statusInfo}`);
        setTimeout(() => setSuccess(null), 5000);
      } else {
        const detail = data.detail ? `\n${data.detail}` : '';
        setError(`${data.message || 'Test failed'}${statusInfo}${detail}`);
      }
    } catch {
      setError('Network error');
    } finally {
      setTesting(false);
    }
  }, [endpoint, apiToken]);

  if (loading) {
    return (
      <div className="min-w-0">
        <div className="px-3 py-2 bg-surface-2 rounded-lg text-xs text-gray-500 animate-pulse">
          Loading…
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <div className="space-y-3">
        {/* Enable toggle */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={e => { setEnabled(e.target.checked); setDirty(true); }}
            className="w-4 h-4 rounded border-surface-4 text-brand-600 focus:ring-brand-200"
          />
          <span className="text-sm text-gray-700">Enable OpenTelemetry export</span>
        </label>

        {enabled && (
          <>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Dynatrace OTLP Endpoint</label>
              <input
                type="url"
                value={endpoint}
                onChange={e => { setEndpoint(e.target.value); setDirty(true); }}
                placeholder="https://<env-id>.live.dynatrace.com/api/v2/otlp"
                className="w-full px-3 py-2 text-sm border border-surface-3 rounded-lg
                           focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400
                           bg-surface-1 transition-all"
              />
              <p className="text-[10px] text-gray-400 mt-1">
                SaaS: https://&lt;env-id&gt;.live.dynatrace.com/api/v2/otlp
              </p>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">
                API Token
                {hasToken && !apiToken && (
                  <span className="ml-1 text-green-600">(configured)</span>
                )}
              </label>
              <input
                type="password"
                value={apiToken}
                onChange={e => { setApiToken(e.target.value); setDirty(true); }}
                placeholder={hasToken ? '••••••••  (leave empty to keep current)' : 'dt0c01.••••••••'}
                className="w-full px-3 py-2 text-sm border border-surface-3 rounded-lg
                           focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400
                           bg-surface-1 transition-all"
              />
              <p className="text-[10px] text-gray-400 mt-1">
                Requires scopes: openTelemetryTrace.ingest, metrics.ingest
              </p>
            </div>
          </>
        )}

        {/* Status messages */}
        {error && (
          <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg break-words">{error}</p>
        )}
        {success && (
          <p className="text-xs text-green-600 bg-green-50 px-3 py-2 rounded-lg break-words">{success}</p>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving || (!dirty && !apiToken)}
            className="flex-1 px-2.5 py-1.5 text-xs font-medium bg-brand-600 text-white rounded-lg
                       hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>

          {enabled && hasToken && (
            <button
              onClick={handleTest}
              disabled={testing}
              className="px-2.5 py-1.5 text-xs font-medium border border-surface-3 text-gray-500 rounded-lg
                         hover:bg-surface-2 hover:text-gray-700 transition-all disabled:opacity-40"
            >
              {testing ? 'Testing…' : 'Test connection'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Right Panel ──────────────────────────────────────────────

export function RightPanel() {
  const mcpConnected = useChatStore(s => s.mcpConnected);
  const dtctlInfo = useChatStore(s => s.dtctlInfo);
  const isAuthenticated = dtctlInfo?.installed && dtctlInfo?.authenticated;

  return (
    <aside className="w-64 border-l border-surface-3 bg-white flex flex-col shrink-0 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 space-y-1 min-w-0">
        <ModelSelector />
        <Section
          title="Dynatrace MCP"
          defaultOpen={!mcpConnected}
          badge={mcpConnected ? <span className="w-2 h-2 rounded-full bg-dt-green animate-pulse" /> : undefined}
        >
          <DynatraceConfig />
        </Section>
        <Section
          title="dtctl CLI"
          defaultOpen={!isAuthenticated}
          badge={isAuthenticated ? <span className="w-2 h-2 rounded-full bg-dt-green animate-pulse" /> : undefined}
        >
          <DtctlPanel />
        </Section>
        <Section title="Observability" defaultOpen={false}>
          <ObservabilityConfig />
        </Section>
      </div>
    </aside>
  );
}
