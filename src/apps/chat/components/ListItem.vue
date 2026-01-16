<script setup lang="ts">
/**
 * 通用列表项组件
 * 用于消息列表、联系人列表、设置列表等
 */

interface Props {
  /** 头像 URL */
  avatar?: string
  /** 头像替代文字 */
  avatarAlt?: string
  /** 主标题 */
  title?: string
  /** 副标题/描述 */
  subtitle?: string
  /** 右侧时间文字 */
  time?: string
  /** 角标数量 */
  badge?: number
  /** 是否显示右箭头 */
  showArrow?: boolean
  /** 是否可点击 */
  clickable?: boolean
  /** 自定义图标类名（用于功能入口项） */
  iconClass?: string
  /** 图标背景颜色 */
  iconBgColor?: string
  /** 图标文字颜色 */
  iconColor?: string
}

const props = withDefaults(defineProps<Props>(), {
  avatar: '',
  avatarAlt: '',
  title: '',
  subtitle: '',
  time: '',
  badge: 0,
  showArrow: false,
  clickable: true,
  iconClass: '',
  iconBgColor: '',
  iconColor: ''
})

const emit = defineEmits<{
  (e: 'click'): void
}>()

// 格式化角标显示
function formatBadge(count: number): string {
  if (count > 99) return '99+'
  return String(count)
}
</script>

<template>
  <div 
    class="list-item"
    :class="{ 'clickable': clickable }"
    @click="emit('click')"
  >
    <!-- 头像/图标区域 -->
    <div v-if="avatar || iconClass" class="item-left">
      <!-- 普通头像 -->
      <div v-if="avatar" class="avatar-container">
        <img :src="avatar" :alt="avatarAlt" class="item-avatar" />
        <span v-if="badge > 0" class="badge-float">{{ formatBadge(badge) }}</span>
      </div>
      <!-- 功能图标 -->
      <div 
        v-else-if="iconClass"
        class="item-icon"
        :style="{ 
          backgroundColor: iconBgColor || undefined,
          color: iconColor || undefined
        }"
      >
        <i :class="iconClass" />
      </div>
    </div>
    
    <!-- 左侧插槽 -->
    <slot name="left" />
    
    <!-- 内容区域 -->
    <div class="item-content">
      <div class="content-row">
        <div v-if="title" class="item-title">{{ title }}</div>
        <span v-if="time" class="item-time">{{ time }}</span>
      </div>
      <div v-if="subtitle" class="item-subtitle">{{ subtitle }}</div>
      <slot name="content" />
    </div>
    
    <!-- 右侧区域 -->
    <div class="item-right">
      <slot name="right" />
      <i v-if="showArrow" class="fas fa-chevron-right arrow-icon" />
    </div>
  </div>
</template>

<style scoped>
.list-item {
  @apply flex items-center gap-3 px-4 py-3 bg-white;
  border-bottom: 1px solid #f0f0f0;
}

.list-item:last-child {
  border-bottom: none;
}

.list-item.clickable {
  @apply cursor-pointer;
}

.list-item.clickable:active {
  @apply bg-gray-100;
}

.item-left {
  @apply flex-shrink-0;
}

.avatar-container {
  @apply relative;
}

.item-avatar {
  @apply w-12 h-12 rounded-lg object-cover;
}

.badge-float {
  @apply absolute -top-1 -right-1 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full min-w-[18px] text-center border-2 border-white;
}

.item-icon {
  @apply w-10 h-10 rounded-lg flex items-center justify-center text-white text-lg;
}

.item-content {
  @apply flex-1 min-w-0;
}

.content-row {
  @apply flex justify-between items-start;
}

.item-title {
  @apply font-medium text-gray-900 truncate;
}

.item-time {
  @apply text-xs text-gray-400 flex-shrink-0 ml-2;
}

.item-subtitle {
  @apply text-sm text-gray-500 truncate mt-0.5;
}

.item-right {
  @apply flex items-center gap-2 flex-shrink-0;
}

.arrow-icon {
  @apply text-gray-300 text-xs;
}
</style>