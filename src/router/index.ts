/**
 * Vue Router 配置
 * 使用 Memory History 模式，不会修改浏览器 URL
 *
 * 优化策略：
 * 1. 核心组件立即加载（首屏和常用页面）
 * 2. 次要组件懒加载
 * 3. 预加载机制在空闲时加载可能访问的组件
 */

import { createRouter, createMemoryHistory, type RouteRecordRaw } from 'vue-router'
import { defineAsyncComponent, type Component, ref, computed } from 'vue'

// ============ 核心组件 - 立即加载 ============
// 这些组件会在应用启动时立即加载，确保首屏和常用页面无延迟
import { HomeApp } from '@/apps/home'
import ChatApp from '@/apps/chat/ChatApp.vue'
import SettingsApp from '@/apps/settings/SettingsApp.vue'

// ============ 次要组件 - 懒加载 ============
// 使用动态导入，首次访问时才加载

// 聊天相关（从新的 views 目录导入）
const ChatConversation = () => import('@/apps/chat/views/conversation/ChatConversation.vue')
const GroupMembers = () => import('@/apps/chat/views/group/GroupMembers.vue')
const GroupInvite = () => import('@/apps/chat/views/group/GroupInvite.vue')
const GroupCreation = () => import('@/apps/chat/views/group/GroupCreation.vue')
const ServicesPage = () => import('@/apps/chat/views/services/ServicesPage.vue')
const WalletPage = () => import('@/apps/chat/views/services/WalletPage.vue')

// 邮件
const EmailApp = () => import('@/apps/email/EmailApp.vue')
const EmailDetail = () => import('@/apps/email/EmailDetail.vue')

// 设置子页面
const ThemeEditor = () => import('@/apps/settings/ThemeEditor.vue')
const AboutPhone = () => import('@/apps/settings/AboutPhone.vue')
const CloudSyncSettings = () => import('@/apps/settings/pages/CloudSyncSettings.vue')

// 浏览器
const BrowserApp = () => import('@/apps/browser/BrowserApp.vue')
const BrowserHistory = () => import('@/apps/browser/BrowserHistory.vue')

// 直播
const LiveCenterApp = () => import('@/apps/live/LiveCenterApp.vue')
const LiveStreamList = () => import('@/apps/live/LiveStreamList.vue')
const LiveStreamRoom = () => import('@/apps/live/LiveStreamRoom.vue')

// 创作
const CreationView = () => import('@/apps/creation/CreationView.vue')

// 提示词管理
const PromptsApp = () => import('@/apps/prompts/PromptsApp.vue')
const PromptDetail = () => import('@/apps/prompts/views/PromptDetail.vue')
const ChainsList = () => import('@/apps/prompts/views/ChainsList.vue')
const ChainEditor = () => import('@/apps/prompts/views/ChainEditor.vue')
const ChainRunner = () => import('@/apps/prompts/views/ChainRunner.vue')
const SystemPromptsList = () => import('@/apps/prompts/views/SystemPromptsList.vue')

// 应用商店
const AppStoreApp = () => import('@/apps/app-store/AppStoreApp.vue')
const StoreHome = () => import('@/apps/app-store/views/StoreHome.vue')
const AppDetail = () => import('@/apps/app-store/views/AppDetail.vue')
const InstalledApps = () => import('@/apps/app-store/views/InstalledApps.vue')
const CategoryApps = () => import('@/apps/app-store/views/CategoryApps.vue')
const AppRunner = () => import('@/apps/app-store/views/AppRunner.vue')

// 教程
const TutorialApp = () => import('@/apps/tutorial/TutorialApp.vue')
const TutorialCategory = () => import('@/apps/tutorial/views/TutorialCategory.vue')
const TutorialDetail = () => import('@/apps/tutorial/views/TutorialDetail.vue')

// Pathfinder 学员 App
const PathfinderStudentApp = () => import('@/apps/pathfinder-student/PathfinderStudentApp.vue')

// API 管理器
const ApiManagerApp = () => import('@/apps/api-manager/ApiManagerApp.vue')

// Bridge 管理
const BridgeApp = () => import('@/apps/bridge/BridgeApp.vue')

