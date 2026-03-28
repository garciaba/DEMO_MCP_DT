import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { SpanKind, SpanStatusCode } from '@opentelemetry/api';
import { tracer } from '../telemetry.js';
import {
  ATTR_GEN_AI_OPERATION_NAME,
  ATTR_GEN_AI_PROVIDER_NAME,
  ATTR_GEN_AI_REQUEST_MODEL,
  ATTR_GEN_AI_REQUEST_MAX_TOKENS,
  ATTR_GEN_AI_REQUEST_TEMPERATURE,
  ATTR_GEN_AI_RESPONSE_ID,
  ATTR_GEN_AI_RESPONSE_MODEL,
  ATTR_GEN_AI_RESPONSE_FINISH_REASONS,
  ATTR_GEN_AI_USAGE_INPUT_TOKENS,
  ATTR_GEN_AI_USAGE_OUTPUT_TOKENS,
  ATTR_GEN_AI_OUTPUT_TYPE,
  ATTR_GEN_AI_CONVERSATION_ID,
  ATTR_GEN_AI_TOOL_NAME,
  ATTR_GEN_AI_TOOL_TYPE,
  ATTR_GEN_AI_TOOL_CALL_ID,
  ATTR_GEN_AI_TOOL_CALL_ARGUMENTS,
  ATTR_GEN_AI_TOOL_CALL_RESULT,
  ATTR_SERVER_ADDRESS,
  ATTR_SERVER_PORT,
  ATTR_ERROR_TYPE,
  GenAiOperationName,
  GenAiOutputType,
  GenAiToolType,
} from '../semconv.js';
import { sessionStore } from '../services/session.js';
import { buildMCPContext } from '../services/mcp-context.js';
import { getMCPClient } from '../services/mcp-client.js';
import type { ChatRequest } from '../../../shared/src/index.js';
import {
  getDtctlToolDefinitions,
  isDtctlInstalled,
  runDtctl,
  getDtctlContextInfo,
} from '../services/dtctl.js';

const COPILOT_API_HOST = 'api.githubcopilot.com';
const COPILOT_API_PORT = 443;
const PROVIDER_NAME = 'github.copilot';

// Types for Copilot API responses
interface ToolCallChunk {
  index: number;
  id?: string;
  function?: { name?: string; arguments?: string };
}
interface CopilotStreamChoice {
  delta?: {
    content?: string | null;
    tool_calls?: ToolCallChunk[];
  };
  finish_reason?: string | null;
}
interface CopilotStreamChunk {
  id?: string;
  model?: string;
  choices?: CopilotStreamChoice[];
}

type ApiMessage =
  | { role: string; content: string }
  | { role: 'assistant'; content: null; tool_calls: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }> }
  | { role: 'tool'; tool_call_id: string; content: string };

const MAX_TOOL_ROUNDS = 10;

/** Build a short human-readable summary of tool arguments */
function summarizeArgs(args: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(args)) {
    const str = typeof value === 'string' ? value : JSON.stringify(value);
    const truncated = str.length > 120 ? str.slice(0, 117) + '...' : str;
    parts.push(`${key}: ${truncated}`);
  }
  return parts.join(' | ') || '(no arguments)';
}

