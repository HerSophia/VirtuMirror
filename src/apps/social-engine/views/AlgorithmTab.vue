<script setup lang="ts">
/**
 * 算法说明 Tab
 * 展示热度算法的工作原理
 */
import { ref } from 'vue';
import { TrafficEngine } from '@/services/social/algorithm';

// 测试数据
const testBaseScore = ref(75);
const testHeat = ref(0);
const testFormatted = ref('');
const testLevel = ref('');

// 计算测试热度
function calculateTestHeat() {
  const now = Date.now();
  const heat = TrafficEngine.calculateSimpleHeat(
    testBaseScore.value,
    now - 2 * 60 * 60 * 1000, // 2小时前创建
    now
  );
  
  testHeat.value = heat;
  testFormatted.value = TrafficEngine.formatHeat(heat);
  
  const display = TrafficEngine.getHeatDisplay(
    heat,
    1, // 假设排名第一
    now - 2 * 60 * 60 * 1000,
    now
  );
  testLevel.value = display.tag || '普通';
}

// 初始计算
calculateTestHeat();
</script>

<template>
  <div class="algorithm-tab">
    <!-- 热度公式 -->
    <div class="section">
      <h3 class="section-title">📐 热度计算公式</h3>
      <div class="formula-card">
        <code class="formula">
          Heat = (BaseScore³ × 0.1) × TimeFactor × Jitter
        </code>
        <div class="formula-legend">
          <div class="legend-item">
            <span class="legend-term">BaseScore</span>
            <span class="legend-desc">事件量级 (1-100)</span>
          </div>
          <div class="legend-item">
            <span class="legend-term">TimeFactor</span>
            <span class="legend-desc">时间曲线因子</span>
          </div>
          <div class="legend-item">
            <span class="legend-term">Jitter</span>
            <span class="legend-desc">±2% 随机波动</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 时间曲线 -->
    <div class="section">
      <h3 class="section-title">📈 时间曲线</h3>
      <div class="curve-section">
        <div class="curve-item">
          <h4 class="curve-title">上升期 (创建 → 峰值)</h4>
          <code class="curve-formula">
            TimeFactor = 0.2 + 0.8 × sin(progress × π/2)
          </code>
          <p class="curve-desc">使用正弦曲线模拟话题发酵过程，从 20% 增长到 100%</p>
        </div>
        <div class="curve-item">
          <h4 class="curve-title">衰退期 (峰值后)</h4>
          <code class="curve-formula">
            TimeFactor = max(0.05, e^(-t / 24h))
          </code>
          <p class="curve-desc">指数衰减，24小时半衰期，保留 5% 最小热度</p>
        </div>
      </div>
    </div>

    <!-- 热度等级 -->
    <div class="section">
      <h3 class="section-title">🏷️ 热度标签判定</h3>
      <div class="levels-table">
        <div class="level-row header">
          <span>标签</span>
          <span>条件</span>
          <span>样式</span>
        </div>
        <div class="level-row">
          <span class="level-tag boil">沸</span>
          <span>排名前 3 且热度 ≥ 100万</span>
          <span>红色</span>
        </div>
        <div class="level-row">
          <span class="level-tag explode">爆</span>
          <span>热度 ≥ 50万</span>
          <span>红色</span>
        </div>
        <div class="level-row">
          <span class="level-tag hot">热</span>
          <span>热度 ≥ 10万</span>
          <span>橙色</span>
        </div>
        <div class="level-row">
          <span class="level-tag new">新</span>
          <span>创建时间 < 1小时</span>
          <span>红色</span>
        </div>
      </div>
    </div>

    <!-- 热度格式化 -->
    <div class="section">
      <h3 class="section-title">📊 热度显示格式</h3>
      <div class="format-examples">
        <div class="format-item">
          <span class="format-range">< 1万</span>
          <span class="format-example">9876</span>
        </div>
        <div class="format-item">
          <span class="format-range">1万 ~ 1亿</span>
          <span class="format-example">234.5万</span>
        </div>
        <div class="format-item">
          <span class="format-range">≥ 1亿</span>
          <span class="format-example">1.2亿</span>
        </div>
      </div>
    </div>

    <!-- 实时测试 -->
    <div class="section">
      <h3 class="section-title">🧪 实时测试</h3>
      <div class="test-panel">
        <div class="test-input-group">
          <label class="test-label">BaseScore (1-100)</label>
          <input
            v-model.number="testBaseScore"
            type="range"
            min="1"
            max="100"
            class="test-slider"
            @input="calculateTestHeat"
          />
          <span class="test-value">{{ testBaseScore }}</span>
        </div>
        
        <div class="test-result">
          <div class="result-item">
            <span class="result-label">原始热度</span>
            <span class="result-value">{{ testHeat.toLocaleString() }}</span>
          </div>
          <div class="result-item">
            <span class="result-label">显示格式</span>
            <span class="result-value">{{ testFormatted }}</span>
          </div>
          <div class="result-item">
            <span class="result-label">热度标签</span>
            <span class="result-value tag" :class="testLevel.toLowerCase()">{{ testLevel }}</span>
          </div>
        </div>
        
        <p class="test-note">假设话题创建于 2 小时前，排名第 1</p>
      </div>
    </div>

    <!-- 交互概率 -->
    <div class="section">
      <h3 class="section-title">👆 交互概率漏斗</h3>
      <div class="funnel-info">
        <p class="info-text">博文的互动数据由 <code>TrafficEngine.calculateInteractions</code> 计算：</p>
        <ul class="funnel-list">
          <li>基础曝光 = 粉丝数 × 5%~15%</li>
          <li>热搜加成 = √热度 × 10</li>
          <li>点赞率 = 曝光 × 1%~5%</li>
          <li>评论率 = 点赞 × 10%~30%</li>
          <li>转发率 = 点赞 × 5%~20%</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style scoped>
