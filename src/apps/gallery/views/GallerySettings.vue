<script setup lang="ts">
/**
 * 图库设置页
 */
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useGalleryStore } from '../stores'
import type { LocalResourceConfig, RemoteHostConfig } from '../types'

const router = useRouter()
const store = useGalleryStore()

/** 当前标签 */
const activeTab = ref<'local' | 'remote' | 'generation'>('local')

/** 编辑中的本地配置 */
const editingLocalConfig = ref<Partial<LocalResourceConfig> | null>(null)

/** 编辑中的图床配置 */
const editingRemoteHost = ref<Partial<RemoteHostConfig> | null>(null)

/** 新路径输入 */
const newPath = ref('')

/** 返回 */
function goBack() {
  router.back()
}

// ==================== 本地配置管理 ====================

/** 新建本地配置 */
function createLocalConfig() {
  editingLocalConfig.value = {
    name: '新资源配置',
    paths: [],
    enabled: true,
    scanSubdirs: true,
    fileTypes: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
  }
}

/** 编辑本地配置 */
function editLocalConfig(config: LocalResourceConfig) {
  editingLocalConfig.value = { ...config, paths: [...config.paths] }
}

/** 保存本地配置 */
async function saveLocalConfig() {
  if (!editingLocalConfig.value) return
  
  if (editingLocalConfig.value.id) {
    // 更新
    await store.updateLocalConfig(editingLocalConfig.value.id, editingLocalConfig.value)
  } else {
    // 新建
    await store.addLocalConfig(editingLocalConfig.value as Omit<LocalResourceConfig, 'id'>)
  }
  
  editingLocalConfig.value = null
}

/** 删除本地配置 */
async function deleteLocalConfig(id: string) {
  if (confirm('确定要删除此配置吗？')) {
    await store.deleteLocalConfig(id)
  }
}

/** 添加路径 */
function addPath() {
  if (!editingLocalConfig.value || !newPath.value.trim()) return
  
  if (!editingLocalConfig.value.paths) {
    editingLocalConfig.value.paths = []
  }
  
  editingLocalConfig.value.paths.push(newPath.value.trim())
  newPath.value = ''
}

/** 移除路径 */
function removePath(index: number) {
  if (!editingLocalConfig.value?.paths) return
  editingLocalConfig.value.paths.splice(index, 1)
}

// ==================== 图床配置管理 ====================

/** 新建图床配置 */
function createRemoteHost() {
  editingRemoteHost.value = {
    name: '新图床',
    type: 'custom',
    baseUrl: '',
    enabled: true,
  }
}

/** 编辑图床配置 */
function editRemoteHost(host: RemoteHostConfig) {
  editingRemoteHost.value = { ...host }
}

/** 保存图床配置 */
async function saveRemoteHost() {
  if (!editingRemoteHost.value) return
  
  if (editingRemoteHost.value.id) {
    await store.updateRemoteHost(editingRemoteHost.value.id, editingRemoteHost.value)
  } else {
    await store.addRemoteHost(editingRemoteHost.value as Omit<RemoteHostConfig, 'id' | 'createdAt'>)
  }
  
  editingRemoteHost.value = null
}

/** 删除图床配置 */
async function deleteRemoteHost(id: string) {
  if (confirm('确定要删除此图床配置吗？')) {
    await store.deleteRemoteHost(id)
  }
}
</script>

