/**
 * Mock TavernHelper API
 * 模拟酒馆助手提供的API接口
 */

import type { TavernHelperAPI, ChatMessage, WorldbookEntry } from '@/types/sillytavern'

interface MockTavernHelperOptions {
  initialChatMessages?: ChatMessage[]
  initialWorldbooks?: Record<string, WorldbookEntry[]>
  initialVariables?: Record<string, unknown>
}

export function createMockTavernHelper(options: MockTavernHelperOptions = {}): TavernHelperAPI {
  // 内部状态
  let chatMessages: ChatMessage[] = options.initialChatMessages || []
  const worldbooks: Record<string, WorldbookEntry[]> = options.initialWorldbooks || {}
  let variables: Record<string, unknown> = options.initialVariables || {}
  let nextMessageId = chatMessages.length

  const api: TavernHelperAPI = {
    // ==================== 聊天消息 ====================
    
    getChatMessages(range, opts = {}) {
      const { role = 'all', hide_state = 'all' } = opts
      
      let result: ChatMessage[] = []
      
      // 解析范围
      if (typeof range === 'number') {
        // 单个消息ID或负数索引
        const index = range < 0 ? chatMessages.length + range : range
        if (index >= 0 && index < chatMessages.length) {
          result = [chatMessages[index]]
        }
      } else if (typeof range === 'string') {
        // 范围字符串 "0-10" 或单个 "5"
        const rangeMatch = range.match(/^(\d+)-(\d+)$/)
        if (rangeMatch) {
          const start = parseInt(rangeMatch[1], 10)
          const end = parseInt(rangeMatch[2], 10)
          result = chatMessages.slice(start, end + 1)
        } else {
          const index = parseInt(range, 10)
          if (!isNaN(index) && index >= 0 && index < chatMessages.length) {
            result = [chatMessages[index]]
          }
        }
      }
      
      // 按角色过滤
      if (role !== 'all') {
        result = result.filter(msg => msg.role === role)
      }
      
      // 按隐藏状态过滤
      if (hide_state !== 'all') {
        result = result.filter(msg => 
          hide_state === 'hidden' ? msg.is_hidden : !msg.is_hidden
        )
      }
      
      return result
    },

    async setChatMessages(messages, opts = {}) {
      const { refresh = 'affected' } = opts
      
      for (const update of messages) {
        const index = chatMessages.findIndex(m => m.message_id === update.message_id)
        if (index !== -1) {
          chatMessages[index] = { ...chatMessages[index], ...update }
        }
      }
      
      console.log(`[Mock TavernHelper] setChatMessages: Updated ${messages.length} messages, refresh: ${refresh}`)
    },

    async createChatMessages(messages, opts = {}) {
      const { insert_at = 'end' } = opts
      
      const newMessages: ChatMessage[] = messages.map((msg, i) => ({
        message_id: nextMessageId + i,
        name: msg.name || (msg.role === 'user' ? '玩家' : 'AI'),
        role: msg.role,
        is_hidden: msg.is_hidden || false,
        message: msg.message,
        data: msg.data || {},
        extra: msg.extra || {},
      }))
      
      if (insert_at === 'end') {
        chatMessages.push(...newMessages)
      } else {
        chatMessages.splice(insert_at, 0, ...newMessages)
        // 重新计算message_id
        chatMessages.forEach((msg, i) => {
          msg.message_id = i
        })
      }
      
      nextMessageId = chatMessages.length
      console.log(`[Mock TavernHelper] createChatMessages: Created ${messages.length} messages`)
    },

    async deleteChatMessages(messageIds, opts = {}) {
      chatMessages = chatMessages.filter(msg => !messageIds.includes(msg.message_id))
      // 重新计算message_id
      chatMessages.forEach((msg, i) => {
        msg.message_id = i
      })
      nextMessageId = chatMessages.length
      console.log(`[Mock TavernHelper] deleteChatMessages: Deleted ${messageIds.length} messages`)
    },

    getLastMessageId() {
      return chatMessages.length - 1
    },

    // ==================== 世界书 ====================

    getWorldbookNames() {
      return Object.keys(worldbooks)
    },

    async getWorldbook(name) {
      const wb = worldbooks[name]
      if (!wb) {
        throw new Error(`Worldbook "${name}" not found`)
      }
      return [...wb]
    },

    async createWorldbook(name, entries = []) {
      if (worldbooks[name]) {
        return false
      }
      worldbooks[name] = entries.map((entry, i) => ({
        ...getDefaultWorldbookEntry(),
        ...entry,
        uid: i,
      }))
      console.log(`[Mock TavernHelper] createWorldbook: Created "${name}"`)
      return true
    },

    async replaceWorldbook(name, entries) {
      if (!worldbooks[name]) {
        throw new Error(`Worldbook "${name}" not found`)
      }
      worldbooks[name] = entries.map((entry, i) => ({
        ...getDefaultWorldbookEntry(),
        ...entry,
        uid: i,
      })) as WorldbookEntry[]
      console.log(`[Mock TavernHelper] replaceWorldbook: Replaced "${name}"`)
    },

    async updateWorldbookWith(name, updater) {
      if (!worldbooks[name]) {
        throw new Error(`Worldbook "${name}" not found`)
      }
      const updated = updater(worldbooks[name])
      worldbooks[name] = updated.map((entry, i) => ({
        ...getDefaultWorldbookEntry(),
        ...entry,
        uid: i,
      })) as WorldbookEntry[]
      console.log(`[Mock TavernHelper] updateWorldbookWith: Updated "${name}"`)
      return worldbooks[name]
    },

    async createWorldbookEntries(name, entries) {
      if (!worldbooks[name]) {
        throw new Error(`Worldbook "${name}" not found`)
      }
      const startUid = worldbooks[name].length
      const newEntries = entries.map((entry, i) => ({
        ...getDefaultWorldbookEntry(),
        ...entry,
        uid: startUid + i,
      })) as WorldbookEntry[]
      worldbooks[name].push(...newEntries)
      console.log(`[Mock TavernHelper] createWorldbookEntries: Created ${entries.length} entries in "${name}"`)
      return { worldbook: worldbooks[name], new_entries: newEntries }
    },

    async deleteWorldbookEntries(name, predicate) {
      if (!worldbooks[name]) {
        throw new Error(`Worldbook "${name}" not found`)
      }
      const deleted: WorldbookEntry[] = []
      worldbooks[name] = worldbooks[name].filter(entry => {
        if (predicate(entry)) {
          deleted.push(entry)
          return false
        }
        return true
      })
      // 重新分配uid
      worldbooks[name].forEach((entry, i) => {
        entry.uid = i
      })
      console.log(`[Mock TavernHelper] deleteWorldbookEntries: Deleted ${deleted.length} entries from "${name}"`)
      return { worldbook: worldbooks[name], deleted_entries: deleted }
    },

    async getOrCreateChatWorldbook(chatName, worldbookName) {
      const name = worldbookName || `chat_${Date.now()}`
      if (!worldbooks[name]) {
        worldbooks[name] = []
      }
      return name
    },

    // ==================== 变量 ====================

    getVariables() {
      return { ...variables }
    },

    async insertOrAssignVariables(newVars) {
      variables = { ...variables, ...newVars }
      console.log(`[Mock TavernHelper] insertOrAssignVariables:`, newVars)
    },

    async deleteVariable(key) {
      delete variables[key]
      console.log(`[Mock TavernHelper] deleteVariable: ${key}`)
    },

    // ==================== 生成 ====================

    async generate(opts = {}) {
      console.log(`[Mock TavernHelper] generate:`, opts)
      // 模拟生成延迟
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // 返回模拟的AI响应
      return `[Mock Generated Response at ${new Date().toLocaleTimeString()}]
这是一个模拟的AI响应。在开发模式下，你可以在这里测试各种功能。

[app:微信, type:聊天, from:测试联系人]
你好！这是一条测试消息。
[/app]`
    },

    // ==================== 版本 ====================

    getTavernHelperVersion() {
      return '1.0.0-mock'
    },

    getTavernVersion() {
      return '1.12.0-mock'
    },
  }

  return api
}

/**
 * 获取默认的世界书条目
 */
function getDefaultWorldbookEntry(): WorldbookEntry {
  return {
    uid: 0,
    name: '',
    enabled: true,
    strategy: {
      type: 'constant',
      keys: [],
      keys_secondary: { logic: 'and_any', keys: [] },
      scan_depth: 'same_as_global',
    },
    position: {
      type: 'after_character_definition',
      role: 'system',
      depth: 4,
      order: 100,
    },
    content: '',
    probability: 100,
    recursion: {
      prevent_incoming: false,
      prevent_outgoing: false,
      delay_until: null,
    },
    effect: {
      sticky: null,
      cooldown: null,
      delay: null,
    },
  }
}

/**
 * 用于测试的辅助函数
 */
export function createMockChatMessage(
  id: number,
  role: 'user' | 'assistant' | 'system',
  message: string,
  name?: string
): ChatMessage {
  return {
    message_id: id,
    name: name || (role === 'user' ? '玩家' : 'AI'),
    role,
    is_hidden: false,
    message,
    data: {},
    extra: {},
  }
}