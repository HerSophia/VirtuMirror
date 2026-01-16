/**
 * 应用商店 - 应用包类型定义
 * 
 * 定义了小手机模拟器应用包的完整数据结构
 */

// ===== 基础类型 =====

/**
 * 应用分类
 */
export type AppCategory =
  | 'social'        // 社交
  | 'tools'         // 工具
  | 'entertainment' // 娱乐
  | 'productivity'  // 效率
  | 'lifestyle'     // 生活
  | 'games'         // 游戏
  | 'other'         // 其他

/**
 * 应用权限
 */
export type AppPermission =
  | 'storage'       // 存储数据
  | 'ai-generate'   // 调用 AI 生成
  | 'notifications' // 发送通知
  | 'contacts'      // 访问联系人
  | 'messages'      // 访问消息
  | 'camera'        // 使用相机（虚拟）
  | 'location'      // 使用位置（虚拟）

/**
 * 应用类型
 */
export type AppType = 'configurable' | 'template' | 'composite'

/**
 * 应用状态
 */
export type AppStatus =
  | 'not-installed' // 未安装
  | 'installing'    // 安装中
  | 'installed'     // 已安装
  | 'updating'      // 更新中
  | 'disabled'      // 已禁用
  | 'error'         // 错误状态

/**
 * 应用来源
 */
export type AppSource =
  | 'builtin'   // 内置应用
  | 'official'  // 官方商店
  | 'community' // 社区仓库
  | 'local'     // 本地导入
  | 'url'       // URL 导入

// ===== 图标配置 =====

/**
 * 图标配置
 */
export interface AppIconConfig {
  /** 图标类型 */
  type: 'font' | 'emoji' | 'url' | 'base64' | 'component'
  /** 图标值 */
  value: string | any
  /** 背景颜色/渐变 */
  background: string
  /** 图标颜色（font 类型时使用） */
  color?: string
}

// ===== 作者信息 =====

/**
 * 作者信息
 */
export interface AuthorInfo {
  name: string
  email?: string
  url?: string
}

// ===== 数据源配置 =====

/**
 * 数据源配置
 */
export interface DataSourceConfig {
  /** 数据源类型 */
  type: 'static' | 'worldbook' | 'ai-generated' | 'api'
  
  /** 静态数据 */
  staticData?: unknown[]
  
  /** Worldbook 键名 */
  worldbookKey?: string
  
  /** AI 生成配置 */
  aiGenerate?: {
    promptScene: string
    variables?: Record<string, string>
    cacheKey?: string
    cacheDuration?: number
  }
  
  /** API 配置（仅限允许的域名） */
  apiConfig?: {
    url: string
    method?: 'GET' | 'POST'
    headers?: Record<string, string>
  }
}

// ===== AI 命令配置 =====

/**
 * 命令动作类型
 */
export type CommandAction =
  | { type: 'navigate'; path: string }
  | { type: 'updateState'; updates: Record<string, unknown> }
  | { type: 'addItem'; target: string; item: Record<string, unknown> }
  | { type: 'removeItem'; target: string; id: string }
  | { type: 'notify'; message: string }

/**
 * AI 命令配置
 */
export interface AICommandConfig {
  /** 命令触发的应用名称（AI 输出中的 app_name） */
  appName: string
  /** 命令类型 */
  type: string
  /** 处理动作 */
  action: CommandAction
}

// ===== 提示词定义 =====

/**
 * 提示词变量
 */
export interface PackagePromptVariable {
  name: string
  description: string
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  required: boolean
  defaultValue?: unknown
  example?: unknown
}

/**
 * 应用提示词定义
 */
export interface PackageAppPromptDefinition {
  scene: string
  name: string
  description?: string
  category: 'chat' | 'email' | 'browser' | 'live' | 'system'
  template: string
  systemPrompt?: string
  availableVariables: PackagePromptVariable[]
  priority?: number
}

// ===== 持久化配置 =====

/**
 * 持久化配置
 */
export interface PersistenceConfig {
  /** 存储键名 */
  key: string
  /** 存储类型 */
  type: 'chat' | 'global'
  /** 需要持久化的字段 */
  fields?: string[]
}

// ===== 配置式应用配置 =====

/**
 * 列表配置
 */
export interface ListConfig {
  titleField: string
  subtitleField?: string
  avatarField?: string
  timeField?: string
  emptyText?: string
  emptyIcon?: string
}

/**
 * 项目动作
 */
export interface ItemAction {
  icon: string
  action: string
  confirm?: boolean
  confirmText?: string
}

/**
 * 浮动按钮
 */
export interface FloatingButton {
  icon: string
  action: string
}

/**
 * 配置式应用配置
 */
export interface ConfigurableAppConfig {
  /** 布局类型 */
  layout: 'list' | 'grid' | 'detail' | 'webview'
  
  /** 列表配置 */
  listConfig?: ListConfig
  
