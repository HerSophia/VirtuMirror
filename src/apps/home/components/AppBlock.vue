<script setup lang="ts">
/**
 * 单个 App 图标块组件
 * 封装 AppIcon + 名称，处理点击和长按事件
 *
 * 交互逻辑：
 * - 点击：打开 App
 * - 长按：显示快捷操作菜单
 * - 长按 + 拖拽：进入编辑模式（拖拽排序）
 *
 * 编辑模式下：
 * - 显示抖动动画和删除按钮
 * - 拖拽由 GridStack 处理
 */
import { computed, ref, onUnmounted } from 'vue'
import DynamicAppIcon from '@/components/common/DynamicAppIcon.vue'
import type { AppItem } from '../types'

const props = withDefaults(defineProps<{
  /** App 信息 */
  app: AppItem
  /** 是否显示名称 */
  showName?: boolean
  /** 图标尺寸 */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  /** 是否处于编辑模式 */
  isEditMode?: boolean
  /** 抖动动画延迟（用于错开动画） */
  wobbleDelay?: number
}>(), {
  showName: true,
  size: 'md',
  isEditMode: false,
  wobbleDelay: 0,
})

const emit = defineEmits<{
  click: [event: MouseEvent | TouchEvent]
  /** 长按触发（显示快捷菜单） */
  longPress: [event: MouseEvent | TouchEvent]
  /** 长按后拖拽（进入编辑模式） */
  longPressDrag: [event: MouseEvent | TouchEvent]
  delete: [app: AppItem]
}>()

// 长按定时器
let longPressTimer: ReturnType<typeof setTimeout> | null = null
const isLongPressTriggered = ref(false)
// 长按后是否已拖拽（用于区分显示菜单还是进入编辑模式）
const hasMovedAfterLongPress = ref(false)
const startPosition = ref({ x: 0, y: 0 })
const startTime = ref(0)
const hasMoved = ref(false)
const isPointerDown = ref(false)
const isHorizontalSwipe = ref(false)

// 移动距离阈值（像素）
const MOVE_THRESHOLD = 8
// 点击最大持续时间（毫秒）
const CLICK_MAX_DURATION = 300
// 方向判定阈值（像素）
const DIRECTION_THRESHOLD = 5
// 长按后拖拽距离阈值（超过此值进入编辑模式）
const DRAG_AFTER_LONGPRESS_THRESHOLD = 15

// 计算抖动延迟样式
const wobbleStyle = computed(() => ({
  animationDelay: `${props.wobbleDelay}ms`,
}))

function getEventPosition(event: MouseEvent | TouchEvent): { x: number; y: number } {
  if ('touches' in event && event.touches.length > 0) {
    return { x: event.touches[0].clientX, y: event.touches[0].clientY }
  } else if ('changedTouches' in event && event.changedTouches.length > 0) {
    return { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY }
  } else if ('clientX' in event) {
    return { x: event.clientX, y: event.clientY }
  }
  return { x: 0, y: 0 }
}

function clearLongPressTimer() {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
}

function handlePointerDown(event: MouseEvent | TouchEvent) {
  console.log('[AppBlock] pointerDown', { isEditMode: props.isEditMode, app: props.app?.name })
  isPointerDown.value = true
  hasMoved.value = false
  isLongPressTriggered.value = false
  hasMovedAfterLongPress.value = false
  isHorizontalSwipe.value = false
  startPosition.value = getEventPosition(event)
  startTime.value = Date.now()
  
  // 编辑模式下不需要处理长按（已经在编辑模式了，由 GridStack 处理拖拽）
  if (props.isEditMode) {
    console.log('[AppBlock] 编辑模式下跳过长按处理')
    return
  }
  
  longPressTimer = setTimeout(() => {
    console.log('[AppBlock] 长按定时器触发！')
    isLongPressTriggered.value = true
    // 触发震动反馈
    if (navigator.vibrate) {
      navigator.vibrate(50)
    }
    // 注意：这里不立即 emit longPress，而是等待判断是否有后续拖拽
  }, 500)
}

