/**
 * 叙事内容分发服务 (Narrative Service)
 *
 * 职责：接收来自平台的聊天叙事内容（纯文本故事），并广播给所有订阅的 App。
 * 原则：不解析、不存储、只分发。
 *
 * 使用方式：
 * 1. 在应用初始化时调用 narrativeService.setupBridgeListener()
 * 2. 各 App 通过 narrativeService.subscribe() 订阅内容
 * 3. 使用 createNarrativeVariables() 将事件转换为提示词变量
 */

import { getBridgeAdapter } from '@/adapters/bridgeAdapter'
import type { SyncPayload, SyncedMessage } from '@/adapters/bridgeAdapter'
import type { SwipeChangedEvent } from '@/types/swipe'

export interface NarrativeEvent {
  sessionId: string // 会话ID
  messageId: number // 楼层号
  swipeId: number // 消息页ID
  content: string // 纯文本故事内容
  isSwipeChange?: boolean // 是否是swipe切换触发的
  timestamp: number
}

/**
 * 标准化的叙事变量（用于注入提示词模板）
 */
export interface NarrativeVariables {
  /** 叙事内容（主要变量） */
  narrative: string
  /** 来源楼层号 */
  narrativeMessageId: number
  /** 来源 Swipe ID */
  narrativeSwipeId: number
  /** 时间戳 */
  narrativeTimestamp: number
  /** 是否是 Swipe 切换触发 */
  isSwipeChange: boolean
  /** 会话 ID */
  narrativeSessionId: string
}

export type NarrativeCallback = (event: NarrativeEvent) => void

class NarrativeService {
  private subscribers = new Set<NarrativeCallback>()
  private _initialized = false
  private _pendingSetup = false
  private _unsubscribers: Array<() => void> = []

  /**
   * 订阅叙事内容
   * @param callback 回调函数
   * @returns 取消订阅的函数
   */
  subscribe(callback: NarrativeCallback): () => void {
    this.subscribers.add(callback)
    return () => this.subscribers.delete(callback)
  }

  /**
   * 分发叙事内容
   * @param event 叙事事件
   */
  publish(event: NarrativeEvent): void {
    console.log('[NarrativeService] 发布叙事:', {
      messageId: event.messageId,
      swipeId: event.swipeId,
      isSwipe: event.isSwipeChange || false,
      contentLength: event.content.length,
      subscriberCount: this.subscribers.size,
    })
    this.subscribers.forEach((cb) => {
      try {
        cb(event)
      } catch (error) {
        console.error('[NarrativeService] Subscriber error:', error)
      }
    })
  }

  /**
   * 设置 Bridge 适配器监听
   * 应在应用初始化时调用一次
   * 如果 Bridge 适配器尚未创建，会等待连接事件
   */
  setupBridgeListener(): void {
    if (this._initialized) {
      console.warn('[NarrativeService] Already initialized')
      return
    }

    const adapter = getBridgeAdapter()
    if (!adapter) {
      console.log('[NarrativeService] Bridge adapter not available yet, will setup when connected')
      // 标记为待初始化，等 Bridge 连接后再设置
      this._pendingSetup = true
      return
    }
    
    this._setupListeners(adapter)
  }
  
  /**
   * 内部方法：设置监听器
   */
  private _setupListeners(adapter: ReturnType<typeof getBridgeAdapter>): void {
    if (!adapter || this._initialized) return

    // 监听完整同步（首次加载或刷新时）
    const unsubFullSync = adapter.on('bridge:full_sync', (payload: unknown) => {
      const syncPayload = payload as SyncPayload
      console.log('[NarrativeService] 收到 full_sync，消息数:', syncPayload.messages?.length || 0)
      if (syncPayload.messages && syncPayload.messages.length > 0) {
        // 拼接所有消息为完整叙事
        const narrativeContent = this._buildNarrativeFromMessages(syncPayload.messages as SyncedMessage[])
        const lastMsg = syncPayload.messages[syncPayload.messages.length - 1] as SyncedMessage
        
        console.log('[NarrativeService] 从 full_sync 发布叙事，共', syncPayload.messages.length, '条消息')
        this.publish({
          sessionId: lastMsg.sessionId || adapter.getCurrentSessionId() || '',
          messageId: lastMsg.message_id,
          swipeId: lastMsg.swipe_id ?? 0,
          content: narrativeContent,
          timestamp: Date.now(),
        })
      }
    })

    // 监听新消息（增量更新）
    const unsubMessage = adapter.on('message_received', (payload: unknown) => {
      const syncPayload = payload as SyncPayload
      console.log('[NarrativeService] 收到 message_received，消息数:', syncPayload.messages?.length || 0)
      if (syncPayload.messages && syncPayload.messages.length > 0) {
        const lastMsg = syncPayload.messages[syncPayload.messages.length - 1] as SyncedMessage
        if (lastMsg.message) {
          console.log('[NarrativeService] 从 message_received 发布叙事，楼层:', lastMsg.message_id)
          this.publish({
            sessionId: lastMsg.sessionId || adapter.getCurrentSessionId() || '',
            messageId: lastMsg.message_id,
            swipeId: lastMsg.swipe_id ?? 0,
            content: lastMsg.message,
            timestamp: Date.now(),
          })
        }
      }
    })

    // 监听 Swipe 切换
    const unsubSwipe = adapter.on('swipe_changed', (payload: unknown) => {
      const swipeEvent = payload as SwipeChangedEvent
      console.log('[NarrativeService] 收到 swipe_changed，楼层:', swipeEvent.messageId)
      this.publish({
        sessionId: adapter.getCurrentSessionId() || '',
        messageId: swipeEvent.messageId,
        swipeId: swipeEvent.newSwipeId,
        content: swipeEvent.content,
        isSwipeChange: true,
        timestamp: Date.now(),
      })
    })

    this._unsubscribers.push(unsubFullSync, unsubMessage, unsubSwipe)
    this._initialized = true
    console.log('[NarrativeService] Bridge listener setup complete')
  }

