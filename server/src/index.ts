import dotenv from 'dotenv';
import path from 'path';

// Load .env from project root (parent of server/)
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
// Also try project root if running from server/
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

// ⚠️ Telemetry MUST be imported before any other app module
// so OpenLLMetry can patch LLM libraries before they load.
import './telemetry.js';

import { buildApp } from './app.js';
import { env } from './config/env.js';

const start = async () => {
  const app = await buildApp();

  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    app.log.info(`Server running on http://localhost:${env.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
