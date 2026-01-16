<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { SystemPromptService } from '@/services/systemPromptService';
import { PromptService } from '@/services/promptService';
import { getIconRegistryService } from '@/services/iconRegistryService';
import { useDialogStore } from '@/stores/dialogStore';
import DynamicAppIcon from '@/components/common/DynamicAppIcon.vue';
import type { PromptTemplate } from '@/types/prompts';

const router = useRouter();
const dialog = useDialogStore();
const iconRegistry = getIconRegistryService();

// 数据
const systemPrompts = ref<PromptTemplate[]>([]);
const loading = ref(true);
const showCreateDialog = ref(false);
const showEditDialog = ref(false);
const editingPrompt = ref<PromptTemplate | null>(null);

// 表单数据
const formData = ref({
  name: '',
  description: '',
  content: '',
  scope: 'global' as 'global' | 'app',
  appId: '',
  mode: 'append' as 'append' | 'override',
  applicableScenes: '',
  excludeScenes: '',
  priority: 0,
});

const loadData = () => {
  loading.value = true;
  try {
    systemPrompts.value = SystemPromptService.getAllSystemPrompts();
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  loadData();
});

// 统计
const stats = computed(() => SystemPromptService.getStats());

// 分组：全局 vs App
const globalPrompts = computed(() => 
  systemPrompts.value.filter(p => p.systemPromptScope === 'global')
);

const appPrompts = computed(() => 
  systemPrompts.value.filter(p => p.systemPromptScope === 'app')
);

// 按 App 分组
const appGroupedPrompts = computed(() => {
  const groups: Record<string, PromptTemplate[]> = {};
  appPrompts.value.forEach(p => {
    const appId = p.source.type === 'app' ? p.source.appId : 'unknown';
    if (!groups[appId]) groups[appId] = [];
    groups[appId].push(p);
  });
  return groups;
});

// 可用的 App 列表（用于创建时选择）
const availableApps = computed(() => {
  const appIds = PromptService.getAppIdsWithPrompts();
  return appIds.map(id => {
    const info = iconRegistry.get(id);
    return {
      id,
      name: info?.name || id,
    };
  });
});

const getAppName = (appId: string) => {
  const info = iconRegistry.get(appId);
  return info?.name || appId;
};

// 重置表单
const resetForm = () => {
  formData.value = {
    name: '',
    description: '',
    content: '',
    scope: 'global',
    appId: '',
    mode: 'append',
    applicableScenes: '',
    excludeScenes: '',
    priority: 0,
  };
};

// 打开创建对话框
const openCreateDialog = () => {
  resetForm();
  showCreateDialog.value = true;
};

// 打开编辑对话框
const openEditDialog = (prompt: PromptTemplate) => {
  editingPrompt.value = prompt;
  formData.value = {
    name: prompt.name,
    description: prompt.description || '',
    content: prompt.template,
    scope: prompt.systemPromptScope || 'global',
    appId: prompt.source.type === 'app' ? prompt.source.appId : '',
    mode: prompt.systemPromptMode || 'append',
    applicableScenes: prompt.applicableScenes?.join(', ') || '',
    excludeScenes: prompt.excludeScenes?.join(', ') || '',
    priority: prompt.priority,
  };
  showEditDialog.value = true;
};

// 创建系统提示词
const handleCreate = () => {
  if (!formData.value.name.trim() || !formData.value.content.trim()) {
    dialog.alert({
      title: '提示',
      message: '请填写名称和内容',
      icon: 'warning',
    });
    return;
  }
  
  if (formData.value.scope === 'app' && !formData.value.appId) {
    dialog.alert({
      title: '提示',
      message: '请选择关联的应用',
      icon: 'warning',
    });
    return;
  }
  
  SystemPromptService.create({
    name: formData.value.name.trim(),
    description: formData.value.description.trim() || undefined,
    content: formData.value.content.trim(),
    scope: formData.value.scope,
    appId: formData.value.scope === 'app' ? formData.value.appId : undefined,
    mode: formData.value.mode,
    applicableScenes: formData.value.applicableScenes 
      ? formData.value.applicableScenes.split(',').map(s => s.trim()).filter(Boolean)
      : undefined,
    excludeScenes: formData.value.excludeScenes
      ? formData.value.excludeScenes.split(',').map(s => s.trim()).filter(Boolean)
      : undefined,
    priority: formData.value.priority,
  });
  
  showCreateDialog.value = false;
  loadData();
};

