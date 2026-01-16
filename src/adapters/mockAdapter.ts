/**
 * Mock 适配器实现
 * 用于开发环境模拟宿主环境的 API
 */

import type {
  HostAdapter,
  VariableOption,
  GenerateOptions,
  ChatMessage,
  UnsubscribeFn,
} from './types'
import type { PhoneChatData } from '@/types/persistedData'
import type { PhoneGlobalConfig } from '@/types/globalConfig'
import { CHAT_DATA_KEY, createEmptyPhoneChatData } from '@/types/persistedData'
import { GLOBAL_CONFIG_KEY, createDefaultGlobalConfig } from '@/types/globalConfig'

/**
 * 简单事件发射器
 */
class SimpleEventEmitter {
  private listeners: Map<string, Set<(...args: unknown[]) => void>> = new Map()
  
  on(event: string, handler: (...args: unknown[]) => void): UnsubscribeFn {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(handler)
    
    return () => {
      this.listeners.get(event)?.delete(handler)
    }
  }
  
  emit(event: string, ...args: unknown[]): void {
    this.listeners.get(event)?.forEach(handler => {
      try {
        handler(...args)
      } catch (error) {
        console.error(`[MockAdapter] Event handler error for "${event}":`, error)
      }
    })
  }
  
  removeAllListeners(): void {
    this.listeners.clear()
  }
}

/**
 * Mock 适配器配置选项
 */
export interface MockAdapterOptions {
  /** 初始聊天数据 */
  initialChatData?: PhoneChatData
  /** 初始全局配置 */
  initialGlobalConfig?: PhoneGlobalConfig
  /** 角色名称 */
  characterName?: string
  /** 玩家名称 */
  playerName?: string
  /** AI 响应延迟（毫秒） */
  generateDelay?: number
  /** 是否使用 localStorage 持久化 */
  useLocalStorage?: boolean
}

/**
 * localStorage 键名前缀
 */
const STORAGE_PREFIX = 'phone_sim_mock_'

/**
 * Mock 适配器实现
 * 在开发环境中模拟 SillyTavern 的 API
 */
export class MockAdapter implements HostAdapter {
  private eventEmitter = new SimpleEventEmitter()
  private chatVariables: Record<string, unknown> = {}
  private globalVariables: Record<string, unknown> = {}
  private characterName: string
  private playerName: string
  private generateDelay: number
  private useLocalStorage: boolean
  private isGenerating = false
  
  constructor(options: MockAdapterOptions = {}) {
    this.characterName = options.characterName ?? '测试角色'
    this.playerName = options.playerName ?? '玩家'
    this.generateDelay = options.generateDelay ?? 500
    this.useLocalStorage = options.useLocalStorage ?? true
    
    // 初始化数据
    if (this.useLocalStorage) {
      this.loadFromLocalStorage()
    }
    
    // 如果提供了初始数据，使用它们
    if (options.initialChatData) {
      this.chatVariables[CHAT_DATA_KEY] = options.initialChatData
    }
    if (options.initialGlobalConfig) {
      this.globalVariables[GLOBAL_CONFIG_KEY] = options.initialGlobalConfig
    }
    
    console.log('[MockAdapter] Initialized in dev mode')
  }
  
  // ==================== 变量操作 ====================
  
  getVariables(option: VariableOption): Record<string, unknown> {
    switch (option.type) {
      case 'chat':
        return { ...this.chatVariables }
      case 'global':
        return { ...this.globalVariables }
      default:
        console.warn(`[MockAdapter] Unsupported variable type: ${option.type}`)
        return {}
    }
  }
  
  replaceVariables(variables: Record<string, unknown>, option: VariableOption): void {
    switch (option.type) {
      case 'chat':
        this.chatVariables = { ...variables }
        break
      case 'global':
        this.globalVariables = { ...variables }
        break
      default:
        console.warn(`[MockAdapter] Unsupported variable type: ${option.type}`)
        return
    }
    
    if (this.useLocalStorage) {
      this.saveToLocalStorage()
    }
  }
  
  insertOrAssignVariables(variables: Record<string, unknown>, option: VariableOption): Record<string, unknown> {
    const current = this.getVariables(option)
    const merged = { ...current, ...variables }
    this.replaceVariables(merged, option)
    return merged
  }
  
