<script setup lang="ts">
/**
 * 多页桌面容器组件
 * 支持左右滑动切换桌面页面，以及编辑模式下的拖拽排序
 */
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import AppGrid from './AppGrid.vue'
import PageIndicator from './PageIndicator.vue'
import type { AppItem, DesktopPage } from '../types'

const props = withDefaults(defineProps<{
  /** 桌面页面列表 */
  pages: DesktopPage[]
  /** 每行列数 */
  columns?: number
  /** 初始页面索引 */
  initialPage?: number
  /** 是否处于编辑模式 */
  isEditMode?: boolean
}>(), {
  columns: 4,
  initialPage: 0,
  isEditMode: false,
})

const emit = defineEmits<{
  open: [app: AppItem, event: MouseEvent | TouchEvent]
  iconRef: [appId: string, el: HTMLElement | null]
  pageChange: [pageIndex: number]
  longPress: [app: AppItem, pageIndex: number, appIndex: number, event: MouseEvent | TouchEvent]
  updatePageApps: [pageIndex: number, apps: AppItem[]]
}>()

// 当前页面索引
const currentPage = ref(props.initialPage)
// 滑动进度 (-1 到 1)
const swipeProgress = ref(0)
// 是否正在滑动
const isSwiping = ref(false)
// 容器引用
const containerRef = ref<HTMLElement | null>(null)

// 滑动相关状态
let startX = 0
let startY = 0
let currentX = 0
let isDragging = false
let isHorizontalSwipe: boolean | null = null

// 计算滑动偏移
const translateX = computed(() => {
  const baseOffset = -currentPage.value * 100
  const dragOffset = swipeProgress.value * 100
  return baseOffset + dragOffset
})

// 边缘检测宽度
const EDGE_WIDTH = 50

// 处理触摸/鼠标开始
function handleStart(clientX: number, clientY: number) {
  // 编辑模式下不处理页面滑动
  if (props.isEditMode) return
  
  startX = clientX
  startY = clientY
  currentX = clientX
  isDragging = true
  isSwiping.value = true
  isHorizontalSwipe = null
}

// 处理触摸/鼠标移动
function handleMove(clientX: number, clientY: number) {
  // 编辑模式下不处理页面滑动
  if (props.isEditMode) return
  if (!isDragging) return
  
  const deltaX = clientX - startX
  const deltaY = clientY - startY
  
  // 判断滑动方向（只在第一次移动时判断）
  if (isHorizontalSwipe === null && (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10)) {
    isHorizontalSwipe = Math.abs(deltaX) > Math.abs(deltaY)
  }
  
  // 只处理水平滑动
  if (isHorizontalSwipe !== true) return
  
  currentX = clientX
  
  // 计算滑动进度
  const containerWidth = containerRef.value?.offsetWidth || 375
  let progress = deltaX / containerWidth
  
  // 边界阻尼效果
  if (currentPage.value === 0 && progress > 0) {
    progress = progress * 0.3 // 第一页向右滑动时增加阻尼
  } else if (currentPage.value === props.pages.length - 1 && progress < 0) {
    progress = progress * 0.3 // 最后一页向左滑动时增加阻尼
  }
  
  swipeProgress.value = progress
}

// 处理触摸/鼠标结束
function handleEnd() {
  // 编辑模式下不处理页面滑动
  if (props.isEditMode) return
  if (!isDragging) return
  isDragging = false
  
  const containerWidth = containerRef.value?.offsetWidth || 375
  const velocity = (currentX - startX) / containerWidth
  const threshold = 0.15 // 切换页面的阈值
  
  // 判断是否切换页面
  if (Math.abs(swipeProgress.value) > threshold || Math.abs(velocity) > 0.3) {
    if (swipeProgress.value > 0 && currentPage.value > 0) {
      // 向右滑，切换到上一页
      currentPage.value--
      emit('pageChange', currentPage.value)
    } else if (swipeProgress.value < 0 && currentPage.value < props.pages.length - 1) {
      // 向左滑，切换到下一页
      currentPage.value++
      emit('pageChange', currentPage.value)
    }
  }
  
  // 重置滑动进度
  swipeProgress.value = 0
  isSwiping.value = false
  isHorizontalSwipe = null
}


// 触摸事件处理
function onTouchStart(e: TouchEvent) {
  handleStart(e.touches[0].clientX, e.touches[0].clientY)
}

function onTouchMove(e: TouchEvent) {
  handleMove(e.touches[0].clientX, e.touches[0].clientY)
  // 水平滑动时阻止默认滚动
  if (isHorizontalSwipe === true) {
    e.preventDefault()
  }
}

function onTouchEnd() {
  handleEnd()
}