// 更新系统提示词
const handleUpdate = () => {
  if (!editingPrompt.value) return;
  
  if (!formData.value.name.trim() || !formData.value.content.trim()) {
    dialog.alert({
      title: '提示',
      message: '请填写名称和内容',
      icon: 'warning',
    });
    return;
  }
  
  SystemPromptService.update(editingPrompt.value.id, {
    name: formData.value.name.trim(),
    description: formData.value.description.trim() || undefined,
    content: formData.value.content.trim(),
    mode: formData.value.mode,
    applicableScenes: formData.value.applicableScenes 
      ? formData.value.applicableScenes.split(',').map(s => s.trim()).filter(Boolean)
      : undefined,
    excludeScenes: formData.value.excludeScenes
      ? formData.value.excludeScenes.split(',').map(s => s.trim()).filter(Boolean)
      : undefined,
    priority: formData.value.priority,
  });
  
  showEditDialog.value = false;
  editingPrompt.value = null;
  loadData();
};

// 删除
const handleDelete = async (prompt: PromptTemplate) => {
  const confirmed = await dialog.confirm({
    title: '删除确认',
    message: `确定要删除「${prompt.name}」吗？`,
    detail: '删除后无法恢复',
    confirmText: '删除',
    confirmType: 'danger',
    icon: 'warning',
  });
  
  if (confirmed) {
    SystemPromptService.delete(prompt.id);
    loadData();
  }
};

// 切换启用状态
const handleToggle = (prompt: PromptTemplate) => {
  SystemPromptService.toggle(prompt.id);
  loadData();
};

// 返回
const goBack = () => {
  router.back();
};
</script>

