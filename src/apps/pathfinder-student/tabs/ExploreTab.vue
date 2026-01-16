<script setup lang="ts">
/**
 * 探索 Tab
 * 参考 Pathfinder/Student/探索.html
 * 主要展示：
 * - 问候与位置信息
 * - 当前日程卡片
 * - 状态监控与膳食推荐
 * - 周报数据与 AI 建议
 */
</script>

<template>
  <div class="pf-explore-tab">
    <!-- 顶部问候与头像 -->
    <header class="pf-header">
      <div>
        <div class="pf-location-row">
          <div class="pf-location-dot">
            <div class="pf-location-dot-inner" />
          </div>
          <span class="pf-location-text">杭州 · 钱江世纪城</span>
          <span class="pf-week-tag">实训周 Week 9</span>
        </div>
        <h1 class="pf-greeting-title">
          <span>下午好,</span>
          <span class="text-blue-600 ml-1">Mist</span>
        </h1>
        <p class="pf-greeting-sub">"准星并不是你的眼睛，意识才是。"</p>
      </div>
      <div class="pf-avatar-wrapper">
        <div class="pf-avatar-main">
          <span class="text-lg">M</span>
        </div>
        <div class="pf-avatar-indicator" />
      </div>
    </header>

    <main class="pf-main">
      <!-- 智能日程 -->
      <section class="pf-card pf-schedule-card">
        <div class="pf-schedule-bg-glow" />
        <div class="pf-schedule-top">
          <div class="flex flex-col gap-1">
            <div class="flex items-center gap-2">
              <span class="pf-schedule-badge">进行中</span>
              <span class="pf-schedule-time">14:00 - 15:30</span>
            </div>
            <h3 class="pf-schedule-title">战术理论：莲华古城道具协同</h3>
            <p class="pf-schedule-desc">
              <i class="fa-solid fa-chalkboard-user mr-1.5 text-blue-400" />
              讲师：陈默 (Artemis.VCT 教练)
            </p>
          </div>
          <button type="button" class="pf-schedule-btn">
            <span>签到</span>
            <i class="fa-solid fa-check ml-1 text-[10px]" />
          </button>
        </div>
        
        <div class="pf-schedule-divider" />
        
        <div class="pf-schedule-alert">
          <div class="pf-alert-icon-box">
             <i class="fa-solid fa-triangle-exclamation text-amber-500" />
          </div>
          <span class="pf-alert-text">作业提醒：上周"源工重镇"防守复盘报告需在今日18:00前提交。</span>
        </div>
      </section>

      <!-- 状态监控 + 食堂推荐 -->
      <section class="pf-grid-2">
        <!-- 生理状态 -->
        <div class="pf-card pf-wellness-card">
          <div class="pf-card-header mb-3">
            <span class="pf-card-label">
              <i class="fa-solid fa-heart-pulse text-rose-500 mr-1.5" />生理状态
            </span>
            <span class="pf-tag-success">优</span>
          </div>
          <div class="pf-stat-block">
            <div class="mb-3">
              <div class="pf-stat-row">
                <span>手腕疲劳度</span>
                <span class="text-gray-700 font-bold">24%</span>
              </div>
              <div class="pf-progress">
                <div class="pf-progress-fill bg-gradient-to-r from-emerald-400 to-emerald-500" style="width: 24%" />
              </div>
            </div>
            <div>
              <div class="pf-stat-row">
                <span>今日专注力</span>
                <span class="text-gray-700 font-bold">85%</span>
              </div>
              <div class="pf-progress">
                <div class="pf-progress-fill bg-gradient-to-r from-blue-400 to-blue-600" style="width: 85%" />
              </div>
            </div>
          </div>
        </div>

        <!-- 食堂推荐 -->
        <div class="pf-card pf-dining-card">
          <div class="pf-card-bg-img" />
          <div class="pf-dining-content">
            <div class="pf-card-header">
              <span class="pf-card-label text-white/90">
                <i class="fa-solid fa-utensils mr-1.5" />焕辰食堂
              </span>
            </div>
            <div class="pf-dining-body mt-auto">
              <p class="pf-dining-title text-white">推荐：增肌减脂套餐B</p>
              <p class="pf-dining-meta text-white/70">热量: 650kcal | 蛋白质: 35g</p>
              <button type="button" class="pf-dining-btn">
                <span>一键预订</span>
                <span class="text-[9px] opacity-70 ml-1">17:30</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- Artemis Eye 周报 -->
      <section class="pf-card p-4">
        <div class="pf-card-header mb-3">
          <div class="flex items-center gap-2">
            <div class="pf-icon-box bg-blue-50 text-blue-600">
               <i class="fa-solid fa-eye" />
            </div>
            <div>
              <div class="pf-card-title-lg">Artemis Eye · 周报</div>
              <div class="text-[10px] text-gray-400">基于近7天训练数据分析</div>
            </div>
          </div>
          <span class="pf-chip-muted">更新于 10:00</span>
        </div>

        <div class="pf-eye-content">
          <!-- 雷达圆形 -->
          <div class="pf-eye-chart">
            <svg viewBox="0 0 100 100" class="pf-eye-svg">
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="#f1f5f9"
                stroke-width="4"
              />
               <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="#3b82f6"
                stroke-width="4"
                stroke-dasharray="283"
                stroke-dashoffset="40"
                stroke-linecap="round"
                class="opacity-20"
              />
              <polygon
                points="50,15 85,40 70,80 30,80 15,40"
                fill="rgba(59, 130, 246, 0.15)"
                stroke="#3b82f6"
                stroke-width="1.5"
              />
            </svg>
            <div class="pf-eye-grade">A-</div>
          </div>

          <div class="pf-eye-metrics">
            <div class="pf-eye-metric">
              <div class="pf-eye-metric-label">爆头率</div>
              <div class="pf-eye-metric-value">
                28%
                <span class="pf-eye-badge-up">
                  <i class="fa-solid fa-arrow-up" /> 2%
                </span>
              </div>
            </div>
            <div class="pf-eye-metric">
              <div class="pf-eye-metric-label">KAST</div>
              <div class="pf-eye-metric-value">
                74%
                <span class="pf-eye-badge-neutral">-</span>
              </div>
            </div>
            <div class="pf-eye-metric">
              <div class="pf-eye-metric-label">反应(ms)</div>
              <div class="pf-eye-metric-value">
                168
                <span class="pf-eye-badge-down">
                  <i class="fa-solid fa-arrow-up" /> 慢
                </span>
              </div>
            </div>
            <div class="pf-eye-metric">
              <div class="pf-eye-metric-label">Rating</div>
              <div class="pf-eye-metric-value">
                1.12
                <span class="pf-eye-badge-up">
                  <i class="fa-solid fa-arrow-up" />
                </span>
              </div>
            </div>
          </div>
        </div>

        <div class="pf-eye-advice">
          <div class="flex-shrink-0 mt-0.5">
            <i class="fa-solid fa-robot text-blue-600 text-sm" />
          </div>
          <div>
            <p class="pf-eye-advice-title">AI 教练建议：</p>
            <p class="pf-eye-advice-text">
              在"源工重镇"防守C点时，你的预瞄点位偏低。建议观看
              <span class="pf-link">Stone(二队) C点防守集锦</span>
              进行专项修正。
            </p>
          </div>
        </div>
      </section>

      <!-- 赫尔墨斯大厅 -->
      <section class="pf-card pf-op-card">
        <div class="pf-card-header mb-3">
          <div class="flex items-center gap-2">
            <div class="pf-icon-box bg-purple-50 text-purple-600">
               <i class="fa-solid fa-scroll" />
            </div>
            <span class="pf-card-title-lg">赫尔墨斯大厅</span>
          </div>
          <span class="pf-link text-[10px] flex items-center gap-1">更多 <i class="fa-solid fa-chevron-right text-[8px]" /></span>
        </div>
        
        <div class="pf-op-inner">
          <div class="flex gap-3 items-center">
            <div class="pf-op-logo">U</div>
            <div>
              <div class="flex items-center gap-2 mb-0.5">
                <span class="pf-tag-xs bg-gray-100 text-gray-600">素材录制</span>
                <h4 class="pf-op-title">某手游 - 击杀素材</h4>
              </div>
              <p class="pf-op-desc">需雷兹(Raze)风格的高机动击杀 | 5条</p>
            </div>
          </div>
          <div class="pf-op-side">
            <div class="pf-op-price">¥ 200</div>
            <button type="button" class="pf-op-btn">接单</button>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.pf-explore-tab {
  @apply h-full flex flex-col;
  /* 背景色由父组件统一管理 */
}

