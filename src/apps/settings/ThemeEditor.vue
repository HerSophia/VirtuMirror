<template>
  <div class="theme-editor bg-theme min-h-full">
    <!-- 头部 -->
    <div class="app-header">
      <button class="app-back-btn" @click="$router.back()">
        <i class="fas fa-chevron-left"></i>
      </button>
      <h3>主题设置</h3>
      <div class="w-8"></div>
    </div>

    <div class="p-4 space-y-6">
      <!-- 当前主题预览 -->
      <section class="card-theme p-4 rounded-xl">
        <h4 class="text-theme font-semibold mb-3">当前主题</h4>
        <div class="flex items-center gap-4">
          <div
            class="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl"
            :style="{ backgroundColor: currentTheme.colors.primary }"
          >
            <i class="fas fa-palette"></i>
          </div>
          <div class="flex-1">
            <div class="text-theme font-medium text-lg">{{ currentTheme.name }}</div>
            <div class="text-theme-secondary text-sm">{{ currentTheme.description }}</div>
          </div>
        </div>
        <!-- 颜色预览条 -->
        <div class="flex gap-1 mt-4 rounded-lg overflow-hidden">
          <div
            v-for="(color, key) in previewColors"
            :key="key"
            class="h-8 flex-1"
            :style="{ backgroundColor: color }"
            :title="key"
          ></div>
        </div>
      </section>

      <!-- 预设主题选择 -->
      <section>
        <h4 class="text-theme font-semibold mb-3">预设主题</h4>
        <div class="grid grid-cols-2 gap-3">
          <button
            v-for="theme in themePreviews.filter(t => t.isBuiltin)"
            :key="theme.id"
            class="theme-preset-card card-theme p-3 rounded-xl text-left transition-all"
            :class="{ 'ring-2 ring-offset-2': currentTheme.id === theme.id }"
            :style="currentTheme.id === theme.id ? { ringColor: theme.primaryColor } : {}"
            @click="applyThemeById(theme.id)"
          >
            <div class="flex items-center gap-3">
              <div
                class="w-10 h-10 rounded-xl flex items-center justify-center text-white"
                :style="{ backgroundColor: theme.primaryColor }"
              >
                <i class="fas fa-check" v-if="currentTheme.id === theme.id"></i>
                <i class="fas fa-brush" v-else></i>
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-theme font-medium text-sm truncate">{{ theme.name }}</div>
                <div class="flex gap-1 mt-1">
                  <span
                    class="w-4 h-4 rounded-full border border-white/20"
                    :style="{ backgroundColor: theme.primaryColor }"
                  ></span>
                  <span
                    class="w-4 h-4 rounded-full border border-white/20"
                    :style="{ backgroundColor: theme.backgroundColor }"
                  ></span>
                </div>
              </div>
            </div>
          </button>
        </div>
      </section>

      <!-- 自定义主题 -->
      <section v-if="customThemes.length > 0">
        <div class="flex items-center justify-between mb-3">
          <h4 class="text-theme font-semibold">自定义主题</h4>
          <button
            class="text-theme-primary text-sm"
            @click="showCreateDialog = true"
          >
            <i class="fas fa-plus mr-1"></i>新建
          </button>
        </div>
        <div class="space-y-2">
          <div
            v-for="theme in customThemes"
            :key="theme.id"
            class="card-theme p-3 rounded-xl flex items-center gap-3"
          >
            <div
              class="w-10 h-10 rounded-xl flex items-center justify-center text-white"
              :style="{ backgroundColor: theme.colors.primary }"
            >
              <i class="fas fa-palette"></i>
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-theme font-medium text-sm truncate">{{ theme.name }}</div>
            </div>
            <div class="flex gap-2">
              <button
                class="w-8 h-8 rounded-lg bg-theme-surface-variant flex items-center justify-center text-theme-secondary"
                @click="applyTheme(theme)"
                title="应用"
              >
                <i class="fas fa-check"></i>
              </button>
              <button
                class="w-8 h-8 rounded-lg bg-theme-surface-variant flex items-center justify-center text-theme-secondary"
                @click="editCustomTheme(theme)"
                title="编辑"
              >
                <i class="fas fa-edit"></i>
              </button>
              <button
                class="w-8 h-8 rounded-lg bg-theme-surface-variant flex items-center justify-center text-theme-error"
                @click="confirmDeleteTheme(theme)"
                title="删除"
              >
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- 快捷操作 -->
      <section>
        <h4 class="text-theme font-semibold mb-3">快捷操作</h4>
        <div class="space-y-2">
          <button
            class="w-full card-theme p-4 rounded-xl flex items-center gap-3 text-left"
            @click="showCreateDialog = true"
          >
            <div class="w-10 h-10 rounded-xl bg-theme-primary flex items-center justify-center text-white">
              <i class="fas fa-plus"></i>
            </div>
            <div class="flex-1">
              <div class="text-theme font-medium">创建新主题</div>
              <div class="text-theme-secondary text-sm">基于当前主题创建自定义主题</div>
            </div>
            <i class="fas fa-chevron-right text-theme-secondary"></i>
          </button>

          <button
            class="w-full card-theme p-4 rounded-xl flex items-center gap-3 text-left"
            @click="handleExport"
          >
            <div class="w-10 h-10 rounded-xl bg-theme-success flex items-center justify-center text-white">
              <i class="fas fa-download"></i>
            </div>
            <div class="flex-1">
              <div class="text-theme font-medium">导出主题</div>
              <div class="text-theme-secondary text-sm">将所有自定义主题导出为 JSON 文件</div>
            </div>
            <i class="fas fa-chevron-right text-theme-secondary"></i>
          </button>

          <button
            class="w-full card-theme p-4 rounded-xl flex items-center gap-3 text-left"
            @click="handleImport"
          >
            <div class="w-10 h-10 rounded-xl bg-theme-warning flex items-center justify-center text-white">
              <i class="fas fa-upload"></i>
            </div>
            <div class="flex-1">
              <div class="text-theme font-medium">导入主题</div>
              <div class="text-theme-secondary text-sm">从 JSON 文件导入主题配置</div>
            </div>
            <i class="fas fa-chevron-right text-theme-secondary"></i>
          </button>

          <button
            class="w-full card-theme p-4 rounded-xl flex items-center gap-3 text-left"
            @click="resetToDefault"
          >
            <div class="w-10 h-10 rounded-xl bg-theme-secondary flex items-center justify-center text-white">
              <i class="fas fa-undo"></i>
            </div>
            <div class="flex-1">
              <div class="text-theme font-medium">重置为默认</div>
              <div class="text-theme-secondary text-sm">恢复默认 iOS 主题</div>
            </div>
            <i class="fas fa-chevron-right text-theme-secondary"></i>
          </button>
        </div>
      </section>
    </div>

    <!-- 创建/编辑主题对话框 -->
    <Teleport to="body">
      <div
        v-if="showCreateDialog || editingTheme"
        class="modal-overlay"
        @click.self="closeDialog"
      >
        <div class="modal-content max-h-[80vh] overflow-y-auto">
          <div class="p-4 border-b border-theme">
            <h3 class="text-theme font-semibold text-lg">
              {{ editingTheme ? '编辑主题' : '创建新主题' }}
            </h3>
          </div>

          <div class="p-4 space-y-4">
            <!-- 主题名称 -->
            <div>
              <label class="text-theme-secondary text-sm mb-1 block">主题名称</label>
              <input
                v-model="dialogForm.name"
                type="text"
                class="input-theme w-full px-3 py-2 rounded-lg"
                placeholder="输入主题名称"
              />
            </div>

            <!-- 主题描述 -->
            <div>
              <label class="text-theme-secondary text-sm mb-1 block">描述</label>
              <input
                v-model="dialogForm.description"
                type="text"
                class="input-theme w-full px-3 py-2 rounded-lg"
                placeholder="简短描述（可选）"
              />
            </div>

            <!-- 颜色设置 -->
            <div>
              <label class="text-theme-secondary text-sm mb-2 block">主题颜色</label>
              <div class="grid grid-cols-2 gap-3">
                <div
                  v-for="(color, key) in dialogForm.colors"
                  :key="key"
                  class="flex items-center gap-2"
                >
                  <input
                    type="color"
                    :value="color"
                    @input="dialogForm.colors[key] = ($event.target as HTMLInputElement).value"
                    class="w-8 h-8 rounded cursor-pointer"
                  />
                  <span class="text-theme text-xs">{{ colorLabels[key] }}</span>
                </div>
              </div>
            </div>

            <!-- 设备外观 -->
            <div>
              <label class="text-theme-secondary text-sm mb-2 block">刘海样式</label>
              <div class="flex gap-2">
                <button
                  v-for="style in notchStyles"
                  :key="style.value"
                  class="flex-1 py-2 px-3 rounded-lg text-xs transition-all"
                  :class="dialogForm.device.notchStyle === style.value
                    ? 'bg-theme-primary text-white'
                    : 'bg-theme-surface-variant text-theme'"
                  @click="dialogForm.device.notchStyle = style.value"
                >
                  {{ style.label }}
                </button>
              </div>
            </div>

            <!-- 边框圆角 -->
            <div>
              <label class="text-theme-secondary text-sm mb-2 block">
                边框圆角: {{ dialogForm.device.borderRadius }}px
              </label>
              <input
                v-model.number="dialogForm.device.borderRadius"
                type="range"
                min="0"
                max="50"
                class="w-full"
              />
            </div>

            <!-- 阴影强度 -->
            <div>
              <label class="text-theme-secondary text-sm mb-2 block">阴影强度</label>
              <div class="flex gap-2">
                <button
                  v-for="shadow in shadowIntensities"
                  :key="shadow.value"
                  class="flex-1 py-2 px-3 rounded-lg text-xs transition-all"
                  :class="dialogForm.device.shadowIntensity === shadow.value
                    ? 'bg-theme-primary text-white'
                    : 'bg-theme-surface-variant text-theme'"
                  @click="dialogForm.device.shadowIntensity = shadow.value"
                >
                  {{ shadow.label }}
                </button>
              </div>
            </div>
          </div>

          <!-- 操作按钮 -->
          <div class="p-4 border-t border-theme flex gap-3">
            <button
              class="flex-1 py-2 rounded-lg bg-theme-surface-variant text-theme"
              @click="closeDialog"
            >
              取消
            </button>
            <button
              class="flex-1 py-2 rounded-lg bg-theme-primary text-white"
              @click="saveTheme"
            >
              {{ editingTheme ? '保存' : '创建' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 确认删除对话框 -->
    <Teleport to="body">
      <div
        v-if="deletingTheme"
        class="modal-overlay"
        @click.self="deletingTheme = null"
      >
        <div class="modal-content">
          <div class="p-6 text-center">
            <div class="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <i class="fas fa-trash text-red-500 text-2xl"></i>
            </div>
            <h3 class="text-theme font-semibold text-lg mb-2">删除主题</h3>
            <p class="text-theme-secondary text-sm mb-6">
              确定要删除「{{ deletingTheme?.name }}」吗？此操作无法撤销。
            </p>
            <div class="flex gap-3">
              <button
                class="flex-1 py-2 rounded-lg bg-theme-surface-variant text-theme"
                @click="deletingTheme = null"
              >
                取消
              </button>
              <button
                class="flex-1 py-2 rounded-lg bg-red-500 text-white"
                @click="confirmDelete"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 隐藏的文件输入 -->
    <input
      ref="fileInput"
      type="file"
      accept=".json"
      class="hidden"
      @change="handleFileSelect"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import { useTheme } from '@/composables/useTheme'
import type { Theme, DeviceAppearance } from '@/types/theme'

const {
  currentTheme,
  customThemes,
  themePreviews,
  applyTheme,
  setThemeById,
  addCustomTheme,
  updateCustomTheme,
  deleteCustomTheme,
  duplicateTheme,
  exportAllThemes,
  importAllThemes,
  resetToDefault,
} = useTheme()

// 状态
const showCreateDialog = ref(false)
const editingTheme = ref<Theme | null>(null)
const deletingTheme = ref<Theme | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

// 表单数据
const dialogForm = reactive({
  name: '',
  description: '',
  colors: {
    primary: '#007AFF',
    secondary: '#5856D6',
    background: '#F2F2F7',
    surface: '#FFFFFF',
    surfaceVariant: '#E5E5EA',
    text: '#000000',
    textSecondary: '#8E8E93',
    border: '#C7C7CC',
    success: '#34C759',
    warning: '#FF9500',
    error: '#FF3B30',
  },
  device: {
    frameColor: '#1C1C1E',
    notchStyle: 'dynamic-island' as DeviceAppearance['notchStyle'],
    borderRadius: 40,
    shadowIntensity: 'medium' as DeviceAppearance['shadowIntensity'],
  },
})

// 颜色标签映射
const colorLabels: Record<string, string> = {
  primary: '主色',
  secondary: '次色',
  background: '背景',
  surface: '卡片',
  surfaceVariant: '变体',
  text: '文字',
  textSecondary: '次文字',
  border: '边框',
  success: '成功',
  warning: '警告',
  error: '错误',
}

// 刘海样式选项
const notchStyles = [
  { value: 'dynamic-island' as const, label: '灵动岛' },
  { value: 'notch' as const, label: '刘海' },
  { value: 'pill' as const, label: '药丸' },
  { value: 'none' as const, label: '无' },
]

// 阴影强度选项
const shadowIntensities = [
  { value: 'none' as const, label: '无' },
  { value: 'light' as const, label: '轻' },
  { value: 'medium' as const, label: '中' },
  { value: 'heavy' as const, label: '重' },
]

// 预览颜色
const previewColors = computed(() => ({
  primary: currentTheme.value.colors.primary,
  secondary: currentTheme.value.colors.secondary,
  background: currentTheme.value.colors.background,
  surface: currentTheme.value.colors.surface,
  success: currentTheme.value.colors.success,
  warning: currentTheme.value.colors.warning,
  error: currentTheme.value.colors.error,
}))

// 应用主题（通过ID）
function applyThemeById(id: string) {
  setThemeById(id)
}

// 编辑自定义主题
function editCustomTheme(theme: Theme) {
  editingTheme.value = theme
  Object.assign(dialogForm, {
    name: theme.name,
    description: theme.description || '',
    colors: { ...theme.colors },
    device: { ...theme.device },
  })
}

// 确认删除主题
function confirmDeleteTheme(theme: Theme) {
  deletingTheme.value = theme
}

// 执行删除
function confirmDelete() {
  if (deletingTheme.value) {
    deleteCustomTheme(deletingTheme.value.id)
    deletingTheme.value = null
  }
}

// 关闭对话框
function closeDialog() {
  showCreateDialog.value = false
  editingTheme.value = null
  resetForm()
}

// 重置表单
function resetForm() {
  Object.assign(dialogForm, {
    name: '',
    description: '',
    colors: { ...currentTheme.value.colors },
    device: { ...currentTheme.value.device },
  })
}

// 保存主题
function saveTheme() {
  if (!dialogForm.name.trim()) {
    alert('请输入主题名称')
    return
  }

  if (editingTheme.value) {
    // 更新现有主题
    updateCustomTheme(editingTheme.value.id, {
      name: dialogForm.name,
      description: dialogForm.description,
      colors: { ...dialogForm.colors },
      device: { ...dialogForm.device },
    })
  } else {
    // 创建新主题
    const newTheme = addCustomTheme({
      name: dialogForm.name,
      description: dialogForm.description,
      colors: { ...dialogForm.colors },
      device: { ...dialogForm.device },
      wallpapers: { ...currentTheme.value.wallpapers },
      typography: { ...currentTheme.value.typography },
    })
    // 应用新创建的主题
    applyTheme(newTheme)
  }

  closeDialog()
}

// 导出主题
function handleExport() {
  const json = exportAllThemes()
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `phone-themes-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

// 导入主题
function handleImport() {
  fileInput.value?.click()
}

// 处理文件选择
async function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  try {
    const text = await file.text()
    const success = importAllThemes(text)
    if (success) {
      alert('主题导入成功！')
    } else {
      alert('导入失败，请检查文件格式')
    }
  } catch (error) {
    console.error('导入主题失败:', error)
    alert('导入失败，请检查文件格式')
  }

  // 清空输入
  input.value = ''
}

// 初始化表单为当前主题的颜色
resetForm()
</script>

<style scoped>
/* 主题编辑器容器 */
.theme-editor {
  background-color: var(--color-background);
  transition: background-color 0.3s ease;
}

/* 标题文字 */
.text-theme {
  color: var(--color-text);
}

.text-theme-secondary {
  color: var(--color-text-secondary);
}

.text-theme-primary {
  color: var(--color-primary);
}

.text-theme-error {
  color: var(--color-error);
}

/* 卡片样式 */
.card-theme {
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  transition: background-color 0.3s ease, border-color 0.3s ease;
}

/* 主题预设卡片 */
.theme-preset-card {
  border: 2px solid transparent;
  background-color: var(--color-surface);
  transition: all 0.2s ease;
}

.theme-preset-card:hover {
  border-color: var(--color-border);
}

/* 背景色类 */
.bg-theme-primary {
  background-color: var(--color-primary);
}

.bg-theme-secondary {
  background-color: var(--color-secondary);
}

.bg-theme-success {
  background-color: var(--color-success);
}

.bg-theme-warning {
  background-color: var(--color-warning);
}

.bg-theme-error {
  background-color: var(--color-error);
}

.bg-theme-surface-variant {
  background-color: var(--color-surface-variant);
}

/* 输入框样式 */
.input-theme {
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.input-theme:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1);
  outline: none;
}

.input-theme::placeholder {
  color: var(--color-text-secondary);
}

/* 边框样式 */
.border-theme {
  border-color: var(--color-border);
}

/* 模态框覆盖层 */
.modal-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 9200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.modal-content {
  background-color: var(--color-surface);
  border-radius: 1rem;
  width: 100%;
  max-width: 24rem;
  overflow: hidden;
  animation: zoomIn 0.3s ease-out;
}

@keyframes zoomIn {
  0% {
    transform: scale(0.8);
    opacity: 0;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

/* 颜色选择器 */
input[type="color"] {
  -webkit-appearance: none;
  border: none;
  padding: 0;
  cursor: pointer;
}

input[type="color"]::-webkit-color-swatch-wrapper {
  padding: 0;
}

input[type="color"]::-webkit-color-swatch {
  border: 2px solid var(--color-border);
  border-radius: 6px;
}

/* 范围滑块 */
input[type="range"] {
  -webkit-appearance: none;
  height: 6px;
  border-radius: 3px;
  background: var(--color-surface-variant);
}

input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--color-primary);
  cursor: pointer;
}

/* 应用头部样式覆盖 */
.app-header {
  background-color: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}

.app-header h3 {
  color: var(--color-text);
}

.app-back-btn {
  color: var(--color-primary);
}

.app-back-btn:hover {
  background-color: var(--color-surface-variant);
}
</style>