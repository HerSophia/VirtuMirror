/**
 * IndexedDB 数据库 Schema 定义
 * 使用 Dexie.js 作为 IndexedDB 封装库
 * 
 * 设计要点：
 * 1. 使用 sessionId 区分不同的聊天会话
 * 2. 支持 swipe 相关的索引以实现消息页切换追踪
 * 3. 应用设置为全局配置，不分会话
 */

import Dexie, { type Table } from 'dexie'
import type {
  Contact,
  Message,
  Moment,
  CallRecord,
  Email,
  ForumPost,
  ForumBoard,
  LiveStream,
  Bookmark,
  BrowsingHistory,
} from '@/types'
import type { TrustedRepository } from '@/types/appIdentity'
import type {
  UniversalPost,
  UniversalComment,
  TrendingTopic,
  PlatformAccount as SocialPlatformAccount,
  SocialIdentity,
  SuperTopic
} from '@/types/social'
import type {
  CharacterEntity,
  PlatformAccount,
  SocialRelation
} from '@/types/account'
import type {
  StoredPromptChain,
  ChainExecutionHistory
} from '@/types/promptChain'

// ============ 数据库实体类型 ============

/** 会话信息 - 用于区分不同的角色/聊天上下文 */
export interface Session {
  /** 会话ID (platform:chatId 组合) */
  id: string
  /** 来源平台: 'sillytavern' | 'modern-tavern' | 'standalone' */
  platform: string
  /** 平台内的聊天标识（UUID） */
  chatId: string
  /** 角色名 */
  characterName: string
  /** 玩家名 */
  playerName: string
  /** 角色卡 ID（可选） */
  characterCardId?: string
  /** 创建时间 */
  createdAt: number
  /** 最后活跃时间 */
  lastActiveAt: number
}

/** 存储的联系人 (带会话关联) */
export interface StoredContact extends Contact {
  /** 所属会话ID */
  sessionId: string
  /** 来源楼层（酒馆 message_id） */
  sourceMessageId?: number
  /** 来源消息页（swipe_id） */
  sourceSwipeId?: number
}

/** 消息存储扩展字段 */
export interface MessageStorageFields {
  /** 所属会话ID */
  sessionId: string
  /** 来源楼层（酒馆 message_id） */
  sourceMessageId: number
  /** 来源消息页（swipe_id） */
  sourceSwipeId: number
}

/** 存储的消息（使用交叉类型，因为 Message 是联合类型） */
export type StoredMessage = Message & MessageStorageFields

/** 存储的朋友圈动态 */
export interface StoredMoment extends Moment {
  /** 所属会话ID */
  sessionId: string
  /** 来源楼层 */
  sourceMessageId?: number
  /** 来源消息页 */
  sourceSwipeId?: number
}

/** 存储的通话记录 */
export interface StoredCallRecord extends CallRecord {
  /** 所属会话ID */
  sessionId: string
  /** 来源楼层 */
  sourceMessageId?: number
  /** 来源消息页 */
  sourceSwipeId?: number
}

/** 存储的邮件 */
export interface StoredEmail extends Email {
  /** 所属会话ID */
  sessionId: string
  /** 邮件文件夹 */
  folder: 'inbox' | 'sent' | 'drafts' | 'trash'
  /** 来源楼层 */
  sourceMessageId?: number
  /** 来源消息页 */
  sourceSwipeId?: number
}

/** 存储的论坛板块 */
export interface StoredForumBoard extends ForumBoard {
  /** 所属会话ID */
  sessionId: string
}

/** 存储的论坛帖子 */
export interface StoredForumPost extends ForumPost {
  /** 所属会话ID */
  sessionId: string
  /** 来源楼层 */
  sourceMessageId?: number
  /** 来源消息页 */
  sourceSwipeId?: number
}

/** 存储的直播间 */
export interface StoredLiveStream extends LiveStream {
  /** 所属会话ID */
  sessionId: string
  /** 来源楼层 */
  sourceMessageId?: number
  /** 来源消息页 */
  sourceSwipeId?: number
}

/** 存储的书签 */
export interface StoredBookmark extends Bookmark {
  /** 所属会话ID */
  sessionId: string
}

/** 存储的浏览历史 */
export interface StoredBrowsingHistory extends BrowsingHistory {
  /** 所属会话ID */
  sessionId: string
}