/* Header */
.pf-header {
  @apply px-5 pt-8 pb-6 flex justify-between items-start;
}

.pf-location-row {
  @apply text-xs text-gray-500 font-medium mb-1.5 flex items-center gap-2;
}

.pf-location-dot {
  @apply w-3 h-3 rounded-full bg-blue-100 flex items-center justify-center;
}

.pf-location-dot-inner {
  @apply w-1.5 h-1.5 rounded-full bg-blue-500;
}

.pf-location-text {
  @apply inline-block tracking-wide text-gray-600;
}

.pf-week-tag {
  @apply rounded-md px-1.5 py-0.5 text-[10px] font-bold;
  background-color: rgba(37, 99, 235, 0.1);
  color: #2563eb;
}

.pf-greeting-title {
  @apply text-2xl font-black text-gray-900 tracking-tight;
}

.pf-greeting-sub {
  @apply text-xs text-gray-500 mt-1 italic opacity-80;
}

.pf-avatar-wrapper {
  @apply relative mt-1;
}

.pf-avatar-main {
  @apply w-11 h-11 rounded-full border-2 border-white shadow-lg flex items-center justify-center;
  background: linear-gradient(135deg, #1f2937, #4b5563);
  color: white;
  font-weight: 700;
}

.pf-avatar-indicator {
  @apply absolute top-0 right-0 w-3 h-3 rounded-full border-2 border-white;
  background-color: #ef4444;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.5);
}

/* Main layout */
.pf-main {
  @apply px-5 space-y-5 pb-6;
}

/* Generic card */
.pf-card {
  @apply rounded-2xl shadow-sm relative overflow-hidden transition-all duration-300;
  background: white;
  border: 1px solid rgba(255, 255, 255, 0.8);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px -1px rgba(0, 0, 0, 0.02);
}

.pf-card:active {
  transform: scale(0.995);
}

.pf-icon-box {
  @apply w-6 h-6 rounded-lg flex items-center justify-center text-xs;
}

/* Schedule card */
.pf-schedule-card {
  @apply p-5 border-none;
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  color: white;
  box-shadow: 0 10px 20px -5px rgba(37, 99, 235, 0.3);
}

.pf-schedule-bg-glow {
  @apply absolute top-0 right-0 w-40 h-40 bg-white opacity-5 rounded-full blur-2xl;
  transform: translate(30%, -30%);
}

.pf-schedule-top {
  @apply flex justify-between items-start gap-3 relative z-10;
}

.pf-schedule-badge {
  @apply text-[10px] font-bold bg-white/20 px-1.5 py-0.5 rounded text-white backdrop-blur-sm;
}

.pf-schedule-time {
  @apply text-xs font-mono font-medium text-blue-100;
}

.pf-schedule-title {
  @apply text-lg font-bold mt-1 text-white leading-tight;
}

.pf-schedule-desc {
  @apply text-xs text-blue-100 mt-1 flex items-center;
}

.pf-schedule-btn {
  @apply flex items-center text-xs px-3 py-1.5 rounded-full shadow-lg font-bold transition-transform active:scale-95;
  background-color: white;
  color: #1d4ed8;
}

.pf-schedule-divider {
  @apply h-px bg-white/10 my-3;
}

.pf-schedule-alert {
  @apply flex items-start gap-2 text-xs rounded-xl p-2.5 backdrop-blur-md;
  background-color: rgba(0, 0, 0, 0.15);
  color: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.pf-alert-icon-box {
  @apply w-4 h-4 rounded bg-white/10 flex items-center justify-center flex-shrink-0 mt-0.5;
}

.pf-alert-text {
  @apply text-[10px] leading-relaxed opacity-90;
}

/* Grid 2 */
.pf-grid-2 {
  @apply grid grid-cols-2 gap-4;
}

/* Wellness card */
.pf-wellness-card {
  @apply p-4 flex flex-col h-full;
}

.pf-card-header {
  @apply flex justify-between items-center;
}

.pf-card-label {
  @apply text-xs font-bold text-gray-500 flex items-center;
}

.pf-tag-success {
  @apply text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-50 text-green-600;
}

.pf-stat-block {
  @apply flex-1 flex flex-col justify-center;
}

.pf-stat-row {
  @apply flex justify-between text-[10px] text-gray-500 mb-1.5 items-end;
}

.pf-progress {
  @apply h-1.5 rounded-full overflow-hidden bg-gray-100;
}

.pf-progress-fill {
  @apply h-full rounded-full shadow-sm;
}

/* Dining card */
.pf-dining-card {
  @apply p-0 relative overflow-hidden flex flex-col h-full border-0 bg-gray-900;
}

.pf-card-bg-img {
  @apply absolute inset-0 bg-cover bg-center opacity-60 mix-blend-overlay transition-transform duration-700;
  background-image: url('https://images.unsplash.com/photo-1546069901-ba9599a7e63c?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80');
}

.pf-dining-card:hover .pf-card-bg-img {
  transform: scale(1.1);
}

.pf-dining-content {
  @apply relative z-10 p-4 h-full flex flex-col bg-gradient-to-b from-black/10 to-black/80;
}

.pf-dining-title {
  @apply text-xs font-bold mt-1 line-clamp-1;
}

.pf-dining-meta {
  @apply text-[9px] mt-0.5 opacity-80;
}

.pf-dining-btn {
  @apply w-full mt-3 rounded-lg text-[10px] py-1.5 font-bold flex items-center justify-center backdrop-blur-md;
  background-color: rgba(255, 255, 255, 0.2);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

/* Eye card */
.pf-card-title-lg {
  @apply text-sm font-bold text-gray-900;
}

.pf-chip-muted {
  @apply text-[9px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-mono;
}

.pf-eye-content {
  @apply flex items-center justify-between gap-4 mt-3;
}

.pf-eye-chart {
  @apply relative w-20 h-20 flex-shrink-0;
}

.pf-eye-svg {
  @apply w-full h-full drop-shadow-sm transform -rotate-90;
}

.pf-eye-grade {
  @apply absolute inset-0 flex items-center justify-center font-black text-xl text-blue-800;
}

.pf-eye-metrics {
  @apply flex-1 grid grid-cols-2 gap-2 text-center;
}

.pf-eye-metric {
  @apply rounded-xl p-2 bg-gray-50 border border-gray-100 flex flex-col justify-center;
}

.pf-eye-metric-label {
  @apply text-[9px] text-gray-400 font-medium;
}

.pf-eye-metric-value {
  @apply text-sm font-bold text-gray-900 mt-0.5 flex items-center justify-center;
}

.pf-eye-badge-up {
  @apply text-[8px] ml-1 bg-green-100 text-green-700 px-1 rounded-sm;
}

.pf-eye-badge-neutral {
  @apply text-[8px] ml-1 text-gray-300;
}

.pf-eye-badge-down {
  @apply text-[8px] ml-1 bg-red-100 text-red-600 px-1 rounded-sm;
}

.pf-eye-advice {
  @apply mt-4 rounded-xl p-3 flex gap-3 items-start border border-blue-100/50;
  background: linear-gradient(to right, #eff6ff, #f8fafc);
}

.pf-eye-advice-title {
  @apply text-[10px] font-bold text-blue-800 mb-0.5;
}

.pf-eye-advice-text {
  @apply text-[10px] text-gray-600 leading-relaxed;
}

.pf-link {
  @apply font-bold text-blue-600 hover:underline cursor-pointer;
}

/* Hermes */
.pf-op-card {
  @apply p-4;
}

.pf-op-inner {
  @apply bg-gray-50 rounded-xl p-3 border border-gray-100 flex justify-between items-center;
}

.pf-op-logo {
  @apply w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-md;
  background: linear-gradient(135deg, #111827, #374151);
}

.pf-tag-xs {
  @apply text-[8px] px-1 rounded font-medium;
}

.pf-op-title {
  @apply text-xs font-bold text-gray-900;
}

.pf-op-desc {
  @apply text-[10px] text-gray-400 mt-0.5;
}

.pf-op-side {
  @apply text-right flex flex-col items-end gap-1;
}

.pf-op-price {
  @apply text-sm font-bold font-mono text-purple-600;
}

.pf-op-btn {
  @apply text-[10px] px-3 py-1 rounded-full font-bold bg-white border border-gray-200 text-gray-600 shadow-sm active:scale-95 transition-transform;
}
</style>