/**
 * 直播间
 */
export interface LiveStream {
  /** 直播间ID */
  id: string
  /** 标题 */
  title: string
  /** 主播ID */
  streamerId: string
  /** 主播名 */
  streamerName?: string
  /** 封面图 */
  cover?: string
  /** 在线观众数 */
  viewers: number
  /** 状态 */
  status: 'live' | 'offline' | 'preview' | 'replay'
  /** 开始时间 */
  startTime?: number
  /** 分区/分类ID */
  categoryId?: string
  /** 板块ID (数据库索引使用) */
  boardId?: string
  /** 分类名称 (兼容旧字段) */
  category?: string
  /** 来源消息ID */
  sourceMessageId?: number
  /** 其他字段 */
  [key: string]: any
}

/** 弹幕数据 */
export interface Danmaku {
  id: string
  streamId: string
  content: string
  senderId: string
  senderName: string
  timestamp: number
  color?: string
  isSelf?: boolean
}

/** 直播中心数据结构 */
export interface LiveCenterData {
  boards: any[] // 板块列表
  streams: Record<string, LiveStream>
  danmakus: Record<string, Danmaku[]>
}
