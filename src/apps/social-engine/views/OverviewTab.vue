<script setup lang="ts">
/**
 * 概览 Tab
 * 显示社交引擎的整体统计数据
 */
import { ref, onMounted } from 'vue';
import { StatCard, PlatformCard } from '../components';
import { PlatformRegistry } from '@/services/social/registry';
import { DirectorService } from '@/services/social/directorService';
import { db } from '@/services/database/schema';
import type { EngineStats, PlatformStatus } from '../types';

// 统计数据
const stats = ref<EngineStats>({
  platformCount: 0,
  activeTopicCount: 0,
  postCount: 0,
  commentCount: 0,
  shadowAccountCount: 0,
  todayEventCount: 0,
});

// 平台列表
const platforms = ref<PlatformStatus[]>([]);

// 加载状态
const isLoading = ref(true);

// 导演服务状态
const directorEnabled = ref(false);

onMounted(async () => {
  await loadStats();
});

async function loadStats() {
  isLoading.value = true;
  try {
    // 获取平台注册信息
    const registry = PlatformRegistry.getInstance();
    const allPlatforms = registry.getAllPlatforms();
    stats.value.platformCount = allPlatforms.length;

    // 获取数据库统计（需要同时统计旧系统 socialAccounts 和新系统 platformAccounts）
    const [topics, posts, comments, socialAccts, newAccts] = await Promise.all([
      db.socialTopics.toArray(),
      db.socialPosts.toArray(),
      db.socialComments.toArray(),
      db.socialAccounts.toArray(),
      db.platformAccounts.toArray(),
    ]);

    // 最近3天的活跃话题
    const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
    stats.value.activeTopicCount = topics.filter(t => t.createdAt > threeDaysAgo).length;
    stats.value.postCount = posts.length;
    stats.value.commentCount = comments.length;
    
    // 合并两个账号系统的影子账号统计
    const socialShadowCount = socialAccts.filter(a => a.origin === 'llm_generated').length;
    // 新系统的账号没有 origin 字段，统计所有账号
    stats.value.shadowAccountCount = socialShadowCount + newAccts.length;

    // 构建平台状态列表（合并两个账号系统的统计）
    platforms.value = allPlatforms.map(p => {
      const platformTopics = topics.filter(t => t.platformId === p.id);
      const platformPosts = posts.filter(post => post.platformId === p.id);
      
      // 统计旧系统和新系统的账号
      const oldAcctCount = socialAccts.filter(a => a.platformId === p.id).length;
      const newAcctCount = newAccts.filter(a => a.platformId === p.id).length;
      
      return {
        id: p.id,
        name: p.name,
        enabled: true, // 目前所有平台都启用
        topicCount: platformTopics.length,
        postCount: platformPosts.length,
        accountCount: oldAcctCount + newAcctCount,
      };
    });

    // 检查导演服务状态
    // DirectorService 是单例，直接获取配置较困难，这里暂时设为 false
    directorEnabled.value = false;

  } catch (error) {
    console.error('[SocialEngine] Failed to load stats:', error);
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <div class="overview-tab">
    <!-- 加载状态 -->
    <div v-if="isLoading" class="loading-state">
      <div class="loading-spinner" />
      <p>加载中...</p>
    </div>

    <template v-else>
      <!-- 统计卡片网格 -->
      <div class="stats-grid">
        <StatCard
          label="已注册平台"
          :value="stats.platformCount"
          color="primary"
        >
          <template #icon>🌐</template>
        </StatCard>
        
        <StatCard
          label="活跃话题"
          :value="stats.activeTopicCount"
          color="warning"
        >
          <template #icon>🔥</template>
        </StatCard>
        
        <StatCard
          label="博文总数"
          :value="stats.postCount"
          color="success"
        >
          <template #icon>📝</template>
        </StatCard>
        
        <StatCard
          label="评论总数"
          :value="stats.commentCount"
          color="info"
        >
          <template #icon>💬</template>
        </StatCard>
        
        <StatCard
          label="影子账号"
          :value="stats.shadowAccountCount"
          color="primary"
        >
          <template #icon>👤</template>
        </StatCard>
        
        <StatCard
          label="导演服务"
          :value="directorEnabled ? '运行中' : '已停止'"
          :color="directorEnabled ? 'success' : 'error'"
        >
          <template #icon>🎬</template>
        </StatCard>
      </div>

      <!-- 平台列表 -->
      <div class="section">
        <h3 class="section-title">平台状态</h3>
        <div class="platforms-list">
          <PlatformCard
            v-for="platform in platforms"
            :key="platform.id"
            :platform="platform"
          />
        </div>
      </div>

      <!-- 快捷操作 -->
      <div class="section">
        <h3 class="section-title">快捷操作</h3>
        <div class="quick-actions">
          <button class="action-btn" @click="loadStats">
            <span class="action-icon">🔄</span>
            <span>刷新统计</span>
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.overview-tab {
  @apply p-4 space-y-6;
}

.loading-state {
  @apply flex flex-col items-center justify-center py-12;
  color: var(--color-text-secondary);
}

.loading-spinner {
  @apply w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mb-2;
  border-color: var(--color-primary);
  border-top-color: transparent;
}

.stats-grid {
  @apply grid grid-cols-2 gap-3;
}

.section {
  @apply space-y-3;
}

.section-title {
  @apply text-sm font-medium;
  color: var(--color-text-secondary);
}

.platforms-list {
  @apply space-y-2;
}

.quick-actions {
  @apply flex flex-wrap gap-2;
}

.action-btn {
  @apply flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors;
  background: var(--color-surface);
  color: var(--color-text);
}

.action-btn:hover {
  background: var(--color-surface-variant);
}

.action-btn:active {
  @apply scale-95;
}

.action-icon {
  @apply text-base;
}
</style>
