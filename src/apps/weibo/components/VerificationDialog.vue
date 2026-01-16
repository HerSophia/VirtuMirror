<script setup lang="ts">
import { ref, watch, computed, toRaw } from 'vue';
import type { FullProfile } from '@/types/account';
import {
  type WeiboVerifyType,
  type VerifyTypeConfig,
  VERIFY_TYPE_CONFIGS,
  getVerifyTypeConfig,
} from '../types';

const props = defineProps<{
  visible: boolean;
  profile: FullProfile | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'updated'): void;
}>();

// 状态
const isSubmitting = ref(false);
const errorMessage = ref('');
const currentStep = ref<'select' | 'confirm'>('select');

// 表单数据
const selectedType = ref<WeiboVerifyType | null>(null);
const verifyDescription = ref('');

// 当前认证信息
const currentVerification = computed(() => {
  if (!props.profile?.account.platformData?.verified) return null;
  const type = props.profile.account.platformData.verifyType as WeiboVerifyType;
  if (!type) return null;
  return {
    type,
    config: getVerifyTypeConfig(type),
    description: props.profile.account.platformData.verifyDescription as string,
  };
});

// 按分类分组的认证类型
const verifyTypesByCategory = computed(() => {
  const categories = [
    { key: 'personal', label: '个人认证', icon: 'fa-user' },
    { key: 'org', label: '机构认证', icon: 'fa-building' },
    { key: 'special', label: '特殊认证', icon: 'fa-crown' },
  ];

  return categories.map((cat) => ({
    ...cat,
    items: VERIFY_TYPE_CONFIGS.filter((c) => c.category === cat.key),
  }));
});

// 选中的认证类型配置
const selectedConfig = computed(() => {
  if (!selectedType.value) return null;
  return getVerifyTypeConfig(selectedType.value);
});

// 初始化表单
function initFormData() {
  if (props.profile) {
    const platformData = props.profile.account.platformData || {};
    if (platformData.verified && platformData.verifyType) {
      selectedType.value = platformData.verifyType as WeiboVerifyType;
      verifyDescription.value = (platformData.verifyDescription as string) || '';
    } else {
      selectedType.value = null;
      verifyDescription.value = '';
    }
  }
  currentStep.value = 'select';
}

// 选择认证类型
function selectType(type: WeiboVerifyType) {
  selectedType.value = type;
  // 自动填充默认描述
  const config = getVerifyTypeConfig(type);
  if (config && !verifyDescription.value) {
    verifyDescription.value = config.description;
  }
}

// 进入确认步骤
function goToConfirm() {
  if (!selectedType.value) return;
  currentStep.value = 'confirm';
}

// 返回选择步骤
function goBackToSelect() {
  currentStep.value = 'select';
}

// 提交认证
async function handleSubmit() {
  if (!selectedType.value || isSubmitting.value || !props.profile) return;

  isSubmitting.value = true;
  errorMessage.value = '';

  try {
    const { account } = props.profile;
    const { accountService } = await import('@/services/account/accountService');

    // 使用 JSON 序列化/反序列化来去除 Vue 响应式代理，避免 IndexedDB 序列化错误
    const rawPlatformData = JSON.parse(JSON.stringify(toRaw(account.platformData) || {}));
    const updatedPlatformData = {
      ...rawPlatformData,
      verified: true,
      verifyType: selectedType.value,
      verifyDescription: verifyDescription.value.trim() || undefined,
    };

    await accountService.updatePlatformAccount(account.id, {
      platformData: updatedPlatformData,
    });

    emit('updated');
  } catch (error: any) {
    console.error('Failed to update verification:', error);
    errorMessage.value = error.message || '认证失败，请重试';
  } finally {
    isSubmitting.value = false;
  }
}

