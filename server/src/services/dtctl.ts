import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { pipeline } from 'stream/promises';
import { fileURLToPath } from 'url';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Binary management ─────────────────────────────────────────
const DTCTL_VERSION = 'v0.18.0';
const BIN_DIR = path.resolve(__dirname, '..', '..', 'bin');
const IS_WIN = process.platform === 'win32';
const DTCTL_BIN = path.join(BIN_DIR, IS_WIN ? 'dtctl.exe' : 'dtctl');

function getDownloadUrl(): string {
  const os = process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'darwin' : 'linux';
  const arch = process.arch === 'arm64' ? 'arm64' : 'amd64';
  const ext = process.platform === 'win32' ? 'zip' : 'tar.gz';
  return `https://github.com/dynatrace-oss/dtctl/releases/download/${DTCTL_VERSION}/dtctl_${DTCTL_VERSION.slice(1)}_${os}_${arch}.${ext}`;
}

let installing: Promise<void> | null = null;

/**
 * Resolve the dtctl binary path. Downloads if not present.
 */
export async function resolveDtctlBin(): Promise<string> {
  // Check local bin first
  if (fs.existsSync(DTCTL_BIN)) return DTCTL_BIN;
  // Check system PATH
  try {
    await execFileAsync(IS_WIN ? 'where' : 'which', ['dtctl'], { timeout: 5_000 });
    return 'dtctl'; // Found in PATH
  } catch { /* not in PATH */ }

  // Auto-download
  if (!installing) {
    installing = downloadDtctl();
  }
  await installing;
  installing = null;
  return DTCTL_BIN;
}

async function downloadDtctl(): Promise<void> {
  await fsp.mkdir(BIN_DIR, { recursive: true });
  const url = getDownloadUrl();
  console.log(`[dtctl] Downloading ${url} …`);

  const resp = await fetch(url, { redirect: 'follow' });
  if (!resp.ok || !resp.body) {
    throw new Error(`Failed to download dtctl: ${resp.status} ${resp.statusText}`);
  }

  if (IS_WIN) {
    // Download zip to temp, extract with PowerShell
    const zipPath = path.join(BIN_DIR, 'dtctl.zip');
    const ws = fs.createWriteStream(zipPath);
    await pipeline(resp.body, ws);

    await execFileAsync('powershell', [
      '-NoProfile', '-Command',
      `Expand-Archive -Force -Path '${zipPath}' -DestinationPath '${BIN_DIR}'`,
    ], { timeout: 60_000 });

    await fsp.unlink(zipPath).catch(() => {});
  } else {
    // tar.gz — pipe through tar
    const tarPath = path.join(BIN_DIR, 'dtctl.tar.gz');
    const ws = fs.createWriteStream(tarPath);
    await pipeline(resp.body, ws);

    await execFileAsync('tar', ['xzf', tarPath, '-C', BIN_DIR], { timeout: 60_000 });
    await fsp.unlink(tarPath).catch(() => {});
    await fsp.chmod(DTCTL_BIN, 0o755);
  }

  if (!fs.existsSync(DTCTL_BIN)) {
    throw new Error('dtctl binary not found after extraction');
  }
  console.log(`[dtctl] Installed to ${DTCTL_BIN}`);
}

/**
 * Helper: run dtctl with the resolved binary path.
 */
async function execDtctl(
  args: string[],
  opts?: { timeout?: number; env?: Record<string, string | undefined> },
): Promise<{ stdout: string; stderr: string }> {
  const bin = await resolveDtctlBin();
  return execFileAsync(bin, args, {
    timeout: opts?.timeout ?? 30_000,
    maxBuffer: 10 * 1024 * 1024,
    env: { ...process.env, NO_COLOR: '1', DTCTL_AGENT: '1', ...opts?.env },
  });
}

// ─── Allowed dtctl subcommands ─────────────────────────────────
// Only these top-level verbs are permitted. Prevents arbitrary command execution.
const ALLOWED_VERBS = new Set([
  'get', 'describe', 'create', 'edit', 'delete', 'apply', 'diff',
  'query', 'execute', 'logs', 'history', 'restore', 'share',
  'config', 'auth', 'doctor', 'commands', 'ctx', 'version',
  'exec', 'evaluate', 'verify',
]);

// Verbs that mutate state — require explicit user confirmation
const WRITE_VERBS = new Set([
  'create', 'edit', 'delete', 'apply', 'execute', 'restore',
]);

export interface DtctlResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface DtctlContextInfo {
  installed: boolean;
  version?: string;
  currentContext?: string;
  contextDescription?: string;
  whoami?: string;
  authenticated: boolean;
}