<template>
  <div class="system-prompts-page">
    <!-- Header -->
    <header class="page-header">
      <button class="back-btn" @click="goBack">
        <i class="fas fa-arrow-left"></i>
      </button>
      <h1 class="page-title">系统提示词</h1>
      <button class="add-btn" @click="openCreateDialog">
        <i class="fas fa-plus"></i>
      </button>
    </header>
    
    <!-- Stats -->
    <div class="stats-bar">
      <div class="stat-item">
        <span class="stat-value">{{ stats.total }}</span>
        <span class="stat-label">总数</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">{{ stats.global }}</span>
        <span class="stat-label">全局</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">{{ stats.app }}</span>
        <span class="stat-label">应用级</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">{{ stats.enabled }}</span>
        <span class="stat-label">已启用</span>
      </div>
    </div>
    
    <!-- Content -->
    <div class="content-scroll">
      <!-- 空状态 -->
      <div v-if="!loading && systemPrompts.length === 0" class="empty-state">
        <i class="fas fa-globe empty-icon"></i>
        <p class="empty-text">暂无系统提示词</p>
        <p class="empty-hint">系统提示词会自动注入到所有 LLM 调用中</p>
        <button class="create-btn" @click="openCreateDialog">
          <i class="fas fa-plus"></i>
          创建系统提示词
        </button>
      </div>
      
      <!-- 全局提示词 -->
      <section v-if="globalPrompts.length > 0" class="section">
        <div class="section-header">
          <h2 class="section-title">
            <i class="fas fa-globe"></i>
            全局系统提示词
          </h2>
          <span class="section-count">{{ globalPrompts.length }}</span>
        </div>
        <p class="section-desc">适用于所有 LLM 调用</p>
        
        <div class="prompt-list">
          <div 
            v-for="prompt in globalPrompts" 
            :key="prompt.id" 
            class="prompt-item"
          >
            <div class="prompt-main" @click="openEditDialog(prompt)">
              <div class="prompt-header">
                <span class="prompt-name">{{ prompt.name }}</span>
                <span v-if="!prompt.enabled" class="disabled-badge">已禁用</span>
              </div>
              <p v-if="prompt.description" class="prompt-desc">{{ prompt.description }}</p>
              <p class="prompt-preview">{{ prompt.template.slice(0, 100) }}{{ prompt.template.length > 100 ? '...' : '' }}</p>
              <div class="prompt-meta">
                <span v-if="prompt.applicableScenes?.length" class="meta-tag">
                  <i class="fas fa-filter"></i>
                  {{ prompt.applicableScenes.length }} 场景
                </span>
                <span class="meta-tag">
                  <i class="fas fa-sort-numeric-down"></i>
                  优先级 {{ prompt.priority }}
                </span>
              </div>
            </div>
            <div class="prompt-actions">
              <button 
                class="action-btn toggle-btn"
                :class="{ active: prompt.enabled }"
                @click.stop="handleToggle(prompt)"
                :title="prompt.enabled ? '禁用' : '启用'"
              >
                <i :class="prompt.enabled ? 'fas fa-toggle-on' : 'fas fa-toggle-off'"></i>
              </button>
              <button 
                class="action-btn delete-btn"
                @click.stop="handleDelete(prompt)"
                title="删除"
              >
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
        </div>
      </section>
      
      <!-- App 级提示词 -->
      <section v-for="(prompts, appId) in appGroupedPrompts" :key="appId" class="section">
        <div class="section-header">
          <h2 class="section-title">
            <DynamicAppIcon :app-id="appId" size="sm" class="app-icon" />
            {{ getAppName(appId) }}
          </h2>
          <span class="section-count">{{ prompts.length }}</span>
        </div>
        <p class="section-desc">仅在该应用的 LLM 调用中生效</p>
        
        <div class="prompt-list">
          <div 
            v-for="prompt in prompts" 
            :key="prompt.id" 
            class="prompt-item"
          >
            <div class="prompt-main" @click="openEditDialog(prompt)">
              <div class="prompt-header">
                <span class="prompt-name">{{ prompt.name }}</span>
                <span v-if="prompt.systemPromptMode === 'override'" class="override-badge">覆盖</span>
                <span v-if="!prompt.enabled" class="disabled-badge">已禁用</span>
              </div>
              <p v-if="prompt.description" class="prompt-desc">{{ prompt.description }}</p>
              <p class="prompt-preview">{{ prompt.template.slice(0, 100) }}{{ prompt.template.length > 100 ? '...' : '' }}</p>
            </div>
            <div class="prompt-actions">
              <button 
                class="action-btn toggle-btn"
                :class="{ active: prompt.enabled }"
                @click.stop="handleToggle(prompt)"
              >
                <i :class="prompt.enabled ? 'fas fa-toggle-on' : 'fas fa-toggle-off'"></i>
              </button>
              <button 
                class="action-btn delete-btn"
                @click.stop="handleDelete(prompt)"
              >
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
        </div>
      </section>
      
      <!-- 帮助信息 -->
      <section class="help-section">
        <h3 class="help-title">💡 关于系统提示词</h3>
        <div class="help-content">
          <p>系统提示词会自动注入到所有 LLM 调用的 system 消息中，用于全局约束 AI 的行为。</p>
          <ul>
            <li><strong>全局</strong>：适用于所有应用的 LLM 调用</li>
            <li><strong>应用级</strong>：仅在指定应用中生效</li>
            <li><strong>追加模式</strong>：在全局提示词之后追加</li>
            <li><strong>覆盖模式</strong>：替换全局提示词</li>
          </ul>
        </div>
      </section>
    </div>
    
    <!-- 创建对话框 -->
    <div v-if="showCreateDialog" class="dialog-overlay" @click.self="showCreateDialog = false">
      <div class="dialog">
        <header class="dialog-header">
          <h2 class="dialog-title">创建系统提示词</h2>
          <button class="close-btn" @click="showCreateDialog = false">
            <i class="fas fa-times"></i>
          </button>
        </header>
        
        <div class="dialog-content">
          <div class="form-group">
            <label class="form-label">名称 *</label>
            <input 
              v-model="formData.name" 
              type="text" 
              class="form-input"
              placeholder="如：基础角色设定"
            />
          </div>
          
          <div class="form-group">
            <label class="form-label">描述</label>
            <input 
              v-model="formData.description" 
              type="text" 
              class="form-input"
              placeholder="可选的说明"
            />
          </div>
          
          <div class="form-group">
            <label class="form-label">作用域</label>
            <div class="radio-group">
              <label class="radio-item">
                <input type="radio" v-model="formData.scope" value="global" />
                <span class="radio-label">全局</span>
              </label>
              <label class="radio-item">
                <input type="radio" v-model="formData.scope" value="app" />
                <span class="radio-label">应用级</span>
              </label>
            </div>
          </div>
          
          <div v-if="formData.scope === 'app'" class="form-group">
            <label class="form-label">关联应用</label>
            <select v-model="formData.appId" class="form-select">
              <option value="">请选择</option>
              <option v-for="app in availableApps" :key="app.id" :value="app.id">
                {{ app.name }}
              </option>
            </select>
          </div>
          
          <div v-if="formData.scope === 'app'" class="form-group">
            <label class="form-label">继承模式</label>
            <div class="radio-group">
              <label class="radio-item">
                <input type="radio" v-model="formData.mode" value="append" />
                <span class="radio-label">追加</span>
              </label>
              <label class="radio-item">
                <input type="radio" v-model="formData.mode" value="override" />
                <span class="radio-label">覆盖全局</span>
              </label>
            </div>
          </div>
          
          <div class="form-group">
            <label class="form-label">提示词内容 *</label>
            <textarea 
              v-model="formData.content" 
              class="form-textarea"
              rows="6"
              placeholder="输入系统提示词内容..."
            ></textarea>
          </div>
          
          <div class="form-group">
            <label class="form-label">适用场景（可选）</label>
            <input 
              v-model="formData.applicableScenes" 
              type="text" 
              class="form-input"
              placeholder="如：social.*, chat.reply（逗号分隔）"
            />
            <p class="form-hint">留空表示适用所有场景，支持通配符 *</p>
          </div>
          
          <div class="form-group">
            <label class="form-label">排除场景（可选）</label>
            <input 
              v-model="formData.excludeScenes" 
              type="text" 
              class="form-input"
              placeholder="如：system.*（逗号分隔）"
            />
          </div>
          
          <div class="form-group">
            <label class="form-label">优先级</label>
            <input 
              v-model.number="formData.priority" 
              type="number" 
              class="form-input"
              min="0"
              max="100"
            />
            <p class="form-hint">数字越小优先级越高，同作用域内按优先级排序拼接</p>
          </div>
        </div>
        
        <footer class="dialog-footer">
          <button class="cancel-btn" @click="showCreateDialog = false">取消</button>
          <button class="confirm-btn" @click="handleCreate">创建</button>
        </footer>
      </div>
    </div>
    
    <!-- 编辑对话框 -->
    <div v-if="showEditDialog" class="dialog-overlay" @click.self="showEditDialog = false">
      <div class="dialog">
        <header class="dialog-header">
          <h2 class="dialog-title">编辑系统提示词</h2>
          <button class="close-btn" @click="showEditDialog = false">
            <i class="fas fa-times"></i>
          </button>
        </header>
        
        <div class="dialog-content">
          <div class="form-group">
            <label class="form-label">名称 *</label>
            <input 
              v-model="formData.name" 
              type="text" 
              class="form-input"
            />
          </div>
          
          <div class="form-group">
            <label class="form-label">描述</label>
            <input 
              v-model="formData.description" 
              type="text" 
              class="form-input"
            />
          </div>
          
          <div v-if="formData.scope === 'app'" class="form-group">
            <label class="form-label">继承模式</label>
            <div class="radio-group">
              <label class="radio-item">
                <input type="radio" v-model="formData.mode" value="append" />
                <span class="radio-label">追加</span>
              </label>
              <label class="radio-item">
                <input type="radio" v-model="formData.mode" value="override" />
                <span class="radio-label">覆盖全局</span>
              </label>
            </div>
          </div>
          
          <div class="form-group">
            <label class="form-label">提示词内容 *</label>
            <textarea 
              v-model="formData.content" 
              class="form-textarea"
              rows="6"
            ></textarea>
          </div>
          
          <div class="form-group">
            <label class="form-label">适用场景</label>
            <input 
              v-model="formData.applicableScenes" 
              type="text" 
              class="form-input"
              placeholder="逗号分隔"
            />
          </div>
          
          <div class="form-group">
            <label class="form-label">排除场景</label>
            <input 
              v-model="formData.excludeScenes" 
              type="text" 
              class="form-input"
              placeholder="逗号分隔"
            />
          </div>
          
          <div class="form-group">
            <label class="form-label">优先级</label>
            <input 
              v-model.number="formData.priority" 
              type="number" 
              class="form-input"
              min="0"
              max="100"
            />
          </div>
        </div>
        
        <footer class="dialog-footer">
          <button class="cancel-btn" @click="showEditDialog = false">取消</button>
          <button class="confirm-btn" @click="handleUpdate">保存</button>
        </footer>
      </div>
    </div>
  </div>
