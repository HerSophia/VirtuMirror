/**
 * Swipe 状态管理 Store
 * 管理消息页切换的分层状态
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  PhoneState,
  PhoneDataItem,
  LastFloorData,
  SwipeChangedEvent,
  MessageDeletedEvent,
} from '@/types/swipe'
import {
  createEmptyPhoneState,
  getVisibleData,
  consolidateLastFloor,
  switchSwipe,
  filterByType,
  removeBySourceMessage,
} from '@/types/swipe'
import { useDialogStore } from './dialogStore'
import { loggerService } from '@/services/logger'

const logger = loggerService.child('store:swipe')

export const useSwipeStore = defineStore('swipe', () => {
  // ==================== 状态 ====================
  
  /** 当前手机状态 */
  const state = ref<PhoneState | null>(null)
  
  /** 待确认的删除事件（保留用于状态追踪） */
  const pendingDeleteEvent = ref<MessageDeletedEvent | null>(null)
  
  // ==================== 计算属性 ====================
  
  /** 当前会话 ID */
  const sessionId = computed(() => state.value?.sessionId || null)
  
  /** 当前可见的所有数据项 */
  const visibleData = computed(() => {
    if (!state.value) return []
    return getVisibleData(state.value)
  })
  
  /** 当前可见的消息 */
  const visibleMessages = computed(() => {
    return filterByType(visibleData.value, 'message')
  })
  
  /** 当前可见的联系人 */
  const visibleContacts = computed(() => {
    return filterByType(visibleData.value, 'contact')
  })
  
  /** 当前可见的朋友圈 */
  const visibleMoments = computed(() => {
    return filterByType(visibleData.value, 'moment')
  })
  
  /** 当前可见的邮件 */
  const visibleEmails = computed(() => {
    return filterByType(visibleData.value, 'email')
  })
  
  /** 最后楼层信息 */
  const lastFloor = computed(() => state.value?.lastFloor || null)
  
  /** 是否有最后楼层的分支数据 */
  const hasLastFloorBranches = computed(() => {
    return (state.value?.lastFloor?.swipeCount ?? 0) > 1
  })
  
  /** 永久数据条数 */
  const permanentDataCount = computed(() => state.value?.permanentData.length ?? 0)
  
  // ==================== 操作 ====================
  
  /**
   * 初始化状态
   */
  function initState(newSessionId: string) {
    state.value = createEmptyPhoneState(newSessionId)
  }
  
  /**
   * 重置状态
   */
  function resetState() {
    state.value = null
    pendingDeleteEvent.value = null
  }
  
  /**
   * 添加数据项到永久数据
   */
  function addToPermanentData(items: PhoneDataItem[]) {
    if (!state.value) return
    state.value.permanentData.push(...items)
  }
  
  /**
   * 设置最后楼层的分支数据
   */
  function setLastFloor(data: LastFloorData) {
    if (!state.value) return
    state.value.lastFloor = data
  }
  
  /**
   * 处理新消息到来（新楼层）
   * 固化之前的最后楼层，设置新的最后楼层
   */
  function handleNewMessage(messageId: number, swipeId: number, data: PhoneDataItem[]) {
    if (!state.value) return
    
    // 固化之前的最后楼层
    state.value = consolidateLastFloor(state.value)
    
    // 设置新的最后楼层
    state.value.lastFloor = {
      messageId,
      currentSwipeId: swipeId,
      swipeCount: 1,
      swipeData: new Map([[swipeId, data]]),
    }
  }
  
  /**
   * 处理 Swipe 切换事件
   */
  function handleSwipeChanged(event: SwipeChangedEvent) {
    if (!state.value) return
    
    // 确保是当前会话
    if (event.sessionId !== state.value.sessionId) {
      logger.warn('Swipe 事件会话不匹配', {
        eventSessionId: event.sessionId,
        currentSessionId: state.value.sessionId
      })
      return
    }
    
    // 确保是最后一楼
    if (!state.value.lastFloor || state.value.lastFloor.messageId !== event.messageId) {
      logger.warn('Swipe 事件楼层不匹配', { messageId: event.messageId })
      return
    }
    
    // 更新 swipe 信息
    state.value.lastFloor.currentSwipeId = event.newSwipeId
    state.value.lastFloor.swipeCount = event.swipeCount
    
    // 如果这个 swipe 的数据还没有，创建空数组（等待解析）
    if (!state.value.lastFloor.swipeData.has(event.newSwipeId)) {
      state.value.lastFloor.swipeData.set(event.newSwipeId, [])
    }
    
    logger.debug('Swipe 已切换', { newSwipeId: event.newSwipeId, swipeCount: event.swipeCount })
  }
  
  /**
   * 更新最后楼层当前 swipe 的数据
   */
  function updateLastFloorData(swipeId: number, data: PhoneDataItem[]) {
    if (!state.value?.lastFloor) return
    state.value.lastFloor.swipeData.set(swipeId, data)
  }
  
  /**
   * 处理楼层删除事件
   * 使用全局对话框进行确认
   */
  async function handleMessageDeleted(event: MessageDeletedEvent) {
    if (event.requireConfirmation) {
      // 需要用户确认，使用全局对话框
      pendingDeleteEvent.value = event
      
      const dialogStore = useDialogStore()
      const confirmed = await dialogStore.confirm({
        title: '删除楼层数据',
        message: `楼层 ${event.messageId} 已被删除，是否同时删除相关的手机数据？`,
        detail: '这将删除该楼层产生的所有消息、联系人变更、朋友圈等数据。此操作无法撤销。',
        confirmText: '删除数据',
        cancelText: '保留数据',
        confirmType: 'danger',
        icon: 'warning',
      })
      
      if (confirmed) {
        confirmDelete(event.messageId)
      } else {
        pendingDeleteEvent.value = null
        logger.info('用户选择保留楼层数据', { messageId: event.messageId })
      }
    } else {
      // 直接删除
      confirmDelete(event.messageId)
    }
  }
  
  /**
   * 确认删除楼层数据
   */
  function confirmDelete(messageId: number) {
    if (!state.value) return
    
    // 如果删除的是最后楼层
    if (state.value.lastFloor?.messageId === messageId) {
      state.value.lastFloor = null
    }
    
    // 从永久数据中删除
    state.value.permanentData = removeBySourceMessage(state.value.permanentData, messageId)
    
    // 清理状态
    pendingDeleteEvent.value = null
    
    logger.info('已删除楼层数据', { messageId })
  }
  
  /**
   * 取消删除（保留用于外部调用）
   */
  function cancelDelete() {
    pendingDeleteEvent.value = null
  }
  
  /**
   * 手动切换 swipe
   */
  function doSwitchSwipe(newSwipeId: number) {
    if (!state.value) return
    state.value = switchSwipe(state.value, newSwipeId)
  }
  
  // ==================== 返回 ====================
  
  return {
    // 状态
    state,
    pendingDeleteEvent,
    
    // 计算属性
    sessionId,
    visibleData,
    visibleMessages,
    visibleContacts,
    visibleMoments,
    visibleEmails,
    lastFloor,
    hasLastFloorBranches,
    permanentDataCount,
    
    // 操作
    initState,
    resetState,
    addToPermanentData,
    setLastFloor,
    handleNewMessage,
    handleSwipeChanged,
    updateLastFloorData,
    handleMessageDeleted,
    confirmDelete,
    cancelDelete,
    doSwitchSwipe,
  }
})
