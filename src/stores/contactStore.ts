/**
 * 联系人管理Store
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Contact, ContactDirectory, ContactId } from '@/types'
import { PLAYER_ID } from '@/types'

export const useContactStore = defineStore('contact', () => {
  // ==================== 状态 ====================
  
  /** 联系人目录 */
  const contacts = ref<ContactDirectory>({})
  
  /** 头像缓存 */
  const avatarCache = ref<Record<ContactId, string>>({})
  
  // ==================== 计算属性 ====================
  
  /** 所有联系人列表（不含玩家） */
  const contactList = computed(() => 
    Object.values(contacts.value).filter((c: Contact) => c.id !== PLAYER_ID)
  )
  
  /** 私聊联系人列表 */
  const privateContacts = computed(() =>
    contactList.value.filter((c: Contact) => c.type === 'private')
  )
  
  /** 群聊列表 */
  const groupContacts = computed(() =>
    contactList.value.filter((c: Contact) => c.type === 'group')
  )
  
  /** 按字母排序的联系人 */
  const sortedContacts = computed(() =>
    [...contactList.value].sort((a: Contact, b: Contact) => a.name.localeCompare(b.name, 'zh-CN'))
  )
  
  /** 总未读数 */
  const totalUnreadCount = computed(() =>
    contactList.value.reduce((sum: number, c: Contact) => sum + (c.unreadCount || 0), 0)
  )
  
  // ==================== 操作 ====================
  
  /** 设置联系人目录（替换全部） */
  function setContacts(newContacts: ContactDirectory) {
    contacts.value = newContacts
  }
  
  /** 添加或更新联系人 */
  function upsertContact(contact: Contact) {
    contacts.value[contact.id] = {
      ...contacts.value[contact.id],
      ...contact,
    }
  }
  
  /** 批量更新联系人 */
  function upsertContacts(contactsToUpdate: Contact[]) {
    contactsToUpdate.forEach(contact => upsertContact(contact))
  }
  
  /** 删除联系人 */
  function removeContact(contactId: ContactId) {
    delete contacts.value[contactId]
  }
  
  /** 获取联系人 */
  function getContact(contactId: ContactId): Contact | undefined {
    return contacts.value[contactId]
  }
  
  /** 获取联系人显示名称 */
  function getContactName(contactId: ContactId): string {
    const contact = contacts.value[contactId]
    if (!contact) return contactId
    return contact.remark || contact.name
  }
  
  /** 获取联系人头像 */
  function getContactAvatar(contactId: ContactId): string {
    // 先检查缓存
    if (avatarCache.value[contactId]) {
      return avatarCache.value[contactId]
    }
    
    const contact = contacts.value[contactId]
    if (contact?.avatar) {
      return contact.avatar
    }
    
    // 返回默认头像
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(contactId)}`
  }
  
  /** 设置联系人头像 */
  function setContactAvatar(contactId: ContactId, avatar: string) {
    if (contacts.value[contactId]) {
      contacts.value[contactId].avatar = avatar
    }
    avatarCache.value[contactId] = avatar
  }
  
  /** 更新未读数 */
  function updateUnreadCount(contactId: ContactId, count: number) {
    if (contacts.value[contactId]) {
      contacts.value[contactId].unreadCount = count
    }
  }
  
  /** 增加未读数 */
  function incrementUnreadCount(contactId: ContactId) {
    if (contacts.value[contactId]) {
      contacts.value[contactId].unreadCount = (contacts.value[contactId].unreadCount || 0) + 1
    }
  }
  
  /** 清除未读数 */
  function clearUnreadCount(contactId: ContactId) {
    if (contacts.value[contactId]) {
      contacts.value[contactId].unreadCount = 0
    }
  }
  
  /** 更新最后消息时间 */
  function updateLastMessageTime(contactId: ContactId, timestamp?: number) {
    if (contacts.value[contactId]) {
      contacts.value[contactId].lastMessageTime = timestamp || Date.now()
    }
  }
  
  /** 更新在线状态 */
  function updateOnlineStatus(contactId: ContactId, online: boolean) {
    if (contacts.value[contactId]) {
      contacts.value[contactId].online = online
    }
  }
  
  /** 添加群成员 */
  function addGroupMember(groupId: ContactId, memberId: ContactId) {
    const group = contacts.value[groupId]
    if (group && group.type === 'group') {
      if (!group.members) {
        group.members = []
      }
      if (!group.members.includes(memberId)) {
        group.members.push(memberId)
      }
    }
  }
  
  /** 移除群成员 */
  function removeGroupMember(groupId: ContactId, memberId: ContactId) {
    const group = contacts.value[groupId]
    if (group && group.type === 'group' && group.members) {
      const index = group.members.indexOf(memberId)
      if (index !== -1) {
        group.members.splice(index, 1)
      }
    }
  }
  
  /** 获取群成员列表 */
  function getGroupMembers(groupId: ContactId): Contact[] {
    const group = contacts.value[groupId]
    if (!group || group.type !== 'group' || !group.members) {
      return []
    }
    return group.members
      .map(id => contacts.value[id])
      .filter(Boolean) as Contact[]
  }
  
  /** 检查是否是群聊 */
  function isGroup(contactId: ContactId): boolean {
    return contacts.value[contactId]?.type === 'group'
  }
  
  /** 清空所有联系人 */
  function clearAll() {
    contacts.value = {}
    avatarCache.value = {}
  }
  
  return {
    // 状态
    contacts,
    avatarCache,
    
    // 计算属性
    contactList,
    privateContacts,
    groupContacts,
    sortedContacts,
    totalUnreadCount,
    
    // 操作
    setContacts,
    upsertContact,
    upsertContacts,
    removeContact,
    getContact,
    getContactName,
    getContactAvatar,
    setContactAvatar,
    updateUnreadCount,
    incrementUnreadCount,
    clearUnreadCount,
    updateLastMessageTime,
    updateOnlineStatus,
    addGroupMember,
    removeGroupMember,
    getGroupMembers,
    isGroup,
    clearAll,
  }
}, {
  persist: {
    key: 'phone-sim-contacts',
  },
})