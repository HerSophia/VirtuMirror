<script setup lang="ts">
/**
 * 通用创建账号弹窗
 * 
 * 可被各平台 App 复用，支持完整的用户画像配置
 * 
 * @example
 * <CreateAccountDialog
 *   :visible="showDialog"
 *   platform-id="weibo"
 *   platform-name="微博"
 *   :theme-color="'#E6162D'"
 *   :missing-info="missingAccountInfo"
 *   @close="showDialog = false"
 *   @created="handleCreated"
 * />
 */
import { ref, computed, watch } from 'vue';
import { useAccountStore } from '@/stores/accountStore';
import { userPool } from '@/services/account/userPool';
import type { 
  MissingAccountInfo, 
  InterestDomain, 
  AgeRange, 
  CharacterProfile,
  AccountScope,
  PlatformAccount,
} from '@/types/account';

const props = withDefaults(defineProps<{
  visible: boolean;
  platformId: string;
  platformName: string;
  themeColor?: string;
  missingInfo?: MissingAccountInfo | null;
  /** 是否显示作用域选择（默认显示） */
  showScopeSelector?: boolean;
  /** 默认作用域 */
  defaultScope?: AccountScope;
}>(), {
  themeColor: '#3B82F6',
  showScopeSelector: true,
  defaultScope: 'character',
});

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'created', account: PlatformAccount): void;
}>();

const accountStore = useAccountStore();

// 表单数据
const formData = ref({
  nickname: '',
  handle: '',
  bio: '',
  tagline: '',
  occupation: '',
  location: '',
  ageRange: 'adult' as AgeRange,
  interests: [] as InterestDomain[],
  scope: props.defaultScope as AccountScope,
});

const isSubmitting = ref(false);
const errorMessage = ref('');
const showAdvanced = ref(false);

// 预设头像（使用 DiceBear 生成）
const avatarOptions = computed(() => {
  const seed = props.platformId;
  return [
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}1`,
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}2`,
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}3`,
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}4`,
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}5`,
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}6`,
  ];
});

const selectedAvatar = ref('');

// 年龄段选项
const ageRangeOptions: { value: AgeRange; label: string }[] = [
  { value: 'teen', label: '13-17岁' },
  { value: 'young', label: '18-24岁' },
  { value: 'adult', label: '25-34岁' },
  { value: 'middle', label: '35-44岁' },
  { value: 'mature', label: '45-54岁' },
  { value: 'senior', label: '55岁以上' },
];

// 兴趣领域选项
const interestOptions: { value: InterestDomain; label: string; icon: string }[] = [
  { value: 'tech', label: '科技', icon: '💻' },
  { value: 'entertainment', label: '娱乐', icon: '🎬' },
  { value: 'gaming', label: '游戏', icon: '🎮' },
  { value: 'anime', label: '动漫', icon: '🎌' },
  { value: 'food', label: '美食', icon: '🍜' },
  { value: 'travel', label: '旅行', icon: '✈️' },
  { value: 'fashion', label: '时尚', icon: '👗' },
  { value: 'fitness', label: '健身', icon: '💪' },
  { value: 'finance', label: '财经', icon: '📈' },
  { value: 'education', label: '教育', icon: '📚' },
  { value: 'news', label: '时事', icon: '📰' },
  { value: 'life', label: '生活', icon: '🏠' },
  { value: 'art', label: '艺术', icon: '🎨' },
  { value: 'pet', label: '宠物', icon: '🐱' },
  { value: 'car', label: '汽车', icon: '🚗' },
];

// 职业预设
const occupationOptions = [
  '程序员', '产品经理', '设计师', '学生', '教师', 
  '医生', '自由职业', '创业者', '公务员', '其他',
];

// 地点预设
const locationOptions = [
  '北京', '上海', '广州', '深圳', '杭州', '成都', 
  '武汉', '西安', '南京', '重庆', '其他',
];

// 作用域选项
const scopeOptions = computed(() => {
  const characterCardName = accountStore.sessionContext?.characterCardId || '当前角色卡';
  return [
    {
      value: 'character' as AccountScope,
      icon: '🏷️',
      title: '角色卡级',
      desc: `仅在「${characterCardName}」相关的聊天中可见`,
    },
    {
      value: 'global' as AccountScope,
      icon: '🌐',
      title: '全局',
      desc: '所有聊天中都可见（如测试账号）',
    },
    {
      value: 'session' as AccountScope,
      icon: '📍',
      title: '会话级',
      desc: '仅在当前聊天会话中可见',
    },
  ];
});

// 验证
const isValid = computed(() => {
  return formData.value.nickname.trim().length >= 2 && 
         formData.value.nickname.trim().length <= 20;
});

