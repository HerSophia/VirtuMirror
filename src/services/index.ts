/**
 * 服务模块入口
 * 导出所有持久化相关的服务
 */

// 聊天数据服务
export {
  ChatDataService,
  getChatDataService,
  resetChatDataService,
} from './chatDataService'

// 全局配置服务
export {
  GlobalConfigService,
  getGlobalConfigService,
  resetGlobalConfigService,
} from './globalConfigService'

// 聊天同步服务
export {
  ChatSyncService,
  getChatSyncService,
  initChatSyncService,
  destroyChatSyncService,
} from './chatSyncService'

export type { StoreSyncCallback } from './chatSyncService'

// 提示词管理服务
export { PromptService } from './promptService'
export { SystemPromptService } from './systemPromptService'
export type {
  AssembleOptions,
  AssembleResult,
  SystemPromptDefinition,
} from './systemPromptService'

// 叙事内容分发服务
export {
  narrativeService,
  createNarrativeVariables,
  NARRATIVE_VARIABLE_DEFINITIONS,
} from './narrativeService'
export type {
  NarrativeEvent,
  NarrativeCallback,
  NarrativeVariables,
} from './narrativeService'

// 内置叙事理解提示词
export {
  registerBuiltinNarrativePrompts,
  getBuiltinNarrativePromptIds,
  isBuiltinNarrativePrompt,
  resetBuiltinNarrativePrompts,
  getBuiltinNarrativePromptDefinitions,
} from './builtinNarrativePrompts'

// AI 生成服务（旧版，保持向后兼容）
export { AIGenerateService } from './aiGenerateService'
export type { GenerateConfig, GenerateResult as LegacyGenerateResult, StreamCallback } from './aiGenerateService'

// AI Service（新版统一服务）
export {
  AIService,
  getAIService,
  resetAIService,
  ProviderFactory,
  ProviderManager,
  getProviderManager,
  RequestManager,
  getRequestManager,
  RequestQueue,
  getRequestQueue,
  TavernAdapter,
  getTavernAdapter,
  createAIError,
  formatErrorMessage,
  RequestPriority,
} from './ai'
export type {
  GenerateOptions,
  StreamOptions,
  GenerateResult,
  StreamChunk,
  StreamHandle,
  AIError,
  AIErrorCode,
  ProviderInfo,
  ProviderSource,
  QueueStatus,
  IAIService,
} from './ai'

// 模型列表服务
export {
  ModelListService,
  getModelListService,
  resetModelListService,
  fetchModels,
  fetchOpenAIModels,
  fetchAnthropicModels,
  fetchGoogleModels,
  ANTHROPIC_MODELS,
} from './modelListService'
export type {
  ModelInfo,
  FetchModelsResult,
  FetchModelsOptions,
} from './modelListService'

// IndexedDB 数据库服务
export {
  db,
  sessionService,
  contactService,
  messageService,
  SessionService,
  ContactService,
  MessageService,
  generateSessionId,
  parseSessionId,
} from './database'
export type {
  Session,
  StoredContact,
  StoredMessage,
  StoredMoment,
  StoredCallRecord,
  StoredEmail,
  StoredForumBoard,
  StoredForumPost,
  StoredLiveStream,
  StoredBookmark,
  StoredBrowsingHistory,
  AppSettings,
  DesktopLayout,
  AppDataRecord,
} from './database'

// 应用数据服务
export {
  AppDataService,
  createAppDataService,
} from './appDataService'

// 应用身份识别服务
export {
  calculateDataNamespace,
  TrustedRepositoryService,
  trustedRepositoryService,
  getSignableContent,
  verifyEd25519Signature,
  verifyAndInstall,
  verifyUpdate,
  checkDataMigration,
  executeDataMigration,
  createMigrationRecord,
  createVerificationStatus,
} from './appIdentityService'

// 图标注册服务
export {
  iconRegistryService,
  getIconRegistryService,
} from './iconRegistryService'
export type {
  RegisteredAppIcon,
  QuickActionConfig,
  IconRegistrationOptions,
} from './iconRegistryService'

