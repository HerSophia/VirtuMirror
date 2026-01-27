<script setup lang="ts">
import DynamicAppIcon from '@/components/common/DynamicAppIcon.vue'
import { getIconRegistryService } from '@/services/icon'
import { PromptService } from '@/services/prompt/promptService'
import type { PromptCategory, PromptTemplate } from '@/types/prompts'
import { PROMPT_CATEGORIES } from '@/types/prompts'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PromptAddDialog from '../components/PromptAddDialog.vue'
import PromptCard from '../components/PromptCard.vue'
import PromptEditDialog from '../components/PromptEditDialog.vue'
import { usePromptActions } from '../composables/usePromptActions'

const props = defineProps<{
  scope: string // appId, 'user', 'builtin', 'search'
}>()

const router = useRouter()
const route = useRoute()
const iconRegistry = getIconRegistryService()

// Data
const allPrompts = ref<PromptTemplate[]>([])
const activeCategory = ref<PromptCategory | 'all'>('all')
const searchQuery = ref('')

// Dialog State
const editingPrompt = ref<PromptTemplate | null>(null)
const showAddDialog = ref(false)

// Logic
const loadPrompts = () => {
  allPrompts.value = PromptService.getAllPrompts()
}

const { handleToggle, handleDelete, handleReset, handleDuplicate } = usePromptActions(loadPrompts) // Pass refresh callback

onMounted(() => {
  loadPrompts()
  if (props.scope === 'search') {
    searchQuery.value = (route.query.q as string) || ''
  }
  // 如果带有 action=add 参数，自动打开添加对话框
  if (route.query.action === 'add' && props.scope === 'user') {
    showAddDialog.value = true
  }
})

// Watch for search query changes if in search mode
watch(
  () => route.query.q,
  (newVal) => {
    if (props.scope === 'search') {
      searchQuery.value = (newVal as string) || ''
    }
  }
)

// Computed Header Info
const headerInfo = computed(() => {
  if (props.scope === 'all') return { title: '全部提示词', icon: 'fas fa-layer-group' }
  if (props.scope === 'user') return { title: '我的提示词', icon: 'fas fa-user-pen' }
  if (props.scope === 'builtin') return { title: '系统内置', icon: 'fas fa-box' }
  if (props.scope === 'search')
    return { title: `搜索: ${searchQuery.value}`, icon: 'fas fa-search' }
  // social-engine is now registered as an app

  const app = iconRegistry.get(props.scope)
  return {
    title: app?.name || props.scope,
    iconId: app?.iconId,
    icon: !app?.iconId ? 'fas fa-cube' : undefined,
  }
})

// Filtering
const filteredPrompts = computed(() => {
  let result = allPrompts.value

  // 1. Scope Filter
  if (props.scope === 'all') {
    // 全部，不过滤
  } else if (props.scope === 'user') {
    result = result.filter((p) => p.source.type === 'user')
  } else if (props.scope === 'builtin') {
    result = result.filter((p) => p.source.type === 'builtin')
  } else if (props.scope === 'search') {
    // Search is global, but filtered by query
    const q = searchQuery.value.toLowerCase()
    result = result.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.scene.toLowerCase().includes(q)
    )
  } else {
    // App Scope
    result = result.filter((p) => p.source.type === 'app' && p.source.appId === props.scope)
  }

  // 2. Category Filter
  if (activeCategory.value !== 'all') {
    result = result.filter((p) => p.category === activeCategory.value)
  }

  return result
})

// Categories for Tabs
const categories = PROMPT_CATEGORIES

const getCategoryCount = (catId: string) => {
  // Calculate count based on CURRENT scope filter (ignoring category filter)
  let base = allPrompts.value
  if (props.scope === 'all') {
    /* 全部 */
  } else if (props.scope === 'user') base = base.filter((p) => p.source.type === 'user')
  else if (props.scope === 'builtin') base = base.filter((p) => p.source.type === 'builtin')
  else if (props.scope === 'search') {
    const q = searchQuery.value.toLowerCase()
    base = base.filter(
      (p) => p.name.toLowerCase().includes(q) || p.description?.includes(q) || p.scene.includes(q)
    )
  } else base = base.filter((p) => p.source.type === 'app' && p.source.appId === props.scope)

  if (catId === 'all') return base.length
  return base.filter((p) => p.category === catId).length
}

