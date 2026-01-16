/**
 * 浏览器书签
 */
export interface Bookmark {
  /** 书签ID */
  id?: string
  /** 标题 */
  title: string
  /** URL */
  url: string
  /** 图标 */
  icon?: string
  /** 图标 (兼容字段) */
  favicon?: string
  /** 文件夹 */
  folder?: string
  /** 创建时间 */
  createdAt?: number
}

/** 浏览器书签项 (兼容旧名) */
export type BrowserBookmark = Bookmark

/**
 * 浏览历史
 */
export interface BrowsingHistory {
  /** 标题 */
  title: string
  /** URL */
  url: string
  /** 访问时间 */
  timestamp: number
  /** 图标 */
  icon?: string
  /** 图标 (兼容字段) */
  favicon?: string
}

/** 浏览器历史记录项 (兼容旧名) */
export type BrowserHistoryItem = BrowsingHistory

/** 浏览器页面数据 */
export interface BrowserPageData {
  url: string
  title: string
  content: string
  [key: string]: any
}

/** 浏览器数据结构 */
export interface BrowserData {
  history: BrowsingHistory[]
  bookmarks: Bookmark[]
  searchResults: Record<string, any[]>
  pages: Record<string, BrowserPageData>
}
