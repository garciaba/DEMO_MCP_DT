import crypto from 'crypto';

function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key] ?? defaultValue;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const env = {
  NODE_ENV: getEnv('NODE_ENV', 'development'),
  PORT: parseInt(getEnv('PORT', '3001'), 10),
  LOG_LEVEL: getEnv('LOG_LEVEL', 'info'),

  // GitHub OAuth
  GITHUB_CLIENT_ID: getEnv('GITHUB_CLIENT_ID', ''),
  GITHUB_CLIENT_SECRET: getEnv('GITHUB_CLIENT_SECRET', ''),

  // Cookie signing
  COOKIE_SECRET: getEnv('COOKIE_SECRET', crypto.randomBytes(32).toString('hex')),
} as const;
