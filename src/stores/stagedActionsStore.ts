/**
 * 暂存操作管理Store
 * 管理用户操作的暂存和提交
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { StagedAction, StagedActionType, UniqueId } from '@/types'
import { PLAYER_ID } from '@/types'

export const useStagedActionsStore = defineStore('stagedActions', () => {
  // ==================== 状态 ====================
  
  /** 暂存的操作列表 */
  const actions = ref<StagedAction[]>([])
  
  // ==================== 计算属性 ====================
  
  /** 暂存操作数量 */
  const count = computed(() => actions.value.length)
  
  /** 是否有暂存操作 */
  const hasActions = computed(() => actions.value.length > 0)
  
  // ==================== 操作 ====================
  
  /** 生成唯一ID */
  function generateId(): UniqueId {
    return `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
  
  /** 添加暂存操作 */
  function stageAction(type: StagedActionType, data: Record<string, unknown>) {
    const action: StagedAction = {
      id: generateId(),
      type,
      data,
      timestamp: Date.now(),
    }
    actions.value.push(action)
    return action
  }
  
  /** 暂存发送消息操作 */
  function stageSendMessage(contactId: string, content: string, replyTo?: string) {
    return stageAction('send_message', {
      contactId,
      content,
      replyTo,
      senderId: PLAYER_ID,
    })
  }
  
  /** 暂存点赞朋友圈操作 */
  function stageLikeMoment(momentId: string, authorId: string) {
    return stageAction('like_moment', {
      momentId,
      authorId,
    })
  }
  
  /** 暂存评论朋友圈操作 */
  function stageCommentMoment(momentId: string, authorId: string, content: string, replyTo?: string) {
    return stageAction('comment_moment', {
      momentId,
      authorId,
      content,
      replyTo,
    })
  }
  
  /** 暂存接受好友请求操作 */
  function stageAcceptFriend(requestId: string, contactId: string) {
    return stageAction('accept_friend', {
      requestId,
      contactId,
    })
  }
  
  /** 暂存拒绝好友请求操作 */
  function stageRejectFriend(requestId: string, contactId: string) {
    return stageAction('reject_friend', {
      requestId,
      contactId,
    })
  }
  
  /** 暂存接听电话操作 */
  function stageAcceptCall(contactId: string) {
    return stageAction('accept_call', {
      contactId,
    })
  }
  
  /** 暂存拒绝电话操作 */
  function stageRejectCall(contactId: string) {
    return stageAction('reject_call', {
      contactId,
    })
  }
  
  /** 暂存结束通话操作 */
  function stageEndCall(contactId: string, duration: number) {
    return stageAction('end_call', {
      contactId,
      duration,
    })
  }
  
  /** 暂存通话中发言操作 */
  function stageCallSpeak(contactId: string, content: string) {
    return stageAction('call_speak', {
      contactId,
      content,
    })
  }
  
  /** 暂存论坛发帖操作 */
  function stageForumPost(boardId: string, title: string, content: string) {
    return stageAction('forum_post', {
      boardId,
      title,
      content,
    })
  }
  
  /** 暂存论坛回复操作 */
  function stageForumReply(postId: string, content: string, replyTo?: string) {
    return stageAction('forum_reply', {
      postId,
      content,
      replyTo,
    })
  }
  
  /** 暂存发送弹幕操作 */
  function stageSendDanmaku(streamId: string, content: string) {
    return stageAction('send_danmaku', {
      streamId,
      content,
    })
  }
  
  /** 暂存浏览器搜索操作 */
  function stageBrowserSearch(query: string) {
    return stageAction('browser_search', {
      query,
    })
  }
  
  /** 移除暂存操作 */
  function removeAction(actionId: UniqueId) {
    const index = actions.value.findIndex((a: StagedAction) => a.id === actionId)
    if (index !== -1) {
      actions.value.splice(index, 1)
    }
  }
  
  /** 清空所有暂存操作 */
  function clearActions() {
    actions.value = []
  }
  
  /** 格式化操作为提交文本 */
  function formatActionsForSubmit(): string {
    return actions.value.map((action: StagedAction) => {
      const { type, data } = action
      
      switch (type) {
        case 'send_message':
          return `[玩家在微信给${data.contactId}发送消息]: ${data.content}`
        
        case 'like_moment':
          return `[玩家点赞了${data.authorId}的朋友圈]`
        
        case 'comment_moment':
          if (data.replyTo) {
            return `[玩家在${data.authorId}的朋友圈回复了${data.replyTo}]: ${data.content}`
          }
          return `[玩家评论了${data.authorId}的朋友圈]: ${data.content}`
        
        case 'accept_friend':
          return `[玩家接受了${data.contactId}的好友请求]`
        
        case 'reject_friend':
          return `[玩家拒绝了${data.contactId}的好友请求]`
        
        case 'accept_call':
          return `[玩家接听了${data.contactId}的来电]`
        
        case 'reject_call':
          return `[玩家拒绝了${data.contactId}的来电]`
        
        case 'end_call':
          return `[玩家结束了与${data.contactId}的通话，时长${data.duration}秒]`
        
        case 'call_speak':
          return `[玩家在与${data.contactId}的通话中说]: ${data.content}`
        
        case 'forum_post':
          return `[玩家在论坛${data.boardId}板块发帖]\n标题: ${data.title}\n内容: ${data.content}`
        
        case 'forum_reply':
          return `[玩家在论坛帖子${data.postId}回复]: ${data.content}`
        
        case 'send_danmaku':
          return `[玩家在直播间${data.streamId}发送弹幕]: ${data.content}`
        
        case 'browser_search':
          return `[玩家在浏览器搜索]: ${data.query}`
        
        default:
          return `[玩家执行了${type}操作]`
      }
    }).join('\n\n')
  }
  
  /** 提交暂存操作 */
  async function commitActions(): Promise<string> {
    if (actions.value.length === 0) {
      return ''
    }
    
    const formatted = formatActionsForSubmit()
    
    // 注入到SillyTavern输入框或发送
    const textarea = document.querySelector('#send_textarea') as HTMLTextAreaElement
    if (textarea) {
      // 追加到现有内容
      const existingContent = textarea.value.trim()
      textarea.value = existingContent 
        ? `${existingContent}\n\n${formatted}`
        : formatted
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
    }
    
    // 清空暂存
    clearActions()
    
    return formatted
  }
  
  return {
    // 状态
    actions,
    
    // 计算属性
    count,
    hasActions,
    
    // 操作
    stageAction,
    stageSendMessage,
    stageLikeMoment,
    stageCommentMoment,
    stageAcceptFriend,
    stageRejectFriend,
    stageAcceptCall,
    stageRejectCall,
    stageEndCall,
    stageCallSpeak,
    stageForumPost,
    stageForumReply,
    stageSendDanmaku,
    stageBrowserSearch,
    removeAction,
    clearActions,
    formatActionsForSubmit,
    commitActions,
  }
})