/**
 * SillyTavern 适配器实现
 * 用于生产环境与 SillyTavern 的实际交互
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
import { CHAT_DATA_KEY } from '@/types/persistedData'
import { GLOBAL_CONFIG_KEY } from '@/types/globalConfig'

/**
 * 获取父窗口引用
 */
function getParentWindow(): Window & {
  SillyTavern?: {
    getContext: () => SillyTavernContext
  }
  TavernHelper?: TavernHelperAPI
} {
  return (typeof window.parent !== 'undefined' ? window.parent : window) as Window & {
    SillyTavern?: { getContext: () => SillyTavernContext }
    TavernHelper?: TavernHelperAPI
  }
}

/**
 * SillyTavern 上下文接口
 */
interface SillyTavernContext {
  name1: string  // 玩家名称
  name2: string  // 角色名称
  chat: Array<{
    mes: string
    is_user: boolean
    is_hidden?: boolean
    name?: string
  }>
  eventSource: {
    on: (event: string, handler: (...args: unknown[]) => void) => void
    off: (event: string, handler: (...args: unknown[]) => void) => void
    emit: (event: string, ...args: unknown[]) => void
  }
  eventTypes: Record<string, string>
}

/**
 * TavernHelper API 接口（简化版）
 */
interface TavernHelperAPI {
  getVariables: (option: { type: string; message_id?: number | 'latest' }) => Record<string, unknown>
  replaceVariables: (variables: Record<string, unknown>, option: { type: string }) => void
  insertOrAssignVariables: (variables: Record<string, unknown>, option: { type: string }) => Record<string, unknown>
  deleteVariable: (path: string, option: { type: string }) => { variables: Record<string, unknown>; delete_occurred: boolean }
  generate: (opts: {
    user_input?: string
    should_stream?: boolean
    custom_api?: {
      apiurl: string
      key?: string
      model: string
      source?: string
      max_tokens?: number
      temperature?: number
    }
  }) => Promise<string>
  getChatMessages: (range?: number | string) => Array<{
    message_id: number
    role: 'user' | 'assistant' | 'system'
    message: string
    name?: string
    is_hidden?: boolean
  }>
}

/**
 * SillyTavern 适配器实现
 */
export class SillyTavernAdapter implements HostAdapter {
  private parentWin = getParentWindow()
  private eventHandlers = new Map<string, Set<(...args: unknown[]) => void>>()
  
  constructor() {
    if (!this.isAvailable()) {
      throw new Error('[SillyTavernAdapter] SillyTavern context not available')
    }
    console.log('[SillyTavernAdapter] Initialized')
  }
  
  /**
   * 检查 SillyTavern 是否可用
   */
  private isAvailable(): boolean {
    return !!(this.parentWin.SillyTavern?.getContext() && this.parentWin.TavernHelper)
  }
  
  /**
   * 获取 SillyTavern 上下文
   */
  private getContext(): SillyTavernContext {
    const context = this.parentWin.SillyTavern?.getContext()
    if (!context) {
      throw new Error('[SillyTavernAdapter] Context not available')
    }
    return context
  }
  
  /**
   * 获取 TavernHelper API
   */
  private getTavernHelper(): TavernHelperAPI {
    const th = this.parentWin.TavernHelper
    if (!th) {
      throw new Error('[SillyTavernAdapter] TavernHelper not available')
    }
    return th
  }
  
  // ==================== 变量操作 ====================
  
  getVariables(option: VariableOption): Record<string, unknown> {
    const th = this.getTavernHelper()
    return th.getVariables({
      type: option.type,
      message_id: option.messageId,
    })
  }
  
  replaceVariables(variables: Record<string, unknown>, option: VariableOption): void {
    const th = this.getTavernHelper()
    th.replaceVariables(variables, { type: option.type })
  }
  
  insertOrAssignVariables(variables: Record<string, unknown>, option: VariableOption): Record<string, unknown> {
    const th = this.getTavernHelper()
    return th.insertOrAssignVariables(variables, { type: option.type })
  }
  
  deleteVariable(path: string, option: VariableOption): { variables: Record<string, unknown>; deleteOccurred: boolean } {
    const th = this.getTavernHelper()
    const result = th.deleteVariable(path, { type: option.type })
    return {
      variables: result.variables,
      deleteOccurred: result.delete_occurred,
    }
  }
  
  // ==================== 数据持久化快捷方法 ====================
  
  getChatData(): PhoneChatData | null {
    try {
      const variables = this.getVariables({ type: 'chat' })
      return (variables[CHAT_DATA_KEY] as PhoneChatData) ?? null
    } catch (error) {
      console.error('[SillyTavernAdapter] Failed to get chat data:', error)
      return null
    }
  }
  
  saveChatData(data: PhoneChatData): void {
    try {
      data._meta.lastUpdated = new Date().toISOString()
      this.insertOrAssignVariables({ [CHAT_DATA_KEY]: data }, { type: 'chat' })
      console.log('[SillyTavernAdapter] Chat data saved')
    } catch (error) {
      console.error('[SillyTavernAdapter] Failed to save chat data:', error)
    }
  }
  
  getGlobalConfig(): PhoneGlobalConfig | null {
    try {
      const variables = this.getVariables({ type: 'global' })
      return (variables[GLOBAL_CONFIG_KEY] as PhoneGlobalConfig) ?? null
    } catch (error) {
      console.error('[SillyTavernAdapter] Failed to get global config:', error)
      return null
    }
  }
  
