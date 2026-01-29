/**
 * 模型列表服务测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchOpenAIModels,
  fetchAnthropicModels,
  fetchGoogleModels,
  fetchModels,
  ModelListService,
  getModelListService,
  resetModelListService,
  ANTHROPIC_MODELS,
} from '../modelList';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('modelList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetModelListService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('fetchOpenAIModels', () => {
    it('应该成功获取模型列表', async () => {
      const mockResponse = {
        object: 'list',
        data: [
          { id: 'gpt-4', object: 'model', created: 1234567890, owned_by: 'openai' },
          { id: 'gpt-3.5-turbo', object: 'model', created: 1234567890, owned_by: 'openai' },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await fetchOpenAIModels({
        apiUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-test',
      });

      expect(result.success).toBe(true);
      expect(result.models).toHaveLength(2);
      expect(result.models[0].id).toBe('gpt-3.5-turbo'); // 按 ID 排序
      expect(result.models[1].id).toBe('gpt-4');
    });

    it('应该处理空的模型列表', async () => {
      const mockResponse = {
        object: 'list',
        data: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await fetchOpenAIModels({
        apiUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-test',
      });

      expect(result.success).toBe(true);
      expect(result.models).toHaveLength(0);
    });

    it('应该处理 HTTP 错误', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: () => Promise.resolve({ error: { message: 'Invalid API key' } }),
      });

      const result = await fetchOpenAIModels({
        apiUrl: 'https://api.openai.com/v1',
        apiKey: 'invalid-key',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid API key');
    });

    it('应该处理网络错误', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await fetchOpenAIModels({
        apiUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('应该处理超时', async () => {
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValueOnce(abortError);

      const result = await fetchOpenAIModels({
        apiUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-test',
        timeout: 100,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('超时');
    });

    it('应该过滤只保留聊天模型', async () => {
      const mockResponse = {
        object: 'list',
        data: [
          { id: 'gpt-4', object: 'model', created: 1234567890, owned_by: 'openai' },
          { id: 'text-embedding-ada-002', object: 'model', created: 1234567890, owned_by: 'openai' },
          { id: 'dall-e-3', object: 'model', created: 1234567890, owned_by: 'openai' },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await fetchOpenAIModels({
        apiUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-test',
        chatModelsOnly: true,
      });

      expect(result.success).toBe(true);
      // gpt-4 是 chat 类型，text-embedding 是 embedding 类型，dall-e 是 image 类型
      expect(result.models.some((m) => m.id === 'gpt-4')).toBe(true);
      expect(result.models.some((m) => m.id === 'text-embedding-ada-002')).toBe(false);
      expect(result.models.some((m) => m.id === 'dall-e-3')).toBe(false);
    });

    it('应该规范化 URL', async () => {
      const mockResponse = {
        object: 'list',
        data: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      await fetchOpenAIModels({
        apiUrl: 'https://api.openai.com/v1/chat/completions',
        apiKey: 'sk-test',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/models',
        expect.any(Object)
      );
    });
  });

  describe('fetchAnthropicModels', () => {
    it('应该返回预定义的 Anthropic 模型列表', async () => {
      const result = await fetchAnthropicModels();

      expect(result.success).toBe(true);
      expect(result.models).toEqual(ANTHROPIC_MODELS);
      expect(result.responseTime).toBe(0);
    });
  });

  describe('fetchGoogleModels', () => {
    it('应该成功获取 Google 模型列表', async () => {
      const mockResponse = {
        models: [
          {
            name: 'models/gemini-pro',
            displayName: 'Gemini Pro',
            description: 'A capable model',
            supportedGenerationMethods: ['generateContent'],
            inputTokenLimit: 32000,
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await fetchGoogleModels({
        apiUrl: 'https://generativelanguage.googleapis.com/v1beta',
        apiKey: 'AIzaSy-test',
      });

      expect(result.success).toBe(true);
      expect(result.models).toHaveLength(1);
      expect(result.models[0].id).toBe('gemini-pro');
      expect(result.models[0].name).toBe('Gemini Pro');
    });

    it('应该在没有 API Key 时返回错误', async () => {
      const result = await fetchGoogleModels({
        apiUrl: 'https://generativelanguage.googleapis.com/v1beta',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('API Key');
    });
  });

  describe('fetchModels', () => {
    it('应该根据 source 选择正确的获取方法 - openai', async () => {
      const mockResponse = {
        object: 'list',
        data: [{ id: 'gpt-4', object: 'model', created: 1234567890, owned_by: 'openai' }],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await fetchModels({
        apiUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-test',
        source: 'openai',
      });

      expect(result.success).toBe(true);
    });

    it('应该根据 source 选择正确的获取方法 - anthropic', async () => {
      const result = await fetchModels({
        apiUrl: 'https://api.anthropic.com',
        apiKey: 'sk-ant-test',
        source: 'anthropic',
      });

      expect(result.success).toBe(true);
      expect(result.models).toEqual(ANTHROPIC_MODELS);
    });

    it('应该根据 source 选择正确的获取方法 - google', async () => {
      const mockResponse = {
        models: [
          {
            name: 'models/gemini-pro',
            displayName: 'Gemini Pro',
            supportedGenerationMethods: ['generateContent'],
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await fetchModels({
        apiUrl: 'https://generativelanguage.googleapis.com/v1beta',
        apiKey: 'AIzaSy-test',
        source: 'google',
      });

      expect(result.success).toBe(true);
    });

    it('应该对 deepseek 使用 OpenAI 兼容方法', async () => {
      const mockResponse = {
        object: 'list',
        data: [{ id: 'deepseek-chat', object: 'model', created: 1234567890, owned_by: 'deepseek' }],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await fetchModels({
        apiUrl: 'https://api.deepseek.com/v1',
        apiKey: 'sk-test',
        source: 'deepseek',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('ModelListService', () => {
    it('应该缓存成功的结果', async () => {
      const mockResponse = {
        object: 'list',
        data: [{ id: 'gpt-4', object: 'model', created: 1234567890, owned_by: 'openai' }],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const service = new ModelListService();

      // 第一次调用
      const result1 = await service.getModels({
        apiUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-test',
        source: 'openai',
      });

      // 第二次调用（应该使用缓存）
      const result2 = await service.getModels({
        apiUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-test',
        source: 'openai',
      });

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result2.responseTime).toBe(0); // 缓存命中时 responseTime 为 0
      expect(mockFetch).toHaveBeenCalledTimes(1); // 只调用一次 fetch
    });

    it('应该在 forceRefresh 时绕过缓存', async () => {
      const mockResponse = {
        object: 'list',
        data: [{ id: 'gpt-4', object: 'model', created: 1234567890, owned_by: 'openai' }],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const service = new ModelListService();

      // 第一次调用
      await service.getModels({
        apiUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-test',
        source: 'openai',
      });

      // 强制刷新
      await service.getModels(
        {
          apiUrl: 'https://api.openai.com/v1',
          apiKey: 'sk-test',
          source: 'openai',
        },
        { forceRefresh: true }
      );

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('应该能够清除缓存', async () => {
      const mockResponse = {
        object: 'list',
        data: [{ id: 'gpt-4', object: 'model', created: 1234567890, owned_by: 'openai' }],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const service = new ModelListService();

      await service.getModels({
        apiUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-test',
        source: 'openai',
      });

      service.clearCache();

      await service.getModels({
        apiUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-test',
        source: 'openai',
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('应该能够清除特定配置的缓存', async () => {
      const mockResponse = {
        object: 'list',
        data: [{ id: 'gpt-4', object: 'model', created: 1234567890, owned_by: 'openai' }],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const service = new ModelListService();

      await service.getModels({
        apiUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-test',
        source: 'openai',
      });

      service.clearCacheFor({
        apiUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-test',
        source: 'openai',
      });

      await service.getModels({
        apiUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-test',
        source: 'openai',
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('getModelListService', () => {
    it('应该返回单例实例', () => {
      const instance1 = getModelListService();
      const instance2 = getModelListService();
      expect(instance1).toBe(instance2);
    });
  });

  describe('resetModelListService', () => {
    it('应该重置单例', () => {
      const instance1 = getModelListService();
      resetModelListService();
      const instance2 = getModelListService();
      expect(instance1).not.toBe(instance2);
    });
  });
});
