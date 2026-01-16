<template>
  <div class="source-badge" :class="source.type">
    <span class="icon">{{ icon }}</span>
    <span class="label">{{ label }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { AppSourceInfo } from '@/types/appIdentity'

const props = defineProps<{
  source: AppSourceInfo
}>()

const icon = computed(() => {
  switch (props.source.type) {
    case 'builtin':
      return '📦'
    case 'repository':
      return '🏪'
    case 'url':
      return '🔗'
    case 'local':
      return '📁'
    default:
      return '❓'
  }
})

const label = computed(() => {
  switch (props.source.type) {
    case 'builtin':
      return '内置应用'
    case 'repository':
      return '应用商店'
    case 'url': {
      try {
        const url = (props.source as { url: string }).url
        return `来自 ${new URL(url).hostname}`
      } catch {
        return 'URL 导入'
      }
    }
    case 'local':
      return '本地导入'
    default:
      return '未知来源'
  }
})
</script>

<style scoped>
.source-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
}

.source-badge.builtin {
  background: #e8f5e9;
  color: #2e7d32;
}

.source-badge.repository {
  background: #e3f2fd;
  color: #1565c0;
}

.source-badge.url {
  background: #fff3e0;
  color: #ef6c00;
}

.source-badge.local {
  background: #ffebee;
  color: #c62828;
}
</style>
