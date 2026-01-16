<script setup lang="ts">
/**
 * 提示词链列表页
 * 展示所有提示词链，支持筛选、创建、删除等操作
 */
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { promptChainService } from '@/services/promptChainService';
import type { PromptChain } from '@/types/promptChain';

const router = useRouter();

// 状态
const chains = ref<PromptChain[]>([]);
const loading = ref(true);
const searchQuery = ref('');
const filterSource = ref<'all' | 'user' | 'builtin' | 'imported' | 'app'>('all');

// 筛选后的链
const filteredChains = computed(() => {
  let result = chains.value;
  
  // 来源筛选
  if (filterSource.value !== 'all') {
    result = result.filter(c => c.source === filterSource.value);
  }
  
  // 搜索筛选
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(c =>
      c.name.toLowerCase().includes(query) ||
      c.description.toLowerCase().includes(query) ||
      c.tags?.some(t => t.toLowerCase().includes(query))
    );
  }
  
  return result;
});

// 加载数据
async function loadChains() {
  loading.value = true;
  try {
    chains.value = await promptChainService.getAllChains();
  } catch (error) {
    console.error('加载链列表失败:', error);
  } finally {
    loading.value = false;
  }
}

// 创建新链
async function createChain() {
  const emptyChain = promptChainService.createEmptyChain();
  const newChain = await promptChainService.createChain(emptyChain);
  router.push(`/prompts/chains/${newChain.id}`);
}

// 编辑链
function editChain(chain: PromptChain) {
  router.push(`/prompts/chains/${chain.id}`);
}

// 运行链
function runChain(chain: PromptChain) {
  router.push(`/prompts/chains/${chain.id}/run`);
}

// 复制链
async function duplicateChain(chain: PromptChain) {
  const newChain = await promptChainService.duplicateChain(chain.id);
  if (newChain) {
    chains.value.push(newChain);
  }
}

// 删除链
async function deleteChain(chain: PromptChain) {
  if (!confirm(`确定要删除「${chain.name}」吗？`)) return;
  
  const success = await promptChainService.deleteChain(chain.id);
  if (success) {
    chains.value = chains.value.filter(c => c.id !== chain.id);
  }
}

// 切换启用状态
async function toggleChain(chain: PromptChain) {
  await promptChainService.toggleChain(chain.id);
  chain.enabled = !chain.enabled;
}

// 返回
function goBack() {
  router.push('/prompts');
}

// 获取执行模式标签
function getModeLabel(mode: string) {
  return mode === 'single-shot' ? '单次' : '多步';
}

// 获取来源标签
function getSourceLabel(source: string, appId?: string) {
  const labels: Record<string, string> = {
    builtin: '内置',
    user: '自定义',
    imported: '导入',
    app: appId ? `应用: ${appId}` : '应用',
  };
  return labels[source] || source;
}

// 判断链是否可编辑（App 链也可编辑）
function isChainEditable(chain: PromptChain) {
  return chain.source === 'user' || chain.source === 'imported' || chain.source === 'app';
}

onMounted(() => {
  loadChains();
});
</script>

<template>
  <div class="chains-list">
    <!-- 头部 -->
    <header class="header">
      <button class="back-btn" @click="goBack">
        <i class="fas fa-chevron-left"></i>
      </button>
      <h1 class="title">提示词链</h1>
      <button class="create-btn" @click="createChain">
        <i class="fas fa-plus"></i>
      </button>
    </header>
    
    <!-- 搜索和筛选 -->
    <div class="filters">
      <div class="search-box">
        <i class="fas fa-search"></i>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="搜索链名称、描述或标签..."
        />
      </div>
      
      <div class="filter-tabs">
        <button
          :class="{ active: filterSource === 'all' }"
          @click="filterSource = 'all'"
        >
          全部
        </button>
        <button
          :class="{ active: filterSource === 'user' }"
          @click="filterSource = 'user'"
        >
          自定义
        </button>
        <button
          :class="{ active: filterSource === 'builtin' }"
          @click="filterSource = 'builtin'"
        >
          内置
        </button>
        <button
          :class="{ active: filterSource === 'imported' }"
          @click="filterSource = 'imported'"
        >
          导入
        </button>
        <button
          :class="{ active: filterSource === 'app' }"
          @click="filterSource = 'app'"
        >
          应用
        </button>
      </div>
    </div>
    
    <!-- 列表 -->
    <div class="list-container">
      <div v-if="loading" class="loading">
        <i class="fas fa-spinner fa-spin"></i>
        <span>加载中...</span>
      </div>
      
      <div v-else-if="filteredChains.length === 0" class="empty">
        <i class="fas fa-link"></i>
        <p>暂无提示词链</p>
        <button @click="createChain">创建第一个链</button>
      </div>
      
      <div v-else class="chain-list">
        <div
          v-for="chain in filteredChains"
          :key="chain.id"
          class="chain-card"
          :class="{ disabled: !chain.enabled }"
        >
          <div class="chain-header">
            <div class="chain-icon">
              <i :class="chain.icon || 'fas fa-link'"></i>
            </div>
            <div class="chain-info">
              <h3 class="chain-name">{{ chain.name }}</h3>
              <p class="chain-desc">{{ chain.description || '无描述' }}</p>
            </div>
            <button
              class="toggle-btn"
              :class="{ enabled: chain.enabled }"
              @click.stop="toggleChain(chain)"
            >
              <i :class="chain.enabled ? 'fas fa-toggle-on' : 'fas fa-toggle-off'"></i>
            </button>
          </div>
          
          <div class="chain-meta">
            <span class="meta-item mode">
              <i class="fas fa-play-circle"></i>
              {{ getModeLabel(chain.executionMode) }}
            </span>
            <span class="meta-item steps">
              <i class="fas fa-list-ol"></i>
              {{ chain.steps.length }} 步骤
            </span>
            <span class="meta-item source" :class="{ 'source-app': chain.source === 'app' }">
              {{ getSourceLabel(chain.source, chain.appId) }}
            </span>
          </div>
          
          <div v-if="chain.tags?.length" class="chain-tags">
            <span v-for="tag in chain.tags" :key="tag" class="tag">
              {{ tag }}
            </span>
          </div>
          
          <div class="chain-actions">
            <button class="action-btn run" @click="runChain(chain)" title="运行">
              <i class="fas fa-play"></i>
            </button>
            <button 
              v-if="isChainEditable(chain)"
              class="action-btn edit" 
              @click="editChain(chain)" 
              title="编辑"
            >
              <i class="fas fa-edit"></i>
            </button>
            <button 
              v-else
              class="action-btn view" 
              @click="editChain(chain)" 
              title="查看"
            >
              <i class="fas fa-eye"></i>
            </button>
            <button class="action-btn copy" @click="duplicateChain(chain)" title="复制">
              <i class="fas fa-copy"></i>
            </button>
            <button
              v-if="isChainEditable(chain)"
              class="action-btn delete"
              @click="deleteChain(chain)"
              title="删除"
            >
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chains-list {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-primary, #f5f5f5);
}

