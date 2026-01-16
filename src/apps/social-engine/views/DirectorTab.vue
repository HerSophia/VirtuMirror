<script setup lang="ts">
/**
 * 导演服务 Tab
 * 控制世界事件的自动生成
 */
import { ref, onMounted, computed } from 'vue';
import { DirectorService } from '@/services/social/directorService';
import { FREQUENCY_OPTIONS, type DirectorConfig } from '../types';

// 导演服务配置
const config = ref<DirectorConfig>({
  isEnabled: false,
  worldSetting: '现代都市背景，科技与魔法轻微共存',
  frequency: 'medium',
  costLimit: 10000,
});

// 上次事件时间
const lastEventTime = ref<number | null>(null);

// 是否正在生成
const isGenerating = ref(false);

// 下次事件预计时间
const nextEventEstimate = computed(() => {
  if (!config.value.isEnabled || !lastEventTime.value) return null;
  
  const intervalMap = {
    low: 12 * 60 * 60 * 1000,
    medium: 6 * 60 * 60 * 1000,
    high: 2 * 60 * 60 * 1000,
  };
  
  const nextTime = lastEventTime.value + intervalMap[config.value.frequency];
  return new Date(nextTime).toLocaleString();
});

onMounted(() => {
  // 从 DirectorService 获取当前配置
  // 注意：DirectorService 的配置是私有的，这里使用默认值
  // 实际使用时需要扩展 DirectorService 提供配置读取接口
});

// 切换启用状态
function toggleEnabled() {
  config.value.isEnabled = !config.value.isEnabled;
  DirectorService.getInstance().setConfig({
    isEnabled: config.value.isEnabled,
  });
}

// 更新频率
function updateFrequency(freq: 'low' | 'medium' | 'high') {
  config.value.frequency = freq;
  DirectorService.getInstance().setConfig({
    frequency: freq,
  });
}

// 更新世界设定
function updateWorldSetting() {
  DirectorService.getInstance().setConfig({
    worldSetting: config.value.worldSetting,
  });
}

// 手动触发事件
async function triggerManualEvent() {
  if (isGenerating.value) return;
  
  isGenerating.value = true;
  try {
    await DirectorService.getInstance().triggerManualEvent();
    lastEventTime.value = Date.now();
  } catch (error) {
    console.error('[Director] Failed to trigger event:', error);
  } finally {
    isGenerating.value = false;
  }
}
</script>

<template>
  <div class="director-tab">
    <!-- 状态卡片 -->
    <div class="status-card" :class="{ active: config.isEnabled }">
      <div class="status-header">
        <div class="status-icon">🎬</div>
        <div class="status-info">
          <h3 class="status-title">导演服务</h3>
          <p class="status-desc">{{ config.isEnabled ? '正在运行' : '已停止' }}</p>
        </div>
        <button 
          class="toggle-btn"
          :class="{ active: config.isEnabled }"
          @click="toggleEnabled"
        >
          <span class="toggle-track">
            <span class="toggle-thumb" />
          </span>
        </button>
      </div>
      
      <div v-if="config.isEnabled && nextEventEstimate" class="next-event">
        <span class="label">下次事件预计：</span>
        <span class="value">{{ nextEventEstimate }}</span>
      </div>
      
      <!-- 警告提示 -->
      <div v-if="config.isEnabled" class="warning-notice">
        <i class="fas fa-exclamation-triangle"></i>
        <span>已开启：将定期调用 LLM 生成世界事件，会消耗 API 调用</span>
      </div>
      <div v-else class="info-notice">
        <i class="fas fa-info-circle"></i>
        <span>已关闭：不会自动生成内容，可使用「手动触发」按钮测试</span>
      </div>
    </div>

    <!-- 配置区域 -->
    <div class="config-section">
      <h4 class="section-title">⚙️ 配置</h4>
      
      <!-- 事件频率 -->
      <div class="config-item">
        <label class="config-label">事件生成频率</label>
        <div class="frequency-options">
          <button
            v-for="opt in FREQUENCY_OPTIONS"
            :key="opt.value"
            class="freq-btn"
            :class="{ active: config.frequency === opt.value }"
            @click="updateFrequency(opt.value)"
          >
            <span class="freq-label">{{ opt.label }}</span>
            <span class="freq-desc">{{ opt.description }}</span>
          </button>
        </div>
      </div>

      <!-- 世界设定 -->
      <div class="config-item">
        <label class="config-label">世界背景设定</label>
        <textarea
          v-model="config.worldSetting"
          class="world-setting-input"
          rows="3"
          placeholder="描述你的虚拟世界背景..."
          @blur="updateWorldSetting"
        />
        <p class="config-hint">这段描述会注入到事件生成的提示词中，影响生成内容的风格</p>
      </div>

      <!-- Token 预算 -->
      <div class="config-item">
        <label class="config-label">每日 Token 预算</label>
        <div class="budget-input-wrapper">
          <input
            v-model.number="config.costLimit"
            type="number"
            class="budget-input"
            min="1000"
            step="1000"
          />
          <span class="budget-unit">tokens</span>
        </div>
        <p class="config-hint">超过预算后，导演服务将暂停生成事件</p>
      </div>
    </div>

    <!-- 手动操作 -->
    <div class="manual-section">
      <h4 class="section-title">🎯 手动操作</h4>
      <button 
        class="manual-trigger-btn"
        :disabled="isGenerating"
        @click="triggerManualEvent"
      >
        <span v-if="isGenerating" class="loading-spinner" />
        <span v-else>⚡</span>
        <span>{{ isGenerating ? '生成中...' : '立即生成事件' }}</span>
      </button>
      <p class="manual-hint">手动触发一次世界事件生成，用于测试或补充内容</p>
    </div>

    <!-- 说明 -->
    <div class="info-section">
      <h4 class="section-title">ℹ️ 工作原理</h4>
      <div class="info-content">
        <p>导演服务（Director Service）是社交引擎的"幕后导演"，它会：</p>
        <ul>
          <li>根据设定的频率，定期调用 LLM 生成世界事件</li>
          <li>将事件转化为各平台的热搜话题</li>
          <li>触发后续的博文和评论生成</li>
        </ul>
        <p class="note">💡 事件生成依赖 TimeService，在模拟时间流逝时触发</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.director-tab {
  @apply p-4 space-y-4;
}