function handlePointerMove(event: MouseEvent | TouchEvent) {
  if (!isPointerDown.value) return
  
  const pos = getEventPosition(event)
  const deltaX = Math.abs(pos.x - startPosition.value.x)
  const deltaY = Math.abs(pos.y - startPosition.value.y)
  const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)
  
  // 检测滑动方向
  if (!isHorizontalSwipe.value && (deltaX > DIRECTION_THRESHOLD || deltaY > DIRECTION_THRESHOLD)) {
    // 水平滑动判定：水平移动大于垂直移动
    isHorizontalSwipe.value = deltaX > deltaY
    console.log('[AppBlock] 滑动方向判定:', isHorizontalSwipe.value ? '水平' : '垂直', { deltaX, deltaY })
  }
  
  // 移动超过阈值，标记为已移动
  if (distance > MOVE_THRESHOLD && !hasMoved.value) {
    console.log('[AppBlock] 移动超过阈值', { distance, isLongPressTriggered: isLongPressTriggered.value })
    hasMoved.value = true
    // 如果还没触发长按，取消长按定时器
    if (!isLongPressTriggered.value) {
      console.log('[AppBlock] 取消长按定时器')
      clearLongPressTimer()
    }
  }
  
  // 长按触发后，如果拖拽超过阈值，进入编辑模式
  if (isLongPressTriggered.value && !hasMovedAfterLongPress.value && distance > DRAG_AFTER_LONGPRESS_THRESHOLD) {
    console.log('[AppBlock] 长按后拖拽，发射 longPressDrag')
    hasMovedAfterLongPress.value = true
    emit('longPressDrag', event)
  }
}

function handlePointerUp(event: MouseEvent | TouchEvent) {
  clearLongPressTimer()
  
  const wasPointerDown = isPointerDown.value
  const wasHorizontalSwipe = isHorizontalSwipe.value
  const wasLongPressTriggered = isLongPressTriggered.value
  const wasMovedAfterLongPress = hasMovedAfterLongPress.value
  
  console.log('[AppBlock] pointerUp', {
    wasPointerDown,
    wasHorizontalSwipe,
    wasLongPressTriggered,
    wasMovedAfterLongPress,
    hasMoved: hasMoved.value,
    isEditMode: props.isEditMode
  })
  
  isPointerDown.value = false
  
  // 如果不是从 pointerDown 开始的，不触发任何事件
  if (!wasPointerDown) {
    console.log('[AppBlock] 不是从 pointerDown 开始，跳过')
    resetState()
    return
  }
  
  // 编辑模式下不触发点击（交给 GridStack 处理）
  if (props.isEditMode) {
    console.log('[AppBlock] 编辑模式，跳过')
    resetState()
    return
  }
  
  // 长按触发且没有拖拽 -> 显示快捷菜单（优先级最高，不受水平滑动影响）
  if (wasLongPressTriggered && !wasMovedAfterLongPress) {
    console.log('[AppBlock] 发射 longPress 事件！')
    emit('longPress', event)
    resetState()
    return
  }
  
  // 长按 + 拖拽已经在 handlePointerMove 中处理了 (emit longPressDrag)
  if (wasLongPressTriggered && wasMovedAfterLongPress) {
    console.log('[AppBlock] 长按+拖拽，已在 move 中处理')
    resetState()
    return
  }
  
  // 如果是水平滑动，不触发点击（让页面滑动处理）
  if (wasHorizontalSwipe) {
    console.log('[AppBlock] 水平滑动，跳过点击')
    resetState()
    return
  }
  
  // 计算从按下到抬起的时间
  const duration = Date.now() - startTime.value
  
  // 判断是否为点击：没有触发长按、没有移动、时间在阈值内
  const isClick = !wasLongPressTriggered &&
                  !hasMoved.value &&
                  duration < CLICK_MAX_DURATION
  
  if (isClick) {
    console.log('[AppBlock] 发射 click 事件')
    emit('click', event)
  }
  
  resetState()
}

