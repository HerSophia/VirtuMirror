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
