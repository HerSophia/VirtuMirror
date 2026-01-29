/**
 * 微博平台扩展行为
 */

import type { PlatformBehavior } from '@/types/interaction'
import { interactionService } from '../InteractionService'
import { loggerService } from '@/services/logger'

const logger = loggerService.child('interaction:weibo')

/**
 * 微博特有行为：超话签到
 */
export const superTopicCheckIn: PlatformBehavior = {
  platformId: 'weibo',
  name: '超话签到',
  action: 'superTopicCheckIn',
  description: '在超话社区进行每日签到',
  execute: async (contentId: string, userId: string, params?: Record<string, unknown>) => {
    logger.info(`用户 ${userId} 在超话 ${contentId} 签到`, params)
    // 实际实现中这里会调用微博 API
    // 目前仅作为示例
  },
}

/**
 * 微博特有行为：打赏
 */
export const reward: PlatformBehavior = {
  platformId: 'weibo',
  name: '打赏',
  action: 'reward',
  description: '对内容进行打赏',
  execute: async (contentId: string, userId: string, params?: Record<string, unknown>) => {
    const amount = params?.amount as number | undefined
    logger.info(`用户 ${userId} 打赏内容 ${contentId}`, { amount })
    // 实际实现中这里会处理打赏逻辑
  },
}

/**
 * 微博特有行为：举报
 */
export const report: PlatformBehavior = {
  platformId: 'weibo',
  name: '举报',
  action: 'report',
  description: '举报违规内容',
  execute: async (contentId: string, userId: string, params?: Record<string, unknown>) => {
    const reason = params?.reason as string | undefined
    logger.info(`用户 ${userId} 举报内容 ${contentId}`, { reason })
    // 实际实现中这里会处理举报逻辑
  },
}

/**
 * 微博特有行为：快转（不带评论的转发）
 */
export const quickRepost: PlatformBehavior = {
  platformId: 'weibo',
  name: '快转',
  action: 'quickRepost',
  description: '快速转发，不带评论',
  execute: async (contentId: string, userId: string, _params?: Record<string, unknown>) => {
    logger.info(`用户 ${userId} 快转内容 ${contentId}`)
    // 调用标准转发，不带评论
    await interactionService.repost(contentId, userId, undefined, { platformId: 'weibo' })
  },
}

/**
 * 注册所有微博扩展行为
 */
export function registerWeiboBehaviors(): void {
  interactionService.registerPlatformBehavior(superTopicCheckIn)
  interactionService.registerPlatformBehavior(reward)
  interactionService.registerPlatformBehavior(report)
  interactionService.registerPlatformBehavior(quickRepost)
  
  logger.info('微博平台扩展行为已注册')
}

export const weiboBehaviors = [
  superTopicCheckIn,
  reward,
  report,
  quickRepost,
]
