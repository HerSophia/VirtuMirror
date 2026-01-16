/**
 * 存储类型定义 V2
 * 
 * 按应用分类的存储架构
 */

// ============ 应用定义 ============

/** 内置应用ID */
export type BuiltinAppId =
  | 'contacts'      // 通讯录
  | 'messages'      // 短信
  | 'moments'       // 朋友圈
  | 'phone'         // 电话
  | 'email'         // 邮件
  | 'forum'         // 论坛
  | 'browser'       // 浏览器
  | 'live'          // 直播
  | 'weibo'         // 微博

/** 数据类别 */
export type DataCategory =
  | 'apps'          // 应用数据
  | 'global'        // 全局设置
  | 'accounts'      // 账号系统
  | 'prompt-chains' // 提示词链
  | 'tavern-cache'  // 酒馆原始消息缓存（非小手机数据）

// ============ 应用数据映射 ============

/** 应用到数据表的映射 */
export const APP_TABLE_MAPPING: Record<BuiltinAppId, string[]> = {
  contacts: ['contacts'],
  messages: ['messages'],
  moments: ['moments'],
  phone: ['calls'],
  email: ['emails'],
  forum: ['forumBoards', 'forumPosts'],
  browser: ['bookmarks', 'browsingHistory'],
  live: ['liveStreams'],
  weibo: ['socialPosts', 'socialComments', 'socialTopics', 'socialAccounts', 'socialIdentities', 'socialSuperTopics'],
}

/** 旧表名到应用的反向映射 */
export const TABLE_TO_APP_MAPPING: Record<string, BuiltinAppId> = {
  contacts: 'contacts',
  messages: 'messages',
  moments: 'moments',
  calls: 'phone',
  emails: 'email',
  forumBoards: 'forum',
  forumPosts: 'forum',
  bookmarks: 'browser',
  browsingHistory: 'browser',
  liveStreams: 'live',
  socialPosts: 'weibo',
  socialComments: 'weibo',
  socialTopics: 'weibo',
  socialAccounts: 'weibo',
  socialIdentities: 'weibo',
  socialSuperTopics: 'weibo',
}

// ============ 元信息类型 ============

/** 会话元信息 */
export interface SessionMeta {
  id: string
  platform: string
  characterName: string
  playerName: string
  createdAt: number
  lastActiveAt: number
  lastSyncAt?: number
  version: number
  /** 存储架构版本 */
  storageVersion?: 2
  /** 各应用的统计信息 (V2.1) */
  apps?: Record<string, AppMeta>
  /** 全局数据统计 */
  global?: {
    settings?: { count: number; updatedAt: number }
    desktop?: { updatedAt: number }
  }
  /** @deprecated 旧版表信息，用于兼容层 */
  tables?: {
    [key: string]: {
      count: number
      updatedAt: number
      checksum?: string
    }
  }
}

/** 应用元信息 */
export interface AppMeta {
  /** 应用ID */
  appId: string
  /** 数据表统计 */
  tables: Record<string, {
    count: number
    updatedAt: number
    checksum?: string
  }>
  /** 总记录数 */
  totalCount: number
  /** 最后更新时间 */
  updatedAt: number
}

// ============ 数据包装类型 ============

/** 应用数据包装 */
export interface AppData<T = unknown> {
  appId: string
  sessionId: string
  version: number
  updatedAt: number
  /** 数据表（一个应用可能有多个表） */
  tables: Record<string, T[]>
}

/** 兼容旧版：表数据包装 */
export interface TableData<T = unknown> {
  table: string
  sessionId: string
  version: number
  updatedAt: number
  count: number
  data: T[]
}

// ============ 变更记录 ============

/** 变更记录 */
export interface ChangeRecord {
  /** 应用ID */
  appId: string
  /** 表名（应用内的子表） */
  table: string
  /** 记录键 */
  key: string | number
  /** 操作类型 */
  operation: 'insert' | 'update' | 'delete'
  /** 新值（delete 时为空） */
  value?: unknown
  /** 时间戳 */
  timestamp: number
  /** 设备ID */
  deviceId: string
}

// ============ 备份选项 ============

/** 备份选项 */
export interface BackupOptions {
  /** 包含的应用列表（空表示全部） */
  includeApps?: string[]
  /** 排除的应用列表 */
  excludeApps?: string[]
  /** 是否包含全局数据 */
  includeGlobal?: boolean
  /** 是否包含账号系统 */
  includeAccounts?: boolean
  /** 是否包含提示词链 */
  includePromptChains?: boolean
}

/** 恢复选项 */
export interface RestoreOptions {
  /** 是否覆盖全局设置 */
  overwriteGlobalSettings?: boolean
  /** 应用数据策略 */
  appDataStrategy?: 'merge' | 'overwrite'
  /** 只恢复指定应用 */
  onlyApps?: string[]
}

// ============ 存储配置 ============

/** 存储配置 */
export interface StorageV2Config {
  /** 基础目录 */
  baseDir: string
  /** 是否启用增量同步 */
  enableIncrementalSync: boolean
  /** 变更日志保留时间（毫秒） */
  changeLogRetention: number
  /** 是否压缩存储 */
  compress: boolean
}

export const DEFAULT_CONFIG: StorageV2Config = {
  baseDir: './data/storage',
  enableIncrementalSync: true,
  changeLogRetention: 7 * 24 * 60 * 60 * 1000, // 7 天
  compress: false,
}

// ============ 旧版兼容 ============

/** @deprecated 使用 BuiltinAppId 代替 */
export type TableName =
  | 'contacts'
  | 'messages'
  | 'moments'
  | 'emails'
  | 'appData'
  | 'sessions'
