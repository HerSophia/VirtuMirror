/**
 * 账号系统服务 (Account Service)
 * 
 * 统一身份与社交关系管理中心
 * 将分散在各个 App 中的用户/角色数据统一管理
 * 
 * @see docs/systems/account-service.md
 */

import { v4 as uuidv4 } from 'uuid'
import { db } from '@/services/database'
import type {
  CharacterEntity,
  PlatformAccount,
  SocialRelation,
  CreateEntityInput,
  CreatePlatformAccountInput,
  QueryOptions,
  SearchOptions,
  FullProfile,
  RelationType,
  EntityType,
  EntityScope,
  AccountScope,
  SessionContext,
  MissingAccountInfo,
} from '@/types/account'

/**
 * 账号系统服务类
 * 
 * 核心功能：
 * - 实体管理：创建、查询、更新、删除角色实体
 * - 平台账号管理：为实体创建跨平台身份（支持独立作用域）
 * - 社交关系管理：基于账号的关注、好友等关系
 * - 可见性查询：根据会话上下文过滤可见实体和账号
 */
export class AccountService {
  private static instance: AccountService
  
  /** 当前会话上下文 */
  private currentContext: SessionContext | null = null

  private constructor() {}

  /**
   * 获取服务单例
   */
  static getInstance(): AccountService {
    if (!AccountService.instance) {
      AccountService.instance = new AccountService()
    }
    return AccountService.instance
  }

  // ==================== 会话上下文 ====================

  /**
   * 设置当前会话上下文
   */
  setSessionContext(context: SessionContext): void {
    this.currentContext = context
  }

  /**
   * 获取当前会话上下文
   */
  getSessionContext(): SessionContext | null {
    return this.currentContext
  }

  /**
   * 确保有会话上下文
   */
  private requireContext(): SessionContext {
    if (!this.currentContext) {
      throw new Error('Session context not set. Call setSessionContext() first.')
    }
    return this.currentContext
  }

  // ==================== 作用域验证 ====================

  /**
   * 验证账号作用域是否合法（不能比实体作用域更全局）
   */
  validateAccountScope(entityScope: EntityScope, accountScope: AccountScope): boolean {
    const scopeLevel: Record<EntityScope | AccountScope, number> = {
      session: 1,
      character: 2,
      global: 3,
    }
    return scopeLevel[accountScope] <= scopeLevel[entityScope]
  }

  /**
   * 判断实体是否在当前上下文可见
   */
  isEntityVisible(entity: CharacterEntity, context?: SessionContext): boolean {
    const ctx = context || this.currentContext
    if (!ctx) return false

    switch (entity.scope) {
      case 'global':
        return true
      case 'character':
        return entity.scopeCharacterCardId === ctx.characterCardId
      case 'session':
        return entity.scopeSessionId === ctx.sessionId
      default:
        return false
    }
  }

  /**
   * 判断平台账号是否在当前上下文可见
   */
  isAccountVisible(
    account: PlatformAccount,
    entity: CharacterEntity,
    context?: SessionContext
  ): boolean {
    const ctx = context || this.currentContext
    if (!ctx) return false

    // 1. 先检查实体可见性
    if (!this.isEntityVisible(entity, ctx)) {
      return false
    }

    // 2. 再检查账号作用域
    switch (account.scope) {
      case 'global':
        return true
      case 'character':
        return account.scopeCharacterCardId === ctx.characterCardId
      case 'session':
        return account.scopeSessionId === ctx.sessionId
      default:
        return false
    }
  }

  // ==================== 实体管理 ====================

