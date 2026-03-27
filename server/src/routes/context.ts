import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { sessionStore } from '../services/session.js';
import type { ContextFile, ContextBudget } from '../../../shared/src/index.js';

// In-memory context store per session
const contextStore = new Map<string, ContextFile[]>();

// ─── Context limits ─────────────────────────────────────────
const MAX_FILE_SIZE = 5 * 1024 * 1024;        // 5 MB per file
const MAX_TOTAL_CONTEXT_BYTES = 12 * 1024 * 1024; // 12 MB total (~3M tokens budget)
const MAX_FILE_COUNT = 20;

const ALLOWED_EXTENSIONS = new Set([
  'json', 'txt', 'yaml', 'yml', 'csv', 'md', 'log', 'xml', 'toml',
  'env', 'ini', 'conf', 'cfg', 'properties', 'sh', 'bash', 'py',
  'js', 'ts', 'html', 'css', 'sql', 'graphql', 'proto', 'tf',
  'dockerfile', 'makefile',
]);

function isTextContent(buffer: Buffer): boolean {
  // Check first 8KB for null bytes — binary files typically contain them
  const sample = buffer.subarray(0, 8192);
  for (let i = 0; i < sample.length; i++) {
    if (sample[i] === 0) return false;
  }
  return true;
}

function getSessionBudget(sessionId: string): ContextBudget {
  const files = contextStore.get(sessionId) ?? [];
  const usedBytes = files.reduce((sum, f) => sum + f.size, 0);
  return {
    usedBytes,
    maxBytes: MAX_TOTAL_CONTEXT_BYTES,
    usedPercent: Math.round((usedBytes / MAX_TOTAL_CONTEXT_BYTES) * 100),
    fileCount: files.length,
    maxFileCount: MAX_FILE_COUNT,
  };
}

export async function contextRoutes(app: FastifyInstance) {
  // ─── Upload context file ──────────────────────────────────
  app.post('/upload', async (req: FastifyRequest, reply: FastifyReply) => {
    const sessionId = req.cookies.session;
    if (!sessionId || !sessionStore.get(sessionId)) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }

    const file = await req.file();
    if (!file) {
      return reply.status(400).send({ error: 'No file provided' });
    }

    // Validate by extension
    const ext = file.filename.split('.').pop()?.toLowerCase() ?? '';
    const baseName = file.filename.split('.')[0]?.toLowerCase() ?? '';
    const isAllowed = ALLOWED_EXTENSIONS.has(ext) ||
      ALLOWED_EXTENSIONS.has(baseName); // handles "Dockerfile", "Makefile"

    if (!isAllowed) {
      return reply.status(400).send({
        error: `Unsupported file type ".${ext}". Supported: ${[...ALLOWED_EXTENSIONS].join(', ')}`,
      });
    }

    const buffer = await file.toBuffer();

    // Validate file size
    if (buffer.length > MAX_FILE_SIZE) {
      return reply.status(400).send({
        error: `File too large (${(buffer.length / 1024 / 1024).toFixed(1)}MB). Maximum is ${MAX_FILE_SIZE / 1024 / 1024}MB.`,
      });
    }

    // Reject binary files
    if (!isTextContent(buffer)) {
      return reply.status(400).send({
        error: 'File appears to be binary. Only text-based files are supported.',
      });
    }

    // Check file count limit
    const existing = contextStore.get(sessionId) ?? [];
    if (existing.length >= MAX_FILE_COUNT) {
      return reply.status(400).send({
        error: `Maximum ${MAX_FILE_COUNT} files allowed. Remove some files first.`,
      });
    }

    // Check total size budget
    const currentTotal = existing.reduce((sum, f) => sum + f.size, 0);
    if (currentTotal + buffer.length > MAX_TOTAL_CONTEXT_BYTES) {
      const remainingMB = ((MAX_TOTAL_CONTEXT_BYTES - currentTotal) / 1024 / 1024).toFixed(1);
      return reply.status(400).send({
        error: `Adding this file would exceed the context budget. Remaining space: ${remainingMB}MB. Remove some files or use smaller files.`,
      });
    }

    // Check for duplicate filename — replace if exists
    const filtered = existing.filter(f => f.name !== file.filename);

    const content = buffer.toString('utf-8');

    const contextFile: ContextFile = {
      name: file.filename,
      content,
      type: file.mimetype,
      size: buffer.length,
    };

    filtered.push(contextFile);
    contextStore.set(sessionId, filtered);

    const budget = getSessionBudget(sessionId);

    return reply.send({
      ok: true,
      file: { name: contextFile.name, type: contextFile.type, size: contextFile.size },
      totalFiles: filtered.length,
      budget,
    });
  });

  // ─── Get current context files ────────────────────────────
  app.get('/files', async (req: FastifyRequest, reply: FastifyReply) => {
    const sessionId = req.cookies.session;
    if (!sessionId || !sessionStore.get(sessionId)) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }

    const files = (contextStore.get(sessionId) ?? []).map(f => ({
      name: f.name,
      type: f.type,
      size: f.size,
    }));

    return reply.send({ files, budget: getSessionBudget(sessionId) });
  });

  // ─── Get full context (for chat) ──────────────────────────
  app.get('/payload', async (req: FastifyRequest, reply: FastifyReply) => {
    const sessionId = req.cookies.session;
    if (!sessionId || !sessionStore.get(sessionId)) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }

    return reply.send({
      files: contextStore.get(sessionId) ?? [],
      budget: getSessionBudget(sessionId),
    });
  });

  // ─── Remove a context file ───────────────────────────────
  app.delete<{ Params: { name: string } }>(
    '/files/:name',
    async (req: FastifyRequest<{ Params: { name: string } }>, reply: FastifyReply) => {
      const sessionId = req.cookies.session;
      if (!sessionId || !sessionStore.get(sessionId)) {
        return reply.status(401).send({ error: 'Not authenticated' });
      }

      const targetName = decodeURIComponent(req.params.name);
      const files = contextStore.get(sessionId) ?? [];
      const filtered = files.filter(f => f.name !== targetName);

      if (filtered.length === files.length) {
        return reply.status(404).send({ error: 'File not found' });
      }

      contextStore.set(sessionId, filtered);

      return reply.send({ ok: true, totalFiles: filtered.length, budget: getSessionBudget(sessionId) });
    },
  );

  // ─── Clear all context ────────────────────────────────────
  app.delete('/files', async (req: FastifyRequest, reply: FastifyReply) => {
    const sessionId = req.cookies.session;
    if (!sessionId || !sessionStore.get(sessionId)) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }

    contextStore.delete(sessionId);
    return reply.send({ ok: true, budget: getSessionBudget(sessionId) });
  });

  // ─── Get context budget info ──────────────────────────────
  app.get('/budget', async (req: FastifyRequest, reply: FastifyReply) => {
    const sessionId = req.cookies.session;
    if (!sessionId || !sessionStore.get(sessionId)) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }

    return reply.send(getSessionBudget(sessionId));
  });
}
