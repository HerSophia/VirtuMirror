/**
 * Logger Service 模块导出
 *
 * @example
 * ```typescript
 * import { loggerService } from '@/services/logger'
 *
 * // 创建模块专属日志器
 * const logger = loggerService.child('weibo:store')
 *
 * // 使用日志器
 * logger.debug('Loading posts for topic', { topicId })
 * logger.info('Posts loaded', { count: posts.length })
 * logger.warn('Cache miss, generating content')
 * logger.error('Failed to generate', error)
 *
 * // 性能计时
 * logger.time('generatePosts')
 * await contentFactory.generatePosts(topic, 5)
 * logger.timeEnd('generatePosts')
 *
 * // 分组日志
 * logger.group('执行任务链')
 * logger.info('Step 1: 获取上下文')
 * logger.info('Step 2: 生成内容')
 * logger.groupEnd()
 * ```
 */

export { loggerService, useLoggerService } from './loggerService'
export { Logger, type LoggerContext } from './Logger'
export * from './transports'

// 重新导出类型
export type {
  LoggerService,
  Logger as ILogger,
  LogLevel,
  LogFilter,
  LogEntry,
  LogEntryFormatted,
  LogTransport,
  ConsoleTransportOptions,
  MemoryTransportOptions,
  IndexedDBTransportOptions,
  LogViewer,
  LogQueryOptions,
  LogStats,
  LoggerOptions,
} from '@/types/logger'

export { LOG_LEVEL_VALUES } from '@/types/logger'
