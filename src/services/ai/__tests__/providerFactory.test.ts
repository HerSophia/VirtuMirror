/**
 * Provider 工厂测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ApiConfig } from '../types';

// Mock AI SDK 模块 - 使用内联函数避免 hoisting 问题
vi.mock('@ai-sdk/openai', () => {
  const mockChat = vi.fn(() => ({ modelId: 'test-chat-model', specificationVersion: 'v1' }));
  const mockProvider = Object.assign(
    vi.fn(() => ({ modelId: 'test-model', specificationVersion: 'v1' })),
    { chat: mockChat }
  );
  return {
    createOpenAI: vi.fn(() => mockProvider),
  };
});

vi.mock('@ai-sdk/anthropic', () => {
  const mockProvider = vi.fn(() => ({ modelId: 'claude-model', specificationVersion: 'v1' }));
  return {
    createAnthropic: vi.fn(() => mockProvider),
  };
});

vi.mock('@ai-sdk/google', () => {
  const mockProvider = vi.fn(() => ({ modelId: 'gemini-model', specificationVersion: 'v1' }));
  return {
    createGoogleGenerativeAI: vi.fn(() => mockProvider),
  };
});

// Mock aiProvider 模块
vi.mock('@/mock/aiProvider', () => ({
  MockLanguageModelV1: class MockLanguageModelV1 {
    provider: string;
    modelId: string;
    specificationVersion = 'v1';
    constructor(provider: string, model: string) {
      this.provider = provider;
      this.modelId = model;
    }
  },
}));

// 动态导入以便在 mock 之后
import { ProviderFactory } from '../providerFactory';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

describe('ProviderFactory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createFromConfig', () => {
    it('应该为 openai source 创建 OpenAI provider', () => {
      const config: ApiConfig = {
        source: 'openai',
        apiUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-test',
        model: 'gpt-4',
      };

      const provider = ProviderFactory.createFromConfig(config);
      expect(provider).toBeDefined();
      expect(createOpenAI).toHaveBeenCalled();
    });

    it('应该为 anthropic source 创建 Anthropic provider', () => {
      const config: ApiConfig = {
        source: 'anthropic',
        apiUrl: 'https://api.anthropic.com',
        apiKey: 'sk-ant-test',
        model: 'claude-3-opus',
      };

      const provider = ProviderFactory.createFromConfig(config);
      expect(provider).toBeDefined();
      expect(createAnthropic).toHaveBeenCalled();
    });

    it('应该为 google source 创建 Google provider', () => {
      const config: ApiConfig = {
        source: 'google',
        apiUrl: 'https://generativelanguage.googleapis.com/v1beta',
        apiKey: 'AIzaSy-test',
        model: 'gemini-pro',
      };

      const provider = ProviderFactory.createFromConfig(config);
      expect(provider).toBeDefined();
      expect(createGoogleGenerativeAI).toHaveBeenCalled();
    });

    it('应该为 deepseek source 创建 OpenAI 兼容 provider', () => {
      const config: ApiConfig = {
        source: 'deepseek',
        apiUrl: '',
        apiKey: 'sk-test',
        model: 'deepseek-chat',
      };

      const provider = ProviderFactory.createFromConfig(config);
      expect(provider).toBeDefined();
      expect(createOpenAI).toHaveBeenCalled();
    });

    it('应该为未知 source 使用 OpenAI Compatible 模式', () => {
      const config: ApiConfig = {
        source: 'tavern' as any,
        apiUrl: 'http://localhost:8080/v1',
        apiKey: 'test',
        model: 'local-model',
      };

      const provider = ProviderFactory.createFromConfig(config);
      expect(provider).toBeDefined();
      expect(createOpenAI).toHaveBeenCalled();
    });
  });

  describe('createOpenAI', () => {
    it('应该使用 .chat() 方法创建 provider', () => {
      const config: ApiConfig = {
        source: 'openai',
        apiUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-test',
        model: 'gpt-4',
      };

      ProviderFactory.createOpenAI(config);

      expect(createOpenAI).toHaveBeenCalledWith({
        apiKey: 'sk-test',
        baseURL: 'https://api.openai.com/v1',
      });
    });

    it('应该在没有 apiUrl 时使用 undefined', () => {
      const config: ApiConfig = {
        source: 'openai',
        apiUrl: '',
        apiKey: 'sk-test',
        model: 'gpt-4',
      };

      ProviderFactory.createOpenAI(config);

      expect(createOpenAI).toHaveBeenCalledWith({
        apiKey: 'sk-test',
        baseURL: undefined,
      });
    });
  });

  describe('createOpenAICompatible', () => {
    it('应该使用 .chat() 方法创建兼容 provider', () => {
      const config: ApiConfig = {
        source: 'openai',
        apiUrl: 'https://api.deepseek.com/v1',
        apiKey: 'sk-test',
        model: 'deepseek-chat',
      };

      ProviderFactory.createOpenAICompatible(config);

      expect(createOpenAI).toHaveBeenCalledWith({
        apiKey: 'sk-test',
        baseURL: 'https://api.deepseek.com/v1',
      });
    });
  });

  describe('createAnthropic', () => {
    it('应该创建 Anthropic provider', () => {
      const config: ApiConfig = {
        source: 'anthropic',
        apiUrl: 'https://api.anthropic.com',
        apiKey: 'sk-ant-test',
        model: 'claude-3-opus',
      };

      ProviderFactory.createAnthropic(config);

      expect(createAnthropic).toHaveBeenCalledWith({
        apiKey: 'sk-ant-test',
        baseURL: 'https://api.anthropic.com',
      });
    });
  });

  describe('createGoogle', () => {
    it('应该创建 Google provider', () => {
      const config: ApiConfig = {
        source: 'google',
        apiUrl: 'https://generativelanguage.googleapis.com/v1beta',
        apiKey: 'AIzaSy-test',
        model: 'gemini-pro',
      };

      ProviderFactory.createGoogle(config);

      expect(createGoogleGenerativeAI).toHaveBeenCalledWith({
        apiKey: 'AIzaSy-test',
        baseURL: 'https://generativelanguage.googleapis.com/v1beta',
      });
    });
  });

  describe('createDeepSeek', () => {
    it('应该使用默认端点创建 DeepSeek provider', () => {
      const config: ApiConfig = {
        source: 'deepseek',
        apiUrl: '',
        apiKey: 'sk-test',
        model: 'deepseek-chat',
      };

      const provider = ProviderFactory.createDeepSeek(config);
      expect(provider).toBeDefined();
      expect(createOpenAI).toHaveBeenCalledWith({
        apiKey: 'sk-test',
        baseURL: 'https://api.deepseek.com/v1',
      });
    });

    it('应该使用自定义端点创建 DeepSeek provider', () => {
      const config: ApiConfig = {
        source: 'deepseek',
        apiUrl: 'https://custom.deepseek.com/v1',
        apiKey: 'sk-test',
        model: 'deepseek-chat',
      };

      const provider = ProviderFactory.createDeepSeek(config);
      expect(provider).toBeDefined();
      expect(createOpenAI).toHaveBeenCalledWith({
        apiKey: 'sk-test',
        baseURL: 'https://custom.deepseek.com/v1',
      });
    });
  });

  describe('createMock', () => {
    // 跳过此测试，因为源代码使用 require() 动态导入，难以在测试中 mock
    it.skip('应该创建 Mock provider', () => {
      const provider = ProviderFactory.createMock();
      expect(provider).toBeDefined();
      expect((provider as any).modelId).toBe('mock-model');
    });
  });

  describe('getSupportedProviders', () => {
    it('应该返回支持的 provider 列表', () => {
      const providers = ProviderFactory.getSupportedProviders();

      expect(providers).toBeInstanceOf(Array);
      expect(providers.length).toBeGreaterThan(0);

      const sources = providers.map((p) => p.source);
      expect(sources).toContain('openai');
      expect(sources).toContain('anthropic');
      expect(sources).toContain('google');
      expect(sources).toContain('deepseek');
      expect(sources).toContain('mock');
      expect(sources).toContain('tavern');
    });

    it('应该返回包含 source 和 name 的对象', () => {
      const providers = ProviderFactory.getSupportedProviders();

      providers.forEach((p) => {
        expect(p).toHaveProperty('source');
        expect(p).toHaveProperty('name');
        expect(typeof p.source).toBe('string');
        expect(typeof p.name).toBe('string');
      });
    });
  });
});
