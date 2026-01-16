/**
 * 消息格式化组合式函数
 * 用于处理各种消息类型的显示
 */

import type { Message } from '@/types'

/**
 * 获取消息内容的文本表示
 * @param message 消息对象
 * @returns 格式化后的消息内容字符串
 */
export function getMessageContent(message: Message): string {
  switch (message.type) {
    case 'text':
      return message.content
    case 'image':
      return '[图片]'
    case 'voice':
      return `[语音 ${message.duration || 0}秒]`
    case 'sticker':
      return '[表情]'
    case 'transfer':
      return `[转账 ¥${message.amount || 0}]`
    case 'red_packet':
      return `[红包] ${message.greeting || ''}`
    case 'location':
      return `[位置] ${message.name || ''}`
    case 'system':
      return message.content
    case 'recall':
      return '消息已撤回'
    default:
      return '[未知消息类型]'
  }
}

/**
 * 获取消息预览（用于列表显示，可能需要截断）
 * @param message 消息对象
 * @param maxLength 最大长度
 * @returns 截断后的消息预览
 */
export function getMessagePreview(message: Message, maxLength: number = 30): string {
  const content = getMessageContent(message)
  if (content.length <= maxLength) return content
  return content.slice(0, maxLength) + '...'
}

/**
 * 判断消息是否为特殊类型（非文本）
 * @param message 消息对象
 */
export function isSpecialMessage(message: Message): boolean {
  return message.type !== 'text'
}

/**
 * 判断消息是否为系统消息
 * @param message 消息对象
 */
export function isSystemMessage(message: Message): boolean {
  return message.type === 'system'
}

/**
 * 判断消息是否为媒体消息
 * @param message 消息对象
 */
export function isMediaMessage(message: Message): boolean {
  return ['image', 'voice', 'sticker'].includes(message.type)
}

/**
 * 判断消息是否为交易消息
 * @param message 消息对象
 */
export function isTransactionMessage(message: Message): boolean {
  return ['transfer', 'red_packet'].includes(message.type)
}

export function useMessageFormat() {
  return {
    getMessageContent,
    getMessagePreview,
    isSpecialMessage,
    isSystemMessage,
    isMediaMessage,
    isTransactionMessage
  }
}

export default useMessageFormat