  /**
   * 清理监听器
   */
  cleanup(): void {
    this._unsubscribers.forEach((unsub) => unsub())
    this._unsubscribers = []
    this._initialized = false
  }

  /**
   * 是否已初始化
   */
  get initialized(): boolean {
    return this._initialized
  }
  
  /**
   * 将多条消息拼接为完整的叙事文本
   * 按楼层顺序拼接，使用分隔符区分
   */
  private _buildNarrativeFromMessages(messages: SyncedMessage[]): string {
    if (!messages || messages.length === 0) {
      return ''
    }
    
    // 按楼层号排序（升序）
    const sorted = [...messages].sort((a, b) => a.message_id - b.message_id)
    
    // 过滤掉空消息和隐藏消息，拼接内容
    const contents = sorted
      .filter(msg => msg.message && !msg.is_hidden)
      .map(msg => msg.message.trim())
      .filter(content => content.length > 0)
    
    // 使用双换行分隔不同楼层
    return contents.join('\n\n')
  }
}

export const narrativeService = new NarrativeService()

// ========== 辅助函数 ==========

/**
 * 将叙事事件转换为标准化的提示词变量
 * 
 * @example
 * ```typescript
 * narrativeService.subscribe(async (event) => {
 *   const variables = createNarrativeVariables(event)
 *   const result = await AIGenerateService.generateWithPrompt(
 *     'social.weibo.analyze',
 *     { ...variables, characterName: '角色名' },
 *     { appId: 'weibo', scene: 'social.weibo.analyze' }
 *   )
 * })
 * ```
 */
export function createNarrativeVariables(event: NarrativeEvent): NarrativeVariables {
  return {
    narrative: event.content,
    narrativeMessageId: event.messageId,
    narrativeSwipeId: event.swipeId,
    narrativeTimestamp: event.timestamp,
    isSwipeChange: event.isSwipeChange ?? false,
    narrativeSessionId: event.sessionId,
  }
}

/**
 * 标准叙事变量定义（用于提示词模板的 availableVariables）
 */
export const NARRATIVE_VARIABLE_DEFINITIONS = [
  {
    name: 'narrative',
    type: 'string' as const,
    description: '来自酒馆的叙事内容（故事文本）',
    required: true,
  },
  {
    name: 'narrativeMessageId',
    type: 'number' as const,
    description: '叙事来源的楼层号',
    required: false,
  },
  {
    name: 'narrativeSwipeId',
    type: 'number' as const,
    description: '叙事来源的 Swipe ID',
    required: false,
  },
  {
    name: 'isSwipeChange',
    type: 'boolean' as const,
    description: '是否由 Swipe 切换触发',
    required: false,
    defaultValue: false,
  },
]

// ========== 叙事注入工具函数 ==========

/**
 * 叙事变量名（系统保留变量名，用于防止重复注入）
 * 所有需要叙事内容的提示词都应使用此变量名
 */
export const NARRATIVE_VAR_NAME = 'narrative'

/**
 * 叙事注入结果
 */
export interface NarrativeInjectionResult {
  /** 处理后的文本 */
  text: string
  /** 是否成功注入 */
  injected: boolean
  /** 是否因重复而跳过 */
  skippedDuplicate: boolean
  /** 跳过原因 */
  skipReason?: string
}

/**
 * 检测文本中是否包含叙事变量占位符 {{narrative}}
 */
export function hasNarrativePlaceholder(text: string): boolean {
  if (!text) return false
  return text.includes(`{{${NARRATIVE_VAR_NAME}}}`)
}

/**
 * 检测文本中是否已经包含叙事内容
 * 通过检测叙事内容的特征片段来判断
 * 
 * @param text 要检测的文本
 * @param narrativeContent 叙事内容
 * @param sampleLength 用于比对的样本长度（默认100字符）
 */
