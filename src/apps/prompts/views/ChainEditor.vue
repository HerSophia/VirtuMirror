<script setup lang="ts">
/**
 * 提示词链编辑器
 * 表单模式编辑链配置
 */
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { promptChainService } from '@/services/promptChainService';
import { PromptService } from '@/services/promptService';
import { useDialogStore } from '@/stores/dialogStore';
import type { PromptChain, ChainStep, ChainVariableDefinition, LoopConfig } from '@/types/promptChain';
import type { PromptTemplate } from '@/types/prompts';

const router = useRouter();
const route = useRoute();
const dialog = useDialogStore();

// 状态
const chain = ref<PromptChain | null>(null);
const loading = ref(true);
const saving = ref(false);
const hasChanges = ref(false);
const activeTab = ref<'basic' | 'steps' | 'io' | 'visual'>('basic');
const editingStepIndex = ref<number | null>(null);

// 可用的提示词列表
const availablePrompts = ref<PromptTemplate[]>([]);

// 验证结果
const validationErrors = computed(() => {
  if (!chain.value) return { valid: true, errors: [] };
  return promptChainService.validateChain(chain.value);
});

// 是否只读（只有内置链不可编辑，App 链可编辑）
const isReadonly = computed(() => {
  if (!chain.value) return true;
  return chain.value.source === 'builtin';
});

