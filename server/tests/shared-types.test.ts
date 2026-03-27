import { describe, it, expect } from 'vitest';
import {
  AVAILABLE_MODELS,
  PREDEFINED_PROMPTS,
  type ChatMessage,
  type LLMModel,
  type PredefinedPrompt,
} from '../../shared/src/index.js';

describe('shared types and constants', () => {
  it('has available models defined', () => {
    expect(AVAILABLE_MODELS.length).toBeGreaterThan(0);
    AVAILABLE_MODELS.forEach((model: LLMModel) => {
      expect(model.id).toBeTruthy();
      expect(model.name).toBeTruthy();
      expect(model.provider).toBe('copilot');
    });
  });

  it('has predefined prompts with required fields', () => {
    expect(PREDEFINED_PROMPTS.length).toBeGreaterThan(0);
    PREDEFINED_PROMPTS.forEach((prompt: PredefinedPrompt) => {
      expect(prompt.id).toBeTruthy();
      expect(prompt.label).toBeTruthy();
      expect(prompt.category).toBeTruthy();
      expect(prompt.text).toBeTruthy();
    });
  });

  it('has unique prompt IDs', () => {
    const ids = PREDEFINED_PROMPTS.map(p => p.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('ChatMessage type is correctly shaped', () => {
    const msg: ChatMessage = {
      id: 'test',
      role: 'user',
      content: 'hello',
      timestamp: Date.now(),
    };
    expect(msg.role).toBe('user');
  });
});
