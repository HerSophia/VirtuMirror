<script setup lang="ts">
/**
 * 图库应用
 * 
 * 功能：
 * - 管理本地、AI生成和图床图片
 * - 图片筛选、搜索和排序
 * - 图片详情查看
 * - 配置管理
 */
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useGalleryStore } from './stores'
import { GalleryHeader, ImageGrid, FilterBar } from './components'
import type { ImageSource, ImageSort, AnyImage } from './types'

const router = useRouter()
const store = useGalleryStore()

// ==================== 状态 ====================

/** 当前筛选的来源 */
const activeSource = ref<ImageSource | 'all' | 'favorite'>('all')

/** 当前排序 */
const currentSort = ref<ImageSort>({
  by: 'createdAt',
  order: 'desc',
})

/** 是否显示搜索 */
const showSearch = ref(false)

/** 搜索文本 */
const searchText = ref('')

/** 是否选择模式 */
const selectionMode = ref(false)

/** 是否显示菜单 */
const showMenu = ref(false)

// ==================== 计算属性 ====================

/** 根据来源和搜索筛选后的图片 */
const displayImages = computed(() => {
  // 先根据来源筛选
  if (activeSource.value === 'all') {
    store.setFilter({ searchText: searchText.value || undefined })
  } else if (activeSource.value === 'favorite') {
    store.setFilter({ favorite: true, searchText: searchText.value || undefined })
  } else {
    store.setFilter({ source: activeSource.value, searchText: searchText.value || undefined })
  }
  
  store.setSort(currentSort.value)
  return store.filteredImages
})

/** 标题 */
const title = computed(() => {
  if (selectionMode.value) {
    return `已选择 ${store.selectedIds.length} 项`
  }
  return '图库'
})

// ==================== 方法 ====================

/** 初始化 */
onMounted(async () => {
  await store.init()
})

/** 点击图片 */
function handleImageClick(image: AnyImage) {
  router.push({ name: 'GalleryDetail', params: { imageId: image.id } })
}

/** 选择图片 */
function handleImageSelect(image: AnyImage) {
  store.toggleSelect(image.id)
}

/** 长按图片 */
function handleImageLongPress(image: AnyImage) {
  selectionMode.value = true
  store.selectImage(image.id)
}

/** 打开搜索 */
function openSearch() {
  showSearch.value = true
}

/** 关闭搜索 */
function closeSearch() {
  showSearch.value = false
  searchText.value = ''
}

/** 打开菜单 */
function openMenu() {
  showMenu.value = true
}

/** 关闭菜单 */
function closeMenu() {
  showMenu.value = false
}

/** 取消选择模式 */
function cancelSelection() {
  selectionMode.value = false
  store.clearSelection()
}

/** 删除选中的图片 */
async function deleteSelected() {
  if (store.selectedIds.length === 0) return
  
  if (confirm(`确定要删除 ${store.selectedIds.length} 张图片吗？`)) {
    await store.deleteImages([...store.selectedIds])
    cancelSelection()
  }
}

/** 收藏选中的图片 */
async function favoriteSelected() {
  for (const id of store.selectedIds) {
    await store.toggleFavorite(id)
  }
  cancelSelection()
}

/** 打开设置 */
function openSettings() {
  closeMenu()
  router.push({ name: 'GallerySettings' })
}

/** 加载本地资源 */
async function loadResources() {
  closeMenu()
  await store.loadLocalResources()
}
</script>

