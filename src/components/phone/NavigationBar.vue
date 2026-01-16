<script setup lang="ts">
/**
 * 三键导航组件
 * 提供返回、主页、多任务三个按钮
 * 模拟 Android 风格的三键导航
 */

import { computed, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAppStateStore, getAppIdFromRoute } from '@/stores/appStateStore'
import { canGoBack as routerCanGoBack, setTransitionType, setZoomOrigin } from '@/router'

const router = useRouter()
const route = useRoute()
const appStateStore = useAppStateStore()

// 按钮按下状态（用于视觉反馈）
const isBackPressed = ref(false)
const isHomePressed = ref(false)
const isRecentPressed = ref(false)

// 是否可以返回
const canGoBack = routerCanGoBack

// 是否在主屏幕
const isAtHome = computed(() => route.path === '/')

// 返回按钮点击
function handleBack() {
  if (canGoBack.value) {
    router.back()
  }
}

// 主页按钮点击
function handleHome() {
  if (!isAtHome.value) {
    // 获取当前 App 的图标位置，设置为 zoom 动画的终点
    const currentAppId = getAppIdFromRoute(route.path)
    const iconPosition = appStateStore.getIconPosition(currentAppId)
    
    if (iconPosition) {
      setZoomOrigin(iconPosition)
      console.log(`[NavigationBar] 设置 zoom 原点到 ${currentAppId} 图标位置:`, iconPosition)
    }
    
    setTransitionType('zoom')
    router.push('/')
  }
}

// 多任务按钮点击
function handleRecent() {
  appStateStore.showAppSwitcher()
}

// 长按主页按钮 - 可以用于额外功能（如打开语音助手）
function handleHomeLongPress() {
  // 目前留空，未来可以扩展
  console.log('[NavigationBar] Home button long pressed')
}

// 按钮按下/松开的视觉反馈
function onBackPointerDown() {
  isBackPressed.value = true
}

function onBackPointerUp() {
  isBackPressed.value = false
}

function onHomePointerDown() {
  isHomePressed.value = true
}

function onHomePointerUp() {
  isHomePressed.value = false
}

function onRecentPointerDown() {
  isRecentPressed.value = true
}

function onRecentPointerUp() {
  isRecentPressed.value = false
}
</script>

<template>
  <div class="navigation-bar">
    <!-- 返回键 -->
    <button
      class="nav-button nav-back"
      :class="{ pressed: isBackPressed, disabled: !canGoBack }"
      :disabled="!canGoBack"
      @click="handleBack"
      @pointerdown="onBackPointerDown"
      @pointerup="onBackPointerUp"
      @pointerleave="onBackPointerUp"
    >
      <svg viewBox="0 0 24 24" class="nav-icon">
        <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
      </svg>
    </button>

    <!-- 主页键 -->
    <button
      class="nav-button nav-home"
      :class="{ pressed: isHomePressed, 'at-home': isAtHome }"
      @click="handleHome"
      @pointerdown="onHomePointerDown"
      @pointerup="onHomePointerUp"
      @pointerleave="onHomePointerUp"
    >
      <svg viewBox="0 0 24 24" class="nav-icon home-icon">
        <circle cx="12" cy="12" r="10" />
      </svg>
    </button>

    <!-- 多任务键 -->
    <button
      class="nav-button nav-recent"
      :class="{ pressed: isRecentPressed }"
      @click="handleRecent"
      @pointerdown="onRecentPointerDown"
      @pointerup="onRecentPointerUp"
      @pointerleave="onRecentPointerUp"
    >
      <svg viewBox="0 0 24 24" class="nav-icon">
        <rect x="4" y="4" width="16" height="16" rx="2" ry="2" fill="none" stroke="currentColor" stroke-width="2" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.navigation-bar {
  @apply flex items-center justify-around;
  @apply w-full;
  height: 48px;
  background-color: var(--color-surface, #ffffff);
  border-top: 1px solid var(--color-border, rgba(0, 0, 0, 0.1));
  padding: 0 24px;
  /* 安全区域 */
  padding-bottom: env(safe-area-inset-bottom, 0);
  transition: background-color 0.3s ease;
  user-select: none;
  -webkit-user-select: none;
}

/* 深色模式适配 */
[data-theme="dark"] .navigation-bar {
  background-color: var(--color-surface, #1c1c1e);
  border-top-color: rgba(255, 255, 255, 0.1);
}

.nav-button {
  @apply flex items-center justify-center;
  width: 56px;
  height: 40px;
  border-radius: 20px;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
  color: var(--color-text, #000000);
  -webkit-tap-highlight-color: transparent;
}

.nav-button:active,
.nav-button.pressed {
  background-color: var(--color-surface-variant, rgba(0, 0, 0, 0.08));
  transform: scale(0.92);
}

.nav-button.disabled {
  opacity: 0.35;
  cursor: default;
}

.nav-button.disabled:active,
.nav-button.disabled.pressed {
  background: transparent;
  transform: none;
}

/* 主页键在桌面时的样式 */
.nav-button.at-home {
  opacity: 0.5;
}

.nav-icon {
  width: 24px;
  height: 24px;
  fill: currentColor;
  transition: transform 0.15s ease;
}

/* 主页键的圆形图标 */
.nav-icon.home-icon {
  fill: none;
  stroke: currentColor;
  stroke-width: 2.5;
}

.nav-icon.home-icon circle {
  fill: none;
  stroke: currentColor;
}

/* 返回键的特殊样式 */
.nav-back .nav-icon {
  width: 22px;
  height: 22px;
}

/* 多任务键的方形图标 */
.nav-recent .nav-icon {
  width: 20px;
  height: 20px;
}

.nav-recent .nav-icon rect {
  fill: none;
}

/* 按钮按下时的缩放效果 */
.nav-button:active .nav-icon,
.nav-button.pressed .nav-icon {
  transform: scale(0.9);
}

/* 触摸设备上的优化 */
@media (hover: none) and (pointer: coarse) {
  .nav-button {
    width: 64px;
    height: 44px;
  }
}

/* iOS 风格变体 - 可以通过主题切换 */
[data-nav-style="ios"] .navigation-bar {
  height: 34px;
  background: transparent;
  border-top: none;
}

[data-nav-style="ios"] .nav-button {
  display: none;
}

[data-nav-style="ios"] .nav-home {
  display: flex;
  width: 134px;
  height: 5px;
  border-radius: 3px;
  background-color: var(--color-text, #000000);
  opacity: 0.3;
}

[data-nav-style="ios"] .nav-home .nav-icon {
  display: none;
}

/* 隐藏三键导航时的底部指示条（手势模式） */
.gesture-indicator {
  @apply absolute bottom-1 left-1/2 -translate-x-1/2;
  width: 134px;
  height: 5px;
  border-radius: 3px;
  background-color: var(--color-text, #000000);
  opacity: 0.2;
}
</style>