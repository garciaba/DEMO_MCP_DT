import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

// ─── System Instructions Loader ─────────────────────────────
// Loads the bundled system-instructions.md (always ships with the app)
// and optionally enriches with external dtctl skill files from
// ~/.agents/skills/dtctl/ if available.

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Bundled instructions (project-local — always available)
const INSTRUCTIONS_PATH = path.resolve(__dirname, '..', 'instructions', 'system-instructions.md');

// External dtctl skill directory (optional enrichment)
const SKILL_DIR = path.join(os.homedir(), '.agents', 'skills', 'dtctl');
const SKILL_PATH = path.join(SKILL_DIR, 'SKILL.md');
const DQL_REF_PATH = path.join(SKILL_DIR, 'references', 'DQL-reference.md');

let cachedInstructions: string | null = null;

/**
 * Strips YAML frontmatter (--- ... ---) from markdown content.
 */
function stripFrontmatter(content: string): string {
  const match = content.match(/^---\s*\n[\s\S]*?\n---\s*\n/);
  return match ? content.slice(match[0].length) : content;
}

/**
 * Loads and caches the system instructions + any external skill enrichment.
 * Returns the combined instructions string, or null if nothing is available.
 */
export function getSystemInstructions(): string | null {
  if (cachedInstructions !== null) return cachedInstructions;

  const parts: string[] = [];

  // 1) Load bundled system instructions (primary)
  try {
    if (fs.existsSync(INSTRUCTIONS_PATH)) {
      parts.push(fs.readFileSync(INSTRUCTIONS_PATH, 'utf-8').trim());
    }
  } catch {
    // Instructions file not readable
  }

  // 2) Enrich with external dtctl SKILL.md if available
  try {
    if (fs.existsSync(SKILL_PATH)) {
      const raw = fs.readFileSync(SKILL_PATH, 'utf-8');
      parts.push('## dtctl Extended Skill Reference\n\n' + stripFrontmatter(raw).trim());
    }
  } catch {
    // External skill not available — fine
  }

  // 3) Enrich with external DQL reference if available
  try {
    if (fs.existsSync(DQL_REF_PATH)) {
      parts.push(fs.readFileSync(DQL_REF_PATH, 'utf-8').trim());
    }
  } catch {
    // External DQL reference not available — fine
  }

  cachedInstructions = parts.length > 0 ? parts.join('\n\n') : null;
  return cachedInstructions;
}

// Backward-compatible alias
export const getDtctlSkillContent = getSystemInstructions;