/**
 * Check whether dtctl is installed (locally or in PATH).
 */
export async function isDtctlInstalled(): Promise<boolean> {
  try {
    await resolveDtctlBin();
    return true;
  } catch {
    return false;
  }
}

/**
 * Install dtctl if not already present. Returns the binary path.
 */
export async function ensureDtctlInstalled(): Promise<string> {
  return resolveDtctlBin();
}

/**
 * Gather current dtctl context information for safety verification.
 */
export async function getDtctlContextInfo(): Promise<DtctlContextInfo> {
  const info: DtctlContextInfo = { installed: false, authenticated: false };

  try {
    const versionRes = await execDtctl(['version'], { timeout: 10_000 });
    info.installed = true;
    info.version = versionRes.stdout.trim();
  } catch {
    return info;
  }

  try {
    const ctxRes = await execDtctl(['config', 'current-context'], { timeout: 10_000 });
    info.currentContext = ctxRes.stdout.trim();
  } catch { /* no context configured */ }

  if (info.currentContext) {
    try {
      const descRes = await execDtctl(
        ['config', 'describe-context', info.currentContext],
        { timeout: 10_000 },
      );
      info.contextDescription = descRes.stdout.trim();

      // Check if the context has a token reference — means it's configured
      if (info.contextDescription.includes('Token-Ref:') || info.contextDescription.includes('OAuth')) {
        info.authenticated = true;
      }
    } catch { /* ignore */ }

    // Try doctor to verify connectivity
    try {
      const doctorRes = await execDtctl(['doctor'], { timeout: 15_000 });
      const output = doctorRes.stdout + doctorRes.stderr;
      // If doctor explicitly reports auth failure, mark as not authenticated
      if (output.toLowerCase().includes('fail') && output.toLowerCase().includes('auth')) {
        info.authenticated = false;
      }
    } catch {
      info.authenticated = false;
    }
  }

  try {
    const whoamiRes = await execDtctl(['auth', 'whoami'], { timeout: 10_000 });
    info.whoami = whoamiRes.stdout.trim();
  } catch (err) {
    const execErr = err as { stderr?: string };
    if (execErr.stderr?.includes('401')) {
      info.whoami = '(token auth — whoami unavailable)';
    }
  }

  return info;
}

/**
 * Parse a dtctl command string into verb + args, validate safety.
 */
function parseCommand(command: string): { verb: string; args: string[] } {
  // Trim the "dtctl" prefix if present
  const cleaned = command.replace(/^\s*dtctl\s+/, '').trim();
  const parts = shellSplit(cleaned);
  const verb = parts[0]?.toLowerCase() ?? '';
  return { verb, args: parts };
}

/**
 * Simple shell-like argument splitter that respects quoted strings.
 */
function shellSplit(input: string): string[] {
  const args: string[] = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
    } else if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
    } else if (ch === ' ' && !inSingle && !inDouble) {
      if (current) {
        args.push(current);
        current = '';
      }
    } else {
      current += ch;
    }
  }
  if (current) args.push(current);
  return args;
}

/**
 * Execute a dtctl command safely.
 *
 * @param command  Full dtctl command string (with or without "dtctl" prefix)
 * @param options  Execution options
 */
