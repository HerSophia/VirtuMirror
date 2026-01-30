/**
 * 手机模拟器主Store
 * 聚合所有子Store并提供全局操作
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useContactStore } from './contactStore'
import { useChatStore } from './chatStore'
import { useUIStore } from './uiStore'
import { useStagedActionsStore } from './stagedActionsStore'
import type {
  Email,
  BrowserData,
  LiveCenterData
} from '@/types'
import { loggerService } from '@/services/logger'

const logger = loggerService.child('store:phone')

export const usePhoneStore = defineStore('phone', () => {
  // ==================== 子Store引用 ====================
  const contactStore = useContactStore()
  const chatStore = useChatStore()
  const uiStore = useUIStore()
  const stagedActionsStore = useStagedActionsStore()
  
  // ==================== 附加数据状态 ====================
  
  /** 邮件列表 */
  const emails = ref<Email[]>([])
  
  /** 浏览器数据 */
  const browserData = ref<BrowserData>({
    history: [],
    bookmarks: [],
    searchResults: {},
    pages: {},
  })
  
  /** 直播数据 */
  const liveData = ref<LiveCenterData>({
    boards: [],
    streams: {},
    danmakus: {},
  })
  
  /** 是否已初始化 */
  const isInitialized = ref(false)
  
  /** 是否正在加载 */
  const isLoading = ref(false)
  
  // ==================== 计算属性 ====================
  
  /** 未读邮件数 */
  const unreadEmailCount = computed(() =>
    emails.value.filter((e: Email) => !e.read).length
  )
  
  /** 总未读数（消息+邮件） */
  const totalUnreadCount = computed(() =>
    contactStore.totalUnreadCount +
    unreadEmailCount.value
  )
  
  // ==================== 邮件操作 ====================
  
  function addEmail(email: Omit<Email, 'id'>) {
    const newEmail = {
      ...email,
      id: `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    } as Email
    emails.value.unshift(newEmail)
    return newEmail
  }
  
  function markEmailRead(emailId: string) {
    const email = emails.value.find((e: Email) => e.id === emailId)
    if (email) {
      email.read = true
    }
  }
  
  function deleteEmail(emailId: string) {
    const index = emails.value.findIndex((e: Email) => e.id === emailId)
    if (index !== -1) {
      emails.value.splice(index, 1)
    }
  }
  
  function toggleEmailStar(emailId: string) {
    const email = emails.value.find((e: Email) => e.id === emailId)
    if (email) {
      email.starred = !email.starred
    }
  }
  
  // ==================== 全局操作 ====================
  
  /** 初始化 */
  async function initialize() {
    if (isInitialized.value) return
    
    isLoading.value = true
    logger.info('正在初始化...')
    
    try {
      // 在这里可以从世界书加载数据
      // 开发模式下会使用Mock数据
      
      isInitialized.value = true
      logger.info('初始化成功')
    } catch (error) {
      logger.error('初始化失败', error)
    } finally {
      isLoading.value = false
    }
  }
  
  /** 重置所有数据 */
  function resetAll() {
    // 重置所有子Store
    contactStore.clearAll()
    chatStore.clearAllHistory()
    stagedActionsStore.clearActions()
    
    // 重置本地数据
    emails.value = []
    browserData.value = {
      history: [],
      bookmarks: [],
      searchResults: {},
      pages: {},
    }
    liveData.value = {
      boards: [],
      streams: {},
      danmakus: {},
    }
    
    logger.info('所有数据已重置')
  }
  
  /** 按来源消息ID删除相关数据 */
  function deleteBySourceMessageId(sourceMessageId: number) {
    chatStore.deleteMessagesBySourceId(sourceMessageId)
    
    // 删除邮件
    emails.value = emails.value.filter((e: Email) => e.sourceMessageId !== sourceMessageId)
    
    // 删除直播
    Object.keys(liveData.value.streams).forEach(streamId => {
      if (liveData.value.streams[streamId].sourceMessageId === sourceMessageId) {
        delete liveData.value.streams[streamId]
      }
    })
  }
  
  return {
    // 子Store
    contactStore,
    chatStore,
    uiStore,
    stagedActionsStore,
    
    // 状态
    emails,
    browserData,
    liveData,
    isInitialized,
    isLoading,
    
    // 计算属性
    unreadEmailCount,
    totalUnreadCount,
    
    // 邮件操作
    addEmail,
    markEmailRead,
    deleteEmail,
    toggleEmailStar,
    
    // 全局操作
    initialize,
    resetAll,
    deleteBySourceMessageId,
  }
}, {
  persist: {
    key: 'phone-sim-main',
    paths: [
      'emails',
      'browserData',
      'liveData',
    ],
  },
})