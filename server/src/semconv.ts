/**
 * OpenTelemetry Semantic Conventions for Generative AI (v1.40.0).
 *
 * Based on: https://opentelemetry.io/docs/specs/semconv/registry/attributes/gen-ai/
 *           https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/
 */

// ─── GenAI Attribute Keys ────────────────────────────────────

// Required
export const ATTR_GEN_AI_OPERATION_NAME = 'gen_ai.operation.name';
export const ATTR_GEN_AI_PROVIDER_NAME = 'gen_ai.provider.name';

// Conditionally Required / Recommended — Request
export const ATTR_GEN_AI_REQUEST_MODEL = 'gen_ai.request.model';
export const ATTR_GEN_AI_REQUEST_MAX_TOKENS = 'gen_ai.request.max_tokens';
export const ATTR_GEN_AI_REQUEST_TEMPERATURE = 'gen_ai.request.temperature';
export const ATTR_GEN_AI_REQUEST_TOP_P = 'gen_ai.request.top_p';
export const ATTR_GEN_AI_REQUEST_FREQUENCY_PENALTY = 'gen_ai.request.frequency_penalty';
export const ATTR_GEN_AI_REQUEST_PRESENCE_PENALTY = 'gen_ai.request.presence_penalty';
export const ATTR_GEN_AI_REQUEST_STOP_SEQUENCES = 'gen_ai.request.stop_sequences';

// Conditionally Required — Conversation / Output
export const ATTR_GEN_AI_CONVERSATION_ID = 'gen_ai.conversation.id';
export const ATTR_GEN_AI_OUTPUT_TYPE = 'gen_ai.output.type';

// Recommended — Response
export const ATTR_GEN_AI_RESPONSE_ID = 'gen_ai.response.id';
export const ATTR_GEN_AI_RESPONSE_MODEL = 'gen_ai.response.model';
export const ATTR_GEN_AI_RESPONSE_FINISH_REASONS = 'gen_ai.response.finish_reasons';

// Recommended — Token Usage
export const ATTR_GEN_AI_USAGE_INPUT_TOKENS = 'gen_ai.usage.input_tokens';
export const ATTR_GEN_AI_USAGE_OUTPUT_TOKENS = 'gen_ai.usage.output_tokens';

// Opt-In — Content (JSON strings on spans)
export const ATTR_GEN_AI_SYSTEM_INSTRUCTIONS = 'gen_ai.system_instructions';
export const ATTR_GEN_AI_INPUT_MESSAGES = 'gen_ai.input.messages';
export const ATTR_GEN_AI_OUTPUT_MESSAGES = 'gen_ai.output.messages';

// Tool execution attributes
export const ATTR_GEN_AI_TOOL_NAME = 'gen_ai.tool.name';
export const ATTR_GEN_AI_TOOL_TYPE = 'gen_ai.tool.type';
export const ATTR_GEN_AI_TOOL_CALL_ID = 'gen_ai.tool.call.id';
export const ATTR_GEN_AI_TOOL_DESCRIPTION = 'gen_ai.tool.description';
export const ATTR_GEN_AI_TOOL_CALL_ARGUMENTS = 'gen_ai.tool.call.arguments';
export const ATTR_GEN_AI_TOOL_CALL_RESULT = 'gen_ai.tool.call.result';

// Server attributes
export const ATTR_SERVER_ADDRESS = 'server.address';
export const ATTR_SERVER_PORT = 'server.port';

// Error
export const ATTR_ERROR_TYPE = 'error.type';

// ─── Well-Known Values ───────────────────────────────────────

export const GenAiOperationName = {
  CHAT: 'chat',
  EXECUTE_TOOL: 'execute_tool',
  TEXT_COMPLETION: 'text_completion',
  EMBEDDINGS: 'embeddings',
} as const;

export const GenAiOutputType = {
  TEXT: 'text',
  JSON: 'json',
} as const;

export const GenAiToolType = {
  FUNCTION: 'function',
  EXTENSION: 'extension',
  DATASTORE: 'datastore',
} as const;
