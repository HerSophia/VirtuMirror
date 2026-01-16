<script setup lang="ts">
/**
 * NotificationIcon - 通用通知图标组件
 * 
 * 支持三种图标类型：
 * - fontawesome: FontAwesome 图标类名
 * - svg: SVG 字符串或路径
 * - image: 图片 URL 或 base64
 */
import { computed } from 'vue'
import type { NotificationIcon } from '@/types/notification'

const props = withDefaults(defineProps<{
  /** 图标配置 */
  icon: NotificationIcon
  /** 尺寸 */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  /** 是否圆形 */
  rounded?: boolean
  /** 是否显示背景 */
  showBackground?: boolean
}>(), {
  size: 'md',
  rounded: true,
  showBackground: true,
})

// 尺寸映射
const sizeMap = {
  xs: { container: 'w-4 h-4', icon: 'text-[8px]', img: 'w-4 h-4' },
  sm: { container: 'w-6 h-6', icon: 'text-xs', img: 'w-6 h-6' },
  md: { container: 'w-8 h-8', icon: 'text-sm', img: 'w-8 h-8' },
  lg: { container: 'w-10 h-10', icon: 'text-base', img: 'w-10 h-10' },
  xl: { container: 'w-12 h-12', icon: 'text-lg', img: 'w-12 h-12' },
}

const sizeClasses = computed(() => sizeMap[props.size])

// 容器样式
const containerStyle = computed(() => {
  const style: Record<string, string> = {}
  
  if (props.showBackground && props.icon.backgroundColor) {
    style.backgroundColor = props.icon.backgroundColor
  }
  
  return style
})

// 图标样式
const iconStyle = computed(() => {
  const style: Record<string, string> = {}
  
  if (props.icon.color) {
    style.color = props.icon.color
  }
  
  return style
})

// 判断是否为内联 SVG
const isInlineSvg = computed(() => {
  return props.icon.type === 'svg' && props.icon.value.trim().startsWith('<')
})
</script>

<template>
  <div
    class="notification-icon"
    :class="[
      sizeClasses.container,
      {
        'rounded-full': rounded,
        'rounded-lg': !rounded,
        'bg-gray-500': showBackground && !icon.backgroundColor,
      }
    ]"
    :style="containerStyle"
  >
    <!-- FontAwesome 图标 -->
    <i
      v-if="icon.type === 'fontawesome'"
      :class="[icon.value, sizeClasses.icon]"
      :style="iconStyle"
    />
    
    <!-- 内联 SVG -->
    <div
      v-else-if="isInlineSvg"
      class="svg-container"
      :class="sizeClasses.icon"
      v-html="icon.value"
    />
    
    <!-- SVG 文件路径 -->
    <img
      v-else-if="icon.type === 'svg'"
      :src="icon.value"
      :class="sizeClasses.img"
      class="svg-image"
      alt=""
    />
    
    <!-- 图片 -->
    <img
      v-else-if="icon.type === 'image'"
      :src="icon.value"
      :class="sizeClasses.img"
      class="icon-image"
      alt=""
    />
  </div>
</template>

<style scoped>
.notification-icon {
  @apply flex items-center justify-center flex-shrink-0;
  @apply text-white;
}

.svg-container {
  @apply w-full h-full flex items-center justify-center;
}

.svg-container :deep(svg) {
  @apply w-[60%] h-[60%];
}

.svg-image,
.icon-image {
  @apply object-cover;
}

.icon-image {
  @apply rounded-inherit;
}

.rounded-inherit {
  border-radius: inherit;
}
</style>