// 微博
const WeiboApp = () => import('@/apps/weibo/WeiboApp.vue')

// 图库
const GalleryApp = () => import('@/apps/gallery/GalleryApp.vue')
const GalleryDetail = () => import('@/apps/gallery/views/GalleryDetail.vue')
const GallerySettings = () => import('@/apps/gallery/views/GallerySettings.vue')

// 账号管理
const AccountManagerApp = () => import('@/apps/account-manager/AccountManagerApp.vue')

// 社交引擎
const SocialEngineApp = () => import('@/apps/social-engine/SocialEngineApp.vue')

// ============ 预加载配置 ============
// 定义需要预加载的组件及其优先级
interface PreloadConfig {
  loader: () => Promise<any>
  priority: 'high' | 'medium' | 'low'
}

const preloadConfigs: PreloadConfig[] = [
  // 高优先级 - 用户很可能马上访问
  { loader: ChatConversation, priority: 'high' },
  { loader: EmailApp, priority: 'high' },
  { loader: BrowserApp, priority: 'high' },
  
  // 中优先级 - 常用但不紧急
  { loader: LiveCenterApp, priority: 'medium' },
  { loader: ServicesPage, priority: 'medium' },
  
  // 低优先级 - 子页面和不常用页面
  { loader: ThemeEditor, priority: 'low' },
  { loader: AboutPhone, priority: 'low' },
  { loader: CloudSyncSettings, priority: 'low' },
  { loader: GroupMembers, priority: 'low' },
  { loader: GroupInvite, priority: 'low' },
  { loader: GroupCreation, priority: 'low' },
  { loader: WalletPage, priority: 'low' },
  { loader: PromptsApp, priority: 'low' },
  { loader: PromptDetail, priority: 'low' },
  { loader: AppStoreApp, priority: 'low' },
  { loader: StoreHome, priority: 'low' },
  { loader: AppDetail, priority: 'low' },
  { loader: InstalledApps, priority: 'low' },
  { loader: CategoryApps, priority: 'low' },
  { loader: TutorialApp, priority: 'low' },
  { loader: TutorialCategory, priority: 'low' },
  { loader: TutorialDetail, priority: 'low' },
  { loader: PathfinderStudentApp, priority: 'low' },
  { loader: ApiManagerApp, priority: 'low' },
  { loader: BridgeApp, priority: 'low' },
  { loader: WeiboApp, priority: 'medium' },
  { loader: GalleryApp, priority: 'low' },
  { loader: GalleryDetail, priority: 'low' },
  { loader: GallerySettings, priority: 'low' },
  { loader: AccountManagerApp, priority: 'low' },
  { loader: SocialEngineApp, priority: 'low' },
]

/**
 * 预加载组件
 * 在空闲时间按优先级加载组件，提升后续导航速度
 */
export function preloadComponents(): void {
  const loadByPriority = (priority: 'high' | 'medium' | 'low', delay: number) => {
    setTimeout(() => {
      if ('requestIdleCallback' in window) {
        ;(window as any).requestIdleCallback(() => {
          preloadConfigs
            .filter(c => c.priority === priority)
            .forEach(c => c.loader().catch(() => {}))
        })
      } else {
        // 降级方案：使用 setTimeout
        preloadConfigs
          .filter(c => c.priority === priority)
          .forEach(c => c.loader().catch(() => {}))
      }
    }, delay)
  }
  
  // 按优先级延迟加载
  loadByPriority('high', 1000)    // 1秒后加载高优先级
  loadByPriority('medium', 3000) // 3秒后加载中优先级
  loadByPriority('low', 5000)    // 5秒后加载低优先级
  
  console.info('[Router] 组件预加载已启动')
}

/**
 * 预加载指定路由的组件
 * 可在导航前调用，确保目标页面已加载
 */
export function preloadRoute(name: RouteName): Promise<void> {
  const route = routes.find(r => r.name === name)
  if (!route?.component) return Promise.resolve()
  
  const component = route.component as () => Promise<any>
  if (typeof component === 'function') {
    return component().then(() => {})
  }
  return Promise.resolve()
}