<template>
  <div class="gallery-settings">
    <!-- 头部 -->
    <header class="settings-header">
      <button class="icon-btn" @click="goBack">
        <i class="fas fa-arrow-left"></i>
      </button>
      <h1 class="title">图库设置</h1>
    </header>
    
    <!-- 标签页 -->
    <div class="tabs">
      <button 
        class="tab" 
        :class="{ active: activeTab === 'local' }"
        @click="activeTab = 'local'"
      >
        本地资源
      </button>
      <button 
        class="tab" 
        :class="{ active: activeTab === 'remote' }"
        @click="activeTab = 'remote'"
      >
        图床配置
      </button>
      <button 
        class="tab" 
        :class="{ active: activeTab === 'generation' }"
        @click="activeTab = 'generation'"
      >
        生成设置
      </button>
    </div>
    
    <!-- 内容 -->
    <div class="settings-content">
      <!-- 本地资源配置 -->
      <div v-if="activeTab === 'local'" class="tab-content">
        <div class="section-header">
          <span>资源路径配置</span>
          <button class="add-btn" @click="createLocalConfig">
            <i class="fas fa-plus"></i>
            添加
          </button>
        </div>
        
        <div v-if="store.localConfigs.length === 0" class="empty-hint">
          暂无配置，点击添加按钮创建
        </div>
        
        <div 
          v-for="config in store.localConfigs" 
          :key="config.id" 
          class="config-card"
        >
          <div class="config-header">
            <span class="config-name">{{ config.name }}</span>
            <div class="config-actions">
              <button class="small-btn" @click="editLocalConfig(config)">
                <i class="fas fa-edit"></i>
              </button>
              <button class="small-btn danger" @click="deleteLocalConfig(config.id)">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
          <div class="config-info">
            <span>{{ config.paths.length }} 个路径</span>
            <span :class="config.enabled ? 'status-enabled' : 'status-disabled'">
              {{ config.enabled ? '已启用' : '已禁用' }}
            </span>
          </div>
        </div>
      </div>
      
      <!-- 图床配置 -->
      <div v-if="activeTab === 'remote'" class="tab-content">
        <div class="section-header">
          <span>图床服务配置</span>
          <button class="add-btn" @click="createRemoteHost">
            <i class="fas fa-plus"></i>
            添加
          </button>
        </div>
        
        <div v-if="store.remoteHosts.length === 0" class="empty-hint">
          暂无图床配置
        </div>
        
        <div 
          v-for="host in store.remoteHosts" 
          :key="host.id" 
          class="config-card"
        >
          <div class="config-header">
            <span class="config-name">{{ host.name }}</span>
            <div class="config-actions">
              <button class="small-btn" @click="editRemoteHost(host)">
                <i class="fas fa-edit"></i>
              </button>
              <button class="small-btn danger" @click="deleteRemoteHost(host.id)">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
          <div class="config-info">
            <span>{{ host.type }}</span>
            <span :class="host.enabled ? 'status-enabled' : 'status-disabled'">
              {{ host.enabled ? '已启用' : '已禁用' }}
            </span>
          </div>
        </div>
      </div>
      
      <!-- 生成设置 -->
      <div v-if="activeTab === 'generation'" class="tab-content">
        <div class="form-group">
          <label class="form-label">保存路径</label>
          <input 
            type="text" 
            class="form-input"
            v-model="store.generationConfig.savePath"
            placeholder="assets/gallery/generated"
          />
        </div>
        
        <div class="form-group">
          <label class="form-label">默认步数</label>
          <input 
            type="number" 
            class="form-input"
            v-model.number="store.generationConfig.defaultSteps"
            min="1"
            max="150"
          />
        </div>
        
        <div class="form-group">
          <label class="form-label">默认 CFG Scale</label>
          <input 
            type="number" 
            class="form-input"
            v-model.number="store.generationConfig.defaultCfgScale"
            min="1"
            max="30"
            step="0.5"
          />
        </div>
        
        <div class="form-group">
          <label class="form-label">
            <input 
              type="checkbox" 
              v-model="store.generationConfig.autoThumbnail"
            />
            <span>自动生成缩略图</span>
          </label>
        </div>
        
        <div v-if="store.generationConfig.autoThumbnail" class="form-group">
          <label class="form-label">缩略图尺寸</label>
          <input 
            type="number" 
            class="form-input"
            v-model.number="store.generationConfig.thumbnailSize"
            min="64"
            max="512"
          />
        </div>
      </div>
    </div>
    
    <!-- 编辑本地配置弹窗 -->
    <div v-if="editingLocalConfig" class="modal-overlay">
      <div class="modal">
        <div class="modal-header">
          <span>{{ editingLocalConfig.id ? '编辑' : '新建' }}资源配置</span>
          <button class="icon-btn small" @click="editingLocalConfig = null">
            <i class="fas fa-times"></i>
          </button>
        </div>
        
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">配置名称</label>
            <input 
              type="text" 
              class="form-input"
              v-model="editingLocalConfig.name"
              placeholder="输入配置名称"
            />
          </div>
          
          <div class="form-group">
            <label class="form-label">资源路径</label>
            <div class="path-list">
              <div 
                v-for="(path, index) in editingLocalConfig.paths" 
                :key="index"
                class="path-item"
              >
                <span>{{ path }}</span>
                <button class="small-btn danger" @click="removePath(index)">
                  <i class="fas fa-times"></i>
                </button>
              </div>
            </div>
            <div class="path-input">
              <input 
                type="text" 
                class="form-input"
                v-model="newPath"
                placeholder="输入路径，如 assets/images"
                @keyup.enter="addPath"
              />
              <button class="add-btn" @click="addPath">添加</button>
            </div>
          </div>
          
          <div class="form-group">
            <label class="form-label">
              <input type="checkbox" v-model="editingLocalConfig.enabled" />
              <span>启用此配置</span>
            </label>
          </div>
          
          <div class="form-group">
            <label class="form-label">
              <input type="checkbox" v-model="editingLocalConfig.scanSubdirs" />
              <span>扫描子目录</span>
            </label>
          </div>
        </div>
        
        <div class="modal-footer">
          <button class="btn secondary" @click="editingLocalConfig = null">取消</button>
          <button class="btn primary" @click="saveLocalConfig">保存</button>
        </div>
      </div>
    </div>
    
    <!-- 编辑图床配置弹窗 -->
    <div v-if="editingRemoteHost" class="modal-overlay">
      <div class="modal">
        <div class="modal-header">
          <span>{{ editingRemoteHost.id ? '编辑' : '新建' }}图床配置</span>
          <button class="icon-btn small" @click="editingRemoteHost = null">
            <i class="fas fa-times"></i>
          </button>
        </div>
        
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">名称</label>
            <input 
              type="text" 
              class="form-input"
              v-model="editingRemoteHost.name"
              placeholder="输入图床名称"
            />
          </div>
          
          <div class="form-group">
            <label class="form-label">类型</label>
            <select class="form-input" v-model="editingRemoteHost.type">
              <option value="custom">自定义</option>
              <option value="imgur">Imgur</option>
              <option value="smms">SM.MS</option>
              <option value="cloudinary">Cloudinary</option>
            </select>
          </div>
          
          <div class="form-group">
            <label class="form-label">基础 URL</label>
            <input 
              type="text" 
              class="form-input"
              v-model="editingRemoteHost.baseUrl"
              placeholder="https://example.com/images"
            />
          </div>
          
          <div class="form-group">
            <label class="form-label">API Key（可选）</label>
            <input 
              type="password" 
              class="form-input"
              v-model="editingRemoteHost.apiKey"
              placeholder="输入 API Key"
            />
          </div>
          
          <div class="form-group">
            <label class="form-label">
              <input type="checkbox" v-model="editingRemoteHost.enabled" />
              <span>启用此图床</span>
            </label>
          </div>
        </div>
        
        <div class="modal-footer">
          <button class="btn secondary" @click="editingRemoteHost = null">取消</button>
          <button class="btn primary" @click="saveRemoteHost">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gallery-settings {
  @apply fixed inset-0 flex flex-col;
  background: var(--color-background);
  z-index: 300;
}

