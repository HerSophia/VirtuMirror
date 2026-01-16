<script setup lang="ts">
/**
 * 提示词链执行监控
 * 执行链并实时显示进度和结果
 */
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { promptChainService } from '@/services/promptChainService';
import { promptChainExecutor } from '@/services/promptChainExecutor';
import type {
  PromptChain,
  ChainExecutionResult,
  StepExecutionResult,
  ChainExecutionEvent
} from '@/types/promptChain';

const router = useRouter();
const route = useRoute();

// 状态
const chain = ref<PromptChain | null>(null);
const loading = ref(true);
const executing = ref(false);
const executionId = ref<string | null>(null);
const result = ref<ChainExecutionResult | null>(null);

// 输入表单
const inputValues = ref<Record<string, unknown>>({});

// 实时进度
const currentStepIndex = ref(-1);
const stepStatuses = ref<Map<string, 'pending' | 'running' | 'completed' | 'failed'>>(new Map());
const stepOutputs = ref<Map<string, unknown>>(new Map());
const logs = ref<string[]>([]);

// 计算属性
const canExecute = computed(() => {
  if (!chain.value) return false;
  // 检查必填输入
  for (const input of chain.value.inputs) {
    if (input.required && !inputValues.value[input.name]) {
      return false;
    }
  }
  return true;
});

const progress = computed(() => {
  if (!chain.value || chain.value.steps.length === 0) return 0;
  const completed = Array.from(stepStatuses.value.values()).filter(
    s => s === 'completed' || s === 'failed'
  ).length;
  return Math.round((completed / chain.value.steps.length) * 100);
});

// 加载链
async function loadChain() {
  loading.value = true;
  try {
    const id = route.params.id as string;
    chain.value = await promptChainService.getChainById(id) || null;
    
    if (chain.value) {
      // 初始化输入值
      for (const input of chain.value.inputs) {
        inputValues.value[input.name] = input.defaultValue ?? '';
      }
      
      // 初始化步骤状态
      for (const step of chain.value.steps) {
        stepStatuses.value.set(step.id, 'pending');
      }
    }
  } catch (error) {
    console.error('加载链失败:', error);
  } finally {
    loading.value = false;
  }
}

// 执行链
async function executeChain() {
  if (!chain.value || executing.value) return;
  
  executing.value = true;
  result.value = null;
  logs.value = [];
  currentStepIndex.value = -1;
  
  // 重置状态
  for (const step of chain.value.steps) {
    stepStatuses.value.set(step.id, 'pending');
    stepOutputs.value.delete(step.id);
  }
  
  addLog(`开始执行链: ${chain.value.name}`);
  addLog(`执行模式: ${chain.value.executionMode === 'single-shot' ? '单次' : '多步'}`);
  
  try {
    const execResult = await promptChainExecutor.execute(
      chain.value,
      inputValues.value,
      handleExecutionEvent
    );
    
    result.value = execResult;
    executionId.value = execResult.executionId;
    
    if (execResult.status === 'completed') {
      addLog(`✅ 执行完成，耗时 ${execResult.totalDuration}ms`);
      addLog(`Token 用量: ${execResult.totalUsage.totalTokens}`);
    } else if (execResult.status === 'failed') {
      addLog(`❌ 执行失败: ${execResult.error}`);
    } else if (execResult.status === 'aborted') {
      addLog(`⚠️ 执行已中止`);
    }
  } catch (error) {
    addLog(`❌ 执行出错: ${error instanceof Error ? error.message : '未知错误'}`);
  } finally {
    executing.value = false;
  }
}

