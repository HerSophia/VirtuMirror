<script setup lang="ts">
/**
 * 生涯 Tab
 * 参考 Pathfinder/Student/生涯.html
 * 包含：
 * - 赛事履历时间线
 * - 社团与项目
 * - 实习与微订单
 */
</script>

<template>
  <div class="pf-career-tab">
    <!-- Header -->
    <header class="pf-career-header">
      <div class="pf-career-header-top">
        <div>
          <h1 class="pf-career-title">生涯档案</h1>
          <p class="text-[10px] text-gray-400 mt-0.5 font-mono tracking-wide">CAREER PROFILE</p>
        </div>
        <button type="button" class="pf-export-btn">
          <i class="fa-solid fa-cloud-arrow-down mr-1.5" /> 导出 PDF
        </button>
      </div>

      <!-- Talent tags -->
      <div class="pf-tags-row">
        <span class="pf-tag pf-tag--primary"># 战术系27级</span>
        <span class="pf-tag pf-tag--blue"># 突破手</span>
        <span class="pf-tag pf-tag--purple"># 兼职内容创作者</span>
      </div>
    </header>

    <main class="pf-career-main">
      <!-- Section 1: Match History -->
      <section>
        <div class="pf-section-header">
          <div class="flex items-center gap-2">
            <div class="w-1 h-4 bg-blue-600 rounded-full" />
            <h2 class="pf-section-title">
              赛事履历 <span class="text-gray-300 font-normal ml-1 text-[10px]">Match Record</span>
            </h2>
          </div>
          <span class="pf-section-sub">仅展示认证赛事</span>
        </div>

        <div class="pf-timeline-wrapper">
          <div class="pf-timeline-line" />

          <!-- Event 1 -->
          <article class="pf-timeline-item">
            <div class="pf-timeline-marker">
              <div class="pf-timeline-dot" />
            </div>
            <div class="pf-timeline-card">
              <div class="pf-timeline-header">
                <div>
                  <h3 class="pf-timeline-title">新生破冰杯 · 训练赛</h3>
                  <p class="pf-timeline-meta">2027.09.15 | 杭州分院内部赛</p>
                </div>
                <span class="pf-timeline-badge">4强</span>
              </div>
              <div class="pf-highlight-row">
                <div class="flex items-center gap-2">
                   <i class="fa-solid fa-clapperboard text-blue-500" />
                   <span class="pf-highlight-label">个人高光</span>
                </div>
                <div class="flex items-center justify-between mt-1">
                   <span class="pf-highlight-text">
                    图一(源工重镇) 单场 28 杀，ACS 310
                  </span>
                  <button type="button" class="pf-highlight-play">
                    <i class="fa-solid fa-play" />
                  </button>
                </div>
              </div>
            </div>
          </article>

          <!-- Event 2 -->
          <article class="pf-timeline-item">
            <div class="pf-timeline-marker">
              <div class="pf-timeline-dot pf-timeline-dot--gold">
                <i class="fa-solid fa-trophy text-[8px] text-white" />
              </div>
            </div>
            <div class="pf-timeline-card pf-timeline-card--gold">
              <div class="pf-card-bg-glow" />
              <div class="pf-timeline-header relative z-10">
                <div>
                  <h3 class="pf-timeline-title text-amber-900">
                    "月升杯" 模拟选拔赛 (Week 1)
                  </h3>
                  <p class="pf-timeline-meta text-amber-700/70">2027.10.07 | 跨校区线上赛</p>
                </div>
                <span class="pf-timeline-badge pf-timeline-badge--gold">
                  冠军
                </span>
              </div>
              <p class="pf-timeline-desc text-amber-900/80 relative z-10">
                作为队长带领临时车队 [Team Alpha] 夺冠。决赛局使用
                <span class="font-bold">Jett</span>
                完成关键 1v3 残局。
              </p>
              <div class="pf-timeline-tags relative z-10">
                <span class="pf-mini-tag pf-mini-tag--gold">MVP</span>
                <span class="pf-mini-tag pf-mini-tag--blue">关键先生</span>
              </div>
            </div>
          </article>
        </div>
      </section>

      <!-- Section 2: Club & Projects -->
      <section>
        <div class="pf-section-header">
           <div class="flex items-center gap-2">
            <div class="w-1 h-4 bg-purple-500 rounded-full" />
            <h2 class="pf-section-title">
              社团与项目 <span class="text-gray-300 font-normal ml-1 text-[10px]">Sandbox</span>
            </h2>
          </div>
          <span class="pf-section-sub text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full font-bold">活跃度: A</span>
        </div>

        <div class="pf-card-grid">
          <!-- Club card -->
          <article class="pf-card">
            <div class="pf-card-left">
              <div class="pf-card-logo bg-gray-900 text-white">
                FPS
              </div>
            </div>
            <div class="pf-card-body">
              <div class="flex justify-between items-start">
                <div>
                  <h3 class="pf-card-title">CS 复古研究社</h3>
                  <p class="pf-card-subtitle">致力于研究 CS1.6 经典战术在无畏契约中的复刻可行性。</p>
                </div>
                <span class="pf-role-pill">骨干成员</span>
              </div>
              <div class="pf-card-footer">
                <div class="pf-meta-item">
                  <i class="fa-regular fa-clock" />
                  <span>12h</span>
                </div>
                <div class="pf-meta-divider" />
                 <div class="pf-meta-item">
                  <i class="fa-solid fa-fire-flame-curved text-orange-500" />
                  <span>贡献值 85</span>
                </div>
              </div>
            </div>
          </article>

          <!-- Project card -->
          <article class="pf-card">
             <div class="pf-card-left">
              <div class="pf-card-logo bg-red-500 text-white">
                <i class="fa-solid fa-video" />
              </div>
            </div>
            <div class="pf-card-body">
              <div class="flex justify-between items-start">
                <div>
                   <div class="flex items-center gap-2">
                    <h3 class="pf-card-title">短视频：瞄准教学系列</h3>
                    <span class="pf-tag-xs">个人项目</span>
                   </div>
                  <p class="pf-card-subtitle">与传媒系同学合作，录制并在 B 站发布《新生枪法避坑指南》。</p>
                </div>
              </div>
              <div class="pf-card-tags mt-2">
                <span class="pf-stat-pill"><i class="fa-solid fa-play text-[8px] mr-1" />1.2w</span>
                <span class="pf-stat-pill"><i class="fa-solid fa-thumbs-up text-[8px] mr-1" />856</span>
              </div>
            </div>
          </article>
        </div>
      </section>

      <!-- Section 3: Practice & Micro Orders -->
      <section class="pf-practice-section">
         <div class="pf-section-header">
           <div class="flex items-center gap-2">
            <div class="w-1 h-4 bg-emerald-500 rounded-full" />
            <h2 class="pf-section-title">
              实习与微订单 <span class="text-gray-300 font-normal ml-1 text-[10px]">Hermes</span>
            </h2>
          </div>
        </div>

        <article class="pf-practice-card">
          <div class="pf-practice-header">
            <div class="pf-practice-company">
              <div class="pf-company-logo">
                N
              </div>
              <div>
                 <span class="pf-company-name">网易 CC 直播 (外包)</span>
                 <div class="text-[9px] text-gray-400">赛事 OB 助理 (实习)</div>
              </div>
            </div>
            <span class="pf-practice-time">2027.09</span>
          </div>

          <div class="pf-practice-body">
            <ul class="pf-practice-list">
              <li>参与"永劫无间"高校赛的线上 OB 工作。</li>
              <li>学习并掌握了基础的导演台切镜逻辑。</li>
            </ul>
            <div class="pf-practice-award">
              <i class="fa-solid fa-certificate text-emerald-500" />
              <span>获得企业导师好评 (评分: 4.8/5.0)</span>
            </div>
          </div>
        </article>
      </section>
    </main>
  </div>
