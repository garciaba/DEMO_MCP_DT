import { describe, it, expect } from 'vitest';
import { buildMCPContext } from '../src/services/mcp-context.js';
import type { ChatMessage, ContextPayload } from '../../shared/src/index.js';

describe('buildMCPContext', () => {
  const baseMessages: ChatMessage[] = [
    { id: '1', role: 'user', content: 'Hello', timestamp: Date.now() },
  ];

  it('returns messages unchanged when no context is provided', () => {
    const result = buildMCPContext(baseMessages);
    expect(result).toEqual(baseMessages);
  });

  it('returns messages unchanged when context is empty', () => {
    const context: ContextPayload = { files: [] };
    const result = buildMCPContext(baseMessages, context);
    expect(result).toEqual(baseMessages);
  });

  it('prepends system message with file context', () => {
    const context: ContextPayload = {
      files: [
        { name: 'test.json', content: '{"key": "value"}', type: 'application/json', size: 16 },
      ],
    };

    const result = buildMCPContext(baseMessages, context);
    expect(result.length).toBe(2);
    expect(result[0].role).toBe('system');
    expect(result[0].content).toContain('test.json');
    expect(result[0].content).toContain('{"key": "value"}');
  });

  it('includes dynatrace data in context', () => {
    const context: ContextPayload = {
      files: [],
      dynatraceData: { problems: [{ id: 'P-1', title: 'High CPU' }] },
    };

    const result = buildMCPContext(baseMessages, context);
    expect(result.length).toBe(2);
    expect(result[0].content).toContain('Dynatrace Data');
    expect(result[0].content).toContain('High CPU');
  });

  it('includes system prompt in context', () => {
    const context: ContextPayload = {
      files: [],
      systemPrompt: 'You are a Dynatrace expert assistant.',
    };

    const result = buildMCPContext(baseMessages, context);
    expect(result[0].content).toContain('Dynatrace expert assistant');
  });

  it('merges all context types', () => {
    const context: ContextPayload = {
      files: [{ name: 'config.yaml', content: 'key: val', type: 'text/yaml', size: 8 }],
      dynatraceData: { hosts: 5 },
      systemPrompt: 'Be helpful.',
    };

    const result = buildMCPContext(baseMessages, context);
    expect(result.length).toBe(2);
    expect(result[0].content).toContain('Be helpful');
    expect(result[0].content).toContain('config.yaml');
    expect(result[0].content).toContain('"hosts": 5');
  });
});
