<script setup lang="ts">
import { ref, watch, computed, toRaw } from 'vue';
import { useAccountStore } from '@/stores/accountStore';
import type { FullProfile } from '@/types/account';

const props = defineProps<{
  visible: boolean;
  profile: FullProfile | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'updated'): void;
}>();

const accountStore = useAccountStore();

// 粉丝数
const followersCount = ref(0);
const followersInput = ref('');
const isSubmitting = ref(false);
const errorMessage = ref('');

// 快捷选项
const quickOptions = [
  { label: '1000', value: 1000 },
  { label: '1万', value: 10000 },
  { label: '10万', value: 100000 },
  { label: '50万', value: 500000 },
  { label: '100万', value: 1000000 },
  { label: '500万', value: 5000000 },
];

// 格式化显示 - 直接基于输入值计算，确保实时更新
const formattedFollowers = computed(() => {
  // 直接从输入框解析数字，确保实时响应
  const inputNum = parseInt(followersInput.value.replace(/[^0-9]/g, ''), 10);
  const num = !isNaN(inputNum) ? Math.min(inputNum, 100000000) : 0;
  
  if (num >= 100000000) {
    return (num / 100000000).toFixed(1) + '亿';
  }
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + '万';
  }
  return num.toString();
});

// 验证输入
const isValid = computed(() => {
  return followersCount.value >= 0 && followersCount.value <= 100000000;
});

// 初始化表单
function initFormData() {
  if (props.profile) {
    const platformData = props.profile.account.platformData || {};
    followersCount.value = (platformData.followers as number) || 0;
    followersInput.value = followersCount.value.toString();
  }
}

// 监听输入变化，同步到 followersCount（用于提交和快捷按钮高亮）
watch(
  followersInput,
  (newVal) => {
    const num = parseInt(newVal.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(num)) {
      followersCount.value = Math.min(num, 100000000);
    } else {
      followersCount.value = 0;
    }
  },
  { flush: 'sync' } // 同步执行，确保立即更新
);

// 设置快捷值
function setQuickValue(value: number) {
  followersCount.value = value;
  followersInput.value = value.toString();
}

// 增减粉丝数
function adjustFollowers(delta: number) {
  const newValue = Math.max(0, Math.min(100000000, followersCount.value + delta));
  followersCount.value = newValue;
  followersInput.value = newValue.toString();
}

// 提交
async function handleSubmit() {
  if (!isValid.value || isSubmitting.value || !props.profile) return;

  isSubmitting.value = true;
  errorMessage.value = '';

  try {
    const { account } = props.profile;
    const { accountService } = await import('@/services/account/accountService');

    // 使用 JSON 序列化/反序列化来去除 Vue 响应式代理，避免 IndexedDB 序列化错误
    const rawPlatformData = JSON.parse(JSON.stringify(toRaw(account.platformData) || {}));
    const updatedPlatformData = {
      ...rawPlatformData,
      followers: followersCount.value,
    };

    await accountService.updatePlatformAccount(account.id, {
      platformData: updatedPlatformData,
    });

    emit('updated');
  } catch (error: any) {
    console.error('Failed to update followers:', error);
    errorMessage.value = error.message || '更新失败，请重试';
  } finally {
    isSubmitting.value = false;
  }
}

function handleClose() {
  if (!isSubmitting.value) {
    emit('close');
  }
}

// 弹窗打开时初始化
watch(
  () => props.visible,
  (newVal) => {
    if (newVal) {
      initFormData();
      errorMessage.value = '';
    }
  }
);
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="visible"
        class="fixed inset-0 z-[99999] flex items-center justify-center"
      >
        <!-- 遮罩 -->
        <div class="absolute inset-0 bg-black/50" @click="handleClose" />

        <!-- 弹窗内容 -->
        <div
          class="relative w-[85%] max-w-sm bg-white rounded-2xl overflow-hidden shadow-xl"
        >
          <!-- 头部 -->
          <div class="px-5 py-4 border-b border-gray-100">
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-bold text-gray-800">修改粉丝数</h3>
              <button
                @click="handleClose"
                class="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600"
                :disabled="isSubmitting"
              >
                <i class="fas fa-times"></i>
              </button>
            </div>
          </div>

          <!-- 内容 -->
          <div class="px-5 py-4">
            <!-- 当前粉丝数显示 -->
            <div class="text-center mb-4">
              <div class="text-4xl font-bold text-orange-500">
                {{ formattedFollowers }}
              </div>
              <div class="text-sm text-gray-400 mt-1">粉丝</div>
            </div>

            <!-- 输入框 -->
            <div class="mb-4">
              <label class="block text-xs text-gray-500 mb-1">输入粉丝数</label>
              <div class="flex items-center gap-2">
                <button
                  @click="adjustFollowers(-1000)"
                  class="w-10 h-10 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors flex items-center justify-center"
                  :disabled="isSubmitting"
                >
                  <i class="fas fa-minus"></i>
                </button>
                <input
                  v-model="followersInput"
                  type="text"
                  inputmode="numeric"
                  placeholder="0"
                  class="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-center text-lg font-medium focus:outline-none focus:border-orange-400 focus:bg-white transition-colors"
                  :disabled="isSubmitting"
                />
                <button
                  @click="adjustFollowers(1000)"
                  class="w-10 h-10 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors flex items-center justify-center"
                  :disabled="isSubmitting"
                >
                  <i class="fas fa-plus"></i>
                </button>
              </div>
            </div>

            <!-- 快捷选项 -->
            <div class="mb-4">
              <label class="block text-xs text-gray-500 mb-2">快捷设置</label>
              <div class="grid grid-cols-3 gap-2">
                <button
                  v-for="option in quickOptions"
                  :key="option.value"
                  @click="setQuickValue(option.value)"
                  :class="[
                    'py-2 rounded-lg text-sm transition-colors',
                    followersCount === option.value
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                  ]"
                  :disabled="isSubmitting"
                >
                  {{ option.label }}
                </button>
              </div>
            </div>

            <!-- 提示 -->
            <div class="mb-4 p-3 bg-orange-50 rounded-lg">
              <div class="flex items-start gap-2">
                <i class="fas fa-lightbulb text-orange-400 mt-0.5"></i>
                <p class="text-xs text-orange-600">
                  设定你的账号粉丝数，AI会根据你的影响力生成不同风格的互动内容。大V和素人收到的评论画风可不一样哦~
                </p>
              </div>
            </div>

            <!-- 错误提示 -->
            <div v-if="errorMessage" class="mb-3 text-center text-sm text-red-500">
              {{ errorMessage }}
            </div>

            <!-- 按钮 -->
            <div class="flex gap-3">
              <button
                @click="handleClose"
                class="flex-1 py-3 rounded-full text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                :disabled="isSubmitting"
              >
                取消
              </button>
              <button
                @click="handleSubmit"
                :disabled="!isValid || isSubmitting"
                :class="[
                  'flex-1 py-3 rounded-full text-sm font-medium transition-all',
                  isValid && !isSubmitting
                    ? 'bg-orange-500 text-white hover:bg-orange-600'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed',
                ]"
              >
                <span v-if="isSubmitting">
                  <i class="fas fa-spinner fa-spin mr-2"></i>保存中...
                </span>
                <span v-else>确定</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