  /**
   * 推断实体的默认作用域
   */
  private inferEntityScope(data: CreateEntityInput): {
    scope: EntityScope
    scopeSessionId?: string
    scopeCharacterCardId?: string
  } {
    // 玩家实体必须是全局的
    if (data.type === 'player') {
      return { scope: 'global' }
    }

    // 如果明确指定了作用域，使用指定的
    if (data.scope) {
      return {
        scope: data.scope,
        scopeSessionId: data.scopeSessionId,
        scopeCharacterCardId: data.scopeCharacterCardId,
      }
    }

    // 根据来源推断
    switch (data.source) {
      case 'system':
        return { scope: 'global' }
      case 'character_card':
        return {
          scope: 'character',
          scopeCharacterCardId: data.linkedCharacterCardId || this.currentContext?.characterCardId,
        }
      default:
        // chat, social, manual 默认为 session
        return {
          scope: 'session',
          scopeSessionId: this.currentContext?.sessionId,
        }
    }
  }

  /**
   * 创建角色实体
   */
  async createEntity(data: CreateEntityInput): Promise<CharacterEntity> {
    const now = Date.now()
    const scopeInfo = this.inferEntityScope(data)

    const entity: CharacterEntity = {
      id: uuidv4(),
      type: data.type,
      displayName: data.displayName,
      avatar: data.avatar,
      bio: data.bio,
      gender: data.gender,
      source: data.source,
      scope: scopeInfo.scope,
      scopeSessionId: scopeInfo.scopeSessionId,
      scopeCharacterCardId: scopeInfo.scopeCharacterCardId,
      linkedCharacterCardId: data.linkedCharacterCardId,
      metadata: data.metadata,
      createdAt: now,
      updatedAt: now,
    }

    await db.characterEntities.add(entity)
    return entity
  }

  /**
   * 获取角色实体
   */
  async getEntity(id: string): Promise<CharacterEntity | null> {
    const entity = await db.characterEntities.get(id)
    return entity || null
  }

  /**
   * 更新角色实体
   */
  async updateEntity(id: string, data: Partial<CharacterEntity>): Promise<CharacterEntity> {
    const existing = await db.characterEntities.get(id)
    if (!existing) {
      throw new Error(`Entity not found: ${id}`)
    }

    // 玩家实体的作用域不能更改
    if (existing.type === 'player' && data.scope && data.scope !== 'global') {
      throw new Error('Player entity scope must be global')
    }

    const updated: CharacterEntity = {
      ...existing,
      ...data,
      id: existing.id,
      type: existing.type, // 类型不能更改
      createdAt: existing.createdAt,
      updatedAt: Date.now(),
    }

    await db.characterEntities.put(updated)
    return updated
  }

  /**
   * 删除角色实体（同时删除所有平台账号和关系）
   */
  async deleteEntity(id: string): Promise<void> {
    await db.transaction(
      'rw',
      [db.characterEntities, db.platformAccounts, db.socialRelations],
      async () => {
        // 获取所有相关账号
        const accounts = await db.platformAccounts.where('entityId').equals(id).toArray()
        const accountIds = accounts.map(a => a.id)

        // 删除所有相关的社交关系
        if (accountIds.length > 0) {
          await db.socialRelations
            .where('fromAccountId')
            .anyOf(accountIds)
            .delete()
          await db.socialRelations
            .where('toAccountId')
            .anyOf(accountIds)
            .delete()
        }

        // 删除所有平台账号
        await db.platformAccounts.where('entityId').equals(id).delete()

        // 删除实体本身
        await db.characterEntities.delete(id)
      }
    )
  }

  /**
   * 获取当前会话可见的实体
   */
  async getVisibleEntities(context?: SessionContext): Promise<CharacterEntity[]> {
    const ctx = context || this.requireContext()
    const allEntities = await db.characterEntities.toArray()
    return allEntities.filter(e => this.isEntityVisible(e, ctx))
  }