.status-card {
  @apply p-4 rounded-xl transition-colors;
  background: var(--color-surface);
  border: 2px solid var(--color-border);
}

.status-card.active {
  border-color: var(--color-primary);
  background: linear-gradient(135deg, var(--color-primary)/5, transparent);
}

.status-header {
  @apply flex items-center gap-3;
}

.status-icon {
  @apply text-3xl;
}

.status-info {
  @apply flex-1;
}

.status-title {
  @apply font-bold;
  color: var(--color-text);
}

.status-desc {
  @apply text-sm;
  color: var(--color-text-secondary);
}

.toggle-btn {
  @apply p-0.5;
}

.toggle-track {
  @apply block w-12 h-7 rounded-full relative transition-colors;
  background: var(--color-border);
}

.toggle-btn.active .toggle-track {
  background: var(--color-primary);
}

.toggle-thumb {
  @apply absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform;
}

.toggle-btn.active .toggle-thumb {
  @apply translate-x-5;
}

.next-event {
  @apply mt-3 pt-3 border-t text-sm;
  border-color: var(--color-border);
}

.next-event .label {
  color: var(--color-text-secondary);
}

.next-event .value {
  color: var(--color-primary);
  font-weight: 500;
}

.warning-notice {
  @apply mt-3 p-2 rounded-lg text-xs flex items-center gap-2;
  background: #FEF3C7;
  color: #92400E;
}

.info-notice {
  @apply mt-3 p-2 rounded-lg text-xs flex items-center gap-2;
  background: var(--color-surface-variant);
  color: var(--color-text-secondary);
}

.config-section,
.manual-section,
.info-section {
  @apply p-4 rounded-xl;
  background: var(--color-surface);
}

.section-title {
  @apply text-sm font-medium mb-3;
  color: var(--color-text);
}

.config-item {
  @apply mb-4 last:mb-0;
}

.config-label {
  @apply block text-sm font-medium mb-2;
  color: var(--color-text);
}

.frequency-options {
  @apply space-y-2;
}

.freq-btn {
  @apply w-full p-3 rounded-lg text-left transition-all;
  background: var(--color-surface-variant);
  border: 2px solid transparent;
}

.freq-btn:hover {
  background: var(--color-background);
}

.freq-btn.active {
  border-color: var(--color-primary);
  background: var(--color-primary)/10;
}

.freq-label {
  @apply block font-medium;
  color: var(--color-text);
}

.freq-desc {
  @apply block text-xs mt-0.5;
  color: var(--color-text-secondary);
}

.world-setting-input {
  @apply w-full p-3 rounded-lg text-sm resize-none;
  background: var(--color-surface-variant);
  color: var(--color-text);
  border: 1px solid var(--color-border);
}

.world-setting-input:focus {
  @apply outline-none;
  border-color: var(--color-primary);
}

.config-hint {
  @apply text-xs mt-1;
  color: var(--color-text-secondary);
}

.budget-input-wrapper {
  @apply flex items-center gap-2;
}

.budget-input {
  @apply flex-1 p-2 rounded-lg text-sm;
  background: var(--color-surface-variant);
  color: var(--color-text);
  border: 1px solid var(--color-border);
}

.budget-input:focus {
  @apply outline-none;
  border-color: var(--color-primary);
}

.budget-unit {
  @apply text-sm;
  color: var(--color-text-secondary);
}

.manual-trigger-btn {
  @apply w-full flex items-center justify-center gap-2 p-3 rounded-lg font-medium transition-all;
  background: var(--color-primary);
  color: white;
}

.manual-trigger-btn:hover:not(:disabled) {
  @apply opacity-90;
}

.manual-trigger-btn:active:not(:disabled) {
  @apply scale-[0.98];
}

.manual-trigger-btn:disabled {
  @apply opacity-50 cursor-not-allowed;
}

.loading-spinner {
  @apply w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin;
}

.manual-hint {
  @apply text-xs mt-2 text-center;
  color: var(--color-text-secondary);
}

.info-content {
  @apply text-sm space-y-2;
  color: var(--color-text-secondary);
}

.info-content ul {
  @apply list-disc pl-5 space-y-1;
}

.info-content .note {
  @apply mt-3 p-2 rounded-lg text-xs;
  background: var(--color-surface-variant);
}
</style>
