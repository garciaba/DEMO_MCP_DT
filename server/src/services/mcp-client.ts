import { nanoid } from 'nanoid';

// ─── MCP Protocol Types ───────────────────────────────────────

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

export interface MCPToolResult {
  content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
  isError?: boolean;
}

// ─── MCP Client ───────────────────────────────────────────────

export class MCPClient {
  private serverUrl: string;
  private bearerToken: string;
  private sessionId: string | null = null;
  private initialized = false;
  private tools: MCPTool[] = [];

  constructor(serverUrl: string, bearerToken: string) {
    this.serverUrl = serverUrl;
    // Strip "Bearer " prefix if user included it
    this.bearerToken = bearerToken.replace(/^Bearer\s+/i, '');
  }

  private async sendRequest(method: string, params?: Record<string, unknown>): Promise<JsonRpcResponse> {
    const id = nanoid(8);

    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id,
      method,
      ...(params ? { params } : {}),
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      Authorization: `Bearer ${this.bearerToken}`,
    };

    if (this.sessionId) {
      headers['Mcp-Session-Id'] = this.sessionId;
    }

    const res = await fetch(this.serverUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    });

    // Capture session ID from response
    const newSessionId = res.headers.get('mcp-session-id');
    if (newSessionId) {
      this.sessionId = newSessionId;
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`MCP server error (${res.status}): ${text}`);
    }

    const contentType = res.headers.get('content-type') ?? '';

    // Handle SSE response
    if (contentType.includes('text/event-stream')) {
      return await this.parseSSEResponse(res, id);
    }

    // Handle direct JSON response
    const data = await res.json();

    // Response might be an array (batch) — find ours
    if (Array.isArray(data)) {
      const match = data.find((r: JsonRpcResponse) => r.id === id);
      if (!match) throw new Error('No matching response in batch');
      return match;
    }

    return data as JsonRpcResponse;
  }

  private async parseSSEResponse(res: Response, requestId: string | number): Promise<JsonRpcResponse> {
    const reader = res.body?.getReader();
    if (!reader) throw new Error('No response body for SSE');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;

        const data = trimmed.slice(6);
        try {
          const parsed = JSON.parse(data) as JsonRpcResponse;
          if (parsed.id === requestId) {
            return parsed;
          }
        } catch {
          // skip malformed
        }
      }
    }

    // Check remaining buffer
    if (buffer.trim().startsWith('data: ')) {
      const data = buffer.trim().slice(6);
      const parsed = JSON.parse(data) as JsonRpcResponse;
      if (parsed.id === requestId) return parsed;
    }

    throw new Error('SSE stream ended without matching response');
  }

  // ─── Public API ─────────────────────────────────────────────

  async initialize(): Promise<void> {
    const response = await this.sendRequest('initialize', {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: { name: 'mcp-chat-client', version: '1.0.0' },
    });

    if (response.error) {
      throw new Error(`MCP initialize failed: ${response.error.message}`);
    }

    // Send initialized notification (no response expected, but we send as request for simplicity)
    try {
      await this.sendNotification('notifications/initialized');
    } catch {
      // Notifications may not get a response — that's OK
    }

    this.initialized = true;
  }

  private async sendNotification(method: string, params?: Record<string, unknown>): Promise<void> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.bearerToken}`,
    };

    if (this.sessionId) {
      headers['Mcp-Session-Id'] = this.sessionId;
    }

    // Notifications have no id
    await fetch(this.serverUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        method,
        ...(params ? { params } : {}),
      }),
    });
  }

  async listTools(): Promise<MCPTool[]> {
    if (!this.initialized) await this.initialize();

    const response = await this.sendRequest('tools/list');

    if (response.error) {
      throw new Error(`MCP tools/list failed: ${response.error.message}`);
    }

    const result = response.result as { tools?: MCPTool[] };
    this.tools = result.tools ?? [];
    return this.tools;
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<MCPToolResult> {
    if (!this.initialized) await this.initialize();

    const response = await this.sendRequest('tools/call', {
      name,
      arguments: args,
    });

    if (response.error) {
      return {
        content: [{ type: 'text', text: `Tool error: ${response.error.message}` }],
        isError: true,
      };
    }

    return response.result as MCPToolResult;
  }

  getTools(): MCPTool[] {
    return this.tools;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Convert MCP tools to OpenAI-compatible function definitions for LLM tool-use.
   */
  getToolDefinitions(): Array<{ type: 'function'; function: { name: string; description: string; parameters: Record<string, unknown> } }> {
    return this.tools.map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description ?? '',
        parameters: tool.inputSchema,
      },
    }));
  }
}

// ─── Per-session MCP client cache ─────────────────────────────

const clientCache = new Map<string, MCPClient>();

export function getMCPClient(sessionId: string, serverUrl: string, bearerToken: string): MCPClient {
  const key = `${sessionId}:${serverUrl}`;
  const existing = clientCache.get(key);
  if (existing?.isInitialized()) return existing;

  const client = new MCPClient(serverUrl, bearerToken);
  clientCache.set(key, client);
  return client;
}

export function removeMCPClient(sessionId: string): void {
  for (const [key] of clientCache) {
    if (key.startsWith(`${sessionId}:`)) {
      clientCache.delete(key);
    }
  }
}