.algorithm-tab {
  @apply p-4 space-y-4;
}

.section {
  @apply p-4 rounded-xl;
  background: var(--color-surface);
}

.section-title {
  @apply text-sm font-medium mb-3;
  color: var(--color-text);
}

.formula-card {
  @apply p-4 rounded-lg;
  background: var(--color-surface-variant);
}

.formula {
  @apply block text-center text-sm font-mono py-2;
  color: var(--color-primary);
}

.formula-legend {
  @apply mt-3 space-y-1;
}

.legend-item {
  @apply flex items-center gap-2 text-sm;
}

.legend-term {
  @apply font-mono px-1 rounded;
  background: var(--color-background);
  color: var(--color-text);
}

.legend-desc {
  color: var(--color-text-secondary);
}

.curve-section {
  @apply space-y-3;
}

.curve-item {
  @apply p-3 rounded-lg;
  background: var(--color-surface-variant);
}

.curve-title {
  @apply text-sm font-medium mb-2;
  color: var(--color-text);
}

.curve-formula {
  @apply block text-xs font-mono py-1;
  color: var(--color-primary);
}

.curve-desc {
  @apply text-xs mt-1;
  color: var(--color-text-secondary);
}

.levels-table {
  @apply space-y-2;
}

.level-row {
  @apply grid grid-cols-3 gap-2 p-2 rounded text-sm;
  background: var(--color-surface-variant);
}

.level-row.header {
  @apply font-medium;
  background: transparent;
  color: var(--color-text-secondary);
}

.level-tag {
  @apply inline-block px-2 py-0.5 rounded text-xs font-medium text-white;
}

.level-tag.boil { background: #ef4444; }
.level-tag.explode { background: #ef4444; }
.level-tag.hot { background: #f97316; }
.level-tag.new { background: #ef4444; }

.format-examples {
  @apply space-y-2;
}

.format-item {
  @apply flex items-center justify-between p-2 rounded text-sm;
  background: var(--color-surface-variant);
}

.format-range {
  color: var(--color-text-secondary);
}

.format-example {
  @apply font-mono;
  color: var(--color-text);
}

.test-panel {
  @apply p-4 rounded-lg;
  background: var(--color-surface-variant);
}

.test-input-group {
  @apply flex items-center gap-3 mb-4;
}

.test-label {
  @apply text-sm;
  color: var(--color-text);
}

.test-slider {
  @apply flex-1;
}

.test-value {
  @apply w-8 text-center font-mono;
  color: var(--color-primary);
}

.test-result {
  @apply grid grid-cols-3 gap-2;
}

.result-item {
  @apply flex flex-col items-center p-2 rounded;
  background: var(--color-background);
}

.result-label {
  @apply text-xs;
  color: var(--color-text-secondary);
}

.result-value {
  @apply text-sm font-medium;
  color: var(--color-text);
}

.result-value.tag {
  @apply px-2 py-0.5 rounded text-white text-xs;
}

.result-value.tag.沸 { background: #ef4444; }
.result-value.tag.爆 { background: #ef4444; }
.result-value.tag.热 { background: #f97316; }
.result-value.tag.新 { background: #ef4444; }
.result-value.tag.普通 { background: var(--color-text-secondary); }

.test-note {
  @apply text-xs mt-3 text-center;
  color: var(--color-text-secondary);
}

.funnel-info {
  @apply text-sm;
  color: var(--color-text-secondary);
}

.funnel-info code {
  @apply px-1 rounded font-mono text-xs;
  background: var(--color-surface-variant);
  color: var(--color-text);
}

.funnel-list {
  @apply list-disc pl-5 mt-2 space-y-1;
}
</style>
