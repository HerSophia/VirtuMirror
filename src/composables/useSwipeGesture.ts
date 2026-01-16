/**
 * 滑动手势处理 composable
 * 支持滑动返回、左右滑动等手势
 */

import { ref, onMounted, onUnmounted, type Ref } from 'vue'
import { useRouter } from 'vue-router'

export interface SwipeGestureOptions {
  /** 触发滑动的最小距离 */
  threshold?: number
  /** 是否启用滑动返回 */
  enableSwipeBack?: boolean
  /** 滑动返回的边缘区域宽度 */
  edgeWidth?: number
  /** 滑动方向 */
  direction?: 'horizontal' | 'vertical' | 'both'
  /** 滑动开始回调 */
  onSwipeStart?: (info: SwipeInfo) => void
  /** 滑动过程回调 */
  onSwipeMove?: (info: SwipeInfo) => void
  /** 滑动结束回调 */
  onSwipeEnd?: (info: SwipeInfo) => void
}

export interface SwipeInfo {
  /** 起始X坐标 */
  startX: number
  /** 起始Y坐标 */
  startY: number
  /** 当前X坐标 */
  currentX: number
  /** 当前Y坐标 */
  currentY: number
  /** X方向位移 */
  deltaX: number
  /** Y方向位移 */
  deltaY: number
  /** 滑动方向 */
  direction: 'left' | 'right' | 'up' | 'down' | null
  /** 滑动进度 (0-1) */
  progress: number
  /** 是否从边缘开始 */
  isFromEdge: boolean
  /** 是否为有效的返回手势 */
  isValidBackGesture: boolean
}

