import fs from 'fs';
import path from 'path';
import os from 'os';

// ─── dtctl Skill Loader ─────────────────────────────────────
// Loads the dtctl SKILL.md and DQL reference from the user's
// agent skills directory and caches them for injection into the
// system prompt.

const SKILL_DIR = path.join(os.homedir(), '.agents', 'skills', 'dtctl');
const SKILL_PATH = path.join(SKILL_DIR, 'SKILL.md');
const DQL_REF_PATH = path.join(SKILL_DIR, 'references', 'DQL-reference.md');

let cachedSkillContent: string | null = null;

/**
 * Strips YAML frontmatter (--- ... ---) from markdown content.
 */
function stripFrontmatter(content: string): string {
  const match = content.match(/^---\s*\n[\s\S]*?\n---\s*\n/);
  return match ? content.slice(match[0].length) : content;
}

/**
 * Loads and caches the dtctl skill content (SKILL.md + DQL reference).
 * Returns null if the skill files are not found.
 */
export function getDtctlSkillContent(): string | null {
  if (cachedSkillContent !== null) return cachedSkillContent;

  const parts: string[] = [];

  try {
    if (fs.existsSync(SKILL_PATH)) {
      const raw = fs.readFileSync(SKILL_PATH, 'utf-8');
      parts.push(stripFrontmatter(raw).trim());
    }
  } catch {
    // Skill file not readable
  }

  try {
    if (fs.existsSync(DQL_REF_PATH)) {
      const dql = fs.readFileSync(DQL_REF_PATH, 'utf-8');
      parts.push(dql.trim());
    }
  } catch {
    // DQL reference not readable
  }

  cachedSkillContent = parts.length > 0 ? parts.join('\n\n') : null;
  return cachedSkillContent;
}
