<script setup lang="ts">
/**
 * 教程首页视图
 * 显示所有教程分类和推荐教程
 */
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { CategoryCard, TutorialCard } from '../components'
import { getAllCategories, getTutorialsByCategory, tutorials } from '../data/tutorials'

const router = useRouter()

// 获取所有分类
const categories = computed(() => getAllCategories())

// 获取每个分类的教程数量
function getCategoryCount(categoryId: string): number {
  return getTutorialsByCategory(categoryId).length
}

// 推荐教程（取前3个）
const featuredTutorials = computed(() => {
  return tutorials.slice(0, 3)
})

// 导航到分类详情
function goToCategory(categoryId: string) {
  router.push({ name: 'TutorialCategory', params: { categoryId } })
}

// 导航到教程详情
function goToTutorial(tutorialId: string) {
  router.push({ name: 'TutorialDetail', params: { tutorialId } })
}
</script>

<template>
  <div class="tutorial-home">
    <!-- 欢迎区域 -->
    <div class="welcome-section">
      <div class="welcome-icon">📖</div>
      <h2 class="welcome-title">使用帮助</h2>
      <p class="welcome-text">了解如何使用小手机的各项功能</p>
    </div>

    <!-- 推荐教程 -->
    <section class="section">
      <h3 class="section-title">快速开始</h3>
      <div class="tutorial-list">
        <TutorialCard
          v-for="tutorial in featuredTutorials"
          :key="tutorial.id"
          :tutorial="tutorial"
          @click="goToTutorial(tutorial.id)"
        />
      </div>
    </section>

    <!-- 分类列表 -->
    <section class="section">
      <h3 class="section-title">所有分类</h3>
      <div class="category-list">
        <CategoryCard
          v-for="category in categories"
          :key="category.id"
          :category="category"
          :count="getCategoryCount(category.id)"
          @click="goToCategory(category.id)"
        />
      </div>
    </section>
  </div>
</template>

<style scoped>
.tutorial-home {
  @apply flex-1 overflow-y-auto;
}

.welcome-section {
  @apply text-center py-8 px-4;
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dark, var(--color-primary)));
  color: white;
}

.welcome-icon {
  @apply text-5xl mb-2;
}

.welcome-title {
  @apply text-2xl font-bold;
}

.welcome-text {
  @apply mt-1 opacity-90;
}

.section {
  @apply p-4;
}

.section-title {
  @apply text-lg font-bold mb-3;
  color: var(--color-text);
}

.tutorial-list {
  @apply flex flex-col gap-3;
}

.category-list {
  @apply flex flex-col gap-3;
}
</style>