// ============ 需要缓存的组件名称 ============
// 这些组件会被 KeepAlive 缓存，避免重复渲染
export const cachedComponents: string[] = [
  'HomeApp',
  'ChatApp',
  'SettingsApp',
  'EmailApp',
  'BrowserApp',
  'LiveCenterApp',
  'PromptsApp',
  'AppStoreApp',
  'TutorialApp',
  'PathfinderStudentApp',
  'ApiManagerApp',
  'BridgeApp',
  'WeiboApp',
  'GalleryApp',
  'AccountManagerApp',
  'SocialEngineApp',
]

// 路由配置
const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'HomeApp',
    component: HomeApp,
    meta: { title: '桌面', keepAlive: true, isDesktop: true }
  },
  {
    path: '/chat',
    name: 'ChatApp',
    component: ChatApp,
    meta: { title: '微信', keepAlive: true },
    children: [
      // 聊天对话
      {
        path: ':contactId',
        name: 'ChatConversation',
        component: ChatConversation,
        props: true,
        meta: { title: '聊天' }
      },
      // 群组相关
      {
        path: 'group/create',
        name: 'GroupCreation',
        component: GroupCreation,
        meta: { title: '创建群聊' }
      },
      {
        path: 'group/:contactId/members',
        name: 'GroupMembers',
        component: GroupMembers,
        props: true,
        meta: { title: '群成员' }
      },
      {
        path: 'group/:contactId/invite',
        name: 'GroupInvite',
        component: GroupInvite,
        props: true,
        meta: { title: '邀请成员' }
      },
      // 服务相关
      {
        path: 'services',
        name: 'Services',
        component: ServicesPage,
        meta: { title: '服务' }
      },
      {
        path: 'wallet',
        name: 'Wallet',
        component: WalletPage,
        meta: { title: '钱包' }
      }
    ]
  },
  {
    path: '/email',
    name: 'EmailApp',
    component: EmailApp,
    meta: { title: '邮箱', keepAlive: true }
  },
  {
    path: '/email/:emailId',
    name: 'EmailDetail',
    component: EmailDetail,
    props: true,
    meta: { title: '邮件详情' }
  },
  {
    path: '/settings',
    name: 'SettingsApp',
    component: SettingsApp,
    meta: { title: '设置', keepAlive: true }
  },
  {
    path: '/settings/general',
    name: 'GeneralSettings',
    component: () => import('@/apps/settings/pages/GeneralSettings.vue'),
    meta: { title: '通用设置' }
  },
  {
    path: '/settings/display',
    name: 'DisplaySettings',
    component: () => import('@/apps/settings/pages/DisplaySettings.vue'),
    meta: { title: '显示与亮度' }
  },
  {
    path: '/settings/sound',
    name: 'SoundSettings',
    component: () => import('@/apps/settings/pages/SoundSettings.vue'),
    meta: { title: '声音与触感' }
  },
  {
    path: '/settings/time',
    name: 'TimeSettings',
    component: () => import('@/apps/settings/pages/TimeSettings.vue'),
    meta: { title: '日期与时间' }
  },
  {
    path: '/settings/cloud',
    name: 'CloudSyncSettings',
    component: CloudSyncSettings,
    meta: { title: '云同步' }
  },
  {
    path: '/settings/notifications',
    name: 'NotificationSettings',
    component: () => import('@/apps/settings/pages/NotificationSettings.vue'),
    meta: { title: '通知设置' }
  },
  {
    path: '/settings/apps',
    name: 'AppManagement',
    component: () => import('@/apps/settings/pages/AppManagement.vue'),
    meta: { title: '应用管理' }
  },
  {
    path: '/settings/theme',
    name: 'ThemeEditor',
    component: ThemeEditor,
    meta: { title: '主题设置' }
  },
  {
    path: '/settings/about',
    name: 'AboutPhone',
    component: AboutPhone,
    meta: { title: '关于手机' }
  },
  {
    path: '/browser',
    name: 'BrowserApp',
    component: BrowserApp,
    meta: { title: '浏览器', keepAlive: true }
  },
  {
    path: '/browser/history',
    name: 'BrowserHistory',
    component: BrowserHistory,
    meta: { title: '浏览历史' }
  },
  {
    path: '/live',
    name: 'LiveCenterApp',
    component: LiveCenterApp,
    meta: { title: '直播中心', keepAlive: true }
  },
  {
    path: '/live/:boardId',
    name: 'LiveStreamList',
    component: LiveStreamList,
    props: true,
    meta: { title: '直播列表' }
  },
  {
    path: '/live/:boardId/:streamId',
    name: 'LiveStreamRoom',
    component: LiveStreamRoom,
    props: true,
    meta: { title: '直播间' }
  },
  {
    path: '/creation',
    name: 'Creation',
    component: CreationView,
    meta: { title: '创作' }
  },
  {
    path: '/prompts',
    component: PromptsApp,
    meta: { title: '提示词管理', keepAlive: true },
    children: [
      {
        path: '',
        name: 'PromptsHome',
        component: () => import('@/apps/prompts/views/PromptsHome.vue'),
        meta: { title: '提示词中心' }
      },
      {
        path: 'list/:scope',
        name: 'PromptsList',
        component: () => import('@/apps/prompts/views/PromptsList.vue'),
        props: true,
        meta: { title: '提示词列表' }
      },
      {
        path: 'detail/:id',
        name: 'PromptDetail',
        component: PromptDetail,
        props: true,
        meta: { title: '提示词详情' }
      },
      // 提示词链相关路由
      {
        path: 'chains',
        name: 'ChainsList',
        component: ChainsList,
        meta: { title: '提示词链' }
      },
      {
        path: 'chains/:id',
        name: 'ChainEditor',
        component: ChainEditor,
        props: true,
        meta: { title: '编辑链' }
      },
      {
        path: 'chains/:id/run',
        name: 'ChainRunner',
        component: ChainRunner,
        props: true,
        meta: { title: '运行链' }
      },
      // 系统提示词
      {
        path: 'system',
        name: 'SystemPromptsList',
        component: SystemPromptsList,
        meta: { title: '系统提示词' }
      }
    ]
  },
  // 应用商店
  {
    path: '/app-store',
    name: 'AppStoreApp',
    component: AppStoreApp,
    meta: { title: '应用商店', keepAlive: true },
    children: [
      {
        path: '',
        name: 'AppStore',
        component: StoreHome,
        meta: { title: '应用商店' }
      },
      {
        path: 'app/:appId',
        name: 'AppDetail',
        component: AppDetail,
        props: true,
        meta: { title: '应用详情' }
      },
      {
        path: 'installed',
        name: 'InstalledApps',
        component: InstalledApps,
        meta: { title: '已安装应用' }
      },
      {
        path: 'category/:categoryId',
        name: 'CategoryApps',
        component: CategoryApps,
        props: true,
        meta: { title: '分类应用' }
      },
      {
        path: 'run/:appId',
        name: 'AppRunner',
        component: AppRunner,
        props: true,
        meta: { title: '运行应用' }
      }
    ]
  },
  // 教程
  {
    path: '/tutorial',
    name: 'TutorialApp',
    component: TutorialApp,
    meta: { title: '使用帮助', keepAlive: true },
    children: [
      {
        path: 'category/:categoryId',
        name: 'TutorialCategory',
        component: TutorialCategory,
        props: true,
        meta: { title: '教程分类' }
      },
      {
        path: ':tutorialId',
        name: 'TutorialDetail',
        component: TutorialDetail,
        props: true,
        meta: { title: '教程详情' }
      }
    ]
  },
  // Pathfinder 学员 App
  {
    path: '/pathfinder-student',
    name: 'PathfinderStudentApp',
    component: PathfinderStudentApp,
    meta: { title: 'Pathfinder 学员', keepAlive: true }
  },
  // API 管理器
  {
    path: '/api-manager',
    name: 'ApiManagerApp',
    component: ApiManagerApp,
    meta: { title: 'API 管理', keepAlive: true }
  },
  // Bridge 管理
  {
    path: '/bridge',
    name: 'BridgeApp',
    component: BridgeApp,
    meta: { title: '桥接管理', keepAlive: true }
  },
  // 微博
  {
    path: '/weibo',
    name: 'WeiboApp',
    component: WeiboApp,
    meta: { title: '微博', keepAlive: true }
  },
  {
    path: '/weibo/post/:postId',
    name: 'WeiboPostDetail',
    component: () => import('@/apps/weibo/views/WeiboPostDetail.vue'),
    props: true,
    meta: { title: '微博正文' }
  },
  // 图库
  {
    path: '/gallery',
    name: 'GalleryApp',
    component: GalleryApp,
    meta: { title: '图库', keepAlive: true },
    children: [
      {
        path: ':imageId',
        name: 'GalleryDetail',
        component: GalleryDetail,
        props: true,
        meta: { title: '图片详情' }
      },
      {
        path: 'settings',
        name: 'GallerySettings',
        component: GallerySettings,
        meta: { title: '图库设置' }
      }
    ]
  },
  // 账号管理
  {
    path: '/account-manager',
    name: 'AccountManagerApp',
    component: AccountManagerApp,
    meta: { title: '账号管理', keepAlive: true }
  },
  // 社交引擎
  {
    path: '/social-engine',
    name: 'SocialEngineApp',
    component: SocialEngineApp,
    meta: { title: '社交引擎', keepAlive: true }
  }
]

