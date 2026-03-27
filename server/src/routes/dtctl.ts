import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { sessionStore } from '../services/session.js';
import {
  isDtctlInstalled,
  ensureDtctlInstalled,
  getDtctlContextInfo,
  runDtctl,
  isWriteVerb,
  dtctlLogin,
  dtctlLogout,
} from '../services/dtctl.js';

/**
 * dtctl REST routes — status, context, and ad-hoc command execution.
 */
export async function dtctlRoutes(app: FastifyInstance) {
  // ─── Check dtctl installation & context ────────────────────
  app.get('/status', async (req: FastifyRequest, reply: FastifyReply) => {
    const sessionId = req.cookies.session;
    if (!sessionId || !sessionStore.get(sessionId)) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }

    const info = await getDtctlContextInfo();
    return reply.send(info);
  });

  // ─── Auto-install dtctl binary ─────────────────────────────
  app.post('/install', async (req: FastifyRequest, reply: FastifyReply) => {
    const sessionId = req.cookies.session;
    if (!sessionId || !sessionStore.get(sessionId)) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }

    try {
      const binPath = await ensureDtctlInstalled();
      const info = await getDtctlContextInfo();
      return reply.send({ ok: true, binPath, ...info });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Installation failed';
      req.log.error({ err }, 'dtctl install failed');
      return reply.status(500).send({ ok: false, error: message });
    }
  });

  // ─── Execute a dtctl command (from the UI terminal) ────────
  app.post<{ Body: { command: string; confirmWrite?: boolean } }>(
    '/exec',
    async (
      req: FastifyRequest<{ Body: { command: string; confirmWrite?: boolean } }>,
      reply: FastifyReply,
    ) => {
      const sessionId = req.cookies.session;
      if (!sessionId || !sessionStore.get(sessionId)) {
        return reply.status(401).send({ error: 'Not authenticated' });
      }

      const { command, confirmWrite } = req.body;

      if (!command || typeof command !== 'string') {
        return reply.status(400).send({ error: 'Missing command' });
      }

      const installed = await isDtctlInstalled();
      if (!installed) {
        return reply.status(503).send({
          error: 'dtctl is not installed or not found in PATH. Install it: brew install dynatrace-oss/tap/dtctl',
        });
      }

      const needsConfirm = isWriteVerb(command);
      const result = await runDtctl(command, {
        confirmWrite: needsConfirm ? !!confirmWrite : undefined,
      });

      return reply.send({
        ...result,
        isWriteOperation: needsConfirm,
      });
    },
  );

  // ─── OAuth login via dtctl auth login ──────────────────────
  app.post<{ Body: { environmentUrl: string } }>(
    '/login',
    async (
      req: FastifyRequest<{ Body: { environmentUrl: string } }>,
      reply: FastifyReply,
    ) => {
      const sessionId = req.cookies.session;
      if (!sessionId || !sessionStore.get(sessionId)) {
        return reply.status(401).send({ error: 'Not authenticated' });
      }

      const { environmentUrl } = req.body;

      if (!environmentUrl || typeof environmentUrl !== 'string') {
        return reply.status(400).send({ error: 'Missing environmentUrl' });
      }

      // Validate URL format
      try {
        new URL(environmentUrl);
      } catch {
        return reply.status(400).send({ error: 'Invalid environment URL' });
      }

      const installed = await isDtctlInstalled();
      if (!installed) {
        return reply.status(503).send({
          error: 'dtctl is not installed or not found in PATH',
        });
      }

      req.log.info({ environmentUrl }, 'Starting dtctl OAuth login');

      const result = await dtctlLogin(environmentUrl);

      if (result.ok) {
        // Fetch updated context info after successful login
        const info = await getDtctlContextInfo();
        return reply.send({ ok: true, message: 'Login successful', context: info });
      } else {
        return reply.status(400).send({
          ok: false,
          error: result.stderr || 'Login failed',
          stdout: result.stdout,
        });
      }
    },
  );

  // ─── Logout ────────────────────────────────────────────────
  app.post('/logout', async (req: FastifyRequest, reply: FastifyReply) => {
    const sessionId = req.cookies.session;
    if (!sessionId || !sessionStore.get(sessionId)) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }

    const result = await dtctlLogout();
    return reply.send({ ok: result.ok, message: result.ok ? 'Logged out' : result.stderr });
  });
}
