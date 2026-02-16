import { createBridgeAdapter, getBridgeAdapter, type SyncPayload, type SyncedMessage } from '@/adapters/bridgeAdapter'
import { eventBus } from '@/services/eventBus'
import { loggerService } from '@/services/logger'
import { notificationService } from '@/services/notification/notificationService'
import { sessionService } from '@/services/database'
import type { ArchiveFloorData } from '@/types/archive'
import type { SwipeChangedEvent } from '@/types/swipe'
import { archiveService } from './archiveService'

const logger = loggerService.child('service:archive:auto-extract')

const SUGGESTION_ACTIONS = {
  confirm: 'confirm',
  later: 'later',
  skip: 'skip',
} as const

const REMIND_DELAY_MS = 2 * 60 * 1000
const FULL_SYNC_TIMEOUT_MS = 10000

interface ExtractWindow {
  start: number
  end: number
}

interface ExtractSuggestion {
  id: string
  sessionId: string
  range: ExtractWindow
  createdAt: number
  notificationId?: string
}

interface NotificationActionEventPayload {
  notificationId: string
  actionId: string
  appId: string
  data?: Record<string, unknown>
}

function isSyncPayload(value: unknown): value is SyncPayload {
  if (!value || typeof value !== 'object') {
    return false
  }

  return 'messages' in value
}

function isSwipeChangedEvent(value: unknown): value is SwipeChangedEvent {
  if (!value || typeof value !== 'object') {
    return false
  }

  return 'messageId' in value && 'newSwipeId' in value
}

function isNotificationActionPayload(value: unknown): value is NotificationActionEventPayload {
  if (!value || typeof value !== 'object') {
    return false
  }

  return 'notificationId' in value && 'actionId' in value && 'appId' in value
}

function extractChatId(sessionId: string): string {
  const separatorIndex = sessionId.indexOf(':')
  if (separatorIndex < 0) {
    return sessionId
  }

  return sessionId.slice(separatorIndex + 1)
}

function buildWindowKey(sessionId: string, range: ExtractWindow): string {
  return `${sessionId}:${range.start}-${range.end}`
}

export class ArchiveAutoExtractService {
  private initialized = false
  private bridge = getBridgeAdapter() ?? createBridgeAdapter()
  private unsubscribers: Array<() => void> = []
  private pendingSuggestions = new Map<string, ExtractSuggestion>()
  private windowToSuggestionId = new Map<string, string>()
  private processingWindows = new Set<string>()
  private reminderTimers = new Map<string, ReturnType<typeof setTimeout>>()

  init(): void {
    if (this.initialized) {
      return
    }

    this.bridge = getBridgeAdapter() ?? createBridgeAdapter()

    this.unsubscribers.push(
      this.bridge.on('message_received', (payload: unknown) => {
        void this.handleBridgeUpdate(payload)
      })
    )

    this.unsubscribers.push(
      this.bridge.on('message_edited', (payload: unknown) => {
        void this.handleBridgeUpdate(payload)
      })
    )

    this.unsubscribers.push(
      this.bridge.on('swipe_changed', (payload: unknown) => {
        void this.handleBridgeUpdate(payload)
      })
    )

    this.unsubscribers.push(
      this.bridge.on('chat_changed', () => {
        this.clearPendingSuggestions()
      })
    )

    this.unsubscribers.push(
      eventBus.on('notification:action', (payload: unknown) => {
        void this.handleNotificationAction(payload)
      })
    )

    this.initialized = true
  }

  destroy(): void {
    this.unsubscribers.forEach((unsubscribe) => unsubscribe())
    this.unsubscribers = []

    for (const timer of this.reminderTimers.values()) {
      clearTimeout(timer)
    }

    this.reminderTimers.clear()
    this.pendingSuggestions.clear()
    this.windowToSuggestionId.clear()
    this.processingWindows.clear()
    this.initialized = false
  }

  async checkAutoExtract(sessionId: string, currentFloor: number): Promise<void> {
    const config = await archiveService.getConfig(sessionId)
    if (!config.autoExtract.enabled) {
      return
    }

    if (currentFloor <= config.lastExtractFloor) {
      return
    }

    const floorInterval = Math.max(1, config.autoExtract.floorInterval)
    const floorsSinceLastExtract = currentFloor - config.lastExtractFloor
    if (floorsSinceLastExtract < floorInterval) {
      return
    }

    const range: ExtractWindow = {
      start: config.lastExtractFloor + 1,
      end: currentFloor,
    }

    const windowKey = buildWindowKey(sessionId, range)
    if (this.windowToSuggestionId.has(windowKey) || this.processingWindows.has(windowKey)) {
      return
    }

    const suggestion: ExtractSuggestion = {
      id: `archive:auto:${sessionId}:${range.start}-${range.end}`,
      sessionId,
      range,
      createdAt: Date.now(),
    }

    this.pendingSuggestions.set(suggestion.id, suggestion)
    this.windowToSuggestionId.set(windowKey, suggestion.id)

    if (!config.autoExtract.requireConfirmation) {
      await this.confirmSuggestion(suggestion.id)
      return
    }

    this.pushSuggestionNotification(suggestion)
  }

