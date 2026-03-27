import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { sessionStore } from '../services/session.js';
import { getTelemetryConfig, reconfigureTelemetry } from '../telemetry.js';
import type { TelemetryConfig } from '../telemetry.js';

export async function telemetryRoutes(app: FastifyInstance) {
  // ─── Get current telemetry config ──────────────────────────
  app.get('/config', async (req: FastifyRequest, reply: FastifyReply) => {
    const sessionId = req.cookies.session;
    if (!sessionId || !sessionStore.get(sessionId)) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }

    const config = getTelemetryConfig();
    // Mask the token for display
    return reply.send({
      endpoint: config.endpoint,
      apiToken: config.apiToken ? `${config.apiToken.slice(0, 12)}${'•'.repeat(8)}` : '',
      hasToken: !!config.apiToken,
      enabled: config.enabled,
    });
  });

  // ─── Update telemetry config ───────────────────────────────
  app.post<{ Body: { endpoint: string; apiToken: string; enabled: boolean } }>(
    '/config',
    async (
      req: FastifyRequest<{ Body: { endpoint: string; apiToken: string; enabled: boolean } }>,
      reply: FastifyReply,
    ) => {
      const sessionId = req.cookies.session;
      if (!sessionId || !sessionStore.get(sessionId)) {
        return reply.status(401).send({ error: 'Not authenticated' });
      }

      const { endpoint, apiToken, enabled } = req.body;

      // If apiToken is empty, keep the existing one
      const effectiveToken = apiToken || getTelemetryConfig().apiToken;

      // Basic validation
      if (enabled) {
        if (!endpoint) {
          return reply.status(400).send({ error: 'OTLP endpoint is required when telemetry is enabled' });
        }
        if (!effectiveToken) {
          return reply.status(400).send({ error: 'API token is required when telemetry is enabled' });
        }
        try {
          new URL(endpoint);
        } catch {
          return reply.status(400).send({ error: 'Invalid endpoint URL' });
        }
      }

      const config: TelemetryConfig = { endpoint: endpoint.replace(/\/+$/, ''), apiToken: effectiveToken, enabled };
      reconfigureTelemetry(config);

      const updated = getTelemetryConfig();
      return reply.send({
        ok: true,
        endpoint: updated.endpoint,
        hasToken: !!updated.apiToken,
        enabled: updated.enabled,
      });
    },
  );

  // ─── Test telemetry connection ─────────────────────────────
  app.post<{ Body?: { endpoint?: string; apiToken?: string } }>(
    '/test',
    async (
      req: FastifyRequest<{ Body?: { endpoint?: string; apiToken?: string } }>,
      reply: FastifyReply,
    ) => {
      const sessionId = req.cookies.session;
      if (!sessionId || !sessionStore.get(sessionId)) {
        return reply.status(401).send({ error: 'Not authenticated' });
      }

      // Use values from request body if provided, otherwise fall back to saved config
      const saved = getTelemetryConfig();
      const testEndpoint = (req.body?.endpoint || saved.endpoint || '').replace(/\/+$/, '');
      const testToken = req.body?.apiToken || saved.apiToken || '';

      if (!testEndpoint || !testToken) {
        return reply.status(400).send({ error: 'Endpoint and API token are required for testing' });
      }

    // Connectivity + auth test — POST empty body to the OTLP traces endpoint
    try {
      const res = await fetch(`${testEndpoint}/v1/traces`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-protobuf',
          Authorization: `Api-Token ${testToken}`,
        },
        body: new Uint8Array(0),
      });

      const bodyText = await res.text().catch(() => '');

      // 2xx or 4xx (except 401/403) = reachable & auth OK (empty body causes 400/415 which is fine)
      if (res.status === 401 || res.status === 403) {
        return reply.send({
          ok: false,
          status: res.status,
          message: `Authentication failed (HTTP ${res.status}) — check your API token and scopes (openTelemetryTrace.ingest)`,
          detail: bodyText.slice(0, 300),
        });
      } else if (res.status >= 200 && res.status < 500) {
        // Any non-5xx, non-auth-failure = endpoint is reachable and token is accepted
        return reply.send({
          ok: true,
          status: res.status,
          message: `Connection successful (HTTP ${res.status})`,
        });
      } else {
        return reply.send({
          ok: false,
          status: res.status,
          message: `Server error (HTTP ${res.status})`,
          detail: bodyText.slice(0, 300),
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection failed';
      return reply.send({ ok: false, status: 0, message: `Connection failed: ${msg}` });
    }
  });
}
