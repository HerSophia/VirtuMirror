/**
 * 微博 App 上下文提供器
 *
 * 将叙事集成和现有内容查询转换为 ContextProvider 接口
 * @see docs/systems/llm-task-service.md
 */

import type { ContextProvider } from '@/services/llmTask/types';
import {
  narrativeCache,
  getExistingPostsSummary,
  getExistingHotSearchesSummary,
} from '../stores/llm/narrativeIntegration';
import { WEIBO_APP_ID } from './weiboTaskDefinitions';

// ==================== 叙事内容提供器 ====================

/**
 * 叙事内容提供器
 * 注入来自酒馆的聊天叙事内容
 */
export const narrativeContextProvider: ContextProvider = {
  id: 'weibo:narrative',
  appId: WEIBO_APP_ID,
  name: '叙事内容提供器',
  description: '注入来自酒馆的聊天叙事内容，用于生成与故事相关的微博内容',
  priority: 10, // 高优先级

  async getContext(): Promise<Record<string, string>> {
    const cache = narrativeCache.value;

    if (!cache || !cache.content) {
      return {
        narrative: '（暂无叙事内容，请在酒馆中进行对话后再执行任务）',
        narrativeAvailable: 'false',
      };
    }

    return {
      narrative: cache.content,
      narrativeAvailable: 'true',
      narrativeMessageId: String(cache.messageId || ''),
    };
  },

  getMetadata() {
    const cache = narrativeCache.value;
    return {
      available: !!cache?.content,
      contentLength: cache?.content?.length || 0,
      messageId: cache?.messageId,
      swipeId: cache?.swipeId,
      sessionId: cache?.sessionId,
      timestamp: cache?.timestamp,
    };
  },
};

// ==================== 现有内容提供器 ====================

/**
 * 现有内容提供器
 * 注入现有博文和热搜，用于避免重复生成
 */
export const existingContentProvider: ContextProvider = {
  id: 'weibo:existing-content',
  appId: WEIBO_APP_ID,
  name: '现有内容提供器',
  description: '注入现有博文和热搜摘要，用于避免 LLM 生成重复内容',
  priority: 20,

  async getContext(): Promise<Record<string, string>> {
    // 并行获取现有内容
    const [existingPosts, existingHotSearches] = await Promise.all([
      getExistingPostsSummary(10),
      getExistingHotSearchesSummary(20),
    ]);

    return {
      existingPosts,
      existingHotSearches,
    };
  },

  getMetadata() {
    return {
      description: '提供最近10条博文和20条热搜摘要',
    };
  },
};

// ==================== 导出 ====================

/**
 * 微博上下文提供器列表
 */
export const weiboContextProviders: ContextProvider[] = [
  narrativeContextProvider,
  existingContentProvider,
];

/**
 * 获取微博上下文提供器
 */
export function getWeiboContextProvider(providerId: string): ContextProvider | undefined {
  return weiboContextProviders.find((p) => p.id === providerId);
}
