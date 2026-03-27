import { useState, useCallback, useRef } from 'react';
import { useChatStore } from '../stores/chat';
import { PREDEFINED_PROMPTS } from '../../../shared/src/index';
import type { ContextFile, ContextBudget } from '../../../shared/src/index';

// ─── Prompts Section ──────────────────────────────────────────

function PromptsSection({ onSelect }: { onSelect: (text: string) => void }) {
  const categories = [...new Set(PREDEFINED_PROMPTS.map(p => p.category))];

  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
        Quick Prompts
      </h3>
      {categories.map(cat => (
        <div key={cat} className="mb-4">
          <p className="text-xs font-medium text-gray-500 mb-2">{cat}</p>
          <div className="space-y-1.5">
            {PREDEFINED_PROMPTS.filter(p => p.category === cat).map(prompt => (
              <button
                key={prompt.id}
                onClick={() => onSelect(prompt.text)}
                className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-700
                           hover:bg-brand-50 hover:text-brand-700 transition-colors
                           flex items-center gap-2 group"
              >
                <span className="text-base">{prompt.icon}</span>
                <span className="truncate group-hover:text-brand-700">{prompt.label}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Context Files Section ────────────────────────────────────

function ContextSection() {
  const contextFiles = useChatStore(s => s.contextFiles);
  const setContextFiles = useChatStore(s => s.setContextFiles);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removingFile, setRemovingFile] = useState<string | null>(null);
  const [budget, setBudget] = useState<ContextBudget | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/context/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Upload failed');
        return;
      }

      if (data.budget) setBudget(data.budget);

      // Refresh the full file list from server
      const payloadRes = await fetch('/api/context/payload', { credentials: 'include' });
      if (payloadRes.ok) {
        const payload = await payloadRes.json();
        setContextFiles(payload.files as ContextFile[]);
        if (payload.budget) setBudget(payload.budget);
      }
    } catch {
      setError('Network error — could not upload file');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [setContextFiles]);

  const handleRemove = useCallback(async (name: string) => {
    setRemovingFile(name);
    setError(null);

    try {
      const res = await fetch(`/api/context/files/${encodeURIComponent(name)}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to remove file');
        return;
      }

      if (data.budget) setBudget(data.budget);

      // Refresh file list from server to stay in sync
      const payloadRes = await fetch('/api/context/payload', { credentials: 'include' });
      if (payloadRes.ok) {
        const payload = await payloadRes.json();
        setContextFiles(payload.files as ContextFile[]);
        if (payload.budget) setBudget(payload.budget);
      }
    } catch {
      setError('Network error — could not remove file');
    } finally {
      setRemovingFile(null);
    }
  }, [setContextFiles]);

  const handleClearAll = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/context/files', {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        setContextFiles([]);
        const data = await res.json();
        if (data.budget) setBudget(data.budget);
      }
    } catch {
      setError('Network error — could not clear files');
    }
  }, [setContextFiles]);

  const budgetPercent = budget?.usedPercent ?? 0;
  const budgetColor = budgetPercent > 80 ? 'bg-red-500' : budgetPercent > 50 ? 'bg-yellow-500' : 'bg-brand-500';

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Context Files
        </h3>
        {contextFiles.length > 0 && (
          <button
            onClick={handleClearAll}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors"
            title="Clear all files"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2">
          <span className="shrink-0 mt-0.5">⚠️</span>
          <div className="flex-1">
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-2 text-red-400 hover:text-red-600"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Context budget bar */}
      {budget && budget.usedBytes > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
            <span>{budget.fileCount}/{budget.maxFileCount} files</span>
            <span>{(budget.usedBytes / 1024).toFixed(0)}KB / {(budget.maxBytes / 1024 / 1024).toFixed(0)}MB</span>
          </div>
          <div className="w-full h-1.5 bg-surface-3 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${budgetColor}`}
              style={{ width: `${Math.min(budgetPercent, 100)}%` }}
            />
          </div>
          {budgetPercent > 80 && (
            <p className="text-xs text-amber-600 mt-1">
              Context is {budgetPercent}% full. Large context may reduce response quality.
            </p>
          )}
        </div>
      )}

      {contextFiles.length > 0 && (
        <div className="space-y-1.5 mb-3">
          {contextFiles.map(file => (
            <div
              key={file.name}
              className="flex items-center justify-between px-3 py-2 bg-surface-2 rounded-lg text-sm group"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-brand-500">📄</span>
                <span className="truncate text-gray-700" title={file.name}>{file.name}</span>
                <span className="text-xs text-gray-400 shrink-0">
                  {file.size < 1024
                    ? `${file.size}B`
                    : `${(file.size / 1024).toFixed(1)}KB`}
                </span>
              </div>
              <button
                onClick={() => handleRemove(file.name)}
                disabled={removingFile === file.name}
                className="text-gray-400 hover:text-red-500 transition-colors ml-2 shrink-0
                           disabled:opacity-50 disabled:cursor-not-allowed"
                title="Remove file"
              >
                {removingFile === file.name ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" className="animate-spin" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="16" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        onChange={handleUpload}
        accept=".json,.txt,.yaml,.yml,.csv,.md,.log,.xml,.toml,.env,.ini,.conf,.cfg,.properties,.sh,.bash,.py,.js,.ts,.html,.css,.sql,.graphql,.proto,.tf"
        className="hidden"
      />

      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-dashed
                   border-surface-4 rounded-lg text-sm text-gray-500 hover:text-brand-600
                   hover:border-brand-300 hover:bg-brand-50 transition-all disabled:opacity-50"
      >
        {uploading ? (
          <span className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" className="animate-spin" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="16" />
            </svg>
            Uploading...
          </span>
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
            </svg>
            Upload file
          </>
        )}
      </button>
    </div>
  );
}

// ─── Left Panel ───────────────────────────────────────────────

export function LeftPanel() {
  const sendMessage = useChatStore(s => s.sendMessage);
  const isStreaming = useChatStore(s => s.isStreaming);

  const handlePromptSelect = useCallback((text: string) => {
    if (!isStreaming) {
      sendMessage(text);
    }
  }, [isStreaming, sendMessage]);

  return (
    <aside className="w-72 border-r border-surface-3 bg-white flex flex-col shrink-0 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <PromptsSection onSelect={handlePromptSelect} />
        <div className="border-t border-surface-3 pt-4">
          <ContextSection />
        </div>
      </div>
    </aside>
  );
}
