/**
 * 微博会话上下文服务
 * 管理当前显示数据的过滤条件，实现数据与酒馆会话/楼层/Swipe 绑定
 * 
 * Phase 3 重构：使用 accountStore 的统一会话信息
 * - sessionId 来自 accountStore（与 Bridge Adapter 同步）
 * - messageId/swipeId 来自 narrativeIntegration（叙事缓存）
 * 
 * 设计文档: 
 * - docs/apps/Weibo/session-binding-design.md
 * - docs/dev/Security/account-session-binding.md
 */

import { ref, computed, watch } from 'vue';
import { useAccountStore } from '@/stores/accountStore';
import { getNarrativeCacheMetadata } from '../stores/llm/narrativeIntegration';
import type { ContentSourceTracking } from '@/types/social';

// ==================== 类型定义 ====================

/**
 * 数据过滤模式
 */
export type FilterMode = 
  | 'all'      // 显示所有数据，不区分来源
  | 'session'  // 按会话过滤（推荐）
  | 'message'  // 按楼层过滤
  | 'swipe';   // 按消息页过滤（最精确）

/**
 * 微博会话上下文
 */
export interface WeiboSessionContext {
  /** 当前会话 ID（来自 accountStore，与 Bridge Adapter 同步） */
  sessionId: string | null;
  
  /** 当前最后楼层 ID（从叙事缓存获取） */
  lastMessageId: number | null;
  
  /** 当前 swipe ID（从叙事缓存获取） */
  currentSwipeId: number | null;
  
  /** 数据过滤模式 */
  filterMode: FilterMode;
}

// ==================== 状态 ====================

/** 当前上下文 */
const context = ref<WeiboSessionContext>({
  sessionId: null,
  lastMessageId: null,
  currentSwipeId: null,
  filterMode: 'session', // 默认按会话过滤
});

// ==================== 上下文管理 ====================

/**
 * 从 accountStore 同步会话 ID
 * 这是 Phase 3 的核心改动：使用 accountStore 作为会话信息的主要来源
 */
export function syncSessionIdFromAccountStore(): void {
  try {
    const accountStore = useAccountStore();
    const sessionContext = accountStore.sessionContext;
    
    if (sessionContext?.sessionId) {
      context.value.sessionId = sessionContext.sessionId;
      console.log('[SessionContext] 已从 accountStore 同步 sessionId:', sessionContext.sessionId);
    }
  } catch (e) {
    // accountStore 可能还未初始化，忽略错误
    console.warn('[SessionContext] accountStore 未就绪，跳过 sessionId 同步');
  }
}

/**
 * 从叙事缓存同步楼层/Swipe 信息
 * 保留原有的叙事缓存同步逻辑，用于获取楼层和 Swipe 信息
 */
export function syncFromNarrativeCache(): void {
  const metadata = getNarrativeCacheMetadata();
  if (metadata) {
    context.value.lastMessageId = metadata.messageId ?? null;
    context.value.currentSwipeId = metadata.swipeId ?? null;
    
    // 如果叙事缓存有 sessionId 且本地还没有，也同步过来
    // 这是为了兼容 accountStore 还未初始化的情况
    if (metadata.sessionId && !context.value.sessionId) {
      context.value.sessionId = metadata.sessionId;
    }
    
    console.log('[SessionContext] 已从叙事缓存同步楼层/Swipe:', {
      messageId: context.value.lastMessageId,
      swipeId: context.value.currentSwipeId,
    });
  }
}

/**
 * 完整同步上下文（推荐使用）
 * 优先使用 accountStore 的 sessionId，然后补充叙事缓存的楼层/Swipe 信息
 * 
 * 应在以下时机调用：
 * - 应用初始化
 * - 收到 sync 事件
 * - 收到 swipe_changed 事件
 */
export function syncContextFromNarrative(): void {
  // 1. 先从 accountStore 同步 sessionId（统一会话信息）
  syncSessionIdFromAccountStore();
  
  // 2. 从叙事缓存同步楼层/Swipe 信息
  syncFromNarrativeCache();
  
  console.log('[SessionContext] 完整同步完成:', context.value);
}

/**
 * 手动设置会话 ID
 * 用于测试或特殊场景
 */
export function setSessionId(sessionId: string | null): void {
  context.value.sessionId = sessionId;
  console.log('[SessionContext] 手动设置 sessionId:', sessionId);
}

/**
 * 获取当前会话上下文
 */
export function getSessionContext(): WeiboSessionContext {
  return context.value;
}

/**
 * 获取当前来源追踪数据（用于写入新内容）
 * 优先使用 accountStore 的 sessionId
 */