  /** 网格配置 */
  gridConfig?: {
    columns: number
    itemTemplate?: string
  }
  
  /** 详情配置 */
  detailConfig?: {
    titleField: string
    contentField: string
    timeField?: string
  }
  
  /** WebView 配置 */
  webviewConfig?: {
    url: string
    allowNavigation?: boolean
  }
  
  /** 项目动作 */
  itemActions?: ItemAction[]
  
  /** 浮动按钮 */
  floatingButton?: FloatingButton
}

// ===== 模板式应用配置 =====

/**
 * 模板式应用配置
 */
export interface TemplateAppConfig {
  /** HTML 模板 */
  template: string
  
  /** CSS 样式 */
  styles?: string
  
  /** 预定义动作 */
  actions?: Record<string, CommandAction>
}

// ===== 组合式应用配置 =====

/**
 * 组件配置
 */
export interface ComponentConfig {
  type: string
  props?: Record<string, unknown>
  children?: ComponentConfig[]
}

/**
 * 页面配置
 */
export interface PageConfig {
  path: string
  name?: string
  components: ComponentConfig[]
}

/**
 * 动作配置
 */
export interface ActionConfig {
  type: string
  target?: string
  field?: string
  value?: unknown
  item?: Record<string, unknown>
  then?: string
}

/**
 * 组合式应用配置
 */
export interface CompositeAppConfig {
  /** 页面列表 */
  pages: PageConfig[]
  
  /** 动作定义 */
  actions?: Record<string, ActionConfig>
  
  /** 共享组件 */
  sharedComponents?: Record<string, ComponentConfig>
}

// ===== 生命周期配置 =====

/**
 * 生命周期动作
 */
export type LifecycleAction =
  | { type: 'initState'; state: Record<string, unknown> }
  | { type: 'migrateData'; from: string; to: string }
  | { type: 'clearData'; keys: string[] }
  | { type: 'showWelcome'; message: string }
  | { type: 'notify'; title: string; body: string }

/**
 * 生命周期配置
 */
export interface AppLifecycleConfig {
  onInstall?: LifecycleAction[]
  onUninstall?: LifecycleAction[]
  onActivate?: LifecycleAction[]
  onDeactivate?: LifecycleAction[]
  onUpdate?: LifecycleAction[]
}

// ===== 应用包主类型 =====

/**
 * 应用包 - 完整定义
 */
export interface PhoneAppPackage {
  // ===== 元信息 =====
  /** 应用包格式版本 */
  $schema?: string
  
  /** 包格式版本 */
  packageVersion: string
  
  // ===== 基础信息 =====
  /** 应用唯一标识符 */
  id: string
  
  /** 应用名称 */
  name: string
  
  /** 应用版本 (语义化版本) */
  version: string
  
  /** 应用描述 */
  description?: string
  
  /** 作者信息 */
  author?: AuthorInfo
  
  /** 应用主页/仓库地址 */
  homepage?: string
  
  /** 许可证 */
  license?: string
  
  /** 关键词 (用于搜索) */
  keywords?: string[]
  
  /** 分类 */
  category?: AppCategory
  
  // ===== 图标与外观 =====
  /** 应用图标 */
  icon: AppIconConfig
  
  // ===== 应用类型与配置 =====
  /** 应用类型 */
  appType: AppType
  
  /** 配置式应用配置 */
  configurable?: ConfigurableAppConfig
  
  /** 模板式应用配置 */
  template?: TemplateAppConfig
  
  /** 组合式应用配置 */
  composite?: CompositeAppConfig
  
  // ===== 数据与状态 =====
  /** 数据源配置 */
  dataSource?: DataSourceConfig
  
  /** 初始状态 */
  initialState?: Record<string, unknown>
  
  /** 持久化配置 */
  persistence?: PersistenceConfig
  
  // ===== AI 集成 =====
  /** AI 命令配置 */
  aiCommands?: AICommandConfig[]
  
  /** 内置提示词 */
  prompts?: PackageAppPromptDefinition[]
  
  // ===== 权限声明 =====
  /** 所需权限 */
  permissions?: AppPermission[]
  
  // ===== 生命周期 =====
  /** 生命周期配置 */
  lifecycle?: AppLifecycleConfig
  
  // ===== 兼容性 =====
  /** 最低兼容的小手机版本 */
  minPhoneVersion?: string
  
  /** 依赖的其他应用 */
  dependencies?: Record<string, string>
  
  // ===== 数据隔离与迁移 =====
  
  /**
   * 数据版本号
   * - 用于数据迁移判断
   * - 仅当数据结构变化时递增
   * - 默认为 1
   */
  dataVersion?: number
  
  /**
   * 数据迁移配置
   * - 键为 "fromVersion:toVersion"
   * - 值为迁移动作数组
   */
  dataMigrations?: Record<string, import('./appIdentity').DataMigrationAction[]>
  
