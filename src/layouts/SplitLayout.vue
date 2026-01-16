<script setup lang="ts">
/**
 * 分屏布局组件
 * 支持平板/桌面模式下的主从面板布局
 * 手机模式下自动切换为单面板显示
 */

import { computed, watch } from 'vue'
import { useDeviceStore } from '@/stores/deviceStore'

interface Props {
  /** 默认显示的面板（仅手机模式有效） */
  defaultPane?: 'master' | 'detail'
  /** 是否显示分隔线 */
  showDivider?: boolean
  /** 主面板最小宽度 */
  masterMinWidth?: number
  /** 主面板最大宽度 */
  masterMaxWidth?: number
}

const props = withDefaults(defineProps<Props>(), {
  defaultPane: 'master',
  showDivider: true,
  masterMinWidth: 280,
  masterMaxWidth: 400,
})

const emit = defineEmits<{
  /** 面板切换事件 */
  (e: 'pane-change', pane: 'master' | 'detail'): void
}>()

const deviceStore = useDeviceStore()

// 计算当前应该显示的布局类
const layoutClass = computed(() => {
  if (deviceStore.isSplitView) {
    return 'split-view-mode'
  }
  return deviceStore.activePane === 'master' ? 'show-master' : 'show-detail'
})

// 计算主面板样式
const masterStyle = computed(() => {
  if (!deviceStore.isSplitView) {
    return {}
  }
  return {
    minWidth: `${props.masterMinWidth}px`,
    maxWidth: `${props.masterMaxWidth}px`,
  }
})

// 监听面板变化
watch(() => deviceStore.activePane, (newPane) => {
  emit('pane-change', newPane)
})

/**
 * 切换到详情面板（用于手机模式下的导航）
 */
function showDetail() {
  if (!deviceStore.isSplitView) {
    deviceStore.setActivePane('detail')
  }
}

/**
 * 切换到主面板（用于手机模式下的返回）
 */
function showMaster() {
  if (!deviceStore.isSplitView) {
    deviceStore.setActivePane('master')
  }
}

/**
 * 导航到详情页（通用方法）
 * 分屏模式下不改变面板状态，手机模式下切换到详情面板
 */
function navigateToDetail() {
  showDetail()
}

/**
 * 返回主页（通用方法）
 * 分屏模式下不改变面板状态，手机模式下切换到主面板
 */
function navigateBack() {
  showMaster()
}

// 暴露方法给父组件
defineExpose({
  showDetail,
  showMaster,
  navigateToDetail,
  navigateBack,
})
</script>

<template>
  <div 
    class="split-layout"
    :class="[layoutClass, { 'has-divider': showDivider && deviceStore.isSplitView }]"
  >
    <!-- 主面板（列表/导航） -->
    <aside 
      class="split-master"
      :style="masterStyle"
    >
      <slot name="master" :show-detail="showDetail" />
    </aside>

    <!-- 分隔线 -->
    <div 
      v-if="showDivider && deviceStore.isSplitView"
      class="split-divider"
    />

    <!-- 详情面板 -->
    <main class="split-detail">
      <slot name="detail" :show-master="showMaster" />

      <!-- 详情面板为空时的占位内容 -->
      <div 
        v-if="!$slots.detail"
        class="split-detail-placeholder"
      >
        <slot name="placeholder">
          <div class="placeholder-content">
            <i class="fas fa-inbox text-4xl text-gray-300 mb-4" />
            <p class="text-gray-400 text-sm">选择一项以查看详情</p>
          </div>
        </slot>
      </div>
    </main>
  </div>
</template>

<style scoped>
.split-layout {
  @apply flex w-full h-full relative;
  overflow: hidden;
}

/* 主面板 */
.split-master {
  @apply flex-shrink-0 h-full overflow-y-auto overflow-x-hidden;
  @apply bg-white;
  width: var(--master-width);
  transition: width 0.3s ease-out, 
              transform 0.3s ease-out,
              opacity 0.3s ease-out;
}

/* 详情面板 */
.split-detail {
  @apply flex-1 h-full overflow-y-auto overflow-x-hidden;
  @apply bg-phone-gray-50;
  min-width: 0;
}

/* 分隔线 */
.split-divider {
  @apply w-px h-full bg-phone-gray-200 flex-shrink-0;
}

/* 详情面板占位内容 */
.split-detail-placeholder {
  @apply w-full h-full flex items-center justify-center;
}

.placeholder-content {
  @apply flex flex-col items-center;
}

/* ==================== 分屏模式（平板/桌面） ==================== */
.split-view-mode .split-master {
  @apply block;
}

.split-view-mode .split-detail {
  @apply block;
}

/* ==================== 单屏模式（手机） ==================== */
/* 显示主面板 */
.show-master .split-master {
  @apply w-full;
  transform: translateX(0);
}

.show-master .split-detail {
  @apply absolute inset-0;
  transform: translateX(100%);
  opacity: 0;
  pointer-events: none;
}

.show-master .split-divider {
  @apply hidden;
}

/* 显示详情面板 */
.show-detail .split-master {
  @apply absolute inset-0;
  transform: translateX(-100%);
  opacity: 0;
  pointer-events: none;
}

.show-detail .split-detail {
  @apply w-full;
  transform: translateX(0);
}

.show-detail .split-divider {
  @apply hidden;
}

/* ==================== 过渡动画 ==================== */
.split-master,
.split-detail {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              opacity 0.3s ease-out,
              width 0.3s ease-out;
}

/* ==================== 设备特定样式 ==================== */
/* 手机模式下的全屏面板 */
:global([data-device="phone"]) .split-master,
:global([data-device="phone"]) .split-detail {
  @apply rounded-none;
}

/* 平板模式下的圆角 */
:global([data-device="tablet"]) .split-master {
  @apply rounded-l-lg;
}

:global([data-device="tablet"]) .split-detail {
  @apply rounded-r-lg;
}

/* 桌面模式下的样式 */
:global([data-device="desktop"]) .split-master {
  @apply border-r border-phone-gray-200;
}
</style>