// 处理执行事件
function handleExecutionEvent(event: ChainExecutionEvent) {
  switch (event.type) {
    case 'start':
      addLog(`执行 ID: ${event.executionId}`);
      break;
      
    case 'step-start':
      if (event.stepId) {
        stepStatuses.value.set(event.stepId, 'running');
        currentStepIndex.value = event.stepIndex ?? -1;
        const step = chain.value?.steps.find(s => s.id === event.stepId);
        addLog(`▶ 步骤 ${(event.stepIndex ?? 0) + 1}: ${step?.name || event.stepId}`);
      }
      break;
      
    case 'step-complete':
      if (event.stepId) {
        const stepResult = event.data as StepExecutionResult;
        stepStatuses.value.set(event.stepId, stepResult.status === 'completed' ? 'completed' : 'failed');
        if (stepResult.output !== undefined) {
          stepOutputs.value.set(event.stepId, stepResult.output);
        }
        addLog(`  ✓ 完成 (${stepResult.duration}ms)`);
      }
      break;
      
    case 'step-error':
      if (event.stepId) {
        stepStatuses.value.set(event.stepId, 'failed');
        addLog(`  ✗ 失败: ${event.error}`);
      }
      break;
      
    case 'error':
      addLog(`错误: ${event.error}`);
      break;
      
    case 'abort':
      addLog(`执行已中止`);
      break;
  }
}

// 中止执行
function abortExecution() {
  if (executionId.value) {
    promptChainExecutor.abort(executionId.value);
    addLog(`正在中止...`);
  }
}

// 添加日志
function addLog(message: string) {
  const time = new Date().toLocaleTimeString();
  logs.value.push(`[${time}] ${message}`);
}

// 格式化输出
function formatOutput(value: unknown): string {
  if (value === undefined) return '(无输出)';
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
}

// 返回
function goBack() {
  router.push(`/prompts/chains/${route.params.id}`);
}

// 返回列表
function goToList() {
  router.push('/prompts/chains');
}

onMounted(() => {
  loadChain();
});

onUnmounted(() => {
  // 组件卸载时中止执行
  if (executing.value && executionId.value) {
    promptChainExecutor.abort(executionId.value);
  }
});
</script>

