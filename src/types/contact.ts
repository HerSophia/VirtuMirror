/**
 * 联系人相关类型定义
 */

/** 联系人ID类型 */
export type ContactId = string

/** 联系人类型 */
export type ContactType = 'private' | 'group'

/** 联系人接口 */
export interface Contact {
  /** 联系人ID */
  id: ContactId
  /** 显示名称 */
  name: string
  /** 头像URL */
  avatar?: string
  /** 备注名 */
  remark?: string
  /** 联系人类型 */
  type?: ContactType
  /** 未读消息数 */
  unreadCount?: number
  /** 最后消息时间戳 */
  lastMessageTime?: number
  /** 是否在线 */
  online?: boolean
  /** 群成员ID列表（仅群聊有效） */
  members?: ContactId[]
  /** 扩展字段 */
  [key: string]: any
}

/** 联系人目录（ID到联系人的映射） */
export type ContactDirectory = Record<ContactId, Contact>

/** 玩家ID常量 */
export const PLAYER_ID: ContactId = 'user'

/** 通话记录 */
export interface CallRecord {
  id: string;
  contactId: string;
  type: 'incoming' | 'outgoing' | 'missed';
  startTime: number;
  duration: number; // seconds
  status: 'completed' | 'rejected' | 'cancelled' | 'busy';
}
