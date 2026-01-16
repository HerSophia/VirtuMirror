/**
 * 数据库服务层入口
 * 提供会话管理和各种数据访问服务
 */

import { db, type Session, type StoredContact, type StoredMessage, type AppDataRecord } from './schema'
import type { Contact, Message, ContactId } from '@/types'

// ============ 会话管理服务 ============

export class SessionService {
  private currentSessionId: string | null = null
  
  /**
   * 获取或创建会话
   */
  async getOrCreateSession(
    platform: string,
    chatId: string,
    characterName: string,
    playerName: string
  ): Promise<Session> {
    const id = `${platform}:${chatId}`
    
    let session = await db.sessions.get(id)
    
    if (!session) {
      session = {
        id,
        platform,
        chatId,
        characterName,
        playerName,
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
      }
      await db.sessions.add(session)
    } else {
      // 更新最后活跃时间和上下文信息
      await db.sessions.update(id, {
        lastActiveAt: Date.now(),
        characterName,
        playerName,
      })
      session.lastActiveAt = Date.now()
      session.characterName = characterName
      session.playerName = playerName
    }
    
    this.currentSessionId = id
    return session
  }
  
  /**
   * 获取当前会话ID
   * @throws Error 如果没有活跃会话
   */
  getCurrentSessionId(): string {
    if (!this.currentSessionId) {
      throw new Error('No active session')
    }
    return this.currentSessionId
  }
  
  /**
   * 获取当前会话ID（安全版本，不抛错）
   */
  getCurrentSessionIdOrNull(): string | null {
    return this.currentSessionId
  }
  
  /**
   * 设置当前会话ID
   */
  setCurrentSessionId(sessionId: string | null): void {
    this.currentSessionId = sessionId
  }
  
  /**
   * 列出所有会话
   */
  async listSessions(): Promise<Session[]> {
    return db.sessions.orderBy('lastActiveAt').reverse().toArray()
  }
  
  /**
   * 获取会话详情
   */
  async getSession(sessionId: string): Promise<Session | undefined> {
    return db.sessions.get(sessionId)
  }
  
  /**
   * 删除会话及其所有数据
   */
  async deleteSession(sessionId: string): Promise<void> {
    await db.transaction(
      'rw',
      [
        db.sessions,
        db.contacts,
        db.messages,
        db.moments,
        db.calls,
        db.emails,
        db.forumBoards,
        db.forumPosts,
        db.liveStreams,
        db.bookmarks,
        db.browsingHistory,
        db.desktopLayouts,
      ],
      async () => {
        await db.contacts.where('sessionId').equals(sessionId).delete()
        await db.messages.where('sessionId').equals(sessionId).delete()
        await db.moments.where('sessionId').equals(sessionId).delete()
        await db.calls.where('sessionId').equals(sessionId).delete()
        await db.emails.where('sessionId').equals(sessionId).delete()
        await db.forumBoards.where('sessionId').equals(sessionId).delete()
        await db.forumPosts.where('sessionId').equals(sessionId).delete()
        await db.liveStreams.where('sessionId').equals(sessionId).delete()
        await db.bookmarks.where('sessionId').equals(sessionId).delete()
        await db.browsingHistory.where('sessionId').equals(sessionId).delete()
        await db.desktopLayouts.where('sessionId').equals(sessionId).delete()
        await db.sessions.delete(sessionId)
      }
    )
    
    if (this.currentSessionId === sessionId) {
      this.currentSessionId = null
    }
  }
}

export const sessionService = new SessionService()

// ============ 联系人服务 ============

export class ContactService {
  private get sessionId() {
    return sessionService.getCurrentSessionId()
  }
  
  /**
   * 获取所有联系人
   */
  async getAll(): Promise<Contact[]> {
    const contacts = await db.contacts.where('sessionId').equals(this.sessionId).toArray()
    return contacts.map(({ sessionId, sourceMessageId, sourceSwipeId, ...contact }) => contact)
  }
  
  /**
   * 根据ID获取联系人
   */
  async getById(id: ContactId): Promise<Contact | undefined> {
    const contact = await db.contacts.get([this.sessionId, id])
    if (!contact) return undefined
    const { sessionId, sourceMessageId, sourceSwipeId, ...rest } = contact
    return rest
  }

  /**
   * 插入或更新联系人
   */
  async upsert(contact: Contact, source?: { messageId: number; swipeId: number }): Promise<void> {
    await db.contacts.put({
      ...contact,
      sessionId: this.sessionId,
      sourceMessageId: source?.messageId,
      sourceSwipeId: source?.swipeId,
    })
  }
  
