<script setup lang="ts">
/**
 * DynamicAppIcon - 动态应用图标组件
 * 
 * 支持两种使用方式：
 * 1. 通过 appId 自动从 iconStore 获取已注册的应用图标
 * 2. 通过 icon 配置直接传入图标配置
 * 
 * 这个组件统一了 AppIcon 和 NotificationIcon 的功能，
 * 使得任何应用图标都可以在任何地方出现。
 */
import { computed, markRaw } from 'vue'
import { useIconStore } from '@/stores/iconStore'
import { useTheme } from '@/composables/useTheme'
import type { AppIconConfig as PackageIconConfig } from '@/types/appPackage'
import type { NotificationIcon } from '@/types/notification'
import type { AppIconId, ThemeIconConfig } from '@/types/theme'

// 统一的图标配置类型
export type UnifiedIconConfig = 
  | PackageIconConfig 
  | NotificationIcon 
  | { type: 'appId'; value: string }

const props = withDefaults(defineProps<{
  /** 应用 ID - 用于从 iconStore 获取图标 */
  appId?: string
  /** 直接传入的图标配置 */
  icon?: UnifiedIconConfig | PackageIconConfig | NotificationIcon
  /** 图标尺寸 */
  size?: 'xxs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  /** 是否圆形 */
  rounded?: boolean
  /** 是否显示背景 */
  showBackground?: boolean
  /** 徽章数字 */
  badge?: number
  /** 自定义背景色（覆盖配置） */
  customBg?: string
  /** 自定义图标颜色（覆盖配置） */
  customColor?: string
}>(), {
  size: 'md',
  rounded: true,
  showBackground: true,
})

const iconStore = useIconStore()
const { currentTheme } = useTheme()

// 尺寸映射
const sizeMap = {
  xxs: { container: 'w-4 h-4', icon: 'text-[10px]', img: 'w-4 h-4', badge: 'hidden' },
  xs: { container: 'w-6 h-6', icon: 'text-xs', img: 'w-6 h-6', badge: 'min-w-[14px] h-[14px] text-[8px]' },
  sm: { container: 'w-8 h-8', icon: 'text-sm', img: 'w-8 h-8', badge: 'min-w-[16px] h-[16px] text-[9px]' },
  md: { container: 'w-10 h-10', icon: 'text-base', img: 'w-10 h-10', badge: 'min-w-[18px] h-[18px] text-[10px]' },
  lg: { container: 'w-12 h-12', icon: 'text-lg', img: 'w-12 h-12', badge: 'min-w-[20px] h-[20px] text-[11px]' },
  xl: { container: 'w-16 h-16', icon: 'text-2xl', img: 'w-16 h-16', badge: 'min-w-[22px] h-[22px] text-[12px]' },
}

const sizeClasses = computed(() => sizeMap[props.size])

/**
 * 获取当前主题的图标字体类型
 */
const iconFontFamily = computed(() => {
  return currentTheme.value?.icons?.fontFamily || 'font-awesome'
})

/**
 * 是否为 Material Icons
 */
const isMaterialIcon = computed(() => {
  return iconFontFamily.value === 'material-icons'
})

/**
 * 解析后的图标配置
 * 统一处理 appId 和直接传入的配置
 */
const resolvedIcon = computed(() => {
  // 优先使用直接传入的 icon 配置
  if (props.icon) {
    return normalizeIconConfig(props.icon)
  }
  
  // 尝试从 iconStore 获取
  if (props.appId) {
    const registered = iconStore.getIcon(props.appId)
    if (registered?.icon) {
      return normalizeIconConfig(registered.icon)
    }
    
    // 尝试从主题获取
    const themeIcon = currentTheme.value?.icons?.icons?.[props.appId as AppIconId]
    if (themeIcon) {
      return {
        type: 'font' as const,
        value: themeIcon.icon,
        background: themeIcon.bg,
        color: themeIcon.color || '#ffffff',
        isMaterial: isMaterialIcon.value,
      }
    }
  }
  
  // 默认返回空配置
  return null
})

/**
 * 标准化图标配置
 * 将不同来源的配置转换为统一格式
 */
function normalizeIconConfig(config: UnifiedIconConfig | PackageIconConfig | NotificationIcon): {
  type: 'font' | 'emoji' | 'url' | 'base64' | 'component' | 'fontawesome' | 'svg' | 'image'
  value: string | unknown
  background?: string
  color?: string
  isMaterial?: boolean
} | null {
  if (!config) return null
  
  // 处理 NotificationIcon 格式
  if ('type' in config) {
    const c = config as NotificationIcon | PackageIconConfig
    
    // NotificationIcon 类型映射
    if (c.type === 'fontawesome') {
      return {
        type: 'font',
        value: c.value,
        background: (c as NotificationIcon).backgroundColor,
        color: c.color,
        isMaterial: false,
      }
    }
    
    if (c.type === 'svg' || c.type === 'image') {
      return {
        type: 'url',
        value: c.value,
        background: (c as NotificationIcon).backgroundColor,
        color: c.color,
      }
    }
    
    // PackageIconConfig 类型
    return {
      type: c.type as 'font' | 'emoji' | 'url' | 'base64' | 'component',
      value: c.value,
      background: (c as PackageIconConfig).background,
      color: c.color,
      isMaterial: false,
    }
  }
  
  return null
}

