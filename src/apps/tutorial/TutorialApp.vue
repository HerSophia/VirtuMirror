<script setup lang="ts">
/**
 * Tutorial 教程应用主入口
 * 负责页面整体布局和子路由管理
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { TutorialHeader } from './components'
import { TutorialHome } from './views'

const route = useRoute()

// 是否有子路由
const hasSubRoute = computed(() => {
  return route.matched.length > 1 && route.name !== 'TutorialApp'
})
</script>

<template>
  <div class="tutorial-app">
    <!-- 子路由视图 -->
    <router-view v-if="hasSubRoute" />
    
    <!-- 默认首页 -->
    <template v-else>
      <TutorialHeader title="使用帮助" />
      <TutorialHome />
    </template>
  </div>
</template>

<style scoped>
.tutorial-app {
  @apply h-full flex flex-col;
  background: var(--color-background);
}
</style>