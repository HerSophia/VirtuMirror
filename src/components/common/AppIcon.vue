<script setup lang="ts">
/**
 * 通用 App 图标组件
 * 支持根据主题自动切换图标风格
 */
import { computed } from 'vue'
import { useTheme } from '@/composables/useTheme'
import type { AppIconId, ThemeIconConfig as IconConfig } from '@/types/theme'
import type { AppIconConfig as PackageIconConfig } from '@/types/appPackage'

const props = withDefaults(defineProps<{
  /** App ID */
  appId: AppIconId | string
  /** 图标尺寸 */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  /** 是否显示徽章 */
  badge?: number
  /** 自定义背景色（覆盖主题配置） */
  customBg?: string
  /** 自定义图标类名（覆盖主题配置） */
  customIcon?: string
  /** 应用包定义的图标配置 */
  icon?: PackageIconConfig
}>(), {
  size: 'md',
})

const { currentTheme } = useTheme()

/**
 * 获取当前主题的图标配置
 */
const iconConfig = computed<IconConfig | null>(() => {
  const icons = currentTheme.value?.icons
  if (!icons) return null
  return icons.icons[props.appId as AppIconId] ?? null
})

/**
 * 图标集配置
 */
const iconSet = computed(() => currentTheme.value?.icons)

/**
 * 尺寸样式类
 */
const sizeClass = computed(() => ({
  xs: 'w-8 h-8 text-sm',
  sm: 'w-10 h-10 text-lg',
  md: 'w-[60px] h-[60px] text-2xl',
  lg: 'w-20 h-20 text-3xl',
  xl: 'w-24 h-24 text-4xl',
}[props.size]))

/**
 * 徽章尺寸样式类
 */
const badgeSizeClass = computed(() => ({
  xs: 'min-w-[14px] h-[14px] text-[8px]',
  sm: 'min-w-[16px] h-[16px] text-[9px]',
  md: 'min-w-[18px] h-[18px] text-[10px]',
  lg: 'min-w-[20px] h-[20px] text-[11px]',
  xl: 'min-w-[22px] h-[22px] text-[12px]',
}[props.size]))

/**
 * 计算 Font Awesome 图标类名
 */
const fontAwesomeClass = computed(() => {
  if (props.customIcon) return props.customIcon
  if (props.icon && props.icon.type === 'font') return props.icon.value
  return iconConfig.value?.icon ?? ''
})

/**
 * 计算 Material Icons 图标名称
 */
const materialIconName = computed(() => {
  if (props.customIcon) return props.customIcon
  // 这里假设 package icon 不会是 material icon，或者 type 标识区分
  return iconConfig.value?.icon ?? ''
})

/**
 * 计算 emoji 图标
 */
const emojiIcon = computed(() => {
  if (props.icon && props.icon.type === 'emoji') return props.icon.value
  return null
})

/**
 * 计算图片图标
 */
const imageIcon = computed(() => {
  if (props.icon && (props.icon.type === 'url' || props.icon.type === 'base64')) return props.icon.value
  return null
})

/**
 * 计算组件图标
 */
const componentIcon = computed(() => {
  if (props.icon && props.icon.type === 'component') return props.icon.value
  return null
})

/**
 * 计算背景样式
 */
const bgStyle = computed(() => {
  if (props.icon?.background) return { background: props.icon.background }
  const bg = props.customBg || iconConfig.value?.bg || '#8E8E93'
  return { background: bg }
})

/**
 * 计算图标颜色
 */
const iconColor = computed(() => {
  if (props.icon?.color) return props.icon.color
  return iconConfig.value?.color ?? '#ffffff'
})

/**
 * 计算圆角样式
 */
const borderRadiusStyle = computed(() => {
  if (iconConfig.value?.borderRadius) {
    return { borderRadius: iconConfig.value.borderRadius }
  }
  return {}
})

/**
 * 判断是否使用 Material Icons
 */
const isMaterialIcon = computed(() => {
  return iconSet.value?.fontFamily === 'material-icons'
})

/**
 * 格式化徽章数字
 */
const formattedBadge = computed(() => {
  if (!props.badge || props.badge <= 0) return null
  return props.badge > 99 ? '99+' : props.badge
})

// 调试日志
import { watchEffect } from 'vue'
watchEffect(() => {
  if (props.appId === 'weibo' || props.appId === 'app-weibo') {
    console.log('[AppIcon Debug] Weibo Icon:', {
      appId: props.appId,
      iconProp: props.icon,
      componentIcon: componentIcon.value,
      iconConfig: iconConfig.value
    })
  }
})
</script>

<template>
  <div
    class="app-icon relative rounded-app flex items-center justify-center shadow-app transition-transform duration-150 active:scale-90"
    :class="[sizeClass, iconConfig?.effectClass]"
    :style="{ ...bgStyle, ...borderRadiusStyle, color: iconColor }"
  >
    <!-- Font Awesome / 其他字体图标 -->
    <i
      v-if="(!isMaterialIcon && (fontAwesomeClass || customIcon)) && !emojiIcon && !imageIcon && !componentIcon"
      :class="fontAwesomeClass"
    />
    
    <!-- Material Icons -->
    <span
      v-else-if="(isMaterialIcon && (materialIconName || customIcon)) && !emojiIcon && !imageIcon && !componentIcon"
      class="material-symbols-rounded"
      :style="{ fontSize: 'inherit' }"
    >
      {{ materialIconName }}
    </span>

    <!-- Emoji 图标 -->
    <span v-else-if="emojiIcon" class="emoji-icon" style="font-style: normal; font-size: 1.2em; line-height: 1;">
      {{ emojiIcon }}
    </span>

    <!-- 图片图标 -->
    <img v-else-if="imageIcon" :src="imageIcon" class="image-icon w-full h-full object-cover rounded-app" />
    
    <!-- 组件图标 -->
    <component
      v-else-if="componentIcon"
      :is="componentIcon"
      class="component-icon"
      :style="{ fontSize: 'inherit' }"
    />

    <!-- 后备图标（当没有配置时） -->
    <i
      v-else
      class="fas fa-question"
    />
    
    <!-- 徽章 -->
    <span 
      v-if="formattedBadge" 
      class="app-badge absolute -top-1 -right-1 px-1 text-white font-bold rounded-full flex items-center justify-center"
      :class="badgeSizeClass"
    >
      {{ formattedBadge }}
    </span>
  </div>
</template>

<style scoped>
.app-icon {
  /* 确保图标居中 */
  line-height: 1;
}

.app-badge {
  background-color: var(--color-error, #FF3B30);
}

/* 特效类：霓虹发光（赛博朋克主题） */
.neon-glow {
  box-shadow: 
    0 0 10px currentColor,
    0 0 20px currentColor,
    0 0 40px currentColor;
  animation: neon-pulse 2s ease-in-out infinite;
}

@keyframes neon-pulse {
  0%, 100% {
    box-shadow: 
      0 0 10px currentColor,
      0 0 20px currentColor,
      0 0 40px currentColor;
  }
  50% {
    box-shadow: 
      0 0 15px currentColor,
      0 0 30px currentColor,
      0 0 60px currentColor;
  }
}

/* 特效类：像素风格（复古主题） */
.pixel-style {
  image-rendering: pixelated;
  border-radius: 4px !important;
}

/* Material Symbols 尺寸继承 */
.material-symbols-rounded {
  font-size: inherit;
}
</style>