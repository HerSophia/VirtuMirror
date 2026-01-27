<script setup lang="ts">
import DynamicAppIcon from '@/components/common/DynamicAppIcon.vue'
import { getIconRegistryService } from '@/services/icon'
import { promptChainService } from '@/services/prompt/promptChainService'
import { PromptService } from '@/services/prompt/promptService'
import { SystemPromptService } from '@/services/prompt/systemPromptService'
import type { PromptTemplate } from '@/types/prompts'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { usePromptActions } from '../composables/usePromptActions'

const router = useRouter()
const iconRegistry = getIconRegistryService()
const { handleExport, handleImport } = usePromptActions(() => loadData())

const allPrompts = ref<PromptTemplate[]>([])
const chainsCount = ref(0)
const systemPromptsStats = ref({ total: 0, enabled: 0 })
const searchQuery = ref('')
const showHelpDialog = ref(false)
const activeHelpTab = ref<'prompt' | 'chain' | 'system'>('prompt')

const loadData = async () => {
  allPrompts.value = PromptService.getAllPrompts().filter((p) => !p.isSystemPrompt)
  const chains = await promptChainService.getAllChains()
  chainsCount.value = chains.length
  const sysStats = SystemPromptService.getStats()
  systemPromptsStats.value = { total: sysStats.total, enabled: sysStats.enabled }
}

onMounted(() => {
  loadData()
})

// 统计数据
const totalCount = computed(() => allPrompts.value.length)
const userPromptsCount = computed(
  () => allPrompts.value.filter((p) => p.source.type === 'user').length
)
const builtinPromptsCount = computed(
  () => allPrompts.value.filter((p) => p.source.type === 'builtin').length
)

// App 分组 logic
interface AppGroup {
  appId: string
  name: string
  icon: string
  iconClass?: string
  count: number
}

const appGroups = computed(() => {
  const groups: AppGroup[] = []
  const processedAppIds = new Set<string>()

  // 提取所有 App 来源
  allPrompts.value.forEach((p) => {
    if (p.source.type === 'app') {
      processedAppIds.add(p.source.appId)
    }
  })

  // 构建 App 列表
  processedAppIds.forEach((appId) => {
    const appInfo = iconRegistry.get(appId)
    const count = allPrompts.value.filter(
      (p) => p.source.type === 'app' && p.source.appId === appId
    ).length

    // 特殊处理 Social Engine
    if (appId === 'social-engine') {
      groups.push({
        appId,
        name: '社交引擎',
        icon: '',
        iconClass: 'fas fa-network-wired',
        count,
      })
      return
    }

    groups.push({
      appId,
      name: appInfo?.name || appId,
      icon: appInfo?.iconId as string,
      iconClass: !appInfo?.iconId ? 'fas fa-cube' : undefined,
      count,
    })
  })

  return groups
})

const hasAppPrompts = computed(() => appGroups.value.length > 0)

const handleSearch = () => {
  if (searchQuery.value.trim()) {
    router.push({
      name: 'PromptsList',
      params: { scope: 'search' },
      query: { q: searchQuery.value },
    })
  }
}

const goToList = (scope: string) => {
  router.push({ name: 'PromptsList', params: { scope } })
}

const goToAll = () => goToList('all')
const goToUser = () => goToList('user')
const goToBuiltin = () => goToList('builtin')
const goToChains = () => router.push({ name: 'ChainsList' })
const goToSystemPrompts = () => router.push({ name: 'SystemPromptsList' })
const goToCreate = () =>
  router.push({ name: 'PromptsList', params: { scope: 'user' }, query: { action: 'add' } })
const goToCreateChain = () => router.push({ name: 'ChainEditor', params: { id: 'new' } })

const openHelp = (tab: 'prompt' | 'chain' | 'system') => {
  activeHelpTab.value = tab
  showHelpDialog.value = true
}

// Import handling wrapper to show alert
const onImportClick = async () => {
  const success = await handleImport()
  if (success) {
    alert('导入成功')
    loadData()
  }
}
</script>