// 鼠标事件处理
function onMouseDown(e: MouseEvent) {
  handleStart(e.clientX, e.clientY)
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

function onMouseMove(e: MouseEvent) {
  handleMove(e.clientX, e.clientY)
}

function onMouseUp() {
  handleEnd()
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
}

// 处理 App 打开
function handleOpen(app: AppItem, event: MouseEvent | TouchEvent) {
  if (!props.isEditMode) {
    emit('open', app, event)
  }
}

// 处理图标引用
function handleIconRef(appId: string, el: HTMLElement | null) {
  emit('iconRef', appId, el)
}

// 处理长按事件
function handleLongPress(app: AppItem, appIndex: number, event: MouseEvent | TouchEvent, pageIndex: number) {
  emit('longPress', app, pageIndex, appIndex, event)
}

// 处理页面内 App 顺序更新
function handleUpdateApps(pageIndex: number, apps: AppItem[]) {
  emit('updatePageApps', pageIndex, apps)
}

// 切换到指定页面
function goToPage(pageIndex: number) {
  if (pageIndex >= 0 && pageIndex < props.pages.length) {
    currentPage.value = pageIndex
    emit('pageChange', pageIndex)
  }
}

// 切换到上一页
function prevPage() {
  if (currentPage.value > 0) {
    currentPage.value--
    emit('pageChange', currentPage.value)
  }
}

// 切换到下一页
function nextPage() {
  if (currentPage.value < props.pages.length - 1) {
    currentPage.value++
    emit('pageChange', currentPage.value)
  }
}

onMounted(() => {
  const el = containerRef.value
  if (!el) return
  
  el.addEventListener('touchstart', onTouchStart, { passive: true })
  el.addEventListener('touchmove', onTouchMove, { passive: false })
  el.addEventListener('touchend', onTouchEnd)
})

onUnmounted(() => {
  const el = containerRef.value
  if (!el) return
  
  el.removeEventListener('touchstart', onTouchStart)
  el.removeEventListener('touchmove', onTouchMove)
  el.removeEventListener('touchend', onTouchEnd)
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
})

// 暴露方法供外部调用
defineExpose({
  goToPage,
  prevPage,
  nextPage,
  currentPage,
  containerRef,
})
</script>

<template>
  <div class="desktop-pages" :class="{ 'is-edit-mode': isEditMode }">
    <!-- 页面容器 -->
    <div
      ref="containerRef"
      class="pages-container"
      @mousedown="onMouseDown"
    >
      <div
        class="pages-wrapper"
        :class="{ 'is-swiping': isSwiping && !isEditMode }"
        :style="{ transform: `translateX(${translateX}%)` }"
      >
        <div
          v-for="(page, pageIndex) in pages"
          :key="page.id"
          class="page"
        >
          <AppGrid
            :apps="page.apps"
            :columns="columns"
            :is-edit-mode="isEditMode"
            :page-index="pageIndex"
            @open="handleOpen"
            @icon-ref="handleIconRef"
            @long-press="(app, idx, e) => handleLongPress(app, idx, e, pageIndex)"
            @update:apps="(apps) => handleUpdateApps(pageIndex, apps)"
          />
        </div>
      </div>
    </div>
    
    <!-- 边缘指示器（编辑模式下显示） -->
    <div v-if="isEditMode" class="edge-indicators">
      <div class="edge-indicator left" :class="{ 'can-switch': currentPage > 0 }" />
      <div class="edge-indicator right" :class="{ 'can-switch': currentPage < pages.length - 1 }" />
    </div>
    
    <!-- 页面指示器 -->
    <PageIndicator
      v-if="pages.length > 1"
      :total="pages.length"
      :current="currentPage"
      :progress="swipeProgress"
    />
  </div>
</template>

<style scoped>
.desktop-pages {
  @apply flex-1 flex flex-col overflow-hidden relative;
}

.pages-container {
  @apply flex-1 overflow-hidden;
  touch-action: pan-y;
}

.desktop-pages.is-edit-mode .pages-container {
  touch-action: none;
}

.pages-wrapper {
  @apply h-full flex;
  transition: transform 0.3s cubic-bezier(0.25, 0.1, 0.25, 1);
}

.pages-wrapper.is-swiping {
  transition: none;
}

.page {
  @apply h-full flex-shrink-0;
  width: 100%;
}

/* 边缘指示器 */
.edge-indicators {
  @apply absolute inset-y-0 left-0 right-0 pointer-events-none;
}

.edge-indicator {
  @apply absolute top-0 bottom-0 w-12 opacity-0 transition-opacity;
}

.edge-indicator.left {
  @apply left-0;
  background: linear-gradient(to right, rgba(255,255,255,0.2), transparent);
}

.edge-indicator.right {
  @apply right-0;
  background: linear-gradient(to left, rgba(255,255,255,0.2), transparent);
}

.edge-indicator.can-switch {
  @apply opacity-30;
}
</style>