// Handlers
const onEdit = (prompt: PromptTemplate) => {
  editingPrompt.value = { ...prompt }
}

const onSaveEdit = (updated: PromptTemplate) => {
  PromptService.updatePrompt(updated.id, updated)
  loadPrompts()
  editingPrompt.value = null
}

const onAdd = (prompt: any) => {
  PromptService.addPrompt(prompt)
  loadPrompts()
  showAddDialog.value = false
}

const onView = (prompt: PromptTemplate) => {
  router.push({ name: 'PromptDetail', params: { id: prompt.id } })
}
</script>

<template>
  <div class="prompts-list-page">
    <!-- Header -->
    <header class="list-header">
      <button class="back-btn" @click="router.back()">
        <i class="fas fa-chevron-left"></i>
      </button>
      <div class="header-content">
        <DynamicAppIcon
          :app-id="props.scope"
          :icon="
            headerInfo.icon
              ? {
                  type: 'font',
                  value: headerInfo.icon,
                  background:
                    props.scope === 'user'
                      ? 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
                      : props.scope === 'builtin'
                        ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                        : '#8E8E93',
                }
              : undefined
          "
          size="sm"
          :rounded="true"
          class="mr-2"
        />
        <h1 class="header-title">{{ headerInfo.title }}</h1>
      </div>
      <div class="header-actions">
        <!-- Add button only for User scope (or if we allow adding to apps later) -->
        <button v-if="scope === 'user'" class="add-btn-icon" @click="showAddDialog = true">
          <i class="fas fa-plus"></i>
        </button>
      </div>
    </header>

    <!-- Category Tabs -->
    <div class="tabs-container">
      <button
        v-for="cat in categories"
        :key="cat.id"
        :class="['tab-item', { active: activeCategory === cat.id }]"
        @click="activeCategory = cat.id"
      >
        <span>{{ cat.name }}</span>
        <span class="tab-count">{{ getCategoryCount(cat.id) }}</span>
      </button>
    </div>

    <!-- List Content -->
    <div class="list-content">
      <div v-if="filteredPrompts.length === 0" class="empty-state">
        <p>暂无相关提示词</p>
      </div>

      <div v-else class="cards-container">
        <PromptCard
          v-for="prompt in filteredPrompts"
          :key="prompt.id"
          :prompt="prompt"
          @edit="onEdit"
          @toggle="handleToggle"
          @reset="handleReset"
          @delete="handleDelete"
          @duplicate="handleDuplicate"
          @view="onView"
        />
      </div>
    </div>

    <!-- Dialogs -->
    <PromptEditDialog
      v-if="editingPrompt"
      :prompt="editingPrompt"
      @save="onSaveEdit"
      @close="editingPrompt = null"
    />
    <PromptAddDialog v-if="showAddDialog" @save="onAdd" @close="showAddDialog = false" />
  </div>
</template>

<style scoped>
.prompts-list-page {
  @apply flex h-full flex-col;
  background: var(--color-background);
}

.list-header {
  @apply flex items-center justify-between border-b border-[var(--color-border)] px-3 py-3;
  background: var(--color-surface);
}

.back-btn {
  @apply flex h-10 w-10 items-center justify-center rounded-full text-[var(--color-text)];
}

.header-content {
  @apply flex items-center gap-2;
}

.header-icon-img {
  @apply h-6 w-6 rounded bg-cover;
}

.header-icon-fa {
  @apply text-lg;
  color: var(--color-primary);
}

.header-title {
  @apply text-lg font-bold;
  color: var(--color-text);
}

.header-actions {
  @apply flex w-10 justify-end;
}

.add-btn-icon {
  @apply flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-primary)] text-white shadow-sm;
}

.tabs-container {
  @apply flex gap-2 overflow-x-auto px-4 py-3;
  scrollbar-width: none;
}
.tabs-container::-webkit-scrollbar {
  display: none;
}

.tab-item {
  @apply flex items-center gap-1 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium;
  background: var(--color-surface);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
  transition: all 0.2s;
}

.tab-item.active {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

.tab-count {
  @apply text-[10px] opacity-70;
}

.list-content {
  @apply flex-1 overflow-y-auto px-4 pb-4;
}

.cards-container {
  @apply flex flex-col gap-3;
}

.empty-state {
  @apply flex h-40 flex-col items-center justify-center text-sm text-[var(--color-text-secondary)];
}
</style>
