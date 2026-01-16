/**
 * 邮件
 */
export interface Email {
  /** 邮件ID */
  id: string
  /** 发件人 */
  sender: string
  /** 收件人 */
  recipient?: string
  /** 主题 */
  subject: string
  /** 内容 */
  content: string
  /** 时间戳 */
  timestamp: number
  /** 字符串时间 (兼容旧字段) */
  time?: string
  /** 是否已读 */
  read: boolean
  /** 是否标星 */
  starred?: boolean
  /** 来源消息ID */
  sourceMessageId?: number
  /** 附件列表 */
  attachments?: {
    name: string
    url: string
    size: number
    type: string
  }[]
  /** 其他字段 */
  [key: string]: any
}
