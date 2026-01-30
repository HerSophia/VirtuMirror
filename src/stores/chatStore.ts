/**
 * 聊天消息管理Store
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { 
  Message, 
  ChatHistory, 
  ContactId, 
  MessageId,
  TextMessage,
  MessageType 
} from '@/types'
import { PLAYER_ID } from '@/types'
import { useContactStore } from './contactStore'
import { loggerService } from '@/services/logger'

const logger = loggerService.child('store:chat')

export const useChatStore = defineStore('chat', () => {
  // ==================== 状态 ====================
  
  /** 聊天记录 */
  const history = ref<ChatHistory>({})
  
  /** 消息ID计数器 */
  let messageIdCounter = 0
  
  // ==================== 计算属性 ====================
  
  /** 获取所有有消息的联系人ID列表 */
  const activeConversations = computed(() => Object.keys(history.value))
  
  // ==================== 操作 ====================
  
  /** 生成唯一消息ID */
  function generateMessageId(): MessageId {
    return `msg_${Date.now()}_${++messageIdCounter}`
  }
  
  /** 获取联系人的聊天记录 */
  function getMessages(contactId: ContactId): Message[] {
    return history.value[contactId] || []
  }
  
  /** 获取最后一条消息 */
  function getLastMessage(contactId: ContactId): Message | undefined {
    const messages = history.value[contactId]
    if (!messages || messages.length === 0) return undefined
    return messages[messages.length - 1]
  }
  
  /** 获取最后一条消息的预览文本 */
  function getLastMessagePreview(contactId: ContactId): string {
    const message = getLastMessage(contactId)
    if (!message) return ''
    
    switch (message.type) {
      case 'text':
        return (message as TextMessage).content
      case 'image':
        return '[图片]'
      case 'voice':
        return '[语音]'
      case 'sticker':
        return '[表情]'
      case 'transfer':
        return '[转账]'
      case 'red_packet':
        return '[红包]'
      case 'location':
        return '[位置]'
      case 'system':
        return '[系统消息]'
      case 'recall':
        return '撤回了一条消息'
      case 'friend_request':
        return '[好友请求]'
      default:
        return ''
    }
  }
  
  /** 添加消息 */
  function addMessage(contactId: ContactId, message: Omit<Message, 'uid'>) {
    if (!history.value[contactId]) {
      history.value[contactId] = []
    }
    
    const fullMessage = {
      ...message,
      uid: generateMessageId(),
    } as Message
    
    history.value[contactId].push(fullMessage)
    
    // 更新联系人的最后消息时间
    const contactStore = useContactStore()
    contactStore.updateLastMessageTime(contactId, message.timestamp)
    
    // 如果不是玩家发的消息，增加未读数
    if (message.senderId !== PLAYER_ID) {
      contactStore.incrementUnreadCount(contactId)
    }
    
    return fullMessage
  }
  
  /** 批量添加消息 */
  function addMessages(contactId: ContactId, messages: Array<Omit<Message, 'uid'>>) {
    messages.forEach(msg => addMessage(contactId, msg))
  }
  
  /** 更新消息 */
  function updateMessage(contactId: ContactId, messageId: MessageId, updates: Partial<Message>) {
    const messages = history.value[contactId]
    if (!messages) return
    
    const index = messages.findIndex(m => m.uid === messageId)
    if (index !== -1) {
      messages[index] = { ...messages[index], ...updates } as Message
    }
  }
  
  /** 删除消息 */
  function deleteMessage(contactId: ContactId, messageId: MessageId) {
    const messages = history.value[contactId]
    if (!messages) return
    
    const index = messages.findIndex(m => m.uid === messageId)
    if (index !== -1) {
      messages.splice(index, 1)
    }
  }
  
  /** 撤回消息 */
  function recallMessage(contactId: ContactId, messageId: MessageId, recallerId: ContactId) {
    const messages = history.value[contactId]
    if (!messages) return
    
    const index = messages.findIndex(m => m.uid === messageId)
    if (index !== -1) {
      const originalMessage = messages[index]
      // 替换为撤回提示消息
      messages[index] = {
        uid: originalMessage.uid,
        contactId,
        senderId: recallerId,
        type: 'recall' as MessageType,
        timestamp: Date.now(),
        recalledMessageId: messageId,
        recallerId,
      } as Message
      logger.info('消息已撤回', { contactId, messageId, recallerId })
    }
  }
  
  /** 按来源消息ID删除消息 */
  function deleteMessagesBySourceId(sourceMessageId: number) {
    Object.keys(history.value).forEach(contactId => {
      history.value[contactId] = history.value[contactId].filter(
        msg => msg.sourceMessageId !== sourceMessageId
      )
    })
  }
  
  /** 清空与联系人的聊天记录 */
  function clearHistory(contactId: ContactId) {
    delete history.value[contactId]
  }
  
  /** 清空所有聊天记录 */
  function clearAllHistory() {
    const count = Object.keys(history.value).length
    history.value = {}
    logger.info('所有聊天记录已清空', { clearedConversations: count })
  }
  
  /** 设置完整的聊天历史（用于数据加载） */
  function setChatHistory(newHistory: ChatHistory) {
    history.value = newHistory
    logger.info('聊天历史已加载', { conversationCount: Object.keys(newHistory).length })
  }
  
  /** 合并聊天历史（用于增量更新） */
  function mergeChatHistory(newHistory: ChatHistory) {
    Object.keys(newHistory).forEach(contactId => {
      if (!history.value[contactId]) {
        history.value[contactId] = []
      }
      
      // 按UID去重合并
      const existingIds = new Set(history.value[contactId].map(m => m.uid))
      const newMessages = newHistory[contactId].filter(m => !existingIds.has(m.uid))
      history.value[contactId].push(...newMessages)
      
      // 按时间戳排序
      history.value[contactId].sort((a, b) => a.timestamp - b.timestamp)
    })
  }
  
  /** 获取按最后消息时间排序的联系人列表 */
  function getConversationsSortedByTime(): ContactId[] {
    return Object.keys(history.value)
      .filter(id => history.value[id].length > 0)
      .sort((a, b) => {
        const lastA = getLastMessage(a)
        const lastB = getLastMessage(b)
        return (lastB?.timestamp || 0) - (lastA?.timestamp || 0)
      })
  }
  
  /** 搜索消息 */
  function searchMessages(query: string): Array<{ contactId: ContactId; message: Message }> {
    const results: Array<{ contactId: ContactId; message: Message }> = []
    const lowerQuery = query.toLowerCase()
    
    Object.keys(history.value).forEach(contactId => {
      history.value[contactId].forEach(message => {
        if (message.type === 'text') {
          const textMessage = message as TextMessage
          if (textMessage.content.toLowerCase().includes(lowerQuery)) {
            results.push({ contactId, message })
          }
        }
      })
    })
    
    return results.sort((a, b) => b.message.timestamp - a.message.timestamp)
  }
  
  return {
    // 状态
    history,
    
    // 计算属性
    activeConversations,
    
    // 操作
    generateMessageId,
    getMessages,
    getLastMessage,
    getLastMessagePreview,
    addMessage,
    addMessages,
    updateMessage,
    deleteMessage,
    recallMessage,
    deleteMessagesBySourceId,
    clearHistory,
    clearAllHistory,
    setChatHistory,
    mergeChatHistory,
    getConversationsSortedByTime,
    searchMessages,
  }
}, {
  persist: {
    key: 'phone-sim-chat-history',
  },
})