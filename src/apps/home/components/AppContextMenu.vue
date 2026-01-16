<script setup lang="ts">
/**
 * App 长按上下文菜单
 * 显示快捷操作（分享、卸载）和快捷入口
 * 参考 iOS/Android 的长按快捷方式设计
 */
import { computed, ref, watch, nextTick, onUnmounted } from 'vue'
import AppIcon from '@/components/common/AppIcon.vue'
import type { AppItem, AppQuickAction } from '../types'
import { getAppQuickActions } from '../types'

const props = defineProps<{
  /** 是否显示菜单 */
  visible: boolean
  /** App 信息 */
  app: AppItem | null
  /** 菜单位置 X */
  x: number
  /** 菜单位置 Y */
  y: number
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  /** 选择操作 */
  select: [action: AppQuickAction]
  /** 关闭菜单 */
  close: []
}>()

const menuRef = ref<HTMLElement | null>(null)

// 快捷入口列表（不包括系统操作）
const shortcuts = computed(() => {
  if (!props.app) return []
  const appId = props.app.iconId as string
  const actions = getAppQuickActions(appId)
  return actions.filter(a => a.type === 'shortcut')
})

// 系统操作列表（分享、卸载）
const systemActions = computed(() => {
  if (!props.app) return []
  const appId = props.app.iconId as string
  const actions = getAppQuickActions(appId)
  return actions.filter(a => a.type !== 'shortcut')
})

// 调整后的位置（防止超出手机屏幕）
const adjustedPosition = computed(() => {
  const menuWidth = 200
  const menuHeight = shortcuts.value.length > 0 ? 200 : 100 // 根据内容估算高度
  const padding = 12
  
  // 获取 phone-frame 容器的尺寸
  const phoneFrame = document.querySelector('.phone-frame')
  const containerWidth = phoneFrame?.clientWidth || 393
  const containerHeight = phoneFrame?.clientHeight || 852
  
  let x = props.x - menuWidth / 2 // 居中显示
  let y = props.y + 10 // 向下偏移一点
  
  // 检查右边界
  if (x + menuWidth > containerWidth - padding) {
    x = containerWidth - menuWidth - padding
  }
  
  // 检查左边界
  if (x < padding) {
    x = padding
  }
  
  // 检查下边界 - 如果菜单会超出底部，则显示在图标上方
  if (y + menuHeight > containerHeight - padding) {
    y = props.y - menuHeight - 20 // 在图标上方显示
  }
  
  // 确保不超出上边界
  if (y < padding + 44) { // 44px 是状态栏高度
    y = padding + 44
  }
  
  return { x, y }
})

function handleSelect(action: AppQuickAction) {
  emit('select', action)
  close()
}

function close() {
  emit('update:visible', false)
  emit('close')
}

// 点击外部关闭
function handleClickOutside(e: MouseEvent | TouchEvent) {
  if (menuRef.value && !menuRef.value.contains(e.target as Node)) {
    close()
  }
}

// 获取操作图标
function getActionIcon(action: AppQuickAction): string {
  const iconMap: Record<string, string> = {
    share: '↗',
    trash: '🗑',
    scan: '📷',
    wallet: '💳',
    plus: '+',
    history: '🕐',
    search: '🔍',
    edit: '✏️',
    inbox: '📥',
    palette: '🎨',
    info: 'ℹ️',
    fire: '🔥',
    heart: '❤️',
  }
  return iconMap[action.icon || ''] || '○'
}

watch(() => props.visible, (visible) => {
  if (visible) {
    // 延迟添加关闭监听器，避免打开菜单的同一个 mouseup/touchend 事件立即触发关闭
    setTimeout(() => {
      document.addEventListener('click', handleClickOutside)
      document.addEventListener('touchend', handleClickOutside, { passive: true })
    }, 100)
  } else {
    document.removeEventListener('click', handleClickOutside)
    document.removeEventListener('touchend', handleClickOutside)
  }
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('touchend', handleClickOutside)
})
</script>

<template>
  <Teleport to=".phone-frame">
    <Transition name="context-menu">
      <div
        v-if="visible && app"
        class="app-context-menu-overlay"
      >
      <div
        ref="menuRef"
        class="app-context-menu"
        :style="{
          left: `${adjustedPosition.x}px`,
          top: `${adjustedPosition.y}px`,
        }"
        @click.stop
        @touchstart.stop
      >
        <!-- 系统操作区（分享、卸载） -->
        <div class="system-actions">
          <button
            v-for="action in systemActions"
            :key="action.id"
            class="system-action-btn"
            :class="{ 'is-danger': action.danger }"
            @click="handleSelect(action)"
          >
            <span class="action-icon">{{ getActionIcon(action) }}</span>
            <span class="action-label">{{ action.label }}</span>
          </button>
        </div>
        
        <!-- 快捷入口列表 -->
        <div v-if="shortcuts.length > 0" class="shortcuts-list">
          <button
            v-for="action in shortcuts"
            :key="action.id"
            class="shortcut-item"
            @click="handleSelect(action)"
          >
            <span class="shortcut-icon">{{ getActionIcon(action) }}</span>
            <span class="shortcut-label">{{ action.label }}</span>
          </button>
        </div>
        
        <!-- App 图标（装饰性） -->
        <div class="app-icon-display">
          <AppIcon
            :app-id="app.iconId"
            size="lg"
          />
        </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.app-context-menu-overlay {
  @apply absolute inset-0 z-[150];
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.app-context-menu {
  @apply absolute z-[151];
  @apply w-[200px];
  @apply rounded-2xl overflow-hidden;
  @apply shadow-2xl;
  background: var(--color-surface, #ffffff);
}

/* 系统操作区 */
.system-actions {
  @apply flex border-b;
  border-color: var(--color-border, #e5e5e5);
}

.system-action-btn {
  @apply flex-1 flex flex-col items-center justify-center gap-1;
  @apply py-3 px-2;
  @apply transition-colors duration-150;
  color: var(--color-text, #000000);
}

.system-action-btn:first-child {
  @apply border-r;
  border-color: var(--color-border, #e5e5e5);
}

.system-action-btn:active {
  background: var(--color-surface-variant, #f5f5f5);
}

.system-action-btn.is-danger {
  color: var(--color-error, #ff3b30);
}

.system-action-btn .action-icon {
  @apply text-xl;
}

.system-action-btn .action-label {
  @apply text-xs font-medium;
}

/* 快捷入口列表 */
.shortcuts-list {
  @apply py-1;
}

.shortcut-item {
  @apply w-full flex items-center gap-3;
  @apply px-4 py-3;
  @apply text-sm text-left;
  @apply transition-colors duration-150;
  color: var(--color-text, #000000);
}

.shortcut-item:active {
  background: var(--color-surface-variant, #f5f5f5);
}

.shortcut-icon {
  @apply text-lg w-6 text-center;
}

.shortcut-label {
  @apply flex-1;
}

/* App 图标装饰 */
.app-icon-display {
  @apply absolute -right-4 -bottom-4;
  @apply opacity-20;
  transform: scale(1.5);
  pointer-events: none;
}

/* 动画 */
.context-menu-enter-active,
.context-menu-leave-active {
  @apply transition-all duration-200 ease-out;
}

.context-menu-enter-from,
.context-menu-leave-to {
  @apply opacity-0;
}

.context-menu-enter-from .app-context-menu,
.context-menu-leave-to .app-context-menu {
  transform: scale(0.9);
  opacity: 0;
}

.context-menu-enter-active .app-context-menu,
.context-menu-leave-active .app-context-menu {
  @apply transition-all duration-200 ease-out;
}
</style>