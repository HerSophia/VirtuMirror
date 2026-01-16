/**
 * AI Store
 * AI 服务的响应式状态管理
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type {
  GenerateOptions,
  StreamOptions,
  GenerateResult,
  StreamHandle,
  AIError,
  ProviderInfo,
  RequestInfo,
  QueueStatus,
} from '@/services/ai/types';
import { RequestPriority } from '@/services/ai/types';
import { getAIService } from '@/services/ai';
import { SystemPromptService } from '@/services/systemPromptService';

/**
 * 生成记录
 */
interface GenerationRecord {
  requestId: string;
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  timestamp: number;
}

export const useAIStore = defineStore('ai', () => {
  // ==================== 状态 ====================

  /** 是否正在生成 */
  const isGenerating = ref(false);

  /** 当前活动的请求 ID */
  const activeRequestId = ref<string | null>(null);

  /** 最后一次错误 */
  const lastError = ref<AIError | null>(null);

  /** 当前 Provider 信息 */
  const providerInfo = ref<ProviderInfo | null>(null);

  /** 活动请求列表 */
  const activeRequests = ref<RequestInfo[]>([]);

  /** 队列状态 */
  const queueStatus = ref<QueueStatus | null>(null);

  /** 生成历史（可选，用于调试） */
  const generationHistory = ref<GenerationRecord[]>([]);

  /** 服务是否已初始化 */
  const initialized = ref(false);

  // ==================== 计算属性 ====================

  /** 是否可以发起生成 */
  const canGenerate = computed(() => {
    return initialized.value && !isGenerating.value;
  });

  /** 是否使用自定义 API */
  const isUsingCustomApi = computed(() => {
    return providerInfo.value?.source !== 'tavern';
  });

  /** 当前 Provider 名称 */
  const providerName = computed(() => {
    return providerInfo.value?.name || '未配置';
  });

  /** 当前模型 */
  const currentModel = computed(() => {
    return providerInfo.value?.modelId || 'default';
  });

  // ==================== Actions ====================

  /**
   * 初始化 Store
   */
  async function initialize() {
    if (initialized.value) return;
    
    const service = getAIService();
    await service.initialize();

    providerInfo.value = service.getProviderInfo();
    queueStatus.value = service.getQueueStatus();

    // 监听事件
    service.on('start', (requestId: string) => {
      isGenerating.value = true;
      activeRequestId.value = requestId;
      lastError.value = null;
    });

    service.on('finish', (requestId: string, result: GenerateResult) => {
      isGenerating.value = false;
      if (activeRequestId.value === requestId) {
        activeRequestId.value = null;
      }
      // 记录历史
      addToHistory(requestId, result);
      // 更新队列状态
      queueStatus.value = service.getQueueStatus();
    });

    service.on('error', (requestId: string, error: AIError) => {
      isGenerating.value = false;
      lastError.value = error;
      if (activeRequestId.value === requestId) {
        activeRequestId.value = null;
      }
      // 更新队列状态
      queueStatus.value = service.getQueueStatus();
    });

    service.on('abort', (requestId: string) => {
      isGenerating.value = false;
      if (activeRequestId.value === requestId) {
        activeRequestId.value = null;
      }
      // 更新队列状态
      queueStatus.value = service.getQueueStatus();
    });

    initialized.value = true;
  }

  /**
   * 扩展的生成选项（支持系统提示词注入）
   */
  interface ExtendedGenerateOptions extends GenerateOptions {
    /** 来源 App ID（用于加载 App 级系统提示词） */
    appId?: string;
    /** 场景标识（用于过滤适用的系统提示词） */
    scene?: string;
    /** 是否禁用系统提示词注入（默认 false，即启用注入） */
    disableSystemPrompt?: boolean;
  }

  /**
   * 生成文本（非流式）
   * 
   * 【系统提示词注入】
   * 除非显式设置 disableSystemPrompt: true，否则会自动注入全局和 App 级系统提示词。
   * 这确保了所有 LLM 请求都遵循全局的角色扮演指令和故事背景。
   */
  async function generate(
    options: ExtendedGenerateOptions,
    priority?: RequestPriority
  ): Promise<GenerateResult> {
    if (!initialized.value) {
      await initialize();
    }
    
    // 组装系统提示词（除非显式禁用）
    let finalSystemPrompt = options.system;
    if (!options.disableSystemPrompt) {
      const assembled = SystemPromptService.assemble({
        appId: options.appId,
        scene: options.scene,
        baseSystemPrompt: options.system,
      });
      finalSystemPrompt = assembled.systemPrompt || undefined;
      
      // 调试输出
      if (assembled.appliedPrompts.length > 0) {
        console.log('[AIStore] 已注入系统提示词:', 
          assembled.appliedPrompts.map(p => `[${p.scope}] ${p.name}`).join(', ')
        );
      }
    }
    
    const service = getAIService();
    return service.generateText(
      {
        ...options,
        system: finalSystemPrompt,
      },
      priority
    );
  }

  /**
   * 流式生成文本
   */
  function streamGenerate(
    options: StreamOptions,
    priority?: RequestPriority
  ): StreamHandle {
    if (!initialized.value) {
      // 同步初始化会有问题，应该确保已初始化
      console.warn('[AIStore] Service not initialized, call initialize() first');
    }
    
    const service = getAIService();
    return service.streamText(options, priority);
  }

  /**
   * 取消当前生成
   */
  function abort(requestId?: string) {
    const service = getAIService();
    service.abort(requestId);
  }

  /**
   * 取消所有请求
   */
  function abortAll() {
    const service = getAIService();
    service.abortAll();
  }

  /**
   * 切换 Provider
   */
  function switchProvider(presetId: string | null) {
    const service = getAIService();
    service.switchProvider(presetId);
    providerInfo.value = service.getProviderInfo();
  }

  /**
   * 刷新 Provider
   */
  function refreshProvider() {
    const service = getAIService();
    service.refreshProvider();
    providerInfo.value = service.getProviderInfo();
  }

  /**
   * 清除错误
   */
  function clearError() {
    lastError.value = null;
  }

  /**
   * 更新队列状态
   */
  function updateQueueStatus() {
    const service = getAIService();
    queueStatus.value = service.getQueueStatus();
  }

  // ==================== 私有方法 ====================

  function addToHistory(requestId: string, result: GenerateResult) {
    generationHistory.value.unshift({
      requestId,
      text: result.text,
      usage: result.usage,
      timestamp: Date.now(),
    });

    // 保留最近 50 条
    if (generationHistory.value.length > 50) {
      generationHistory.value.pop();
    }
  }

  return {
    // 状态
    isGenerating,
    activeRequestId,
    lastError,
    providerInfo,
    activeRequests,
    queueStatus,
    generationHistory,
    initialized,

    // 计算属性
    canGenerate,
    isUsingCustomApi,
    providerName,
    currentModel,

    // Actions
    initialize,
    generate,
    streamGenerate,
    abort,
    abortAll,
    switchProvider,
    refreshProvider,
    clearError,
    updateQueueStatus,
  };
});
