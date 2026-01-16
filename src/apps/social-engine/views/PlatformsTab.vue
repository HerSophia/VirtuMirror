<script setup lang="ts">
/**
 * 平台管理 Tab
 * 显示已注册的社交平台及其配置
 */
import { ref, onMounted } from 'vue';
import { PlatformRegistry } from '@/services/social/registry';
import type { PlatformConfig } from '@/types/social';

// 平台列表
const platforms = ref<PlatformConfig[]>([]);

// 选中的平台
const selectedPlatform = ref<PlatformConfig | null>(null);

// 暴露给父组件
defineExpose({
  selectedPlatform,
  closePlatformDetail,
});

onMounted(() => {
  loadPlatforms();
});

function loadPlatforms() {
  const registry = PlatformRegistry.getInstance();
  platforms.value = registry.getAllPlatforms();
}

function selectPlatform(platform: PlatformConfig) {
  selectedPlatform.value = platform;
}

function closePlatformDetail() {
  selectedPlatform.value = null;
}

// 媒体类型映射
const mediaTypeLabels: Record<string, string> = {
  text_image: '图文',
  video: '视频',
  article: '文章',
  qa: '问答',
};

// 评论结构映射
const commentStructureLabels: Record<string, string> = {
  flat: '扁平',
  nested: '嵌套',
  bullet: '弹幕',
};
</script>

<template>
  <div class="platforms-tab">
    <!-- 平台列表 -->
    <div class="platforms-list">
      <div
        v-for="platform in platforms"
        :key="platform.id"
        class="platform-item"
        @click="selectPlatform(platform)"
      >
        <div class="platform-header">
          <span class="platform-name">{{ platform.name }}</span>
          <span class="platform-id">{{ platform.id }}</span>
        </div>
        <div class="platform-meta">
          <span class="meta-tag">{{ mediaTypeLabels[platform.content.mediaType] || platform.content.mediaType }}</span>
          <span class="meta-tag">{{ platform.content.maxLength }}字</span>
          <span class="meta-tag">{{ platform.interaction.actions.length }}种互动</span>
        </div>
      </div>
    </div>

    <!-- 平台详情弹窗 -->
    <div v-if="selectedPlatform" class="platform-detail-overlay" @click.self="closePlatformDetail">
        <div class="platform-detail-modal">
          <div class="modal-header">
            <h3 class="modal-title">{{ selectedPlatform.name }}</h3>
            <button class="close-btn" @click="closePlatformDetail">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div class="platform-modal-body">
            <!-- 内容形态 -->
            <div class="detail-section">
              <h4 class="section-title">📝 内容形态</h4>
              <div class="detail-grid">
                <div class="detail-item">
                  <span class="label">媒体类型</span>
                  <span class="value">{{ mediaTypeLabels[selectedPlatform.content.mediaType] }}</span>
                </div>
                <div class="detail-item">
                  <span class="label">是否有标题</span>
                  <span class="value">{{ selectedPlatform.content.hasTitle ? '是' : '否' }}</span>
                </div>
                <div class="detail-item">
                  <span class="label">字数限制</span>
                  <span class="value">{{ selectedPlatform.content.maxLength }} 字</span>
                </div>
              </div>
            </div>

            <!-- AI 设置 -->
            <div class="detail-section">
              <h4 class="section-title">🤖 AI 人设偏置</h4>
              <div class="detail-item full">
                <span class="label">语调风格</span>
                <span class="value">{{ selectedPlatform.aiSetting.tone }}</span>
              </div>
              <div class="detail-item full">
                <span class="label">角色类型</span>
                <div class="tag-list">
                  <span v-for="role in selectedPlatform.aiSetting.roles" :key="role" class="tag">{{ role }}</span>
                </div>
              </div>
              <div class="detail-item full">
                <span class="label">常用俚语</span>
                <div class="tag-list">
                  <span v-for="slang in selectedPlatform.aiSetting.slang" :key="slang" class="tag">{{ slang }}</span>
                </div>
              </div>
            </div>

            <!-- 交互拓扑 -->
            <div class="detail-section">
              <h4 class="section-title">👆 交互拓扑</h4>
              <div class="detail-item full">
                <span class="label">支持的操作</span>
                <div class="tag-list">
                  <span v-for="action in selectedPlatform.interaction.actions" :key="action" class="tag">{{ action }}</span>
                </div>
              </div>
              <div class="detail-item">
                <span class="label">评论结构</span>
                <span class="value">{{ commentStructureLabels[selectedPlatform.interaction.commentStructure] }}</span>
              </div>
            </div>

            <!-- 私信策略 -->
            <div class="detail-section">
              <h4 class="section-title">💬 私信策略</h4>
              <div class="detail-item">
                <span class="label">允许陌生人私信</span>
                <span class="value">{{ selectedPlatform.dmStrategy.allowStranger ? '是' : '否' }}</span>
              </div>
              <div class="detail-item">
                <span class="label">折叠未关注人消息</span>
                <span class="value">{{ selectedPlatform.dmStrategy.foldUnknown ? '是' : '否' }}</span>
              </div>
            </div>
          </div>
        </div>
    </div>
  </div>
