/**
 * 平台扩展行为模块入口
 *
 * @example
 * ```typescript
 * import { registerAllPlatformBehaviors } from '@/services/interaction/platformBehaviors'
 *
 * // 注册所有平台扩展行为
 * registerAllPlatformBehaviors()
 *
 * // 或者单独注册某个平台的行为
 * import { registerWeiboBehaviors } from '@/services/interaction/platformBehaviors'
 * registerWeiboBehaviors()
 * ```
 */

import { registerWeiboBehaviors, weiboBehaviors } from './weibo'
import { registerBilibiliBehaviors, bilibiliBehaviors } from './bilibili'
import { registerZhihuBehaviors, zhihuBehaviors } from './zhihu'
import { loggerService } from '@/services/logger'

const logger = loggerService.child('interaction:platformBehaviors')

// 导出各平台的注册函数和行为列表
export { registerWeiboBehaviors, weiboBehaviors } from './weibo'
export { registerBilibiliBehaviors, bilibiliBehaviors } from './bilibili'
export { registerZhihuBehaviors, zhihuBehaviors } from './zhihu'

/**
 * 注册所有平台的扩展行为
 */
export function registerAllPlatformBehaviors(): void {
  logger.info('开始注册所有平台扩展行为...')
  
  registerWeiboBehaviors()
  registerBilibiliBehaviors()
  registerZhihuBehaviors()
  
  logger.info('所有平台扩展行为注册完成')
}

/**
 * 所有平台行为列表
 */
export const allPlatformBehaviors = [
  ...weiboBehaviors,
  ...bilibiliBehaviors,
  ...zhihuBehaviors,
]
