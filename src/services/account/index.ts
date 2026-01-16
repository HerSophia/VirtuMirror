/**
 * 账号系统服务模块入口
 * 
 * @see docs/systems/account-service.md
 */

export { AccountService, accountService } from './accountService'
export { UserPool, userPool } from './userPool'

// 迁移工具（加载时自动注册到 window）
export { migrateSocialAccounts, checkMigrationStatus } from './migrateSocialAccounts'

// 重新导出类型
export type {
  // 核心实体类型
  CharacterEntity,
  PlatformAccount,
  SocialRelation,
  
  // 作用域类型
  EntityScope,
  AccountScope,
  EntitySource,
  EntityType,
  RelationType,
  Gender,
  
  // 输入类型
  CreateEntityInput,
  CreatePlatformAccountInput,
  QueryOptions,
  SearchOptions,
  
  // 输出类型
  FullProfile,
  GeneratedProfile,
  GenerationContext,
  
  // 会话上下文
  SessionContext,
  MissingAccountInfo,
  
  // 平台数据
  PlatformSpecificData,
} from '@/types/account'
