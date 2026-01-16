/**
 * Status Bar App - 状态栏应用
 * 
 * 状态栏是一个特殊的 App，类似于 HomeApp（桌面）的设计理念。
 * 它不参与路由系统，而是作为系统级 UI 组件常驻显示在屏幕顶部。
 * 
 * 包含：
 * - StatusBarApp: 主状态栏组件（显示时间、信号、电池等）
 * - NotificationCenter: 通知中心面板（左侧下拉）
 * - ControlCenter: 控制中心面板（右侧下拉）
 * 
 * @example
 * ```vue
 * <script setup>
 * import { StatusBarApp, NotificationCenter, ControlCenter } from '@/apps/status-bar'
 * </script>
 * 
 * <template>
 *   <StatusBarApp />
 *   <NotificationCenter v-if="showNotification" />
 *   <ControlCenter v-if="showControl" />
 * </template>
 * ```
 */

// 主组件
export { default as StatusBarApp } from './StatusBarApp.vue'

// 面板组件
export * from './panels'