</template>

<style scoped>
.pf-career-tab {
  @apply h-full flex flex-col;
  /* 背景由父组件控制 */
}

/* Header */
.pf-career-header {
  @apply sticky top-0 z-20 px-5 pt-8 pb-4 border-b border-gray-100/50 shadow-sm;
  background-color: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(12px);
}

.pf-career-header-top {
  @apply flex justify-between items-start;
}

.pf-career-title {
  @apply text-2xl font-black text-gray-900 tracking-tight;
}

.pf-export-btn {
  @apply text-[10px] px-3 py-1.5 rounded-full flex items-center font-bold transition-transform active:scale-95;
  background-color: #111827;
  color: #ffffff;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.pf-tags-row {
  @apply flex flex-wrap gap-2 mt-4;
}

.pf-tag {
  @apply text-[10px] px-2.5 py-1 rounded-lg border font-bold;
}

.pf-tag--primary {
  @apply bg-gray-100 text-gray-700 border-gray-200;
}

.pf-tag--blue {
  @apply bg-blue-50 text-blue-600 border-blue-100;
}

.pf-tag--purple {
  @apply bg-purple-50 text-purple-600 border-purple-100;
}

/* Main */
.pf-career-main {
  @apply px-5 pt-6 space-y-8 pb-6;
}

/* Section header */
.pf-section-header {
  @apply flex justify-between items-center mb-4;
}

.pf-section-title {
  @apply text-sm font-bold text-gray-800;
}

.pf-section-sub {
  @apply text-[10px] text-gray-400;
}

/* Timeline */
.pf-timeline-wrapper {
  @apply relative pl-2 space-y-6;
}

.pf-timeline-line {
  @apply absolute left-[15px] top-2 bottom-4 w-0.5 bg-gray-200 z-0;
}

.pf-timeline-item {
  @apply relative z-10 flex gap-4;
}

.pf-timeline-marker {
  @apply flex-shrink-0 w-8 flex justify-center pt-1;
}