/* 头部 */
.settings-header {
  @apply flex items-center gap-3 px-4 py-3;
  @apply border-b;
  background: var(--color-surface);
  border-color: var(--color-border);
}

.title {
  @apply text-lg font-semibold;
  color: var(--color-text);
}

.icon-btn {
  @apply w-10 h-10 flex items-center justify-center rounded-full;
  color: var(--color-text);
}

.icon-btn.small {
  @apply w-8 h-8;
}

/* 标签页 */
.tabs {
  @apply flex border-b;
  background: var(--color-surface);
  border-color: var(--color-border);
}

.tab {
  @apply flex-1 py-3 text-sm;
  @apply border-b-2 border-transparent;
  color: var(--color-text-secondary);
}

.tab.active {
  color: var(--color-primary);
  border-color: var(--color-primary);
}

/* 内容 */
.settings-content {
  @apply flex-1 overflow-auto;
}

.tab-content {
  @apply p-4;
}

.section-header {
  @apply flex items-center justify-between mb-4;
  color: var(--color-text);
}

.add-btn {
  @apply flex items-center gap-1 px-3 py-1.5 rounded;
  @apply text-sm;
  background: var(--color-primary);
  color: white;
}

.empty-hint {
  @apply text-center py-8;
  color: var(--color-text-secondary);
}

/* 配置卡片 */
.config-card {
  @apply p-3 rounded-lg mb-3;
  background: var(--color-surface);
}

.config-header {
  @apply flex items-center justify-between mb-2;
}

.config-name {
  @apply font-medium;
  color: var(--color-text);
}

.config-actions {
  @apply flex gap-1;
}

.small-btn {
  @apply w-8 h-8 flex items-center justify-center rounded;
  color: var(--color-text-secondary);
}

.small-btn:hover {
  background: var(--color-surface-variant);
}

.small-btn.danger {
  color: #ff3b30;
}

.config-info {
  @apply flex items-center gap-3 text-xs;
  color: var(--color-text-secondary);
}

.status-enabled {
  color: #34c759;
}

.status-disabled {
  color: #ff9500;
}

/* 表单 */
.form-group {
  @apply mb-4;
}

.form-label {
  @apply block mb-2 text-sm;
  color: var(--color-text-secondary);
}

.form-label input[type="checkbox"] {
  @apply mr-2;
}

.form-input {
  @apply w-full px-3 py-2 rounded;
  @apply text-sm;
  @apply border outline-none;
  background: var(--color-surface);
  border-color: var(--color-border);
  color: var(--color-text);
}

.form-input:focus {
  border-color: var(--color-primary);
}

/* 路径列表 */
.path-list {
  @apply mb-2;
}

.path-item {
  @apply flex items-center justify-between px-3 py-2 rounded mb-1;
  @apply text-sm;
  background: var(--color-surface-variant);
  color: var(--color-text);
}

.path-input {
  @apply flex gap-2;
}

/* 弹窗 */
.modal-overlay {
  @apply fixed inset-0 flex items-center justify-center p-4;
  background: rgba(0, 0, 0, 0.5);
  z-index: 400;
}

.modal {
  @apply w-full max-w-md rounded-xl overflow-hidden;
  background: var(--color-surface);
}

.modal-header {
  @apply flex items-center justify-between px-4 py-3;
  @apply border-b font-medium;
  border-color: var(--color-border);
  color: var(--color-text);
}

.modal-body {
  @apply p-4 max-h-96 overflow-auto;
}

.modal-footer {
  @apply flex justify-end gap-3 px-4 py-3;
  @apply border-t;
  border-color: var(--color-border);
}

.btn {
  @apply px-4 py-2 rounded text-sm font-medium;
}

.btn.primary {
  background: var(--color-primary);
  color: white;
}

.btn.secondary {
  background: var(--color-surface-variant);
  color: var(--color-text);
}
</style>
