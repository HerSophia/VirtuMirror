/**
 * Provider 工厂
 * 根据配置创建 LanguageModel 实例
 */

import type { LanguageModel } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { ApiConfig, ProviderSource } from './types';
import { PROVIDER_ENDPOINTS } from './constants';

/**
 * Provider 工厂
 * 根据配置创建 LanguageModel 实例
 */
export class ProviderFactory {
  /**
   * 根据 API 配置创建 Provider
   */
  static createFromConfig(config: ApiConfig): LanguageModel {
    switch (config.source) {
      case 'openai':
        return this.createOpenAI(config);
      case 'anthropic':
        return this.createAnthropic(config);
      case 'google':
        return this.createGoogle(config);
      case 'deepseek':
        return this.createDeepSeek(config);
      case 'mock':
        return this.createMock();
      default:
        // 默认尝试 OpenAI Compatible
        return this.createOpenAICompatible(config);
    }
  }

  /**
   * 创建 OpenAI Provider
   * 使用 .chat() 方法确保使用 /chat/completions 端点
   */
  static createOpenAI(config: ApiConfig): LanguageModel {
    const openai = createOpenAI({
      apiKey: config.apiKey,
      baseURL: config.apiUrl || undefined,
    });
    // 使用 .chat() 而不是直接调用 openai()
    // 这确保使用 /chat/completions 端点，而不是新的 /responses 端点
    return openai.chat(config.model);
  }

  /**
   * 创建 OpenAI Compatible Provider
   * 用于 DeepSeek、Moonshot、Groq 等兼容 API
   */
  static createOpenAICompatible(config: ApiConfig): LanguageModel {
    const openai = createOpenAI({
      apiKey: config.apiKey,
      baseURL: config.apiUrl,
    });
    // 使用 .chat() 确保使用 /chat/completions 端点
    // 这对于大多数 OpenAI 兼容的第三方服务是必需的
    return openai.chat(config.model);
  }

  /**
   * 创建 Anthropic Provider
   */
  static createAnthropic(config: ApiConfig): LanguageModel {
    const anthropic = createAnthropic({
      apiKey: config.apiKey,
      baseURL: config.apiUrl || undefined,
    });
    return anthropic(config.model);
  }

  /**
   * 创建 Google Gemini Provider
   */
  static createGoogle(config: ApiConfig): LanguageModel {
    const google = createGoogleGenerativeAI({
      apiKey: config.apiKey,
      baseURL: config.apiUrl || undefined,
    });
    return google(config.model);
  }

  /**
   * 创建 DeepSeek Provider
   * 使用 OpenAI Compatible 模式
   */
  static createDeepSeek(config: ApiConfig): LanguageModel {
    return this.createOpenAICompatible({
      ...config,
      apiUrl: config.apiUrl || PROVIDER_ENDPOINTS.deepseek,
    });
  }

  /**
   * 创建 Mock Provider（开发用）
   */
  static createMock(): LanguageModel {
    // 复用现有的 MockLanguageModelV1
    // 动态导入避免循环依赖
    const { MockLanguageModelV1 } = require('@/mock/aiProvider');
    return new MockLanguageModelV1('mock', 'mock-model');
  }

  /**
   * 获取支持的 Provider 列表
   */
  static getSupportedProviders(): { source: ProviderSource; name: string }[] {
    return [
      { source: 'openai', name: 'OpenAI' },
      { source: 'anthropic', name: 'Anthropic' },
      { source: 'google', name: 'Google Gemini' },
      { source: 'deepseek', name: 'DeepSeek' },
      { source: 'mock', name: 'Mock (Dev)' },
      { source: 'tavern', name: '酒馆 API' },
    ];
  }
}