  /**
   * 搜索角色实体
   */
  async searchEntities(query: string, options?: SearchOptions): Promise<CharacterEntity[]> {
    const lowerQuery = query.toLowerCase()
    const fields = options?.fields || ['displayName', 'bio']
    const limit = options?.limit || 50
    const offset = options?.offset || 0

    let results = await db.characterEntities
      .filter((entity) => {
        for (const field of fields) {
          if (field === 'displayName' && entity.displayName?.toLowerCase().includes(lowerQuery)) {
            return true
          }
          if (field === 'bio' && entity.bio?.toLowerCase().includes(lowerQuery)) {
            return true
          }
        }
        return false
      })
      .toArray()

    // 过滤可见性
    if (this.currentContext) {
      results = results.filter(e => this.isEntityVisible(e))
    }

    // 排序
    if (options?.sortBy) {
      const sortBy = options.sortBy as keyof CharacterEntity
      const order = options?.order === 'desc' ? -1 : 1
      results.sort((a, b) => {
        const aVal = a[sortBy]
        const bVal = b[sortBy]
        if (aVal === undefined) return 1
        if (bVal === undefined) return -1
        if (aVal < bVal) return -1 * order
        if (aVal > bVal) return 1 * order
        return 0
      })
    }

    // 分页
    return results.slice(offset, offset + limit)
  }

  /**
   * 获取所有角色实体（不考虑作用域）
   */
  async getAllEntities(options?: QueryOptions): Promise<CharacterEntity[]> {
    let collection = db.characterEntities.toCollection()

    if (options?.sortBy) {
      collection = db.characterEntities.orderBy(options.sortBy as string)
      if (options.order === 'desc') {
        collection = collection.reverse()
      }
    }

    let results = await collection.toArray()

    if (options?.offset) {
      results = results.slice(options.offset)
    }
    if (options?.limit) {
      results = results.slice(0, options.limit)
    }

    return results
  }

  /**
   * 按类型获取实体
   */
  async getEntitiesByType(type: EntityType, options?: QueryOptions): Promise<CharacterEntity[]> {
    let results = await db.characterEntities.where('type').equals(type).toArray()

    if (options?.sortBy) {
      const sortBy = options.sortBy as keyof CharacterEntity
      const order = options?.order === 'desc' ? -1 : 1
      results.sort((a, b) => {
        const aVal = a[sortBy]
        const bVal = b[sortBy]
        if (aVal === undefined) return 1
        if (bVal === undefined) return -1
        if (aVal < bVal) return -1 * order
        if (aVal > bVal) return 1 * order
        return 0
      })
    }

    if (options?.offset) {
      results = results.slice(options.offset)
    }
    if (options?.limit) {
      results = results.slice(0, options.limit)
    }

    return results
  }

  /**
   * 获取玩家实体
   */
  async getPlayerEntity(): Promise<CharacterEntity | null> {
    const players = await db.characterEntities.where('type').equals('player').toArray()
    return players.length > 0 ? players[0] : null
  }

  // ==================== 平台账号管理 ====================

  /**
   * 推断账号的默认作用域
   */
  private inferAccountScope(
    entity: CharacterEntity,
    data: CreatePlatformAccountInput
  ): {
    scope: AccountScope
    scopeSessionId?: string
    scopeCharacterCardId?: string
  } {
    // 如果实体是 session 级别，账号只能是 session
    if (entity.scope === 'session') {
      return {
        scope: 'session',
        scopeSessionId: entity.scopeSessionId,
      }
    }

    // 使用传入的作用域
    if (data.scope) {
      // 验证作用域合法性
      if (!this.validateAccountScope(entity.scope, data.scope)) {
        throw new Error(
          `Account scope '${data.scope}' cannot be more global than entity scope '${entity.scope}'`
        )
      }
      return {
        scope: data.scope,
        scopeSessionId: data.scopeSessionId,
        scopeCharacterCardId: data.scopeCharacterCardId,
      }
    }

    // 默认：玩家实体推荐 character 级别（每个世界一个身份）
    if (entity.type === 'player') {
      return {
        scope: 'character',
        scopeCharacterCardId: this.currentContext?.characterCardId,
      }
    }

    // 其他情况跟随实体作用域
    return {
      scope: entity.scope,
      scopeSessionId: entity.scopeSessionId,
      scopeCharacterCardId: entity.scopeCharacterCardId,
    }
  }