  saveGlobalConfig(config: PhoneGlobalConfig): void {
    try {
      config._meta.lastUpdated = new Date().toISOString()
      this.insertOrAssignVariables({ [GLOBAL_CONFIG_KEY]: config }, { type: 'global' })
      console.log('[SillyTavernAdapter] Global config saved')
    } catch (error) {
      console.error('[SillyTavernAdapter] Failed to save global config:', error)
    }
  }
  
  // ==================== AI 生成 ====================
  
  async generate(prompt: string, options?: GenerateOptions): Promise<string> {
    const th = this.getTavernHelper()
    
    const generateOpts: Parameters<TavernHelperAPI['generate']>[0] = {
      user_input: prompt,
      should_stream: options?.stream ?? false,
    }
    
    if (options?.customApi) {
      generateOpts.custom_api = {
        apiurl: options.customApi.apiUrl,
        key: options.customApi.apiKey,
        model: options.customApi.model,
        source: options.customApi.source,
        max_tokens: options?.maxTokens,
        temperature: options?.temperature,
      }
    }
    
    return th.generate(generateOpts)
  }
  
  async *generateStream(prompt: string, options?: GenerateOptions): AsyncIterable<string> {
    // SillyTavern 的流式生成需要特殊处理
    // 暂时使用非流式生成
    const result = await this.generate(prompt, { ...options, stream: true })
    yield result
  }
  
  stopGeneration(): void {
    // TODO: 实现停止生成的逻辑
    console.log('[SillyTavernAdapter] Stop generation requested')
  }
  
  // ==================== 消息操作 ====================
  
  getChatHistory(range?: number | string): ChatMessage[] {
    const th = this.getTavernHelper()
    const messages = th.getChatMessages(range)
    
    return messages.map(msg => ({
      messageId: msg.message_id,
      role: msg.role,
      content: msg.message,
      name: msg.name,
      isHidden: msg.is_hidden,
    }))
  }
  
  async sendUserMessage(content: string): Promise<void> {
    // TODO: 实现发送用户消息的逻辑
    console.log('[SillyTavernAdapter] Send user message:', content)
  }
  
  // ==================== 事件系统 ====================
  
  onMessageReceived(callback: (msgId: number, content: string) => void): UnsubscribeFn {
    const context = this.getContext()
    const handler = (msgId: number) => {
      const msg = context.chat[msgId]
      if (msg && !msg.is_user) {
        callback(msgId, msg.mes)
      }
    }
    
    context.eventSource.on(context.eventTypes.MESSAGE_RECEIVED, handler as (...args: unknown[]) => void)
    
    return () => {
      context.eventSource.off(context.eventTypes.MESSAGE_RECEIVED, handler as (...args: unknown[]) => void)
    }
  }
  
  onMessageEdited(callback: (msgId: number, content: string) => void): UnsubscribeFn {
    const context = this.getContext()
    const handler = (msgId: number) => {
      const msg = context.chat[msgId]
      if (msg && !msg.is_user) {
        callback(msgId, msg.mes)
      }
    }
    
    context.eventSource.on(context.eventTypes.MESSAGE_EDITED, handler as (...args: unknown[]) => void)
    
    return () => {
      context.eventSource.off(context.eventTypes.MESSAGE_EDITED, handler as (...args: unknown[]) => void)
    }
  }
  
  onMessageDeleted(callback: (msgId: number) => void): UnsubscribeFn {
    const context = this.getContext()
    const handler = (msgId: number) => {
      callback(msgId)
    }
    
    context.eventSource.on(context.eventTypes.MESSAGE_DELETED, handler as (...args: unknown[]) => void)
    
    return () => {
      context.eventSource.off(context.eventTypes.MESSAGE_DELETED, handler as (...args: unknown[]) => void)
    }
  }
  
  onChatChanged(callback: (chatFileName: string) => void): UnsubscribeFn {
    const context = this.getContext()
    const handler = (chatFileName: string) => {
      callback(chatFileName)
    }
    
    context.eventSource.on(context.eventTypes.CHAT_CHANGED, handler as (...args: unknown[]) => void)
    
    return () => {
      context.eventSource.off(context.eventTypes.CHAT_CHANGED, handler as (...args: unknown[]) => void)
    }
  }
  
  on(event: string, handler: (...args: unknown[]) => void): UnsubscribeFn {
    const context = this.getContext()
    
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set())
    }
    this.eventHandlers.get(event)!.add(handler)
    
    context.eventSource.on(event, handler)
    
    return () => {
      this.eventHandlers.get(event)?.delete(handler)
      context.eventSource.off(event, handler)
    }
  }
  
  emit(event: string, ...args: unknown[]): void {
    const context = this.getContext()
    context.eventSource.emit(event, ...args)
  }
  
  // ==================== 环境信息 ====================
  
  getCharacterName(): string {
    return this.getContext().name2
  }
  
  getPlayerName(): string {
    return this.getContext().name1
  }
  
  isDevMode(): boolean {
    return false
  }
  
  getAdapterType(): 'sillytavern' | 'mock' {
    return 'sillytavern'
  }
}

/**
 * 创建 SillyTavern 适配器实例
 */
export function createSillyTavernAdapter(): SillyTavernAdapter {
  return new SillyTavernAdapter()
}

/**
 * 检查 SillyTavern 环境是否可用
 */
export function isSillyTavernAvailable(): boolean {
  const parentWin = getParentWindow()
  return !!(parentWin.SillyTavern?.getContext() && parentWin.TavernHelper)
}