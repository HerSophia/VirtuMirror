/**
 * 解析器模块统一导出
 * 
 * Phase 5: 总部-分部解析器架构
 * @see docs/systems/social-content-types.md Section 11
 */

// 类型导出
export type {
  ContentParser,
  ParseContext,
  ParseResult,
  ParseError,
  ParseTask,
  ResolvedData,
  ValidationResult,
  PersistResult,
  HotSearchInput,
  HotSearchOutput,
  PostInput,
  CommentInput,
  CommentOutput,
  RepostInput,
} from './types';

// 分发器
export { ContentDispatcher, getDispatcher } from './dispatcher';

// 解析器
export { PostParser } from './postParser';
export { CommentParser } from './commentParser';
export { HotSearchParser } from './hotSearchParser';
export { RepostParser } from './repostParser';

// ==================== 初始化函数 ====================

import { getDispatcher } from './dispatcher';
import { PostParser } from './postParser';
import { CommentParser } from './commentParser';
import { HotSearchParser } from './hotSearchParser';
import { RepostParser } from './repostParser';

let initialized = false;

/**
 * 初始化所有解析器
 * 应在应用启动时调用一次
 */
export function initializeParsers(): void {
  if (initialized) {
    console.log('[Parsers] 解析器已初始化，跳过');
    return;
  }
  
  const dispatcher = getDispatcher();
  
  // 注册所有解析器
  dispatcher.registerAll([
    PostParser,
    CommentParser,
    HotSearchParser,
    RepostParser,
  ]);
  
  initialized = true;
  console.log('[Parsers] 解析器初始化完成');
}

/**
 * 重置解析器（用于测试）
 */
export function resetParsers(): void {
  const dispatcher = getDispatcher();
  dispatcher.reset();
  initialized = false;
  console.log('[Parsers] 解析器已重置');
}

/**
 * 解析复合 LLM 输出
 * 
 * 便捷函数，自动初始化解析器并调用 dispatcher
 * 
 * @param jsonOutput LLM 输出的 JSON 字符串
 * @param options 解析选项
 * @returns 解析结果
 * 
 * @example
 * ```typescript
 * const result = await parseCompositeOutput(llmOutput, {
 *   taskId: 'task-123',
 *   platformId: 'weibo',
 *   namespace: 'weibo',
 *   log: (level, msg) => console.log(`[${level}] ${msg}`),
 * });
 * 
 * if (result.success) {
 *   console.log('保存的博文:', result.data.posts);
 *   console.log('保存的评论:', result.data.comments);
 * }
 * ```
 */
export async function parseCompositeOutput(
  jsonOutput: string,
  options: {
    taskId: string;
    platformId?: string;
    namespace?: string;
    timestamp?: number;
    log?: (level: 'info' | 'warn' | 'error', message: string) => void;
  }
): Promise<import('./types').ParseResult> {
  // 确保解析器已初始化
  initializeParsers();
  
  const dispatcher = getDispatcher();
  
  return dispatcher.dispatch(jsonOutput, {
    taskId: options.taskId,
    platformId: options.platformId || 'weibo',
    namespace: options.namespace,
    timestamp: options.timestamp || Date.now(),
    log: options.log || ((level, msg) => console.log(`[Parser][${level}] ${msg}`)),
  });
}
