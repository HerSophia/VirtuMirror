/**
 * 聊天数据服务
 * 管理存储在聊天变量中的小手机数据
 */

import { getAdapter } from '@/adapters'
import type { HostAdapter } from '@/adapters/types'
import type {
  PhoneChatData,
  PartialPhoneChatData,
  ChatAppData,
  ContactsData,
  MomentsData,
  CallsData,
  EmailData,
  ForumUserData,
  BrowserUserData,
  LiveUserData,
} from '@/types/persistedData'
import { createEmptyPhoneChatData, CHAT_DATA_KEY } from '@/types/persistedData'
import { loggerService } from '@/services/logger/loggerService'

/**
 * 深度合并对象
 * 用于部分更新数据
 */
function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
  const result = { ...target }
  
  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const sourceValue = source[key]
      const targetValue = result[key]
      
      if (
        sourceValue !== null &&
        typeof sourceValue === 'object' &&
        !Array.isArray(sourceValue) &&
        targetValue !== null &&
        typeof targetValue === 'object' &&
        !Array.isArray(targetValue)
      ) {
        result[key] = deepMerge(
          targetValue as Record<string, unknown>,
          sourceValue as Record<string, unknown>
        ) as T[typeof key]
      } else if (sourceValue !== undefined) {
        result[key] = sourceValue as T[typeof key]
      }
    }
  }
  
  return result
}

/**
 * 聊天数据服务类
 * 提供对聊天变量中存储的小手机数据的操作
 */
export class ChatDataService {
  private adapter: HostAdapter
  private cache: PhoneChatData | null = null
  private isDirty = false
  private saveDebounceTimer: ReturnType<typeof setTimeout> | null = null
  private readonly DEBOUNCE_DELAY = 500 // 毫秒
  
  constructor(adapter?: HostAdapter) {
    this.adapter = adapter ?? getAdapter()
  }
  
  /**
   * 获取当前聊天的小手机数据
   * 如果不存在则返回 null
   */
  getData(): PhoneChatData | null {
    // 如果有缓存且未被修改，直接返回缓存
    if (this.cache && !this.isDirty) {
      return this.cache
    }
    
    try {
      const data = this.adapter.getChatData()
      this.cache = data
      this.isDirty = false
      return data
    } catch (error) {
      loggerService.error('ChatDataService', '获取聊天数据失败:', error)
      return null
    }
  }
  
  /**
   * 获取数据，如果不存在则创建新的
   */
  getOrCreateData(): PhoneChatData {
    const data = this.getData()
    if (data) {
      return data
    }
    
    // 创建新的空数据
    const newData = createEmptyPhoneChatData()
    this.saveData(newData)
    return newData
  }
  
  /**
   * 保存数据到当前聊天变量
   */
  saveData(data: PhoneChatData): void {
    try {
      this.adapter.saveChatData(data)
      this.cache = data
      this.isDirty = false
      console.info('[ChatDataService] 数据已保存到聊天变量')
    } catch (error) {
      loggerService.error('ChatDataService', '保存聊天数据失败:', error)
    }
  }
  
  /**
   * 更新部分数据（深度合并）
   * 使用防抖避免频繁保存
   */
  updateData(partialData: PartialPhoneChatData): void {
    const currentData = this.getOrCreateData()
    
    // 深度合并数据
    const mergedData = deepMerge(currentData, partialData as Partial<PhoneChatData>)
    
    // 更新元数据
    mergedData._meta = {
      ...mergedData._meta,
      lastUpdated: new Date().toISOString(),
    }
    
    // 更新缓存
    this.cache = mergedData
    this.isDirty = true
    
    // 使用防抖保存
    this.debounceSave()
  }
  
