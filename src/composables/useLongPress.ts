/**
 * 长按手势 composable
 */

import { ref, onMounted, onUnmounted, type Ref } from 'vue'

export interface LongPressOptions {
  /** 长按触发时间 (ms) */
  delay?: number
  /** 长按开始回调 */
  onStart?: (e: MouseEvent | TouchEvent) => void
  /** 长按触发回调 */
  onTrigger?: (e: MouseEvent | TouchEvent, position: { x: number; y: number }) => void
  /** 长按取消回调 */
  onCancel?: () => void
  /** 是否阻止默认右键菜单 */
  preventContextMenu?: boolean
}

export function useLongPress(
  elementRef: Ref<HTMLElement | null>,
  options: LongPressOptions = {}
) {
  const {
    delay = 500,
    onStart,
    onTrigger,
    onCancel,
    preventContextMenu = true,
  } = options

  const isLongPressing = ref(false)
  const position = ref({ x: 0, y: 0 })

  let timer: ReturnType<typeof setTimeout> | null = null
  let triggered = false

  function clearTimer() {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  function handleStart(e: MouseEvent | TouchEvent) {
    triggered = false
    
    // 获取位置
    if ('touches' in e) {
      position.value = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      }
    } else {
      position.value = {
        x: e.clientX,
        y: e.clientY,
      }
    }

    onStart?.(e)
    
    timer = setTimeout(() => {
      triggered = true
      isLongPressing.value = true
      onTrigger?.(e, position.value)
    }, delay)
  }

  function handleEnd() {
    clearTimer()
    
    if (isLongPressing.value && !triggered) {
      onCancel?.()
    }
    
    isLongPressing.value = false
  }

  function handleMove(e: MouseEvent | TouchEvent) {
    // 如果移动超过一定距离，取消长按
    let currentX: number, currentY: number
    
    if ('touches' in e) {
      currentX = e.touches[0].clientX
      currentY = e.touches[0].clientY
    } else {
      currentX = e.clientX
      currentY = e.clientY
    }
    
    const distance = Math.sqrt(
      Math.pow(currentX - position.value.x, 2) +
      Math.pow(currentY - position.value.y, 2)
    )
    
    if (distance > 10) {
      clearTimer()
      if (isLongPressing.value) {
        onCancel?.()
        isLongPressing.value = false
      }
    }
  }

  function handleContextMenu(e: Event) {
    if (preventContextMenu) {
      e.preventDefault()
    }
  }

  onMounted(() => {
    const el = elementRef.value
    if (!el) return

    el.addEventListener('mousedown', handleStart as EventListener)
    el.addEventListener('mouseup', handleEnd)
    el.addEventListener('mouseleave', handleEnd)
    el.addEventListener('mousemove', handleMove as EventListener)
    
    el.addEventListener('touchstart', handleStart as EventListener, { passive: true })
    el.addEventListener('touchend', handleEnd)
    el.addEventListener('touchcancel', handleEnd)
    el.addEventListener('touchmove', handleMove as EventListener, { passive: true })
    
    if (preventContextMenu) {
      el.addEventListener('contextmenu', handleContextMenu)
    }
  })

  onUnmounted(() => {
    clearTimer()
    
    const el = elementRef.value
    if (!el) return

    el.removeEventListener('mousedown', handleStart as EventListener)
    el.removeEventListener('mouseup', handleEnd)
    el.removeEventListener('mouseleave', handleEnd)
    el.removeEventListener('mousemove', handleMove as EventListener)
    
    el.removeEventListener('touchstart', handleStart as EventListener)
    el.removeEventListener('touchend', handleEnd)
    el.removeEventListener('touchcancel', handleEnd)
    el.removeEventListener('touchmove', handleMove as EventListener)
    
    if (preventContextMenu) {
      el.removeEventListener('contextmenu', handleContextMenu)
    }
  })

  return {
    isLongPressing,
    position,
  }
}