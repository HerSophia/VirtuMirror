<script setup lang="ts">
/**
 * 数据 Tab
 * 参考 Pathfinder/Student/数据.html
 * 展示：
 * - PP 积分总览 + 六边形雷达
 * - 传统数据概览
 * - 四个能力维度详细卡片
 * - AI 总结
 */
</script>

<template>
  <div class="pf-data-tab">
    <!-- 顶部标题和时间段切换（静态） -->
    <header class="pf-data-header">
      <h1 class="pf-data-title">数据中心</h1>
      <div class="pf-segment">
        <button class="pf-segment-btn pf-segment-btn--active" type="button">本周</button>
        <button class="pf-segment-btn" type="button">本月</button>
        <button class="pf-segment-btn" type="button">赛季</button>
      </div>
    </header>

    <main class="pf-data-main">
      <!-- PP 积分总览 -->
      <section class="pf-card pf-pp-card">
        <div class="pf-pp-bg-glow" />
        <div class="pf-pp-bg-grid" />
        <div class="pf-pp-top">
          <div class="z-10">
            <div class="pf-pp-label">
              <i class="fa-solid fa-bullseye text-blue-300" />
              <span>Pathfinder Points (FPS)</span>
            </div>
            <div class="pf-pp-score">
              <span class="pf-pp-score-main">724</span>
              <span class="pf-pp-score-grade">B+</span>
            </div>
            <p class="pf-pp-updated">更新于: 10-09 04:00 (训练赛结算后)</p>
          </div>

          <!-- 六边形雷达简易图 -->
          <div class="pf-pp-radar z-10">
            <svg viewBox="0 0 100 100" class="pf-pp-radar-grid">
              <polygon
                points="50,10 90,30 90,70 50,90 10,70 10,30"
                fill="none"
                stroke="rgba(255,255,255,0.2)"
                stroke-width="1"
              />
              <polygon
                points="50,30 70,40 70,60 50,70 30,60 30,40"
                fill="none"
                stroke="rgba(255,255,255,0.2)"
                stroke-width="1"
              />
            </svg>
            <svg viewBox="0 0 100 100" class="pf-pp-radar-data">
              <polygon
                points="50,15 85,35 65,65 50,80 35,65 20,35"
                fill="rgba(59, 130, 246, 0.5)"
                stroke="#60a5fa"
                stroke-width="1.5"
              />
            </svg>
          </div>
        </div>

        <div class="pf-pp-tags z-10 relative">
          <span class="pf-pp-tag-primary">
            <i class="fa-solid fa-arrow-trend-up mr-1" />前 18% (年级)
          </span>
          <span class="pf-pp-tag-secondary">
            <i class="fa-solid fa-user-group mr-1" />对比模版: A队标准
          </span>
        </div>
      </section>

      <!-- 传统数据概览 -->
      <section class="pf-metrics-grid">
        <div class="pf-metric-card">
          <div class="pf-metric-label">K/D</div>
          <div class="pf-metric-value text-blue-600">1.18</div>
        </div>
        <div class="pf-metric-card">
          <div class="pf-metric-label">胜率</div>
          <div class="pf-metric-value text-green-600">52%</div>
        </div>
        <div class="pf-metric-card">
          <div class="pf-metric-label">ADR</div>
          <div class="pf-metric-value text-orange-600">145</div>
        </div>
        <div class="pf-metric-card">
          <div class="pf-metric-label">HS%</div>
          <div class="pf-metric-value text-purple-600">28%</div>
        </div>
      </section>

      <!-- PP 四维分析 -->
      <section class="pf-section-title">
        能力维度详解 (Artemis Eye · Chimera)
      </section>

      <!-- 1. 致命性与机械控制 -->
      <section class="pf-card pf-dimension-card pf-dimension-card--red">
        <div class="pf-dimension-header">
          <h3 class="flex items-center gap-2">
             <div class="pf-dim-icon bg-red-100 text-red-500"><i class="fa-solid fa-crosshairs" /></div>
            致命性与机械控制
          </h3>
          <span class="pf-dimension-score text-red-600">S- <span class="text-gray-400 text-[10px] font-normal">(88/100)</span></span>
        </div>
        <div class="pf-dimension-body">
          <div class="pf-dimension-metric">
            <div class="pf-dimension-metric-head">
              <span class="pf-dimension-metric-label">TTD (造成伤害耗时)</span>
              <span class="pf-dimension-metric-value">186ms</span>
            </div>
            <div class="pf-progress">
              <div class="pf-progress-fill bg-gradient-to-r from-red-400 to-red-600" style="width: 92%" />
            </div>
            <div class="pf-dimension-tip">快于 92% 学员</div>
          </div>

          <div class="pf-dimension-submetric">
            <div>
              <div class="pf-submetric-title">头线/预瞄保持率</div>
              <div class="pf-submetric-sub">Crosshair Placement</div>
            </div>
            <div class="pf-submetric-right">
              <span class="pf-submetric-value">74%</span>
              <span class="pf-submetric-delta pf-submetric-delta--up">▲ 3%</span>
            </div>
          </div>
        </div>
      </section>

      <!-- 2. 战术效能 -->
      <section class="pf-card pf-dimension-card pf-dimension-card--blue">
        <div class="pf-dimension-header">
           <h3 class="flex items-center gap-2">
             <div class="pf-dim-icon bg-blue-100 text-blue-500"><i class="fa-solid fa-chess" /></div>
            战术效能
          </h3>
          <span class="pf-dimension-score text-blue-600">C+ <span class="text-gray-400 text-[10px] font-normal">(65/100)</span></span>
        </div>

        <div class="pf-dimension-body pf-dimension-body--grid">
          <div class="pf-dimension-mini-card">
            <div class="pf-mini-label">道具有效性</div>
            <div class="pf-mini-value text-red-500">Low</div>
            <div class="pf-mini-tip pf-mini-tip--danger">
              <i class="fa-solid fa-circle-exclamation mr-1" />
              闪光助攻过低
            </div>
          </div>
          <div class="pf-dimension-mini-card">
            <div class="pf-mini-label">IAR (信息获取率)</div>
            <div class="pf-mini-value text-green-600">High</div>
            <div class="pf-mini-tip">
              小地图观察频率: 0.8次/秒
            </div>
          </div>
        </div>

        <div class="pf-dimension-footer">
          <span class="pf-footer-label">空间撕裂值 (Entry Impact)</span>
          <span class="pf-footer-value text-blue-600">High (前 20%)</span>
        </div>
      </section>

      <!-- 3. 经济博弈 -->
      <section class="pf-card pf-dimension-card pf-dimension-card--yellow">
        <div class="pf-dimension-header">
           <h3 class="flex items-center gap-2">
             <div class="pf-dim-icon bg-amber-100 text-amber-500"><i class="fa-solid fa-coins" /></div>
            经济博弈
          </h3>
          <span class="pf-dimension-score text-amber-600">B <span class="text-gray-400 text-[10px] font-normal">(72/100)</span></span>
        </div>

        <div class="pf-dimension-body pf-dimension-body--split">
          <div class="pf-split-left">
            <div class="pf-mini-label">DPC (每金币伤害)</div>
            <div class="pf-split-main">1.42</div>
            <div class="pf-mini-tip">平均水平</div>
          </div>
          <div class="pf-split-right">
            <div class="pf-mini-label">ECO局翻盘贡献</div>
            <div class="pf-split-main pf-split-main--highlight">High</div>
            <div class="pf-mini-tip">擅长使用正义/警长</div>
          </div>
        </div>
      </section>

      <!-- 4. 心态与残局 -->
      <section class="pf-card pf-dimension-card pf-dimension-card--purple">
        <div class="pf-dimension-header">
           <h3 class="flex items-center gap-2">
             <div class="pf-dim-icon bg-purple-100 text-purple-500"><i class="fa-solid fa-brain" /></div>
            心态与残局
          </h3>
          <span class="pf-dimension-score text-purple-600">A <span class="text-gray-400 text-[10px] font-normal">(82/100)</span></span>
        </div>

        <div class="pf-dimension-body pf-dimension-body--stack">
          <div class="pf-clutch-row">
            <span class="pf-footer-label">Clutch Factor (残局执掌力)</span>
            <span class="pf-clutch-tag">1v2 胜率 35%</span>
          </div>

          <div class="pf-bio-card">
            <div class="pf-bio-icon">
              <i class="fa-solid fa-heart-pulse text-red-500 text-[10px]" />
            </div>
            <div class="pf-bio-main">
              <div class="pf-bio-label">残局心率变异度 (HRV)</div>
              <div class="pf-bio-text">平稳 (-5% 波动)</div>
            </div>
            <div class="pf-bio-tag">大心脏</div>
          </div>
        </div>
      </section>

      <!-- AI 总结 -->
      <section class="pf-summary">
        <div class="pf-summary-icon">
          <i class="fa-solid fa-microchip text-blue-600 text-[10px]" />
        </div>
        <div>
          <div class="pf-summary-title">LOGOS 模型评估总结：</div>
          <p class="pf-summary-text">
            典型的"枪男"模板。机械瞄准能力接近 A 级学员，但在道具协同（尤其是闪光弹效率）上存在明显短板，导致战术评分被拉低。建议增加《道具投掷轨迹学》的选修课时，并向二队选手 [Weaver] 借阅防守点位笔记。
          </p>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.pf-data-tab {
  @apply h-full flex flex-col;
  /* 背景由父组件控制 */
}