  /**
   * 立即保存（跳过防抖）
   */
  saveImmediately(): void {
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer)
      this.saveDebounceTimer = null
    }
    
    if (this.cache && this.isDirty) {
      this.saveData(this.cache)
    }
  }
  
  /**
   * 清除当前聊天的小手机数据
   */
  clearData(): void {
    try {
      this.adapter.deleteVariable(CHAT_DATA_KEY, { type: 'chat' })
      this.cache = null
      this.isDirty = false
      console.info('[ChatDataService] 聊天数据已清除')
    } catch (error) {
      loggerService.error('ChatDataService', '清除聊天数据失败:', error)
    }
  }
  
  /**
   * 重置为空数据
   */
  resetData(): PhoneChatData {
    const newData = createEmptyPhoneChatData()
    this.saveData(newData)
    return newData
  }
  
  // ==================== 便捷方法：获取特定模块数据 ====================
  
  /**
   * 获取聊天App数据
   */
  getChatAppData(): ChatAppData {
    return this.getOrCreateData().chat
  }
  
  /**
   * 更新聊天App数据
   */
  updateChatAppData(data: Partial<ChatAppData>): void {
    this.updateData({ chat: data })
  }
  
  /**
   * 获取联系人数据
   */
  getContactsData(): ContactsData {
    return this.getOrCreateData().contacts
  }
  
  /**
   * 更新联系人数据
   */
  updateContactsData(data: Partial<ContactsData>): void {
    this.updateData({ contacts: data })
  }
  
  /**
   * 获取朋友圈数据
   */
  getMomentsData(): MomentsData {
    return this.getOrCreateData().moments
  }
  
  /**
   * 更新朋友圈数据
   */
  updateMomentsData(data: Partial<MomentsData>): void {
    this.updateData({ moments: data })
  }
  
  /**
   * 获取通话数据
   */
  getCallsData(): CallsData {
    return this.getOrCreateData().calls
  }
  
  /**
   * 更新通话数据
   */
  updateCallsData(data: Partial<CallsData>): void {
    this.updateData({ calls: data })
  }
  
  /**
   * 获取邮件数据
   */
  getEmailData(): EmailData {
    return this.getOrCreateData().email
  }
  
  /**
   * 更新邮件数据
   */
  updateEmailData(data: Partial<EmailData>): void {
    this.updateData({ email: data })
  }
  
  /**
   * 获取论坛用户数据
   */
  getForumUserData(): ForumUserData {
    return this.getOrCreateData().forum
  }
  
  /**
   * 更新论坛用户数据
   */
  updateForumUserData(data: Partial<ForumUserData>): void {
    this.updateData({ forum: data })
  }
  
  /**
   * 获取浏览器用户数据
   */
  getBrowserUserData(): BrowserUserData {
    return this.getOrCreateData().browser
  }
  
  /**
   * 更新浏览器用户数据
   */
  updateBrowserUserData(data: Partial<BrowserUserData>): void {
    this.updateData({ browser: data })
  }
  
  /**
   * 获取直播用户数据
   */
  getLiveUserData(): LiveUserData {
    return this.getOrCreateData().live
  }
  
  /**
   * 更新直播用户数据
   */
  updateLiveUserData(data: Partial<LiveUserData>): void {
    this.updateData({ live: data })
  }
  
  // ==================== 数据导入导出 ====================
  
  /**
   * 导出数据为 JSON 字符串
   */
  exportToJson(): string {
    const data = this.getData()
    return JSON.stringify(data, null, 2)
  }
  
  /**
   * 从 JSON 字符串导入数据
   */
  importFromJson(jsonString: string): boolean {
    try {
      const data = JSON.parse(jsonString) as PhoneChatData
      
      // 基本验证
      if (!data._meta || !data.chat || !data.contacts) {
        throw new Error('Invalid data format')
      }
      
      // 更新版本和时间
      data._meta.lastUpdated = new Date().toISOString()
      
      this.saveData(data)
      return true
    } catch (error) {
      loggerService.error('ChatDataService', '导入数据失败:', error)
      return false
    }
  }
  
  // ==================== 私有方法 ====================
  
  /**
   * 防抖保存
   */
  private debounceSave(): void {
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer)
    }
    
    this.saveDebounceTimer = setTimeout(() => {
      if (this.cache && this.isDirty) {
        this.saveData(this.cache)
      }
      this.saveDebounceTimer = null
    }, this.DEBOUNCE_DELAY)
  }
  
  /**
   * 清理资源
   */
  dispose(): void {
    // 保存未保存的数据
    this.saveImmediately()
    
    // 清理定时器
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer)
      this.saveDebounceTimer = null
    }
    
    this.cache = null
  }
}

// ==================== 单例实例 ====================

let chatDataServiceInstance: ChatDataService | null = null

/**
 * 获取 ChatDataService 单例实例
 */
export function getChatDataService(): ChatDataService {
  if (!chatDataServiceInstance) {
    chatDataServiceInstance = new ChatDataService()
  }
  return chatDataServiceInstance
}

/**
 * 重置 ChatDataService 实例
 * 主要用于测试或聊天切换时
 */
export function resetChatDataService(): void {
  if (chatDataServiceInstance) {
    chatDataServiceInstance.dispose()
    chatDataServiceInstance = null
  }
}