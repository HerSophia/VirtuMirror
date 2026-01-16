<script setup lang="ts">
/**
 * 提示词应用主布局
 * 仅作为路由容器
 */
</script>

<template>
  <div class="prompts-app-layout">
    <router-view v-slot="{ Component }">
      <keep-alive include="PromptsHome">
        <component :is="Component" />
      </keep-alive>
    </router-view>
  </div>
</template>

<style scoped>
.prompts-app-layout {
  @apply h-full w-full overflow-hidden;
  background: var(--color-background);
}
</style>