/* Header */
.pf-data-header {
  @apply sticky top-0 z-20 px-5 py-4 flex justify-between items-center;
  background-color: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.5);
}

.pf-data-title {
  @apply text-xl font-black text-gray-900 tracking-tight;
}

.pf-segment {
  @apply flex rounded-lg p-1 bg-gray-100/80 backdrop-blur-sm;
}

.pf-segment-btn {
  @apply px-3 py-1 text-xs font-bold rounded-md text-gray-400 transition-all;
}

.pf-segment-btn--active {
  @apply bg-white shadow-sm text-gray-900;
}

/* Main */
.pf-data-main {
  @apply px-5 pt-5 space-y-5 pb-6;
}

/* Generic card */
.pf-card {
  @apply rounded-2xl shadow-sm bg-white/80 backdrop-blur-md;
  border: 1px solid rgba(255, 255, 255, 0.8);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px -1px rgba(0, 0, 0, 0.02);
}

/* PP card */
.pf-pp-card {
  @apply p-5 relative overflow-hidden text-white border-0;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.3);
}

.pf-pp-bg-glow {
  @apply absolute top-0 right-0 w-48 h-48 bg-blue-500 opacity-20 rounded-full blur-3xl;
  transform: translate(20%, -20%);
}

.pf-pp-bg-grid {
  @apply absolute inset-0 opacity-10;
  background-image: radial-gradient(#ffffff 1px, transparent 1px);
  background-size: 20px 20px;
}

.pf-pp-top {
  @apply flex justify-between items-start gap-4 relative;
}

.pf-pp-label {
  @apply text-xs text-gray-400 font-bold flex items-center gap-1.5 uppercase tracking-wider;
}

.pf-pp-score {
  @apply flex items-baseline gap-2 mt-2;
}

.pf-pp-score-main {
  @apply text-5xl font-black tracking-tighter font-mono text-white;
  text-shadow: 0 0 20px rgba(59, 130, 246, 0.5);
}

.pf-pp-score-grade {
  @apply text-2xl font-black italic;
  background: linear-gradient(135deg, #60a5fa, #34d399);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.pf-pp-updated {
  @apply text-[9px] text-gray-500 mt-2 font-mono;
}

.pf-pp-radar {
  @apply relative w-24 h-24 flex items-center justify-center;
}

.pf-pp-radar-grid {
  @apply w-full h-full;
}

.pf-pp-radar-data {
  @apply w-full h-full drop-shadow-[0_0_8px_rgba(59,130,246,0.6)];
}

.pf-pp-tags {
  @apply mt-5 flex gap-2;
}

.pf-pp-tag-primary {
  @apply text-[9px] px-2 py-1 rounded bg-blue-500/20 text-blue-200 font-bold border border-blue-500/30 backdrop-blur-sm;
}

.pf-pp-tag-secondary {
  @apply text-[9px] px-2 py-1 rounded bg-white/10 text-gray-300 border border-white/10 backdrop-blur-sm;
}

/* Small metrics */
.pf-metrics-grid {
  @apply grid grid-cols-4 gap-3;
}

.pf-metric-card {
  @apply text-center rounded-xl p-3 bg-white shadow-sm border border-gray-100 flex flex-col justify-center h-full;
}

.pf-metric-label {
  @apply text-[9px] text-gray-400 font-bold uppercase tracking-wider mb-1;
}

.pf-metric-value {
  @apply text-base font-black font-mono;
}

/* Section title */
.pf-section-title {
  @apply text-xs font-bold text-gray-400 px-1 uppercase tracking-wider;
}

/* Dimension cards */
.pf-dimension-card {
  @apply p-4 relative overflow-hidden;
}

.pf-dim-icon {
  @apply w-6 h-6 rounded-md flex items-center justify-center text-xs;
}

.pf-dimension-header {
  @apply flex justify-between items-center mb-4 pb-3 border-b border-gray-100;
}

.pf-dimension-header h3 {
  @apply text-sm font-bold text-gray-900;
}

.pf-dimension-score {
  @apply text-sm font-mono font-black;
}

.pf-dimension-body {
  @apply space-y-4;
}

/* Dimension 1 metrics */
.pf-dimension-metric-head {
  @apply flex justify-between text-[10px] mb-1.5;
}

.pf-dimension-metric-label {
  @apply text-gray-500 font-medium;
}

.pf-dimension-metric-value {
  @apply font-mono font-bold text-gray-900;
}

.pf-progress {
  @apply w-full h-2 rounded-full bg-gray-100;
}

.pf-progress-fill {
  @apply h-2 rounded-full shadow-sm;
}

.pf-dimension-tip {
  @apply text-[9px] text-gray-400 mt-1 text-right font-medium;
}

.pf-dimension-submetric {
  @apply flex justify-between items-center bg-gray-50/80 rounded-lg p-2.5;
}

.pf-submetric-title {
  @apply text-[10px] font-bold text-gray-700;
}

.pf-submetric-sub {
  @apply text-[9px] text-gray-400 font-mono mt-0.5;
}

.pf-submetric-right {
  @apply text-right;
}

.pf-submetric-value {
  @apply text-sm font-mono font-bold text-gray-900;
}

.pf-submetric-delta {
  @apply text-[9px] font-bold block;
}

.pf-submetric-delta--up {
  color: #16a34a;
}

/* Dimension 2 */
.pf-dimension-body--grid {
  @apply grid grid-cols-2 gap-3;
}

.pf-dimension-mini-card {
  @apply bg-gray-50/80 p-3 rounded-xl border border-gray-100;
}

.pf-mini-label {
  @apply text-[9px] text-gray-400 mb-1.5 font-bold uppercase;
}

.pf-mini-value {
  @apply text-sm font-black font-mono mb-1;
}

.pf-mini-tip {
  @apply text-[9px] text-gray-500 leading-tight;
}

.pf-mini-tip--danger {
  @apply text-red-500 font-medium;
}

.pf-dimension-footer {
  @apply mt-2 pt-3 border-t border-gray-100 flex justify-between items-center text-[10px];
}

.pf-footer-label {
  @apply text-[10px] text-gray-500 font-medium;
}

.pf-footer-value {
  @apply font-mono font-bold;
}

/* Dimension 3 */
.pf-dimension-body--split {
  @apply flex items-center justify-between gap-4;
}

.pf-split-left,
.pf-split-right {
  @apply w-1/2 flex flex-col items-center text-center p-2 rounded-xl bg-gray-50/50;
}

.pf-split-left {
  @apply border-r-0;
}

.pf-split-main {
  @apply text-xl font-mono font-black text-gray-900 my-1;
}

.pf-split-main--highlight {
  @apply text-amber-500;
}

/* Dimension 4 */
.pf-dimension-body--stack {
  @apply space-y-3;
}

.pf-clutch-row {
  @apply flex justify-between items-center text-[10px] bg-purple-50 p-2.5 rounded-lg border border-purple-100;
}

.pf-clutch-tag {
  @apply bg-white text-purple-700 px-2 py-0.5 rounded font-mono font-bold shadow-sm;
}

.pf-bio-card {
  @apply mt-1 bg-gray-900 rounded-xl p-3 flex items-center gap-3 text-white shadow-lg;
}

.pf-bio-icon {
  @apply bg-gray-800 p-2 rounded-lg;
}

.pf-bio-main {
  @apply flex-1;
}

.pf-bio-label {
  @apply text-[9px] text-gray-400 font-medium uppercase tracking-wide;
}

.pf-bio-text {
  @apply text-xs font-bold mt-0.5;
}

.pf-bio-tag {
  @apply text-[10px] font-black text-green-400 bg-green-400/10 px-2 py-1 rounded;
}

/* Summary */
.pf-summary {
  @apply mt-2 mb-6 rounded-2xl border border-blue-100 p-4 flex gap-3 shadow-sm;
  background: linear-gradient(to right, #eff6ff, #f8fafc);
}

.pf-summary-icon {
  @apply w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm;
  background-color: white;
}

.pf-summary-title {
  @apply text-[10px] font-bold text-blue-800 mb-1 uppercase tracking-wide;
}

.pf-summary-text {
  @apply text-xs text-gray-600 leading-relaxed text-justify;
}
</style>