export async function runDtctl(
  command: string,
  options?: { timeout?: number; confirmWrite?: boolean },
): Promise<DtctlResult> {
  const { verb, args } = parseCommand(command);

  if (!verb) {
    return { ok: false, stdout: '', stderr: 'Empty command', exitCode: 1 };
  }

  if (!ALLOWED_VERBS.has(verb)) {
    return {
      ok: false,
      stdout: '',
      stderr: `Verb "${verb}" is not in the allowed list. Allowed: ${[...ALLOWED_VERBS].join(', ')}`,
      exitCode: 1,
    };
  }

  // Block write operations unless explicitly confirmed
  if (WRITE_VERBS.has(verb) && !options?.confirmWrite) {
    return {
      ok: false,
      stdout: '',
      stderr: `Write operation "${verb}" requires explicit user confirmation. Use dtctl diff first to preview changes.`,
      exitCode: 1,
    };
  }

  // Prevent shell-escape / injection via pipe, semicolons, backticks
  const forbidden = /[;|&`$(){}]/;
  for (const arg of args) {
    if (forbidden.test(arg) && !arg.startsWith("'") && !arg.startsWith('"')) {
      return {
        ok: false,
        stdout: '',
        stderr: `Argument contains forbidden characters: ${arg}`,
        exitCode: 1,
      };
    }
  }

  const timeout = options?.timeout ?? 60_000;

  try {
    const result = await execDtctl(args, { timeout });

    return {
      ok: true,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: 0,
    };
  } catch (err: unknown) {
    const execErr = err as { stdout?: string; stderr?: string; code?: number };
    return {
      ok: false,
      stdout: execErr.stdout ?? '',
      stderr: execErr.stderr ?? (err instanceof Error ? err.message : 'Unknown error'),
      exitCode: execErr.code ?? 1,
    };
  }
}

/**
 * Check whether a verb is a write operation.
 */
export function isWriteVerb(command: string): boolean {
  const { verb } = parseCommand(command);
  return WRITE_VERBS.has(verb);
}

/**
 * Derive a short context name from a Dynatrace environment URL.
 * e.g. "https://abc12345.apps.dynatrace.com" → "abc12345"
 */
function contextNameFromUrl(envUrl: string): string {
  try {
    const host = new URL(envUrl).hostname; // abc12345.apps.dynatrace.com
    return host.split('.')[0] || 'default';
  } catch {
    return 'default';
  }
}

/**
 * Authenticate to a Dynatrace environment via OAuth (browser SSO).
 * Runs: dtctl auth login --context <ctx> --environment <url>
 * This opens the default browser for SSO and blocks until the flow completes.
 */
export async function dtctlLogin(environmentUrl: string): Promise<DtctlResult> {
  // Validate URL
  try {
    new URL(environmentUrl);
  } catch {
    return { ok: false, stdout: '', stderr: 'Invalid environment URL', exitCode: 1 };
  }

  const ctx = contextNameFromUrl(environmentUrl);

  try {
    const result = await execDtctl(
      ['auth', 'login', '--context', ctx, '--environment', environmentUrl],
      { timeout: 300_000 },
    );
    return { ok: true, stdout: result.stdout, stderr: result.stderr, exitCode: 0 };
  } catch (err: unknown) {
    const execErr = err as { stdout?: string; stderr?: string; code?: number };
    return {
      ok: false,
      stdout: execErr.stdout ?? '',
      stderr: execErr.stderr ?? (err instanceof Error ? err.message : 'Login failed'),
      exitCode: execErr.code ?? 1,
    };
  }
}

/**
 * Log out of the current dtctl context and delete it.
 */
export async function dtctlLogout(): Promise<DtctlResult> {
  // First get the current context name
  let contextName = '';
  try {
    const ctxRes = await execDtctl(['config', 'current-context'], { timeout: 10_000 });
    contextName = ctxRes.stdout.trim();
  } catch { /* ignore */ }

  // Remove the OAuth token
  try {
    await execDtctl(['auth', 'logout'], { timeout: 15_000 });
  } catch { /* may write to stderr even on success */ }

  // Delete the context entry so it doesn't appear as connected
  if (contextName) {
    try {
      await execDtctl(['config', 'delete-context', contextName], { timeout: 10_000 });
    } catch { /* ignore if it doesn't exist */ }
  }

  return { ok: true, stdout: 'Logged out', stderr: '', exitCode: 0 };
}

/**
 * Returns the dtctl tool definitions for OpenAI function-calling format.
 */
export function getDtctlToolDefinitions(): Array<{
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown> };
}> {
  return [
    {
      type: 'function',
      function: {
        name: 'dtctl_run',
        description:
          'Execute a dtctl CLI command to manage Dynatrace platform resources (workflows, dashboards, notebooks, DQL, SLOs, settings, buckets, lookups, etc.). ' +
          'Pass the full dtctl command (without the "dtctl" prefix). Examples: "get workflows", "describe workflow MyWorkflow -o yaml", ' +
          '"query \'fetch logs | limit 10\'", "diff -f manifest.yaml", "config current-context", "auth whoami", "doctor". ' +
          'Read-only commands execute immediately. Write commands (create, edit, delete, apply, execute, restore) require explicit user confirmation ' +
          'and will be blocked unless confirmWrite is true. Always run "config current-context" and "auth whoami" before write operations.',
        parameters: {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              description: 'The dtctl command to run (without the "dtctl" prefix). Example: "get workflows -o json"',
            },
            confirmWrite: {
              type: 'boolean',
              description: 'Set to true only if the user has explicitly confirmed a write operation. Default: false.',
            },
          },
          required: ['command'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'dtctl_context_info',
        description:
          'Retrieve the current dtctl context including version, active context name, environment URL, safety level, and authenticated user. ' +
          'Use this before any write operations to verify the target environment.',
        parameters: {
          type: 'object',
          properties: {},
        },
      },
    },
  ];
}