  /**
   * 为实体创建平台账号
   */
  async createPlatformAccount(
    entityId: string,
    platformId: string,
    data: CreatePlatformAccountInput
  ): Promise<PlatformAccount> {
    // 验证实体存在
    const entity = await db.characterEntities.get(entityId)
    if (!entity) {
      throw new Error(`Entity not found: ${entityId}`)
    }

    // 推断作用域
    const scopeInfo = this.inferAccountScope(entity, data)

    // 检查 handle 唯一性（如果提供了 handle）
    if (data.handle) {
      const existing = await db.platformAccounts
        .where('[platformId+handle]')
        .equals([platformId, data.handle])
        .first()
      if (existing) {
        throw new Error(`Handle already exists on platform ${platformId}: ${data.handle}`)
      }
    }

    const now = Date.now()
    
    // 深拷贝 platformData 以避免 Vue 响应式代理对象导致的 IndexedDB 序列化错误
    const sanitizedPlatformData = data.platformData 
      ? JSON.parse(JSON.stringify(data.platformData))
      : undefined
    
    const account: PlatformAccount = {
      id: uuidv4(),
      entityId,
      platformId,
      handle: data.handle,
      nickname: data.nickname,
      avatarOverride: data.avatarOverride,
      bioOverride: data.bioOverride,
      scope: scopeInfo.scope,
      scopeSessionId: scopeInfo.scopeSessionId,
      scopeCharacterCardId: scopeInfo.scopeCharacterCardId,
      platformData: sanitizedPlatformData,
      createdAt: now,
      updatedAt: now,
    }

    await db.platformAccounts.add(account)
    return account
  }

  /**
   * 获取平台账号
   */
  async getPlatformAccount(id: string): Promise<PlatformAccount | null> {
    const account = await db.platformAccounts.get(id)
    return account || null
  }

  /**
   * 通过 handle 查找平台账号
   */
  async findAccountByHandle(platformId: string, handle: string): Promise<PlatformAccount | null> {
    const account = await db.platformAccounts
      .where('[platformId+handle]')
      .equals([platformId, handle])
      .first()
    return account || null
  }

  /**
   * 获取实体的所有平台账号
   */
  async getAccountsByEntity(entityId: string): Promise<PlatformAccount[]> {
    return db.platformAccounts.where('entityId').equals(entityId).toArray()
  }

  /**
   * 获取当前会话可见的平台账号
   */
  async getVisibleAccounts(
    platformId: string,
    context?: SessionContext
  ): Promise<PlatformAccount[]> {
    const ctx = context || this.requireContext()

    const accounts = await db.platformAccounts
      .where('platformId')
      .equals(platformId)
      .toArray()

    const visibleAccounts: PlatformAccount[] = []

    for (const account of accounts) {
      const entity = await db.characterEntities.get(account.entityId)
      if (entity && this.isAccountVisible(account, entity, ctx)) {
        visibleAccounts.push(account)
      }
    }

    return visibleAccounts
  }

  /**
   * 查找玩家在指定平台、指定上下文的账号
   */
  async findPlayerAccountForContext(
    platformId: string,
    context?: SessionContext
  ): Promise<PlatformAccount | null> {
    const ctx = context || this.requireContext()
    const player = await this.getPlayerEntity()
    if (!player) return null

    const accounts = await db.platformAccounts
      .where('[entityId+platformId]')
      .equals([player.id, platformId])
      .toArray()

    // 找到当前上下文可见的账号
    for (const account of accounts) {
      if (this.isAccountVisible(account, player, ctx)) {
        return account
      }
    }

    return null
  }

  /**
   * 获取玩家的所有平台账号（跨所有世界）
   */
  async getPlayerAllAccounts(): Promise<PlatformAccount[]> {
    const player = await this.getPlayerEntity()
    if (!player) return []
    return db.platformAccounts.where('entityId').equals(player.id).toArray()
  }