<template>
  <div class="prompts-home">
    <!-- Header -->
    <header class="home-header">
      <h1 class="title">提示词中心</h1>
      <div class="actions">
        <button class="icon-btn" @click="openHelp('prompt')" title="帮助">
          <i class="fas fa-question-circle"></i>
        </button>
        <button class="icon-btn" @click="handleExport" title="导出配置">
          <i class="fas fa-download"></i>
        </button>
        <button class="icon-btn" @click="onImportClick" title="导入配置">
          <i class="fas fa-upload"></i>
        </button>
      </div>
    </header>

    <!-- Search -->
    <div class="search-section">
      <div class="search-box">
        <i class="fas fa-search"></i>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="搜索提示词..."
          @keyup.enter="handleSearch"
        />
      </div>
    </div>

    <!-- Scroll Content -->
    <div class="content-scroll">
      <!-- Stats Cards -->
      <section class="stats-section">
        <div class="stats-grid">
          <div class="stat-card" @click="goToAll">
            <div class="stat-icon all-bg">
              <i class="fas fa-layer-group"></i>
            </div>
            <div class="stat-info">
              <span class="stat-value">{{ totalCount }}</span>
              <span class="stat-label">全部提示词</span>
            </div>
          </div>

          <div class="stat-card" @click="goToUser">
            <div class="stat-icon user-bg">
              <i class="fas fa-user-pen"></i>
            </div>
            <div class="stat-info">
              <span class="stat-value">{{ userPromptsCount }}</span>
              <span class="stat-label">我的</span>
            </div>
          </div>

          <div class="stat-card" @click="goToChains">
            <div class="stat-icon chain-bg">
              <i class="fas fa-link"></i>
            </div>
            <div class="stat-info">
              <span class="stat-value">{{ chainsCount }}</span>
              <span class="stat-label">提示词链</span>
            </div>
          </div>

          <div class="stat-card" @click="goToSystemPrompts">
            <div class="stat-icon system-prompt-bg">
              <i class="fas fa-globe"></i>
            </div>
            <div class="stat-info">
              <span class="stat-value">{{ systemPromptsStats.total }}</span>
              <span class="stat-label">系统提示词</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Quick Actions -->
      <section class="section">
        <h2 class="section-title">快捷操作</h2>
        <div class="action-list">
          <!-- 创建新提示词 -->
          <div class="action-item" @click="goToCreate">
            <div class="action-icon create-bg">
              <i class="fas fa-plus"></i>
            </div>
            <div class="action-content">
              <span class="action-text">创建新提示词</span>
              <span class="action-desc">自定义 AI 对话的系统提示</span>
            </div>
            <button class="help-btn" @click.stop="openHelp('prompt')">
              <i class="fas fa-info-circle"></i>
            </button>
            <i class="fas fa-chevron-right action-arrow"></i>
          </div>

          <!-- 创建提示词链 -->
          <div class="action-item" @click="goToCreateChain">
            <div class="action-icon chain-create-bg">
              <i class="fas fa-diagram-project"></i>
            </div>
            <div class="action-content">
              <span class="action-text">创建提示词链</span>
              <span class="action-desc">编排多步骤 AI 任务流程</span>
            </div>
            <button class="help-btn" @click.stop="openHelp('chain')">
              <i class="fas fa-info-circle"></i>
            </button>
            <i class="fas fa-chevron-right action-arrow"></i>
          </div>

          <!-- 系统内置 -->
          <div class="action-item" @click="goToBuiltin">
            <div class="action-icon builtin-bg">
              <i class="fas fa-box"></i>
            </div>
            <div class="action-content">
              <span class="action-text">内置模板</span>
              <span class="action-desc">预设的提示词模板</span>
            </div>
            <span class="action-badge">{{ builtinPromptsCount }}</span>
            <i class="fas fa-chevron-right action-arrow"></i>
          </div>

          <!-- 系统提示词 -->
          <div class="action-item" @click="goToSystemPrompts">
            <div class="action-icon system-prompt-action-bg">
              <i class="fas fa-globe"></i>
            </div>
            <div class="action-content">
              <span class="action-text">系统提示词</span>
              <span class="action-desc">全局约束 AI 行为的提示词</span>
            </div>
            <button class="help-btn" @click.stop="openHelp('system')">
              <i class="fas fa-info-circle"></i>
            </button>
            <span class="action-badge"
              >{{ systemPromptsStats.enabled }}/{{ systemPromptsStats.total }}</span
            >
            <i class="fas fa-chevron-right action-arrow"></i>
          </div>
        </div>
      </section>

      <!-- App Sources -->
      <section v-if="hasAppPrompts" class="section">
        <h2 class="section-title">应用注册</h2>
        <p class="section-desc">由应用注册的提示词模板</p>
        <div class="app-grid">
          <div
            v-for="app in appGroups"
            :key="app.appId"
            class="app-item"
            @click="goToList(app.appId)"
          >
            <DynamicAppIcon :app-id="app.appId" size="lg" :rounded="false" class="app-icon" />
            <span class="app-name">{{ app.name }}</span>
            <span class="app-count">{{ app.count }}</span>
          </div>
        </div>
      </section>
    </div>

    <!-- Help Dialog -->
    <div v-if="showHelpDialog" class="dialog-overlay" @click.self="showHelpDialog = false">
      <div class="help-dialog">
        <header class="dialog-header">
          <h2 class="dialog-title">了解更多</h2>
          <button class="close-btn" @click="showHelpDialog = false">
            <i class="fas fa-times"></i>
          </button>
        </header>

        <!-- Tabs -->
        <div class="dialog-tabs">
          <button
            :class="['tab', { active: activeHelpTab === 'prompt' }]"
            @click="activeHelpTab = 'prompt'"
          >
            提示词
          </button>
          <button
            :class="['tab', { active: activeHelpTab === 'chain' }]"
            @click="activeHelpTab = 'chain'"
          >
            提示词链
          </button>
          <button
            :class="['tab', { active: activeHelpTab === 'system' }]"
            @click="activeHelpTab = 'system'"
          >
            系统提示词
          </button>
        </div>

        <!-- Content -->
        <div class="dialog-content">
          <!-- 提示词说明 -->
          <div v-if="activeHelpTab === 'prompt'" class="help-content">
            <div class="help-section">
              <h3>什么是提示词？</h3>
              <p>
                提示词（Prompt）是给 AI 的指令模板，告诉它应该扮演什么角色、如何回应、关注什么内容。
              </p>
            </div>

            <div class="help-section">
              <h3>提示词能做什么？</h3>
              <ul>
                <li><i class="fas fa-check"></i>定义 AI 的人设和性格</li>
                <li><i class="fas fa-check"></i>规范回复的格式和风格</li>
                <li><i class="fas fa-check"></i>提供背景知识和上下文</li>
                <li><i class="fas fa-check"></i>设置对话的规则和限制</li>
              </ul>
            </div>

            <div class="help-section">
              <h3>如何使用？</h3>
              <p>
                创建提示词后，可在需要的应用中选择使用。提示词会作为系统消息发送给
                AI，影响其后续所有回复。
              </p>
            </div>

            <div class="help-example">
              <span class="example-label">示例</span>
              <p class="example-text">
                "你是一位专业的日语教师，善于用简单易懂的方式解释语法，每次回答都会举出实用例句..."
              </p>
            </div>
          </div>

          <!-- 提示词链说明 -->
          <div v-if="activeHelpTab === 'chain'" class="help-content">
            <div class="help-section">
              <h3>什么是提示词链？</h3>
              <p>
                提示词链（Prompt Chain）是将多个提示词按顺序串联，实现复杂的多步骤 AI
                任务。每一步的输出可以作为下一步的输入。
              </p>
            </div>

            <div class="help-section">
              <h3>适用场景</h3>
              <ul>
                <li><i class="fas fa-check"></i>内容创作：先构思大纲，再分章节写作</li>
                <li><i class="fas fa-check"></i>数据处理：提取 → 分类 → 总结</li>
                <li><i class="fas fa-check"></i>翻译润色：直译 → 意译 → 本地化</li>
                <li><i class="fas fa-check"></i>角色扮演：多角色依次发言</li>
              </ul>
            </div>

            <div class="help-section">
              <h3>如何运作？</h3>
              <div class="chain-flow">
                <div class="flow-step">
                  <span class="step-num">1</span>
                  <span class="step-text">步骤 A</span>
                </div>
                <i class="fas fa-arrow-right flow-arrow"></i>
                <div class="flow-step">
                  <span class="step-num">2</span>
                  <span class="step-text">步骤 B</span>
                </div>
                <i class="fas fa-arrow-right flow-arrow"></i>
                <div class="flow-step">
                  <span class="step-num">3</span>
                  <span class="step-text">步骤 C</span>
                </div>
              </div>
              <p class="flow-desc">
                使用变量 <code v-pre>{{ step1.result }}</code> 引用上一步的输出结果
              </p>
            </div>
          </div>

          <!-- 系统提示词说明 -->
          <div v-if="activeHelpTab === 'system'" class="help-content">
            <div class="help-section">
              <h3>什么是系统提示词？</h3>
              <p>
                系统提示词是自动注入到所有 LLM 调用中的全局性指令，用于约束 AI 的行为和输出风格。
              </p>
            </div>

            <div class="help-section">
              <h3>作用域</h3>
              <ul>
                <li>
                  <i class="fas fa-globe"></i><strong>全局</strong>：适用于所有应用的 LLM 调用
                </li>
                <li><i class="fas fa-cube"></i><strong>应用级</strong>：仅在指定应用中生效</li>
              </ul>
            </div>

            <div class="help-section">
              <h3>典型用例</h3>
              <ul>
                <li><i class="fas fa-check"></i>"始终使用简体中文回复"</li>
                <li><i class="fas fa-check"></i>"保持沉浸感，不要打破第四面墙"</li>
                <li><i class="fas fa-check"></i>"避免使用真实公众人物姓名"</li>
              </ul>
            </div>

            <div class="help-example">
              <span class="example-label">组装顺序</span>
              <p class="example-text">全局提示词 → App 级提示词 → 单个 Prompt 的系统提示词</p>
            </div>
          </div>
        </div>

        <footer class="dialog-footer">
          <button class="primary-btn" @click="showHelpDialog = false">我知道了</button>
        </footer>
      </div>
    </div>
  </div>