// 内置 App 配置
export {
  BUILTIN_APPS,
  DEFAULT_DOCK_APP_IDS,
  registerBuiltinApps,
  getAppCategoryById,
} from './builtinApps'

// 统一 App 注册服务
export {
  appRegistry,
  registerApp,
  registerApps,
} from './appRegistryService'
export type { AppRegistration } from './appRegistryService'

// 通知服务
export {
  notificationService,
  NotificationService,
} from './notification/notificationService'

// 音频服务
export {
  audioService,
  AudioService,
} from './audioService'

// Social Media Engine Services
export { PlatformRegistry } from './social/registry';
export { UserPool } from './social/userPool';
export { ContentFactory } from './social/contentFactory';
export { TrendService } from './social/trendService';
export { DirectorService } from './social/directorService';
export { TrafficEngine } from './social/algorithm';

// Account Service (统一身份管理)
export {
  AccountService,
  accountService,
  UserPool as AccountUserPool,
  userPool as accountUserPool,
} from './account';
export type {
  CharacterEntity,
  PlatformAccount,
  SocialRelation,
  CreateEntityInput,
  CreatePlatformAccountInput,
  QueryOptions,
  SearchOptions,
  FullProfile,
  RelationType,
  EntityType,
  EntitySource,
  EntityScope,
  AccountScope,
  Gender,
  GeneratedProfile,
  GenerationContext,
  SessionContext,
  MissingAccountInfo,
  PlatformSpecificData,
} from './account';

// 写入队列服务
export { writeQueue, type WriteLockState } from './database/writeQueue'

// 应用运行时服务
export {
  createAppRuntime,
  createBuiltinAppRuntime,
  provideAppRuntime,
  useAppRuntime,
  useAppStorage,
  tryUseAppRuntime,
  createScopedStorage,
  createSystemAPI,
  registerToastCallback,
  APP_RUNTIME_KEY,
} from './appRuntime'
export type {
  AppRuntime,
  AppIdentity,
  ScopedStorage,
  SystemAPI,
  InstalledAppInfo,
} from './appRuntime'

// 多设备同步服务
export {
  deviceSyncManager,
  changeTracker,
} from './sync'
export type {
  DeviceStatus,
  ConflictInfo,
  TrackedChange,
  SyncResult,
  HeartbeatResponse,
  ServerChange,
} from './sync'

// LLM 任务服务
export {
  LLMTaskService,
  getLLMTaskService,
  resetLLMTaskService,
  TaskRegistry,
  getTaskRegistry,
  ContextProviderRegistry,
  getContextProviderRegistry,
  OutputHandlerRegistry,
  getOutputHandlerRegistry,
  TaskExecutor,
  getTaskExecutor,
  TaskScheduler,
  getTaskScheduler,
  VariableResolver,
  getVariableResolver,
  getTimeContextVariables,
  registerBuiltinProviders,
  BUILTIN_CONTEXT_PROVIDERS,
  // 工具函数
  generateTaskId,
  createTaskFromDefinition,
  getStatusLabel,
  getModeLabel,
  formatDuration,
  cleanJsonOutput,
  safeParseJson,
} from './llmTask';
export type {
  // 基础类型
  LLMTaskStatus,
  LLMTaskType,
  LLMConfigSource,
  TaskExecutionMode,
  // 配置类型
  AutoExecutionConfig,
  LLMTaskConfig,
  InputFieldDefinition,
  // 任务类型
  LLMTaskDefinition,
  LLMTask,
  OutputHistoryEntry,
  // 扩展点类型
  ContextProvider,
  OutputHandler,
  OutputHandlerResult,
  TaskExecutionContext,
  // 服务类型
  CreateTaskInput,
  ExecutionResult,
  TaskStats,
  TaskLog,
  TaskEvent,
  TaskEventHandler,
  TaskFilter,
  ILLMTaskService,
} from './llmTask';