export function containsNarrativeContent(
  text: string,
  narrativeContent: string,
  sampleLength: number = 100
): boolean {
  if (!text || !narrativeContent) return false
  
  // 叙事内容太短，无法可靠检测
  if (narrativeContent.trim().length < 30) return false
  
  // 取叙事内容的前N个字符作为特征样本
  const sample = narrativeContent.trim().slice(0, sampleLength)
  return text.includes(sample)
}

/**
 * 安全注入叙事内容，防止重复
 * 
 * 注入策略：
 * 1. 如果文本中有 {{narrative}} 占位符，替换它
 * 2. 如果叙事内容已经存在于其他文本中，跳过注入
 * 3. 支持在没有占位符时追加叙事内容
 * 
 * @param template 模板文本
 * @param narrativeContent 叙事内容
 * @param options 注入选项
 */
export function injectNarrativeSafely(
  template: string,
  narrativeContent: string,
  options?: {
    /** 如果没有占位符，是否追加到末尾 */
    appendIfMissing?: boolean
    /** 已经注入叙事的其他文本列表（用于检测重复） */
    otherTexts?: string[]
    /** 追加时使用的格式 */
    appendFormat?: 'xml' | 'markdown' | 'plain'
  }
): NarrativeInjectionResult {
  const { 
    appendIfMissing = false, 
    otherTexts = [],
    appendFormat = 'xml'
  } = options || {}
  
  // 空叙事内容，无需注入
  if (!narrativeContent || !narrativeContent.trim()) {
    return {
      text: template,
      injected: false,
      skippedDuplicate: false,
      skipReason: '叙事内容为空',
    }
  }
  
  // 检查叙事内容是否已经在其他文本中存在（防重复）
  for (const otherText of otherTexts) {
    if (containsNarrativeContent(otherText, narrativeContent)) {
      return {
        text: template,
        injected: false,
        skippedDuplicate: true,
        skipReason: '叙事内容已存在于其他文本中（防止重复注入）',
      }
    }
  }
  
  // 检查模板自身是否已经包含叙事内容
  if (containsNarrativeContent(template, narrativeContent)) {
    return {
      text: template,
      injected: false,
      skippedDuplicate: true,
      skipReason: '叙事内容已存在于模板中',
    }
  }
  
  // 检查模板中是否有 {{narrative}} 占位符
  if (hasNarrativePlaceholder(template)) {
    const result = template.replace(
      new RegExp(`\\{\\{${NARRATIVE_VAR_NAME}\\}\\}`, 'g'),
      narrativeContent
    )
    return {
      text: result,
      injected: true,
      skippedDuplicate: false,
    }
  }
  
  // 没有占位符，根据选项决定是否追加
  if (appendIfMissing) {
    let formattedNarrative: string
    switch (appendFormat) {
      case 'xml':
        formattedNarrative = `<叙事内容>\n${narrativeContent}\n</叙事内容>`
        break
      case 'markdown':
        formattedNarrative = `## 叙事内容\n\n${narrativeContent}`
        break
      case 'plain':
      default:
        formattedNarrative = `【叙事内容】\n${narrativeContent}`
    }
    
    return {
      text: `${template}\n\n${formattedNarrative}`,
      injected: true,
      skippedDuplicate: false,
    }
  }
  
  // 没有占位符且不追加
  return {
    text: template,
    injected: false,
    skippedDuplicate: false,
    skipReason: '模板中没有 {{narrative}} 占位符',
  }
}

/**
 * 准备带叙事的变量集合
 * 自动将叙事内容添加到变量中（如果不存在）
 * 
 * @param variables 原始变量
 * @param narrativeContent 叙事内容
 * @param narrativeMeta 叙事元数据（可选）
 */
export function prepareVariablesWithNarrative(
  variables: Record<string, unknown>,
  narrativeContent: string,
  narrativeMeta?: {
    messageId?: number
    swipeId?: number
    sessionId?: string
    timestamp?: number
  }
): Record<string, unknown> {
  const result = { ...variables }
  
  // 只有当 narrative 变量不存在或为空时才注入
  if (!result[NARRATIVE_VAR_NAME] || result[NARRATIVE_VAR_NAME] === '') {
    result[NARRATIVE_VAR_NAME] = narrativeContent
  }
  
  // 注入元数据（如果提供且变量不存在）
  if (narrativeMeta) {
    if (narrativeMeta.messageId !== undefined && !result.narrativeMessageId) {
      result.narrativeMessageId = narrativeMeta.messageId
    }
    if (narrativeMeta.swipeId !== undefined && !result.narrativeSwipeId) {
      result.narrativeSwipeId = narrativeMeta.swipeId
    }
    if (narrativeMeta.sessionId !== undefined && !result.narrativeSessionId) {
      result.narrativeSessionId = narrativeMeta.sessionId
    }
    if (narrativeMeta.timestamp !== undefined && !result.narrativeTimestamp) {
      result.narrativeTimestamp = narrativeMeta.timestamp
    }
  }
  
  return result
}
