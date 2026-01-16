<script setup lang="ts">
/**
 * 应用商店头部组件
 */
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'

const props = withDefaults(defineProps<{
  title: string
  showBack?: boolean
  showSearch?: boolean
  showManage?: boolean
}>(), {
  showBack: false,
  showSearch: false,
  showManage: true
})

const emit = defineEmits<{
  search: [query: string]
  back: []
}>()

const router = useRouter()

// 搜索相关
const isSearching = ref(false)
const searchQuery = ref('')

// 监听搜索输入
watch(searchQuery, (query) => {
  emit('search', query)
})

// 开始搜索
function startSearch() {
  isSearching.value = true
}

// 取消搜索
function cancelSearch() {
  isSearching.value = false
  searchQuery.value = ''
  emit('search', '')
}

// 返回
function goBack() {
  emit('back')
  router.back()
}

// 跳转到已安装管理
function goToManage() {
  router.push({ name: 'InstalledApps' })
}
</script>

<template>
  <header class="app-store-header">
    <div v-if="!isSearching" class="header-normal">
      <!-- 左侧返回按钮 -->
      <button
        v-if="showBack"
        class="back-btn"
        @click="goBack"
      >
        <i class="fas fa-chevron-left"></i>
      </button>
      
      <!-- 标题 -->
      <h1 class="header-title" :class="{ 'no-margin': !showBack }">
        {{ title }}
      </h1>
      
      <!-- 右侧操作 -->
      <div class="header-actions">
        <button
          v-if="showSearch"
          class="action-btn"
          @click="startSearch"
        >
          <i class="fas fa-search"></i>
        </button>
        <button
          v-if="showManage"
          class="action-btn"
          @click="goToManage"
        >
          <i class="fas fa-th-large"></i>
        </button>
      </div>
    </div>
    
    <div v-else class="header-search">
      <div class="search-input-wrapper">
        <i class="fas fa-search search-icon"></i>
        <input
          v-model="searchQuery"
          type="text"
          class="search-input"
          placeholder="搜索应用..."
          autofocus
        />
        <button
          v-if="searchQuery"
          class="clear-btn"
          @click="searchQuery = ''"
        >
          <i class="fas fa-times-circle"></i>
        </button>
      </div>
      <button class="cancel-btn" @click="cancelSearch">
        取消
      </button>
    </div>
  </header>
</template>

<style scoped>
.app-store-header {
  @apply flex-shrink-0 px-5 py-4;
  background: var(--color-background);
}

.header-normal {
  @apply flex items-center;
}

.back-btn {
  @apply w-8 h-8 flex items-center justify-center rounded-full mr-2;
  @apply text-lg;
  color: var(--color-primary);
}

.back-btn:active {
  background: var(--color-surface-variant);
}

.header-title {
  @apply flex-1 text-2xl font-bold truncate;
  color: var(--color-text);
  letter-spacing: -0.5px;
}

.header-title.no-margin {
  margin-left: 0;
}

.header-actions {
  @apply flex items-center gap-2;
}

.action-btn {
  @apply w-9 h-9 flex items-center justify-center rounded-full;
  color: var(--color-primary);
}

.action-btn:active {
  background: var(--color-surface-variant);
}

/* 搜索状态 */
.header-search {
  @apply flex items-center gap-3;
}

.search-input-wrapper {
  @apply flex-1 relative flex items-center;
  background: var(--color-surface-variant);
  border-radius: 10px;
  padding: 0 12px;
}

.search-icon {
  @apply text-sm mr-2;
  color: var(--color-text-secondary);
}

.search-input {
  @apply flex-1 py-2 bg-transparent outline-none text-sm;
  color: var(--color-text);
}

.search-input::placeholder {
  color: var(--color-text-secondary);
}

.clear-btn {
  @apply p-1;
  color: var(--color-text-secondary);
}

.cancel-btn {
  @apply text-sm whitespace-nowrap;
  color: var(--color-primary);
}
</style>