</template>

<style scoped>
.system-prompts-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-background);
}

.page-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
}

.back-btn,
.add-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: var(--color-text);
  background: transparent;
  border: none;
  cursor: pointer;
}

.back-btn:hover,
.add-btn:hover {
  background: var(--color-surface-variant);
}

.page-title {
  flex: 1;
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text);
}

.stats-bar {
  display: flex;
  padding: 12px 16px;
  gap: 8px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
}

.stat-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.stat-value {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text);
}

.stat-label {
  font-size: 11px;
  color: var(--color-text-secondary);
}

.content-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
}

.empty-icon {
  font-size: 48px;
  color: var(--color-text-secondary);
  opacity: 0.3;
  margin-bottom: 16px;
}

.empty-text {
  font-size: 16px;
  font-weight: 500;
  color: var(--color-text);
  margin-bottom: 4px;
}

.empty-hint {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-bottom: 24px;
}

.create-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 500;
  color: white;
  background: var(--color-primary);
  border: none;
  cursor: pointer;
}

.section {
  margin-bottom: 24px;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
}

.section-title i {
  font-size: 14px;
  color: var(--color-primary);
}

.app-icon {
  width: 20px;
  height: 20px;
}

.section-count {
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
  background: var(--color-surface-variant);
  color: var(--color-text-secondary);
}

