/**
 * 图标与注册服务模块
 *
 * 包含：
 * - iconService: 核心图标服务
 * - iconRegistryService: 图标注册 Facade（兼容层）
 * - appRegistry: App 统一注册服务
 */

// 核心服务
export * from './iconService'

// 图标注册 Facade
export {
  iconRegistryService,
  getIconRegistryService,
} from './registryService'
export type {
  RegisteredAppIcon,
  IconRegistrationOptions,
  AppCategory,
  QuickActionConfig,
} from './registryService'

// App 注册服务
export { appRegistry, registerApp, registerApps } from './appRegistryService'
export type { AppRegistration } from './appRegistryService'