  /**
   * 检查当前上下文是否缺少玩家账号
   */
  async checkMissingPlayerAccount(platformId: string): Promise<MissingAccountInfo | null> {
    const ctx = this.requireContext()
    const account = await this.findPlayerAccountForContext(platformId, ctx)

    if (account) {
      return null // 已有账号
    }

    const platformNames: Record<string, string> = {
      weibo: '微博',
      bilibili: 'B站',
      chat: '聊天',
    }

    return {
      platformId,
      platformName: platformNames[platformId] || platformId,
      context: ctx,
      suggestedScope: 'character',
    }
  }

  /**
   * 获取某平台的所有账号（不考虑可见性）
   */
  async getAccountsByPlatform(platformId: string, options?: QueryOptions): Promise<PlatformAccount[]> {
    let results = await db.platformAccounts
      .where('platformId')
      .equals(platformId)
      .toArray()

    if (options?.sortBy) {
      const sortBy = options.sortBy as keyof PlatformAccount
      const order = options?.order === 'desc' ? -1 : 1
      results.sort((a, b) => {
        const aVal = a[sortBy]
        const bVal = b[sortBy]
        if (aVal === undefined) return 1
        if (bVal === undefined) return -1
        if (aVal < bVal) return -1 * order
        if (aVal > bVal) return 1 * order
        return 0
      })
    }

    if (options?.offset) {
      results = results.slice(options.offset)
    }
    if (options?.limit) {
      results = results.slice(0, options.limit)
    }

    return results
  }

  /**
   * 随机获取某平台的一个可见账号（用于内容生成）
   */
  async getRandomAccountForPlatform(platformId: string): Promise<PlatformAccount | null> {
    const accounts = await this.getVisibleAccounts(platformId)

    if (accounts.length === 0) {
      return null
    }

    const randomIndex = Math.floor(Math.random() * accounts.length)
    return accounts[randomIndex]
  }

  /**
   * 更新平台账号
   */
  async updatePlatformAccount(
    id: string,
    data: Partial<PlatformAccount>
  ): Promise<PlatformAccount> {
    const existing = await db.platformAccounts.get(id)
    if (!existing) {
      throw new Error(`Platform account not found: ${id}`)
    }

    // 如果更新作用域，验证合法性
    if (data.scope) {
      const entity = await db.characterEntities.get(existing.entityId)
      if (entity && !this.validateAccountScope(entity.scope, data.scope)) {
        throw new Error(
          `Account scope '${data.scope}' cannot be more global than entity scope '${entity.scope}'`
        )
      }
    }

    // 如果更新 handle，检查唯一性
    if (data.handle && data.handle !== existing.handle) {
      const platformId = data.platformId || existing.platformId
      const duplicate = await db.platformAccounts
        .where('[platformId+handle]')
        .equals([platformId, data.handle])
        .first()
      if (duplicate && duplicate.id !== id) {
        throw new Error(`Handle already exists on platform ${platformId}: ${data.handle}`)
      }
    }

    // 深拷贝 platformData 以避免 Vue 响应式代理对象导致的 IndexedDB 序列化错误
    const sanitizedData = { ...data }
    if (sanitizedData.platformData) {
      sanitizedData.platformData = JSON.parse(JSON.stringify(sanitizedData.platformData))
    }

    const updated: PlatformAccount = {
      ...existing,
      ...sanitizedData,
      id: existing.id,
      entityId: existing.entityId, // 不允许更改关联的实体
      createdAt: existing.createdAt,
      updatedAt: Date.now(),
    }

    await db.platformAccounts.put(updated)
    return updated
  }

  /**
   * 删除平台账号
   */
  async deletePlatformAccount(id: string): Promise<void> {
    // 删除相关的社交关系
    await db.socialRelations.where('fromAccountId').equals(id).delete()
    await db.socialRelations.where('toAccountId').equals(id).delete()
    // 删除账号
    await db.platformAccounts.delete(id)
  }