.section-desc {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-bottom: 12px;
}

.prompt-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.prompt-item {
  display: flex;
  gap: 8px;
  padding: 12px;
  border-radius: 12px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
}

.prompt-main {
  flex: 1;
  min-width: 0;
  cursor: pointer;
}

.prompt-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.prompt-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text);
}

.disabled-badge,
.override-badge {
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 500;
}

.disabled-badge {
  background: var(--color-surface-variant);
  color: var(--color-text-secondary);
}

.override-badge {
  background: #fef3c7;
  color: #92400e;
}

.prompt-desc {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-bottom: 4px;
}

.prompt-preview {
  font-size: 12px;
  color: var(--color-text-secondary);
  opacity: 0.7;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.prompt-meta {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.meta-tag {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--color-text-secondary);
}

.meta-tag i {
  font-size: 10px;
}

.prompt-actions {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.action-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  color: var(--color-text-secondary);
  background: transparent;
}

.action-btn:hover {
  background: var(--color-surface-variant);
}

.toggle-btn.active {
  color: var(--color-primary);
}

.delete-btn:hover {
  color: #ef4444;
}

.help-section {
  padding: 16px;
  border-radius: 12px;
  background: var(--color-surface-variant);
}

.help-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 12px;
}

.help-content {
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.6;
}

.help-content p {
  margin-bottom: 12px;
}

.help-content ul {
  padding-left: 20px;
}

.help-content li {
  margin-bottom: 4px;
}

/* Dialog */
.dialog-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(0, 0, 0, 0.5);
  z-index: 100;
}

.dialog {
  width: 100%;
  max-width: 400px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  border-radius: 16px;
  background: var(--color-surface);
  overflow: hidden;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid var(--color-border);
}

.dialog-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text);
}

.close-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
}

.dialog-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.form-group {
  margin-bottom: 16px;
}

.form-label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text);
  margin-bottom: 6px;
}

.form-input,
.form-select,
.form-textarea {
  width: 100%;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background: var(--color-background);
  color: var(--color-text);
  font-size: 14px;
}

.form-textarea {
  resize: vertical;
  min-height: 100px;
}

.form-hint {
  font-size: 11px;
  color: var(--color-text-secondary);
  margin-top: 4px;
}

.radio-group {
  display: flex;
  gap: 16px;
}

.radio-item {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.radio-label {
  font-size: 14px;
  color: var(--color-text);
}

.dialog-footer {
  display: flex;
  gap: 12px;
  padding: 16px;
  border-top: 1px solid var(--color-border);
}

.cancel-btn,
.confirm-btn {
  flex: 1;
  padding: 10px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  border: none;
  cursor: pointer;
}

.cancel-btn {
  background: var(--color-surface-variant);
  color: var(--color-text);
}

.confirm-btn {
  background: var(--color-primary);
  color: white;
}
</style>