export function getCurrentSourceTracking(): ContentSourceTracking | undefined {
  // 优先使用 context 中已同步的 sessionId
  let sessionId = context.value.sessionId;
  
  // 如果没有，尝试从 accountStore 获取
  if (!sessionId) {
    try {
      const accountStore = useAccountStore();
      sessionId = accountStore.sessionContext?.sessionId ?? null;
    } catch {
      // 忽略
    }
  }
  
  // 如果还没有，尝试从叙事缓存获取
  if (!sessionId) {
    const metadata = getNarrativeCacheMetadata();
    sessionId = metadata?.sessionId ?? null;
  }
  
  if (!sessionId) {
    console.warn('[SessionContext] 无法获取会话信息，内容将不带来源追踪');
    return undefined;
  }
  
  // 获取楼层/Swipe 信息（优先使用 context，否则从叙事缓存获取）
  let messageId = context.value.lastMessageId;
  let swipeId = context.value.currentSwipeId;
  
  if (messageId === null || swipeId === null) {
    const metadata = getNarrativeCacheMetadata();
    if (metadata) {
      messageId = messageId ?? metadata.messageId ?? undefined;
      swipeId = swipeId ?? metadata.swipeId ?? undefined;
    }
  }
  
  return {
    sessionId,
    sourceMessageId: messageId ?? undefined,
    sourceSwipeId: swipeId ?? undefined,
    generatedAt: Date.now(),
  };
}

/**
 * 设置过滤模式
 */
export function setFilterMode(mode: FilterMode): void {
  context.value.filterMode = mode;
  console.log('[SessionContext] 已更新过滤模式:', mode);
}

/**
 * 重置上下文
 */
export function resetContext(): void {
  context.value = {
    sessionId: null,
    lastMessageId: null,
    currentSwipeId: null,
    filterMode: 'session',
  };
}

// ==================== 过滤器构建 ====================

/**
 * 构建数据库查询过滤条件
 * 用于过滤 UniversalPost、UniversalComment、TrendingTopic 等带 source 字段的记录
 * 
 * @param ctx 会话上下文
 * @returns 过滤函数
 */
export function buildSourceFilter(ctx: WeiboSessionContext) {
  return (record: { source?: ContentSourceTracking }) => {
    // 模式 1: 显示所有数据
    if (ctx.filterMode === 'all') return true;
    
    // 无会话时不过滤
    if (!ctx.sessionId) return true;
    
    const source = record.source;
    
    // 无来源的记录：历史数据，默认显示
    if (!source) {
      return true;
    }
    
    // 会话级过滤：只显示当前会话的数据
    if (source.sessionId && source.sessionId !== ctx.sessionId) {
      return false;
    }
    
    if (ctx.filterMode === 'session') return true;
    
    // 楼层级过滤
    if (ctx.filterMode === 'message' && ctx.lastMessageId !== null) {
      // 无楼层信息的记录：通过
      if (source.sourceMessageId === undefined) return true;
      // 显示所有已确定楼层 + 当前楼层
      return source.sourceMessageId <= ctx.lastMessageId;
    }
    
    // Swipe 级过滤（最精确）
    if (ctx.filterMode === 'swipe' && ctx.lastMessageId !== null) {
      // 无楼层信息的记录：通过
      if (source.sourceMessageId === undefined) return true;
      
      // 非最后楼层的数据：直接显示（已固化）
      if (source.sourceMessageId < ctx.lastMessageId) return true;
      
      // 最后楼层的数据：只显示当前 swipe 的
      if (source.sourceMessageId === ctx.lastMessageId) {
        // 无 swipe 信息：通过（兼容旧数据）
        if (source.sourceSwipeId === undefined) return true;
        // 匹配当前 swipe
        return source.sourceSwipeId === ctx.currentSwipeId;
      }
      
      // 未来楼层的数据：不显示（理论上不应该存在）
      return false;
    }
    
    return true;
  };
}

/**
 * 计算属性：当前是否有有效的会话上下文
 */
export const hasValidContext = computed(() => {
  return !!context.value.sessionId;
});

/**
 * 计算属性：当前的显示名称
 */
export const filterModeLabel = computed(() => {
  const labels: Record<FilterMode, string> = {
    'all': '显示所有数据',
    'session': '按会话过滤',
    'message': '按楼层过滤',
    'swipe': '按消息页过滤',
  };
  return labels[context.value.filterMode];
});

/**
 * 计算属性：当前的说明
 */
export const filterModeDescription = computed(() => {
  const descriptions: Record<FilterMode, string> = {
    'all': '显示所有微博数据，不区分来源',
    'session': '只显示当前聊天会话产生的微博数据',
    'message': '只显示当前及之前楼层产生的微博数据',
    'swipe': '精确匹配：最后楼层只显示当前消息页的数据',
  };
  return descriptions[context.value.filterMode];
});