.pf-timeline-dot {
  @apply w-3 h-3 rounded-full bg-gray-300 border-2 border-white shadow-sm box-content relative z-10;
}

.pf-timeline-dot--gold {
  @apply bg-amber-400 w-5 h-5 -ml-1 border-2 flex items-center justify-center shadow-md;
}

.pf-timeline-card {
  @apply flex-1 bg-white rounded-2xl p-4 shadow-sm border border-gray-100 relative overflow-hidden;
}

.pf-timeline-card--gold {
  @apply border-amber-200 bg-gradient-to-br from-amber-50 to-white;
}

.pf-card-bg-glow {
  @apply absolute -right-4 -top-4 w-24 h-24 bg-amber-400 rounded-full blur-3xl opacity-20 pointer-events-none;
}

.pf-timeline-header {
  @apply flex justify-between items-start mb-2;
}

.pf-timeline-title {
  @apply text-sm font-bold text-gray-900;
}

.pf-timeline-meta {
  @apply text-[10px] text-gray-400 mt-0.5 font-medium;
}

.pf-timeline-badge {
  @apply text-[10px] font-bold bg-gray-100 px-2 py-0.5 rounded text-gray-600;
}

.pf-timeline-badge--gold {
  @apply bg-amber-100 text-amber-700 border border-amber-200 shadow-sm;
}

.pf-timeline-desc {
  @apply text-[11px] text-gray-600 mt-2 leading-relaxed;
}

.pf-timeline-tags {
  @apply mt-3 flex gap-1.5;
}

.pf-mini-tag {
  @apply text-[9px] px-1.5 py-0.5 rounded font-bold;
}

.pf-mini-tag--gold {
  @apply border border-amber-200 text-amber-700 bg-amber-50;
}

.pf-mini-tag--blue {
  @apply border border-blue-200 text-blue-600 bg-blue-50;
}

.pf-highlight-row {
  @apply mt-3 bg-gray-50 rounded-lg p-2.5 border border-gray-100;
}

.pf-highlight-label {
  @apply text-[10px] font-bold text-gray-500 uppercase tracking-wide;
}

.pf-highlight-text {
  @apply text-[11px] font-medium text-gray-800;
}

.pf-highlight-play {
  @apply w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] shadow-sm hover:scale-105 transition-transform;
}

/* Cards (club & project) */
.pf-card-grid {
  @apply grid grid-cols-1 gap-3;
}

.pf-card {
  @apply bg-white rounded-2xl p-3 shadow-sm flex gap-3 border border-gray-100 transition-all hover:shadow-md;
}

.pf-card-left {
  @apply flex-shrink-0;
}

.pf-card-logo {
  @apply w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold shadow-sm;
}

.pf-card-body {
  @apply flex-1 min-w-0;
}

.pf-card-title {
  @apply text-sm font-bold text-gray-900 truncate;
}

.pf-card-subtitle {
  @apply text-[10px] text-gray-500 mt-1 leading-snug line-clamp-2;
}

.pf-role-pill {
  @apply text-[9px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold flex-shrink-0 ml-2;
}

.pf-tag-xs {
  @apply text-[9px] px-1.5 rounded bg-gray-100 text-gray-500;
}

.pf-card-footer {
  @apply mt-3 flex items-center gap-2 text-[10px] text-gray-400 font-medium;
}

.pf-meta-item {
  @apply flex items-center gap-1.5;
}

.pf-meta-divider {
  @apply w-0.5 h-2 bg-gray-200 rounded-full;
}

.pf-card-tags {
  @apply flex gap-2;
}

.pf-stat-pill {
  @apply text-[9px] text-gray-600 bg-gray-50 px-2 py-0.5 rounded font-mono flex items-center border border-gray-100;
}

/* Practice section */
.pf-practice-section {
  @apply mb-6;
}

.pf-practice-card {
  @apply bg-white rounded-2xl p-4 shadow-sm border border-emerald-100/50 relative overflow-hidden;
  background-image: linear-gradient(to right, #ffffff, #f0fdf4);
}

.pf-practice-header {
  @apply flex justify-between items-start mb-3;
}

.pf-practice-company {
  @apply flex gap-3 items-center;
}

.pf-company-logo {
  @apply w-8 h-8 rounded-lg bg-gray-900 text-white flex items-center justify-center text-xs font-bold shadow-md;
}

.pf-company-name {
  @apply text-sm font-bold text-gray-900;
}

.pf-practice-time {
  @apply text-[10px] font-mono font-bold text-gray-400 bg-white/50 px-2 py-1 rounded;
}

.pf-practice-body {
  @apply pl-11;
}

.pf-practice-list {
  @apply list-disc list-outside text-[10px] text-gray-600 ml-3 space-y-1 marker:text-emerald-300;
}

.pf-practice-award {
  @apply mt-3 flex items-center gap-1.5 text-[10px] text-emerald-700 font-bold bg-emerald-50 w-fit px-2 py-1 rounded-lg border border-emerald-100;
}
</style>