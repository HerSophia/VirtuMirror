/**
 * 应用数据相关类型定义
 * 
 * @deprecated 这些类型已迁移到特定的模块文件中 (email.ts, live.ts, browser.ts 等)
 */

export type { Email } from './email'
export type { LiveStream, Danmaku, LiveCenterData } from './live'
export type { 
  Bookmark as BrowserBookmark, 
  BrowsingHistory as BrowserHistoryItem,
  BrowserPageData,
  BrowserData
} from './browser'
