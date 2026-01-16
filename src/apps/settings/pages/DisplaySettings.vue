<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { SettingsGroup, SettingsItem } from '../components'
import ScaleSection from '../sections/ScaleSection.vue'
import ThemeSection from '../sections/ThemeSection.vue'

const router = useRouter()

function goBack() {
  router.back()
}
</script>

<template>
  <div class="display-settings-page">
    <div class="page-header">
      <button class="back-btn" @click="goBack">
        <i class="fas fa-chevron-left"></i>
      </button>
      <h1 class="page-title">显示与亮度</h1>
    </div>
    
    <div class="page-content">
      <ThemeSection />
      <ScaleSection />
    </div>
  </div>
</template>

<style scoped>
.display-settings-page {
  @apply flex flex-col h-full bg-[var(--color-background)];
}

.page-header {
  @apply flex items-center px-4 py-3 border-b border-[var(--color-border)];
  background-color: var(--color-surface);
}

.back-btn {
  @apply p-2 -ml-2 rounded-full;
  color: var(--color-text);
}

.back-btn:active {
  background-color: var(--color-surface-variant);
}

.page-title {
  @apply ml-2 text-lg font-medium;
  color: var(--color-text);
}

.page-content {
  @apply flex-1 overflow-y-auto p-4 flex flex-col gap-6;
}
</style>
