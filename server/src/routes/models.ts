import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { sessionStore } from '../services/session.js';

export async function modelsRoutes(app: FastifyInstance) {
  app.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const sessionId = req.cookies.session;
    if (!sessionId) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }

    const token = sessionStore.getToken(sessionId);
    const provider = sessionStore.getProvider(sessionId);
    if (!token || !provider) {
      return reply.status(401).send({ error: 'Session expired' });
    }

    try {
      if (provider === 'anthropic') {
        // ── Anthropic Models API ────────────────────────────
        const res = await fetch('https://api.anthropic.com/v1/models', {
          headers: {
            'x-api-key': token,
            'anthropic-version': '2023-06-01',
          },
        });

        if (!res.ok) {
          const text = await res.text();
          return reply.status(res.status).send({ error: `Anthropic API error: ${res.status}`, detail: text });
        }

        const data = await res.json() as { data?: Array<{ id: string; display_name?: string; type?: string }> };
        const models = (data.data ?? []).map(m => ({
          id: m.id,
          name: m.display_name ?? m.id,
          version: undefined,
          capabilities: undefined,
        }));

        return reply.send({ models });
      }

      // ── GitHub Copilot Models API ─────────────────────────
      const res = await fetch('https://api.githubcopilot.com/models', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Copilot-Integration-Id': 'vscode-chat',
          'Editor-Version': 'vscode/1.96.0',
          'Editor-Plugin-Version': 'copilot-chat/0.24.0',
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        const text = await res.text();
        return reply.status(res.status).send({ error: `GitHub API error: ${res.status}`, detail: text });
      }

      const data = await res.json() as { data?: Array<{ id: string; name?: string; version?: string; capabilities?: Record<string, unknown> }> };
      const models = (data.data ?? []).map(m => ({
        id: m.id,
        name: m.name ?? m.id,
        version: m.version,
        capabilities: m.capabilities,
      }));

      return reply.send({ models });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      return reply.status(500).send({ error: msg });
    }
  });
}
