import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { sessionStore } from '../services/session.js';
import { getMCPClient, removeMCPClient } from '../services/mcp-client.js';

/**
 * Dynatrace MCP Server routes.
 * Connects to the Dynatrace MCP Server, lists tools, and manages connection.
 */
export async function dynatraceRoutes(app: FastifyInstance) {
  // ─── Connect to Dynatrace MCP Server ──────────────────────
  app.post<{ Body: { mcpServerUrl: string; bearerToken: string } }>(
    '/connect',
    async (req: FastifyRequest<{ Body: { mcpServerUrl: string; bearerToken: string } }>, reply: FastifyReply) => {
      const sessionId = req.cookies.session;
      if (!sessionId || !sessionStore.get(sessionId)) {
        return reply.status(401).send({ error: 'Not authenticated' });
      }

      const { mcpServerUrl, bearerToken } = req.body;

      // Validate URL format
      try {
        new URL(mcpServerUrl);
      } catch {
        return reply.status(400).send({ error: 'Invalid MCP Server URL' });
      }

      try {
        const client = getMCPClient(sessionId, mcpServerUrl, bearerToken);

        // Initialize and fetch tools
        await client.initialize();
        const tools = await client.listTools();

        return reply.send({
          connected: true,
          tools: tools.map(t => ({ name: t.name, description: t.description })),
          toolCount: tools.length,
        });
      } catch (err) {
        removeMCPClient(sessionId);
        const message = err instanceof Error ? err.message : 'Connection failed';
        req.log.error({ err }, 'MCP connection failed');
        return reply.status(400).send({ error: message });
      }
    },
  );

  // ─── List available MCP tools ─────────────────────────────
  app.post<{ Body: { mcpServerUrl: string; bearerToken: string } }>(
    '/tools',
    async (req: FastifyRequest<{ Body: { mcpServerUrl: string; bearerToken: string } }>, reply: FastifyReply) => {
      const sessionId = req.cookies.session;
      if (!sessionId || !sessionStore.get(sessionId)) {
        return reply.status(401).send({ error: 'Not authenticated' });
      }

      const { mcpServerUrl, bearerToken } = req.body;

      try {
        const client = getMCPClient(sessionId, mcpServerUrl, bearerToken);
        if (!client.isInitialized()) {
          await client.initialize();
        }
        const tools = await client.listTools();
        return reply.send({ tools });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to list tools';
        return reply.status(502).send({ error: message });
      }
    },
  );

  // ─── Disconnect ───────────────────────────────────────────
  app.post('/disconnect', async (req: FastifyRequest, reply: FastifyReply) => {
    const sessionId = req.cookies.session;
    if (sessionId) {
      removeMCPClient(sessionId);
    }
    return reply.send({ ok: true });
  });
}
