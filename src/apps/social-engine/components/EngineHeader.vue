<script setup lang="ts">
/**
 * 社交引擎头部组件
 */
import { useRouter } from 'vue-router';

const router = useRouter();

function goBack() {
  router.back();
}
</script>

<template>
  <header class="engine-header">
    <button class="back-btn" @click="goBack">
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
      </svg>
    </button>
    <div class="header-content">
      <h1 class="title">社交引擎</h1>
      <p class="subtitle">Social Media Engine</p>
    </div>
    <div class="header-icon">
      <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" 
          d="M21 12a9 9 0 01-9 9m9-9a 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
      </svg>
    </div>
  </header>
</template>

<style scoped>
.engine-header {
  @apply flex items-center gap-3 p-4;
  background: linear-gradient(135deg, var(--color-primary) 0%, #6366f1 100%);
  color: white;
}

.back-btn {
  @apply p-2 -ml-2 rounded-full transition-colors;
}

.back-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.header-content {
  @apply flex-1;
}

.title {
  @apply text-lg font-bold;
}

.subtitle {
  @apply text-xs opacity-80;
}

.header-icon {
  @apply opacity-60;
}
</style>