// 创建路由实例
const router = createRouter({
  history: createMemoryHistory(),
  routes,
})

// ============ 导航方向检测 ============
// 导出导航方向状态，供 ViewsContainer 使用
export const navigationDirection = ref<'forward' | 'back'>('forward')

// 过渡动画类型：slide（页面间滑动）或 zoom（桌面与App间缩放）
export const transitionType = ref<'slide' | 'zoom'>('slide')

// ============ 动画原点位置 ============
// 存储 App 图标的位置，用于 zoom 动画的起点/终点
export interface ZoomOrigin {
  x: number  // 相对于视口的 x 坐标（百分比 0-100）
  y: number  // 相对于视口的 y 坐标（百分比 0-100）
}

// 默认从屏幕中心开始
export const zoomOrigin = ref<ZoomOrigin>({ x: 50, y: 50 })

/**
 * 设置 zoom 动画的原点位置
 * @param origin 图标在视口中的位置（百分比）
 */
export function setZoomOrigin(origin: ZoomOrigin): void {
  zoomOrigin.value = origin
}

/**
 * 根据点击事件计算 zoom 原点
 * @param event 点击事件
 * @param container 容器元素（用于计算相对位置）
 */
export function setZoomOriginFromEvent(event: MouseEvent | TouchEvent, container?: HTMLElement): void {
  let clientX: number
  let clientY: number
  
  if ('touches' in event) {
    clientX = event.touches[0].clientX
    clientY = event.touches[0].clientY
  } else {
    clientX = event.clientX
    clientY = event.clientY
  }
  
  if (container) {
    const rect = container.getBoundingClientRect()
    zoomOrigin.value = {
      x: ((clientX - rect.left) / rect.width) * 100,
      y: ((clientY - rect.top) / rect.height) * 100
    }
  } else {
    // 使用视口尺寸
    zoomOrigin.value = {
      x: (clientX / window.innerWidth) * 100,
      y: (clientY / window.innerHeight) * 100
    }
  }
}