// 加载链数据
async function loadChain() {
  loading.value = true;
  try {
    const id = route.params.id as string;
    const isNew = id === 'new';
    
    if (!isNew) {
      const data = await promptChainService.getChainById(id);
      if (data) {
        chain.value = { ...data };
      }
    }
    
    // 新建链或未找到
    if (!chain.value) {
      const empty = promptChainService.createEmptyChain();
      chain.value = {
        ...empty,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as PromptChain;
      hasChanges.value = true; // 新建链默认有更改
    }
    
    // 加载可用提示词
    availablePrompts.value = PromptService.getAllPrompts();
  } catch (error) {
    console.error('加载链失败:', error);
  } finally {
    loading.value = false;
  }
}

// 保存链
async function saveChain() {
  if (!chain.value) return;
  
  // 验证
  const validation = promptChainService.validateChain(chain.value);
  if (!validation.valid) {
    await dialog.alert({
      title: '验证失败',
      message: '请修复以下问题：\n' + validation.errors.join('\n'),
      icon: 'warning'
    });
    return;
  }
  
  saving.value = true;
  try {
    await promptChainService.updateChain(chain.value.id, chain.value);
    hasChanges.value = false;
    await dialog.alert({
      title: '保存成功',
      message: '链配置已保存',
      icon: 'success'
    });
  } catch (error) {
    console.error('保存失败:', error);
    await dialog.alert({
      title: '保存失败',
      message: '保存链配置时出错，请重试',
      icon: 'danger'
    });
  } finally {
    saving.value = false;
  }
}

// 返回
async function goBack() {
  if (hasChanges.value) {
    const confirmed = await dialog.confirm({
      title: '未保存的更改',
      message: '有未保存的更改，确定要离开吗？',
      detail: '离开后所有未保存的更改将丢失',
      confirmText: '离开',
      cancelText: '继续编辑',
      confirmType: 'danger',
      icon: 'warning'
    });
    if (!confirmed) return;
  }
  router.push('/prompts/chains');
}

// 运行链
function runChain() {
  if (!chain.value) return;
  router.push(`/prompts/chains/${chain.value.id}/run`);
}

// ========== 步骤管理 ==========

function addStep() {
  if (!chain.value) return;
  const newStep = promptChainService.createEmptyStep('prompt');
  chain.value.steps.push(newStep);
  editingStepIndex.value = chain.value.steps.length - 1;
  hasChanges.value = true;
}

// ========== 循环配置 ==========

// 获取步骤的循环次数
function getStepLoopTimes(step: ChainStep): number {
  if (!step.loop) return 1;
  if (step.loop.type === 'times') {
    return step.loop.times || 1;
  }
  return 1; // 'over' 类型返回 1（表示不是固定次数循环）
}

// 设置步骤的循环次数
function setStepLoopTimes(stepIndex: number, times: number) {
  if (!chain.value) return;
  const step = chain.value.steps[stepIndex];
  if (!step) return;
  
  if (times <= 1) {
    // 如果设置为 1 次，移除循环配置
    step.loop = undefined;
  } else {
    step.loop = {
      type: 'times',
      times: times,
      maxIterations: Math.min(times, 100) // 防止无限循环
    };
  }
  // 强制触发响应式更新
  chain.value.steps = [...chain.value.steps];
  hasChanges.value = true;
}

// 判断步骤是否有循环
function hasLoop(step: ChainStep): boolean {
  return !!step.loop && step.loop.type === 'times' && (step.loop.times || 1) > 1;
}

async function removeStep(index: number) {
  if (!chain.value) return;
  const confirmed = await dialog.confirm({
    title: '删除步骤',
    message: '确定要删除这个步骤吗？',
    confirmText: '删除',
    confirmType: 'danger',
    icon: 'warning'
  });
  if (!confirmed) return;
  chain.value.steps.splice(index, 1);
  if (editingStepIndex.value === index) {
    editingStepIndex.value = null;
  }
  hasChanges.value = true;
}

function moveStep(index: number, direction: 'up' | 'down') {
  if (!chain.value) return;
  const newIndex = direction === 'up' ? index - 1 : index + 1;
  if (newIndex < 0 || newIndex >= chain.value.steps.length) return;
  
  const steps = [...chain.value.steps];
  [steps[index], steps[newIndex]] = [steps[newIndex], steps[index]];
  chain.value.steps = steps;
  
  if (editingStepIndex.value === index) {
    editingStepIndex.value = newIndex;
  }
  hasChanges.value = true;
}

// 复制步骤
function duplicateStep(index: number) {
  if (!chain.value) return;
  const step = chain.value.steps[index];
  const newStep = {
    ...JSON.parse(JSON.stringify(step)),
    id: `step_${Date.now()}`,
    name: `${step.name} (副本)`,
  };
  chain.value.steps.splice(index + 1, 0, newStep);
  editingStepIndex.value = index + 1;
  hasChanges.value = true;
}

// 跳转到提示词编辑页面
function goToPromptEditor(promptId: string) {
  // 根据 promptId 查找对应的提示词
  const prompt = availablePrompts.value.find(p => p.scene === promptId);
  if (prompt) {
    router.push(`/prompts/detail/${prompt.id}`);
  }
}

// 获取步骤的提示词内容（用于可视化展示）
function getStepPromptContent(step: ChainStep): string {
  if (step.inlineTemplate) {
    return step.inlineTemplate;
  }
  if (step.promptId) {
    const prompt = availablePrompts.value.find(p => p.scene === step.promptId);
    if (prompt) {
      return prompt.template.substring(0, 200) + (prompt.template.length > 200 ? '...' : '');
    }
    return `引用提示词: ${step.promptId}`;
  }
  return '无提示词内容';
}

// 获取步骤的提示词名称
function getStepPromptName(step: ChainStep): string {
  if (step.promptId) {
    const prompt = availablePrompts.value.find(p => p.scene === step.promptId);
    return prompt?.name || step.promptId;
  }
  return '内联模板';
}

function editStep(index: number) {
  editingStepIndex.value = editingStepIndex.value === index ? null : index;
}

function updateStep(index: number, updates: Partial<ChainStep>) {
  if (!chain.value) return;
  chain.value.steps[index] = { ...chain.value.steps[index], ...updates };
  hasChanges.value = true;
}

// ========== 输入变量管理 ==========

function addInput() {
  if (!chain.value) return;
  chain.value.inputs.push({
    name: '',
    description: '',
    type: 'string',
    required: true,
  });
  hasChanges.value = true;
}

function removeInput(index: number) {
  if (!chain.value) return;
  chain.value.inputs.splice(index, 1);
  hasChanges.value = true;
}

// ========== 输出映射管理 ==========

const outputEntries = computed({
  get() {
    if (!chain.value) return [];
    return Object.entries(chain.value.outputs).map(([key, value]) => ({ key, value }));
  },
  set(entries) {
    if (!chain.value) return;
    chain.value.outputs = Object.fromEntries(entries.map(e => [e.key, e.value]));
  }
});

function addOutput() {
  if (!chain.value) return;
  chain.value.outputs[`output${Object.keys(chain.value.outputs).length + 1}`] = '';
  hasChanges.value = true;
}

function removeOutput(key: string) {
  if (!chain.value) return;
  delete chain.value.outputs[key];
  hasChanges.value = true;
}

function updateOutput(oldKey: string, newKey: string, value: string) {
  if (!chain.value) return;
  if (oldKey !== newKey) {
    delete chain.value.outputs[oldKey];
  }
  chain.value.outputs[newKey] = value;
  hasChanges.value = true;
}

// 监听变化
watch(chain, () => {
  hasChanges.value = true;
}, { deep: true });

onMounted(() => {
  loadChain();
});
</script>

<template>
  <div class="chain-editor">
    <!-- 头部 -->
    <header class="header">
      <button class="back-btn" @click="goBack">
        <i class="fas fa-chevron-left"></i>
      </button>
      <h1 class="title">
        {{ chain?.name || '编辑链' }}
        <span v-if="isReadonly" class="readonly-badge">只读</span>
      </h1>
      <div class="header-actions">
        <button class="run-btn" @click="runChain" :disabled="!validationErrors.valid">
          <i class="fas fa-play"></i>
        </button>
        <button v-if="!isReadonly" class="save-btn" @click="saveChain" :disabled="saving || !hasChanges">
          <i :class="saving ? 'fas fa-spinner fa-spin' : 'fas fa-save'"></i>
        </button>
      </div>
    </header>
    
    <div v-if="loading" class="loading">
      <i class="fas fa-spinner fa-spin"></i>
      <span>加载中...</span>
    </div>
    
    <template v-else-if="chain">
      <!-- 标签页 -->
      <div class="tabs">
        <button :class="{ active: activeTab === 'basic' }" @click="activeTab = 'basic'">
          <i class="fas fa-info-circle"></i> 基本
        </button>
        <button :class="{ active: activeTab === 'steps' }" @click="activeTab = 'steps'">
          <i class="fas fa-list-ol"></i> 步骤
        </button>
        <button :class="{ active: activeTab === 'io' }" @click="activeTab = 'io'">
          <i class="fas fa-exchange-alt"></i> IO
        </button>
        <button :class="{ active: activeTab === 'visual' }" @click="activeTab = 'visual'">
          <i class="fas fa-project-diagram"></i> 可视化
        </button>
      </div>
      
      <!-- 验证错误 -->
      <div v-if="!validationErrors.valid" class="validation-errors">
        <i class="fas fa-exclamation-triangle"></i>
        <span>{{ validationErrors.errors[0] }}</span>
        <span v-if="validationErrors.errors.length > 1" class="more">
          +{{ validationErrors.errors.length - 1 }} 个问题
        </span>
      </div>
      
      <!-- 基本信息 -->
      <div v-show="activeTab === 'basic'" class="tab-content">
        <div class="form-group">
          <label>链名称 *</label>
          <input v-model="chain.name" type="text" placeholder="输入链名称" />
        </div>
        
        <div class="form-group">
          <label>描述</label>
          <textarea v-model="chain.description" placeholder="描述这个链的用途" rows="3"></textarea>
        </div>
        
        <div class="form-group">
          <label>执行模式</label>
          <div class="radio-group">
            <label class="radio-item">
              <input type="radio" v-model="chain.executionMode" value="multi-step" />
              <span class="radio-label">
                <strong>多步模式</strong>
                <small>每个步骤独立调用 LLM，支持中间结果查看</small>
              </span>
            </label>
            <label class="radio-item">
              <input type="radio" v-model="chain.executionMode" value="single-shot" />
              <span class="radio-label">
                <strong>单次模式</strong>
                <small>合并为一个请求，速度快、成本低</small>
              </span>
            </label>
          </div>
        </div>
        
        <div class="form-group">
          <label>标签</label>
          <input
            :value="chain.tags?.join(', ') || ''"
            @input="chain.tags = ($event.target as HTMLInputElement).value.split(',').map(s => s.trim()).filter(Boolean)"
            type="text"
            placeholder="用逗号分隔，如: 微博, 社交, 热点"
          />
        </div>
        
        <div class="form-group">
          <label class="checkbox-label">
            <input type="checkbox" v-model="chain.enabled" />
            <span>启用此链</span>
          </label>
        </div>
      </div>
      
      <!-- 步骤管理 -->
      <div v-show="activeTab === 'steps'" class="tab-content steps-tab">
        <div class="steps-list">
          <div
            v-for="(step, index) in chain.steps"
            :key="step.id"
            class="step-item"
            :class="{ editing: editingStepIndex === index }"
          >
            <div class="step-header" @click="editStep(index)">
              <span class="step-number">{{ index + 1 }}</span>
              <div class="step-info">
                <span class="step-name">{{ step.name || '未命名步骤' }}</span>
                <span class="step-type">
                  <i :class="{
                    'fas fa-comment': step.type === 'prompt',
                    'fas fa-exchange-alt': step.type === 'transform',
                    'fas fa-code-branch': step.type === 'condition',
                    'fas fa-redo': step.type === 'loop'
                  }"></i>
                  {{ step.type }}
                </span>
              </div>
              <div class="step-actions">
                <button @click.stop="moveStep(index, 'up')" :disabled="index === 0" title="上移">
                  <i class="fas fa-chevron-up"></i>
                </button>
                <button @click.stop="moveStep(index, 'down')" :disabled="index === chain.steps.length - 1" title="下移">
                  <i class="fas fa-chevron-down"></i>
                </button>
                <button @click.stop="duplicateStep(index)" title="复制步骤">
                  <i class="fas fa-copy"></i>
                </button>
                <button @click.stop="removeStep(index)" class="delete" title="删除">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </div>
            
            <!-- 步骤编辑表单 -->
            <div v-if="editingStepIndex === index" class="step-editor">
              <div class="form-group">
                <label>步骤名称 *</label>
                <input v-model="step.name" type="text" placeholder="步骤名称" />
              </div>
              
              <div class="form-group">
                <label>步骤类型</label>
                <select v-model="step.type">
                  <option value="prompt">Prompt (调用 LLM)</option>
                  <option value="transform">Transform (数据转换)</option>
                </select>
              </div>
              
              <template v-if="step.type === 'prompt'">
                <div class="form-group">
                  <label>提示词来源</label>
                  <div class="prompt-source-row">
                    <select v-model="step.promptId">
                      <option value="">-- 使用内联模板 --</option>
                      <option v-for="p in availablePrompts" :key="p.id" :value="p.scene">
                        {{ p.name }} ({{ p.scene }})
                      </option>
                    </select>
                    <button
                      v-if="step.promptId"
                      class="goto-prompt-btn"
                      @click="goToPromptEditor(step.promptId)"
                      title="跳转到提示词编辑页面"
                    >
                      <i class="fas fa-external-link-alt"></i>
                    </button>
                  </div>
                </div>
                
                <div v-if="!step.promptId" class="form-group">
                  <label>内联模板</label>
                  <textarea
                    v-model="step.inlineTemplate"
                    placeholder="输入提示词模板，使用 {{变量名}} 引用变量"
                    rows="4"
                  ></textarea>
                </div>
              </template>
              
              <div class="form-group">
                <label>输出键名 *</label>
                <input v-model="step.outputKey" type="text" placeholder="如: eventResult" />
                <small>此步骤的结果将存储到这个变量中</small>
              </div>
              
              <div class="form-group">
                <label>输入映射</label>
                <div class="mapping-list">
                  <div v-for="(value, key) in step.inputMapping" :key="key" class="mapping-item">
                    <input :value="key" @change="(e) => {
                      const newKey = (e.target as HTMLInputElement).value;
                      delete step.inputMapping[key];
                      step.inputMapping[newKey] = value;
                    }" placeholder="变量名" />
                    <span class="arrow">←</span>
                    <input v-model="step.inputMapping[key]" placeholder="表达式" />
                    <button @click="delete step.inputMapping[key]">
                      <i class="fas fa-times"></i>
                    </button>
                  </div>
                  <button class="add-mapping" @click="step.inputMapping[''] = ''">
                    <i class="fas fa-plus"></i> 添加映射
                  </button>
                </div>
              </div>
              
              <div class="form-group">
                <label>循环次数</label>
                <div class="loop-config">
                  <button 
                    class="loop-btn"
                    @click="setStepLoopTimes(index, Math.max(1, getStepLoopTimes(step) - 1))"
                    :disabled="getStepLoopTimes(step) <= 1"
                  >
                    <i class="fas fa-minus"></i>
                  </button>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    :value="getStepLoopTimes(step)"
                    @change="(e) => setStepLoopTimes(index, Math.max(1, Math.min(100, parseInt((e.target as HTMLInputElement).value) || 1)))"
                    class="loop-times-input"
                  />
                  <button 
                    class="loop-btn"
                    @click="setStepLoopTimes(index, Math.min(100, getStepLoopTimes(step) + 1))"
                    :disabled="getStepLoopTimes(step) >= 100"
                  >
                    <i class="fas fa-plus"></i>
                  </button>
                  <span class="loop-hint">次</span>
                  <span v-if="getStepLoopTimes(step) > 1" class="loop-warning">
                    <i class="fas fa-info-circle"></i>
                    结果将合并为数组
                  </span>
                </div>
                <small>设置此步骤执行的次数，默认 1 次</small>
              </div>
              
              <div class="form-group">
                <label>条件表达式（可选）</label>
                <input v-model="step.condition" type="text" placeholder="如: step1.success" />
                <small>当条件为 false 时跳过此步骤</small>
              </div>
            </div>
          </div>
          
          <button class="add-step-btn" @click="addStep">
            <i class="fas fa-plus"></i> 添加步骤
          </button>
        </div>
      </div>
      
      <!-- 可视化 -->
      <div v-show="activeTab === 'visual'" class="tab-content visual-tab">
        <div class="visual-chain">
          <!-- 输入节点 -->
          <div class="visual-node input-node">
            <div class="node-header">
              <i class="fas fa-sign-in-alt"></i>
              <span>输入</span>
            </div>
            <div class="node-content">
              <div v-if="chain.inputs.length === 0" class="empty-hint">无输入参数</div>
              <div v-for="input in chain.inputs" :key="input.name" class="var-item">
                <span class="var-name">{{ input.name }}</span>
                <span class="var-type">{{ input.type }}</span>
              </div>
            </div>
          </div>
          
          <!-- 连接线 -->
          <div class="connector">
            <i class="fas fa-arrow-down"></i>
          </div>
          
          <!-- 步骤节点 -->
          <template v-for="(step, index) in chain.steps" :key="step.id">
            <div class="visual-node step-node" :class="{ 'prompt-node': step.type === 'prompt', 'has-loop': hasLoop(step) }">
              <div class="node-header">
                <span class="step-badge">{{ index + 1 }}</span>
                <span class="node-title">{{ step.name || '未命名步骤' }}</span>
                <!-- 循环次数标记 -->
                <span v-if="hasLoop(step)" class="loop-badge" :title="`循环 ${getStepLoopTimes(step)} 次`">
                  <i class="fas fa-redo"></i>
                  ×{{ getStepLoopTimes(step) }}
                </span>
                <div class="node-actions">
                  <button @click="duplicateStep(index)" title="复制步骤">
                    <i class="fas fa-copy"></i>
                  </button>
                  <button v-if="step.promptId" @click="goToPromptEditor(step.promptId)" title="编辑提示词">
                    <i class="fas fa-external-link-alt"></i>
                  </button>
                </div>
              </div>
              
              <div class="node-content">
                <div class="prompt-source">
                  <i class="fas fa-file-alt"></i>
                  <span>{{ getStepPromptName(step) }}</span>
                </div>
                <div class="prompt-preview">
                  {{ getStepPromptContent(step) }}
                </div>
              </div>
              
              <div class="node-footer">
                <div class="output-key">
                  <i class="fas fa-arrow-right"></i>
                  <code>{{ step.outputKey }}</code>
                  <span v-if="hasLoop(step)" class="output-array-hint">[Array]</span>
                </div>
              </div>
            </div>
            
            <!-- 连接线 -->
            <div v-if="index < chain.steps.length - 1" class="connector">
              <i class="fas fa-arrow-down"></i>
            </div>
          </template>
          
          <!-- 连接线 -->
          <div v-if="chain.steps.length > 0" class="connector">
            <i class="fas fa-arrow-down"></i>
          </div>
          
          <!-- 输出节点 -->
          <div class="visual-node output-node">
            <div class="node-header">
              <i class="fas fa-sign-out-alt"></i>
              <span>输出</span>
            </div>
            <div class="node-content">
              <div v-if="Object.keys(chain.outputs).length === 0" class="empty-hint">无输出映射</div>
              <div v-for="(value, key) in chain.outputs" :key="key" class="output-mapping">
                <code class="output-key-name">{{ key }}</code>
                <span class="mapping-arrow">←</span>
                <code class="output-value">{{ value }}</code>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 输入/输出 -->
      <div v-show="activeTab === 'io'" class="tab-content">
        <section class="io-section">
          <h3>输入变量</h3>
          <p class="section-desc">定义执行链时需要提供的输入参数</p>
          
          <div class="inputs-list">
            <div v-for="(input, index) in chain.inputs" :key="index" class="input-item">
              <input v-model="input.name" placeholder="变量名" />
              <select v-model="input.type">
                <option value="string">文本</option>
                <option value="number">数字</option>
                <option value="boolean">布尔</option>
                <option value="array">数组</option>
                <option value="object">对象</option>
              </select>
              <label class="checkbox-small">
                <input type="checkbox" v-model="input.required" />
                必填
              </label>
              <button @click="removeInput(index)">
                <i class="fas fa-times"></i>
              </button>
            </div>
            <button class="add-btn" @click="addInput">
              <i class="fas fa-plus"></i> 添加输入
            </button>
          </div>
        </section>
        
        <section class="io-section">
          <h3>输出映射</h3>
          <p class="section-desc">定义链执行完成后返回的结果</p>
          
          <div class="outputs-list">
            <div v-for="entry in outputEntries" :key="entry.key" class="output-item">
              <input
                :value="entry.key"
                @change="(e) => updateOutput(entry.key, (e.target as HTMLInputElement).value, entry.value)"
                placeholder="输出名"
              />
              <span class="arrow">←</span>
              <input
                :value="entry.value"
                @change="(e) => updateOutput(entry.key, entry.key, (e.target as HTMLInputElement).value)"
                placeholder="表达式，如: step1.result"
              />
              <button @click="removeOutput(entry.key)">
                <i class="fas fa-times"></i>
              </button>
            </div>
            <button class="add-btn" @click="addOutput">
              <i class="fas fa-plus"></i> 添加输出
            </button>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>

