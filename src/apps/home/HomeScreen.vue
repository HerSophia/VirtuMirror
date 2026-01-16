<script setup lang="ts">
import { computed, ref, onMounted, onActivated, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { usePhoneStore } from '@/stores/phoneStore'
import { useAppStateStore, getAppIdFromRoute } from '@/stores/appStateStore'
import { setZoomOrigin } from '@/router'
import AppIcon from '@/components/common/AppIcon.vue'
import type { AppIconId } from '@/types/theme'

const router = useRouter()
const phoneStore = usePhoneStore()
const appStateStore = useAppStateStore()

// 主屏幕容器引用，用于计算相对位置
const homescreenRef = ref<HTMLElement | null>(null)

// 图标元素引用映射
const iconRefs = ref<Map<string, HTMLElement>>(new Map())

interface AppItem {
  id: AppIconId | string
  name: string
  route: string
  badge?: number
}

const apps = computed<AppItem[]>(() => [
  {
    id: 'wechat',
    name: '微信',
    route: '/chat',
    badge: phoneStore.contactStore.totalUnreadCount,
  },
  {
    id: 'email',
    name: '邮箱',
    route: '/email',
    badge: phoneStore.unreadEmailCount,
  },
  {
    id: 'browser',
    name: '浏览器',
    route: '/browser',
  },
  {
    id: 'live',
    name: '直播',
    route: '/live',
  },
  {
    id: 'appstore',
    name: '应用商店',
    route: '/app-store',
  },
  {
    id: 'tutorial',
    name: '使用帮助',
    route: '/tutorial',
  },
  {
    id: 'prompts',
    name: '提示词',
    route: '/prompts',
  },
  {
    id: 'settings',
    name: '设置',
    route: '/settings',
  },
])

/** Dock 栏 App 列表 */
const dockApps = computed<AppItem[]>(() => [
  { id: 'wechat', name: '微信', route: '/chat', badge: phoneStore.contactStore.totalUnreadCount },
  { id: 'browser', name: '浏览器', route: '/browser' },
  { id: 'email', name: '邮箱', route: '/email', badge: phoneStore.unreadEmailCount },
  { id: 'live', name: '直播', route: '/live' },
])

/**
 * 注册所有图标位置到 appStateStore
 */
function registerAllIconPositions() {
  const container = homescreenRef.value
  if (!container) return
  
  // 遍历所有已收集的图标引用
  for (const [appId, element] of iconRefs.value.entries()) {
    appStateStore.registerIconFromElement(appId, element, container)
  }
  
  console.log('[HomeScreen] 已注册所有图标位置', appStateStore.appStates)
}

/**
 * 设置图标元素引用
 */
function setIconRef(appId: string, el: HTMLElement | null) {
  if (el) {
    iconRefs.value.set(appId, el)
  }
}

/**
 * 打开 App
 */
function openApp(app: AppItem, event: MouseEvent | TouchEvent) {
  const appId = getAppIdFromRoute(app.route)
  
  // 获取该 App 的图标位置
  const iconPosition = appStateStore.getIconPosition(appId)
  
  if (iconPosition) {
    // 使用已注册的图标位置
    setZoomOrigin(iconPosition)
  } else {
    // 回退：从点击事件计算位置
    const container = homescreenRef.value
    if (container) {
      let clientX: number, clientY: number
      if ('touches' in event) {
        clientX = event.touches[0].clientX
        clientY = event.touches[0].clientY
      } else {
        clientX = event.clientX
        clientY = event.clientY
      }
      const rect = container.getBoundingClientRect()
      setZoomOrigin({
        x: ((clientX - rect.left) / rect.width) * 100,
        y: ((clientY - rect.top) / rect.height) * 100
      })
    }
  }
  
  router.push(app.route)
}

// 组件挂载和激活时注册图标位置
onMounted(() => {
  nextTick(() => {
    registerAllIconPositions()
  })
})

// KeepAlive 激活时重新注册（处理布局变化）
onActivated(() => {
  nextTick(() => {
    registerAllIconPositions()
  })
})
</script>

<template>
  <div ref="homescreenRef" class="homescreen">
    <div class="app-grid">
      <div
        v-for="app in apps"
        :key="app.id"
        :ref="(el) => setIconRef(getAppIdFromRoute(app.route), el as HTMLElement)"
        class="app-block"
        @click="openApp(app, $event)"
      >
        <AppIcon
          :app-id="app.id"
          size="md"
          :badge="app.badge"
        />
        <span class="app-name">{{ app.name }}</span>
      </div>
    </div>
    
    <!-- Dock栏 -->
    <div class="dock-bar">
      <div
        v-for="app in dockApps"
        :key="`dock-${app.id}`"
        class="dock-item"
        @click="openApp(app, $event)"
      >
        <AppIcon
          :app-id="app.id"
          size="sm"
          :badge="app.badge"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.homescreen {
  @apply h-full flex flex-col;
  background: var(--wallpaper-homescreen);
  background-size: cover;
  background-position: center;
  transition: background 0.3s ease;
}

.app-grid {
  @apply flex-1 grid grid-cols-4 gap-x-4 gap-y-6 p-6 pt-12 content-start;
}

.app-block {
  @apply flex flex-col items-center gap-1 cursor-pointer;
  @apply transition-transform duration-150 active:scale-90;
}

.app-name {
  @apply text-xs text-white/90 font-medium truncate max-w-[60px] text-center;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.dock-bar {
  @apply mx-4 mb-8 px-4 py-2;
  @apply bg-white/20 backdrop-blur-lg rounded-2xl;
  @apply flex items-center justify-around;
}

.dock-item {
  @apply cursor-pointer transition-transform active:scale-90;
}
</style>