export function useSwipeGesture(
  elementRef: Ref<HTMLElement | null>,
  options: SwipeGestureOptions = {}
) {
  const {
    threshold = 50,
    enableSwipeBack = true,
    edgeWidth = 30,
    direction = 'horizontal',
    onSwipeStart,
    onSwipeMove,
    onSwipeEnd,
  } = options

  const router = useRouter()

  // 状态
  const isSwiping = ref(false)
  const swipeInfo = ref<SwipeInfo>({
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    deltaX: 0,
    deltaY: 0,
    direction: null,
    progress: 0,
    isFromEdge: false,
    isValidBackGesture: false,
  })

  // 滑动返回预览进度
  const swipeBackProgress = ref(0)

  let startTime = 0

  function getSwipeDirection(deltaX: number, deltaY: number): SwipeInfo['direction'] {
    const absX = Math.abs(deltaX)
    const absY = Math.abs(deltaY)

    if (absX < 10 && absY < 10) return null

    if (direction === 'horizontal' || (direction === 'both' && absX > absY)) {
      return deltaX > 0 ? 'right' : 'left'
    }
    if (direction === 'vertical' || (direction === 'both' && absY > absX)) {
      return deltaY > 0 ? 'down' : 'up'
    }
    return null
  }

  function updateSwipeInfo(currentX: number, currentY: number) {
    const deltaX = currentX - swipeInfo.value.startX
    const deltaY = currentY - swipeInfo.value.startY
    const swipeDirection = getSwipeDirection(deltaX, deltaY)

    // 计算进度
    let progress = 0
    if (swipeDirection === 'right' || swipeDirection === 'left') {
      progress = Math.min(Math.abs(deltaX) / (threshold * 2), 1)
    } else if (swipeDirection === 'up' || swipeDirection === 'down') {
      progress = Math.min(Math.abs(deltaY) / (threshold * 2), 1)
    }

    // 判断是否为有效的返回手势
    const isValidBackGesture = 
      enableSwipeBack &&
      swipeInfo.value.isFromEdge &&
      swipeDirection === 'right' &&
      deltaX > threshold

    swipeInfo.value = {
      ...swipeInfo.value,
      currentX,
      currentY,
      deltaX,
      deltaY,
      direction: swipeDirection,
      progress,
      isValidBackGesture,
    }

    // 更新返回手势进度
    if (swipeInfo.value.isFromEdge && swipeDirection === 'right') {
      swipeBackProgress.value = Math.min(deltaX / (threshold * 2), 1)
    }
  }

  function handleTouchStart(e: TouchEvent) {
    const touch = e.touches[0]
    const rect = elementRef.value?.getBoundingClientRect()
    const isFromEdge = rect ? touch.clientX - rect.left < edgeWidth : false

    startTime = Date.now()
    isSwiping.value = true
    swipeInfo.value = {
      startX: touch.clientX,
      startY: touch.clientY,
      currentX: touch.clientX,
      currentY: touch.clientY,
      deltaX: 0,
      deltaY: 0,
      direction: null,
      progress: 0,
      isFromEdge,
      isValidBackGesture: false,
    }
    swipeBackProgress.value = 0

    onSwipeStart?.(swipeInfo.value)
  }

  function handleTouchMove(e: TouchEvent) {
    if (!isSwiping.value) return

    const touch = e.touches[0]
    updateSwipeInfo(touch.clientX, touch.clientY)

    // 如果是有效的返回手势，阻止默认行为
    if (swipeInfo.value.isFromEdge && swipeInfo.value.direction === 'right') {
      e.preventDefault()
    }

    onSwipeMove?.(swipeInfo.value)
  }

  function handleTouchEnd() {
    if (!isSwiping.value) return

    const duration = Date.now() - startTime
    const velocity = Math.abs(swipeInfo.value.deltaX) / duration

    // 快速滑动或超过阈值时触发返回
    if (swipeInfo.value.isValidBackGesture || 
        (swipeInfo.value.isFromEdge && velocity > 0.5 && swipeInfo.value.deltaX > threshold / 2)) {
      router.back()
    }

    onSwipeEnd?.(swipeInfo.value)

    // 重置状态
    isSwiping.value = false
    swipeBackProgress.value = 0
    swipeInfo.value = {
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
      deltaX: 0,
      deltaY: 0,
      direction: null,
      progress: 0,
      isFromEdge: false,
      isValidBackGesture: false,
    }
  }

  function handleMouseDown(e: MouseEvent) {
    const rect = elementRef.value?.getBoundingClientRect()
    const isFromEdge = rect ? e.clientX - rect.left < edgeWidth : false

    startTime = Date.now()
    isSwiping.value = true
    swipeInfo.value = {
      startX: e.clientX,
      startY: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY,
      deltaX: 0,
      deltaY: 0,
      direction: null,
      progress: 0,
      isFromEdge,
      isValidBackGesture: false,
    }
    swipeBackProgress.value = 0

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    onSwipeStart?.(swipeInfo.value)
  }

  function handleMouseMove(e: MouseEvent) {
    if (!isSwiping.value) return

    updateSwipeInfo(e.clientX, e.clientY)
    onSwipeMove?.(swipeInfo.value)
  }

  function handleMouseUp() {
    if (!isSwiping.value) return

    const duration = Date.now() - startTime
    const velocity = Math.abs(swipeInfo.value.deltaX) / duration

    if (swipeInfo.value.isValidBackGesture || 
        (swipeInfo.value.isFromEdge && velocity > 0.5 && swipeInfo.value.deltaX > threshold / 2)) {
      router.back()
    }

    onSwipeEnd?.(swipeInfo.value)

    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)

    isSwiping.value = false
    swipeBackProgress.value = 0
    swipeInfo.value = {
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
      deltaX: 0,
      deltaY: 0,
      direction: null,
      progress: 0,
      isFromEdge: false,
      isValidBackGesture: false,
    }
  }

  onMounted(() => {
    const el = elementRef.value
    if (!el) return

    el.addEventListener('touchstart', handleTouchStart, { passive: true })
    el.addEventListener('touchmove', handleTouchMove, { passive: false })
    el.addEventListener('touchend', handleTouchEnd)
    el.addEventListener('mousedown', handleMouseDown)
  })

  onUnmounted(() => {
    const el = elementRef.value
    if (!el) return

    el.removeEventListener('touchstart', handleTouchStart)
    el.removeEventListener('touchmove', handleTouchMove)
    el.removeEventListener('touchend', handleTouchEnd)
    el.removeEventListener('mousedown', handleMouseDown)
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
  })

  return {
    isSwiping,
    swipeInfo,
    swipeBackProgress,
  }
}