/**
 * 持久化数据类型定义
 * 定义存储在聊天变量中的小手机数据结构
 */

import type {
  Contact,
  Message,
  Moment,
  CallRecord,
  Email,
  BrowsingHistory,
  Bookmark,
  ForumPost,
  LiveStream,
} from './index'

/**
 * 聊天数据 - 存储在聊天变量中的聊天App数据
 */
export interface ChatAppData {
  /** 对话记录 - 按联系人ID索引 */
  conversations: Record<string, Message[]>
  /** 未读数 - 按联系人ID索引 */
  unreadCounts: Record<string, number>
}

/**
 * 联系人数据
 */
export interface ContactsData {
  /** 联系人列表 */
  list: Contact[]
  /** 收藏的联系人ID列表 */
  favorites: string[]
}

/**
 * 朋友圈数据
 */
export interface MomentsData {
  /** 动态列表 */
  posts: Moment[]
  /** 草稿 */
  drafts: MomentDraft[]
}

/**
 * 朋友圈草稿
 */
export interface MomentDraft {
  id: string
  content: string
  images?: string[]
  location?: string
  createdAt: string
}

/**
 * 通话数据
 */
export interface CallsData {
  /** 通话记录 */
  history: CallRecord[]
  /** 未接来电数 */
  missed: number
}

/**
 * 邮件数据
 */
export interface EmailData {
  /** 收件箱 */
  inbox: Email[]
  /** 已发送 */
  sent: Email[]
  /** 草稿 */
  drafts: Email[]
}

/**
 * 论坛数据
 */
export interface ForumUserData {
  /** 收藏的帖子ID */
  bookmarks: string[]
  /** 浏览历史 */
  history: string[]
  /** 用户发布的帖子 */
  userPosts?: ForumPost[]
}

/**
 * 浏览器数据
 */
export interface BrowserUserData {
  /** 浏览历史 */
  history: BrowsingHistory[]
  /** 书签 */
  bookmarks: Bookmark[]
}

/**
 * 直播数据
 */
export interface LiveUserData {
  /** 关注的主播ID */
  following: string[]
  /** 观看历史 */
  watchHistory: string[]
}

/**
 * 小手机聊天数据 - 存储在聊天变量中
 * 每个聊天（角色对话）有独立的数据
 */
export interface PhoneChatData {
  /** 聊天App数据 */
  chat: ChatAppData
  
  /** 联系人数据 */
  contacts: ContactsData
  
  /** 朋友圈数据 */
  moments: MomentsData
  
  /** 通话数据 */
  calls: CallsData
  
  /** 邮件数据 */
  email: EmailData
  
  /** 论坛用户数据 */
  forum: ForumUserData
  
  /** 浏览器用户数据 */
  browser: BrowserUserData
  
  /** 直播用户数据 */
  live: LiveUserData
  
  /** 元数据 */
  _meta: PhoneDataMeta
}

/**
 * 数据元信息
 */
export interface PhoneDataMeta {
  /** 数据版本号 */
  version: string
  /** 最后更新时间 (ISO 8601) */
  lastUpdated: string
  /** 创建时间 (ISO 8601) */
  createdAt?: string
}

/**
 * 聊天变量中的存储键名
 */
export const CHAT_DATA_KEY = '小手机' as const

/**
 * 创建空的聊天数据
 */
export function createEmptyPhoneChatData(): PhoneChatData {
  const now = new Date().toISOString()
  return {
    chat: {
      conversations: {},
      unreadCounts: {},
    },
    contacts: {
      list: [],
      favorites: [],
    },
    moments: {
      posts: [],
      drafts: [],
    },
    calls: {
      history: [],
      missed: 0,
    },
    email: {
      inbox: [],
      sent: [],
      drafts: [],
    },
    forum: {
      bookmarks: [],
      history: [],
    },
    browser: {
      history: [],
      bookmarks: [],
    },
    live: {
      following: [],
      watchHistory: [],
    },
    _meta: {
      version: '1.0.0',
      lastUpdated: now,
      createdAt: now,
    },
  }
}

/**
 * 部分更新类型 - 用于深度合并更新
 */
export type PartialPhoneChatData = {
  [K in keyof PhoneChatData]?: Partial<PhoneChatData[K]>
}