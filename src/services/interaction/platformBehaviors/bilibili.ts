/**
 * B站平台扩展行为
 */

import type { PlatformBehavior } from '@/types/interaction'
import { interactionService } from '../InteractionService'
import { loggerService } from '@/services/logger'

const logger = loggerService.child('interaction:bilibili')

/**
 * B站特有行为：投币
 */
export const coin: PlatformBehavior = {
  platformId: 'bilibili',
  name: '投币',
  action: 'coin',
  description: '给视频投币（1-2个）',
  execute: async (contentId: string, userId: string, params?: Record<string, unknown>) => {
    const count = (params?.count as number) ?? 1
    const clampedCount = Math.min(2, Math.max(1, count))
    logger.info(`用户 ${userId} 给视频 ${contentId} 投了 ${clampedCount} 个币`)
    // 实际实现中这里会调用 B站 API
  },
}

/**
 * B站特有行为：一键三连
 * 同时点赞、投币、收藏
 */
export const tripleAction: PlatformBehavior = {
  platformId: 'bilibili',
  name: '一键三连',
  action: 'tripleAction',
  description: '同时点赞、投币、收藏',
  execute: async (contentId: string, userId: string, _params?: Record<string, unknown>) => {
    logger.info(`用户 ${userId} 对视频 ${contentId} 一键三连`)
    
    const options = { platformId: 'bilibili' as const }
    
    // 执行三连操作
    await Promise.all([
      interactionService.like(contentId, userId, options),
      interactionService.favorite(contentId, userId, undefined, options),
      // 投币
      interactionService.executePlatformBehavior('bilibili', 'coin', contentId, userId, { count: 2 }),
    ])
    
    logger.info(`用户 ${userId} 完成一键三连`)
  },
}

/**
 * B站特有行为：发送弹幕
 */
export const danmaku: PlatformBehavior = {
  platformId: 'bilibili',
  name: '发送弹幕',
  action: 'danmaku',
  description: '在视频上发送弹幕',
  execute: async (contentId: string, userId: string, params?: Record<string, unknown>) => {
    const text = params?.text as string | undefined
    const time = params?.time as number | undefined // 弹幕出现的时间点
    const color = params?.color as string | undefined
    const position = params?.position as 'top' | 'bottom' | 'scroll' | undefined
    
    logger.info(`用户 ${userId} 在视频 ${contentId} 发送弹幕`, {
      text,
      time,
      color,
      position,
    })
    // 实际实现中这里会处理弹幕发送逻辑
  },
}

/**
 * B站特有行为：充电
 */
export const charge: PlatformBehavior = {
  platformId: 'bilibili',
  name: '充电',
  action: 'charge',
  description: '给UP主充电',
  execute: async (contentId: string, userId: string, params?: Record<string, unknown>) => {
    const amount = params?.amount as number | undefined
    const upId = params?.upId as string | undefined
    
    logger.info(`用户 ${userId} 给UP主充电`, {
      contentId,
      upId,
      amount,
    })
    // 实际实现中这里会处理充电逻辑
  },
}

/**
 * B站特有行为：关注番剧
 */
export const followBangumi: PlatformBehavior = {
  platformId: 'bilibili',
  name: '追番',
  action: 'followBangumi',
  description: '追番/追剧',
  execute: async (contentId: string, userId: string, _params?: Record<string, unknown>) => {
    logger.info(`用户 ${userId} 追番 ${contentId}`)
    // 实际实现中这里会处理追番逻辑
  },
}

/**
 * 注册所有 B站 扩展行为
 */
export function registerBilibiliBehaviors(): void {
  interactionService.registerPlatformBehavior(coin)
  interactionService.registerPlatformBehavior(tripleAction)
  interactionService.registerPlatformBehavior(danmaku)
  interactionService.registerPlatformBehavior(charge)
  interactionService.registerPlatformBehavior(followBangumi)
  
  logger.info('B站平台扩展行为已注册')
}

export const bilibiliBehaviors = [
  coin,
  tripleAction,
  danmaku,
  charge,
  followBangumi,
]