<style scoped>
.chain-editor {
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

.back-btn {
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
}

.title {
  flex: 1;
  font-size: 18px;
  font-weight: 600;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.run-btn,
.save-btn {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.run-btn {
  background: var(--success-color, #34c759);
  color: #fff;
}

.save-btn {
  background: var(--primary-color, #007aff);
  color: #fff;
}

.run-btn:disabled,
.save-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: var(--text-tertiary, #999);
}

.tabs {
  display: flex;
  background: var(--bg-secondary, #fff);
  border-bottom: 1px solid var(--border-color, #e0e0e0);
}

.tabs button {
  flex: 1;
  padding: 12px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-secondary, #666);
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}

.tabs button.active {
  color: var(--primary-color, #007aff);
  border-bottom-color: var(--primary-color, #007aff);
}

.tabs button i {
  margin-right: 6px;
}

.validation-errors {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: var(--warning-bg, #fff3cd);
  color: var(--warning-color, #856404);
  font-size: 13px;
}

.validation-errors .more {
  opacity: 0.7;
}

.tab-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary, #666);
}

.form-group input[type="text"],
.form-group textarea,
.form-group select {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 8px;
  font-size: 14px;
  background: var(--bg-secondary, #fff);
}

.form-group small {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-tertiary, #999);
}

.radio-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.radio-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px;
  background: var(--bg-secondary, #fff);
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 8px;
  cursor: pointer;
}

.radio-item input {
  margin-top: 3px;
}

.radio-label {
  display: flex;
  flex-direction: column;
}

.radio-label strong {
  font-size: 14px;
}

.radio-label small {
  font-size: 12px;
  color: var(--text-tertiary, #999);
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

/* 步骤列表 */
.steps-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.step-item {
  background: var(--bg-secondary, #fff);
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.step-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  cursor: pointer;
  transition: background 0.2s;
}

.step-header:hover {
  background: var(--bg-hover, #f5f5f5);
}

.step-number {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--primary-light, #e3f2fd);
  color: var(--primary-color, #007aff);
  border-radius: 50%;
  font-weight: 600;
  font-size: 14px;
}

.step-info {
  flex: 1;
  min-width: 0;
}

.step-name {
  display: block;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.step-type {
  font-size: 12px;
  color: var(--text-tertiary, #999);
}

.step-type i {
  margin-right: 4px;
}

.step-actions {
  display: flex;
  gap: 4px;
}

.step-actions button {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-tertiary, #999);
}

.step-actions button:hover {
  background: var(--bg-hover, #e0e0e0);
}

.step-actions button.delete:hover {
  background: var(--danger-color, #ff3b30);
  color: #fff;
}

.step-actions button:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.step-editor {
  padding: 16px;
  border-top: 1px solid var(--border-color, #e0e0e0);
  background: var(--bg-primary, #f9f9f9);
}

.add-step-btn {
  padding: 14px;
  border: 2px dashed var(--border-color, #e0e0e0);
  border-radius: 10px;
  background: transparent;
  cursor: pointer;
  color: var(--text-secondary, #666);
  font-size: 14px;
  transition: all 0.2s;
}

.add-step-btn:hover {
  border-color: var(--primary-color, #007aff);
  color: var(--primary-color, #007aff);
}

/* 映射列表 */
.mapping-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mapping-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.mapping-item input {
  flex: 1;
  padding: 8px;
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 6px;
  font-size: 13px;
}

.mapping-item .arrow {
  color: var(--text-tertiary, #999);
}

.mapping-item button {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-tertiary, #999);
}

.add-mapping {
  padding: 8px;
  border: 1px dashed var(--border-color, #e0e0e0);
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-secondary, #666);
}

/* IO 部分 */
.io-section {
  margin-bottom: 24px;
}

.io-section h3 {
  margin: 0 0 4px;
  font-size: 16px;
}

.section-desc {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--text-tertiary, #999);
}

.inputs-list,
.outputs-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.input-item,
.output-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px;
  background: var(--bg-secondary, #fff);
  border-radius: 8px;
}

.input-item input,
.output-item input {
  flex: 1;
  padding: 8px;
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 6px;
  font-size: 13px;
}

.input-item select {
  padding: 8px;
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 6px;
  font-size: 13px;
}

.checkbox-small {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  white-space: nowrap;
}

.input-item button,
.output-item button {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-tertiary, #999);
}

.add-btn {
  padding: 10px;
  border: 1px dashed var(--border-color, #e0e0e0);
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-secondary, #666);
}

.arrow {
  color: var(--text-tertiary, #999);
}

.readonly-badge {
  display: inline-block;
  padding: 2px 8px;
  margin-left: 8px;
  font-size: 11px;
  font-weight: 500;
  background: var(--warning-bg, #fff3cd);
  color: var(--warning-color, #856404);
  border-radius: 10px;
  vertical-align: middle;
}

/* 提示词来源行 */
.prompt-source-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.prompt-source-row select {
  flex: 1;
}

.goto-prompt-btn {
  width: 36px;
  height: 36px;
  border: 1px solid var(--border-color, #e0e0e0);
  background: var(--bg-secondary, #fff);
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--primary-color, #007aff);
  transition: all 0.2s;
  flex-shrink: 0;
}

.goto-prompt-btn:hover {
  background: var(--primary-color, #007aff);
  color: #fff;
  border-color: var(--primary-color, #007aff);
}

/* 可视化标签页 */
.visual-tab {
  background: var(--bg-primary, #f5f5f5);
}

.visual-chain {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
  padding: 16px 0;
}

.visual-node {
  width: 100%;
  max-width: 320px;
  background: var(--bg-secondary, #fff);
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.visual-node .node-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: var(--primary-light, #e3f2fd);
  color: var(--primary-color, #007aff);
  font-weight: 500;
}

.visual-node.input-node .node-header {
  background: #e8f5e9;
  color: #2e7d32;
}

.visual-node.output-node .node-header {
  background: #fff3e0;
  color: #e65100;
}

.visual-node .node-header i {
  font-size: 14px;
}

.visual-node .node-content {
  padding: 12px;
}

.visual-node .node-footer {
  padding: 8px 12px;
  background: var(--bg-primary, #f5f5f5);
  border-top: 1px solid var(--border-color, #e0e0e0);
}

.step-badge {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--primary-color, #007aff);
  color: #fff;
  border-radius: 50%;
  font-size: 12px;
  font-weight: 600;
}

.node-title {
  flex: 1;
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.node-actions {
  display: flex;
  gap: 4px;
}

.node-actions button {
  width: 26px;
  height: 26px;
  border: none;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: inherit;
  font-size: 12px;
}

.node-actions button:hover {
  background: rgba(255, 255, 255, 0.8);
}

.prompt-source {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary, #666);
  margin-bottom: 8px;
}

.prompt-source i {
  color: var(--primary-color, #007aff);
}

.prompt-preview {
  font-size: 12px;
  color: var(--text-tertiary, #999);
  line-height: 1.5;
  max-height: 60px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.output-key {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary, #666);
}

.output-key code {
  background: var(--bg-secondary, #fff);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
  color: var(--primary-color, #007aff);
}

.connector {
  display: flex;
  justify-content: center;
  padding: 8px 0;
  color: var(--text-tertiary, #999);
}

.var-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  border-bottom: 1px solid var(--border-color, #e0e0e0);
}

.var-item:last-child {
  border-bottom: none;
}

.var-name {
  font-weight: 500;
  font-size: 13px;
}

.var-type {
  font-size: 11px;
  color: var(--text-tertiary, #999);
  background: var(--bg-primary, #f5f5f5);
  padding: 2px 6px;
  border-radius: 4px;
}

.empty-hint {
  font-size: 12px;
  color: var(--text-tertiary, #999);
  text-align: center;
  padding: 8px 0;
}

.output-mapping {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 0;
  font-size: 12px;
  border-bottom: 1px solid var(--border-color, #e0e0e0);
}

.output-mapping:last-child {
  border-bottom: none;
}

.output-key-name {
  background: var(--bg-primary, #f5f5f5);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
  color: var(--success-color, #34c759);
}

.mapping-arrow {
  color: var(--text-tertiary, #999);
}

.output-value {
  flex: 1;
  font-family: monospace;
  color: var(--text-secondary, #666);
}

/* 循环配置 */
.loop-config {
  display: flex;
  align-items: center;
  gap: 8px;
}

.loop-times-input {
  width: 60px;
  padding: 8px 4px;
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 6px;
  font-size: 14px;
  text-align: center;
  -moz-appearance: textfield;
}

.loop-times-input::-webkit-outer-spin-button,
.loop-times-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.loop-times-input:focus {
  outline: none;
  border-color: var(--primary-color, #007aff);
}

.loop-btn {
  width: 32px;
  height: 32px;
  border: 1px solid var(--border-color, #e0e0e0);
  background: var(--bg-secondary, #fff);
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary, #666);
  transition: all 0.2s;
}

.loop-btn:hover:not(:disabled) {
  background: var(--primary-color, #007aff);
  border-color: var(--primary-color, #007aff);
  color: #fff;
}

.loop-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.loop-hint {
  font-size: 13px;
  color: var(--text-secondary, #666);
}

.loop-warning {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--warning-color, #ff9500);
  background: var(--warning-bg, #fff3cd);
  padding: 4px 8px;
  border-radius: 4px;
}

/* 循环标记 - 可视化 */
.loop-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  background: rgba(255, 149, 0, 0.2);
  color: var(--warning-color, #ff9500);
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
}

.loop-badge i {
  font-size: 10px;
}

/* 带循环的步骤节点 */
.visual-node.has-loop {
  border: 2px solid var(--warning-color, #ff9500);
  position: relative;
}

.visual-node.has-loop::before {
  content: '';
  position: absolute;
  top: -4px;
  left: -4px;
  right: -4px;
  bottom: -4px;
  border: 2px dashed var(--warning-color, #ff9500);
  border-radius: 14px;
  opacity: 0.3;
  pointer-events: none;
}

.output-array-hint {
  font-size: 10px;
  color: var(--warning-color, #ff9500);
  background: rgba(255, 149, 0, 0.15);
  padding: 1px 4px;
  border-radius: 3px;
  margin-left: 4px;
  font-family: monospace;
}
</style>