/** App 设置 (全局，不分会话) */
export interface AppSettings {
  /** 设置键名 */
  key: string
  /** 设置值 */
  value: unknown
  /** 更新时间 */
  updatedAt: number
}

/** 桌面布局 */
export interface DesktopLayout {
  /** 所属会话ID */
  sessionId: string
  /** 页面布局 */
  pages: unknown[]
  /** Dock 栏应用ID列表 */
  dockAppIds: string[]
  /** 更新时间 */
  updatedAt: number
}

/** 应用数据记录 */
export interface AppDataRecord {
  /** 数据命名空间 */
  namespace: string
  
  /** 数据键 */
  key: string
  
  /** 数据值 */
  value: unknown
  
  /** 数据版本 */
  version: number
  
  /** 更新时间 */
  updatedAt: number
}

// ============ 数据库定义 ============

export class PhoneDatabase extends Dexie {
  // 核心表
  sessions!: Table<Session>
  
  // 聊天相关
  contacts!: Table<StoredContact>
  messages!: Table<StoredMessage>
  
  // 社交相关
  moments!: Table<StoredMoment>
  calls!: Table<StoredCallRecord>
  
  // 邮件
  emails!: Table<StoredEmail>
  
  // 论坛
  forumBoards!: Table<StoredForumBoard>
  forumPosts!: Table<StoredForumPost>
  
  // 直播
  liveStreams!: Table<StoredLiveStream>
  
  // 浏览器
  bookmarks!: Table<StoredBookmark>
  browsingHistory!: Table<StoredBrowsingHistory>
  
  // 设置
  appSettings!: Table<AppSettings>
  desktopLayouts!: Table<DesktopLayout>
  
  // 应用身份与数据隔离
  appData!: Table<AppDataRecord>
  trustedRepositories!: Table<TrustedRepository>

  // 社交媒体引擎（旧系统，逐步迁移到账号系统）
  socialPosts!: Table<UniversalPost>
  socialComments!: Table<UniversalComment>
  socialTopics!: Table<TrendingTopic>
  socialAccounts!: Table<SocialPlatformAccount>
  socialIdentities!: Table<SocialIdentity>
  socialSuperTopics!: Table<SuperTopic>

  // 账号系统 (Account Service) - 新的统一身份系统
  characterEntities!: Table<CharacterEntity>
  platformAccounts!: Table<PlatformAccount>
  socialRelations!: Table<SocialRelation>

  // 提示词链系统
  promptChains!: Table<StoredPromptChain>
  chainExecutionHistory!: Table<ChainExecutionHistory>