</template>

<style scoped>
.prompts-home {
  @apply flex h-full flex-col;
  background: var(--color-background);
}

.home-header {
  @apply flex items-center justify-between px-5 py-4;
}

.title {
  @apply text-xl font-bold;
  color: var(--color-text);
}

.actions {
  @apply flex gap-2;
}

.icon-btn {
  @apply flex h-8 w-8 items-center justify-center rounded-full;
  @apply text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-variant)];
  transition: background 0.2s;
}

.search-section {
  @apply px-5 pb-3;
}

.search-box {
  @apply flex items-center gap-2 rounded-xl px-3 py-2.5;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
}

.search-box i {
  color: var(--color-text-secondary);
}

.search-box input {
  @apply flex-1 border-none bg-transparent text-sm outline-none;
  color: var(--color-text);
}

.content-scroll {
  @apply flex-1 overflow-y-auto px-5 py-2;
}

/* Stats Section */
.stats-section {
  @apply mb-6;
}

.stats-grid {
  @apply grid grid-cols-4 gap-2;
}

.stat-card {
  @apply flex cursor-pointer flex-col items-center gap-2 rounded-xl p-3;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  transition:
    transform 0.1s,
    border-color 0.2s;
}

.stat-card:active {
  transform: scale(0.97);
}

.stat-card:hover {
  border-color: var(--color-primary);
}

