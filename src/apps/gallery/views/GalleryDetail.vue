<script setup lang="ts">
/**
 * 图片详情页
 */
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useGalleryStore } from '../stores'
import type { AnyImage, GeneratedImage } from '../types'

const router = useRouter()
const route = useRoute()
const store = useGalleryStore()

const imageId = computed(() => route.params.imageId as string)
const image = computed(() => store.getImageById(imageId.value))

/** 是否显示信息面板 */
const showInfo = ref(false)

/** 是否全屏 */
const fullscreen = ref(false)

/** 返回 */
function goBack() {
  router.back()
}

/** 切换收藏 */
async function toggleFavorite() {
  if (image.value) {
    await store.toggleFavorite(image.value.id)
  }
}

/** 删除图片 */
async function deleteImage() {
  if (!image.value) return
  
  if (confirm('确定要删除这张图片吗？')) {
    await store.deleteImage(image.value.id)
    goBack()
  }
}

/** 复制提示词（仅生成图片） */
function copyPrompt() {
  if (image.value?.source === 'generated') {
    const genImg = image.value as GeneratedImage
    navigator.clipboard.writeText(genImg.prompt)
    alert('提示词已复制到剪贴板')
  }
}

/** 格式化时间 */
function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN')
}

/** 格式化文件大小 */
function formatSize(bytes?: number): string {
  if (!bytes) return '未知'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
</script>

<template>
  <div class="gallery-detail" :class="{ fullscreen }">
    <!-- 顶部工具栏 -->
    <div v-if="!fullscreen" class="toolbar top-toolbar">
      <button class="icon-btn" @click="goBack">
        <i class="fas fa-arrow-left"></i>
      </button>
      <div class="toolbar-title">图片详情</div>
      <button class="icon-btn" @click="showInfo = !showInfo">
        <i class="fas fa-info-circle"></i>
      </button>
    </div>
    
    <!-- 图片展示 -->
    <div class="image-view" @click="fullscreen = !fullscreen">
      <img
        v-if="image"
        :src="image.url"
        :alt="image.description || '图片'"
        class="main-image"
      />
      <div v-else class="not-found">
        <i class="fas fa-exclamation-triangle"></i>
        <p>图片不存在</p>
      </div>
    </div>
    
    <!-- 底部工具栏 -->
    <div v-if="!fullscreen && image" class="toolbar bottom-toolbar">
      <button 
        class="icon-btn" 
        :class="{ active: image.favorite }"
        @click="toggleFavorite"
      >
        <i :class="['fas', image.favorite ? 'fa-heart' : 'fa-heart']" 
           :style="{ color: image.favorite ? '#ff3b30' : undefined }"></i>
      </button>
      <button 
        v-if="image.source === 'generated'" 
        class="icon-btn"
        @click="copyPrompt"
        title="复制提示词"
      >
        <i class="fas fa-copy"></i>
      </button>
      <button class="icon-btn danger" @click="deleteImage">
        <i class="fas fa-trash"></i>
      </button>
    </div>
    
    <!-- 信息面板 -->
    <div v-if="showInfo && image" class="info-panel">
      <div class="info-header">
        <span>图片信息</span>
        <button class="icon-btn small" @click="showInfo = false">
          <i class="fas fa-times"></i>
        </button>
      </div>
      
      <div class="info-content">
        <!-- 基础信息 -->
        <div class="info-section">
          <div class="info-row">
            <span class="info-label">来源</span>
            <span class="info-value">
              {{ image.source === 'local' ? '本地' : image.source === 'generated' ? 'AI生成' : '图床' }}
            </span>
          </div>
          <div class="info-row">
            <span class="info-label">添加时间</span>
            <span class="info-value">{{ formatTime(image.createdAt) }}</span>
          </div>
          <div v-if="image.width && image.height" class="info-row">
            <span class="info-label">尺寸</span>
            <span class="info-value">{{ image.width }} × {{ image.height }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">大小</span>
            <span class="info-value">{{ formatSize(image.fileSize) }}</span>
          </div>
        </div>
        
        <!-- 描述 -->
        <div v-if="image.description" class="info-section">
          <div class="info-label">描述</div>
          <p class="info-text">{{ image.description }}</p>
        </div>
        
        <!-- 关键词 -->
        <div v-if="image.keywords?.length" class="info-section">
          <div class="info-label">关键词</div>
          <div class="tags">
            <span v-for="kw in image.keywords" :key="kw" class="tag">{{ kw }}</span>
          </div>
        </div>
        
        <!-- AI生成信息 -->
        <template v-if="image.source === 'generated'">
          <div class="info-section">
            <div class="info-label">提示词</div>
            <p class="info-text prompt">{{ (image as GeneratedImage).prompt }}</p>
          </div>
          <div v-if="(image as GeneratedImage).negativePrompt" class="info-section">
            <div class="info-label">负面提示词</div>
            <p class="info-text">{{ (image as GeneratedImage).negativePrompt }}</p>
          </div>
          <div class="info-section">
            <div v-if="(image as GeneratedImage).modelName" class="info-row">
              <span class="info-label">模型</span>
              <span class="info-value">{{ (image as GeneratedImage).modelName }}</span>
            </div>
            <div v-if="(image as GeneratedImage).seed" class="info-row">
              <span class="info-label">种子</span>
              <span class="info-value">{{ (image as GeneratedImage).seed }}</span>
            </div>
            <div v-if="(image as GeneratedImage).steps" class="info-row">
              <span class="info-label">步数</span>
              <span class="info-value">{{ (image as GeneratedImage).steps }}</span>
            </div>
            <div v-if="(image as GeneratedImage).cfgScale" class="info-row">
              <span class="info-label">CFG</span>
              <span class="info-value">{{ (image as GeneratedImage).cfgScale }}</span>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gallery-detail {
  @apply fixed inset-0 flex flex-col;
  background: var(--color-background);
  z-index: 300;
}

.gallery-detail.fullscreen {
  background: black;
}

/* 工具栏 */
.toolbar {
  @apply flex items-center justify-between px-2 py-2;
  background: var(--color-surface);
}

.top-toolbar {
  @apply border-b;
  border-color: var(--color-border);
}

.bottom-toolbar {
  @apply justify-center gap-8;
  @apply border-t;
  border-color: var(--color-border);
}

.toolbar-title {
  @apply font-medium;
  color: var(--color-text);
}

.icon-btn {
  @apply w-10 h-10 flex items-center justify-center rounded-full;
  @apply transition-colors;
  color: var(--color-text);
}

.icon-btn:hover {
  background: var(--color-surface-variant);
}

.icon-btn.small {
  @apply w-8 h-8;
}

.icon-btn.danger {
  color: #ff3b30;
}

/* 图片展示 */
.image-view {
  @apply flex-1 flex items-center justify-center overflow-hidden;
  @apply cursor-pointer;
}

.main-image {
  @apply max-w-full max-h-full object-contain;
}

.not-found {
  @apply flex flex-col items-center gap-4;
  color: var(--color-text-secondary);
}

.not-found i {
  @apply text-4xl;
}

/* 信息面板 */
.info-panel {
  @apply absolute right-0 top-0 bottom-0 w-72;
  @apply flex flex-col;
  @apply shadow-xl;
  background: var(--color-surface);
  z-index: 10;
}

.info-header {
  @apply flex items-center justify-between px-4 py-3;
  @apply border-b;
  @apply font-medium;
  border-color: var(--color-border);
  color: var(--color-text);
}

.info-content {
  @apply flex-1 overflow-auto p-4;
}

.info-section {
  @apply mb-4;
}

.info-row {
  @apply flex justify-between py-1;
}

.info-label {
  @apply text-xs mb-1;
  color: var(--color-text-secondary);
}

.info-value {
  @apply text-sm;
  color: var(--color-text);
}

.info-text {
  @apply text-sm leading-relaxed;
  color: var(--color-text);
}

.info-text.prompt {
  @apply font-mono text-xs;
  @apply p-2 rounded;
  background: var(--color-surface-variant);
}

.tags {
  @apply flex flex-wrap gap-1;
}

.tag {
  @apply px-2 py-0.5 rounded-full;
  @apply text-xs;
  background: var(--color-primary);
  color: white;
}
</style>
