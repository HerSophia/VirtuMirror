<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'

export interface MenuItem {
  id: string
  label: string
  icon?: string
  danger?: boolean
  disabled?: boolean
  divider?: boolean
}

const props = withDefaults(defineProps<{
  /** 菜单项 */
  items: MenuItem[]
  /** 是否显示 */
  visible?: boolean
  /** 位置 X */
  x?: number
  /** 位置 Y */
  y?: number
  /** 长按触发时间 (ms) */
  longPressDelay?: number
}>(), {
  visible: false,
  x: 0,
  y: 0,
  longPressDelay: 500,
})

const emit = defineEmits<{
  'update:visible': [value: boolean]
  select: [item: MenuItem]
  close: []
}>()

const menuRef = ref<HTMLElement | null>(null)

// 调整后的位置（防止超出屏幕）
const adjustedPosition = computed(() => {
  const menuWidth = 200 // 估计菜单宽度
  const menuHeight = props.items.length * 44 // 估计菜单高度
  const padding = 10
  
  let x = props.x
  let y = props.y
  
  // 检查右边界
  if (x + menuWidth > window.innerWidth - padding) {
    x = window.innerWidth - menuWidth - padding
  }
  
  // 检查下边界
  if (y + menuHeight > window.innerHeight - padding) {
    y = window.innerHeight - menuHeight - padding
  }
  
  // 确保不超出左边界和上边界
  x = Math.max(padding, x)
  y = Math.max(padding, y)
  
  return { x, y }
})

function handleSelect(item: MenuItem) {
  if (item.disabled || item.divider) return
  emit('select', item)
  close()
}

function close() {
  emit('update:visible', false)
  emit('close')
}

// 点击外部关闭
function handleClickOutside(e: MouseEvent) {
  if (menuRef.value && !menuRef.value.contains(e.target as Node)) {
    close()
  }
}

// ESC 关闭
function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    close()
  }
}

watch(() => props.visible, (visible) => {
  if (visible) {
    nextTick(() => {
      document.addEventListener('click', handleClickOutside)
      document.addEventListener('keydown', handleKeydown)
    })
  } else {
    document.removeEventListener('click', handleClickOutside)
    document.removeEventListener('keydown', handleKeydown)
  }
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="context-menu">
      <div
        v-if="visible"
        ref="menuRef"
        class="context-menu"
        :style="{
          left: `${adjustedPosition.x}px`,
          top: `${adjustedPosition.y}px`,
        }"
      >
        <div class="context-menu-content">
          <template v-for="item in items" :key="item.id">
            <div v-if="item.divider" class="context-menu-divider" />
            <button
              v-else
              class="context-menu-item"
              :class="{
                'is-danger': item.danger,
                'is-disabled': item.disabled,
              }"
              :disabled="item.disabled"
              @click="handleSelect(item)"
            >
              <i v-if="item.icon" :class="item.icon" class="item-icon" />
              <span class="item-label">{{ item.label }}</span>
            </button>
          </template>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.context-menu {
  @apply fixed z-[9999];
  @apply min-w-[160px] max-w-[280px];
  @apply rounded-xl overflow-hidden;
  @apply shadow-xl;
  background: var(--color-surface, #ffffff);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

.context-menu-content {
  @apply py-1;
}

.context-menu-item {
  @apply w-full px-4 py-3;
  @apply flex items-center gap-3;
  @apply text-sm text-left;
  @apply transition-colors duration-150;
  color: var(--color-text, #000000);
}

.context-menu-item:hover:not(.is-disabled) {
  background: var(--color-surface-variant, #f5f5f5);
}

.context-menu-item:active:not(.is-disabled) {
  background: var(--color-border, #e5e5e5);
}

.context-menu-item.is-danger {
  color: var(--color-error, #ff3b30);
}

.context-menu-item.is-disabled {
  @apply opacity-40 cursor-not-allowed;
}

.item-icon {
  @apply w-5 text-center;
  @apply opacity-70;
}

.item-label {
  @apply flex-1;
}

.context-menu-divider {
  @apply my-1 mx-3;
  @apply h-px;
  background: var(--color-border, #e5e5e5);
}

/* 动画 */
.context-menu-enter-active,
.context-menu-leave-active {
  @apply transition-all duration-200 ease-out;
}

.context-menu-enter-from,
.context-menu-leave-to {
  @apply opacity-0 scale-95;
}
</style>