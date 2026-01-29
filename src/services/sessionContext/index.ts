/**
 * 会话上下文服务模块导出
 *
 * @example
 * ```typescript
 * // 1. 初始化（应用启动时）
 * import { initSessionContextListeners } from '@/services/sessionContext'
 * import { useAdapter } from '@/composables/useAdapter'
 *
 * onMounted(() => {
 *   const adapter = useAdapter()
 *   initSessionContextListeners(adapter)
 * })
 *
 * // 2. 写入数据时附加来源
 * import { sessionContextService } from '@/services/sessionContext'
 *
 * async function savePost(postData: PostInput) {
 *   const source = sessionContextService.getCurrentSourceTracking()
 *   const post = {
 *     id: generateId(),
 *     ...postData,
 *     source, // 附加来源
 *   }
 *   await db.posts.add(post)
 * }
 *
 * // 3. 读取数据时过滤
 * async function loadPosts() {
 *   const filter = sessionContextService.buildSourceFilter('session')
 *   const posts = await db.posts
 *     .where('platformId').equals('myapp')
 *     .filter(filter)
 *     .toArray()
 *   return posts
 * }
 *
 * // 4. 在组件中使用
 * const context = sessionContextService.context
 * const isConnected = sessionContextService.isConnected
 * ```
 */

// 导出服务实例
export { sessionContextService, SessionContextService } from './SessionContextService'

// 导出初始化函数
export { initSessionContextListeners, cleanupListeners } from './initListeners'

// 重新导出类型
export type {
  SessionContext,
  SessionContextState,
  EmptySessionContext,
  ContentSourceTracking,
  TrackedContent,
  FilterMode,
  FilterConfig,
  SourceFilter,
  ISessionContextService,
  SessionContextChangedEvent,
} from '@/types/sessionContext'

export { createEmptyContext, DEFAULT_FILTER_CONFIG } from '@/types/sessionContext'
