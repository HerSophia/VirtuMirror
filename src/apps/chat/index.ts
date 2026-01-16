/**
 * Chat App 导出入口
 * 
 * 新架构说明：
 * - components/  共享组件（ChatHeader, ListItem, BottomNav）
 * - composables/ 组合式函数（useTimeFormat, useMessageFormat）
 * - tabs/        底部标签页组件
 * - views/       子页面视图
 *   - conversation/  聊天对话
 *   - group/         群组相关
 *   - services/      服务相关
 */

// 主应用
export { default as ChatApp } from './ChatApp.vue'

// 视图组件（供路由使用）
export { 
  ChatConversation,
  GroupCreation, 
  GroupInvite, 
  GroupMembers,
  ServicesPage,
  WalletPage
} from './views'

// 共享组件
export { ChatHeader, ListItem, BottomNav } from './components'
export type { TabName } from './components'

// Composables
export { 
  useTimeFormat, 
  formatListTime, 
  formatMessageTime,
  useMessageFormat,
  getMessageContent,
  getMessagePreview
} from './composables'