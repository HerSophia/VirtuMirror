/**
 * Provider 管理器
 * 负责 Provider 的生命周期管理和切换
 */

import type { LanguageModel } from 'ai';
import { ProviderFactory } from './providerFactory';
import { getGlobalConfigService } from '../globalConfigService';
import type { ApiConfig, ProviderInfo, ProviderSource } from './types';
import { PROVIDER_NAMES } from './constants';
import { maskUrl } from './utils';

/**
 * Provider 管理器
 * 负责 Provider 的生命周期管理和切换
 */
export class ProviderManager {
  private static instance: ProviderManager;

  private currentProvider: LanguageModel | null = null;
  private currentConfig: ApiConfig | null = null;
  private providerCache = new Map<string, LanguageModel>();

  static getInstance(): ProviderManager {
    if (!this.instance) {
      this.instance = new ProviderManager();
    }
    return this.instance;
  }

  /**
   * 初始化 Provider
   * 根据全局配置加载当前激活的 Provider
   */
  async initialize(): Promise<void> {
    const configService = getGlobalConfigService();
    const activeConfig = configService.getActiveApiConfig();

    if (activeConfig) {
      this.currentConfig = this.convertToApiConfig(activeConfig);
      this.currentProvider = this.createOrGetCached(this.currentConfig);
    }
  }

  /**
   * 获取当前激活的 Provider
   */
  getActiveProvider(): LanguageModel | null {
    return this.currentProvider;
  }

  /**
   * 获取当前 Provider 信息
   */
  getProviderInfo(): ProviderInfo | null {
    if (!this.currentConfig) {
      return {
        source: 'tavern',
        name: '酒馆 API',
        modelId: 'default',
        ready: true,
      };
    }

    return {
      source: this.currentConfig.source,
      name: this.getProviderName(this.currentConfig.source),
      modelId: this.currentConfig.model,
      baseUrl: maskUrl(this.currentConfig.apiUrl),
      ready: this.currentProvider !== null,
    };
  }

  /**
   * 切换到指定预设
   */
  switchToPreset(presetId: string | null): void {
    if (presetId === null) {
      // 切换到酒馆 API 模式
      this.currentProvider = null;
      this.currentConfig = null;
      return;
    }

    const configService = getGlobalConfigService();
    const presets = configService.getApiPresets();
    const preset = presets.find(p => p.id === presetId);

    if (!preset) {
      throw new Error(`Preset not found: ${presetId}`);
    }

    this.currentConfig = this.convertToApiConfig(preset.config);
    this.currentProvider = this.createOrGetCached(this.currentConfig);
  }

  /**
   * 刷新当前 Provider（配置变更后调用）
   */
  refresh(): void {
    if (this.currentConfig) {
      // 清除缓存，强制重新创建
      const cacheKey = this.getCacheKey(this.currentConfig);
      this.providerCache.delete(cacheKey);
      this.currentProvider = this.createOrGetCached(this.currentConfig);
    } else {
      // 重新加载配置
      this.initialize();
    }
  }

  /**
   * 清除所有缓存
   */
  clearCache(): void {
    this.providerCache.clear();
  }

  // ==================== 私有方法 ====================

  private createOrGetCached(config: ApiConfig): LanguageModel {
    const cacheKey = this.getCacheKey(config);

    if (!this.providerCache.has(cacheKey)) {
      const provider = ProviderFactory.createFromConfig(config);
      this.providerCache.set(cacheKey, provider);
    }

    return this.providerCache.get(cacheKey)!;
  }

  private getCacheKey(config: ApiConfig): string {
    return `${config.source}:${config.apiUrl}:${config.model}`;
  }

  private convertToApiConfig(rawConfig: any): ApiConfig {
    return {
      source: rawConfig.source || 'openai',
      apiUrl: rawConfig.apiUrl,
      apiKey: rawConfig.apiKey,
      model: rawConfig.model,
      defaultOptions: {
        maxTokens: rawConfig.maxTokens,
        temperature: rawConfig.temperature,
        topP: rawConfig.topP,
        frequencyPenalty: rawConfig.frequencyPenalty,
        presencePenalty: rawConfig.presencePenalty,
      },
    };
  }

  private getProviderName(source: ProviderSource): string {
    return PROVIDER_NAMES[source] || source;
  }
}

/**
 * 获取 ProviderManager 单例
 */
export function getProviderManager(): ProviderManager {
  return ProviderManager.getInstance();
}