</template>

<style scoped>
.platforms-tab {
  @apply p-4;
}

.platforms-list {
  @apply space-y-3;
}

.platform-item {
  @apply p-4 rounded-xl cursor-pointer transition-all;
  background: var(--color-surface);
}

.platform-item:hover {
  background: var(--color-surface-variant);
}

.platform-item:active {
  @apply scale-[0.98];
}

.platform-header {
  @apply flex items-center justify-between mb-2;
}

.platform-name {
  @apply font-medium;
  color: var(--color-text);
}

.platform-id {
  @apply text-xs px-2 py-0.5 rounded;
  background: var(--color-surface-variant);
  color: var(--color-text-secondary);
}

.platform-meta {
  @apply flex flex-wrap gap-2;
}

.meta-tag {
  @apply text-xs px-2 py-0.5 rounded;
  background: var(--color-primary);
  color: white;
  opacity: 0.8;
}

/* 弹窗样式 - 使用 fixed 配合 CSS 变量实现手机屏幕内定位 */
.platform-detail-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 100;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  /* 限制在手机容器内 */
  container-type: inline-size;
}

.platform-detail-modal {
  @apply w-full max-w-full rounded-t-2xl overflow-hidden flex flex-col;
  max-height: 80%;
  background: var(--color-background);
}

.modal-header {
  @apply flex items-center justify-between p-4 border-b;
  border-color: var(--color-border);
  background: var(--color-surface);
}

.modal-title {
  @apply text-lg font-bold;
  color: var(--color-text);
}

.close-btn {
  @apply p-1 rounded-full transition-colors;
  color: var(--color-text-secondary);
}

.close-btn:hover {
  background: var(--color-surface-variant);
}

.platform-modal-body {
  @apply p-4 space-y-4 overflow-y-auto flex-1;
}

.detail-section {
  @apply p-3 rounded-lg space-y-2;
  background: var(--color-surface);
}

.section-title {
  @apply text-sm font-medium mb-2;
  color: var(--color-text);
}

.detail-grid {
  @apply grid grid-cols-2 gap-2;
}

.detail-item {
  @apply flex flex-col gap-1;
}

.detail-item.full {
  @apply col-span-2;
}

.detail-item .label {
  @apply text-xs;
  color: var(--color-text-secondary);
}

.detail-item .value {
  @apply text-sm;
  color: var(--color-text);
}

.tag-list {
  @apply flex flex-wrap gap-1;
}

.tag {
  @apply text-xs px-2 py-0.5 rounded;
  background: var(--color-surface-variant);
  color: var(--color-text);
}
</style>