  deleteVariable(path: string, option: VariableOption): { variables: Record<string, unknown>; deleteOccurred: boolean } {
    const current = this.getVariables(option)
    const keys = path.split('.')
    let deleteOccurred = false
    
    if (keys.length === 1) {
      if (path in current) {
        delete current[path]
        deleteOccurred = true
      }
    } else {
      // 深度删除
      let obj: Record<string, unknown> = current
      for (let i = 0; i < keys.length - 1; i++) {
        if (obj[keys[i]] && typeof obj[keys[i]] === 'object') {
          obj = obj[keys[i]] as Record<string, unknown>
        } else {
          break
        }
      }
      const lastKey = keys[keys.length - 1]
      if (lastKey in obj) {
        delete obj[lastKey]
        deleteOccurred = true
      }
    }
    
    if (deleteOccurred) {
      this.replaceVariables(current, option)
    }
    
    return { variables: current, deleteOccurred }
  }
  
  // ==================== 数据持久化快捷方法 ====================
  
  getChatData(): PhoneChatData | null {
    const variables = this.getVariables({ type: 'chat' })
    return (variables[CHAT_DATA_KEY] as PhoneChatData) ?? null
  }
  
  saveChatData(data: PhoneChatData): void {
    data._meta.lastUpdated = new Date().toISOString()
    this.insertOrAssignVariables({ [CHAT_DATA_KEY]: data }, { type: 'chat' })
    console.log('[MockAdapter] Chat data saved')
  }
  
  getGlobalConfig(): PhoneGlobalConfig | null {
    const variables = this.getVariables({ type: 'global' })
    return (variables[GLOBAL_CONFIG_KEY] as PhoneGlobalConfig) ?? null
  }
  
  saveGlobalConfig(config: PhoneGlobalConfig): void {
    config._meta.lastUpdated = new Date().toISOString()
    this.insertOrAssignVariables({ [GLOBAL_CONFIG_KEY]: config }, { type: 'global' })
    console.log('[MockAdapter] Global config saved')
  }
  
  // ==================== AI 生成 ====================
  
  async generate(prompt: string, options?: GenerateOptions): Promise<string> {
    this.isGenerating = true
    this.emit('generation_started', { prompt })
    
    try {
      // 模拟延迟
      await new Promise(resolve => setTimeout(resolve, this.generateDelay))
      
      // 生成模拟响应
      const response = this.createMockResponse(prompt)
      
      this.emit('generation_completed', { prompt, response })
      return response
    } catch (error) {
      this.emit('generation_error', { prompt, error })
      throw error
    } finally {
      this.isGenerating = false
    }
  }
  
  async *generateStream(prompt: string, options?: GenerateOptions): AsyncIterable<string> {
    this.isGenerating = true
    this.emit('generation_started', { prompt, stream: true })
    
    try {
      const response = this.createMockResponse(prompt)
      
      // 模拟流式输出
      for (const char of response) {
        if (!this.isGenerating) break
        await new Promise(resolve => setTimeout(resolve, 20))
        yield char
      }
      
      this.emit('generation_completed', { prompt, response })
    } catch (error) {
      this.emit('generation_error', { prompt, error })
      throw error
    } finally {
      this.isGenerating = false
    }
  }
  
  stopGeneration(): void {
    this.isGenerating = false
    console.log('[MockAdapter] Generation stopped')
  }
  
  // ==================== 消息操作 ====================
  
  getChatHistory(range?: number | string): ChatMessage[] {
    // 返回模拟的聊天历史
    return [
      {
        messageId: 0,
        role: 'system',
        content: '这是一个模拟的系统消息',
        name: 'System',
      },
      {
        messageId: 1,
        role: 'assistant',
        content: '你好！我是测试角色。',
        name: this.characterName,
      },
    ]
  }
  
  async sendUserMessage(content: string): Promise<void> {
    console.log('[MockAdapter] User message sent:', content)
    // 在 Mock 环境中只是记录消息
  }
  
  // ==================== 事件系统 ====================
  
  onMessageReceived(callback: (msgId: number, content: string) => void): UnsubscribeFn {
    return this.on('message_received', (msgId, content) => {
      callback(msgId as number, content as string)
    })
  }
  
