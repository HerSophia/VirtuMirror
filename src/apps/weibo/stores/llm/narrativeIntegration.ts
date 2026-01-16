/**
 * 叙事集成模块
 * 处理来自酒馆的叙事内容订阅和上下文管理
 */

import { ref } from 'vue';
import { 
  narrativeService, 
  type NarrativeEvent,
} from '@/services/narrativeService';
import { db } from '@/services/database';
import { tryUseAppRuntime } from '@/services/appRuntime';

// ==================== 类型定义 ====================

export interface NarrativeCache {
  content: string;
  messageId: number;
  swipeId: number;
  sessionId: string;
  timestamp: number;
}

export interface NarrativeContext {
  content: string;
  available: boolean;
  messageId?: number;
}

export interface ExistingContentContext {
  existingPosts: string;
  existingHotSearches: string;
}

// ==================== 状态 ====================

/** 叙事内容缓存（来自酒馆的聊天内容） */
export const narrativeCache = ref<NarrativeCache | null>(null);

/** 叙事订阅取消函数 */
let narrativeUnsubscribe: (() => void) | null = null;

// ==================== 叙事订阅 ====================

/**
 * 初始化叙事内容订阅
 * 订阅来自酒馆的聊天内容，缓存最新的叙事
 */
export function initializeNarrativeSubscription(
  onLog?: (level: 'info' | 'warn' | 'error', message: string) => void
): void {
  if (narrativeUnsubscribe) {
    onLog?.('info', '叙事订阅已存在');
    return;
  }
  
  narrativeUnsubscribe = narrativeService.subscribe((event: NarrativeEvent) => {
    // 缓存最新的叙事内容
    narrativeCache.value = {
      content: event.content,
      messageId: event.messageId,
      swipeId: event.swipeId,
      sessionId: event.sessionId,
      timestamp: event.timestamp,
    };
    
    console.log('[NarrativeIntegration] 收到叙事内容:', {
      messageId: event.messageId,
      contentLength: event.content.length,
      preview: event.content.slice(0, 100) + (event.content.length > 100 ? '...' : ''),
    });
  });
  
  onLog?.('info', '叙事订阅已初始化');
  console.log('[NarrativeIntegration] 叙事订阅已初始化');
}

/**
 * 取消叙事订阅
 */
export function destroyNarrativeSubscription(): void {
  if (narrativeUnsubscribe) {
    narrativeUnsubscribe();
    narrativeUnsubscribe = null;
    console.log('[NarrativeIntegration] 叙事订阅已销毁');
  }
}

// ==================== 上下文获取 ====================

/**
 * 获取当前叙事上下文
 */
export function getNarrativeContext(): NarrativeContext {
  if (!narrativeCache.value || !narrativeCache.value.content) {
    return {
      content: '（暂无叙事内容，请在酒馆中进行对话后再执行任务）',
      available: false,
    };
  }
  
  return {
    content: narrativeCache.value.content,
    available: true,
    messageId: narrativeCache.value.messageId,
  };
}

/**
 * 获取叙事缓存的元数据
 */
export function getNarrativeCacheMetadata(): {
  messageId?: number;
  swipeId?: number;
  sessionId?: string;
  timestamp?: number;
} | undefined {
  if (!narrativeCache.value) return undefined;
  
  return {
    messageId: narrativeCache.value.messageId,
    swipeId: narrativeCache.value.swipeId,
    sessionId: narrativeCache.value.sessionId,
    timestamp: narrativeCache.value.timestamp,
  };
}

// ==================== 现有内容查询 ====================

/**
 * 获取已存在的博文摘要（用于避免重复生成）
 * @param limit 获取的博文数量限制
 * @returns 博文摘要文本
 */
export async function getExistingPostsSummary(limit: number = 10): Promise<string> {
  try {
    // 获取 App Runtime 的 namespace（如果可用）
    const runtime = tryUseAppRuntime();
    const namespace = runtime?.identity.dataNamespace;
    
    // 使用 toArray() 获取所有数据后在内存中排序和截取
    const allPosts = await db.socialPosts
      .where('platformId').equals('weibo')
      .toArray();
    
    // 按 namespace 过滤（如果有的话）
    const filteredPosts = namespace
      ? allPosts.filter(p => p.namespace === namespace || p.namespace === undefined)
      : allPosts;
    
    // 按时间戳降序排序（最新的在前）
    const posts = filteredPosts
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
    
    if (posts.length === 0) {
      return '';
    }
    
    // 提取博文内容摘要
    const summaries = posts.map((post, index) => {
      const text = post.payload?.text || '';
      // 截取前100字作为摘要
      const summary = text.length > 100 ? text.slice(0, 100) + '...' : text;
      return `${index + 1}. ${summary}`;
    });
    
    return summaries.join('\n');
  } catch (e) {
    console.warn('[NarrativeIntegration] 获取已有博文失败:', e);
    return '';
  }
}

/**
 * 获取当前热搜榜摘要（用于避免重复生成）
 * @param limit 获取的热搜数量限制
 * @returns 热搜摘要文本
 */
export async function getExistingHotSearchesSummary(limit: number = 20): Promise<string> {
  try {
    // 获取 App Runtime 的 namespace（如果可用）
    const runtime = tryUseAppRuntime();
    const namespace = runtime?.identity.dataNamespace;
    
    // 使用 toArray() 获取所有数据后在内存中排序和截取
    const allTopics = await db.socialTopics
      .where('platformId').equals('weibo')
      .toArray();
    
    // 按 namespace 过滤（如果有的话）
    const filteredTopics = namespace
      ? allTopics.filter(t => t.namespace === namespace || t.namespace === undefined)
      : allTopics;
    
    // 按创建时间降序排序（最新的在前）
    const topics = filteredTopics
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
    
    console.log(`[NarrativeIntegration] 从数据库获取到 ${topics.length} 条热搜`);
    
    if (topics.length === 0) {
      return '';
    }
    
    // 提取热搜关键词
    const keywords = topics.map((topic, index) => {
      const keyword = topic.keyword || '';
      const summary = topic.summary ? ` - ${topic.summary.slice(0, 30)}` : '';
      return `${index + 1}. ${keyword}${summary}`;
    });
    
    return keywords.join('\n');
  } catch (e) {
    console.warn('[NarrativeIntegration] 获取已有热搜失败:', e);
    return '';
  }
}

/**
 * 获取现有内容上下文（博文和热搜）
 * 用于在生成新内容时避免重复
 */
export async function getExistingContentContext(): Promise<ExistingContentContext> {
  const [posts, hotSearches] = await Promise.all([
    getExistingPostsSummary(10),
    getExistingHotSearchesSummary(20),
  ]);
  
  return {
    existingPosts: posts,
    existingHotSearches: hotSearches,
  };
}