// 生成随机 handle
function generateHandle(): string {
  const randomNum = Math.floor(Math.random() * 1000000);
  return `user_${randomNum}`;
}

// 切换兴趣
function toggleInterest(interest: InterestDomain) {
  const index = formData.value.interests.indexOf(interest);
  if (index === -1) {
    if (formData.value.interests.length < 5) {
      formData.value.interests.push(interest);
    }
  } else {
    formData.value.interests.splice(index, 1);
  }
}

// 随机生成资料
function randomizeProfile() {
  const profile = userPool.generateRichProfile({ platform: props.platformId });
  
  formData.value.nickname = profile.displayName;
  formData.value.bio = profile.bio || '';
  formData.value.tagline = profile.tagline || '';
  
  if (profile.profile) {
    formData.value.occupation = profile.profile.occupation || '';
    formData.value.location = profile.profile.location || '';
    formData.value.ageRange = profile.profile.ageRange || 'adult';
    formData.value.interests = profile.profile.interests.slice(0, 5);
  }
  
  // 随机选择头像
  selectedAvatar.value = avatarOptions.value[Math.floor(Math.random() * avatarOptions.value.length)];
}

// 提交
async function handleSubmit() {
  if (!isValid.value || isSubmitting.value) return;
  
  isSubmitting.value = true;
  errorMessage.value = '';
  
  try {
    // 获取玩家实体
    const player = accountStore.currentPlayer;
    if (!player) {
      throw new Error('Player entity not found');
    }
    
    // 生成 handle（如果未填写）
    const handle = formData.value.handle.trim() || generateHandle();
    
    // 构建画像数据 - 使用展开运算符创建普通数组，避免 IndexedDB 序列化问题
    const characterProfile: CharacterProfile = {
      ageRange: formData.value.ageRange,
      occupation: formData.value.occupation || undefined,
      location: formData.value.location || undefined,
      interests: [...formData.value.interests],
      activityLevel: 'medium',
      influenceLevel: 'nobody',
      tags: [],
    };
    
    // 更新玩家实体的画像
    await accountStore.updateEntity(player.id, {
      tagline: formData.value.tagline || undefined,
      profile: characterProfile,
    });
    
    // 确定作用域相关字段
    const scopeFields: {
      scope: AccountScope;
      scopeSessionId?: string;
      scopeCharacterCardId?: string;
    } = {
      scope: formData.value.scope,
    };
    
    if (formData.value.scope === 'session') {
      scopeFields.scopeSessionId = accountStore.sessionContext?.sessionId;
    } else if (formData.value.scope === 'character') {
      scopeFields.scopeCharacterCardId = props.missingInfo?.context.characterCardId 
        || accountStore.sessionContext?.characterCardId;
    }
    
    // 创建平台账号
    const account = await accountStore.createPlatformAccount(
      player.id,
      props.platformId,
      {
        nickname: formData.value.nickname.trim(),
        handle: handle,
        bioOverride: formData.value.bio.trim() || undefined,
        avatarOverride: selectedAvatar.value || undefined,
        ...scopeFields,
        platformData: {
          followers: 0,
          following: 0,
          verified: false,
          postsCount: 0,
          contentDomains: [...formData.value.interests],
          accountTags: [],
        },
      }
    );
    
    emit('created', account);
  } catch (error: any) {
    console.error('Failed to create account:', error);
    errorMessage.value = error.message || '创建失败，请重试';
  } finally {
    isSubmitting.value = false;
  }
}

function handleClose() {
  if (!isSubmitting.value) {
    emit('close');
  }
}

// 重置表单
function resetForm() {
  formData.value = {
    nickname: '',
    handle: '',
    bio: '',
    tagline: '',
    occupation: '',
    location: '',
    ageRange: 'adult',
    interests: [],
    scope: props.defaultScope,
  };
  selectedAvatar.value = avatarOptions.value[0];
  errorMessage.value = '';
  showAdvanced.value = false;
}

// 弹窗打开时重置表单
watch(() => props.visible, (newVal) => {
  if (newVal) {
    resetForm();
  }
});