  onMessageEdited(callback: (msgId: number, content: string) => void): UnsubscribeFn {
    return this.on('message_edited', (msgId, content) => {
      callback(msgId as number, content as string)
    })
  }
  
  onMessageDeleted(callback: (msgId: number) => void): UnsubscribeFn {
    return this.on('message_deleted', (msgId) => {
      callback(msgId as number)
    })
  }
  
  onChatChanged(callback: (chatFileName: string) => void): UnsubscribeFn {
    return this.on('chat_changed', (chatFileName) => {
      callback(chatFileName as string)
    })
  }
  
  on(event: string, handler: (...args: unknown[]) => void): UnsubscribeFn {
    return this.eventEmitter.on(event, handler)
  }
  
  emit(event: string, ...args: unknown[]): void {
    this.eventEmitter.emit(event, ...args)
  }
  
  // ==================== 环境信息 ====================
  
  getCharacterName(): string {
    return this.characterName
  }
  
  getPlayerName(): string {
    return this.playerName
  }
  
  isDevMode(): boolean {
    return true
  }
  
  getAdapterType(): 'sillytavern' | 'mock' {
    return 'mock'
  }
  
  // ==================== 测试辅助方法 ====================
  
  /**
   * 模拟接收 AI 消息
   * 用于开发测试
   */
  simulateAIMessage(content: string): void {
    const msgId = Date.now()
    this.emit('message_received', msgId, content)
    console.log('[MockAdapter] Simulated AI message:', msgId)
  }
  
  /**
   * 模拟聊天切换
   * 用于开发测试
   */
  simulateChatChange(chatFileName: string): void {
    // 保存当前数据
    if (this.useLocalStorage) {
      this.saveToLocalStorage()
    }
    
    // 重置聊天变量（模拟切换到新聊天）
    this.chatVariables = {}
    
    // 触发事件
    this.emit('chat_changed', chatFileName)
    console.log('[MockAdapter] Simulated chat change:', chatFileName)
  }
  
  /**
   * 设置角色名称
   */
  setCharacterName(name: string): void {
    this.characterName = name
  }
  
  /**
   * 设置玩家名称
   */
  setPlayerName(name: string): void {
    this.playerName = name
  }
  
  /**
   * 重置所有数据
   */
  reset(): void {
    this.chatVariables = {}
    this.globalVariables = {}
    if (this.useLocalStorage) {
      localStorage.removeItem(`${STORAGE_PREFIX}chat`)
      localStorage.removeItem(`${STORAGE_PREFIX}global`)
    }
    console.log('[MockAdapter] Reset all data')
  }
  
  // ==================== 私有方法 ====================
  
  private createMockResponse(prompt: string): string {
    const timestamp = new Date().toLocaleTimeString()
    return `[Mock Response at ${timestamp}]\n这是一个模拟的 AI 响应。\n\n您的提示词包含 ${prompt.length} 个字符。`
  }
  
  private loadFromLocalStorage(): void {
    try {
      const chatData = localStorage.getItem(`${STORAGE_PREFIX}chat`)
      if (chatData) {
        this.chatVariables = JSON.parse(chatData)
        console.log('[MockAdapter] Loaded chat data from localStorage')
      }
      
      const globalData = localStorage.getItem(`${STORAGE_PREFIX}global`)
      if (globalData) {
        this.globalVariables = JSON.parse(globalData)
        console.log('[MockAdapter] Loaded global data from localStorage')
      }
    } catch (error) {
      console.error('[MockAdapter] Failed to load from localStorage:', error)
    }
  }
  
  private saveToLocalStorage(): void {
    try {
      localStorage.setItem(`${STORAGE_PREFIX}chat`, JSON.stringify(this.chatVariables))
      localStorage.setItem(`${STORAGE_PREFIX}global`, JSON.stringify(this.globalVariables))
    } catch (error) {
      console.error('[MockAdapter] Failed to save to localStorage:', error)
    }
  }
}

/**
 * 创建 Mock 适配器实例
 */
export function createMockAdapter(options?: MockAdapterOptions): MockAdapter {
  return new MockAdapter(options)
}