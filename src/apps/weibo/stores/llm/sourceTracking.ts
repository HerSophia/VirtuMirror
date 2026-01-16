/**
 * 来源追踪工具模块
 * 提供获取当前会话上下文并生成来源追踪数据的工具函数
 * 
 * 设计文档: docs/apps/Weibo/session-binding-design.md
 */

import { getNarrativeCacheMetadata } from './narrativeIntegration';
import type { ContentSourceTracking } from '@/types/social';

/**
 * 获取当前的来源追踪数据
 * 在生成内容时调用，记录内容来自哪个会话/楼层/Swipe
 * 
 * @returns 来源追踪数据，如果无法获取会话信息则返回 undefined
 */
export function getCurrentSourceTracking(): ContentSourceTracking | undefined {
  const metadata = getNarrativeCacheMetadata();
  
  if (!metadata?.sessionId) {
    console.warn('[SourceTracking] 无法获取会话信息，内容将不带来源追踪');
    return undefined;
  }
  
  return {
    sessionId: metadata.sessionId,
    sourceMessageId: metadata.messageId,
    sourceSwipeId: metadata.swipeId,
    generatedAt: Date.now(),
  };
}

/**
 * 验证来源追踪数据是否完整
 * 
 * @param source 来源追踪数据
 * @returns 是否包含完整的会话和楼层信息
 */
export function isValidSourceTracking(source?: ContentSourceTracking): boolean {
  return !!(source?.sessionId && source.sourceMessageId !== undefined);
}

/**
 * 验证来源追踪数据是否包含 swipe 信息
 * 
 * @param source 来源追踪数据
 * @returns 是否包含 swipe 信息
 */
export function hasSwipeInfo(source?: ContentSourceTracking): boolean {
  return !!(source?.sessionId && source.sourceMessageId !== undefined && source.sourceSwipeId !== undefined);
}

/**
 * 创建来源追踪数据（手动指定）
 * 用于测试或特殊场景
 * 
 * @param sessionId 会话 ID
 * @param messageId 楼层 ID
 * @param swipeId Swipe ID
 * @returns 来源追踪数据
 */
export function createSourceTracking(
  sessionId: string,
  messageId?: number,
  swipeId?: number
): ContentSourceTracking {
  return {
    sessionId,
    sourceMessageId: messageId,
    sourceSwipeId: swipeId,
    generatedAt: Date.now(),
  };
}

/**
 * 格式化来源追踪数据为可读字符串
 * 用于日志输出和调试
 * 
 * @param source 来源追踪数据
 * @returns 格式化的字符串
 */
export function formatSourceTracking(source?: ContentSourceTracking): string {
  if (!source) return '(无来源追踪)';
  
  const parts: string[] = [];
  
  if (source.sessionId) {
    // 只显示 sessionId 的前 8 位
    parts.push(`会话:${source.sessionId.slice(0, 8)}...`);
  }
  
  if (source.sourceMessageId !== undefined) {
    parts.push(`楼层:${source.sourceMessageId}`);
  }
  
  if (source.sourceSwipeId !== undefined) {
    parts.push(`Swipe:${source.sourceSwipeId}`);
  }
  
  return parts.join(' ');
}
