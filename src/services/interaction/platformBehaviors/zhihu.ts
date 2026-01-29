/**
 * 知乎平台扩展行为
 */

import type { PlatformBehavior } from '@/types/interaction'
import { interactionService } from '../InteractionService'
import { loggerService } from '@/services/logger'

const logger = loggerService.child('interaction:zhihu')

/**
 * 知乎特有行为：赞同
 * 知乎的「赞同」与普通点赞语义不同，表示认同答案的观点
 */
export const agree: PlatformBehavior = {
  platformId: 'zhihu',
  name: '赞同',
  action: 'agree',
  description: '赞同这个回答',
  execute: async (contentId: string, userId: string, _params?: Record<string, unknown>) => {
    logger.info(`用户 ${userId} 赞同回答 ${contentId}`)
    // 赞同在知乎上等同于点赞
    await interactionService.like(contentId, userId, { platformId: 'zhihu' })
  },
}

/**
 * 知乎特有行为：反对
 * 知乎特有的「反对」功能
 */
export const disagree: PlatformBehavior = {
  platformId: 'zhihu',
  name: '反对',
  action: 'disagree',
  description: '反对这个回答',
  execute: async (contentId: string, userId: string, _params?: Record<string, unknown>) => {
    logger.info(`用户 ${userId} 反对回答 ${contentId}`)
    // 实际实现中这里会处理反对逻辑
  },
}

/**
 * 知乎特有行为：没有帮助
 */
export const notHelpful: PlatformBehavior = {
  platformId: 'zhihu',
  name: '没有帮助',
  action: 'notHelpful',
  description: '标记回答没有帮助',
  execute: async (contentId: string, userId: string, _params?: Record<string, unknown>) => {
    logger.info(`用户 ${userId} 标记回答 ${contentId} 没有帮助`)
    // 实际实现中这里会处理没有帮助逻辑
  },
}

/**
 * 知乎特有行为：感谢
 */
export const thank: PlatformBehavior = {
  platformId: 'zhihu',
  name: '感谢',
  action: 'thank',
  description: '感谢作者的回答',
  execute: async (contentId: string, userId: string, _params?: Record<string, unknown>) => {
    logger.info(`用户 ${userId} 感谢回答 ${contentId} 的作者`)
    // 实际实现中这里会处理感谢逻辑
  },
}

/**
 * 知乎特有行为：邀请回答
 */
export const inviteAnswer: PlatformBehavior = {
  platformId: 'zhihu',
  name: '邀请回答',
  action: 'inviteAnswer',
  description: '邀请用户回答问题',
  execute: async (contentId: string, userId: string, params?: Record<string, unknown>) => {
    const inviteeId = params?.inviteeId as string | undefined
    logger.info(`用户 ${userId} 邀请 ${inviteeId} 回答问题 ${contentId}`)
    // 实际实现中这里会处理邀请回答逻辑
  },
}

/**
 * 知乎特有行为：关注问题
 */
export const followQuestion: PlatformBehavior = {
  platformId: 'zhihu',
  name: '关注问题',
  action: 'followQuestion',
  description: '关注问题以获取更新',
  execute: async (contentId: string, userId: string, _params?: Record<string, unknown>) => {
    logger.info(`用户 ${userId} 关注问题 ${contentId}`)
    // 收藏问题
    await interactionService.favorite(contentId, userId, undefined, { 
      platformId: 'zhihu',
      contentType: 'article',
    })
  },
}

/**
 * 知乎特有行为：写回答
 */
export const writeAnswer: PlatformBehavior = {
  platformId: 'zhihu',
  name: '写回答',
  action: 'writeAnswer',
  description: '为问题写一个回答',
  execute: async (contentId: string, userId: string, params?: Record<string, unknown>) => {
    const answerContent = params?.content as string | undefined
    logger.info(`用户 ${userId} 为问题 ${contentId} 写回答`, {
      contentLength: answerContent?.length,
    })
    // 实际实现中这里会处理写回答逻辑
  },
}

/**
 * 注册所有知乎扩展行为
 */
export function registerZhihuBehaviors(): void {
  interactionService.registerPlatformBehavior(agree)
  interactionService.registerPlatformBehavior(disagree)
  interactionService.registerPlatformBehavior(notHelpful)
  interactionService.registerPlatformBehavior(thank)
  interactionService.registerPlatformBehavior(inviteAnswer)
  interactionService.registerPlatformBehavior(followQuestion)
  interactionService.registerPlatformBehavior(writeAnswer)
  
  logger.info('知乎平台扩展行为已注册')
}

export const zhihuBehaviors = [
  agree,
  disagree,
  notHelpful,
  thank,
  inviteAnswer,
  followQuestion,
  writeAnswer,
]
