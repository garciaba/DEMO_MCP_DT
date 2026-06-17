import type { FastifyInstance } from 'fastify';
import { nanoid } from 'nanoid';
import { env } from '../config/env.js';
import { sessionStore } from '../services/session.js';
import type { GitHubUser } from '../../../shared/src/index.js';

export async function authRoutes(app: FastifyInstance) {
  // ─── Anthropic API Key Login ──────────────────────────────
  app.post<{ Body: { apiKey: string } }>('/anthropic-login', async (req, reply) => {
    const { apiKey } = req.body ?? {};
    if (!apiKey || typeof apiKey !== 'string' || !apiKey.startsWith('sk-ant-')) {
      return reply.status(400).send({ error: 'A valid Anthropic API key is required (starts with sk-ant-).' });
    }

    // Validate the API key by calling the Anthropic models endpoint
    try {
      const res = await fetch('https://api.anthropic.com/v1/models', {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
      });

      if (!res.ok) {
        const errText = await res.text();
        req.log.error({ status: res.status, body: errText }, 'Anthropic API key validation failed');
        return reply.status(401).send({ error: 'Invalid Anthropic API key.' });
      }

      // Create session
      const sessionId = nanoid(32);
      sessionStore.set(sessionId, {
        provider: 'anthropic',
        anthropicApiKey: apiKey,
        anthropicUser: { name: 'Anthropic User' },
        createdAt: Date.now(),
      });

      reply.setCookie('session', sessionId, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 8 * 60 * 60, // 8 hours
      });

      return reply.send({
        status: 'complete',
        provider: 'anthropic',
        anthropicUser: { name: 'Anthropic User' },
      });
    } catch (err) {
      req.log.error({ err }, 'Anthropic login error');
      return reply.status(502).send({ error: 'Failed to validate Anthropic API key.' });
    }
  });

  // ─── Start Device Flow ────────────────────────────────────
  app.post<{ Body: { client_id?: string } }>('/device-code', async (req, reply) => {
    const clientId = req.body?.client_id || env.GITHUB_CLIENT_ID;
    if (!clientId) {
      return reply.status(400).send({ error: 'GitHub Client ID is required.' });
    }

    const res = await fetch('https://github.com/login/device/code', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        scope: 'read:user copilot',
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      req.log.error({ status: res.status, body: errBody }, 'GitHub device flow failed');
      return reply.status(502).send({ error: `GitHub API error (${res.status}): ${errBody}` });
    }

    const data = await res.json();
    // GitHub may return 200 with an error field
    if (data.error) {
      req.log.error({ error: data.error, description: data.error_description }, 'GitHub device flow error');
      return reply.status(400).send({ error: data.error_description || data.error });
    }
    return reply.send(data);
  });

  // ─── Poll for token ───────────────────────────────────────
  app.post<{ Body: { device_code: string; client_id?: string } }>('/poll-token', async (req, reply) => {
    const { device_code, client_id } = req.body;
    const clientId = client_id || env.GITHUB_CLIENT_ID;

    req.log.info({ device_code: device_code?.substring(0, 8) + '...', clientId: clientId?.substring(0, 8) + '...' }, 'Polling GitHub for token');

    const res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        device_code,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
    });

    const data = await res.json() as Record<string, unknown>;
    req.log.info({ response: Object.keys(data), error: data.error }, 'GitHub poll response');

    if (data.error === 'authorization_pending') {
      return reply.send({ status: 'pending' });
    }

    if (data.error === 'slow_down') {
      return reply.send({ status: 'slow_down' });
    }

    if (data.error) {
      return reply.status(400).send({ status: 'error', error: data.error });
    }

    const accessToken = data.access_token as string;

    // Fetch user info
    const userRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userRes.ok) {
      return reply.status(502).send({ error: 'Failed to fetch GitHub user' });
    }

    const user = await userRes.json() as GitHubUser;

    // Create session
    const sessionId = nanoid(32);
    sessionStore.set(sessionId, {
      provider: 'github',
      githubToken: accessToken,
      user,
      createdAt: Date.now(),
    });

    reply.setCookie('session', sessionId, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 8 * 60 * 60, // 8 hours
    });

    return reply.send({ status: 'complete', user });
  });

  // ─── Check current session ────────────────────────────────
  app.get('/status', async (req, reply) => {
    const sessionId = req.cookies.session;
    if (!sessionId) {
      return reply.send({ authenticated: false });
    }

    const session = sessionStore.get(sessionId);
    if (!session) {
      reply.clearCookie('session', { path: '/' });
      return reply.send({ authenticated: false });
    }

    return reply.send({
      authenticated: true,
      provider: session.provider,
      user: session.user,
      anthropicUser: session.anthropicUser,
    });
  });

  // ─── Logout ───────────────────────────────────────────────
  app.post('/logout', async (req, reply) => {
    const sessionId = req.cookies.session;
    if (sessionId) {
      sessionStore.delete(sessionId);
      reply.clearCookie('session', { path: '/' });
    }
    return reply.send({ ok: true });
  });
}
