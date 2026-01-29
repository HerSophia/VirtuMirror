/**
 * 可见性快捷构造器
 * @module services/contextSharing/Visibility
 */

import type { ContextVisibility } from './types';

/**
 * 可见性快捷方法
 *
 * @example
 * ```typescript
 * // 公开给所有 App
 * contextSharingService.publish({
 *   visibility: Visibility.PUBLIC,
 *   // ...
 * });
 *
 * // 仅发布者可访问
 * contextSharingService.publish({
 *   visibility: Visibility.PRIVATE,
 *   // ...
 * });
 *
 * // 仅指定 App 可访问
 * contextSharingService.publish({
 *   visibility: Visibility.only('weibo', 'bilibili'),
 *   // ...
 * });
 *
 * // 排除指定 App
 * contextSharingService.publish({
 *   visibility: Visibility.except('admin'),
 *   // ...
 * });
 * ```
 */
export const Visibility = {
  /** 所有 App 可访问 */
  PUBLIC: { level: 'public' } as ContextVisibility,

  /** 仅发布者可访问 */
  PRIVATE: { level: 'private' } as ContextVisibility,

  /**
   * 指定 App 可访问
   * @param appIds 允许访问的 App ID 列表
   */
  only: (...appIds: string[]): ContextVisibility => ({
    level: 'restricted',
    allowedApps: appIds,
  }),

  /**
   * 排除指定 App
   * @param appIds 要排除的 App ID 列表
   */
  except: (...appIds: string[]): ContextVisibility => ({
    level: 'public',
    excludedApps: appIds,
  }),
} as const;