/**
 * 重置 zoom 原点到中心
 */
export function resetZoomOrigin(): void {
  zoomOrigin.value = { x: 50, y: 50 }
}

// 导航历史栈（响应式）
const historyStack = ref<string[]>(['/'])

// 是否可以返回（基于内部历史栈判断）
export const canGoBack = computed(() => {
  return historyStack.value.length > 1
})

/**
 * 判断返回后是否会回到桌面
 * 用于手势返回时决定使用 zoom 还是 slide 动画
 */
export function willBackToHome(): boolean {
  // 如果历史栈长度为 2 且第一个是桌面，返回后会回到桌面
  if (historyStack.value.length === 2 && historyStack.value[0] === '/') {
    return true
  }
  // 如果历史栈长度为 1，已经在最底层了，不能返回
  if (historyStack.value.length <= 1) {
    return false
  }
  // 检查返回后的目标路径是否为桌面
  const targetPath = historyStack.value[historyStack.value.length - 2]
  return targetPath === '/'
}

/**
 * 判断是否是桌面与App之间的导航
 * 桌面路径是 '/'，App 主路径是 '/chat', '/phone' 等一级路径
 */
function isHomeToAppTransition(from: string, to: string): boolean {
  return from === '/' && to !== '/'
}

function isAppToHomeTransition(from: string, to: string): boolean {
  return to === '/' && from !== '/'
}

