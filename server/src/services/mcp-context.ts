import type { ChatMessage, ContextPayload } from '../../../shared/src/index.js';
import { getDtctlSkillContent } from './dtctl-skill.js';

// ─── Context size limits for LLM ──────────────────────────────
// Most models support ~128k tokens. 1 token ≈ 4 chars.
// Reserve ~32k tokens for conversation + response, leaving ~96k for context.
const MAX_CONTEXT_CHARS = 96_000 * 4; // ~96k tokens
const MAX_FILE_CHARS = 60_000 * 4;    // Max chars per single file in context

/**
 * Truncate text to fit within a character budget, adding a notice if truncated.
 */
function truncateWithNotice(text: string, maxChars: number, label: string): string {
  if (text.length <= maxChars) return text;
  const truncated = text.slice(0, maxChars);
  return `${truncated}\n\n[... ${label} truncated — ${((text.length - maxChars) / 1024).toFixed(0)}KB omitted to fit context window ...]`;
}

/**
 * Builds an MCP-style context-augmented message array.
 * Prepends system messages with aggregated context from files and Dynatrace data.
 * Applies smart truncation to stay within LLM context window limits.
 */
export function buildMCPContext(
  messages: ChatMessage[],
  context?: ContextPayload,
): ChatMessage[] {
  const contextParts: string[] = [];

  // ─── dtctl + MCP usage guidance ──────────────────────────────
  const skillContent = getDtctlSkillContent();

  if (skillContent) {
    // Use the full dtctl skill knowledge base
    contextParts.push(`## dtctl Skill Reference

${skillContent}

## Tool Usage Guidelines

You have access to two complementary tool sets for working with Dynatrace:

### Dynatrace MCP tools
Use these to **inspect and analyze live tenant state**: run DQL queries, list problems/entities, inspect existing workflows/dashboards, validate data quality and behavior.

### dtctl CLI tools (dtctl_run, dtctl_context_info)
Use these to **change configuration in an idempotent, GitOps-like way**: get, describe, edit, apply, delete, query, diff, logs, history, restore, and share for Dynatrace resources.
Prefer dtctl over raw HTTP calls for any resource that dtctl supports.

**Safety rules for dtctl:**
1. Before any write operation, first call dtctl_context_info to verify the active context (environment URL, safety level, authenticated user).
2. If the context looks wrong for the task (e.g. production vs POC), warn the user and ask for confirmation.
3. Use dtctl_run with command "diff -f <path>" before "apply -f <path>" and explain what will change.
4. Never run destructive operations (delete, force overwrite) unless the user explicitly confirms.
5. Write operations (create, edit, delete, apply, execute, restore) require confirmWrite=true — only set this after user confirmation.
`);
  } else {
    // Fallback: minimal guidance when skill files are not available
    contextParts.push(`## Tool Usage Guidelines

You have access to two complementary tool sets for working with Dynatrace:

### Dynatrace MCP tools
Use these to **inspect and analyze live tenant state**: run DQL queries, list problems/entities, inspect existing workflows/dashboards, validate data quality and behavior.

### dtctl CLI tools (dtctl_run, dtctl_context_info)
Use these to **change configuration in an idempotent, GitOps-like way**: get, describe, edit, apply, delete, query, diff, logs, history, restore, and share for Dynatrace resources.
Prefer dtctl over raw HTTP calls for any resource that dtctl supports.

**Safety rules for dtctl:**
1. Before any write operation, first call dtctl_context_info to verify the active context (environment URL, safety level, authenticated user).
2. If the context looks wrong for the task (e.g. production vs POC), warn the user and ask for confirmation.
3. Use dtctl_run with command "diff -f <path>" before "apply -f <path>" and explain what will change.
4. Never run destructive operations (delete, force overwrite) unless the user explicitly confirms.
5. Write operations (create, edit, delete, apply, execute, restore) require confirmWrite=true — only set this after user confirmation.

**dtctl command patterns:**
- Discovery: "get workflows", "get dashboards", "get notebooks", "get slos" (add "-o table" or "-o json")
- Detail: "describe workflow <name> -o yaml"
- DQL: "query '<DQL statement>'"
- Config check: "config current-context", "config describe-context", "auth whoami", "doctor"
- Declarative: "diff -f <path>", "apply -f <path>" (requires confirm)
- Logs: "logs workflows/<name>"
`);
  }

  if (context?.systemPrompt) {
    contextParts.push(context.systemPrompt);
  }

  if (context?.files && context.files.length > 0) {
    contextParts.push('## Uploaded Context Files\n');
    for (const file of context.files) {
      const fileContent = truncateWithNotice(file.content, MAX_FILE_CHARS, file.name);
      contextParts.push(`### ${file.name} (${file.type}, ${(file.size / 1024).toFixed(1)}KB)\n\`\`\`\n${fileContent}\n\`\`\`\n`);
    }
  }

  if (context?.dynatraceData && Object.keys(context.dynatraceData).length > 0) {
    contextParts.push('## Dynatrace Data\n');
    contextParts.push('```json\n' + JSON.stringify(context.dynatraceData, null, 2) + '\n```\n');
  }

  if (contextParts.length === 0) {
    return messages;
  }

  let contextContent = contextParts.join('\n');

  // Apply total context budget — truncate if the entire system message is too large
  if (contextContent.length > MAX_CONTEXT_CHARS) {
    contextContent = truncateWithNotice(contextContent, MAX_CONTEXT_CHARS, 'system context');
  }

  const systemMessage: ChatMessage = {
    id: 'system-context',
    role: 'system',
    content: contextContent,
    timestamp: Date.now(),
  };

  // Check if first message is already a system message and merge
  const filtered = messages.filter(m => m.id !== 'system-context');
  return [systemMessage, ...filtered];
}
