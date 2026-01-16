<script setup lang="ts">
/**
 * 图库头部组件
 */
import { computed } from 'vue'
import { useRouter } from 'vue-router'

interface Props {
  title?: string
  showBack?: boolean
  showSearch?: boolean
  showMenu?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  title: '图库',
  showBack: false,
  showSearch: true,
  showMenu: true,
})

const emit = defineEmits<{
  search: []
  menu: []
}>()

const router = useRouter()

function goBack() {
  router.back()
}
</script>

<template>
  <header class="gallery-header">
    <div class="header-left">
      <button
        v-if="showBack"
        class="icon-btn"
        @click="goBack"
      >
        <i class="fas fa-arrow-left"></i>
      </button>
      <h1 class="title">{{ title }}</h1>
    </div>
    
    <div class="header-right">
      <button
        v-if="showSearch"
        class="icon-btn"
        @click="emit('search')"
      >
        <i class="fas fa-search"></i>
      </button>
      <button
        v-if="showMenu"
        class="icon-btn"
        @click="emit('menu')"
      >
        <i class="fas fa-ellipsis-v"></i>
      </button>
    </div>
  </header>
</template>

<style scoped>
.gallery-header {
  @apply flex items-center justify-between px-4 py-3;
  @apply border-b;
  background: var(--color-surface);
  border-color: var(--color-border);
}

.header-left {
  @apply flex items-center gap-3;
}

.header-right {
  @apply flex items-center gap-2;
}

.title {
  @apply text-lg font-semibold;
  color: var(--color-text);
}

.icon-btn {
  @apply w-9 h-9 flex items-center justify-center rounded-full;
  @apply transition-colors;
  color: var(--color-text);
}

.icon-btn:hover {
  background: var(--color-surface-variant);
}

.icon-btn:active {
  @apply scale-95;
}
</style>