.stat-icon {
  @apply flex h-10 w-10 items-center justify-center rounded-full text-white;
}

.all-bg {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
.user-bg {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
}
.chain-bg {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}
.system-prompt-bg {
  background: linear-gradient(135deg, #00c6fb 0%, #005bea 100%);
}
.create-bg {
  background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
}
.chain-create-bg {
  background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
}
.builtin-bg {
  background: linear-gradient(135deg, #a8a8a8 0%, #d0d0d0 100%);
  color: #555;
}
.system-prompt-action-bg {
  background: linear-gradient(135deg, #00c6fb 0%, #005bea 100%);
}

.stat-info {
  @apply flex flex-col items-center;
}

.stat-value {
  @apply text-xl font-bold;
  color: var(--color-text);
}

.stat-label {
  @apply text-[11px];
  color: var(--color-text-secondary);
}

/* Section */
.section {
  @apply mb-6;
}

.section-title {
  @apply mb-2 text-xs font-bold uppercase;
  color: var(--color-text-secondary);
  letter-spacing: 0.5px;
}

.section-desc {
  @apply mb-3 text-xs;
  color: var(--color-text-secondary);
  opacity: 0.7;
}

/* Action List */
.action-list {
  @apply flex flex-col gap-2;
}

.action-item {
  @apply flex cursor-pointer items-center gap-3 rounded-xl p-3;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  transition: transform 0.1s;
}

.action-item:active {
  transform: scale(0.98);
}

.action-icon {
  @apply flex h-10 w-10 items-center justify-center rounded-xl text-sm text-white;
}

.action-content {
  @apply flex flex-1 flex-col gap-0.5;
}

.action-text {
  @apply text-sm font-medium;
  color: var(--color-text);
}

.action-desc {
  @apply text-xs;
  color: var(--color-text-secondary);
}

.help-btn {
  @apply flex h-6 w-6 items-center justify-center rounded-full text-xs;
  color: var(--color-text-secondary);
  opacity: 0.5;
  transition: opacity 0.2s;
}

.help-btn:hover {
  opacity: 1;
}

.action-badge {
  @apply rounded-full px-2 py-0.5 text-xs font-medium;
  background: var(--color-surface-variant);
  color: var(--color-text-secondary);
}

.action-arrow {
  @apply text-xs;
  color: var(--color-text-secondary);
}

/* App Grid */
.app-grid {
  @apply grid grid-cols-4 gap-x-2 gap-y-4;
}

.app-item {
  @apply flex cursor-pointer flex-col items-center gap-1.5;
}

.app-icon {
  width: 50px;
  height: 50px;
  font-size: 1.4rem;
  transition: transform 0.1s;
}

.app-item:active .app-icon {
  transform: scale(0.95);
}

.app-name {
  @apply w-full truncate px-1 text-center text-xs font-medium;
  color: var(--color-text);
}

.app-count {
  @apply text-[10px];
  color: var(--color-text-secondary);
}

/* Dialog */
.dialog-overlay {
  @apply absolute inset-0 flex items-center justify-center p-4;
  background: rgba(0, 0, 0, 0.5);
  z-index: 100;
}

.help-dialog {
  @apply flex w-full max-w-sm flex-col overflow-hidden rounded-2xl;
  max-height: 80vh;
  background: var(--color-surface);
}

.dialog-header {
  @apply flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3;
}

.dialog-title {
  @apply text-lg font-bold;
  color: var(--color-text);
}

.close-btn {
  @apply flex h-8 w-8 items-center justify-center rounded-full;
  color: var(--color-text-secondary);
}

.dialog-tabs {
  @apply flex border-b border-[var(--color-border)];
}

.tab {
  @apply flex-1 py-3 text-center text-sm font-medium;
  color: var(--color-text-secondary);
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}

.tab.active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
}

.dialog-content {
  @apply flex-1 overflow-y-auto p-4;
}

.help-content {
  @apply flex flex-col gap-4;
}

.help-section h3 {
  @apply mb-2 text-sm font-bold;
  color: var(--color-text);
}

.help-section p {
  @apply text-sm leading-relaxed;
  color: var(--color-text-secondary);
}

.help-section ul {
  @apply flex flex-col gap-2;
}

.help-section li {
  @apply flex items-center gap-2 text-sm;
  color: var(--color-text-secondary);
}

.help-section li i {
  @apply text-xs;
  color: var(--color-primary);
}

.help-example {
  @apply rounded-xl p-3;
  background: var(--color-surface-variant);
}

.example-label {
  @apply mb-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium;
  background: var(--color-primary);
  color: white;
}

.example-text {
  @apply text-sm italic leading-relaxed;
  color: var(--color-text-secondary);
}

.chain-flow {
  @apply flex items-center justify-center gap-2 py-3;
}

.flow-step {
  @apply flex flex-col items-center gap-1;
}

.step-num {
  @apply flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white;
  background: var(--color-primary);
}

.step-text {
  @apply text-xs;
  color: var(--color-text-secondary);
}

.flow-arrow {
  @apply text-xs;
  color: var(--color-text-secondary);
}

.flow-desc {
  @apply mt-2 text-center text-xs;
  color: var(--color-text-secondary);
}

.flow-desc code {
  @apply rounded px-1.5 py-0.5 text-xs;
  background: var(--color-surface-variant);
  color: var(--color-primary);
}

.dialog-footer {
  @apply border-t border-[var(--color-border)] p-4;
}

.primary-btn {
  @apply w-full rounded-xl py-2.5 text-sm font-medium text-white;
  background: var(--color-primary);
}
</style>
