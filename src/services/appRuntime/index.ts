/**
 * AppRuntime 模块导出
 *
 * 对外提供 App 运行时创建和使用的完整 API
 */

// ============ 核心类型 ============
export type { AppRuntime, AppIdentity, ScopedStorage, SystemAPI } from './types'

// ============ 运行时创建 ============
export { createAppRuntime, createBuiltinAppRuntime } from './factory'
export type { InstalledAppInfo } from './factory'

// ============ Vue 集成 ============
export {
  APP_RUNTIME_KEY,
  provideAppRuntime,
  useAppRuntime,
  tryUseAppRuntime,
  useAppStorage,
  useAppSystem,
  unregisterAppRuntime,
} from './context'

// ============ 身份与验证（按需导出） ============
export {
  calculateDataNamespace,
  verifyAndInstall,
  verifyUpdate,
  TrustedRepositoryService,
  trustedRepositoryService,
  checkDataMigration,
  executeDataMigration,
  createMigrationRecord,
  createVerificationStatus,
  getSignableContent,
  verifyEd25519Signature,
} from './identityService'

// ============ 内部工具（高级用途） ============
export { createScopedStorage } from './scopedStorage'
export { createSystemAPI, registerToastCallback } from './systemAPI'
export { AppDataService, createAppDataService } from './dataService'
