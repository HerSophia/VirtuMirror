/**
 * 账号系统 Store (Pinia)
 * 
 * 提供响应式的账号数据访问层
 * 支持双层作用域模型
 * 
 * 会话上下文自动管理：
 * - 自动从 Bridge Adapter 获取真实会话信息
 * - 监听会话切换事件自动更新
 * - 独立模式回退到 'standalone-session'
 * 
 * @see docs/systems/account-service.md
 * @see docs/dev/Security/account-session-binding.md
 */

import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { accountService } from '@/services/account/accountService'
import { userPool } from '@/services/account/userPool'
import { getBridgeAdapter } from '@/adapters/bridgeAdapter'
import type {
  CharacterEntity,
  PlatformAccount,
  CreateEntityInput,
  CreatePlatformAccountInput,
  FullProfile,
  SessionContext,
  MissingAccountInfo,
  GenerationContext,
  EntityScope,
  AccountScope,
} from '@/types/account'
import { loggerService } from '@/services/logger'

const logger = loggerService.child('store:account')

export const useAccountStore = defineStore('account', () => {
  // === 状态 ===
  
  /** 当前会话上下文 */
  const sessionContext = ref<SessionContext | null>(null)
  
  /** 已加载的实体缓存 */
  const entities = ref<Map<string, CharacterEntity>>(new Map())
  
  /** 已加载的平台账号缓存 */
  const accounts = ref<Map<string, PlatformAccount>>(new Map())
  
  /** 当前玩家的 Entity ID */
  const currentPlayerId = ref<string | null>(null)
  
  /** 加载状态 */
  const isLoading = ref(false)
  
  /** 是否已初始化 */
  const isInitialized = ref(false)
  
  /** 事件取消订阅函数列表 */
  const eventUnsubscribers = ref<(() => void)[]>([])

  // === Getters ===
  
  /** 当前玩家实体 */
  const currentPlayer = computed(() => {
    if (!currentPlayerId.value) return null
    return entities.value.get(currentPlayerId.value) || null
  })
  
  /** 当前会话可见的实体列表 */
  const visibleEntities = computed(() => {
    if (!sessionContext.value) return []
    return Array.from(entities.value.values()).filter(e => 
      accountService.isEntityVisible(e, sessionContext.value!)
    )
  })
  
  /** 当前会话可见的账号（按平台分组） */
  const visibleAccountsByPlatform = computed(() => {
    const result = new Map<string, PlatformAccount[]>()
    if (!sessionContext.value) return result
    
    for (const account of accounts.value.values()) {
      const entity = entities.value.get(account.entityId)
      if (entity && accountService.isAccountVisible(account, entity, sessionContext.value)) {
        const list = result.get(account.platformId) || []
        list.push(account)
        result.set(account.platformId, list)
      }
    }
    
    return result
  })
  
  /** 聊天平台的联系人列表 */
  const chatContacts = computed(() => {
    return visibleAccountsByPlatform.value.get('chat') || []
  })
  
  /** 所有实体列表 */
  const entityList = computed(() => {
    return Array.from(entities.value.values())
  })
  
  /** 所有 NPC 实体 */
  const npcEntities = computed(() => {
    return entityList.value.filter(e => e.type === 'npc')
  })

  // === Actions ===
  
  /**
   * 从 Bridge Adapter 获取当前会话上下文
   * 如果没有连接，返回独立模式的回退值
   */
  function getSessionContextFromBridge(): SessionContext {
    const adapter = getBridgeAdapter()
    
    if (adapter) {
      const status = adapter.getStatus()
      if (status.currentSessionId) {
        return {
          sessionId: status.currentSessionId,
          // characterCardId 需要酒馆桥接脚本扩展支持
          // 目前暂时使用 sessionId 的前缀作为替代
          characterCardId: undefined,
        }
      }
    }
    
    // 独立模式回退
    return {
      sessionId: 'standalone-session',
      characterCardId: undefined,
    }
  }
  
  /**
   * 设置事件监听，自动响应会话切换
   */
  function setupEventListeners(): void {
    const adapter = getBridgeAdapter()
    if (!adapter) return
    
    // 清理旧的监听器
    cleanupEventListeners()
    
    // 监听会话切换
    const unsubChatChanged = adapter.on('chat_changed', async () => {
      logger.info('检测到会话切换，自动更新上下文')
      const newContext = getSessionContextFromBridge()
      await switchSession(newContext)
    })
    eventUnsubscribers.value.push(unsubChatChanged)
    
    // 监听平台连接/断开
    const unsubPlatformChanged = adapter.on('bridge:platform_changed', async () => {
      logger.info('平台连接状态变化，更新上下文')
      const newContext = getSessionContextFromBridge()
      if (newContext.sessionId !== sessionContext.value?.sessionId) {
        await switchSession(newContext)
      }
    })
    eventUnsubscribers.value.push(unsubPlatformChanged)
    
    // 监听完整同步（可能包含新的会话信息）
    const unsubSync = adapter.on('bridge:full_sync', async () => {
      const newContext = getSessionContextFromBridge()
      if (newContext.sessionId !== sessionContext.value?.sessionId) {
        logger.info('同步数据包含新会话，更新上下文')
        await switchSession(newContext)
      }
    })
    eventUnsubscribers.value.push(unsubSync)
  }
  
  /**
   * 清理事件监听器
   */
  function cleanupEventListeners(): void {
    eventUnsubscribers.value.forEach(fn => fn())
    eventUnsubscribers.value = []
  }
  
  /**
   * 初始化账号系统
   * 
   * 会话上下文自动管理：
   * - 优先使用传入的 context（向后兼容）
   * - 否则自动从 Bridge Adapter 获取
   * - 无连接时回退到 'standalone-session'
   * 
   * @param playerName 玩家名称
   * @param context 会话上下文（可选，传入则使用传入值，否则自动获取）
   */
  async function initialize(
    playerName: string,
    context?: SessionContext
  ): Promise<void> {
    if (isInitialized.value) return
    
    isLoading.value = true
    try {
      // 设置会话上下文：优先使用传入值，否则自动获取
      const effectiveContext = context || getSessionContextFromBridge()
      sessionContext.value = effectiveContext
      accountService.setSessionContext(effectiveContext)
      
      logger.info('初始化会话上下文', { sessionId: effectiveContext.sessionId })
      
      // 获取或创建玩家实体
      const player = await accountService.getOrCreatePlayerEntity(playerName)
      currentPlayerId.value = player.id
      entities.value.set(player.id, player)
      
      // 加载所有实体到缓存
      const allEntities = await accountService.getAllEntities()
      for (const entity of allEntities) {
        entities.value.set(entity.id, entity)
      }
      
      // 设置事件监听（自动响应会话切换）
      setupEventListeners()
      
      isInitialized.value = true
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 切换会话上下文
   */
  async function switchSession(context: SessionContext): Promise<void> {
    sessionContext.value = context
    accountService.setSessionContext(context)
    await refreshVisibleData()
  }

  /**
   * 刷新可见数据
   */
  async function refreshVisibleData(): Promise<void> {
    if (!sessionContext.value) return
    
    isLoading.value = true
    try {
      // 重新加载所有实体
      const allEntities = await accountService.getAllEntities()
      entities.value.clear()
      for (const entity of allEntities) {
        entities.value.set(entity.id, entity)
      }
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 加载单个实体
   */
  async function loadEntity(id: string): Promise<CharacterEntity | null> {
    // 先检查缓存
    if (entities.value.has(id)) {
      return entities.value.get(id)!
    }
    
    const entity = await accountService.getEntity(id)
    if (entity) {
      entities.value.set(id, entity)
    }
    return entity
  }

  /**
   * 创建新实体
   */
  async function createEntity(data: CreateEntityInput): Promise<CharacterEntity> {
    const entity = await accountService.createEntity(data)
    entities.value.set(entity.id, entity)
    return entity
  }

  /**
   * 更新实体
   */
  async function updateEntity(id: string, data: Partial<CharacterEntity>): Promise<CharacterEntity> {
    const entity = await accountService.updateEntity(id, data)
    entities.value.set(id, entity)
    return entity
  }

  /**
   * 删除实体
   */
  async function deleteEntity(id: string): Promise<void> {
    await accountService.deleteEntity(id)
    entities.value.delete(id)
    
    // 同时从 accounts 缓存中删除相关账号
    for (const [accountId, account] of accounts.value.entries()) {
      if (account.entityId === id) {
        accounts.value.delete(accountId)
      }
    }
  }

  /**
   * 为实体创建平台账号
   */
  async function createPlatformAccount(
    entityId: string,
    platformId: string,
    data: CreatePlatformAccountInput
  ): Promise<PlatformAccount> {
    const account = await accountService.createPlatformAccount(entityId, platformId, data)
    accounts.value.set(account.id, account)
    return account
  }

  /**
   * 确保玩家在当前平台有账号
   * 如果没有，返回缺失信息用于显示创建弹窗
   */
  async function ensurePlayerAccount(platformId: string): Promise<PlatformAccount | MissingAccountInfo> {
    const missing = await accountService.checkMissingPlayerAccount(platformId)
    if (missing) {
      return missing
    }
    
    const account = await accountService.findPlayerAccountForContext(platformId)
    return account!
  }

  /**
   * 获取指定平台的可见账号
   */
  async function getVisibleAccountsForPlatform(platformId: string): Promise<PlatformAccount[]> {
    const platformAccounts = await accountService.getVisibleAccounts(platformId)
    
    // 更新缓存
    for (const account of platformAccounts) {
      accounts.value.set(account.id, account)
    }
    
    return platformAccounts
  }

  /**
   * 获取指定平台的联系人（带完整档案）
   */
  async function getContactsForPlatform(platformId: string): Promise<FullProfile[]> {
    const platformAccounts = await accountService.getVisibleAccounts(platformId)
    const profiles: FullProfile[] = []
    
    for (const account of platformAccounts) {
      accounts.value.set(account.id, account)
      
      const profile = await accountService.getFullProfile(account.id)
      if (profile) {
        entities.value.set(profile.entity.id, profile.entity)
        profiles.push(profile)
      }
    }
    
    return profiles
  }

  /**
   * 获取或创建随机用户（用于社交媒体内容生成）
   */
  async function getOrCreateRandomUser(
    platformId: string,
    context?: GenerationContext
  ): Promise<FullProfile> {
    // 先尝试获取已有的随机账号
    let account = await accountService.getRandomAccountForPlatform(platformId)
    
    if (!account) {
      // 生成新用户
      const profile = userPool.generateRandomProfile({ ...context, platform: platformId })
      
      const entity = await accountService.createEntity({
        type: 'npc',
        source: 'social',
        displayName: profile.displayName,
        avatar: profile.avatar,
        bio: profile.bio,
        gender: profile.gender,
        // 会自动推断为 session 级别
      })
      entities.value.set(entity.id, entity)
      
      account = await accountService.createPlatformAccount(entity.id, platformId, {
        handle: profile.handle,
        nickname: profile.nickname,
        scope: 'session',
        scopeSessionId: sessionContext.value?.sessionId,
      })
      accounts.value.set(account.id, account)
    }
    
    const fullProfile = await accountService.getFullProfile(account.id)
    return fullProfile!
  }

  /**
   * 关注账号
   */
  async function followAccount(fromAccountId: string, toAccountId: string): Promise<void> {
    await accountService.followAccount(fromAccountId, toAccountId)
  }

  /**
   * 取消关注账号
   */
  async function unfollowAccount(fromAccountId: string, toAccountId: string): Promise<void> {
    await accountService.unfollowAccount(fromAccountId, toAccountId)
  }

  /**
   * 添加好友（账号级别）
   */
  async function addFriendAccounts(accountIdA: string, accountIdB: string): Promise<void> {
    await accountService.addFriendAccounts(accountIdA, accountIdB)
  }

  /**
   * 删除好友（账号级别）
   */
  async function removeFriendAccounts(accountIdA: string, accountIdB: string): Promise<void> {
    await accountService.removeFriendAccounts(accountIdA, accountIdB)
  }

  /**
   * 获取关注列表
   */
  async function getFollowingAccounts(accountId: string): Promise<PlatformAccount[]> {
    const following = await accountService.getFollowingAccounts(accountId)
    
    // 更新缓存
    for (const account of following) {
      accounts.value.set(account.id, account)
    }
    
    return following
  }

  /**
   * 获取粉丝列表
   */
  async function getFollowerAccounts(accountId: string): Promise<PlatformAccount[]> {
    const followers = await accountService.getFollowerAccounts(accountId)
    
    // 更新缓存
    for (const account of followers) {
      accounts.value.set(account.id, account)
    }
    
    return followers
  }

  /**
   * 获取好友列表
   */
  async function getFriendAccounts(accountId: string): Promise<PlatformAccount[]> {
    const friends = await accountService.getFriendAccounts(accountId)
    
    // 更新缓存
    for (const account of friends) {
      accounts.value.set(account.id, account)
    }
    
    return friends
  }

  /**
   * 检查是否已关注
   */
  async function isFollowing(fromAccountId: string, toAccountId: string): Promise<boolean> {
    return accountService.hasAccountRelation(fromAccountId, toAccountId, 'follow')
  }

  /**
   * 检查是否是好友
   */
  async function isFriend(accountIdA: string, accountIdB: string): Promise<boolean> {
    return accountService.hasAccountRelation(accountIdA, accountIdB, 'friend')
  }

  /**
   * 搜索实体
   */
  async function searchEntities(query: string): Promise<CharacterEntity[]> {
    const results = await accountService.searchEntities(query)
    
    // 更新缓存
    for (const entity of results) {
      entities.value.set(entity.id, entity)
    }
    
    return results
  }

  /**
   * 获取完整档案
   */
  async function getFullProfile(accountId: string): Promise<FullProfile | null> {
    const profile = await accountService.getFullProfile(accountId)
    
    if (profile) {
      entities.value.set(profile.entity.id, profile.entity)
      accounts.value.set(profile.account.id, profile.account)
    }
    
    return profile
  }

  /**
   * 从角色卡同步
   */
  async function syncFromCharacterCard(
    cardId: string,
    cardData: { name: string; avatar?: string; description?: string }
  ): Promise<CharacterEntity> {
    const entity = await accountService.syncFromCharacterCard(cardId, cardData)
    entities.value.set(entity.id, entity)
    return entity
  }

  /**
   * 刷新所有缓存
   */
  async function refresh(): Promise<void> {
    isLoading.value = true
    try {
      entities.value.clear()
      accounts.value.clear()
      
      const allEntities = await accountService.getAllEntities()
      for (const entity of allEntities) {
        entities.value.set(entity.id, entity)
      }
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 获取统计信息
   */
  async function getStats() {
    return accountService.getStats()
  }

  /**
   * 获取玩家的所有平台账号
   */
  async function getPlayerAllAccounts(): Promise<PlatformAccount[]> {
    const playerAccounts = await accountService.getPlayerAllAccounts()
    
    // 更新缓存
    for (const account of playerAccounts) {
      accounts.value.set(account.id, account)
    }
    
    return playerAccounts
  }

  /**
   * 获取玩家在指定平台的账号
   */
  async function getPlayerAccountForPlatform(platformId: string): Promise<PlatformAccount | null> {
    // 先从缓存查找
    for (const account of accounts.value.values()) {
      if (account.platformId === platformId && account.entityId === currentPlayerId.value) {
        return account
      }
    }
    
    // 从服务获取
    const account = await accountService.findPlayerAccountForContext(platformId)
    if (account) {
      accounts.value.set(account.id, account)
    }
    return account
  }

  /**
   * 根据 ID 获取账号
   */
  async function getAccountById(accountId: string): Promise<PlatformAccount | null> {
    // 先检查缓存
    if (accounts.value.has(accountId)) {
      return accounts.value.get(accountId)!
    }
    
    // 从服务获取
    const account = await accountService.getPlatformAccount(accountId)
    if (account) {
      accounts.value.set(account.id, account)
    }
    return account
  }
  
  /**
   * 清理资源（组件卸载时调用）
   * 清理事件监听器，重置状态
   */
  function cleanup(): void {
    cleanupEventListeners()
    // 注意：不清理缓存数据，因为其他组件可能仍在使用
  }
  
  /**
   * 完全重置 Store（用于测试或登出）
   */
  function reset(): void {
    cleanupEventListeners()
    sessionContext.value = null
    entities.value.clear()
    accounts.value.clear()
    currentPlayerId.value = null
    isInitialized.value = false
  }

  return {
    // 状态
    sessionContext,
    entities,
    accounts,
    currentPlayerId,
    isLoading,
    isInitialized,
    
    // Getters
    currentPlayer,
    visibleEntities,
    visibleAccountsByPlatform,
    chatContacts,
    entityList,
    npcEntities,
    
    // Actions
    initialize,
    switchSession,
    refreshVisibleData,
    loadEntity,
    createEntity,
    updateEntity,
    deleteEntity,
    createPlatformAccount,
    ensurePlayerAccount,
    getVisibleAccountsForPlatform,
    getContactsForPlatform,
    getOrCreateRandomUser,
    followAccount,
    unfollowAccount,
    addFriendAccounts,
    removeFriendAccounts,
    getFollowingAccounts,
    getFollowerAccounts,
    getFriendAccounts,
    isFollowing,
    isFriend,
    searchEntities,
    getFullProfile,
    syncFromCharacterCard,
    refresh,
    getStats,
    getPlayerAllAccounts,
    getPlayerAccountForPlatform,
    getAccountById,
    cleanup,
    reset,
  }
})
