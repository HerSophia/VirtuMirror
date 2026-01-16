/**
 * Swipe（消息页）切换状态管理类型定义
 * 
 * 设计背景：
 * - 酒馆支持同一楼层有多个消息页（swipes），用户可以切换
 * - 不同的消息页可能包含不同的手机数据
 * - 只有最后一楼的 swipe 可以切换，中间楼层的 swipe 无法切换
 */

import type {
  Message,
  Contact,
  Moment,
  Email,
  ForumPost,
  LiveStream,
  CallRecord,
} from './index'

// ==================== 数据项来源追踪 ====================

/** 数据项类型 */
export type PhoneDataItemType =
  | 'message'
  | 'contact'
  | 'moment'
  | 'email'
  | 'forum_post'
  | 'live_stream'
  | 'call_record'

/** 数据项来源信息 */
export interface DataItemSource {
  /** 来自哪个楼层（酒馆 message_id） */
  sourceMessageId: number
  /** 来自哪个消息页（swipe_id） */
  sourceSwipeId: number
  /** 所属会话 ID */
  sessionId: string
}

/** 带来源追踪的数据项基类 */
export interface TrackedDataItem extends DataItemSource {
  /** 数据项唯一ID */
  id: string
  /** 数据项类型 */
  itemType: PhoneDataItemType
}

/** 带追踪的消息 */
export interface TrackedMessage extends TrackedDataItem {
  itemType: 'message'
  data: Message
}

/** 带追踪的联系人 */
export interface TrackedContact extends TrackedDataItem {
  itemType: 'contact'
  data: Contact
}

/** 带追踪的朋友圈 */
export interface TrackedMoment extends TrackedDataItem {
  itemType: 'moment'
  data: Moment
}

/** 带追踪的邮件 */
export interface TrackedEmail extends TrackedDataItem {
  itemType: 'email'
  data: Email
}

/** 带追踪的论坛帖子 */
export interface TrackedForumPost extends TrackedDataItem {
  itemType: 'forum_post'
  data: ForumPost
}

/** 带追踪的直播间 */
export interface TrackedLiveStream extends TrackedDataItem {
  itemType: 'live_stream'
  data: LiveStream
}

/** 带追踪的通话记录 */
export interface TrackedCallRecord extends TrackedDataItem {
  itemType: 'call_record'
  data: CallRecord
}

/** 联合类型：所有带追踪的数据项 */
export type PhoneDataItem =
  | TrackedMessage
  | TrackedContact
  | TrackedMoment
  | TrackedEmail
  | TrackedForumPost
  | TrackedLiveStream
  | TrackedCallRecord

// ==================== 分层状态存储 ====================

/** 最后楼层的分支数据 */
export interface LastFloorData {
  /** 最后楼层的楼层号 */
  messageId: number
  /** 当前显示的 swipe ID */
  currentSwipeId: number
  /** 总共有几个 swipe */
  swipeCount: number
  /** 每个 swipe 对应的数据 */
  swipeData: Map<number, PhoneDataItem[]>
}

/** 手机状态（分层存储） */
export interface PhoneState {
  /** 当前会话 ID */
  sessionId: string
  
  /** 已确定的历史数据（非最后楼层） */
  permanentData: PhoneDataItem[]
  
  /** 最后楼层的分支数据 */
  lastFloor: LastFloorData | null
}

// ==================== Swipe 事件类型 ====================

/** Swipe 切换事件 */
export interface SwipeChangedEvent {
  /** 被切换 swipe 的楼层号 */
  messageId: number
  /** 新的 swipe ID */
  newSwipeId: number
  /** 总共有几个 swipe */
  swipeCount: number
  /** 新 swipe 的内容 */
  content: string
  /** 所属会话 ID */
  sessionId: string
  /** 时间戳 */
  timestamp: number
}

/** 楼层删除事件（需要用户确认） */
export interface MessageDeletedEvent {
  /** 被删除的楼层号 */
  messageId: number
  /** 所属会话 ID */
  sessionId: string
  /** 是否需要用户确认 */
  requireConfirmation: boolean
  /** 时间戳 */
  timestamp: number
}

// ==================== 工具函数 ====================

/**
 * 获取当前显示的数据
 * 合并永久数据和最后楼层当前 swipe 的数据
 */
export function getVisibleData(state: PhoneState): PhoneDataItem[] {
  const result = [...state.permanentData]
  
  if (state.lastFloor) {
    const currentData = state.lastFloor.swipeData.get(state.lastFloor.currentSwipeId)
    if (currentData) {
      result.push(...currentData)
    }
  }
  
  return result
}

/**
 * 按类型过滤数据项
 */
export function filterByType<T extends PhoneDataItem['itemType']>(
  items: PhoneDataItem[],
  type: T
): Extract<PhoneDataItem, { itemType: T }>[] {
  return items.filter((item) => item.itemType === type) as Extract<
    PhoneDataItem,
    { itemType: T }
  >[]
}

/**
 * 根据来源楼层过滤数据
 */
export function filterBySourceMessage(
  items: PhoneDataItem[],
  messageId: number
): PhoneDataItem[] {
  return items.filter((item) => item.sourceMessageId === messageId)
}

/**
 * 删除指定楼层的数据
 */
export function removeBySourceMessage(
  items: PhoneDataItem[],
  messageId: number
): PhoneDataItem[] {
  return items.filter((item) => item.sourceMessageId !== messageId)
}

/**
 * 创建空的手机状态
 */
export function createEmptyPhoneState(sessionId: string): PhoneState {
  return {
    sessionId,
    permanentData: [],
    lastFloor: null,
  }
}

/**
 * 固化最后楼层到永久数据
 * 当新消息到来时，需要将之前的最后楼层固化
 */
export function consolidateLastFloor(state: PhoneState): PhoneState {
  if (!state.lastFloor) {
    return state
  }
  
  // 获取当前 swipe 的数据
  const currentData = state.lastFloor.swipeData.get(state.lastFloor.currentSwipeId) || []
  
  return {
    ...state,
    permanentData: [...state.permanentData, ...currentData],
    lastFloor: null,
  }
}

/**
 * 切换到新的 swipe
 */
export function switchSwipe(state: PhoneState, newSwipeId: number): PhoneState {
  if (!state.lastFloor) {
    return state
  }
  
  return {
    ...state,
    lastFloor: {
      ...state.lastFloor,
      currentSwipeId: newSwipeId,
    },
  }
}
