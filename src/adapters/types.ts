/**
 * 宿主环境适配器接口
 * 定义与宿主环境交互的统一接口
 */

import type { PhoneChatData } from '@/types/persistedData'
import type { PhoneGlobalConfig } from '@/types/globalConfig'

/**
 * 变量类型选项
 */
export type VariableType = 'chat' | 'global' | 'preset' | 'character' | 'message'

/**
 * 变量操作选项
 */
export interface VariableOption {
  type: VariableType
  messageId?: number | 'latest'
}

/**
 * 生成配置选项
 */
export interface GenerateOptions {
  /** 是否流式输出 */
  stream?: boolean
  /** 最大 token 数 */
  maxTokens?: number
  /** 温度参数 */
  temperature?: number
  /** 自定义 API 配置 */
  customApi?: {
    apiUrl: string
    apiKey?: string
    model: string
    source?: string
  }
}

/**
 * 聊天消息
 */
export interface ChatMessage {
  messageId: number
  role: 'user' | 'assistant' | 'system'
  content: string
  name?: string
  isHidden?: boolean
}

/**
 * 事件监听器返回的取消函数
 */
export type UnsubscribeFn = () => void

/**
 * 宿主环境适配器接口
 * 用于抽象与 SillyTavern 或其他宿主环境的交互
 */
export interface HostAdapter {
  // ==================== 变量操作 ====================
  
  /**
   * 获取变量
   * @param option 变量类型选项
   */
  getVariables(option: VariableOption): Record<string, unknown>
  
  /**
   * 替换变量（完全覆盖）
   * @param variables 新的变量对象
   * @param option 变量类型选项
   */
  replaceVariables(variables: Record<string, unknown>, option: VariableOption): void
  
  /**
   * 插入或更新变量（合并）
   * @param variables 要更新的变量
   * @param option 变量类型选项
   */
  insertOrAssignVariables(variables: Record<string, unknown>, option: VariableOption): Record<string, unknown>
  
  /**
   * 删除变量
   * @param path 变量路径
   * @param option 变量类型选项
   */
  deleteVariable(path: string, option: VariableOption): { variables: Record<string, unknown>; deleteOccurred: boolean }
  
  // ==================== 数据持久化快捷方法 ====================
  
  /**
   * 获取聊天数据
   */
  getChatData(): PhoneChatData | null
  
  /**
   * 保存聊天数据
   * @param data 聊天数据
   */
  saveChatData(data: PhoneChatData): void
  
  /**
   * 获取全局配置
   */
  getGlobalConfig(): PhoneGlobalConfig | null
  
  /**
   * 保存全局配置
   * @param config 全局配置
   */
  saveGlobalConfig(config: PhoneGlobalConfig): void
  
  // ==================== AI 生成 ====================
  
  /**
   * 生成 AI 响应
   * @param prompt 提示词
   * @param options 生成选项
   */
  generate(prompt: string, options?: GenerateOptions): Promise<string>
  
  /**
   * 流式生成 AI 响应
   * @param prompt 提示词
   * @param options 生成选项
   */
  generateStream(prompt: string, options?: GenerateOptions): AsyncIterable<string>
  
  /**
   * 停止生成
   */
  stopGeneration(): void
  
  // ==================== 消息操作 ====================
  
  /**
   * 获取聊天历史
   * @param range 范围（消息ID或范围字符串）
   */
  getChatHistory(range?: number | string): ChatMessage[]
  
  /**
   * 发送用户消息
   * @param content 消息内容
   */
  sendUserMessage(content: string): Promise<void>
  
  // ==================== 事件系统 ====================
  
  /**
   * 监听消息接收事件
   * @param callback 回调函数
   */
  onMessageReceived(callback: (msgId: number, content: string) => void): UnsubscribeFn
  
  /**
   * 监听消息编辑事件
   * @param callback 回调函数
   */
  onMessageEdited(callback: (msgId: number, content: string) => void): UnsubscribeFn
  
  /**
   * 监听消息删除事件
   * @param callback 回调函数
   */
  onMessageDeleted(callback: (msgId: number) => void): UnsubscribeFn
  
  /**
   * 监听聊天切换事件
   * @param callback 回调函数
   */
  onChatChanged(callback: (chatFileName: string) => void): UnsubscribeFn
  
  /**
   * 通用事件监听
   * @param event 事件名称
   * @param handler 处理函数
   */
  on(event: string, handler: (...args: unknown[]) => void): UnsubscribeFn
  
  /**
   * 触发事件
   * @param event 事件名称
   * @param args 事件参数
   */
  emit(event: string, ...args: unknown[]): void
  
  // ==================== 环境信息 ====================
  
  /**
   * 获取角色名称
   */
  getCharacterName(): string
  
  /**
   * 获取玩家名称
   */
  getPlayerName(): string
  
  /**
   * 是否为开发模式
   */
  isDevMode(): boolean
  
  /**
   * 获取适配器类型标识
   */
  getAdapterType(): 'sillytavern' | 'mock'
}

/**
 * 适配器事件类型
 */
export type AdapterEventType =
  | 'message_received'
  | 'message_edited'
  | 'message_deleted'
  | 'chat_changed'
  | 'generation_started'
  | 'generation_completed'
  | 'generation_error'