  async confirmSuggestion(suggestionId: string): Promise<void> {
    const suggestion = this.pendingSuggestions.get(suggestionId)
    if (!suggestion) {
      return
    }

    const windowKey = buildWindowKey(suggestion.sessionId, suggestion.range)
    if (this.processingWindows.has(windowKey)) {
      return
    }

    this.processingWindows.add(windowKey)
    this.clearReminder(suggestionId)

    try {
      const latestConfig = await archiveService.getConfig(suggestion.sessionId)
      if (latestConfig.lastExtractFloor >= suggestion.range.end) {
        this.completeSuggestion(suggestion)
        return
      }

      const floors = await this.fetchFloors(suggestion.sessionId, suggestion.range)
      if (floors.length === 0) {
        throw new Error('No floors available for archive extraction')
      }

      const extraction = await archiveService.extractAndPersistFromChat(floors, {
        sessionId: suggestion.sessionId,
        scene: 'archive.extract.auto',
      })

      if (!extraction.success) {
        throw new Error(extraction.extraction.error ?? extraction.persisted.error ?? 'Archive auto extract failed')
      }

      const refreshedConfig = await archiveService.getConfig(suggestion.sessionId)
      if (refreshedConfig.lastExtractFloor < suggestion.range.end) {
        await archiveService.saveConfig({
          ...refreshedConfig,
          lastExtractFloor: suggestion.range.end,
          lastExtractTime: Date.now(),
          totalExtractCount: refreshedConfig.totalExtractCount + 1,
        })
      }

      this.completeSuggestion(suggestion)
    } catch (error) {
      logger.warn('自动提取执行失败，保留游标等待重试', {
        sessionId: suggestion.sessionId,
        range: suggestion.range,
        error: error instanceof Error ? error.message : String(error),
      })
    } finally {
      this.processingWindows.delete(windowKey)
    }
  }

  async postponeSuggestion(suggestionId: string): Promise<void> {
    const suggestion = this.pendingSuggestions.get(suggestionId)
    if (!suggestion) {
      return
    }

    this.clearReminder(suggestionId)

    const timer = setTimeout(() => {
      const current = this.pendingSuggestions.get(suggestionId)
      if (!current) {
        return
      }

      this.pushSuggestionNotification(current)
    }, REMIND_DELAY_MS)

    this.reminderTimers.set(suggestionId, timer)
  }

  async skipSuggestion(suggestionId: string): Promise<void> {
    const suggestion = this.pendingSuggestions.get(suggestionId)
    if (!suggestion) {
      return
    }

    this.clearReminder(suggestionId)

    const config = await archiveService.getConfig(suggestion.sessionId)
    if (config.lastExtractFloor < suggestion.range.end) {
      await archiveService.saveConfig({
        ...config,
        lastExtractFloor: suggestion.range.end,
      })
    }

    this.completeSuggestion(suggestion)
  }

  private async handleBridgeUpdate(payload: unknown): Promise<void> {
    const sessionId = this.resolveCurrentSessionId()
    if (!sessionId) {
      return
    }

    const currentFloor = this.resolveCurrentFloor(payload)
    if (!currentFloor || currentFloor <= 0) {
      return
    }

    await this.checkAutoExtract(sessionId, currentFloor)
  }

  private async handleNotificationAction(payload: unknown): Promise<void> {
    if (!isNotificationActionPayload(payload)) {
      return
    }

    if (payload.appId !== 'archive') {
      return
    }

    const kind = payload.data?.kind
    if (kind !== 'archive:auto-extract') {
      return
    }

    const suggestionId = String(payload.data?.suggestionId ?? '')
    if (!suggestionId) {
      return
    }

    if (payload.actionId === SUGGESTION_ACTIONS.confirm) {
      await this.confirmSuggestion(suggestionId)
      return
    }

    if (payload.actionId === SUGGESTION_ACTIONS.later) {
      await this.postponeSuggestion(suggestionId)
      return
    }

    if (payload.actionId === SUGGESTION_ACTIONS.skip) {
      await this.skipSuggestion(suggestionId)
    }
  }

  private resolveCurrentSessionId(): string | null {
    const storedSessionId = sessionService.getCurrentSessionIdOrNull()
    if (storedSessionId) {
      return storedSessionId
    }

    const fullSessionId = this.bridge.getFullSessionId()
    if (fullSessionId) {
      return fullSessionId
    }

    return this.bridge.getCurrentSessionId()
  }

  private resolveCurrentFloor(payload: unknown): number {
    if (isSyncPayload(payload) && Array.isArray(payload.messages) && payload.messages.length > 0) {
      return payload.messages.reduce((maxFloor, message) => {
        const floor = Number((message as SyncedMessage).message_id ?? 0)
        return floor > maxFloor ? floor : maxFloor
      }, 0)
    }

    if (isSwipeChangedEvent(payload)) {
      return payload.messageId
    }

    const history = this.bridge.getChatHistory()
    if (history.length === 0) {
      return 0
    }

    return history.reduce((maxFloor, message) => (message.messageId > maxFloor ? message.messageId : maxFloor), 0)
  }

