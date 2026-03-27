import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyCookie from '@fastify/cookie';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'url';
import path from 'path';
import { authRoutes } from './routes/auth.js';
import { chatRoutes } from './routes/chat.js';
import { dynatraceRoutes } from './routes/dynatrace.js';
import { contextRoutes } from './routes/context.js';
import { dtctlRoutes } from './routes/dtctl.js';
import { telemetryRoutes } from './routes/telemetry.js';
import { modelsRoutes } from './routes/models.js';
import { env } from './config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      transport: env.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' } }
        : undefined,
    },
  });

  // ─── Plugins ──────────────────────────────────────────────
  await app.register(fastifyCors, {
    origin: env.NODE_ENV === 'development' ? 'http://localhost:5173' : true,
    credentials: true,
  });

  await app.register(fastifyCookie, {
    secret: env.COOKIE_SECRET,
  });

  await app.register(fastifyMultipart, {
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  });

  // ─── API Routes ───────────────────────────────────────────
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(chatRoutes, { prefix: '/api/chat' });
  await app.register(dynatraceRoutes, { prefix: '/api/dynatrace' });
  await app.register(contextRoutes, { prefix: '/api/context' });
  await app.register(dtctlRoutes, { prefix: '/api/dtctl' });
  await app.register(telemetryRoutes, { prefix: '/api/telemetry' });
  await app.register(modelsRoutes, { prefix: '/api/models' });

  // ─── Static files (production) ────────────────────────────
  if (env.NODE_ENV === 'production') {
    // In production Docker, structure is /app/client/dist and /app/server/dist/server/src/
    // Resolve from process.cwd() which is /app in Docker
    const clientDist = path.resolve(process.cwd(), 'client/dist');
    await app.register(fastifyStatic, {
      root: clientDist,
      prefix: '/',
    });

    app.setNotFoundHandler((_req, reply) => {
      reply.sendFile('index.html');
    });
  }

  // ─── Health check ─────────────────────────────────────────
  app.get('/api/health', async () => ({ status: 'ok', timestamp: Date.now() }));

  return app;
}
