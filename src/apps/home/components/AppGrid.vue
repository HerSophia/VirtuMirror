<script setup lang="ts">
/**
 * App 图标网格组件（旧版本，逐步废弃）
 * 建议使用 DesktopGrid.vue 替代
 */
import { ref } from 'vue'
import { getAppIdFromRoute } from '@/stores/appStateStore'
import AppBlock from './AppBlock.vue'

interface AppItem {
  id: string
  name: string
  route: string
  badge?: number
}

const props = withDefaults(defineProps<{
  /** App 列表 */
  apps: AppItem[]
  /** 每行列数 */
  columns?: number
  /** 是否处于编辑模式 */
  isEditMode?: boolean
  /** 页面索引（用于错开抖动动画） */
  pageIndex?: number
}>(), {
  columns: 4,
  isEditMode: false,
  pageIndex: 0,
})

const emit = defineEmits<{
  open: [app: AppItem, event: MouseEvent | TouchEvent]
  iconRef: [appId: string, el: HTMLElement | null]
  longPress: [app: AppItem, appIndex: number, event: MouseEvent | TouchEvent]
  'update:apps': [apps: AppItem[]]
}>()

// 网格容器引用
const gridRef = ref<HTMLElement | null>(null)

function handleOpen(app: AppItem, event: MouseEvent | TouchEvent) {
  if (props.isEditMode) return
  emit('open', app, event)
}

/**
 * 收集图标元素引用
 */
function setIconRef(route: string, el: HTMLElement | null) {
  const appId = getAppIdFromRoute(route)
  emit('iconRef', appId, el)
}

/**
 * 处理长按（进入编辑模式）
 */
function handleLongPress(app: AppItem, index: number, event: MouseEvent | TouchEvent) {
  emit('longPress', app, index, event)
}

/**
 * 计算抖动延迟（错开动画效果）
 */
function getWobbleDelay(index: number): number {
  return ((props.pageIndex * 100 + index * 37) % 200)
}

// 暴露方法供外部调用
defineExpose({
  gridRef,
})
</script>

<template>
  <div
    ref="gridRef"
    class="app-grid"
    :class="{ 'is-edit-mode': isEditMode }"
    :style="{ gridTemplateColumns: `repeat(${columns}, 1fr)` }"
  >
    <div
      v-for="(app, index) in apps"
      :key="app.id"
      :ref="(el) => setIconRef(app.route, el as HTMLElement)"
      class="grid-item"
    >
      <AppBlock
        :app="app"
        :is-edit-mode="isEditMode"
        :wobble-delay="getWobbleDelay(index)"
        @click="(e: MouseEvent | TouchEvent) => handleOpen(app, e)"
        @long-press="(e: MouseEvent | TouchEvent) => handleLongPress(app, index, e)"
      />
    </div>
  </div>
</template>

<style scoped>
.app-grid {
  @apply flex-1 grid gap-x-4 gap-y-6 p-6 pt-12 content-start;
}

.app-grid.is-edit-mode {
  /* 编辑模式下可能需要的样式调整 */
}

.grid-item {
  @apply transition-all duration-200;
}
</style>