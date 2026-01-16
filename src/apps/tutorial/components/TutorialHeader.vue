<script setup lang="ts">
/**
 * 教程应用头部组件
 */
import { useRouter } from 'vue-router'

interface Props {
  title?: string
  showBack?: boolean
  showSearch?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  title: '教程',
  showBack: false,
  showSearch: false
})

const emit = defineEmits<{
  'search': []
}>()

const router = useRouter()

function handleBack() {
  router.back()
}
</script>

<template>
  <div class="tutorial-header">
    <!-- 返回按钮 -->
    <button 
      v-if="showBack" 
      class="back-btn"
      @click="handleBack"
    >
      <span class="back-icon">←</span>
    </button>
    
    <!-- 标题 -->
    <h1 class="header-title" :class="{ 'with-back': showBack }">
      {{ title }}
    </h1>
    
    <!-- 搜索按钮 -->
    <button 
      v-if="showSearch" 
      class="search-btn"
      @click="emit('search')"
    >
      🔍
    </button>
  </div>
</template>

<style scoped>
.tutorial-header {
  @apply flex items-center px-4 py-3;
  background: var(--color-background);
  border-bottom: 1px solid var(--color-border);
}

.back-btn {
  @apply p-2 -ml-2 mr-2;
  color: var(--color-primary);
}

.back-icon {
  @apply text-xl;
}

.header-title {
  @apply flex-1 text-xl font-bold;
  color: var(--color-text);
}

.header-title.with-back {
  @apply text-lg font-semibold;
}

.search-btn {
  @apply p-2 -mr-2 text-lg;
}
</style>