/**
 * 手动设置过渡类型（供手势系统使用）
 */
export function setTransitionType(type: 'slide' | 'zoom'): void {
  transitionType.value = type
}

// 路由守卫 - 检测导航方向和过渡类型
router.beforeEach((to, from, next) => {
  const toPath = to.path
  const fromPath = from.path
  
  // 检测桌面与App间的过渡，使用 zoom 动画
  if (isHomeToAppTransition(fromPath, toPath)) {
    transitionType.value = 'zoom'
    navigationDirection.value = 'forward'
    historyStack.value = [...historyStack.value, toPath]
    console.log(`[Router] ZOOM IN (home -> app): ${fromPath} -> ${toPath}`)
    next()
    return
  }
  
  if (isAppToHomeTransition(fromPath, toPath)) {
    transitionType.value = 'zoom'
    navigationDirection.value = 'back'
    historyStack.value = ['/']
    console.log(`[Router] ZOOM OUT (app -> home): ${fromPath} -> ${toPath}`)
    next()
    return
  }
  
  // 其他情况使用 slide 动画
  transitionType.value = 'slide'
  
  // 检查是否是后退操作
  // 如果目标路径在历史栈中（且不是栈顶），说明是后退
  const indexInStack = historyStack.value.indexOf(toPath)
  const isAtStackTop = indexInStack === historyStack.value.length - 1
  
  if (indexInStack !== -1 && !isAtStackTop) {
    // 后退操作：截断历史栈到目标位置
    navigationDirection.value = 'back'
    historyStack.value = historyStack.value.slice(0, indexInStack + 1)
    console.log(`[Router] BACK: ${fromPath} -> ${toPath}`)
  } else {
    // 前进操作
    navigationDirection.value = 'forward'
    // 如果目标不在栈顶，添加到栈
    if (historyStack.value[historyStack.value.length - 1] !== toPath) {
      historyStack.value = [...historyStack.value, toPath]
    }
    console.log(`[Router] FORWARD: ${fromPath} -> ${toPath}`)
  }
  
  console.log(`[Router] History stack:`, [...historyStack.value])
  next()
})

export default router

// 导出路由名称类型，便于类型安全的导航
export type RouteName =
  | 'HomeApp'
  | 'ChatApp'
  | 'ChatConversation'
  | 'GroupMembers'
  | 'GroupInvite'
  | 'GroupCreation'
  | 'Services'
  | 'Wallet'
  | 'EmailApp'
  | 'EmailDetail'
  | 'SettingsApp'
  | 'ThemeEditor'
  | 'AboutPhone'
  | 'BrowserApp'
  | 'BrowserHistory'
  | 'LiveCenterApp'
  | 'LiveStreamList'
  | 'LiveStreamRoom'
  | 'Creation'
  | 'PromptsApp'
  | 'PromptDetail'
  | 'ChainsList'
  | 'ChainEditor'
  | 'ChainRunner'
  | 'SystemPromptsList'
  | 'AppStoreApp'
  | 'AppStore'
  | 'AppDetail'
  | 'InstalledApps'
  | 'CategoryApps'
  | 'AppRunner'
  | 'TutorialApp'
  | 'TutorialCategory'
  | 'TutorialDetail'
  | 'PathfinderStudentApp'
  | 'ApiManagerApp'
  | 'BridgeApp'
  | 'WeiboApp'
  | 'GalleryApp'
  | 'GalleryDetail'
  | 'GallerySettings'
  | 'AccountManagerApp'
  | 'SocialEngineApp'
  | 'SoundSettings'
  | 'TimeSettings'
  | 'CloudSyncSettings'
