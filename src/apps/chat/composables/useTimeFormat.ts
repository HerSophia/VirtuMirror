/**
 * 时间格式化组合式函数
 * 用于聊天消息和列表的时间显示
 */

/**
 * 格式化消息列表时间
 * @param timestamp 时间戳
 * @returns 格式化后的时间字符串（刚刚、X分钟前、时:分、昨天、月/日）
 */
export function formatListTime(timestamp?: number): string {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  
  // 1分钟内
  if (diff < 60000) return '刚刚'
  // 1小时内
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  // 今天内
  if (diff < 86400000) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }
  // 昨天
  if (diff < 172800000) return '昨天'
  // 更早
  return date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
}

/**
 * 格式化消息时间（简短格式）
 * @param timestamp 时间戳
 * @returns 格式化后的时间字符串（时:分）
 */
export function formatMessageTime(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

/**
 * 格式化完整日期时间
 * @param timestamp 时间戳
 * @returns 格式化后的日期时间字符串
 */
export function formatFullDateTime(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * 判断是否为今天
 * @param timestamp 时间戳
 */
export function isToday(timestamp: number): boolean {
  const date = new Date(timestamp)
  const today = new Date()
  return date.toDateString() === today.toDateString()
}

/**
 * 判断是否为昨天
 * @param timestamp 时间戳
 */
export function isYesterday(timestamp: number): boolean {
  const date = new Date(timestamp)
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  return date.toDateString() === yesterday.toDateString()
}

export function useTimeFormat() {
  return {
    formatListTime,
    formatMessageTime,
    formatFullDateTime,
    isToday,
    isYesterday
  }
}

export default useTimeFormat