// 取消认证
async function handleCancelVerification() {
  if (isSubmitting.value || !props.profile) return;

  if (!confirm('确定要取消认证吗？取消后需要重新申请。')) {
    return;
  }

  isSubmitting.value = true;
  errorMessage.value = '';

  try {
    const { account } = props.profile;
    const { accountService } = await import('@/services/account/accountService');

    // 使用 JSON 序列化/反序列化来去除 Vue 响应式代理
    const rawPlatformData = JSON.parse(JSON.stringify(toRaw(account.platformData) || {}));
    const updatedPlatformData = {
      ...rawPlatformData,
      verified: false,
      verifyType: undefined,
      verifyDescription: undefined,
    };

    await accountService.updatePlatformAccount(account.id, {
      platformData: updatedPlatformData,
    });

    selectedType.value = null;
    verifyDescription.value = '';
    emit('updated');
  } catch (error: any) {
    console.error('Failed to cancel verification:', error);
    errorMessage.value = error.message || '取消认证失败，请重试';
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
          class="relative w-[90%] max-w-md bg-white rounded-2xl overflow-hidden shadow-xl max-h-[85vh] flex flex-col"
        >
          <!-- 头部 -->
          <div class="px-5 py-4 border-b border-gray-100 flex-shrink-0">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <button
                  v-if="currentStep === 'confirm'"
                  @click="goBackToSelect"
                  class="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600"
                >
                  <i class="fas fa-arrow-left"></i>
                </button>
                <h3 class="text-lg font-bold text-gray-800">
                  {{ currentStep === 'select' ? '账号认证' : '确认认证信息' }}
                </h3>
              </div>
              <button
                @click="handleClose"
                class="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600"
                :disabled="isSubmitting"
              >
                <i class="fas fa-times"></i>
              </button>
            </div>
          </div>

          <!-- 内容区域 -->
          <div class="flex-1 overflow-y-auto">
            <!-- 当前认证状态 -->
            <div
              v-if="currentVerification && currentStep === 'select'"
              class="px-5 py-4 bg-orange-50 border-b border-orange-100"
            >
              <div class="flex items-center gap-3">
                <div
                  class="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center"
                >
                  <i class="fas fa-check text-white"></i>
                </div>
                <div class="flex-1">
                  <div class="flex items-center gap-2">
                    <span class="font-medium text-gray-800">
                      {{ currentVerification.config?.label || '已认证' }}
                    </span>
                    <i
                      :class="[
                        'fas',
                        currentVerification.config?.icon || 'fa-check-circle',
                        currentVerification.config?.color || 'text-orange-500',
                      ]"
                    ></i>
                  </div>
                  <p class="text-sm text-gray-500">
                    {{ currentVerification.description || '微博认证用户' }}
                  </p>
                </div>
                <button
                  @click="handleCancelVerification"
                  class="px-3 py-1.5 text-sm text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  :disabled="isSubmitting"
                >
                  取消认证
                </button>
              </div>
            </div>

            <!-- 选择认证类型 -->
            <div v-if="currentStep === 'select'" class="px-5 py-4">
              <p class="text-sm text-gray-500 mb-4">
                选择适合你的认证类型，成为微博大V，获得更多曝光和信任。
              </p>

              <!-- 分类列表 -->
              <div
                v-for="category in verifyTypesByCategory"
                :key="category.key"
                class="mb-4"
              >
                <div class="flex items-center gap-2 mb-2">
                  <i :class="['fas', category.icon, 'text-gray-400 text-sm']"></i>
                  <span class="text-sm font-medium text-gray-600">
                    {{ category.label }}
                  </span>
                </div>

                <div class="grid grid-cols-2 gap-2">
                  <button
                    v-for="item in category.items"
                    :key="item.value"
                    @click="selectType(item.value)"
                    :class="[
                      'p-3 rounded-xl border-2 transition-all text-left',
                      selectedType === item.value
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50',
                    ]"
                  >
                    <div class="flex items-center gap-2 mb-1">
                      <i :class="['fas', item.icon, item.color]"></i>
                      <span class="text-sm font-medium text-gray-800">
                        {{ item.label }}
                      </span>
                    </div>
                    <p class="text-xs text-gray-400 line-clamp-2">
                      {{ item.description }}
                    </p>
                  </button>
                </div>
              </div>

              <!-- 下一步按钮 -->
              <button
                @click="goToConfirm"
                :disabled="!selectedType"
                :class="[
                  'w-full py-3 rounded-full text-sm font-medium transition-all mt-4',
                  selectedType
                    ? 'bg-orange-500 text-white hover:bg-orange-600'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed',
                ]"
              >
                下一步
              </button>
            </div>

            <!-- 确认认证信息 -->
            <div v-if="currentStep === 'confirm'" class="px-5 py-4">
              <!-- 选中的认证类型 -->
              <div
                v-if="selectedConfig"
                class="p-4 bg-gradient-to-r from-orange-50 to-red-50 rounded-xl mb-4"
              >
                <div class="flex items-center gap-3">
                  <div
                    :class="[
                      'w-12 h-12 rounded-full flex items-center justify-center',
                      selectedConfig.category === 'org'
                        ? 'bg-blue-500'
                        : 'bg-orange-500',
                    ]"
                  >
                    <i :class="['fas', selectedConfig.icon, 'text-white text-lg']"></i>
                  </div>
                  <div>
                    <div class="font-bold text-gray-800">
                      {{ selectedConfig.label }}
                    </div>
                    <p class="text-sm text-gray-500">
                      {{ selectedConfig.description }}
                    </p>
                  </div>
                </div>
              </div>

              <!-- 认证描述输入 -->
              <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  认证说明
                </label>
                <textarea
                  v-model="verifyDescription"
                  placeholder="例如：知名演员、XX公司CEO、著名作家..."
                  maxlength="50"
                  rows="2"
                  class="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-orange-400 focus:bg-white transition-colors resize-none"
                  :disabled="isSubmitting"
                />
                <div class="text-right text-xs text-gray-400 mt-1">
                  {{ verifyDescription.length }}/50
                </div>
              </div>

              <!-- 认证效果预览 -->
              <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-2">
                  认证效果预览
                </label>
                <div class="p-4 bg-gray-50 rounded-xl">
                  <div class="flex items-center gap-3">
                    <img
                      :src="
                        profile?.avatar ||
                        'https://api.dicebear.com/7.x/avataaars/svg?seed=preview'
                      "
                      class="w-12 h-12 rounded-full"
                      alt="头像"
                    />
                    <div>
                      <div class="flex items-center gap-2">
                        <span class="font-medium text-gray-800">
                          {{ profile?.displayName || '用户昵称' }}
                        </span>
                        <div
                          :class="[
                            'w-4 h-4 rounded-full flex items-center justify-center',
                            selectedConfig?.category === 'org'
                              ? 'bg-blue-500'
                              : 'bg-orange-500',
                          ]"
                        >
                          <i class="fas fa-check text-white text-[8px]"></i>
                        </div>
                      </div>
                      <p class="text-sm text-gray-500">
                        {{ verifyDescription || selectedConfig?.description }}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 提示 -->
              <div class="mb-4 p-3 bg-blue-50 rounded-lg">
                <div class="flex items-start gap-2">
                  <i class="fas fa-info-circle text-blue-400 mt-0.5"></i>
                  <p class="text-xs text-blue-600">
                    认证后你的账号将显示认证标识，发布的内容更容易获得关注。这是模拟认证，无需提交真实材料。
                  </p>
                </div>
              </div>

              <!-- 错误提示 -->
              <div v-if="errorMessage" class="mb-3 text-center text-sm text-red-500">
                {{ errorMessage }}
              </div>

              <!-- 提交按钮 -->
              <button
                @click="handleSubmit"
                :disabled="isSubmitting"
                :class="[
                  'w-full py-3 rounded-full text-sm font-medium transition-all',
                  !isSubmitting
                    ? 'bg-orange-500 text-white hover:bg-orange-600'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed',
                ]"
              >
                <span v-if="isSubmitting">
                  <i class="fas fa-spinner fa-spin mr-2"></i>认证中...
                </span>
                <span v-else>
                  <i class="fas fa-check-circle mr-2"></i>立即认证
                </span>
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

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