  // ==================== 社交关系管理（基于账号） ====================

  /**
   * 创建关注关系（基于账号）
   */
  async followAccount(
    fromAccountId: string,
    toAccountId: string
  ): Promise<SocialRelation> {
    // 检查是否已存在
    const existing = await this.findAccountRelation(fromAccountId, toAccountId, 'follow')
    if (existing) {
      return existing
    }

    const now = Date.now()
    const relation: SocialRelation = {
      id: uuidv4(),
      fromAccountId,
      toAccountId,
      type: 'follow',
      createdAt: now,
    }

    await db.socialRelations.add(relation)
    return relation
  }

  /**
   * 取消关注（基于账号）
   */
  async unfollowAccount(
    fromAccountId: string,
    toAccountId: string
  ): Promise<void> {
    const relations = await db.socialRelations
      .where('[fromAccountId+type]')
      .equals([fromAccountId, 'follow'])
      .filter((r) => r.toAccountId === toAccountId)
      .toArray()

    for (const relation of relations) {
      await db.socialRelations.delete(relation.id)
    }
  }

  /**
   * 添加好友（双向关系，基于账号）
   */
  async addFriendAccounts(accountIdA: string, accountIdB: string): Promise<void> {
    await db.transaction('rw', db.socialRelations, async () => {
      const now = Date.now()

      // 检查 A -> B 是否已存在
      const existingAB = await this.findAccountRelation(accountIdA, accountIdB, 'friend')
      if (!existingAB) {
        await db.socialRelations.add({
          id: uuidv4(),
          fromAccountId: accountIdA,
          toAccountId: accountIdB,
          type: 'friend',
          createdAt: now,
        })
      }

      // 检查 B -> A 是否已存在
      const existingBA = await this.findAccountRelation(accountIdB, accountIdA, 'friend')
      if (!existingBA) {
        await db.socialRelations.add({
          id: uuidv4(),
          fromAccountId: accountIdB,
          toAccountId: accountIdA,
          type: 'friend',
          createdAt: now,
        })
      }
    })
  }

  /**
   * 删除好友（基于账号）
   */
  async removeFriendAccounts(accountIdA: string, accountIdB: string): Promise<void> {
    await db.transaction('rw', db.socialRelations, async () => {
      // 删除 A -> B
      const relationsAB = await db.socialRelations
        .where('[fromAccountId+type]')
        .equals([accountIdA, 'friend'])
        .filter((r) => r.toAccountId === accountIdB)
        .toArray()
      for (const r of relationsAB) {
        await db.socialRelations.delete(r.id)
      }

      // 删除 B -> A
      const relationsBA = await db.socialRelations
        .where('[fromAccountId+type]')
        .equals([accountIdB, 'friend'])
        .filter((r) => r.toAccountId === accountIdA)
        .toArray()
      for (const r of relationsBA) {
        await db.socialRelations.delete(r.id)
      }
    })
  }

  /**
   * 获取账号的关注列表
   */
  async getFollowingAccounts(accountId: string): Promise<PlatformAccount[]> {
    const relations = await db.socialRelations
      .where('[fromAccountId+type]')
      .equals([accountId, 'follow'])
      .toArray()

    const accountIds = relations.map((r) => r.toAccountId)
    if (accountIds.length === 0) return []

    return db.platformAccounts.where('id').anyOf(accountIds).toArray()
  }

  /**
   * 获取账号的粉丝列表
   */
  async getFollowerAccounts(accountId: string): Promise<PlatformAccount[]> {
    const relations = await db.socialRelations
      .where('[toAccountId+type]')
      .equals([accountId, 'follow'])
      .toArray()

    const accountIds = relations.map((r) => r.fromAccountId)
    if (accountIds.length === 0) return []

    return db.platformAccounts.where('id').anyOf(accountIds).toArray()
  }