  private async fetchFloors(sessionId: string, range: ExtractWindow): Promise<ArchiveFloorData[]> {
    const syncPayload = await this.requestFullSync(range)

    const bridgeChatId = extractChatId(sessionId)
    const syncedMessages = this.extractSyncedMessages(syncPayload)

    const floorsFromSync = syncedMessages
      .filter((message) => {
        const messageSessionId = message.sessionId || bridgeChatId
        if (messageSessionId !== bridgeChatId) {
          return false
        }

        return message.message_id >= range.start && message.message_id <= range.end
      })
      .filter((message) => !message.is_hidden)
      .map((message) => ({
        messageId: message.message_id,
        swipeId: message.swipe_id ?? 0,
        role: message.role,
        content: message.message,
        timestamp: Date.now(),
      }))
      .filter((floor) => floor.content.trim().length > 0)
      .sort((left, right) => left.messageId - right.messageId)

    if (floorsFromSync.length > 0) {
      return floorsFromSync
    }

    return this.bridge
      .getChatHistory()
      .filter((message) => message.messageId >= range.start && message.messageId <= range.end)
      .map((message) => ({
        messageId: message.messageId,
        swipeId: 0,
        role: message.role,
        content: message.content,
        timestamp: Date.now(),
      }))
      .filter((floor) => floor.content.trim().length > 0)
      .sort((left, right) => left.messageId - right.messageId)
  }

  private extractSyncedMessages(payload: SyncPayload | null): SyncedMessage[] {
    if (!payload || !Array.isArray(payload.messages)) {
      return []
    }

    return payload.messages as SyncedMessage[]
  }

  private async requestFullSync(range: ExtractWindow): Promise<SyncPayload | null> {
    const floorRange = Math.max(1, range.end - range.start + 1)

    return new Promise<SyncPayload | null>((resolve) => {
      const timeout = setTimeout(() => {
        unsubscribe()
        resolve(null)
      }, FULL_SYNC_TIMEOUT_MS)

      const unsubscribe = this.bridge.on('bridge:full_sync', (payload: unknown) => {
        clearTimeout(timeout)
        unsubscribe()
        resolve(payload as SyncPayload)
      })

      this.bridge.requestSync(floorRange)
    })
  }

  private pushSuggestionNotification(suggestion: ExtractSuggestion): void {
    const floorCount = suggestion.range.end - suggestion.range.start + 1
    const notification = notificationService.push({
      appId: 'archive',
      appName: '档案服务',
      appIcon: {
        type: 'fontawesome',
        value: 'fas fa-box-archive',
        backgroundColor: '#2563EB',
        color: '#ffffff',
      },
      title: '档案提取建议',
      body: `检测到 ${floorCount} 层新内容，是否执行档案提取？`,
      category: 'system',
      priority: 'normal',
      autoDismiss: 0,
      actions: [
        { id: SUGGESTION_ACTIONS.confirm, label: '确认' },
        { id: SUGGESTION_ACTIONS.later, label: '稍后' },
        { id: SUGGESTION_ACTIONS.skip, label: '跳过' },
      ],
      data: {
        kind: 'archive:auto-extract',
        suggestionId: suggestion.id,
        sessionId: suggestion.sessionId,
        rangeStart: suggestion.range.start,
        rangeEnd: suggestion.range.end,
      },
    })

    suggestion.notificationId = notification.id
    this.pendingSuggestions.set(suggestion.id, suggestion)
  }

  private clearPendingSuggestions(): void {
    for (const suggestionId of this.pendingSuggestions.keys()) {
      this.clearReminder(suggestionId)
    }

    this.pendingSuggestions.clear()
    this.windowToSuggestionId.clear()
    this.processingWindows.clear()
  }

  private clearReminder(suggestionId: string): void {
    const timer = this.reminderTimers.get(suggestionId)
    if (!timer) {
      return
    }

    clearTimeout(timer)
    this.reminderTimers.delete(suggestionId)
  }

  private completeSuggestion(suggestion: ExtractSuggestion): void {
    this.clearReminder(suggestion.id)
    this.pendingSuggestions.delete(suggestion.id)
    this.windowToSuggestionId.delete(buildWindowKey(suggestion.sessionId, suggestion.range))
  }
}

let archiveAutoExtractServiceInstance: ArchiveAutoExtractService | null = null

export function getArchiveAutoExtractService(): ArchiveAutoExtractService {
  if (!archiveAutoExtractServiceInstance) {
    archiveAutoExtractServiceInstance = new ArchiveAutoExtractService()
  }

  return archiveAutoExtractServiceInstance
}

export function initArchiveAutoExtractService(): ArchiveAutoExtractService {
  const service = getArchiveAutoExtractService()
  service.init()
  return service
}

export function destroyArchiveAutoExtractService(): void {
  if (archiveAutoExtractServiceInstance) {
    archiveAutoExtractServiceInstance.destroy()
    archiveAutoExtractServiceInstance = null
  }
}

export const archiveAutoExtractService = getArchiveAutoExtractService()