function resetState() {
  hasMoved.value = false
  isHorizontalSwipe.value = false
  hasMovedAfterLongPress.value = false
}

function handlePointerCancel() {
  console.log('[AppBlock] pointerCancel（真正的取消，如触摸被系统中断）')
  clearLongPressTimer()
  isPointerDown.value = false
  resetState()
  isLongPressTriggered.value = false
  hasMovedAfterLongPress.value = false
}

/**
 * 处理鼠标离开（不应该取消长按状态，因为用户可能只是手指/鼠标稍微移出图标区域）
 * 只有在长按未触发时才重置状态
 */
function handleMouseLeave() {
  console.log('[AppBlock] mouseLeave', { isLongPressTriggered: isLongPressTriggered.value })
  // 如果长按已触发，不重置状态，让 pointerUp 处理
  if (isLongPressTriggered.value) {
    return
  }
  // 长按未触发时，正常取消
  clearLongPressTimer()
  isPointerDown.value = false
  resetState()
}

function handleContextMenu(event: Event) {
  event.preventDefault()
}

/**
 * 处理删除按钮点击
 */
function handleDeleteClick(event: MouseEvent | TouchEvent) {
  event.preventDefault()
  event.stopPropagation()
  emit('delete', props.app)
}

onUnmounted(() => {
  clearLongPressTimer()
})
</script>

<template>
  <div
    class="app-block"
    :class="{ 'is-edit-mode': isEditMode }"
    :style="isEditMode ? wobbleStyle : {}"
    @mousedown="handlePointerDown"
    @mousemove="handlePointerMove"
    @mouseup="handlePointerUp"
    @mouseleave="handleMouseLeave"
    @touchstart.passive="handlePointerDown"
    @touchmove.passive="handlePointerMove"
    @touchend="handlePointerUp"
    @touchcancel="handlePointerCancel"
    @contextmenu="handleContextMenu"
  >
    <div class="icon-wrapper">
      <DynamicAppIcon
        :app-id="app.iconId || app.id"
        :size="size"
        :badge="app.badge"
        :icon="app.icon"
        :rounded="false"
      />
      <!-- 删除按钮（编辑模式） -->
      <button
        v-if="isEditMode"
        class="delete-btn"
        @click.stop="handleDeleteClick"
        @mousedown.stop
        @touchstart.stop="handleDeleteClick"
      >
        <span class="delete-icon">−</span>
      </button>
    </div>
    <span v-if="showName" class="app-name">{{ app.name }}</span>
  </div>
</template>

<style scoped>
.app-block {
  @apply flex flex-col items-center gap-1 cursor-pointer;
  @apply transition-transform duration-150;
  user-select: none;
  -webkit-user-select: none;
}

.app-block:not(.is-edit-mode):active {
  transform: scale(0.9);
}

.app-block.is-edit-mode {
  animation: wobble 0.3s ease-in-out infinite;
}

.icon-wrapper {
  @apply relative;
}

.delete-btn {
  @apply absolute -top-1 -left-1 w-5 h-5;
  @apply bg-gray-500/80 rounded-full;
  @apply flex items-center justify-center;
  @apply text-white font-bold text-sm leading-none;
  @apply shadow-md;
  z-index: 10;
}

.delete-btn:active {
  transform: scale(0.9);
}

.delete-icon {
  margin-top: -1px;
}

.app-name {
  @apply text-xs text-white/90 font-medium truncate max-w-[60px] text-center;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

/* 抖动动画 */
@keyframes wobble {
  0%, 100% {
    transform: rotate(-1.5deg);
  }
  50% {
    transform: rotate(1.5deg);
  }
}
</style>