import type { ChatMessage, ContextPayload } from '../../../shared/src/index.js';
import { getSystemInstructions } from './dtctl-skill.js';

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

  // ─── System instructions (tool routing, safety rules, DQL reference) ───
  const instructions = getSystemInstructions();
  if (instructions) {
    contextParts.push(instructions);
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
