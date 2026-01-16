/**
 * Home App 导出入口
 * 
 * 架构说明：
 * - 桌面本身就是一个 App，只是它比较特殊，是整个系统的入口
 * - 开发和维护方式与其他 App 保持一致
 * 
 * 目录结构：
 * - components/  共享组件（AppGrid, DockBar, AppBlock）
 * - composables/ 组合式函数（useIconPosition）
 * - types.ts     类型定义
 */

// 主应用组件
export { default as HomeApp } from './HomeApp.vue'

// 向后兼容：保留 HomeScreen 别名
export { default as HomeScreen } from './HomeApp.vue'

// 组件导出
export { AppBlock, AppGrid, DockBar } from './components'

// Composables 导出
export { useIconPosition } from './composables'

// 类型导出
export type { AppItem, GridConfig, IconPosition, DockAppItem, DesktopItem, DesktopPage } from './types'
export { toDockAppItem } from './types'