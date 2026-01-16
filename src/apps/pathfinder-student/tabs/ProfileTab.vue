<script setup lang="ts">
/**
 * 我的 Tab
 * 参考 Pathfinder/Student/我的.html
 * 内容：
 * - 顶部个人信息
 * - 数字一卡通
 * - 宿舍管家
 * - 设备控制中心
 * - 医保卡片
 * - 退出登录按钮
 */
</script>

<template>
  <div class="pf-profile-tab">
    <!-- 顶部个人信息 -->
    <header class="pf-profile-header">
      <div class="pf-profile-main">
        <div class="pf-avatar-wrapper">
          <div class="pf-avatar">
            <div class="pf-avatar-inner">
              M
            </div>
          </div>
          <div class="pf-level-badge">
            <i class="fa-solid fa-crown text-[8px] mr-0.5" />LV.4
          </div>
        </div>
        <div class="pf-profile-info">
          <h1 class="pf-profile-name">Mist</h1>
          <div class="pf-profile-id-row">
            <span class="pf-profile-id">ID: 2027090577</span>
            <button class="text-gray-400 hover:text-blue-500 transition-colors">
               <i class="fa-regular fa-copy text-xs" />
            </button>
          </div>
          <div class="pf-profile-tags">
            <span class="pf-tag pf-tag--primary">战术系 · FPS</span>
            <span class="pf-tag pf-tag--role">
              <i class="fa-solid fa-user-shield mr-1" />宿舍长
            </span>
          </div>
        </div>
      </div>
      <button class="pf-settings-btn">
         <i class="fa-solid fa-gear" />
      </button>
    </header>

    <main class="pf-profile-main-content">
      <!-- 数字一卡通 (Skeuomorphic Black Gold Style) -->
      <section class="pf-card pf-ecard-card">
        <div class="pf-ecard-texture" />
        <div class="pf-ecard-glow" />
        
        <div class="pf-ecard-top">
          <div>
            <div class="pf-ecard-brand">
              <i class="fa-solid fa-building-columns" />
              <span>PATHFINDER ACADEMY</span>
            </div>
             <div class="pf-ecard-chip-row">
                <div class="pf-ecard-chip">
                  <div class="pf-chip-line-1" />
                  <div class="pf-chip-line-2" />
                  <div class="pf-chip-line-3" />
                </div>
                <i class="fa-solid fa-wifi text-gray-500/50 rotate-90" />
             </div>
          </div>
          <div class="pf-ecard-qrcode-box">
            <i class="fa-solid fa-qrcode" />
          </div>
        </div>
        
        <div class="pf-ecard-balance">
           <div class="pf-ecard-balance-label">Current Balance</div>
           <div class="pf-ecard-balance-value">¥ 2,450.80</div>
        </div>

        <div class="pf-ecard-actions">
          <button type="button" class="pf-ecard-action-btn">
            <div class="pf-ecard-btn-icon"><i class="fa-solid fa-wallet" /></div>
            <span>充值</span>
          </button>
          <div class="pf-ecard-divider" />
          <button type="button" class="pf-ecard-action-btn">
            <div class="pf-ecard-btn-icon"><i class="fa-solid fa-file-invoice" /></div>
            <span>账单</span>
          </button>
          <div class="pf-ecard-divider" />
          <button type="button" class="pf-ecard-action-btn">
             <div class="pf-ecard-btn-icon"><i class="fa-solid fa-nfc-symbol" /></div>
            <span>门禁卡包</span>
          </button>
        </div>
      </section>

      <!-- 宿舍管家 -->
      <section class="pf-card pf-dorm-card">
        <div class="pf-dorm-header">
          <div class="pf-dorm-title">
            <div class="pf-dorm-icon">
              <i class="fa-solid fa-house" />
            </div>
            <div>
              <h3 class="pf-dorm-room">竹隐居 A-404</h3>
              <p class="pf-dorm-env">
                 <i class="fa-solid fa-temperature-half text-gray-400 mr-1" />24.5°C
                 <span class="mx-1 text-gray-300">|</span>
                 <i class="fa-solid fa-droplet text-gray-400 mr-1" />45%
              </p>
            </div>
          </div>
          <span class="pf-status-pill">
            <span class="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse mr-1" />
            正常
          </span>
        </div>

        <div class="pf-dorm-stats">
          <div class="pf-dorm-stat">
            <div class="flex justify-between items-start mb-1">
               <div class="pf-dorm-stat-label">剩余电量</div>
               <i class="fa-solid fa-bolt text-yellow-500/50 text-xs" />
            </div>
            <div class="pf-dorm-stat-value">
              128
              <span class="pf-dorm-stat-unit">kWh</span>
            </div>
            <div class="pf-progress">
              <div class="pf-progress-fill bg-gradient-to-r from-yellow-400 to-amber-500" style="width: 40%" />
            </div>
          </div>
          <div class="pf-dorm-stat">
            <div class="flex justify-between items-start mb-1">
               <div class="pf-dorm-stat-label">剩余水费</div>
               <i class="fa-solid fa-water text-blue-500/50 text-xs" />
            </div>
            <div class="pf-dorm-stat-value">¥ 45.0</div>
            <div class="pf-progress">
              <div class="pf-progress-fill bg-gradient-to-r from-blue-400 to-cyan-500" style="width: 80%" />
            </div>
          </div>
        </div>

        <button type="button" class="pf-dorm-pay-btn">
          <span>一键缴费</span>
          <i class="fa-solid fa-arrow-right ml-1" />
        </button>
      </section>

      <!-- 设备控制中心 -->
      <section class="pf-card pf-device-card">
        <div class="pf-card-header">
          <h3 class="pf-card-title">
            <div class="w-1 h-4 bg-blue-600 rounded-full mr-2" />
            设备控制中心
          </h3>
          <span class="pf-card-subtitle">
             <i class="fa-solid fa-link mr-1" />Artemis·Link
          </span>
        </div>

        <!-- 个人设备 -->
        <div class="pf-device-list">
          <div class="pf-device-item">
            <div class="pf-device-info">
              <div class="pf-device-icon bg-gray-100 text-gray-600">
                 <i class="fa-solid fa-desktop" />
              </div>
              <div>
                <div class="pf-device-name">个人PC (Workstation-Alpha)</div>
                <div class="pf-device-status text-gray-400">状态: 休眠中</div>
              </div>
            </div>
            <button type="button" class="pf-toggle">
              <div class="pf-toggle-thumb" />
            </button>
          </div>

          <div class="pf-device-item">
            <div class="pf-device-info">
              <div class="pf-device-icon bg-blue-50 text-blue-600">
                 <i class="fa-solid fa-cloud-arrow-up" />
              </div>
              <div>
                <div class="pf-device-name">外设配置云同步</div>
                <div class="pf-device-status text-blue-600">检测到训练室A03登录</div>
              </div>
            </div>
            <button type="button" class="pf-sync-btn">
              同步
            </button>
          </div>
        </div>

        <!-- 宿舍长权限 -->
        <div class="pf-dorm-leader">
          <div class="pf-dorm-leader-title">
            <i class="fa-solid fa-crown text-amber-500" /> 宿舍长权限
          </div>
          <div class="pf-dorm-leader-grid">
            <div class="pf-dorm-leader-card">
              <div class="pf-dorm-leader-head">
                <span class="text-gray-500">中央空调</span>
                <span class="pf-dorm-leader-status text-green-500">
                  <span class="w-1.5 h-1.5 rounded-full bg-green-500 inline-block mr-0.5" />ON
                </span>
              </div>
              <div class="pf-dorm-leader-body">
                <button type="button" class="pf-control-btn"><i class="fa-solid fa-minus" /></button>
                <span class="pf-dorm-temp">26°C</span>
                <button type="button" class="pf-control-btn"><i class="fa-solid fa-plus" /></button>
              </div>
            </div>
            <div class="pf-dorm-leader-card">
               <div class="flex justify-between items-center h-full">
                  <div class="text-[10px] font-bold text-gray-700 leading-tight">
                    饮水机
                    <div class="text-[9px] text-gray-400 font-normal">加热模式</div>
                  </div>
                  <div class="pf-switch-wrapper">
                    <input id="water-toggle" type="checkbox" class="pf-checkbox" />
                    <label for="water-toggle" class="pf-switch-label" />
                  </div>
               </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 健康保险 -->
      <section class="pf-health-card">
        <div class="pf-health-main">
          <div class="pf-health-icon">
            <i class="fa-solid fa-star-of-life" />
          </div>
          <div>
            <h3 class="pf-health-title">焕辰·青苗医保 (学生版)</h3>
            <p class="pf-health-meta">保单号: HC-2027-STU-9982</p>
          </div>
        </div>
        <i class="fa-solid fa-chevron-right text-gray-300 text-xs" />
      </section>

      <!-- 退出登录 -->
      <button type="button" class="pf-logout-btn">
        退出登录
      </button>
    </main>
  </div>
