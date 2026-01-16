/**
 * LLM 任务管理模块
 * 统一导出所有子模块
 * 
 * 注意：任务定义和输出处理器已迁移到 src/apps/weibo/llmTask/
 * @see docs/systems/llm-task-service.md
 */

// 叙事集成
export {
  narrativeCache,
  initializeNarrativeSubscription,
  destroyNarrativeSubscription,
  getNarrativeContext,
  getNarrativeCacheMetadata,
  getExistingPostsSummary,
  getExistingHotSearchesSummary,
  getExistingContentContext,
  type NarrativeCache,
  type NarrativeContext,
  type ExistingContentContext,
} from './narrativeIntegration';

// 输出处理器工具函数（供 weiboOutputHandlers.ts 使用）
export {
  saveSinglePostToDatabase,
  saveBatchPostsToDatabase,
  saveEngagementToDatabase,
  preprocessEngagementInput,
  cleanJsonOutput,
  type SinglePostResult,
  type BatchPostResult,
  type EngagementResult,
  type LogFunction,
} from './outputHandlers';

// LLM 输出转换层
export {
  transformLLMOutputToUniversalPost,
  transformBatchLLMOutput,
  validateLLMOutput,
  convertLegacyImages,
  convertLegacyPoll,
  convertLegacyVideo,
  extractTopicTags,
  generateRandomStats,
  type LegacyLLMPostOutput,
  type NewLLMPostOutput,
  type TransformContext,
  type TransformResult,
  type ValidationResult,
} from './postTransformer';

// 解析器分发架构
export {
  // 分发器
  ContentDispatcher,
  getDispatcher,
  
  // 解析器
  PostParser,
  CommentParser,
  HotSearchParser,
  RepostParser,
  
  // 初始化和便捷函数
  initializeParsers,
  resetParsers,
  parseCompositeOutput,
  
  // 类型
  type ContentParser,
  type ParseContext,
  type ParseResult,
  type ParseError,
  type PersistResult,
} from './parsers';

// 来源追踪
export {
  getCurrentSourceTracking,
  isValidSourceTracking,
  hasSwipeInfo,
  createSourceTracking,
  formatSourceTracking,
} from './sourceTracking';