// 监听默认作用域变化
watch(() => props.defaultScope, (newVal) => {
  formData.value.scope = newVal;
});
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div 
        v-if="visible" 
        class="fixed inset-0 z-[99999] flex items-center justify-center"
      >
        <!-- 遮罩 -->
        <div 
          class="absolute inset-0 bg-black/50"
          @click="handleClose"
        />
        
        <!-- 弹窗内容 -->
        <div class="relative w-[90%] max-w-sm bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-xl max-h-[85vh] flex flex-col">
          <!-- 头部 -->
          <div 
            class="relative h-24 flex-shrink-0"
            :style="{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}dd)` }"
          >
            <button 
              @click="handleClose"
              class="absolute top-3 right-3 w-8 h-8 flex items-center justify-center text-white/80 hover:text-white"
              :disabled="isSubmitting"
            >
              <i class="fas fa-times text-lg"></i>
            </button>
            <!-- 随机生成按钮 -->
            <button 
              @click="randomizeProfile"
              class="absolute top-3 left-3 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-full text-white text-xs flex items-center gap-1 transition-colors"
              :disabled="isSubmitting"
            >
              <i class="fas fa-dice"></i>
              随机生成
            </button>
            <div class="absolute -bottom-10 left-1/2 -translate-x-1/2">
              <div class="relative">
                <img
                  :src="selectedAvatar || avatarOptions[0]"
                  class="w-20 h-20 rounded-full border-4 border-white dark:border-gray-800 bg-white"
                  alt="选择头像"
                />
                <div 
                  class="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center cursor-pointer"
                  :style="{ backgroundColor: themeColor }"
                >
                  <i class="fas fa-camera text-white text-xs"></i>
                </div>
              </div>
            </div>
          </div>
          
          <!-- 表单（可滚动） -->
          <div class="pt-14 px-5 pb-5 overflow-y-auto flex-1">
            <h3 class="text-center text-lg font-bold text-gray-800 dark:text-gray-100 mb-1">
              创建{{ platformName }}账号
            </h3>
            <p class="text-center text-sm text-gray-500 dark:text-gray-400 mb-4">
              设置你在这个世界的{{ platformName }}身份
            </p>
            
            <!-- 头像选择 -->
            <div class="mb-4">
              <label class="block text-xs text-gray-500 dark:text-gray-400 mb-2">选择头像</label>
              <div class="flex gap-2 overflow-x-auto pb-2">
                <div
                  v-for="avatar in avatarOptions"
                  :key="avatar"
                  @click="selectedAvatar = avatar"
                  :class="[
                    'w-10 h-10 rounded-full flex-shrink-0 cursor-pointer border-2 transition-all',
                    selectedAvatar === avatar ? 'scale-110' : 'border-transparent'
                  ]"
                  :style="selectedAvatar === avatar ? { borderColor: themeColor } : {}"
                >
                  <img :src="avatar" class="w-full h-full rounded-full" />
                </div>
              </div>
            </div>
            
            <!-- 昵称 -->
            <div class="mb-3">
              <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">昵称 *</label>
              <input
                v-model="formData.nickname"
                type="text"
                placeholder="2-20个字符"
                maxlength="20"
                class="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:bg-white dark:focus:bg-gray-600 transition-colors"
                :style="{ '--tw-ring-color': themeColor }"
                :disabled="isSubmitting"
              />
            </div>
            
            <!-- 一句话标语 -->
            <div class="mb-3">
              <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">一句话介绍</label>
              <input
                v-model="formData.tagline"
                type="text"
                placeholder="例如：热爱生活的北漂程序员"
                maxlength="30"
                class="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:bg-white dark:focus:bg-gray-600 transition-colors"
                :disabled="isSubmitting"
              />
            </div>
            
            <!-- 用户名 -->
            <div class="mb-3">
              <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">用户名（选填）</label>
              <div class="flex items-center">
                <span class="text-gray-400 text-sm mr-1">@</span>
                <input
                  v-model="formData.handle"
                  type="text"
                  placeholder="留空将自动生成"
                  maxlength="30"
                  class="flex-1 px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:bg-white dark:focus:bg-gray-600 transition-colors"
                  :disabled="isSubmitting"
                />
              </div>
            </div>
            
            <!-- 简介 -->
            <div class="mb-4">
              <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">简介（选填）</label>
              <textarea
                v-model="formData.bio"
                placeholder="介绍一下自己吧"
                maxlength="100"
                rows="2"
                class="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:bg-white dark:focus:bg-gray-600 transition-colors resize-none"
                :disabled="isSubmitting"
              />
            </div>
            
            <!-- 作用域选择 -->
            <div v-if="showScopeSelector" class="mb-4">
              <label class="block text-xs text-gray-500 dark:text-gray-400 mb-2">账号作用域</label>
              <div class="space-y-2">
                <label
                  v-for="option in scopeOptions"
                  :key="option.value"
                  :class="[
                    'flex items-start gap-3 p-3 rounded-xl cursor-pointer border-2 transition-all',
                    formData.scope === option.value 
                      ? 'bg-opacity-5' 
                      : 'border-transparent bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600'
                  ]"
                  :style="formData.scope === option.value ? { borderColor: themeColor, backgroundColor: `${themeColor}10` } : {}"
                >
                  <input
                    v-model="formData.scope"
                    type="radio"
                    :value="option.value"
                    class="mt-1 w-4 h-4"
                    :style="{ accentColor: themeColor }"
                  />
                  <div class="flex flex-col gap-0.5">
                    <span class="font-medium text-sm text-gray-800 dark:text-gray-100">
                      {{ option.icon }} {{ option.title }}
                    </span>
                    <span class="text-xs text-gray-500 dark:text-gray-400">
                      {{ option.desc }}
                    </span>
                  </div>
                </label>
              </div>
            </div>
            
            <!-- 高级选项折叠 -->
            <div class="mb-4">
              <button
                @click="showAdvanced = !showAdvanced"
                class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <i :class="['fas fa-chevron-right transition-transform', showAdvanced ? 'rotate-90' : '']"></i>
                更多设置（画像信息）
              </button>
              
              <Transition name="slide">
                <div v-if="showAdvanced" class="mt-3 space-y-3">
                  <!-- 职业 -->
                  <div>
                    <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">职业</label>
                    <select
                      v-model="formData.occupation"
                      class="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:bg-white dark:focus:bg-gray-600 transition-colors"
                      :disabled="isSubmitting"
                    >
                      <option value="">请选择</option>
                      <option v-for="occ in occupationOptions" :key="occ" :value="occ">
                        {{ occ }}
                      </option>
                    </select>
                  </div>
                  
                  <!-- 所在地 -->
                  <div>
                    <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">所在地</label>
                    <select
                      v-model="formData.location"
                      class="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:bg-white dark:focus:bg-gray-600 transition-colors"
                      :disabled="isSubmitting"
                    >
                      <option value="">请选择</option>
                      <option v-for="loc in locationOptions" :key="loc" :value="loc">
                        {{ loc }}
                      </option>
                    </select>
                  </div>
                  
                  <!-- 年龄段 -->
                  <div>
                    <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">年龄段</label>
                    <div class="flex flex-wrap gap-2">
                      <button
                        v-for="option in ageRangeOptions"
                        :key="option.value"
                        @click="formData.ageRange = option.value"
                        :class="[
                          'px-3 py-1.5 rounded-full text-xs transition-colors',
                          formData.ageRange === option.value
                            ? 'text-white'
                            : 'bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-500'
                        ]"
                        :style="formData.ageRange === option.value ? { backgroundColor: themeColor } : {}"
                        :disabled="isSubmitting"
                      >
                        {{ option.label }}
                      </button>
                    </div>
                  </div>
                  
                  <!-- 兴趣领域 -->
                  <div>
                    <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                      兴趣领域（最多5个）
                      <span :style="{ color: themeColor }">{{ formData.interests.length }}/5</span>
                    </label>
                    <div class="flex flex-wrap gap-2">
                      <button
                        v-for="option in interestOptions"
                        :key="option.value"
                        @click="toggleInterest(option.value)"
                        :class="[
                          'px-2.5 py-1.5 rounded-full text-xs transition-colors flex items-center gap-1',
                          formData.interests.includes(option.value)
                            ? 'text-white'
                            : 'bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-500'
                        ]"
                        :style="formData.interests.includes(option.value) ? { backgroundColor: themeColor } : {}"
                        :disabled="isSubmitting || (!formData.interests.includes(option.value) && formData.interests.length >= 5)"
                      >
                        <span>{{ option.icon }}</span>
                        <span>{{ option.label }}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </Transition>
            </div>
            
            <!-- 错误提示 -->
            <div v-if="errorMessage" class="mb-3 text-center text-sm text-red-500">
              {{ errorMessage }}
            </div>
            
            <!-- 提交按钮 -->
            <button
              @click="handleSubmit"
              :disabled="!isValid || isSubmitting"
              :class="[
                'w-full py-3 rounded-full text-sm font-medium transition-all text-white',
                isValid && !isSubmitting
                  ? 'hover:opacity-90'
                  : 'opacity-50 cursor-not-allowed'
              ]"
              :style="{ backgroundColor: themeColor }"
            >
              <span v-if="isSubmitting">
                <i class="fas fa-spinner fa-spin mr-2"></i>创建中...
              </span>
              <span v-else>创建账号</span>
            </button>
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

.slide-enter-active,
.slide-leave-active {
  transition: all 0.2s ease;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  max-height: 0;
  overflow: hidden;
}

.slide-enter-to,
.slide-leave-from {
  max-height: 500px;
}

input:focus,
textarea:focus,
select:focus {
  border-color: v-bind(themeColor);
}
</style>
