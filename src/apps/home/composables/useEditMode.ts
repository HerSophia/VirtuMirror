/**
 * 桌面编辑模式 composable
 * 管理编辑模式状态、拖拽排序、页面自动切换等功能
 */
import { ref, computed, watch, type Ref } from 'vue'
import type { AppItem, DesktopPage } from '../types'

export interface DragState {
  /** 是否正在拖拽 */
  isDragging: boolean
  /** 被拖拽的 App */
  draggedApp: AppItem | null
  /** 拖拽起始位置 */
  startPosition: { x: number; y: number }
  /** 当前拖拽位置 */
  currentPosition: { x: number; y: number }
  /** 被拖拽 App 所在的页面索引 */
  sourcePageIndex: number
  /** 被拖拽 App 在页面中的索引 */
  sourceAppIndex: number
  /** 目标位置的页面索引 */
  targetPageIndex: number
  /** 目标位置在页面中的索引 */
  targetAppIndex: number
}

export interface EditModeOptions {
  /** 进入编辑模式的长按时间 (ms) */
  longPressDelay?: number
  /** 边缘检测区域宽度 (px) */
  edgeWidth?: number
  /** 边缘停留触发页面切换的时间 (ms) */
  edgeSwitchDelay?: number
  /** 页面切换回调 */
  onPageSwitch?: (direction: 'prev' | 'next') => void
  /** App 顺序变更回调 */
  onReorder?: (pages: DesktopPage[]) => void
}

