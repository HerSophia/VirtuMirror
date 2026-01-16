/**
 * 暂存操作相关类型定义
 */

/** 唯一ID类型 */
export type UniqueId = string

/** 暂存操作类型 */
export type StagedActionType = 
  | 'send_message'
  | 'like_moment'
  | 'comment_moment'
  | 'accept_friend'
  | 'reject_friend'
  | 'accept_call'
  | 'reject_call'
  | 'end_call'
  | 'call_speak'
  | 'forum_post'
  | 'forum_reply'
  | 'send_danmaku'
  | 'browser_search'
  | string

/** 暂存操作接口 */
export interface StagedAction {
  /** 操作ID */
  id: UniqueId
  /** 操作类型 */
  type: StagedActionType
  /** 操作数据 */
  data: Record<string, any>
  /** 创建时间戳 */
  timestamp: number
}
