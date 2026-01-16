<script setup lang="ts">
/**
 * Chat App 统一头部组件
 */
import { useRouter } from 'vue-router'

interface Props {
  /** 标题文字 */
  title?: string
  /** 是否显示返回按钮 */
  showBack?: boolean
  /** 返回的目标路由，默认使用 router.back() */
  backTo?: string
  /** 背景颜色 */
  bgColor?: string
  /** 是否显示搜索按钮 */
  showSearch?: boolean
  /** 是否显示添加按钮 */
  showAdd?: boolean
  /** 是否显示更多按钮 */
  showMore?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  showBack: true,
  backTo: '',
  bgColor: '#ededed',
  showSearch: false,
  showAdd: false,
  showMore: false
})

const emit = defineEmits<{
  (e: 'back'): void
  (e: 'search'): void
  (e: 'add'): void
  (e: 'more'): void
}>()

const router = useRouter()

function handleBack() {
  emit('back')
  if (props.backTo) {
    router.push(props.backTo)
  } else {
    router.back()
  }
}
</script>

<template>
  <div class="chat-header" :style="{ backgroundColor: bgColor }">
    <div class="header-left">
      <button v-if="showBack" class="header-btn back-btn" @click="handleBack">
        <i class="fas fa-chevron-left" />
      </button>
      <span v-if="title" class="header-title">{{ title }}</span>
      <slot name="left" />
    </div>
    
    <div class="header-center">
      <slot name="center" />
    </div>
    
    <div class="header-right">
      <slot name="right" />
      <button v-if="showSearch" class="header-btn" @click="emit('search')">
        <i class="fas fa-search" />
      </button>
      <button v-if="showAdd" class="header-btn" @click="emit('add')">
        <i class="fas fa-plus-circle" />
      </button>
      <button v-if="showMore" class="header-btn" @click="emit('more')">
        <i class="fas fa-ellipsis-h" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.chat-header {
  @apply flex items-center justify-between px-4 py-3;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  min-height: 56px;
}

.header-left {
  @apply flex items-center gap-2;
  min-width: 80px;
}

.header-center {
  @apply flex-1 flex items-center justify-center;
}

.header-right {
  @apply flex items-center gap-3;
  min-width: 80px;
  justify-content: flex-end;
}

.header-title {
  @apply text-lg font-medium;
  color: #111;
}

.header-btn {
  @apply w-8 h-8 flex items-center justify-center rounded-full transition-colors;
  color: #111;
}

.header-btn:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.back-btn {
  @apply text-sm;
}
</style>