.header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--bg-secondary, #fff);
  border-bottom: 1px solid var(--border-color, #e0e0e0);
}

.back-btn,
.create-btn {
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary, #666);
  transition: all 0.2s;
}

.back-btn:hover,
.create-btn:hover {
  background: var(--bg-hover, #f0f0f0);
  color: var(--primary-color, #007aff);
}

.title {
  flex: 1;
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}

.filters {
  padding: 12px 16px;
  background: var(--bg-secondary, #fff);
  border-bottom: 1px solid var(--border-color, #e0e0e0);
}

.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--bg-primary, #f5f5f5);
  border-radius: 8px;
  margin-bottom: 12px;
}

.search-box i {
  color: var(--text-tertiary, #999);
}

.search-box input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 14px;
  outline: none;
}

.filter-tabs {
  display: flex;
  gap: 8px;
}

.filter-tabs button {
  padding: 6px 12px;
  border: none;
  background: var(--bg-primary, #f5f5f5);
  border-radius: 16px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.filter-tabs button.active {
  background: var(--primary-color, #007aff);
  color: #fff;
}

.list-container {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.loading,
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: var(--text-tertiary, #999);
}

.loading i,
.empty i {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty button {
  margin-top: 16px;
  padding: 8px 16px;
  background: var(--primary-color, #007aff);
  color: #fff;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}

.chain-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.chain-card {
  background: var(--bg-secondary, #fff);
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: all 0.2s;
}

.chain-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.chain-card.disabled {
  opacity: 0.6;
}

.chain-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.chain-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--primary-light, #e3f2fd);
  border-radius: 10px;
  color: var(--primary-color, #007aff);
  font-size: 18px;
}

.chain-info {
  flex: 1;
  min-width: 0;
}

.chain-name {
  margin: 0 0 4px;
  font-size: 16px;
  font-weight: 600;
}

.chain-desc {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary, #666);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.toggle-btn {
  border: none;
  background: transparent;
  font-size: 24px;
  cursor: pointer;
  color: var(--text-tertiary, #999);
  transition: color 0.2s;
}

.toggle-btn.enabled {
  color: var(--success-color, #34c759);
}

.chain-meta {
  display: flex;
  gap: 16px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border-color, #e0e0e0);
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--text-secondary, #666);
}

.meta-item i {
  font-size: 11px;
}

.meta-item.mode {
  color: var(--primary-color, #007aff);
}

.meta-item.source-app {
  color: var(--success-color, #34c759);
  font-weight: 500;
}

.chain-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}

.tag {
  padding: 2px 8px;
  background: var(--bg-primary, #f5f5f5);
  border-radius: 10px;
  font-size: 11px;
  color: var(--text-secondary, #666);
}

.chain-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
}

.action-btn {
  position: relative;
  width: 32px;
  height: 32px;
  border: none;
  background: var(--bg-primary, #f5f5f5);
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary, #666);
  transition: all 0.2s;
  flex-shrink: 0;
}

.action-btn:hover {
  background: var(--bg-hover, #e0e0e0);
}

.action-btn.run {
  background: var(--primary-color, #007aff);
  color: #fff;
}

.action-btn.run:hover {
  background: var(--primary-dark, #0056b3);
}

.action-btn.delete:hover {
  background: var(--danger-color, #ff3b30);
  color: #fff;
}

.action-btn.view {
  background: var(--bg-primary, #f5f5f5);
  color: var(--text-tertiary, #999);
}
</style>