  /** 仓库签名（仓库分发时附加） */
  repositorySignature?: import('./appIdentity').RepositorySignature
}

// ===== 已安装应用 =====

/**
 * 已安装应用（基础版）
 */
export interface InstalledApp {
  /** 应用 ID */
  id: string
  
  /** 安装版本 */
  version: string
  
  /** 安装时间 */
  installedAt: string
  
  /** 更新时间 */
  updatedAt?: string
  
  /** 来源 */
  source: AppSource
  
  /** 来源 URL */
  sourceUrl?: string
  
  /** 状态 */
  status: AppStatus
  
  /** 应用包数据 */
  package: PhoneAppPackage
  
  /** 用户授予的权限 */
  grantedPermissions: AppPermission[]
  
  /** 用户数据 */
  userData?: Record<string, unknown>
}

/**
 * 已安装应用（扩展版，包含身份识别和数据隔离信息）
 */
export interface InstalledAppExtended extends InstalledApp {
  /** 应用来源详情 */
  sourceInfo: import('./appIdentity').AppSourceInfo
  
  /**
   * 安装 ID（随机生成）
   * - 用于本地导入应用的数据隔离
   */
  installationId: string
  
  /** 数据命名空间（计算得出） */
  dataNamespace: string
  
  /** 当前数据版本 */
  currentDataVersion: number
  
  /** 数据迁移历史 */
  migrationHistory?: import('./appIdentity').MigrationRecord[]
  
  /** 验证状态 */
  verificationStatus: import('./appIdentity').VerificationStatus
}

// ===== 应用仓库类型 =====

/**
 * 仓库元信息
 */
export interface RegistryMeta {
  name: string
  description: string
  version: string
  lastUpdated: string
  maintainer: {
    name: string
    url?: string
  }
}

/**
 * 分类信息
 */
export interface AppCategoryInfo {
  id: AppCategory
  name: string
  icon: string
  count: number
}

/**
 * 应用仓库条目
 */
export interface AppRegistryEntry {
  /** 应用 ID */
  id: string
  
  /** 应用名称 */
  name: string
  
  /** 当前版本 */
  version: string
  
  /** 简短描述 */
  description: string
  
  /** 分类 */
  category: AppCategory
  
  /** 图标 */
  icon: AppIconConfig
  
  /** 作者 */
  author: string
  
  /** 下载量 */
  downloads?: number
  
  /** 评分 */
  rating?: number
  
  /** 更新时间 */
  updatedAt: string
  
  /** 包下载地址 */
  packageUrl: string
  
  /** 包大小 (bytes) */
  packageSize?: number
  
  /** SHA256 校验和 */
  checksum?: string
  
  /** 截图 */
  screenshots?: string[]
  
  /** 所需权限 */
  permissions?: AppPermission[]
  
  /** 兼容性 */
  minPhoneVersion?: string
}

/**
 * 应用仓库索引
 */
export interface AppRegistry {
  /** 仓库元信息 */
  registry: RegistryMeta
  
  /** 应用列表 */
  apps: AppRegistryEntry[]
  
  /** 分类信息 */
  categories: AppCategoryInfo[]
  
  /** 精选/推荐应用 ID */
  featured?: string[]
}

// ===== 权限描述 =====

/**
 * 权限描述映射
 */
export const PERMISSION_DESCRIPTIONS: Record<AppPermission, { name: string; description: string; risk: 'low' | 'medium' | 'high' }> = {
  storage: {
    name: '存储',
    description: '读写应用数据',
    risk: 'low'
  },
  'ai-generate': {
    name: 'AI 生成',
    description: '调用 AI 生成内容',
    risk: 'medium'
  },
  notifications: {
    name: '通知',
    description: '发送系统通知',
    risk: 'low'
  },
  contacts: {
    name: '联系人',
    description: '访问联系人数据',
    risk: 'medium'
  },
  messages: {
    name: '消息',
    description: '访问聊天消息',
    risk: 'high'
  },
  camera: {
    name: '相机',
    description: '使用虚拟相机',
    risk: 'low'
  },
  location: {
    name: '位置',
    description: '使用虚拟位置',
    risk: 'low'
  }
}

/**
 * 分类名称映射
 */
export const CATEGORY_NAMES: Record<AppCategory, string> = {
  social: '社交',
  tools: '工具',
  entertainment: '娱乐',
  productivity: '效率',
  lifestyle: '生活',
  games: '游戏',
  other: '其他'
}

/**
 * 分类图标映射
 */
export const CATEGORY_ICONS: Record<AppCategory, string> = {
  social: 'fas fa-users',
  tools: 'fas fa-wrench',
  entertainment: 'fas fa-film',
  productivity: 'fas fa-chart-line',
  lifestyle: 'fas fa-heart',
  games: 'fas fa-gamepad',
  other: 'fas fa-ellipsis-h'
}