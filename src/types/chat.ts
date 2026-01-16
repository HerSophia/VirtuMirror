/**
 * 聊天消息相关类型定义
 */
import { ContactId } from './contact'

/** 消息ID类型 */
export type MessageId = string

/** 消息类型枚举 */
export type MessageType = 
  | 'text' 
  | 'image' 
  | 'voice' 
  | 'sticker' 
  | 'transfer' 
  | 'red_packet' 
  | 'location' 
  | 'system' 
  | 'recall' 
  | 'friend_request'

/** 消息基础接口 */
export interface MessageBase {
  /** 消息唯一ID */
  uid: MessageId
  /** 所属会话/联系人ID */
  contactId: ContactId
  /** 发送者ID */
  senderId: ContactId
  /** 消息类型 */
  type: MessageType
  /** 时间戳 */
  timestamp: number
  /** 来源消息ID（如果有） */
  sourceMessageId?: number
  /** 扩展字段 */
  [key: string]: any
}

/** 文本消息 */
export interface TextMessage extends MessageBase {
  type: 'text'
  content: string
}

/** 撤回消息 */
export interface RecallMessage extends MessageBase {
  type: 'recall'
  recalledMessageId: MessageId
  recallerId: ContactId
}

/** 消息联合类型 */
export type Message = TextMessage | RecallMessage | MessageBase

/** 聊天记录（联系人ID到消息列表的映射） */
export type ChatHistory = Record<ContactId, Message[]>