export function useEditMode(
  pages: Ref<DesktopPage[]>,
  currentPage: Ref<number>,
  options: EditModeOptions = {}
) {
  const {
    longPressDelay = 500,
    edgeWidth = 50,
    edgeSwitchDelay = 800,
    onPageSwitch,
    onReorder,
  } = options

  // 是否处于编辑模式
  const isEditMode = ref(false)

  // 拖拽状态
  const dragState = ref<DragState>({
    isDragging: false,
    draggedApp: null,
    startPosition: { x: 0, y: 0 },
    currentPosition: { x: 0, y: 0 },
    sourcePageIndex: 0,
    sourceAppIndex: 0,
    targetPageIndex: 0,
    targetAppIndex: 0,
  })

  // 边缘检测定时器
  let edgeSwitchTimer: ReturnType<typeof setTimeout> | null = null

  // 当前悬停的边缘
  const hoveringEdge = ref<'left' | 'right' | null>(null)

  /**
   * 进入编辑模式
   */
  function enterEditMode() {
    isEditMode.value = true
    // 触发震动反馈（如果支持）
    if (navigator.vibrate) {
      navigator.vibrate(50)
    }
  }

  /**
   * 退出编辑模式
   */
  function exitEditMode() {
    isEditMode.value = false
    cancelDrag()
  }

  /**
   * 开始拖拽
   */
  function startDrag(
    app: AppItem,
    pageIndex: number,
    appIndex: number,
    position: { x: number; y: number }
  ) {
    if (!isEditMode.value) return

    dragState.value = {
      isDragging: true,
      draggedApp: app,
      startPosition: { ...position },
      currentPosition: { ...position },
      sourcePageIndex: pageIndex,
      sourceAppIndex: appIndex,
      targetPageIndex: pageIndex,
      targetAppIndex: appIndex,
    }
  }

  /**
   * 更新拖拽位置
   */
  function updateDrag(
    position: { x: number; y: number },
    containerRect: DOMRect
  ) {
    if (!dragState.value.isDragging) return

    dragState.value.currentPosition = { ...position }

    // 边缘检测
    const isNearLeftEdge = position.x - containerRect.left < edgeWidth
    const isNearRightEdge = containerRect.right - position.x < edgeWidth

    if (isNearLeftEdge && currentPage.value > 0) {
      if (hoveringEdge.value !== 'left') {
        hoveringEdge.value = 'left'
        startEdgeSwitchTimer('prev')
      }
    } else if (isNearRightEdge && currentPage.value < pages.value.length - 1) {
      if (hoveringEdge.value !== 'right') {
        hoveringEdge.value = 'right'
        startEdgeSwitchTimer('next')
      }
    } else {
      clearEdgeSwitchTimer()
      hoveringEdge.value = null
    }
  }

  /**
   * 计算目标位置
   */
  function calculateTargetPosition(
    position: { x: number; y: number },
    gridRect: DOMRect,
    columns: number,
    rows: number
  ): { pageIndex: number; appIndex: number } {
    // 计算网格中的位置
    const cellWidth = gridRect.width / columns
    const cellHeight = gridRect.height / rows
    
    const relativeX = position.x - gridRect.left
    const relativeY = position.y - gridRect.top
    
    const col = Math.max(0, Math.min(columns - 1, Math.floor(relativeX / cellWidth)))
    const row = Math.max(0, Math.min(rows - 1, Math.floor(relativeY / cellHeight)))
    
    const appIndex = row * columns + col
    
    return {
      pageIndex: currentPage.value,
      appIndex: Math.min(appIndex, pages.value[currentPage.value].apps.length),
    }
  }

  /**
   * 更新目标位置
   */
  function updateTargetPosition(pageIndex: number, appIndex: number) {
    dragState.value.targetPageIndex = pageIndex
    dragState.value.targetAppIndex = appIndex
  }

  /**
   * 结束拖拽
   */
  function endDrag() {
    if (!dragState.value.isDragging) return

    const { sourcePageIndex, sourceAppIndex, targetPageIndex, targetAppIndex, draggedApp } = dragState.value

    if (draggedApp) {
      // 执行重新排序
      reorderApps(sourcePageIndex, sourceAppIndex, targetPageIndex, targetAppIndex)
    }

    cancelDrag()
  }

  /**
   * 取消拖拽
   */
  function cancelDrag() {
    dragState.value = {
      isDragging: false,
      draggedApp: null,
      startPosition: { x: 0, y: 0 },
      currentPosition: { x: 0, y: 0 },
      sourcePageIndex: 0,
      sourceAppIndex: 0,
      targetPageIndex: 0,
      targetAppIndex: 0,
    }
    clearEdgeSwitchTimer()
    hoveringEdge.value = null
  }

  /**
   * 重新排序 App
   */
  function reorderApps(
    fromPageIndex: number,
    fromAppIndex: number,
    toPageIndex: number,
    toAppIndex: number
  ) {
    if (fromPageIndex === toPageIndex && fromAppIndex === toAppIndex) return

    const newPages = pages.value.map(page => ({
      ...page,
      apps: [...page.apps],
    }))

    // 从源位置移除
    const [movedApp] = newPages[fromPageIndex].apps.splice(fromAppIndex, 1)

    // 插入到目标位置
    if (fromPageIndex === toPageIndex && toAppIndex > fromAppIndex) {
      // 同一页面内向后移动，需要调整索引
      newPages[toPageIndex].apps.splice(toAppIndex - 1, 0, movedApp)
    } else {
      newPages[toPageIndex].apps.splice(toAppIndex, 0, movedApp)
    }

    onReorder?.(newPages)
  }

  /**
   * 开始边缘切换定时器
   */
  function startEdgeSwitchTimer(direction: 'prev' | 'next') {
    clearEdgeSwitchTimer()
    
    edgeSwitchTimer = setTimeout(() => {
      if (direction === 'prev' && currentPage.value > 0) {
        // 切换到上一页
        currentPage.value--
        onPageSwitch?.(direction)
        // 如果还在边缘，继续定时
        if (hoveringEdge.value === 'left') {
          startEdgeSwitchTimer('prev')
        }
      } else if (direction === 'next' && currentPage.value < pages.value.length - 1) {
        // 切换到下一页
        currentPage.value++
        onPageSwitch?.(direction)
        // 如果还在边缘，继续定时
        if (hoveringEdge.value === 'right') {
          startEdgeSwitchTimer('next')
        }
      }
    }, edgeSwitchDelay)
  }

  /**
   * 清除边缘切换定时器
   */
  function clearEdgeSwitchTimer() {
    if (edgeSwitchTimer) {
      clearTimeout(edgeSwitchTimer)
      edgeSwitchTimer = null
    }
  }

  /**
   * 创建新页面（当拖拽到最后一页的右边缘时）
   */
  function createNewPage(): number {
    const newPage: DesktopPage = {
      id: `page-${pages.value.length}`,
      apps: [],
    }
    
    const newPages = [...pages.value, newPage]
    onReorder?.(newPages)
    
    return newPages.length - 1
  }

  // 计算拖拽元素的样式
  const dragStyle = computed(() => {
    if (!dragState.value.isDragging) return {}
    
    const { currentPosition, startPosition } = dragState.value
    const offsetX = currentPosition.x - startPosition.x
    const offsetY = currentPosition.y - startPosition.y
    
    return {
      transform: `translate(${offsetX}px, ${offsetY}px) scale(1.1)`,
      zIndex: 1000,
      opacity: 0.9,
    }
  })

  return {
    isEditMode,
    dragState,
    hoveringEdge,
    dragStyle,
    enterEditMode,
    exitEditMode,
    startDrag,
    updateDrag,
    updateTargetPosition,
    calculateTargetPosition,
    endDrag,
    cancelDrag,
    reorderApps,
    createNewPage,
  }
}