<template>
  <div class="chain-runner">
    <!-- 头部 -->
    <header class="header">
      <button class="back-btn" @click="goBack">
        <i class="fas fa-chevron-left"></i>
      </button>
      <h1 class="title">{{ chain?.name || '执行链' }}</h1>
      <button class="list-btn" @click="goToList">
        <i class="fas fa-list"></i>
      </button>
    </header>
    
    <div v-if="loading" class="loading">
      <i class="fas fa-spinner fa-spin"></i>
      <span>加载中...</span>
    </div>
    
    <template v-else-if="chain">
      <!-- 输入表单 -->
      <section class="inputs-section">
        <h2 class="section-title">
          <i class="fas fa-keyboard"></i>
          输入参数
        </h2>
        
        <div v-if="chain.inputs.length === 0" class="empty-inputs">
          此链无需输入参数
        </div>
        
        <div v-else class="inputs-form">
          <div v-for="input in chain.inputs" :key="input.name" class="input-field">
            <label>
              {{ input.name }}
              <span v-if="input.required" class="required">*</span>
            </label>
            <p v-if="input.description" class="input-desc">{{ input.description }}</p>
            <input
              v-if="input.type === 'string' || input.type === 'number'"
              :value="String(inputValues[input.name] ?? '')"
              @input="(e) => inputValues[input.name] = (e.target as HTMLInputElement).value"
              :type="input.type === 'number' ? 'number' : 'text'"
              :placeholder="`输入 ${input.name}`"
              :disabled="executing"
            />
            <textarea
              v-else-if="input.type === 'object' || input.type === 'array'"
              :value="String(inputValues[input.name] ?? '')"
              @input="(e) => inputValues[input.name] = (e.target as HTMLTextAreaElement).value"
              :placeholder="`输入 JSON 格式的 ${input.name}`"
              :disabled="executing"
              rows="3"
            ></textarea>
            <label v-else-if="input.type === 'boolean'" class="checkbox">
              <input
                type="checkbox"
                :checked="Boolean(inputValues[input.name])"
                @change="(e) => inputValues[input.name] = (e.target as HTMLInputElement).checked"
                :disabled="executing"
              />
              {{ input.name }}
            </label>
          </div>
        </div>
        
        <div class="actions">
          <button
            v-if="!executing"
            class="execute-btn"
            :disabled="!canExecute"
            @click="executeChain"
          >
            <i class="fas fa-play"></i>
            执行链
          </button>
          <button v-else class="abort-btn" @click="abortExecution">
            <i class="fas fa-stop"></i>
            中止
          </button>
        </div>
      </section>
      
      <!-- 进度 -->
      <section v-if="executing || result" class="progress-section">
        <h2 class="section-title">
          <i class="fas fa-tasks"></i>
          执行进度
        </h2>
        
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: progress + '%' }"></div>
          <span class="progress-text">{{ progress }}%</span>
        </div>
        
        <div class="steps-progress">
          <div
            v-for="(step, index) in chain.steps"
            :key="step.id"
            class="step-progress"
            :class="[
              stepStatuses.get(step.id),
              { current: index === currentStepIndex }
            ]"
          >
            <div class="step-indicator">
              <i v-if="stepStatuses.get(step.id) === 'completed'" class="fas fa-check"></i>
              <i v-else-if="stepStatuses.get(step.id) === 'failed'" class="fas fa-times"></i>
              <i v-else-if="stepStatuses.get(step.id) === 'running'" class="fas fa-spinner fa-spin"></i>
              <span v-else>{{ index + 1 }}</span>
            </div>
            <div class="step-label">{{ step.name }}</div>
          </div>
        </div>
      </section>
      
      <!-- 结果 -->
      <section v-if="result" class="result-section">
        <h2 class="section-title">
          <i :class="result.status === 'completed' ? 'fas fa-check-circle' : 'fas fa-times-circle'"></i>
          执行结果
        </h2>
        
        <div class="result-meta">
          <span class="status" :class="result.status">
            {{ result.status === 'completed' ? '成功' : result.status === 'failed' ? '失败' : '已中止' }}
          </span>
          <span class="duration">
            <i class="fas fa-clock"></i>
            {{ result.totalDuration }}ms
          </span>
          <span class="tokens">
            <i class="fas fa-coins"></i>
            {{ result.totalUsage.totalTokens }} tokens
          </span>
        </div>
        
        <div v-if="result.error" class="error-message">
          <i class="fas fa-exclamation-triangle"></i>
          {{ result.error }}
        </div>
        
        <div class="outputs">
          <h3>输出</h3>
          <pre class="output-content">{{ formatOutput(result.outputs) }}</pre>
        </div>
        
        <!-- 步骤详情 -->
        <details class="step-details">
          <summary>步骤详情 ({{ result.stepResults.length }})</summary>
          <div v-for="stepResult in result.stepResults" :key="stepResult.stepId" class="step-result">
            <div class="step-result-header">
              <span class="step-name">{{ chain.steps.find(s => s.id === stepResult.stepId)?.name || stepResult.stepId }}</span>
              <span class="step-status" :class="stepResult.status">
                {{ stepResult.status }}
              </span>
            </div>
            <div v-if="stepResult.rawResponse" class="step-output">
              <strong>原始响应:</strong>
              <pre>{{ stepResult.rawResponse }}</pre>
            </div>
            <div v-if="stepResult.output !== undefined" class="step-output">
              <strong>解析输出:</strong>
              <pre>{{ formatOutput(stepResult.output) }}</pre>
            </div>
            <div v-if="stepResult.error" class="step-error">
              {{ stepResult.error }}
            </div>
          </div>
        </details>
      </section>
      
      <!-- 日志 -->
      <section class="logs-section">
        <h2 class="section-title">
          <i class="fas fa-terminal"></i>
          执行日志
        </h2>
        <div class="logs-container">
          <div v-for="(log, index) in logs" :key="index" class="log-line">
            {{ log }}
          </div>
          <div v-if="logs.length === 0" class="no-logs">
            点击「执行链」开始
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.chain-runner {
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
.list-btn {
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
}

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: var(--text-tertiary, #999);
}

section {
  padding: 16px;
  margin: 0;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: 600;
}

.section-title i {
  color: var(--primary-color, #007aff);
}

/* 输入表单 */
.inputs-section {
  background: var(--bg-secondary, #fff);
  border-bottom: 1px solid var(--border-color, #e0e0e0);
}

.empty-inputs {
  padding: 16px;
  text-align: center;
  color: var(--text-tertiary, #999);
  font-size: 14px;
}

.inputs-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.input-field label {
  display: block;
  margin-bottom: 4px;
  font-size: 13px;
  font-weight: 500;
}

.input-field .required {
  color: var(--danger-color, #ff3b30);
}

.input-desc {
  margin: 0 0 6px;
  font-size: 12px;
  color: var(--text-tertiary, #999);
}

.input-field input[type="text"],
.input-field input[type="number"],
.input-field textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 8px;
  font-size: 14px;
}

.actions {
  margin-top: 16px;
}

.execute-btn,
.abort-btn {
  width: 100%;
  padding: 12px;
  border: none;
  border-radius: 10px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.2s;
}

.execute-btn {
  background: var(--primary-color, #007aff);
  color: #fff;
}

.execute-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.abort-btn {
  background: var(--danger-color, #ff3b30);
  color: #fff;
}

/* 进度 */
.progress-section {
  background: var(--bg-secondary, #fff);
  border-bottom: 1px solid var(--border-color, #e0e0e0);
}

.progress-bar {
  position: relative;
  height: 8px;
  background: var(--bg-primary, #f0f0f0);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 16px;
}

.progress-fill {
  height: 100%;
  background: var(--primary-color, #007aff);
  transition: width 0.3s;
}

.progress-text {
  position: absolute;
  right: 0;
  top: -20px;
  font-size: 12px;
  color: var(--text-secondary, #666);
}

.steps-progress {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.step-progress {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: var(--bg-primary, #f5f5f5);
  border-radius: 16px;
  font-size: 12px;
}

.step-progress.current {
  background: var(--primary-light, #e3f2fd);
}

.step-progress.completed {
  background: var(--success-light, #e8f5e9);
}

.step-progress.failed {
  background: var(--danger-light, #ffebee);
}

.step-indicator {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--bg-secondary, #fff);
  font-size: 11px;
}

.step-progress.completed .step-indicator {
  background: var(--success-color, #34c759);
  color: #fff;
}

.step-progress.failed .step-indicator {
  background: var(--danger-color, #ff3b30);
  color: #fff;
}

.step-progress.running .step-indicator {
  background: var(--primary-color, #007aff);
  color: #fff;
}

/* 结果 */
.result-section {
  background: var(--bg-secondary, #fff);
  border-bottom: 1px solid var(--border-color, #e0e0e0);
}

.result-meta {
  display: flex;
  gap: 16px;
  margin-bottom: 12px;
}

.result-meta span {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
}

.status {
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 500;
}

.status.completed {
  background: var(--success-light, #e8f5e9);
  color: var(--success-color, #34c759);
}

.status.failed {
  background: var(--danger-light, #ffebee);
  color: var(--danger-color, #ff3b30);
}

.error-message {
  padding: 12px;
  background: var(--danger-light, #ffebee);
  border-radius: 8px;
  color: var(--danger-color, #ff3b30);
  font-size: 14px;
  margin-bottom: 12px;
}

.outputs h3 {
  margin: 0 0 8px;
  font-size: 14px;
}

.output-content {
  padding: 12px;
  background: var(--bg-primary, #f5f5f5);
  border-radius: 8px;
  font-size: 12px;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

.step-details {
  margin-top: 16px;
}

.step-details summary {
  cursor: pointer;
  font-weight: 500;
  padding: 8px 0;
}

.step-result {
  padding: 12px;
  margin-top: 8px;
  background: var(--bg-primary, #f5f5f5);
  border-radius: 8px;
}

.step-result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.step-status {
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
}

.step-status.completed {
  background: var(--success-light, #e8f5e9);
  color: var(--success-color, #34c759);
}

.step-status.failed {
  background: var(--danger-light, #ffebee);
  color: var(--danger-color, #ff3b30);
}

.step-output {
  margin-top: 8px;
}

.step-output pre {
  margin: 4px 0 0;
  padding: 8px;
  background: var(--bg-secondary, #fff);
  border-radius: 4px;
  font-size: 11px;
  overflow-x: auto;
  white-space: pre-wrap;
}

.step-error {
  margin-top: 8px;
  color: var(--danger-color, #ff3b30);
  font-size: 13px;
}

/* 日志 */
.logs-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.logs-container {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  background: #1e1e1e;
  border-radius: 8px;
  font-family: monospace;
  font-size: 12px;
  color: #d4d4d4;
}

.log-line {
  padding: 2px 0;
  white-space: pre-wrap;
  word-break: break-all;
}

.no-logs {
  color: #666;
  font-style: italic;
}
</style>