  constructor() {
    super('PhoneSimulator')
    
    this.version(1).stores({
      // 会话管理
      sessions: 'id, platform, chatId, lastActiveAt',
      
      // 联系人: 按会话+ID索引，支持按名称搜索，支持按来源楼层和消息页过滤
      contacts: '[sessionId+id], sessionId, name, type, [sessionId+sourceMessageId], [sessionId+sourceMessageId+sourceSwipeId]',
      
      // 消息: 按会话+联系人+时间索引，支持全文搜索，支持按来源楼层和消息页过滤
      messages: '[sessionId+uid], [sessionId+contactId], sessionId, timestamp, type, [sessionId+sourceMessageId], [sessionId+sourceMessageId+sourceSwipeId]',
      
      // 朋友圈: 按会话+时间索引，支持按来源过滤
      moments: '[sessionId+id], sessionId, authorId, timestamp, [sessionId+sourceMessageId], [sessionId+sourceMessageId+sourceSwipeId]',
      
      // 通话: 按会话+时间索引，支持按来源过滤
      calls: '[sessionId+id], sessionId, contactId, startTime, [sessionId+sourceMessageId], [sessionId+sourceMessageId+sourceSwipeId]',
      
      // 邮件: 按会话+文件夹+时间索引，支持按来源过滤
      emails: '[sessionId+id], [sessionId+folder], sessionId, timestamp, read, [sessionId+sourceMessageId], [sessionId+sourceMessageId+sourceSwipeId]',
      
      // 论坛
      forumBoards: '[sessionId+id], sessionId',
      forumPosts: '[sessionId+id], [sessionId+boardId], sessionId, timestamp, [sessionId+sourceMessageId], [sessionId+sourceMessageId+sourceSwipeId]',
      
      // 直播
      liveStreams: '[sessionId+id], [sessionId+boardId], sessionId, status, [sessionId+sourceMessageId], [sessionId+sourceMessageId+sourceSwipeId]',
      
      // 浏览器
      bookmarks: '[sessionId+id], sessionId, createdAt',
      browsingHistory: '[sessionId+url+timestamp], sessionId, timestamp',
      
      // 设置 (全局)
      appSettings: 'key',
      desktopLayouts: 'sessionId',
    })
    
    // 版本2：添加应用数据隔离表
    this.version(2).stores({
      // 继承版本1的所有表
      sessions: 'id, platform, chatId, lastActiveAt',
      contacts: '[sessionId+id], sessionId, name, type, [sessionId+sourceMessageId], [sessionId+sourceMessageId+sourceSwipeId]',
      messages: '[sessionId+uid], [sessionId+contactId], sessionId, timestamp, type, [sessionId+sourceMessageId], [sessionId+sourceMessageId+sourceSwipeId]',
      moments: '[sessionId+id], sessionId, authorId, timestamp, [sessionId+sourceMessageId], [sessionId+sourceMessageId+sourceSwipeId]',
      calls: '[sessionId+id], sessionId, contactId, startTime, [sessionId+sourceMessageId], [sessionId+sourceMessageId+sourceSwipeId]',
      emails: '[sessionId+id], [sessionId+folder], sessionId, timestamp, read, [sessionId+sourceMessageId], [sessionId+sourceMessageId+sourceSwipeId]',
      forumBoards: '[sessionId+id], sessionId',
      forumPosts: '[sessionId+id], [sessionId+boardId], sessionId, timestamp, [sessionId+sourceMessageId], [sessionId+sourceMessageId+sourceSwipeId]',
      liveStreams: '[sessionId+id], [sessionId+boardId], sessionId, status, [sessionId+sourceMessageId], [sessionId+sourceMessageId+sourceSwipeId]',
      bookmarks: '[sessionId+id], sessionId, createdAt',
      browsingHistory: '[sessionId+url+timestamp], sessionId, timestamp',
      appSettings: 'key',
      desktopLayouts: 'sessionId',
      
      // 新增：应用数据表（按命名空间隔离）
      appData: '[namespace+key], namespace, updatedAt',
      
      // 新增：受信任仓库表
      trustedRepositories: 'id, trustLevel, addedAt',
    })

    // 版本3：添加社交媒体模拟引擎相关表
    this.version(3).stores({
      // 继承版本2的所有表
      sessions: 'id, platform, chatId, lastActiveAt',
      contacts: '[sessionId+id], sessionId, name, type, [sessionId+sourceMessageId], [sessionId+sourceMessageId+sourceSwipeId]',
      messages: '[sessionId+uid], [sessionId+contactId], sessionId, timestamp, type, [sessionId+sourceMessageId], [sessionId+sourceMessageId+sourceSwipeId]',
      moments: '[sessionId+id], sessionId, authorId, timestamp, [sessionId+sourceMessageId], [sessionId+sourceMessageId+sourceSwipeId]',
      calls: '[sessionId+id], sessionId, contactId, startTime, [sessionId+sourceMessageId], [sessionId+sourceMessageId+sourceSwipeId]',
      emails: '[sessionId+id], [sessionId+folder], sessionId, timestamp, read, [sessionId+sourceMessageId], [sessionId+sourceMessageId+sourceSwipeId]',
      forumBoards: '[sessionId+id], sessionId',
      forumPosts: '[sessionId+id], [sessionId+boardId], sessionId, timestamp, [sessionId+sourceMessageId], [sessionId+sourceMessageId+sourceSwipeId]',
      liveStreams: '[sessionId+id], [sessionId+boardId], sessionId, status, [sessionId+sourceMessageId], [sessionId+sourceMessageId+sourceSwipeId]',
      bookmarks: '[sessionId+id], sessionId, createdAt',
      browsingHistory: '[sessionId+url+timestamp], sessionId, timestamp',
      appSettings: 'key',
      desktopLayouts: 'sessionId',
      appData: '[namespace+key], namespace, updatedAt',
      trustedRepositories: 'id, trustLevel, addedAt',

      // 新增：社交媒体引擎表
      // 注意：社交表暂不强制 namespace 索引，先引入字段，后续可按需优化索引
      socialPosts: 'id, platformId, namespace, [platformId+timestamp], *topicTags, authorId', // *topicTags 表示多值索引
      socialComments: 'id, [postId+timestamp], platformId, namespace, authorId',
      socialTopics: 'id, platformId, namespace, [platformId+isHot], [platformId+isNew], *categories',
      socialAccounts: 'id, [platformId+identityId], platformId, handle',
      socialIdentities: 'id, type',
      socialSuperTopics: 'id, category, *keywords',
    })

    // 版本4：添加账号系统 (Account Service) 相关表
    this.version(4).stores({
      // 继承版本3的所有表
      sessions: 'id, platform, chatId, lastActiveAt',
      contacts: '[sessionId+id], sessionId, name, type, [sessionId+sourceMessageId], [sessionId+sourceMessageId+sourceSwipeId]',
      messages: '[sessionId+uid], [sessionId+contactId], sessionId, timestamp, type, [sessionId+sourceMessageId], [sessionId+sourceMessageId+sourceSwipeId]',
      moments: '[sessionId+id], sessionId, authorId, timestamp, [sessionId+sourceMessageId], [sessionId+sourceMessageId+sourceSwipeId]',
      calls: '[sessionId+id], sessionId, contactId, startTime, [sessionId+sourceMessageId], [sessionId+sourceMessageId+sourceSwipeId]',
      emails: '[sessionId+id], [sessionId+folder], sessionId, timestamp, read, [sessionId+sourceMessageId], [sessionId+sourceMessageId+sourceSwipeId]',
      forumBoards: '[sessionId+id], sessionId',
      forumPosts: '[sessionId+id], [sessionId+boardId], sessionId, timestamp, [sessionId+sourceMessageId], [sessionId+sourceMessageId+sourceSwipeId]',
      liveStreams: '[sessionId+id], [sessionId+boardId], sessionId, status, [sessionId+sourceMessageId], [sessionId+sourceMessageId+sourceSwipeId]',
      bookmarks: '[sessionId+id], sessionId, createdAt',
      browsingHistory: '[sessionId+url+timestamp], sessionId, timestamp',
      appSettings: 'key',
      desktopLayouts: 'sessionId',
      appData: '[namespace+key], namespace, updatedAt',
      trustedRepositories: 'id, trustLevel, addedAt',
      socialPosts: 'id, platformId, namespace, [platformId+timestamp], *topicTags, authorId',
      socialComments: 'id, [postId+timestamp], platformId, namespace, authorId',
      socialTopics: 'id, platformId, namespace, [platformId+isHot], [platformId+isNew], *categories',
      socialAccounts: 'id, [platformId+identityId], platformId, handle',
      socialIdentities: 'id, type',
      socialSuperTopics: 'id, category, *keywords',

      // 新增：账号系统表（旧版本，兼容）
      // 角色实体表：按类型筛选、搜索名称、关联角色卡
      characterEntities: 'id, type, displayName, linkedCharacterCardId, source, createdAt',
      // 平台账号表：按实体获取所有账号、按平台获取所有账号、唯一性检查
      // 注意：旧表名用于兼容，新版本会迁移
      accountPlatformAccounts: 'id, entityId, platformId, [platformId+handle], createdAt',
      // 社交关系表：获取关注/好友列表、获取粉丝列表
      accountSocialRelations: 'id, fromEntityId, toEntityId, type, [fromEntityId+type], [toEntityId+type], platformId',
    })

    // 版本5：账号系统升级 - 双层作用域支持
    this.version(5).stores({
      // 继承之前的表
      sessions: 'id, platform, chatId, characterCardId, lastActiveAt',
      contacts: '[sessionId+id], sessionId, name, type, [sessionId+sourceMessageId], [sessionId+sourceMessageId+sourceSwipeId]',
      messages: '[sessionId+uid], [sessionId+contactId], sessionId, timestamp, type, [sessionId+sourceMessageId], [sessionId+sourceMessageId+sourceSwipeId]',
      moments: '[sessionId+id], sessionId, authorId, timestamp, [sessionId+sourceMessageId], [sessionId+sourceMessageId+sourceSwipeId]',
      calls: '[sessionId+id], sessionId, contactId, startTime, [sessionId+sourceMessageId], [sessionId+sourceMessageId+sourceSwipeId]',
      emails: '[sessionId+id], [sessionId+folder], sessionId, timestamp, read, [sessionId+sourceMessageId], [sessionId+sourceMessageId+sourceSwipeId]',
      forumBoards: '[sessionId+id], sessionId',
      forumPosts: '[sessionId+id], [sessionId+boardId], sessionId, timestamp, [sessionId+sourceMessageId], [sessionId+sourceMessageId+sourceSwipeId]',
      liveStreams: '[sessionId+id], [sessionId+boardId], sessionId, status, [sessionId+sourceMessageId], [sessionId+sourceMessageId+sourceSwipeId]',
      bookmarks: '[sessionId+id], sessionId, createdAt',
      browsingHistory: '[sessionId+url+timestamp], sessionId, timestamp',
      appSettings: 'key',
      desktopLayouts: 'sessionId',
      appData: '[namespace+key], namespace, updatedAt',
      trustedRepositories: 'id, trustLevel, addedAt',
      socialPosts: 'id, platformId, namespace, [platformId+timestamp], *topicTags, authorId',
      socialComments: 'id, [postId+timestamp], platformId, namespace, authorId',
      socialTopics: 'id, platformId, namespace, [platformId+isHot], [platformId+isNew], *categories',
      socialAccounts: 'id, [platformId+identityId], platformId, handle',
      socialIdentities: 'id, type',
      socialSuperTopics: 'id, category, *keywords',

      // 删除旧版本兼容表
      accountPlatformAccounts: null,
      accountSocialRelations: null,

      // 账号系统表（v2 - 双层作用域）
      // 角色实体表
      characterEntities: `
        id,
        type,
        displayName,
        scope,
        scopeSessionId,
        scopeCharacterCardId,
        linkedCharacterCardId,
        source,
        createdAt,
        [scope+scopeSessionId],
        [scope+scopeCharacterCardId]
      `,
      
      // 平台账号表（独立作用域）
      platformAccounts: `
        id,
        entityId,
        platformId,
        scope,
        scopeSessionId,
        scopeCharacterCardId,
        [platformId+handle],
        [platformId+scope],
        [platformId+scopeCharacterCardId],
        [entityId+platformId],
        createdAt
      `,
      
      // 社交关系表（基于账号而非实体）
      socialRelations: `
        id,
        fromAccountId,
        toAccountId,
        type,
        [fromAccountId+type],
        [toAccountId+type],
        createdAt
      `
    })

    // 版本6：添加提示词链系统
    this.version(6).stores({
      // 继承之前的所有表
      sessions: 'id, platform, chatId, characterCardId, lastActiveAt',
      contacts: '[sessionId+id], sessionId, name, type, [sessionId+sourceMessageId], [sessionId+sourceMessageId+sourceSwipeId]',
      messages: '[sessionId+uid], [sessionId+contactId], sessionId, timestamp, type, [sessionId+sourceMessageId], [sessionId+sourceMessageId+sourceSwipeId]',
      moments: '[sessionId+id], sessionId, authorId, timestamp, [sessionId+sourceMessageId], [sessionId+sourceMessageId+sourceSwipeId]',
      calls: '[sessionId+id], sessionId, contactId, startTime, [sessionId+sourceMessageId], [sessionId+sourceMessageId+sourceSwipeId]',
      emails: '[sessionId+id], [sessionId+folder], sessionId, timestamp, read, [sessionId+sourceMessageId], [sessionId+sourceMessageId+sourceSwipeId]',
      forumBoards: '[sessionId+id], sessionId',
      forumPosts: '[sessionId+id], [sessionId+boardId], sessionId, timestamp, [sessionId+sourceMessageId], [sessionId+sourceMessageId+sourceSwipeId]',
      liveStreams: '[sessionId+id], [sessionId+boardId], sessionId, status, [sessionId+sourceMessageId], [sessionId+sourceMessageId+sourceSwipeId]',
      bookmarks: '[sessionId+id], sessionId, createdAt',
      browsingHistory: '[sessionId+url+timestamp], sessionId, timestamp',
      appSettings: 'key',
      desktopLayouts: 'sessionId',
      appData: '[namespace+key], namespace, updatedAt',
      trustedRepositories: 'id, trustLevel, addedAt',
      socialPosts: 'id, platformId, [platformId+timestamp], *topicTags, authorId',
      socialComments: 'id, [postId+timestamp], platformId, authorId',
      socialTopics: 'id, [platformId+isHot], [platformId+isNew], *categories',
      socialAccounts: 'id, [platformId+identityId], platformId, handle',
      socialIdentities: 'id, type',
      socialSuperTopics: 'id, category, *keywords',
      characterEntities: `
        id,
        type,
        displayName,
        scope,
        scopeSessionId,
        scopeCharacterCardId,
        linkedCharacterCardId,
        source,
        createdAt,
        [scope+scopeSessionId],
        [scope+scopeCharacterCardId]
      `,
      platformAccounts: `
        id,
        entityId,
        platformId,
        scope,
        scopeSessionId,
        scopeCharacterCardId,
        [platformId+handle],
        [platformId+scope],
        [platformId+scopeCharacterCardId],
        [entityId+platformId],
        createdAt
      `,
      socialRelations: `
        id,
        fromAccountId,
        toAccountId,
        type,
        [fromAccountId+type],
        [toAccountId+type],
        createdAt
      `,

      // 新增：提示词链表
      promptChains: 'id, source, *tags, enabled, createdAt, updatedAt',
      
      // 新增：执行历史表
      chainExecutionHistory: 'executionId, chainId, status, executedAt'
    })

    // 版本7：修复 socialTopics 表索引问题
    this.version(7).stores({
      // 继承之前的所有表
      sessions: 'id, platform, chatId, characterCardId, lastActiveAt',
      contacts: '[sessionId+id], sessionId, name, type, [sessionId+sourceMessageId], [sessionId+sourceMessageId+sourceSwipeId]',
      messages: '[sessionId+uid], [sessionId+contactId], sessionId, timestamp, type, [sessionId+sourceMessageId], [sessionId+sourceMessageId+sourceSwipeId]',
      moments: '[sessionId+id], sessionId, authorId, timestamp, [sessionId+sourceMessageId], [sessionId+sourceMessageId+sourceSwipeId]',
      calls: '[sessionId+id], sessionId, contactId, startTime, [sessionId+sourceMessageId], [sessionId+sourceMessageId+sourceSwipeId]',
      emails: '[sessionId+id], [sessionId+folder], sessionId, timestamp, read, [sessionId+sourceMessageId], [sessionId+sourceMessageId+sourceSwipeId]',
      forumBoards: '[sessionId+id], sessionId',
      forumPosts: '[sessionId+id], [sessionId+boardId], sessionId, timestamp, [sessionId+sourceMessageId], [sessionId+sourceMessageId+sourceSwipeId]',
      liveStreams: '[sessionId+id], [sessionId+boardId], sessionId, status, [sessionId+sourceMessageId], [sessionId+sourceMessageId+sourceSwipeId]',
      bookmarks: '[sessionId+id], sessionId, createdAt',
      browsingHistory: '[sessionId+url+timestamp], sessionId, timestamp',
      appSettings: 'key',
      desktopLayouts: 'sessionId',
      appData: '[namespace+key], namespace, updatedAt',
      trustedRepositories: 'id, trustLevel, addedAt',
      socialPosts: 'id, platformId, namespace, [platformId+timestamp], *topicTags, authorId',
      socialComments: 'id, [postId+timestamp], platformId, namespace, authorId',
      // 修复：添加 platformId 单独索引，以支持 .where('platformId').equals() 查询，同时引入 namespace 字段
      socialTopics: 'id, platformId, namespace, [platformId+isHot], [platformId+isNew], [platformId+createdAt], *categories, createdAt',
      socialAccounts: 'id, [platformId+identityId], platformId, handle',
      socialIdentities: 'id, type',
      socialSuperTopics: 'id, category, *keywords',
      characterEntities: `
        id,
        type,
        displayName,
        scope,
        scopeSessionId,
        scopeCharacterCardId,
        linkedCharacterCardId,
        source,
        createdAt,
        [scope+scopeSessionId],
        [scope+scopeCharacterCardId]
      `,
      platformAccounts: `
        id,
        entityId,
        platformId,
        scope,
        scopeSessionId,
        scopeCharacterCardId,
        [platformId+handle],
        [platformId+scope],
        [platformId+scopeCharacterCardId],
        [entityId+platformId],
        createdAt
      `,
      socialRelations: `
        id,
        fromAccountId,
        toAccountId,
        type,
        [fromAccountId+type],
        [toAccountId+type],
        createdAt
      `,
      promptChains: 'id, source, *tags, enabled, createdAt, updatedAt',
      chainExecutionHistory: 'executionId, chainId, status, executedAt'
    })

    // 版本8：社交表添加来源追踪相关索引（用于会话/楼层/Swipe 绑定）
    // 注意：source 是嵌套对象，Dexie 不支持嵌套索引，主要通过 filter 查询
    // 这里只做 schema 声明，确保表结构兼容
    this.version(8).stores({
      // 继承之前的所有表
      sessions: 'id, platform, chatId, characterCardId, lastActiveAt',
      contacts: '[sessionId+id], sessionId, name, type, [sessionId+sourceMessageId], [sessionId+sourceMessageId+sourceSwipeId]',
      messages: '[sessionId+uid], [sessionId+contactId], sessionId, timestamp, type, [sessionId+sourceMessageId], [sessionId+sourceMessageId+sourceSwipeId]',
      moments: '[sessionId+id], sessionId, authorId, timestamp, [sessionId+sourceMessageId], [sessionId+sourceMessageId+sourceSwipeId]',
      calls: '[sessionId+id], sessionId, contactId, startTime, [sessionId+sourceMessageId], [sessionId+sourceMessageId+sourceSwipeId]',
      emails: '[sessionId+id], [sessionId+folder], sessionId, timestamp, read, [sessionId+sourceMessageId], [sessionId+sourceMessageId+sourceSwipeId]',
      forumBoards: '[sessionId+id], sessionId',
      forumPosts: '[sessionId+id], [sessionId+boardId], sessionId, timestamp, [sessionId+sourceMessageId], [sessionId+sourceMessageId+sourceSwipeId]',
      liveStreams: '[sessionId+id], [sessionId+boardId], sessionId, status, [sessionId+sourceMessageId], [sessionId+sourceMessageId+sourceSwipeId]',
      bookmarks: '[sessionId+id], sessionId, createdAt',
      browsingHistory: '[sessionId+url+timestamp], sessionId, timestamp',
      appSettings: 'key',
      desktopLayouts: 'sessionId',
      appData: '[namespace+key], namespace, updatedAt',
      trustedRepositories: 'id, trustLevel, addedAt',
      // 社交表：保持现有索引，source 字段通过 filter 查询
      socialPosts: 'id, platformId, namespace, [platformId+timestamp], *topicTags, authorId',
      socialComments: 'id, [postId+timestamp], platformId, namespace, authorId',
      socialTopics: 'id, platformId, namespace, [platformId+isHot], [platformId+isNew], [platformId+createdAt], *categories, createdAt',
      socialAccounts: 'id, [platformId+identityId], platformId, handle',
      socialIdentities: 'id, type',
      socialSuperTopics: 'id, category, *keywords',
      characterEntities: `
        id,
        type,
        displayName,
        scope,
        scopeSessionId,
        scopeCharacterCardId,
        linkedCharacterCardId,
        source,
        createdAt,
        [scope+scopeSessionId],
        [scope+scopeCharacterCardId]
      `,
      platformAccounts: `
        id,
        entityId,
        platformId,
        scope,
        scopeSessionId,
        scopeCharacterCardId,
        [platformId+handle],
        [platformId+scope],
        [platformId+scopeCharacterCardId],
        [entityId+platformId],
        createdAt
      `,
      socialRelations: `
        id,
        fromAccountId,
        toAccountId,
        type,
        [fromAccountId+type],
        [toAccountId+type],
        createdAt
      `,
      promptChains: 'id, source, *tags, enabled, createdAt, updatedAt',
      chainExecutionHistory: 'executionId, chainId, status, executedAt'
    })
  }
}

/** 数据库单例 */
export const db = new PhoneDatabase()

// ============ 工具函数 ============

/**
 * 生成会话ID
 */
export function generateSessionId(platform: string, chatId: string): string {
  return `${platform}:${chatId}`
}

/**
 * 解析会话ID
 */
export function parseSessionId(sessionId: string): { platform: string; chatId: string } | null {
  const parts = sessionId.split(':')
  if (parts.length < 2) return null
  return {
    platform: parts[0],
    chatId: parts.slice(1).join(':'),
  }
}
