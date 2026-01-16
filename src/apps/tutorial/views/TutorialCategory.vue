<script setup lang="ts">
/**
 * 教程分类页面
 * 显示某个分类下的所有教程
 */
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { TutorialHeader, TutorialCard } from '../components'
import { getCategoryById, getTutorialsByCategory } from '../data/tutorials'

const route = useRoute()
const router = useRouter()

// 获取分类ID
const categoryId = computed(() => route.params.categoryId as string)

// 获取分类信息
const category = computed(() => getCategoryById(categoryId.value))

// 获取该分类下的教程
const tutorials = computed(() => getTutorialsByCategory(categoryId.value))

// 导航到教程详情
function goToTutorial(tutorialId: string) {
  router.push({ name: 'TutorialDetail', params: { tutorialId } })
}
</script>

<template>
  <div class="tutorial-category">
    <TutorialHeader 
      :title="category?.name || '分类'"
      :show-back="true"
    />
    
    <div class="category-content">
      <!-- 分类头部 -->
      <div v-if="category" class="category-header">
        <div class="header-icon">{{ category.icon }}</div>
        <div class="header-info">
          <h2 class="header-title">{{ category.name }}</h2>
          <p v-if="category.description" class="header-desc">
            {{ category.description }}
          </p>
          <span class="header-count">共 {{ tutorials.length }} 篇教程</span>
        </div>
      </div>
      
      <!-- 教程列表 -->
      <div class="tutorial-list">
        <TutorialCard
          v-for="tutorial in tutorials"
          :key="tutorial.id"
          :tutorial="tutorial"
          @click="goToTutorial(tutorial.id)"
        />
      </div>
      
      <!-- 空状态 -->
      <div v-if="tutorials.length === 0" class="empty-state">
        <div class="empty-icon">📭</div>
        <p class="empty-text">该分类下暂无教程</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tutorial-category {
  @apply h-full flex flex-col;
  background: var(--color-background);
}

.category-content {
  @apply flex-1 overflow-y-auto p-4;
}

.category-header {
  @apply flex items-center gap-4 p-4 mb-4;
  background: var(--color-surface);
  border-radius: 16px;
}

.header-icon {
  @apply text-5xl;
}

.header-info {
  @apply flex-1;
}

.header-title {
  @apply text-xl font-bold;
  color: var(--color-text);
}

.header-desc {
  @apply text-sm mt-1;
  color: var(--color-text-secondary);
}

.header-count {
  @apply text-xs mt-2 inline-block px-2 py-1 rounded-full;
  background: var(--color-surface-variant);
  color: var(--color-text-secondary);
}

.tutorial-list {
  @apply flex flex-col gap-3;
}

.empty-state {
  @apply text-center py-12;
}

.empty-icon {
  @apply text-5xl mb-4;
}

.empty-text {
  color: var(--color-text-secondary);
}
</style>