export async function chatRoutes(app: FastifyInstance) {
  // ─── Stream chat response via SSE ─────────────────────────
  app.post<{ Body: ChatRequest }>('/stream', async (req: FastifyRequest<{ Body: ChatRequest }>, reply: FastifyReply) => {
    const sessionId = req.cookies.session;
    if (!sessionId) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }

    const token = sessionStore.getToken(sessionId);
    if (!token) {
      return reply.status(401).send({ error: 'Session expired' });
    }

    const { messages, model, context, mcpConfig } = req.body;

    // Build MCP-style context-augmented messages
    const augmentedMessages = buildMCPContext(messages, context);

    // Calculate total context size for budget warnings
    const totalContextChars = augmentedMessages
      .filter(m => m.role === 'system')
      .reduce((sum, m) => sum + m.content.length, 0);
    const estimatedTokens = Math.round(totalContextChars / 4);

    // Set SSE headers
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const sendEvent = (event: Record<string, unknown>) => {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    // Warn client if context is consuming a large portion of the window
    if (estimatedTokens > 80_000) {
      sendEvent({
        type: 'context_warning',
        content: `Context is using ~${Math.round(estimatedTokens / 1000)}k tokens. This may reduce response quality. Consider removing some context files.`,
      });
    }

    try {
      // Resolve MCP tool definitions if connected
      let toolDefs: Array<{ type: 'function'; function: { name: string; description: string; parameters: Record<string, unknown> } }> = [];
      let mcpClient: ReturnType<typeof getMCPClient> | null = null;

      if (mcpConfig?.mcpServerUrl && mcpConfig?.bearerToken) {
        try {
          mcpClient = getMCPClient(sessionId, mcpConfig.mcpServerUrl, mcpConfig.bearerToken);
          if (!mcpClient.isInitialized()) {
            await mcpClient.initialize();
            await mcpClient.listTools();
          }
          toolDefs = mcpClient.getToolDefinitions();
        } catch (err) {
          req.log.warn({ err }, 'Failed to get MCP tools — proceeding without tools');
        }
      }

      // Resolve dtctl tool definitions if dtctl is installed
      let dtctlAvailable = false;
      try {
        dtctlAvailable = await isDtctlInstalled();
      } catch { /* dtctl not available */ }

      if (dtctlAvailable) {
        toolDefs.push(...getDtctlToolDefinitions());
      }

      // Build conversation messages
      const apiMessages: ApiMessage[] = augmentedMessages.map(m => ({
        role: m.role,
        content: m.content,
      }));

      // ─── Agentic tool-calling loop ──────────────────────────
      for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
        const requestBody: Record<string, unknown> = {
          model,
          messages: apiMessages,
          stream: true,
          temperature: 0.2,
          max_tokens: 4096,
        };

        if (toolDefs.length > 0 && round < MAX_TOOL_ROUNDS) {
          requestBody.tools = toolDefs;
          requestBody.tool_choice = 'auto';
        }

        // ── GenAI Inference span (semconv) ──────────────────
        // Span name: "{gen_ai.operation.name} {gen_ai.request.model}"
        // Span kind: CLIENT (remote model service)
        const spanName = `${GenAiOperationName.CHAT} ${model}`;
        const llmSpan = tracer.startSpan(spanName, {
          kind: SpanKind.CLIENT,
          attributes: {
            // Required
            [ATTR_GEN_AI_OPERATION_NAME]: GenAiOperationName.CHAT,
            [ATTR_GEN_AI_PROVIDER_NAME]: PROVIDER_NAME,
            // Conditionally Required
            [ATTR_GEN_AI_REQUEST_MODEL]: model as string,
            [ATTR_GEN_AI_CONVERSATION_ID]: sessionId,
            [ATTR_GEN_AI_OUTPUT_TYPE]: GenAiOutputType.TEXT,
            // Recommended — request params
            [ATTR_GEN_AI_REQUEST_TEMPERATURE]: 0.2,
            [ATTR_GEN_AI_REQUEST_MAX_TOKENS]: 4096,
            // Server
            [ATTR_SERVER_ADDRESS]: COPILOT_API_HOST,
            [ATTR_SERVER_PORT]: COPILOT_API_PORT,
          },
        });

        // Dynatrace convention: gen_ai.prompt.N.content for each input message
        if (round === 0) {
          let promptIdx = 0;
          for (const m of augmentedMessages) {
            llmSpan.setAttribute(
              `gen_ai.prompt.${promptIdx}.role`,
              m.role,
            );
            llmSpan.setAttribute(
              `gen_ai.prompt.${promptIdx}.content`,
              m.content.slice(0, 500),
            );
            promptIdx++;
          }
        }

        const response = await fetch(`https://${COPILOT_API_HOST}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Copilot-Integration-Id': 'vscode-chat',
            'Editor-Version': 'vscode/1.96.0',
            'Editor-Plugin-Version': 'copilot-chat/0.24.0',
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errText = await response.text();
          llmSpan.setAttribute(ATTR_ERROR_TYPE, String(response.status));
          llmSpan.setStatus({ code: SpanStatusCode.ERROR, message: `API ${response.status}` });
          llmSpan.end();
          sendEvent({ type: 'error', error: `API error: ${response.status} - ${errText}` });
          break;
        }

        const reader = response.body?.getReader();
        if (!reader) {
          llmSpan.setAttribute(ATTR_ERROR_TYPE, 'no_response_body');
          llmSpan.setStatus({ code: SpanStatusCode.ERROR, message: 'No response body' });
          llmSpan.end();
          sendEvent({ type: 'error', error: 'No response body' });
          break;
        }

        // Parse the streamed response — collect both text deltas and tool calls
        const decoder = new TextDecoder();
        let buf = '';
        let finishReason: string | null = null;
        let responseId: string | null = null;
        let responseModel: string | null = null;
        let outputText = '';
        const toolCallAccum: Map<number, { id: string; name: string; args: string }> = new Map();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buf += decoder.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop() ?? '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;

            const data = trimmed.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed: CopilotStreamChunk = JSON.parse(data);
              const choice = parsed.choices?.[0];
              if (!choice) continue;

              // Capture response metadata from first chunk
              if (!responseId && parsed.id) {
                responseId = parsed.id;
              }
              if (!responseModel && parsed.model) {
                responseModel = parsed.model;
              }

              if (choice.finish_reason) finishReason = choice.finish_reason;

              // Stream text deltas to client
              if (choice.delta?.content) {
                outputText += choice.delta.content;
                sendEvent({ type: 'delta', content: choice.delta.content });
              }

              // Accumulate tool call fragments
              if (choice.delta?.tool_calls) {
                for (const tc of choice.delta.tool_calls) {
                  const existing = toolCallAccum.get(tc.index);
                  if (!existing) {
                    toolCallAccum.set(tc.index, {
                      id: tc.id ?? '',
                      name: tc.function?.name ?? '',
                      args: tc.function?.arguments ?? '',
                    });
                  } else {
                    if (tc.id) existing.id = tc.id;
                    if (tc.function?.name) existing.name += tc.function.name;
                    if (tc.function?.arguments) existing.args += tc.function.arguments;
                  }
                }
              }
            } catch {
              // Skip malformed chunks
            }
          }
        }

        // ── Set response attributes per semconv ───────────
        llmSpan.setAttribute(ATTR_GEN_AI_RESPONSE_FINISH_REASONS, [finishReason ?? 'unknown']);
        if (responseId) llmSpan.setAttribute(ATTR_GEN_AI_RESPONSE_ID, responseId);
        if (responseModel) llmSpan.setAttribute(ATTR_GEN_AI_RESPONSE_MODEL, responseModel);

        // Best-effort token estimation (chars / 4)
        const inputChars = apiMessages.reduce((sum, m) => {
          if ('content' in m && typeof m.content === 'string') return sum + m.content.length;
          return sum;
        }, 0);
        llmSpan.setAttribute(ATTR_GEN_AI_USAGE_INPUT_TOKENS, Math.round(inputChars / 4));
        llmSpan.setAttribute(ATTR_GEN_AI_USAGE_OUTPUT_TOKENS, Math.round(outputText.length / 4));

        // Dynatrace convention: gen_ai.completion.0.content for output
        if (outputText) {
          llmSpan.setAttribute('gen_ai.completion.0.role', 'assistant');
          llmSpan.setAttribute('gen_ai.completion.0.content', outputText.slice(0, 1000));
          llmSpan.setAttribute('gen_ai.completion.0.finish_reason', finishReason ?? 'unknown');
        }

        llmSpan.end();

        // If the model wants to call tools, execute them
        if (finishReason === 'tool_calls' && toolCallAccum.size > 0) {
          const toolCalls = [...toolCallAccum.values()];

          // Add assistant tool_calls message to conversation
          apiMessages.push({
            role: 'assistant',
            content: null,
            tool_calls: toolCalls.map(tc => ({
              id: tc.id,
              type: 'function' as const,
              function: { name: tc.name, arguments: tc.args },
            })),
          });

          // Execute each tool call via MCP or dtctl
          for (const tc of toolCalls) {
            // ── GenAI execute_tool span (semconv) ───────────
            // Span name: "execute_tool {gen_ai.tool.name}"
            // Span kind: INTERNAL
            const isDtctl = tc.name === 'dtctl_run' || tc.name === 'dtctl_context_info';
            const toolType = isDtctl ? GenAiToolType.FUNCTION : GenAiToolType.EXTENSION;

            const toolSpan = tracer.startSpan(`${GenAiOperationName.EXECUTE_TOOL} ${tc.name}`, {
              kind: SpanKind.INTERNAL,
              attributes: {
                [ATTR_GEN_AI_OPERATION_NAME]: GenAiOperationName.EXECUTE_TOOL,
                [ATTR_GEN_AI_TOOL_NAME]: tc.name,
                [ATTR_GEN_AI_TOOL_TYPE]: toolType,
                [ATTR_GEN_AI_TOOL_CALL_ID]: tc.id,
              },
            });

            sendEvent({ type: 'tool_call', toolName: tc.name, status: 'calling' });

            let args: Record<string, unknown> = {};
            try {
              args = JSON.parse(tc.args);
            } catch {
              // empty args
            }

            // Opt-In: record tool call arguments
            toolSpan.setAttribute(ATTR_GEN_AI_TOOL_CALL_ARGUMENTS, JSON.stringify(args));

            // ─── dtctl tool handling ──────────────────────────
            if (tc.name === 'dtctl_run' || tc.name === 'dtctl_context_info') {
              try {
                let resultText: string;

                if (tc.name === 'dtctl_context_info') {
                  const info = await getDtctlContextInfo();
                  resultText = JSON.stringify(info, null, 2);
                } else {
                  const cmd = (args.command as string) ?? '';
                  const confirmWrite = (args.confirmWrite as boolean) ?? false;
                  const result = await runDtctl(cmd, { confirmWrite });
                  resultText = result.ok
                    ? result.stdout || '(no output)'
                    : `Error (exit ${result.exitCode}): ${result.stderr}\n${result.stdout}`;
                }

                // Opt-In: record tool result (truncated)
                toolSpan.setAttribute(ATTR_GEN_AI_TOOL_CALL_RESULT, resultText.slice(0, 2000));
                toolSpan.end();
                sendEvent({ type: 'tool_call', toolName: tc.name, status: 'done' });
                apiMessages.push({
                  role: 'tool',
                  tool_call_id: tc.id,
                  content: resultText,
                });
              } catch (err) {
                const errMsg = err instanceof Error ? err.message : 'dtctl call failed';
                toolSpan.setAttribute(ATTR_ERROR_TYPE, errMsg);
                toolSpan.setStatus({ code: SpanStatusCode.ERROR, message: errMsg });
                toolSpan.end();
                sendEvent({ type: 'tool_call', toolName: tc.name, status: 'error', error: errMsg });
                apiMessages.push({
                  role: 'tool',
                  tool_call_id: tc.id,
                  content: `Error: ${errMsg}`,
                });
              }
              continue;
            }

            // ─── MCP tool handling ────────────────────────────
            if (!mcpClient) {
              toolSpan.setAttribute(ATTR_ERROR_TYPE, 'mcp_not_connected');
              toolSpan.setStatus({ code: SpanStatusCode.ERROR, message: 'MCP not connected' });
              toolSpan.end();
              sendEvent({ type: 'tool_call', toolName: tc.name, status: 'error', error: 'MCP not connected' });
              apiMessages.push({
                role: 'tool',
                tool_call_id: tc.id,
                content: 'Error: MCP client not connected',
              });
              continue;
            }

            try {
              // Emit what we're sending to the MCP server
              sendEvent({
                type: 'mcp_message',
                direction: 'sent',
                toolName: tc.name,
                summary: summarizeArgs(args),
              });

              const result = await mcpClient.callTool(tc.name, args);
              const resultText = result.content
                .map(c => c.text ?? (c.data ? `[binary: ${c.mimeType}]` : ''))
                .join('\n');

              // Emit what we received from the MCP server
              const receivedSummary = resultText.length > 200
                ? resultText.slice(0, 197) + '...'
                : resultText;
              sendEvent({
                type: 'mcp_message',
                direction: 'received',
                toolName: tc.name,
                summary: receivedSummary,
              });

              // Opt-In: record tool result (truncated)
              toolSpan.setAttribute(ATTR_GEN_AI_TOOL_CALL_RESULT, resultText.slice(0, 2000));
              toolSpan.end();
              sendEvent({ type: 'tool_call', toolName: tc.name, status: 'done' });

              apiMessages.push({
                role: 'tool',
                tool_call_id: tc.id,
                content: resultText,
              });
            } catch (err) {
              const errMsg = err instanceof Error ? err.message : 'Tool call failed';
              toolSpan.setAttribute(ATTR_ERROR_TYPE, errMsg);
              toolSpan.setStatus({ code: SpanStatusCode.ERROR, message: errMsg });
              toolSpan.end();
              sendEvent({ type: 'tool_call', toolName: tc.name, status: 'error', error: errMsg });

              apiMessages.push({
                role: 'tool',
                tool_call_id: tc.id,
                content: `Error: ${errMsg}`,
              });
            }
          }

          // Continue loop — next round sends tool results back to LLM
          continue;
        }

        // No more tool calls — we're done
        break;
      }

      sendEvent({ type: 'done' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      sendEvent({ type: 'error', error: message });
    } finally {
      reply.raw.end();
    }
  });
}