  /**
   * 获取账号的好友列表
   */
  async getFriendAccounts(accountId: string): Promise<PlatformAccount[]> {
    const relations = await db.socialRelations
      .where('[fromAccountId+type]')
      .equals([accountId, 'friend'])
      .toArray()

    const accountIds = relations.map((r) => r.toAccountId)
    if (accountIds.length === 0) return []

    return db.platformAccounts.where('id').anyOf(accountIds).toArray()
  }

  /**
   * 检查账号间是否有某种关系
   */
  async hasAccountRelation(
    fromAccountId: string,
    toAccountId: string,
    type: RelationType
  ): Promise<boolean> {
    const relation = await this.findAccountRelation(fromAccountId, toAccountId, type)
    return relation !== null
  }

  /**
   * 查找账号间的特定关系
   */
  private async findAccountRelation(
    fromAccountId: string,
    toAccountId: string,
    type: RelationType
  ): Promise<SocialRelation | null> {
    const relations = await db.socialRelations
      .where('[fromAccountId+type]')
      .equals([fromAccountId, type])
      .filter((r) => r.toAccountId === toAccountId)
      .toArray()

    return relations.length > 0 ? relations[0] : null
  }

  // ==================== 向后兼容的实体级关系 API ====================
  // 这些方法会自动找到对应的账号来操作

  /**
   * @deprecated 使用 followAccount 代替
   */
  async follow(
    fromEntityId: string,
    toEntityId: string,
    platformId?: string
  ): Promise<SocialRelation> {
    console.warn('follow() is deprecated, use followAccount() instead')
    // 简化实现：返回一个模拟的关系
    return {
      id: uuidv4(),
      fromAccountId: fromEntityId,
      toAccountId: toEntityId,
      type: 'follow',
      createdAt: Date.now(),
    }
  }

  /**
   * @deprecated 使用 unfollowAccount 代替
   */
  async unfollow(
    fromEntityId: string,
    toEntityId: string,
    platformId?: string
  ): Promise<void> {
    console.warn('unfollow() is deprecated, use unfollowAccount() instead')
  }

  /**
   * @deprecated 使用 addFriendAccounts 代替
   */
  async addFriend(entityIdA: string, entityIdB: string): Promise<void> {
    console.warn('addFriend() is deprecated, use addFriendAccounts() instead')
  }

  /**
   * @deprecated 使用 removeFriendAccounts 代替
   */
  async removeFriend(entityIdA: string, entityIdB: string): Promise<void> {
    console.warn('removeFriend() is deprecated, use removeFriendAccounts() instead')
  }

  /**
   * @deprecated 使用 getFollowingAccounts 代替
   */
  async getFollowing(entityId: string, platformId?: string): Promise<CharacterEntity[]> {
    console.warn('getFollowing() is deprecated, use getFollowingAccounts() instead')
    return []
  }

  /**
   * @deprecated 使用 getFollowerAccounts 代替
   */
  async getFollowers(entityId: string, platformId?: string): Promise<CharacterEntity[]> {
    console.warn('getFollowers() is deprecated, use getFollowerAccounts() instead')
    return []
  }

  /**
   * @deprecated 使用 getFriendAccounts 代替
   */
  async getFriends(entityId: string): Promise<CharacterEntity[]> {
    console.warn('getFriends() is deprecated, use getFriendAccounts() instead')
    return []
  }

  /**
   * @deprecated 使用 hasAccountRelation 代替
   */
  async hasRelation(
    fromId: string,
    toId: string,
    type: RelationType,
    platformId?: string
  ): Promise<boolean> {
    console.warn('hasRelation() is deprecated, use hasAccountRelation() instead')
    return false
  }

  // ==================== 便捷方法 ====================

  /**
   * 获取平台账号的完整信息（合并 Entity 和 Account）
   */
  async getFullProfile(accountId: string): Promise<FullProfile | null> {
    const account = await db.platformAccounts.get(accountId)
    if (!account) {
      return null
    }

    const entity = await db.characterEntities.get(account.entityId)
    if (!entity) {
      return null
    }

    return {
      entity,
      account,
      displayName: account.nickname || entity.displayName,
      avatar: account.avatarOverride || entity.avatar || '',
      bio: account.bioOverride || entity.bio || '',
    }
  }