</template>

<style scoped>
.pf-profile-tab {
  @apply h-full flex flex-col;
  /* 背景由父组件控制 */
}

/* Header */
.pf-profile-header {
  @apply pt-8 pb-6 px-5 border-b border-gray-100 sticky top-0 z-20;
  @apply flex items-center justify-between;
  background-color: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(12px);
}

.pf-profile-main {
  @apply flex items-center gap-4;
}

.pf-avatar-wrapper {
  @apply relative;
}

.pf-avatar {
  @apply w-16 h-16 rounded-full p-1 bg-white border border-gray-100 shadow-md;
}

.pf-avatar-inner {
  @apply w-full h-full rounded-full flex items-center justify-center text-2xl font-bold text-white shadow-inner;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
}

.pf-level-badge {
  @apply absolute -bottom-1 -right-2 text-[9px] px-2 py-0.5 rounded-full border-2 border-white shadow-sm flex items-center font-black italic;
  background: linear-gradient(135deg, #f59e0b, #d97706);
  color: #ffffff;
}

.pf-profile-info {
  @apply flex-1;
}

.pf-profile-name {
  @apply text-xl font-black text-gray-900 tracking-tight;
}

.pf-profile-id-row {
  @apply flex items-center gap-2 mt-0.5;
}

.pf-profile-id {
  @apply text-xs text-gray-400 font-mono font-medium;
}

.pf-profile-tags {
  @apply flex gap-2 mt-2;
}

.pf-tag {
  @apply text-[9px] px-2 py-0.5 rounded-md font-bold border;
}

.pf-tag--primary {
  @apply bg-gray-50 text-gray-600 border-gray-200;
}

.pf-tag--role {
  @apply bg-blue-50 text-blue-600 border-blue-100;
}

.pf-settings-btn {
  @apply w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors;
}

/* Main content */
.pf-profile-main-content {
  @apply px-5 pt-6 space-y-5 pb-24;
}

/* Generic card */
.pf-card {
  @apply rounded-2xl bg-white border border-gray-100 shadow-sm transition-all;
}

/* E-card (Black Gold) */
.pf-ecard-card {
  @apply p-6 text-white shadow-xl relative overflow-hidden border-0;
  background: linear-gradient(135deg, #18181b 0%, #09090b 100%);
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3);
}

.pf-ecard-texture {
  @apply absolute inset-0 opacity-20 pointer-events-none;
  background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
}

.pf-ecard-glow {
  @apply absolute top-0 right-0 w-64 h-64 bg-amber-500 rounded-full blur-[100px] opacity-10 pointer-events-none;
  transform: translate(30%, -30%);
}

.pf-ecard-top {
  @apply relative z-10 flex justify-between items-start;
}

.pf-ecard-brand {
  @apply flex items-center gap-2 text-amber-500/80 text-[10px] font-bold tracking-[0.2em] mb-4;
}

.pf-ecard-chip-row {
  @apply flex items-center gap-3;
}

.pf-ecard-chip {
  @apply w-10 h-8 rounded bg-gradient-to-br from-amber-100 to-amber-300 relative overflow-hidden shadow-inner;
}

.pf-chip-line-1, .pf-chip-line-2, .pf-chip-line-3 {
  @apply absolute border border-amber-500/30;
}
.pf-chip-line-1 { @apply top-1/2 left-0 w-full h-px; }
.pf-chip-line-2 { @apply left-1/2 top-0 h-full w-px; }
.pf-chip-line-3 { @apply top-1/2 left-1/2 w-4 h-4 rounded-md border transform -translate-x-1/2 -translate-y-1/2; }

.pf-ecard-qrcode-box {
  @apply bg-white p-2 rounded-lg shadow-lg;
  color: #18181b;
}

.pf-ecard-balance {
  @apply mt-6 relative z-10;
}

.pf-ecard-balance-label {
  @apply text-[10px] text-gray-400 uppercase tracking-wide font-medium;
}

.pf-ecard-balance-value {
  @apply text-3xl font-bold mt-1 text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-300;
  font-family: 'JetBrains Mono', monospace;
  text-shadow: 0 2px 10px rgba(255, 255, 255, 0.1);
}

.pf-ecard-actions {
  @apply relative z-10 mt-6 flex items-center justify-between border-t border-white/10 pt-4;
}

.pf-ecard-action-btn {
  @apply flex flex-col items-center gap-1.5 text-[10px] font-medium text-gray-300 hover:text-white transition-colors active:scale-95;
}

.pf-ecard-btn-icon {
  @apply w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-sm border border-white/10;
}

.pf-ecard-divider {
  @apply w-px h-8 bg-gradient-to-b from-transparent via-white/10 to-transparent;
}

/* Dorm card */
.pf-dorm-card {
  @apply p-5;
}

.pf-dorm-header {
  @apply flex justify-between items-start mb-5;
}

.pf-dorm-title {
  @apply flex items-center gap-3;
}

.pf-dorm-icon {
  @apply w-10 h-10 rounded-xl flex items-center justify-center text-lg bg-emerald-50 text-emerald-600 border border-emerald-100;
}

.pf-dorm-room {
  @apply text-sm font-bold text-gray-900;
}

.pf-dorm-env {
  @apply text-[11px] text-gray-500 font-medium mt-0.5;
}

.pf-status-pill {
  @apply text-[10px] px-2 py-0.5 rounded-full font-bold bg-gray-50 text-gray-600 border border-gray-100 flex items-center;
}

.pf-dorm-stats {
  @apply grid grid-cols-2 gap-3 mb-4;
}

.pf-dorm-stat {
  @apply bg-gray-50 p-3 rounded-xl border border-gray-100;
}

.pf-dorm-stat-label {
  @apply text-[10px] text-gray-500 font-bold;
}

.pf-dorm-stat-value {
  @apply text-lg font-black text-gray-800 my-1;
  font-family: 'JetBrains Mono', monospace;
}

.pf-dorm-stat-unit {
  @apply text-[10px] font-medium text-gray-400;
}

.pf-progress {
  @apply w-full h-1.5 bg-gray-200 rounded-full overflow-hidden;
}

.pf-progress-fill {
  @apply h-full rounded-full shadow-sm;
}

.pf-dorm-pay-btn {
  @apply w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center transition-all active:scale-[0.98];
  background-color: #f0f9ff;
  color: #0284c7;
  border: 1px solid #bae6fd;
}

/* Device card */
.pf-device-card {
  @apply p-5;
}

.pf-card-header {
  @apply flex justify-between items-center mb-4;
}

.pf-card-title {
  @apply text-sm font-bold text-gray-900 flex items-center;
}

.pf-card-subtitle {
  @apply text-[10px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md;
}

.pf-device-list {
  @apply space-y-3;
}

.pf-device-item {
  @apply flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100 transition-colors hover:border-gray-200;
}

.pf-device-info {
  @apply flex items-center gap-3;
}

.pf-device-icon {
  @apply w-8 h-8 rounded-lg flex items-center justify-center text-sm;
}

.pf-device-name {
  @apply text-xs font-bold text-gray-800;
}

.pf-device-status {
  @apply text-[10px] font-medium mt-0.5;
}

/* Toggle */
.pf-toggle {
  @apply w-10 h-6 rounded-full relative transition-colors duration-200 bg-gray-200 shadow-inner;
}

.pf-toggle-thumb {
  @apply w-4 h-4 rounded-full bg-white shadow-md transform translate-x-1 transition-transform duration-200;
}

.pf-sync-btn {
  @apply text-[10px] px-3 py-1.5 rounded-lg font-bold text-white bg-blue-600 hover:bg-blue-700 transition active:scale-95 shadow-sm shadow-blue-200;
}

/* Dorm leader */
.pf-dorm-leader {
  @apply mt-4 rounded-xl p-3 bg-gradient-to-br from-gray-50 to-white border border-gray-100;
}

.pf-dorm-leader-title {
  @apply text-[10px] font-bold mb-3 flex items-center gap-1.5 text-gray-600 uppercase tracking-wide;
}

.pf-dorm-leader-grid {
  @apply grid grid-cols-2 gap-3;
}

.pf-dorm-leader-card {
  @apply bg-white p-3 rounded-lg shadow-sm border border-gray-100 flex flex-col justify-between h-20;
}

.pf-dorm-leader-head {
  @apply flex justify-between items-center text-[10px] font-bold;
}

.pf-dorm-leader-status {
  @apply text-[9px] font-mono;
}

.pf-dorm-leader-body {
  @apply flex items-center justify-between mt-auto;
}

.pf-control-btn {
  @apply w-6 h-6 rounded-md bg-gray-50 text-gray-500 text-[10px] hover:bg-gray-100 hover:text-gray-900 border border-gray-200 flex items-center justify-center transition-colors active:bg-gray-200;
}

.pf-dorm-temp {
  @apply font-mono font-black text-sm text-gray-800;
}

/* Custom switch checkbox */
.pf-switch-wrapper {
  @apply relative inline-block w-9 h-5 align-middle select-none;
}

.pf-checkbox {
  @apply opacity-0 absolute w-0 h-0;
}

.pf-switch-label {
  @apply block overflow-hidden h-5 rounded-full bg-gray-200 cursor-pointer transition-colors duration-200 shadow-inner;
}

.pf-switch-label:before {
  @apply absolute block w-4 h-4 m-0.5 bg-white rounded-full transition-transform duration-200 content-[''] shadow-sm;
}

.pf-checkbox:checked + .pf-switch-label {
  @apply bg-amber-500;
}

.pf-checkbox:checked + .pf-switch-label:before {
  @apply translate-x-4;
}

/* Health card */
.pf-health-card {
  @apply bg-white rounded-2xl p-4 shadow-sm flex items-center justify-between border border-gray-100;
}

.pf-health-main {
  @apply flex gap-3 items-center;
}

.pf-health-icon {
  @apply w-10 h-10 rounded-xl flex items-center justify-center text-lg bg-red-50 text-red-500 border border-red-100;
}

.pf-health-title {
  @apply text-xs font-bold text-gray-900;
}

.pf-health-meta {
  @apply text-[10px] text-gray-400 font-mono mt-0.5;
}

/* Logout */
.pf-logout-btn {
  @apply w-full text-center text-xs py-4 text-gray-400 font-medium hover:text-red-500 transition-colors;
}
</style>