  /**
   * 批量插入或更新联系人
   */
  async upsertMany(contacts: Contact[], source?: { messageId: number; swipeId: number }): Promise<void> {
    const stored = contacts.map((c) => ({
      ...c,
      sessionId: this.sessionId,
      sourceMessageId: source?.messageId,
      sourceSwipeId: source?.swipeId,
    }))
    await db.contacts.bulkPut(stored)
  }
  
  /**
   * 删除联系人
   */
  async delete(id: ContactId): Promise<void> {
    await db.contacts.delete([this.sessionId, id])
  }
  
  /**
   * 清空当前会话的所有联系人
   */
  async clear(): Promise<void> {
    await db.contacts.where('sessionId').equals(this.sessionId).delete()
  }
  
  /**
   * 根据来源楼层删除联系人
   */
  async deleteBySourceMessage(messageId: number): Promise<number> {
    return db.contacts
      .where('[sessionId+sourceMessageId]')
      .equals([this.sessionId, messageId])
      .delete()
  }
  
  /**
   * 根据来源楼层和消息页删除联系人
   */
  async deleteBySourceSwipe(messageId: number, swipeId: number): Promise<number> {
    return db.contacts
      .where('[sessionId+sourceMessageId+sourceSwipeId]')
      .equals([this.sessionId, messageId, swipeId])
      .delete()
  }
}

export const contactService = new ContactService()

// ============ 消息服务 ============

export class MessageService {
  private get sessionId() {
    return sessionService.getCurrentSessionId()
  }
  
  /**
   * 获取指定联系人的所有消息
   */
  async getByContact(contactId: ContactId): Promise<Message[]> {
    const messages = await db.messages
      .where('[sessionId+contactId]')
      .equals([this.sessionId, contactId])
      .sortBy('timestamp')
    return messages.map(({ sessionId, sourceMessageId, sourceSwipeId, ...msg }) => msg as Message)
  }
  
  /**
   * 添加消息
   */
  async add(message: Message, source: { messageId: number; swipeId: number }): Promise<void> {
    await db.messages.add({
      ...message,
      sessionId: this.sessionId,
      sourceMessageId: source.messageId,
      sourceSwipeId: source.swipeId,
    } as StoredMessage)
  }
  
  /**
   * 批量添加消息
   */
  async addMany(messages: Message[], source: { messageId: number; swipeId: number }): Promise<void> {
    const stored = messages.map((m) => ({
      ...m,
      sessionId: this.sessionId,
      sourceMessageId: source.messageId,
      sourceSwipeId: source.swipeId,
    })) as StoredMessage[]
    await db.messages.bulkAdd(stored)
  }
  
  /**
   * 更新消息
   */
  async update(uid: string, updates: Partial<Message>): Promise<void> {
    await db.messages.update([this.sessionId, uid], updates)
  }
  
  /**
   * 删除消息
   */
  async delete(uid: string): Promise<void> {
    await db.messages.delete([this.sessionId, uid])
  }
  
  /**
   * 根据来源楼层删除消息
   */
  async deleteBySourceMessage(messageId: number): Promise<number> {
    return db.messages
      .where('[sessionId+sourceMessageId]')
      .equals([this.sessionId, messageId])
      .delete()
  }
  
  /**
   * 根据来源楼层和消息页删除消息
   */
  async deleteBySourceSwipe(messageId: number, swipeId: number): Promise<number> {
    return db.messages
      .where('[sessionId+sourceMessageId+sourceSwipeId]')
      .equals([this.sessionId, messageId, swipeId])
      .delete()
  }
  
  /**
   * 获取联系人最后一条消息
   */
  async getLastMessage(contactId: ContactId): Promise<Message | undefined> {
    const messages = await db.messages
      .where('[sessionId+contactId]')
      .equals([this.sessionId, contactId])
      .reverse()
      .limit(1)
      .toArray()
    if (messages.length === 0) return undefined
    const { sessionId, sourceMessageId, sourceSwipeId, ...msg } = messages[0]
    return msg as Message
  }
  
  /**
   * 搜索消息
   */
  async search(query: string): Promise<Message[]> {
    const lowerQuery = query.toLowerCase()
    const messages = await db.messages
      .where('sessionId')
      .equals(this.sessionId)
      .filter((m) => {
        if (m.type === 'text' && 'content' in m) {
          return (m as { content: string }).content.toLowerCase().includes(lowerQuery)
        }
        return false
      })
      .toArray()
    return messages.map(({ sessionId, sourceMessageId, sourceSwipeId, ...msg }) => msg as Message)
  }
}

export const messageService = new MessageService()

// ============ 导出 ============

export * from './schema'
export { db }
export type { AppDataRecord }
export { writeQueue, type WriteLockState } from './writeQueue'
