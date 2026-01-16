<script setup lang="ts">
/**
 * 应用商店首页
 */
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStoreStore } from '@/stores/appStoreStore'
import AppCard from '../components/AppCard.vue'
import CategoryGrid from '../components/CategoryGrid.vue'

const router = useRouter()
const appStore = useAppStoreStore()

// 加载状态
const isRefreshing = ref(false)

// Banner 轮播相关
const currentBannerIndex = ref(0)
let bannerTimer: ReturnType<typeof setInterval> | null = null

// Banner 数据 - 使用精选应用生成
const banners = computed(() => {
  return appStore.featuredApps.slice(0, 5).map(app => ({
    id: app.id,
    title: app.name,
    subtitle: app.description || '精选推荐',
    icon: app.icon,
    gradient: app.icon.background
  }))
})

// 切换到下一个 Banner
function nextBanner() {
  if (banners.value.length > 0) {
    currentBannerIndex.value = (currentBannerIndex.value + 1) % banners.value.length
  }
}

// 切换到指定 Banner
function goToBanner(index: number) {
  currentBannerIndex.value = index
  // 重置定时器
  if (bannerTimer) {
    clearInterval(bannerTimer)
    startBannerTimer()
  }
}

// 启动 Banner 自动轮播
function startBannerTimer() {
  bannerTimer = setInterval(nextBanner, 4000)
}

// 刷新数据
async function refresh() {
  isRefreshing.value = true
  await appStore.refreshRegistry()
  isRefreshing.value = false
}

// 跳转到应用详情
function goToDetail(appId: string) {
  router.push({ name: 'AppDetail', params: { appId } })
}

// 跳转到分类页面
function goToCategory(categoryId: string) {
  router.push({ name: 'CategoryApps', params: { categoryId } })
}

// 安装应用
async function handleInstall(appId: string) {
  await appStore.installApp(appId)
}

onMounted(() => {
  // 初次加载
  if (appStore.availableApps.length === 0) {
    refresh()
  }
  // 启动 Banner 轮播
  startBannerTimer()
})

onUnmounted(() => {
  if (bannerTimer) {
    clearInterval(bannerTimer)
  }
})
</script>

<template>
  <div class="store-home">
    <!-- 加载指示器 -->
    <div v-if="isRefreshing" class="loading-indicator">
      <i class="fas fa-spinner fa-spin"></i>
      <span>加载中...</span>
    </div>
    
    <div class="store-content">
      <!-- Banner 轮播 -->
      <section v-if="banners.length > 0" class="banner-section">
        <div class="banner-container">
          <div
            class="banner-track"
            :style="{ transform: `translateX(-${currentBannerIndex * 100}%)` }"
          >
            <div
              v-for="(banner, index) in banners"
              :key="banner.id"
              class="banner-slide"
              @click="goToDetail(banner.id)"
            >
              <div
                class="banner-card"
                :style="{ background: banner.gradient }"
              >
                <div class="banner-content">
                  <div class="banner-text">
                    <span class="banner-label">精选推荐</span>
                    <h3 class="banner-title">{{ banner.title }}</h3>
                    <p class="banner-subtitle">{{ banner.subtitle }}</p>
                  </div>
                  <div class="banner-icon">
                    <i v-if="banner.icon.type === 'font'" :class="banner.icon.value"></i>
                    <span v-else-if="banner.icon.type === 'emoji'">{{ banner.icon.value }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <!-- 指示器 -->
        <div class="banner-indicators">
          <button
            v-for="(_, index) in banners"
            :key="index"
            class="indicator-dot"
            :class="{ active: index === currentBannerIndex }"
            @click="goToBanner(index)"
          />
        </div>
      </section>
      
      <!-- 分类 -->
      <section class="section">
        <h2 class="section-title">
          <i class="fas fa-th-large"></i>
          分类浏览
        </h2>
        <CategoryGrid
          :categories="appStore.categories"
          @select="goToCategory"
        />
      </section>
      
      <!-- 热门应用 -->
      <section class="section">
        <h2 class="section-title">
          <i class="fas fa-fire"></i>
          热门应用
        </h2>
        <div class="app-list">
          <AppCard
            v-for="app in appStore.availableApps"
            :key="app.id"
            :app="app"
            @click="goToDetail(app.id)"
            @install="handleInstall(app.id)"
          />
        </div>
      </section>
      
      <!-- 空状态 -->
      <div v-if="!isRefreshing && appStore.availableApps.length === 0" class="empty-state">
        <i class="fas fa-store"></i>
        <p>暂无可用应用</p>
        <button class="refresh-btn" @click="refresh">
          <i class="fas fa-sync-alt"></i>
          刷新
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.store-home {
  flex: 1;
  overflow-y: auto;
  background: var(--color-background);
}

.loading-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px 0;
  color: var(--color-text-secondary);
}

.store-content {
  padding: 16px;
  padding-bottom: 32px;
}

/* Banner 轮播 */
.banner-section {
  margin-bottom: 24px;
}

.banner-container {
  overflow: hidden;
  border-radius: 16px;
}

.banner-track {
  display: flex;
  transition: transform 0.5s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.banner-slide {
  min-width: 100%;
  flex-shrink: 0;
  cursor: pointer;
}

.banner-card {
  height: 140px;
  border-radius: 16px;
  padding: 20px;
  position: relative;
  overflow: hidden;
}

.banner-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 100%;
  color: #FFFFFF;
}

.banner-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.banner-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  opacity: 0.8;
  letter-spacing: 0.5px;
}

.banner-title {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.5px;
  margin: 4px 0;
}

.banner-subtitle {
  font-size: 13px;
  opacity: 0.9;
  line-height: 1.4;
  max-width: 200px;
}

.banner-icon {
  width: 80px;
  height: 80px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36px;
  flex-shrink: 0;
  backdrop-filter: blur(8px);
}

.banner-indicators {
  display: flex;
  justify-content: center;
  gap: 6px;
  margin-top: 12px;
}

.indicator-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-text-secondary);
  opacity: 0.3;
  transition: all 0.3s ease;
  border: none;
  padding: 0;
  cursor: pointer;
}

.indicator-dot.active {
  width: 18px;
  border-radius: 3px;
  background: var(--color-primary);
  opacity: 1;
}

/* Section 通用样式 */
.section {
  margin-bottom: 24px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text);
  letter-spacing: -0.3px;
  margin-bottom: 16px;
}

.section-title i {
  font-size: 16px;
  color: var(--color-primary);
}

/* 应用列表 */
.app-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 0;
  color: var(--color-text-secondary);
}

.empty-state i {
  font-size: 48px;
  margin-bottom: 12px;
}

.empty-state p {
  font-size: 14px;
  margin-bottom: 16px;
}

.refresh-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 9999px;
  font-size: 14px;
  background: var(--color-primary);
  color: #FFFFFF;
  border: none;
  cursor: pointer;
}

.refresh-btn:active {
  opacity: 0.8;
}
</style>