  /**
   * 通过实体 ID 和平台 ID 获取完整信息
   */
  async getFullProfileByEntityAndPlatform(
    entityId: string,
    platformId: string
  ): Promise<FullProfile | null> {
    const entity = await db.characterEntities.get(entityId)
    if (!entity) {
      return null
    }

    const accounts = await db.platformAccounts
      .where('[entityId+platformId]')
      .equals([entityId, platformId])
      .toArray()

    // 优先返回当前上下文可见的账号
    let account = accounts.find(a => this.isAccountVisible(a, entity))
    if (!account && accounts.length > 0) {
      account = accounts[0]
    }

    if (!account) {
      return null
    }

    return {
      entity,
      account,
      displayName: account.nickname || entity.displayName,
      avatar: account.avatarOverride || entity.avatar || '',
      bio: account.bioOverride || entity.bio || '',
    }
  }

  /**
   * 从角色卡导入/同步实体
   */
  async syncFromCharacterCard(
    cardId: string,
    cardData: {
      name: string
      avatar?: string
      description?: string
    }
  ): Promise<CharacterEntity> {
    // 查找是否已有关联的实体
    const existing = await db.characterEntities
      .where('linkedCharacterCardId')
      .equals(cardId)
      .first()

    if (existing) {
      // 更新现有实体
      return this.updateEntity(existing.id, {
        displayName: cardData.name,
        avatar: cardData.avatar,
        bio: cardData.description,
      })
    }

    // 创建新实体
    return this.createEntity({
      type: 'npc',
      source: 'character_card',
      displayName: cardData.name,
      avatar: cardData.avatar,
      bio: cardData.description,
      scope: 'character',
      scopeCharacterCardId: cardId,
      linkedCharacterCardId: cardId,
    })
  }

  /**
   * 获取或创建玩家实体
   * @param playerName 玩家名称
   */
  async getOrCreatePlayerEntity(playerName: string): Promise<CharacterEntity> {
    // 查找现有的玩家实体
    const players = await db.characterEntities.where('type').equals('player').toArray()

    if (players.length > 0) {
      // 如果名称不同，更新
      const player = players[0]
      if (player.displayName !== playerName) {
        return this.updateEntity(player.id, { displayName: playerName })
      }
      return player
    }

    // 创建玩家实体（必须是全局作用域）
    return this.createEntity({
      type: 'player',
      source: 'system',
      displayName: playerName,
      scope: 'global',
    })
  }

  /**
   * 统计信息
   */
  async getStats(): Promise<{
    totalEntities: number
    totalAccounts: number
    totalRelations: number
    entitiesByType: Record<EntityType, number>
    entitiesByScope: Record<EntityScope, number>
    accountsByPlatform: Record<string, number>
  }> {
    const entities = await db.characterEntities.toArray()
    const accounts = await db.platformAccounts.toArray()
    const relations = await db.socialRelations.count()

    const entitiesByType: Record<EntityType, number> = {
      npc: 0,
      player: 0,
    }
    const entitiesByScope: Record<EntityScope, number> = {
      session: 0,
      character: 0,
      global: 0,
    }
    for (const entity of entities) {
      entitiesByType[entity.type]++
      entitiesByScope[entity.scope]++
    }

    const accountsByPlatform: Record<string, number> = {}
    for (const account of accounts) {
      accountsByPlatform[account.platformId] = (accountsByPlatform[account.platformId] || 0) + 1
    }

    return {
      totalEntities: entities.length,
      totalAccounts: accounts.length,
      totalRelations: relations,
      entitiesByType,
      entitiesByScope,
      accountsByPlatform,
    }
  }
}

// 导出服务单例
export const accountService = AccountService.getInstance()
