/**
 * 服务模块入口
 * 导出所有持久化相关的服务
 */

// 聊天数据服务
export { ChatDataService, getChatDataService, resetChatDataService } from './chatDataService'

// 全局配置服务
export {
  getGlobalConfigService,
  GlobalConfigService,
  resetGlobalConfigService,
} from './globalConfigService'

// 聊天同步服务
export {
  ChatSyncService,
  destroyChatSyncService,
  getChatSyncService,
  initChatSyncService,
} from './chatSyncService'

export type { StoreSyncCallback } from './chatSyncService'

// 提示词管理服务
export { PromptService } from './prompt/promptService'
export { SystemPromptService } from './prompt/systemPromptService'
export type {
  AssembleOptions,
  AssembleResult,
  SystemPromptDefinition,
} from './prompt/systemPromptService'

// 叙事内容分发服务
export {
  createNarrativeVariables,
  NARRATIVE_VARIABLE_DEFINITIONS,
  narrativeService,
} from './narrative/narrativeService'
export type {
  NarrativeCallback,
  NarrativeEvent,
  NarrativeVariables,
} from './narrative/narrativeService'

// 内置叙事理解提示词
export {
  getBuiltinNarrativePromptDefinitions,
  getBuiltinNarrativePromptIds,
  isBuiltinNarrativePrompt,
  registerBuiltinNarrativePrompts,
  resetBuiltinNarrativePrompts,
} from './builtinNarrativePrompts'

// AI 生成服务（旧版，保持向后兼容）
export { AIGenerateService } from './aiGenerateService'
export type {
  GenerateConfig,
  GenerateResult as LegacyGenerateResult,
  StreamCallback,
} from './aiGenerateService'

// AI Service（新版统一服务）
export {
  AIService,
  createAIError,
  formatErrorMessage,
  getAIService,
  getProviderManager,
  getRequestManager,
  getRequestQueue,
  getTavernAdapter,
  ProviderFactory,
  ProviderManager,
  RequestManager,
  RequestPriority,
  RequestQueue,
  resetAIService,
  TavernAdapter,
} from './ai'
export type {
  AIError,
  AIErrorCode,
  GenerateOptions,
  GenerateResult,
  IAIService,
  ProviderInfo,
  ProviderSource,
  QueueStatus,
  StreamChunk,
  StreamHandle,
  StreamOptions,
} from './ai'

// 模型列表服务
export {
  ANTHROPIC_MODELS,
  fetchAnthropicModels,
  fetchGoogleModels,
  fetchModels,
  fetchOpenAIModels,
  getModelListService,
  ModelListService,
  resetModelListService,
} from './ai'
export type { FetchModelsOptions, FetchModelsResult, ModelInfo } from './ai'

// IndexedDB 数据库服务
export {
  ContactService,
  contactService,
  db,
  generateSessionId,
  MessageService,
  messageService,
  parseSessionId,
  SessionService,
  sessionService,
} from './database'
export type {
  AppDataRecord,
  AppSettings,
  DesktopLayout,
  Session,
  StoredBookmark,
  StoredBrowsingHistory,
  StoredCallRecord,
  StoredContact,
  StoredEmail,
  StoredForumBoard,
  StoredForumPost,
  StoredLiveStream,
  StoredMessage,
  StoredMoment,
} from './database'

// 应用数据服务（通过 appRuntime 模块导出）
export { AppDataService, createAppDataService } from './appRuntime'

// 应用身份识别服务（通过 appRuntime 模块导出）
export {
  calculateDataNamespace,
  checkDataMigration,
  createMigrationRecord,
  createVerificationStatus,
  executeDataMigration,
  trustedRepositoryService,
  verifyAndInstall,
  verifyUpdate,
} from './appRuntime'

// 图标与注册服务
export {
  appRegistry,
  getIconRegistryService,
  iconRegistryService,
  iconService,
  IconService,
  registerApp,
  registerApps,
} from './icon'
export type {
  AppRegistration,
  IconRegistrationOptions,
  QuickActionConfig,
  RegisteredAppIcon,
} from './icon'

// 内置 App 配置
export {
  BUILTIN_APPS,
  DEFAULT_DOCK_APP_IDS,
  getAppCategoryById,
  registerBuiltinApps,
} from './builtinApps'

// 通知服务
export { NotificationService, notificationService } from './notification/notificationService'

// 音频服务
export { AudioService, audioService } from './audio/audioService'

// Trending Service (系统级热搜服务)
export { getTrendingService, resetTrendingService, trendingService, TrendingService } from './trending'
export type {
  CreateOptions as TrendingCreateOptions,
  ITrendingService,
  SharePolicy as TrendingSharePolicy,
  SharedTrendingOptions,
  TrendingConfig,
  TrendingQueryOptions,
  TrendingUpdateEvent,
} from './trending'

