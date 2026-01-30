// 注意：account.ts 和 social.ts 都有 PlatformAccount 类型
// 使用重命名导出避免冲突

// Account 系统类型（新的统一身份系统）
export {
  // 作用域类型
  type EntityScope,
  type AccountScope,
  
  // 实体类型
  type EntitySource,
  type EntityType,
  type Gender,
  type CharacterEntity,
  
  // 平台账号（重命名避免冲突）
  type PlatformAccount as AccountPlatformAccount,
  type PlatformSpecificData,
  
  // 社交关系
  type RelationType,
  type SocialRelation,
  
  // 输入类型
  type CreateEntityInput,
  type CreatePlatformAccountInput,
  type QueryOptions,
  type SearchOptions,
  type FullProfile,
  type GeneratedProfile,
  type GenerationContext,
  type SessionContext,
  type MissingAccountInfo,
} from './account'

// 社交媒体引擎类型（旧的社交系统，逐步迁移到 Account 系统）
export {
  type PlatformConfig,
  type SocialIdentity,
  type PlatformAccount as SocialPlatformAccount, // 重命名避免冲突
  type TrendingCategory,
  type TrendingTopic,
  type SuperTopic,
  type UserSuperTopicRelation,
  type MomentComment,
  type Moment,
  type WorldEvent,
  type UniversalPost,
  type UniversalComment,
  type TokenBudget,
} from './social'

export * from './ai'
export * from './appIdentity'
export * from './appPackage'
export * from './globalConfig'
export * from './notification'
export * from './persistedData'
export * from './prompts'
export * from './sillytavern'
export * from './swipe'
export * from './theme'
export * from './audio'
export * from './chat'
export * from './contact'
export * from './action'
export * from './ui'
export * from './email'
export * from './forum'
export * from './live'
export * from './browser'
export * from './logger'

// 会话上下文类型（重命名避免与 account.ts 的 SessionContext 冲突）
export {
  type SessionContext as TavernSessionContext,
  type SessionContextState,
  type EmptySessionContext,
  type ContentSourceTracking,
  type TrackedContent,
  type FilterMode,
  type FilterConfig,
  type SourceFilter,
  type ISessionContextService,
  type SessionContextChangedEvent,
  createEmptyContext,
  DEFAULT_FILTER_CONFIG,
} from './sessionContext'

// 交互服务类型
export type {
  // 基础类型
  InteractionType,
  ContentType,
  PlatformId,
  // 事件
  InteractionEvent,
  InteractionEventHandler,
  // 用户互动
  UserInteraction,
  // 统计
  InteractionStats,
  // 评论
  Comment,
  CreateCommentParams,
  // 浏览记录
  ViewRecord,
  ViewRecordOptions,
  // 收藏夹
  FavoriteCollection,
  // 平台扩展
  PlatformBehavior,
  RegisterPlatformBehaviorOptions,
  // 查询选项
  PaginationOptions,
  GetUserInteractionsOptions,
  GetCommentsOptions,
  GetViewHistoryOptions,
  // 操作选项
  BaseInteractionOptions,
  LikeOptions,
  FavoriteOptions,
  RepostOptions,
  RepostRecord,
  // 服务接口
  IInteractionService,
} from './interaction'

// Feed 服务类型
export type {
  // 核心类型
  FeedType,
  FeedItem,
  FeedReason,
  FeedReasonType,
  // 请求参数
  FeedOptions,
  TimeRange,
  CategoryFeedOptions,
  TopicFeedOptions,
  TrendingOptions,
  // 响应类型
  FeedResult,
  FeedDebugInfo,
  // 算法配置
  AlgorithmConfig,
  AlgorithmWeights,
  DiversityRules,
  ColdStartStrategy,
  // 过滤器
  FeedFilter,
  PrioritizedFilter,
  BuiltinFilterType,
  // 缓存
  FeedCacheEntry,
  FeedCacheConfig,
  FeedCacheStats,
  // 分数计算
  ScoreComponents,
  ScoreContext,
  NormalizationParams,
  // 事件
  FeedEvent,
  FeedEventType,
  // 内容来源
  ContentSource,
  ContentSourceType,
  AggregateOptions,
  // 服务接口
  IFeedService,
} from './feed'
