<script setup lang="ts">
/**
 * 已连接平台分区
 * 显示当前连接的平台（单平台模式）
 */
import { computed } from 'vue'
import { useBridge } from '../composables/useBridge'
import { SettingsGroup } from '@/apps/settings/components'
import PlatformCard from '../components/PlatformCard.vue'

const { status, requestSync } = useBridge()

// 单平台模式：只有一个平台或没有
const platform = computed(() => status.value.platform)

function handleSync() {
  requestSync(10)
}
</script>

<template>
  <SettingsGroup title="已连接平台">
    <div class="platforms-section">
      <template v-if="platform">
        <PlatformCard
          :platform="platform"
          :active="true"
          @sync="handleSync"
        />
      </template>

      <div v-else class="empty-state">
        <div class="empty-icon">
          <i class="fas fa-plug" />
        </div>
        <div class="empty-text">
          <p class="empty-title">暂无平台连接</p>
          <p class="empty-subtitle">
            {{ status.connected 
              ? '等待酒馆等平台连接...' 
              : '请先连接到 Bridge 服务器' 
            }}
          </p>
          <p v-if="status.connected" class="empty-hint">
            在酒馆助手中运行桥接脚本即可连接
          </p>
        </div>
      </div>
    </div>
  </SettingsGroup>
</template>

<style scoped>
.platforms-section {
  @apply p-4 space-y-3;
}

.empty-state {
  @apply flex flex-col items-center justify-center py-8 text-center;
}

.empty-icon {
  @apply w-16 h-16 rounded-full flex items-center justify-center text-2xl mb-4;
  background-color: var(--color-surface-variant);
  color: var(--color-text-secondary);
}

.empty-title {
  @apply font-medium;
  color: var(--color-text);
}

.empty-subtitle {
  @apply text-sm mt-1;
  color: var(--color-text-secondary);
}

.empty-hint {
  @apply text-xs mt-2;
  color: var(--color-text-tertiary);
}
</style>
