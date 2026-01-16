/**
 * Mock SillyTavern Context
 * 模拟SillyTavern主程序提供的上下文
 */

import type { 
  SillyTavernContext, 
  STChatMessage, 
  EventEmitter, 
  ChatMessage 
} from '@/types/sillytavern'
import { TavernEvents } from '@/types/sillytavern'

interface MockSillyTavernOptions {
  eventEmitter: EventEmitter
  chatMessages?: ChatMessage[]
  characterName?: string
  userName?: string
}

export function createMockSillyTavern(options: MockSillyTavernOptions) {
  const { 
    eventEmitter, 
    chatMessages = [], 
    characterName = '测试角色',
    userName = '玩家'
  } = options

  // 将ChatMessage转换为STChatMessage格式
  const stChat: STChatMessage[] = chatMessages.map(msg => ({
    name: msg.name,
    is_user: msg.role === 'user',
    is_system: msg.role === 'system',
    mes: msg.message,
    extra: msg.extra,
    variables: msg.data,
  }))

  let isGenerating = false

  const context: SillyTavernContext = {
    chat: stChat,
    characters: [],
    groups: [],
    name1: userName,
    name2: characterName,
    characterId: 'mock-character-id',
    groupId: '',
    chatId: 'mock-chat-id',
    
    getCurrentChatId() {
      return 'mock-chat-id'
    },

    eventSource: eventEmitter,
    eventTypes: TavernEvents,

    async generate(opts?: unknown) {
      if (isGenerating) {
        console.warn('[Mock SillyTavern] Generation already in progress')
        return ''
      }

      isGenerating = true
      console.log('[Mock SillyTavern] Starting generation...', opts)
      
      // 触发生成开始事件
      eventEmitter.emit('generation_started', 'normal', opts, false)

      // 模拟生成延迟
      await new Promise(resolve => setTimeout(resolve, 1000))

      const response = generateMockResponse()
      
      // 添加到聊天
      const newMessage: STChatMessage = {
        name: characterName,
        is_user: false,
        is_system: false,
        mes: response,
        extra: {},
      }
      stChat.push(newMessage)

      isGenerating = false

      // 触发生成结束事件
      eventEmitter.emit('generation_ended', stChat.length - 1)
      eventEmitter.emit('message_received', stChat.length - 1)

      return response
    },

    stopGeneration() {
      if (isGenerating) {
        isGenerating = false
        eventEmitter.emit('generation_stopped')
        console.log('[Mock SillyTavern] Generation stopped')
        return true
      }
      return false
    },

    async callGenericPopup(content, type, inputValue, popupOptions) {
      console.log('[Mock SillyTavern] callGenericPopup:', { content, type, inputValue, popupOptions })
      
      // 模拟弹窗
      if (type === 1) {
        // CONFIRM
        return confirm(typeof content === 'string' ? content : 'Confirm?') ? 1 : 0
      } else if (type === 2) {
        // INPUT
        return prompt(typeof content === 'string' ? content : 'Input:', inputValue || '') || undefined
      }
      
      // TEXT/DISPLAY
      alert(typeof content === 'string' ? content : 'Message')
      return 1
    },
  }

  return {
    getContext: () => context,
    
    // 辅助方法：添加消息（用于测试）
    addMessage(message: Partial<STChatMessage> & { mes: string }) {
      const newMessage: STChatMessage = {
        name: message.name || characterName,
        is_user: message.is_user || false,
        is_system: message.is_system || false,
        mes: message.mes,
        extra: message.extra || {},
      }
      stChat.push(newMessage)
      eventEmitter.emit('message_received', stChat.length - 1)
      return stChat.length - 1
    },

    // 辅助方法：更新消息（用于测试）
    updateMessage(index: number, content: string) {
      if (index >= 0 && index < stChat.length) {
        stChat[index].mes = content
        eventEmitter.emit('message_edited', index)
      }
    },

    // 辅助方法：删除消息（用于测试）
    deleteMessage(index: number) {
      if (index >= 0 && index < stChat.length) {
        stChat.splice(index, 1)
        eventEmitter.emit('message_deleted', index)
      }
    },

    // 辅助方法：获取所有消息
    getMessages() {
      return [...stChat]
    },

    // 辅助方法：清空聊天
    clearChat() {
      stChat.length = 0
      eventEmitter.emit('chat_id_changed', 'mock-chat-id')
    },
  }
}

/**
 * 生成模拟的AI响应
 * 包含各种手机模拟器指令用于测试
 */
function generateMockResponse(): string {
  const responses = [
    // 微信聊天消息
    `[app:微信, type:聊天, from:小明]
你好啊！今天天气真不错，要不要一起出去玩？
[/app]`,

    // 朋友圈动态
    `[app:朋友圈, type:动态, from:小红, time:10:30]
今天在公园拍到了超美的日落🌅
[图片:https://example.com/sunset.jpg]
[/app]`,

    // 来电
    `[app:电话, type:来电, from:妈妈]
[/app]`,

    // 邮件
    `[app:邮件, type:新邮件, from:公司HR, subject:关于下周的会议安排]
尊敬的员工：

请注意下周一上午10点在3号会议室召开全体员工会议，请准时参加。

此致
敬礼

人力资源部
[/app]`,

    // 论坛帖子
    `[app:论坛, type:新帖, board:校园生活, from:学长学姐]
期末考试复习技巧分享

大家好！期末考试临近，分享一些我的复习经验...
1. 制定合理的复习计划
2. 多做历年真题
3. 保持充足睡眠

祝大家考试顺利！
[/app]`,

    // 普通聊天回复
    `好的，我知道了。那我们明天见吧！`,

    // 多条消息
    `[app:微信, type:聊天, from:小李]
刚才忘了说，明天的聚会改到7点了
[/app]

[app:微信, type:聊天, from:小王]
收到！我会准时到的
[/app]`,
  ]

  return responses[Math.floor(Math.random() * responses.length)]
}