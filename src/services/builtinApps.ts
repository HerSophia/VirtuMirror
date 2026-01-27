/**
 * 内置 App 图标配置
 * 
 * 定义所有内置 App 的图标注册信息。
 * 在应用初始化时调用 registerBuiltinApps() 注册。
 */
import { getIconRegistryService, type RegisteredAppIcon, type AppCategory } from './icon'

/**
 * 内置 App 配置列表
 */
export const BUILTIN_APPS: RegisteredAppIcon[] = [
  // ===== 社交通讯 =====
  {
    id: 'wechat',
    iconId: 'wechat',
    name: '微信',
    route: '/chat',
    category: 'social',
    isBuiltin: true,
    quickActions: [
      { id: 'wechat-scan', label: '扫一扫', icon: 'fa-qrcode', route: '/chat?action=scan' },
      { id: 'wechat-pay', label: '收付款', icon: 'fa-wallet', route: '/chat?action=pay' },
    ],
  },
  {
    id: 'email',
    iconId: 'email',
    name: '邮箱',
    route: '/email',
    category: 'social',
    isBuiltin: true,
    quickActions: [
      { id: 'email-compose', label: '写邮件', icon: 'fa-edit', route: '/email?action=compose' },
      { id: 'email-inbox', label: '收件箱', icon: 'fa-inbox', route: '/email' },
    ],
  },
  {
    id: 'weibo',
    iconId: 'weibo',
    name: '微博',
    route: '/weibo',
    category: 'social',
    isBuiltin: true,
    icon: { type: 'font', value: 'fab fa-weibo', background: '#E6162D', color: '#ffffff' }
  },
  
  // ===== 工具 =====
  {
    id: 'browser',
    iconId: 'browser',
    name: '浏览器',
    route: '/browser',
    category: 'tool',
    isBuiltin: true,
    quickActions: [
      { id: 'browser-new-tab', label: '新建标签页', icon: 'fa-plus', route: '/browser?action=new' },
      { id: 'browser-history', label: '历史记录', icon: 'fa-history', route: '/browser/history' },
      { id: 'browser-search', label: '搜索', icon: 'fa-search', route: '/browser?action=search' },
    ],
  },
  {
    id: 'appstore',
    iconId: 'appstore',
    name: '应用商店',
    route: '/app-store',
    category: 'tool',
    isBuiltin: true,
  },
  {
    id: 'gallery',
    iconId: 'gallery',
    name: '图库',
    route: '/gallery',
    category: 'tool',
    isBuiltin: true,
  },
  
  // ===== 娱乐 =====
  {
    id: 'live',
    iconId: 'live',
    name: '直播',
    route: '/live',
    category: 'entertainment',
    isBuiltin: true,
    quickActions: [
      { id: 'live-popular', label: '热门直播', icon: 'fa-fire', route: '/live?tab=popular' },
      { id: 'live-follow', label: '关注', icon: 'fa-heart', route: '/live?tab=follow' },
    ],
  },
  
  // ===== 效率办公 =====
  {
    id: 'pathfinder-student',
    iconId: 'pathfinder-student',
    name: 'Pathfinder 学员',
    route: '/pathfinder-student',
    category: 'productivity',
    isBuiltin: true,
  },
  {
    id: 'api-manager',
    iconId: 'api-manager',
    name: 'API 管理',
    route: '/api-manager',
    category: 'productivity',
    isBuiltin: true,
  },
  {
    id: 'bridge',
    iconId: 'bridge',
    name: '桥接管理',
    route: '/bridge',
    category: 'productivity',
    isBuiltin: true,
  },
  
  // ===== 系统 =====
  {
    id: 'settings',
    iconId: 'settings',
    name: '设置',
    route: '/settings',
    category: 'system',
    isBuiltin: true,
    quickActions: [
      { id: 'settings-theme', label: '主题设置', icon: 'fa-palette', route: '/settings/theme' },
      { id: 'settings-about', label: '关于手机', icon: 'fa-info-circle', route: '/settings/about' },
    ],
  },
  {
    id: 'tutorial',
    iconId: 'tutorial',
    name: '使用帮助',
    route: '/tutorial',
    category: 'system',
    isBuiltin: true,
  },
  {
    id: 'social-engine',
    iconId: 'social-engine',
    name: '社交引擎',
    route: '/social-engine',
    category: 'system',
    isBuiltin: true,
    icon: { type: 'font', value: 'fas fa-network-wired', background: '#607D8B', color: '#ffffff' },
    quickActions: [
      { id: 'social-engine-director', label: '导演服务', icon: 'fa-clapperboard', route: '/social-engine' },
      { id: 'social-engine-platforms', label: '平台管理', icon: 'fa-globe', route: '/social-engine' },
    ],
  },
  {
    id: 'account-manager',
    iconId: 'account-manager',
    name: '账号管理',
    route: '/account-manager',
    category: 'system',
    isBuiltin: true,
    icon: { type: 'font', value: 'fas fa-users-cog', background: '#5C6BC0', color: '#ffffff' },
    quickActions: [
      { id: 'account-manager-player', label: '玩家身份', icon: 'fa-user', route: '/account-manager' },
    ],
  },
]

/**
 * 默认的 Dock 栏 App ID 列表
 */
export const DEFAULT_DOCK_APP_IDS = ['wechat', 'browser', 'email', 'live']

/**
 * 注册所有内置 App 图标
 */
export function registerBuiltinApps(): void {
  const service = getIconRegistryService()
  service.registerAll(BUILTIN_APPS, { override: false })
  console.log(`[BuiltinApps] 已注册 ${BUILTIN_APPS.length} 个内置 App 图标`)
}

/**
 * 根据 App ID 获取分类
 * @deprecated 使用 iconRegistryService.get(id)?.category
 */
export function getAppCategoryById(id: string): AppCategory {
  const app = BUILTIN_APPS.find(a => a.id === id)
  return app?.category || 'other'
}
