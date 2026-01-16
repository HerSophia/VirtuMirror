<script setup lang="ts">
/**
 * 桌面网格组件 - 静态布局版本
 * 取消了拖拽排序功能，改为使用一键整理
 */
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import AppBlock from './AppBlock.vue'
import type { DesktopItem, AppItem, GroupItem, WidgetItem } from '../types'

const props = withDefaults(defineProps<{
  /** 桌面布局项 */
  items: DesktopItem[]
  /** 是否处于编辑模式 */
  isEditMode?: boolean
  /** 列数 */
  columns?: number
  /** 页面索引（用于区分不同页面） */
  pageIndex?: number
  /** 是否为当前激活的页面 */
  isActive?: boolean
}>(), {
  isEditMode: false,
  columns: 4,
  pageIndex: 0,
  isActive: true,
})

const emit = defineEmits<{
  open: [item: AppItem, event: MouseEvent | TouchEvent]
  iconRef: [appId: string, el: HTMLElement | null]
  /** 长按触发（显示快捷菜单） */
  longPress: [item: DesktopItem, event: MouseEvent | TouchEvent]
  /** 长按后拖拽（进入编辑模式） */
  longPressDrag: [item: DesktopItem, event: MouseEvent | TouchEvent]
  deleteApp: [item: AppItem]
}>()

// 网格容器引用
const gridRef = ref<HTMLElement | null>(null)

// 本地布局数据
const localItems = computed(() => props.items)

/**
 * 处理点击 App
 */
function handleOpen(item: AppItem, event: MouseEvent | TouchEvent) {
  // 编辑模式不触发打开
  if (props.isEditMode) return
  emit('open', item, event)
}

/**
 * 处理长按（显示快捷菜单）
 */
function handleLongPress(item: DesktopItem, event: MouseEvent | TouchEvent) {
  emit('longPress', item, event)
}

/**
 * 处理长按后拖拽（进入编辑模式）
 */
function handleLongPressDrag(item: DesktopItem, event: MouseEvent | TouchEvent) {
  emit('longPressDrag', item, event)
}

/**
 * 收集图标引用
 */
function setIconRef(appId: string, el: HTMLElement | null) {
  emit('iconRef', appId, el)
}

/**
 * 处理删除 App
 */
function handleDeleteApp(item: AppItem) {
  emit('deleteApp', item)
}
</script>

<template>
  <div class="desktop-grid-wrapper">
    <div ref="gridRef" class="desktop-grid" :style="{ '--columns': columns }">
      <div
        v-for="item in localItems"
        :key="item.id"
        class="grid-item"
        :style="{
          '--w': item.w,
          '--h': item.h,
        }"
      >
        <!-- 分组框 -->
        <div v-if="item.type === 'group'" class="group-box">
          <div class="group-header">
            <span>{{ (item as GroupItem).title }}</span>
          </div>
          
          <!-- 分组内的 App -->
          <div class="group-grid">
            <div
              v-for="subItem in (item as GroupItem).children"
              :key="subItem.id"
              class="group-item"
            >
              <AppBlock
                :app="{
                  id: subItem.id,
                  type: subItem.type,
                  iconId: subItem.iconId,
                  w: subItem.w,
                  h: subItem.h,
                  name: subItem.name,
                  route: subItem.route,
                  badge: subItem.badge,
                  icon: subItem.icon,
                }"
                :is-edit-mode="isEditMode"
                :show-name="false"
                @click="(e) => handleOpen(subItem, e)"
                @long-press="(e) => handleLongPress(subItem, e)"
              />
            </div>
          </div>
        </div>

        <!-- 普通 App 图标 -->
        <div
          v-else-if="item.type === 'app'"
          :ref="(el) => setIconRef((item as AppItem).iconId as string, el as HTMLElement)"
          class="app-icon-wrapper"
        >
          <AppBlock
            :app="item as AppItem"
            :is-edit-mode="isEditMode"
            @click="(e) => handleOpen(item as AppItem, e)"
            @long-press="(e) => handleLongPress(item, e)"
            @long-press-drag="(e) => handleLongPressDrag(item, e)"
            @delete="handleDeleteApp"
          />
        </div>

        <!-- 小组件 -->
        <div v-else class="widget-card">
          <div class="widget-content">
            {{ (item as WidgetItem).content || '小组件' }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.desktop-grid-wrapper {
  @apply flex-1 overflow-hidden p-2 pt-12;
}

.desktop-grid {
  display: grid;
  grid-template-columns: repeat(var(--columns, 4), 1fr);
  gap: 8px;
  padding: 4px;
}

.grid-item {
  grid-column: span var(--w, 1);
  grid-row: span var(--h, 1);
  min-height: 84px;
}

/* 分组框样式 */
.group-box {
  @apply h-full flex flex-col;
  @apply bg-white/20 backdrop-blur-md rounded-2xl;
  @apply border border-white/10;
  @apply shadow-lg;
}

.group-header {
  @apply px-3 py-2 flex justify-between items-center;
  @apply text-sm font-medium text-white/80;
  @apply bg-white/10 rounded-t-2xl;
  @apply border-b border-white/10;
}

.group-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
  padding: 8px;
}

.group-item {
  @apply flex items-center justify-center;
}

/* App 图标容器 */
.app-icon-wrapper {
  @apply w-full h-full flex items-center justify-center;
}

/* 小组件样式 */
.widget-card {
  @apply w-full h-full rounded-2xl;
  @apply bg-gradient-to-br from-blue-500 to-purple-600;
  @apply flex items-center justify-center;
  @apply text-white font-bold;
  @apply shadow-lg;
}

.widget-content {
  @apply text-center;
}
</style>