// Social Media Engine Services
export { TrafficEngine } from './social/algorithm'
export { ContentFactory } from './social/contentFactory'
export { DirectorService } from './social/directorService'
export { PlatformRegistry } from './social/registry'
export { TrendService } from './social/trendService'
export { UserPool } from './social/userPool'
export {
  topicContentLoader,
  preloadTopTopics,
  warmupTopicCache,
  type TopicContentResult,
} from './social/topicContentLoader'

// Account Service (统一身份管理)
export {
  AccountService,
  accountService,
  UserPool as AccountUserPool,
  userPool as accountUserPool,
} from './account'
export type {
  AccountScope,
  CharacterEntity,
  CreateEntityInput,
  CreatePlatformAccountInput,
  EntityScope,
  EntitySource,
  EntityType,
  FullProfile,
  Gender,
  GeneratedProfile,
  GenerationContext,
  MissingAccountInfo,
  PlatformAccount,
  PlatformSpecificData,
  QueryOptions,
  RelationType,
  SearchOptions,
  SessionContext,
  SocialRelation,
} from './account'

// Social Graph Service (社交图谱服务)
export {
  SocialGraphError,
  SocialGraphService,
  getSocialGraphService,
  resetSocialGraphService,
  socialGraphService,
} from './socialGraph'
export type {
  BatchFollowOptions,
  BatchFollowResult,
  BlockOptions,
  FollowOptions,
  FollowRecommendation,
  GraphAccountNode,
  ISocialGraphService,
  MuteOptions,
  RecommendationOptions,
  RecommendationReason,
  RecommendationReasonType,
  RelationshipStats,
  SocialGraphErrorCode,
  SocialGraphEvent,
  SocialGraphEventType,
  SocialGraphPageResult,
  SocialGraphQueryOptions,
  SocialGraphRelation,
  SocialGraphRelationScope,
  SocialGraphRelationStatus,
  SocialGraphRelationType,
} from './socialGraph'

// 写入队列服务
export { writeQueue, type WriteLockState } from './database/writeQueue'

// 应用运行时服务
export {
  APP_RUNTIME_KEY,
  createAppRuntime,
  createBuiltinAppRuntime,
  createScopedStorage,
  createSystemAPI,
  provideAppRuntime,
  registerToastCallback,
  tryUseAppRuntime,
  useAppRuntime,
  useAppStorage,
} from './appRuntime'
export type {
  AppIdentity,
  AppRuntime,
  InstalledAppInfo,
  ScopedStorage,
  SystemAPI,
} from './appRuntime'

// 多设备同步服务
export { changeTracker, deviceSyncManager } from './sync'
export type {
  ConflictInfo,
  DeviceStatus,
  HeartbeatResponse,
  ServerChange,
  SyncResult,
  TrackedChange,
} from './sync'

// LLM 任务服务
export {
  BUILTIN_CONTEXT_PROVIDERS,
  cleanJsonOutput,
  ContextProviderRegistry,
  createTaskFromDefinition,
  formatDuration,
  // 工具函数
  generateTaskId,
  getContextProviderRegistry,
  getLLMTaskService,
  getModeLabel,
  getOutputHandlerRegistry,
  getStatusLabel,
  getTaskExecutor,
  getTaskRegistry,
  getTaskScheduler,
  getTimeContextVariables,
  getVariableResolver,
  LLMTaskService,
  OutputHandlerRegistry,
  registerBuiltinProviders,
  resetLLMTaskService,
  safeParseJson,
  TaskExecutor,
  TaskRegistry,
  TaskScheduler,
  VariableResolver,
} from './llmTask'
export type {
  // 配置类型
  AutoExecutionConfig,
  // 扩展点类型
  ContextProvider,
  // 服务类型
  CreateTaskInput,
  ExecutionResult,
  ILLMTaskService,
  InputFieldDefinition,
  LLMConfigSource,
  LLMTask,
  LLMTaskConfig,
  // 任务类型
  LLMTaskDefinition,
  // 基础类型
  LLMTaskStatus,
  LLMTaskType,
  OutputHandler,
  OutputHandlerResult,
  OutputHistoryEntry,
  TaskEvent,
  TaskEventHandler,
  TaskExecutionContext,
  TaskExecutionMode,
  TaskFilter,
  TaskLog,
  TaskStats,
} from './llmTask'

// 会话上下文服务
export {
  sessionContextService,
  SessionContextService,
  initSessionContextListeners,
  cleanupListeners as cleanupSessionContextListeners,
  createEmptyContext,
  DEFAULT_FILTER_CONFIG,
} from './sessionContext'
export type {
  SessionContext as SessionContextType,
  SessionContextState,
  EmptySessionContext,
  ContentSourceTracking,
  TrackedContent,
  FilterMode,
  FilterConfig,
  SourceFilter,
  ISessionContextService,
  SessionContextChangedEvent,
} from './sessionContext'

// 交互服务
export {
  interactionService,
  useInteractionService,
} from './interaction'
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

