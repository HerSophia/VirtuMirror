<script setup lang="ts">
/**
 * 教程详情页面
 * 显示单个教程的完整内容
 */
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { TutorialHeader } from '../components'
import { MarkdownRenderer } from '@/components/common'
import { getTutorialById, getCategoryById, getTutorialsByCategory } from '../data/tutorials'

const route = useRoute()
const router = useRouter()

// 获取教程ID
const tutorialId = computed(() => route.params.tutorialId as string)

// 获取教程信息
const tutorial = computed(() => getTutorialById(tutorialId.value))

// 获取分类信息
const category = computed(() => {
  if (!tutorial.value) return null
  return getCategoryById(tutorial.value.categoryId)
})

// 获取同分类的教程列表，用于导航
const categoryTutorials = computed(() => {
  if (!tutorial.value) return []
  return getTutorialsByCategory(tutorial.value.categoryId)
})

// 当前教程在列表中的索引
const currentIndex = computed(() => {
  return categoryTutorials.value.findIndex(t => t.id === tutorialId.value)
})

// 上一篇教程
const prevTutorial = computed(() => {
  if (currentIndex.value <= 0) return null
  return categoryTutorials.value[currentIndex.value - 1]
})

// 下一篇教程
const nextTutorial = computed(() => {
  if (currentIndex.value >= categoryTutorials.value.length - 1) return null
  return categoryTutorials.value[currentIndex.value + 1]
})

// 导航到其他教程
function goToTutorial(id: string) {
  router.push({ name: 'TutorialDetail', params: { tutorialId: id } })
}
</script>

<template>
  <div class="tutorial-detail">
    <TutorialHeader 
      :title="tutorial?.title || '教程'"
      :show-back="true"
    />
    
    <div class="detail-content">
      <template v-if="tutorial">
        <!-- 教程元信息 -->
        <div class="tutorial-meta">
          <span v-if="category" class="meta-category">
            {{ category.icon }} {{ category.name }}
          </span>
          <span v-if="tutorial.readTime" class="meta-time">
            📖 {{ tutorial.readTime }} 分钟阅读
          </span>
        </div>
        
        <!-- 标签 -->
        <div v-if="tutorial.tags?.length" class="tutorial-tags">
          <span 
            v-for="tag in tutorial.tags" 
            :key="tag" 
            class="tag"
          >
            {{ tag }}
          </span>
        </div>
        
        <!-- Markdown 内容 -->
        <div class="markdown-content">
          <MarkdownRenderer :content="tutorial.content" />
        </div>
        
        <!-- 导航按钮 -->
        <div class="tutorial-nav">
          <button 
            v-if="prevTutorial"
            class="nav-btn prev"
            @click="goToTutorial(prevTutorial.id)"
          >
            <span class="nav-direction">← 上一篇</span>
            <span class="nav-title">{{ prevTutorial.title }}</span>
          </button>
          <div v-else class="nav-placeholder"></div>
          
          <button 
            v-if="nextTutorial"
            class="nav-btn next"
            @click="goToTutorial(nextTutorial.id)"
          >
            <span class="nav-direction">下一篇 →</span>
            <span class="nav-title">{{ nextTutorial.title }}</span>
          </button>
        </div>
      </template>
      
      <!-- 加载失败 -->
      <div v-else class="error-state">
        <div class="error-icon">😕</div>
        <p class="error-text">找不到该教程</p>
        <button class="back-btn" @click="router.back()">返回</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tutorial-detail {
  @apply h-full flex flex-col;
  background: var(--color-background);
}

.detail-content {
  @apply flex-1 overflow-y-auto p-4;
}

.tutorial-meta {
  @apply flex items-center gap-3 mb-3 text-sm;
  color: var(--color-text-secondary);
}

.meta-category {
  @apply px-2 py-1 rounded-full;
  background: var(--color-surface-variant);
}

.tutorial-tags {
  @apply flex flex-wrap gap-2 mb-4;
}

.tag {
  @apply px-2 py-0.5 text-xs rounded-full;
  background: var(--color-primary);
  color: white;
  opacity: 0.9;
}

.markdown-content {
  @apply p-4 rounded-xl;
  background: var(--color-surface);
}

.tutorial-nav {
  @apply flex justify-between gap-4 mt-6 pt-4;
  border-top: 1px solid var(--color-border);
}

.nav-btn {
  @apply flex-1 p-3 rounded-lg text-left;
  background: var(--color-surface);
  max-width: 50%;
}

.nav-btn.next {
  @apply text-right;
}

.nav-btn:hover {
  background: var(--color-surface-variant);
}

.nav-direction {
  @apply block text-xs mb-1;
  color: var(--color-text-secondary);
}

.nav-title {
  @apply block text-sm font-medium truncate;
  color: var(--color-text);
}

.nav-placeholder {
  @apply flex-1;
}

.error-state {
  @apply text-center py-12;
}

.error-icon {
  @apply text-5xl mb-4;
}

.error-text {
  @apply mb-4;
  color: var(--color-text-secondary);
}

.back-btn {
  @apply px-4 py-2 rounded-lg;
  background: var(--color-primary);
  color: white;
}
</style>