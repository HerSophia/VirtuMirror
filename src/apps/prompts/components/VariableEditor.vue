<script setup lang="ts">
/**
 * 变量编辑器组件
 * @description 用于编辑提示词的可用变量列表
 */
import { ref, watch } from 'vue';
import type { PromptVariable } from '@/types/prompts';

const props = defineProps<{
  variables: PromptVariable[];
  disabled?: boolean;
}>();

const emit = defineEmits<{
  update: [variables: PromptVariable[]];
}>();

// 本地状态
const localVariables = ref<PromptVariable[]>([]);

// 同步 props
watch(() => props.variables, (newVal) => {
  // 深度复制以断开引用
  localVariables.value = JSON.parse(JSON.stringify(newVal));
}, { immediate: true, deep: true });

// 通知更新
const emitUpdate = () => {
  emit('update', localVariables.value);
};

// 添加变量
const addVariable = () => {
  if (props.disabled) return;
  localVariables.value.push({
    name: 'new_variable',
    description: '',
    type: 'string',
    required: true,
  });
  emitUpdate();
};

// 删除变量
const removeVariable = (index: number) => {
  if (props.disabled) return;
  localVariables.value.splice(index, 1);
  emitUpdate();
};

// 变量类型选项
const typeOptions = [
  { value: 'string', label: '文本' },
  { value: 'number', label: '数字' },
  { value: 'boolean', label: '布尔值' },
  { value: 'array', label: '数组' },
];
</script>

<template>
  <div class="variable-editor">
    <div v-if="localVariables.length === 0" class="empty-vars">
      <p>暂无变量定义</p>
      <button class="add-btn-sm" @click="addVariable" :disabled="disabled">
        <i class="fas fa-plus"></i> 添加变量
      </button>
    </div>
    
    <div v-else class="vars-list">
      <div 
        v-for="(v, index) in localVariables" 
        :key="index"
        class="var-item"
      >
        <div class="var-header">
          <div class="var-name-group">
            <span class="index-badge">#{{ index + 1 }}</span>
            <input
              v-model="v.name"
              type="text"
              class="name-input"
              placeholder="变量名"
              :disabled="disabled"
              @change="emitUpdate"
            />
          </div>
          
          <div class="var-actions">
            <button 
              class="action-btn delete" 
              @click="removeVariable(index)"
              :disabled="disabled"
              title="删除变量"
            >
              <i class="fas fa-trash-alt"></i>
            </button>
          </div>
        </div>
        
        <div class="var-body">
          <div class="field-row">
            <div class="field-group flex-1">
              <label>类型</label>
              <select 
                v-model="v.type" 
                class="field-select"
                :disabled="disabled"
                @change="emitUpdate"
              >
                <option v-for="opt in typeOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
            </div>
            
            <div class="field-group flex-1">
              <label>必填</label>
              <div class="checkbox-wrapper">
                <input 
                  type="checkbox" 
                  v-model="v.required"
                  :disabled="disabled"
                  @change="emitUpdate"
                  id="req-check"
                />
                <label for="req-check">{{ v.required ? '是' : '否' }}</label>
              </div>
            </div>
          </div>
          
          <div class="field-group">
            <label>描述</label>
            <input
              v-model="v.description"
              type="text"
              class="field-input"
              placeholder="变量用途说明"
              :disabled="disabled"
              @change="emitUpdate"
            />
          </div>
          
          <div class="field-group">
            <label>默认值 (可选)</label>
            <input
              v-model="v.defaultValue"
              type="text"
              class="field-input"
              placeholder="默认值"
              :disabled="disabled"
              @change="emitUpdate"
            />
          </div>
        </div>
      </div>
      
      <button class="add-btn-block" @click="addVariable" :disabled="disabled">
        <i class="fas fa-plus"></i> 添加新变量
      </button>
    </div>
  </div>
</template>

<style scoped>
.variable-editor {
  @apply w-full;
}

.empty-vars {
  @apply flex flex-col items-center justify-center py-8 rounded-lg border-2 border-dashed;
  border-color: var(--color-border);
  color: var(--color-text-secondary);
}

.empty-vars p {
  @apply text-sm mb-3;
}

.add-btn-sm {
  @apply flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium;
  @apply transition-colors;
  background: var(--color-surface-variant);
  color: var(--color-primary);
}

.add-btn-sm:hover:not(:disabled) {
  background: var(--color-border);
}

.vars-list {
  @apply space-y-3;
}

.var-item {
  @apply rounded-xl border overflow-hidden;
  background: var(--color-surface);
  border-color: var(--color-border);
}

.var-header {
  @apply flex items-center justify-between px-3 py-2 bg-[var(--color-surface-variant)];
  border-bottom: 1px solid var(--color-border);
}

.var-name-group {
  @apply flex items-center gap-2 flex-1;
}

.index-badge {
  @apply text-xs font-mono opacity-50;
}

.name-input {
  @apply bg-transparent border-none outline-none text-sm font-semibold flex-1;
  color: var(--color-text);
}

.name-input::placeholder {
  @apply font-normal opacity-50;
}

.action-btn {
  @apply w-6 h-6 flex items-center justify-center rounded text-xs opacity-60 hover:opacity-100;
  color: var(--color-text);
}

.action-btn.delete {
  @apply hover:text-red-500;
}

.var-body {
  @apply p-3 space-y-3;
}

.field-row {
  @apply flex gap-3;
}

.field-group {
  @apply flex flex-col gap-1;
}

.field-group label {
  @apply text-[10px] font-medium opacity-60 uppercase tracking-wider;
  color: var(--color-text);
}

.field-input,
.field-select {
  @apply px-2 py-1.5 rounded border text-xs;
  background: var(--color-background);
  border-color: var(--color-border);
  color: var(--color-text);
}

.field-input:focus,
.field-select:focus {
  @apply outline-none border-[var(--color-primary)];
}

.checkbox-wrapper {
  @apply flex items-center gap-2 h-[26px];
}

.checkbox-wrapper input {
  @apply rounded border-gray-300 text-[var(--color-primary)];
}

.checkbox-wrapper label {
  @apply text-xs font-normal opacity-100 capitalize cursor-pointer;
  color: var(--color-text);
}

.add-btn-block {
  @apply w-full py-2 rounded-lg border-2 border-dashed flex items-center justify-center gap-2 text-sm;
  @apply transition-colors;
  border-color: var(--color-border);
  color: var(--color-text-secondary);
}

.add-btn-block:hover:not(:disabled) {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: var(--color-surface-variant);
}

.add-btn-block:disabled,
.add-btn-sm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