// 平台扩展行为
export {
  registerAllPlatformBehaviors,
  registerWeiboBehaviors,
  registerBilibiliBehaviors,
  registerZhihuBehaviors,
  allPlatformBehaviors,
  weiboBehaviors,
  bilibiliBehaviors,
  zhihuBehaviors,
} from './interaction/platformBehaviors'

// JSON 解析服务
export {
  getJsonParserService,
  resetJsonParserService,
  jsonParser,
  BUILTIN_REPAIR_STRATEGIES,
  JsonParseError,
  DEFAULT_PARSE_OPTIONS,
} from './jsonParser'
export type {
  JsonParserService,
  ParseOptions,
  ParseResult,
  ParserStats,
  RepairStrategy,
  BuiltinStrategyName,
  TypeGuard,
} from './jsonParser'

// Lazy Loader 服务
export {
  createLazyLoader,
  createNamespacedLoader,
  LazyLoaderRegistry,
  LazyLoader,
  LRUCache,
  FIFOCache,
  ConcurrencyLimiter,
  RequestDeduplicator,
} from './lazyLoader'
export type {
  ILazyLoader,
  LazyLoaderOptions,
  LazyLoaderStats,
  CacheOptions,
} from './lazyLoader'

// Feed Service (信息流服务)
export {
  FeedService,
  getFeedService,
  resetFeedService,
  feedService,
  AlgorithmRegistry,
  algorithmRegistry,
  DEFAULT_ALGORITHM_CONFIG,
  ScoreCalculator,
  scoreCalculator,
  DiversityController,
  diversityController,
  DEFAULT_DIVERSITY_RULES,
  FilterChain,
  filterChain,
  FeedCache,
  feedCache,
  DEFAULT_CACHE_CONFIG,
  SystemContentProvider,
} from './feed'
export type {
  FeedServiceConfig,
  ContentProvider,
  FeedType,
  FeedItem,
  FeedReason,
  FeedReasonType,
  FeedOptions,
  TimeRange,
  CategoryFeedOptions,
  TopicFeedOptions,
  TrendingOptions,
  FeedResult,
  FeedDebugInfo,
  AlgorithmConfig,
  AlgorithmWeights,
  DiversityRules,
  ColdStartStrategy,
  FeedFilter,
  PrioritizedFilter,
  BuiltinFilterType,
  FeedCacheEntry,
  FeedCacheConfig,
  FeedCacheStats,
  ScoreComponents,
  ScoreContext,
  NormalizationParams,
  FeedEvent,
  FeedEventType,
  ContentSource,
  ContentSourceType,
  AggregateOptions,
  IFeedService,
} from './feed'

// Scheduler Service (定时任务服务)
export {
  getSchedulerService,
  resetSchedulerService,
  SchedulerService,
  schedulerService,
  SCHEDULER_EVENTS,
} from './scheduler'
export type {
  CronSchedule,
  EventSchedule,
  ExecutionOutcome as SchedulerExecutionOutcome,
  ExecutionResult as SchedulerExecutionResult,
  IntervalSchedule,
  ScheduleConfig as SchedulerScheduleConfig,
  ScheduledTask,
  ScheduledTaskInput,
  SchedulerEventMap,
  SchedulerEventName,
  SchedulerStatistics,
  TaskResult as SchedulerTaskResult,
} from './scheduler'

// Search Service (搜索服务)
export {
  getSearchService,
  resetSearchService,
  SearchService,
  searchService,
} from './search'
export type {
  ISearchService,
  IndexableDocument,
  IndexableType,
  SearchFilter,
  SearchPagination,
  SearchQuery,
  SearchResult,
  SearchResultItem,
  SearchSort,
  SearchStats,
  SuggestItem,
  SuggestOptions,
} from './search'

// Archive Service (档案服务)
export {
  archiveAutoExtractService,
  archiveService,
  ArchiveAutoExtractService,
  destroyArchiveAutoExtractService,
  getArchiveAutoExtractService,
  initArchiveAutoExtractService,
  ArchiveService,
  ArchiveRepository,
  BindingService,
  DeduplicationService,
  ExtractionService,
  getArchiveService,
  InjectionService,
  resetArchiveService,
} from './archive'
export type {
  ActionEntry,
  ArchiveBase,
  ArchiveConfig,
  ArchiveFloorData,
  ArchiveInjectionHistory,
  ArchiveQueryFilter,
  ArchiveRecord,
  ArchiveStatus,
  ArchiveType,
  CharacterProfile,
  CharacterRole,
  CharacterUpdate,
  ChatArchive,
  EventImportance,
  EventStatus,
  EventSubType,
  ExtractOptions,
  ExtractResult,
  FactConfidence,
  FactEntry,
  FloorReference,
  InjectionLevel,
  InjectionRequest,
  InjectionResult,
  Keyword,
  UpdateRecord,
  WorldEntry,
  WorldEntryCategory,
} from './archive'
export type { ExtractAndPersistResult, PersistExtractResult } from './archive'