<template>
  <div class="gallery-app">
    <!-- 头部 -->
    <GalleryHeader
      v-if="!showSearch && !selectionMode"
      :title="title"
      @search="openSearch"
      @menu="openMenu"
    />
    
    <!-- 搜索栏 -->
    <div v-if="showSearch" class="search-bar">
      <button class="icon-btn" @click="closeSearch">
        <i class="fas fa-arrow-left"></i>
      </button>
      <input
        v-model="searchText"
        type="text"
        class="search-input"
        placeholder="搜索图片..."
        autofocus
      />
      <button v-if="searchText" class="icon-btn" @click="searchText = ''">
        <i class="fas fa-times"></i>
      </button>
    </div>
    
    <!-- 选择模式工具栏 -->
    <div v-if="selectionMode" class="selection-bar">
      <button class="icon-btn" @click="cancelSelection">
        <i class="fas fa-times"></i>
      </button>
      <span class="selection-title">{{ title }}</span>
      <div class="selection-actions">
        <button class="icon-btn" @click="favoriteSelected" title="收藏">
          <i class="fas fa-heart"></i>
        </button>
        <button class="icon-btn danger" @click="deleteSelected" title="删除">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    </div>
    
    <!-- 筛选栏 -->
    <FilterBar
      v-if="!selectionMode"
      v-model:active-source="activeSource"
      v-model:current-sort="currentSort"
    />
    
    <!-- 图片网格 -->
    <ImageGrid
      :images="displayImages"
      :selection-mode="selectionMode"
      :selected-ids="store.selectedIds"
      :columns="3"
      @image-click="handleImageClick"
      @image-select="handleImageSelect"
      @image-long-press="handleImageLongPress"
    />
    
    <!-- 加载状态 -->
    <div v-if="store.loading" class="loading-overlay">
      <div class="loading-spinner">
        <i class="fas fa-spinner fa-spin"></i>
        <span>加载中...</span>
      </div>
    </div>
    
    <!-- 统计信息 -->
    <div class="stats-bar">
      <span>共 {{ store.stats.total }} 张</span>
      <span v-if="store.stats.local > 0">本地 {{ store.stats.local }}</span>
      <span v-if="store.stats.generated > 0">生成 {{ store.stats.generated }}</span>
      <span v-if="store.stats.remote > 0">图床 {{ store.stats.remote }}</span>
    </div>
    
    <!-- 菜单弹窗 -->
    <div v-if="showMenu" class="menu-overlay" @click="closeMenu">
      <div class="menu-sheet" @click.stop>
        <div class="menu-item" @click="loadResources">
          <i class="fas fa-sync-alt"></i>
          <span>加载本地资源</span>
        </div>
        <div class="menu-item" @click="openSettings">
          <i class="fas fa-cog"></i>
          <span>图库设置</span>
        </div>
        <div class="menu-divider"></div>
        <div class="menu-item" @click="closeMenu">
          <span>取消</span>
        </div>
      </div>
    </div>
    
    <!-- 子路由 -->
    <router-view />
  </div>
</template>

<style scoped>
.gallery-app {
  @apply h-full flex flex-col relative;
  background: var(--color-background);
}

/* 搜索栏 */
.search-bar {
  @apply flex items-center gap-2 px-2 py-2;
  @apply border-b;
  background: var(--color-surface);
  border-color: var(--color-border);
}

.search-input {
  @apply flex-1 px-3 py-2 rounded-full;
  @apply text-sm outline-none;
  background: var(--color-surface-variant);
  color: var(--color-text);
}

.search-input::placeholder {
  color: var(--color-text-secondary);
}

/* 选择模式工具栏 */
.selection-bar {
  @apply flex items-center justify-between px-2 py-2;
  @apply border-b;
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: white;
}

.selection-title {
  @apply font-medium;
}

.selection-actions {
  @apply flex items-center gap-1;
}

/* 图标按钮 */
.icon-btn {
  @apply w-10 h-10 flex items-center justify-center rounded-full;
  @apply transition-colors;
  color: inherit;
}

.icon-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.icon-btn.danger {
  color: #ff3b30;
}

/* 加载状态 */
.loading-overlay {
  @apply absolute inset-0 flex items-center justify-center;
  background: rgba(0, 0, 0, 0.5);
  z-index: 100;
}

.loading-spinner {
  @apply flex flex-col items-center gap-2;
  color: white;
}

.loading-spinner i {
  @apply text-3xl;
}

/* 统计栏 */
.stats-bar {
  @apply flex items-center justify-center gap-4 px-4 py-2;
  @apply text-xs;
  @apply border-t;
  background: var(--color-surface);
  border-color: var(--color-border);
  color: var(--color-text-secondary);
}

/* 菜单 */
.menu-overlay {
  @apply fixed inset-0 flex items-end justify-center;
  background: rgba(0, 0, 0, 0.5);
  z-index: 200;
}

.menu-sheet {
  @apply w-full max-w-md rounded-t-2xl overflow-hidden;
  background: var(--color-surface);
}

.menu-item {
  @apply flex items-center gap-3 px-5 py-4;
  @apply cursor-pointer transition-colors;
  color: var(--color-text);
}

.menu-item:hover {
  background: var(--color-surface-variant);
}

.menu-item i {
  @apply w-5 text-center;
  color: var(--color-text-secondary);
}

.menu-divider {
  @apply h-px;
  background: var(--color-border);
}
</style>