// 计算属性：图标类型
const iconType = computed(() => resolvedIcon.value?.type || 'font')

// 计算属性：图标值
const iconValue = computed(() => resolvedIcon.value?.value || '')

// 计算属性：是否使用 Material Icons 渲染
const useMaterialRender = computed(() => {
  // 如果明确指定了 isMaterial，使用该值
  if (resolvedIcon.value?.isMaterial !== undefined) {
    return resolvedIcon.value.isMaterial
  }
  // 否则根据当前主题判断
  return isMaterialIcon.value
})

// 计算属性：是否为 FontAwesome 图标（以 fa- 开头）
const isFontAwesome = computed(() => {
  const value = iconValue.value
  if (typeof value !== 'string') return false
  return value.includes('fa-') || value.startsWith('fas ') || value.startsWith('fab ') || value.startsWith('far ')
})

// 计算属性：背景样式
const bgStyle = computed(() => {
  if (!props.showBackground) return {}
  
  const bg = props.customBg || resolvedIcon.value?.background || '#8E8E93'
  return { background: bg }
})

// 计算属性：图标颜色
const iconColor = computed(() => {
  return props.customColor || resolvedIcon.value?.color || '#ffffff'
})

// 计算属性：是否为内联 SVG
const isInlineSvg = computed(() => {
  return iconType.value === 'svg' && typeof iconValue.value === 'string' && iconValue.value.trim().startsWith('<')
})

// 计算属性：是否为组件图标
const componentIcon = computed(() => {
  if (iconType.value === 'component' && iconValue.value) {
    // 确保组件是 markRaw 的，避免响应式问题
    return typeof iconValue.value === 'object' ? markRaw(iconValue.value) : iconValue.value
  }
  return null
})

// 计算属性：格式化徽章
const formattedBadge = computed(() => {
  if (!props.badge || props.badge <= 0) return null
  return props.badge > 99 ? '99+' : props.badge
})

// 圆角样式类
const roundedClass = computed(() => {
  return props.rounded ? 'rounded-full' : 'rounded-xl'
})
</script>

<template>
  <div
    class="dynamic-app-icon relative flex items-center justify-center flex-shrink-0 transition-transform duration-150"
    :class="[sizeClasses.container, roundedClass]"
    :style="{ ...bgStyle, color: iconColor }"
  >
    <!-- Material Icons -->
    <span
      v-if="iconType === 'font' && iconValue && useMaterialRender && !isFontAwesome"
      class="material-symbols-rounded"
      :class="sizeClasses.icon"
      :style="{ fontSize: 'inherit' }"
    >
      {{ iconValue }}
    </span>
    
    <!-- FontAwesome 图标 -->
    <i
      v-else-if="iconType === 'font' && iconValue && (isFontAwesome || !useMaterialRender)"
      :class="[iconValue, sizeClasses.icon]"
    />
    
    <!-- Emoji 图标 -->
    <span
      v-else-if="iconType === 'emoji' && iconValue"
      class="emoji-icon"
      :class="sizeClasses.icon"
      style="font-style: normal; line-height: 1;"
    >
      {{ iconValue }}
    </span>
    
    <!-- URL / Base64 / Image 图标 -->
    <img
      v-else-if="(iconType === 'url' || iconType === 'base64' || iconType === 'image') && iconValue"
      :src="iconValue as string"
      :class="[sizeClasses.img, roundedClass]"
      class="object-cover"
      alt=""
    />
    
    <!-- 内联 SVG -->
    <div
      v-else-if="isInlineSvg"
      class="svg-container flex items-center justify-center w-full h-full"
      :class="sizeClasses.icon"
      v-html="iconValue"
    />
    
    <!-- 组件图标 -->
    <component
      v-else-if="componentIcon"
      :is="componentIcon"
      class="component-icon"
      :style="{ fontSize: 'inherit', color: 'inherit' }"
    />
    
    <!-- 后备图标 -->
    <i
      v-else
      class="fas fa-question"
      :class="sizeClasses.icon"
    />
    
    <!-- 徽章 -->
    <span
      v-if="formattedBadge"
      class="app-badge absolute -top-1 -right-1 px-1 text-white font-bold rounded-full flex items-center justify-center"
      :class="sizeClasses.badge"
    >
      {{ formattedBadge }}
    </span>
  </div>
</template>

<style scoped>
.dynamic-app-icon {
  line-height: 1;
}

.app-badge {
  background-color: var(--color-error, #FF3B30);
}

.svg-container :deep(svg) {
  width: 60%;
  height: 60%;
}

.emoji-icon {
  font-size: 1.2em;
}

/* Material Symbols 样式 */
.material-symbols-rounded {
  font-family: 'Material Symbols Rounded', sans-serif;
  font-weight: normal;
  font-style: normal;
  font-size: 1.5em;
  line-height: 1;
  letter-spacing: normal;
  text-transform: none;
  display: inline-block;
  white-space: nowrap;
  word-wrap: normal;
  direction: ltr;
  -webkit-font-feature-settings: 'liga';
  font-feature-settings: 'liga';
  -webkit-font-smoothing: antialiased;
}
</style>
