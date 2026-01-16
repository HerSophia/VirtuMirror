<script setup lang="ts">
import { ref, computed, watch, onMounted, toRaw } from 'vue';
import { useAccountStore } from '@/stores/accountStore';
import type { FullProfile, PlatformSpecificData, InterestDomain, AgeRange, CharacterProfile } from '@/types/account';

const props = defineProps<{
  visible: boolean;
  profile: FullProfile | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'updated'): void;
}>();

const accountStore = useAccountStore();

// 表单数据
const formData = ref({
  nickname: '',
  handle: '',
  bio: '',
  tagline: '',
  gender: 'unknown' as 'male' | 'female' | 'other' | 'unknown',
  birthday: '',
  occupation: '',
  location: '',
  ageRange: 'adult' as AgeRange,
  interests: [] as InterestDomain[],
  tags: [] as string[],
});

const isSubmitting = ref(false);
const errorMessage = ref('');
const newTag = ref('');
const activeTab = ref<'basic' | 'profile'>('basic');

// 预设头像
const avatarOptions = [
  'https://api.dicebear.com/7.x/avataaars/svg?seed=weibo1',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=weibo2',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=weibo3',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=weibo4',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=weibo5',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=weibo6',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=weibo7',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=weibo8',
];

const selectedAvatar = ref('');

// 性别选项
const genderOptions = [
  { value: 'unknown', label: '保密' },
  { value: 'male', label: '男' },
  { value: 'female', label: '女' },
  { value: 'other', label: '其他' },
];

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

// 验证
const isValid = computed(() => {
  return formData.value.nickname.trim().length >= 2 && 
         formData.value.nickname.trim().length <= 20;
});

// 初始化表单数据
function initFormData() {
  if (props.profile) {
    const { account, entity } = props.profile;
    const platformData = account.platformData || {};
    const entityProfile = entity.profile;
    
    formData.value = {
      nickname: account.nickname || entity.displayName || '',
      handle: account.handle || '',
      bio: account.bioOverride || entity.bio || '',
      tagline: entity.tagline || '',
      gender: (entity.gender as typeof formData.value.gender) || 'unknown',
      birthday: (platformData.birthday as string) || '',
      occupation: entityProfile?.occupation || '',
      location: entityProfile?.location || (platformData.location as string) || '',
      ageRange: entityProfile?.ageRange || 'adult',
      interests: entityProfile?.interests || (platformData.contentDomains as InterestDomain[]) || [],
      tags: entityProfile?.tags || (platformData.accountTags as string[]) || [],
    };
    selectedAvatar.value = account.avatarOverride || entity.avatar || avatarOptions[0];
  }
}

// 添加标签
function addTag() {
  const tag = newTag.value.trim();
  if (tag && !formData.value.tags.includes(tag) && formData.value.tags.length < 5) {
    formData.value.tags.push(tag);
    newTag.value = '';
  }
}

// 删除标签
function removeTag(index: number) {
  formData.value.tags.splice(index, 1);
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

// 提交
async function handleSubmit() {
  if (!isValid.value || isSubmitting.value || !props.profile) return;
  
  isSubmitting.value = true;
  errorMessage.value = '';
  
  try {
    const { account, entity } = props.profile;
    
    // 构建画像数据 - 使用展开运算符创建普通数组，避免 IndexedDB 序列化问题
    const characterProfile: CharacterProfile = {
      ageRange: formData.value.ageRange,
      occupation: formData.value.occupation || undefined,
      location: formData.value.location || undefined,
      interests: [...formData.value.interests],
      activityLevel: entity.profile?.activityLevel || 'medium',
      influenceLevel: entity.profile?.influenceLevel || 'nobody',
      tags: [...formData.value.tags],
      personality: entity.profile?.personality,
      contentStyle: entity.profile?.contentStyle,
      behaviorTendencies: entity.profile?.behaviorTendencies
        ? { ...entity.profile.behaviorTendencies }
        : undefined,
    };
    
    // 更新实体（性别等基础信息）
    await accountStore.updateEntity(entity.id, {
      displayName: formData.value.nickname.trim(),
      gender: formData.value.gender,
      bio: formData.value.bio.trim() || undefined,
      avatar: selectedAvatar.value,
      tagline: formData.value.tagline.trim() || undefined,
      profile: characterProfile,
    });
    
    // 更新平台账号
    const { accountService } = await import('@/services/account/accountService');
    // 深拷贝 platformData 避免响应式对象序列化问题
    const existingPlatformData = account.platformData ? JSON.parse(JSON.stringify(account.platformData)) : {};
    const updatedPlatformData: PlatformSpecificData = {
      ...existingPlatformData,
      birthday: formData.value.birthday || undefined,
      contentDomains: [...formData.value.interests],
      accountTags: formData.value.tags.length > 0 ? [...formData.value.tags] : undefined,
    };
    
    await accountService.updatePlatformAccount(account.id, {
      nickname: formData.value.nickname.trim(),
      handle: formData.value.handle.trim() || undefined,
      bioOverride: formData.value.bio.trim() || undefined,
      avatarOverride: selectedAvatar.value,
      platformData: updatedPlatformData,
    });
    
    emit('updated');
  } catch (error: any) {
    console.error('Failed to update profile:', error);
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

// 弹窗打开时初始化表单
watch(() => props.visible, (newVal) => {
  if (newVal) {
    initFormData();
    errorMessage.value = '';
    activeTab.value = 'basic';
  }
});

// 初始挂载时也初始化
onMounted(() => {
  if (props.visible) {
    initFormData();
  }
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
        <div class="relative w-[90%] max-w-sm bg-white rounded-2xl overflow-hidden shadow-xl max-h-[85vh] flex flex-col">
          <!-- 头部 -->
          <div class="relative h-20 bg-gradient-to-r from-orange-400 to-red-500 flex-shrink-0">
            <button 
              @click="handleClose"
              class="absolute top-3 right-3 w-8 h-8 flex items-center justify-center text-white/80 hover:text-white"
              :disabled="isSubmitting"
            >
              <i class="fas fa-times text-lg"></i>
            </button>
            <div class="absolute -bottom-8 left-1/2 -translate-x-1/2">
              <div class="relative">
                <img
                  :src="selectedAvatar"
                  class="w-16 h-16 rounded-full border-4 border-white bg-white"
                  alt="头像"
                />
                <div class="absolute -bottom-1 -right-1 w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center">
                  <i class="fas fa-camera text-white text-[10px]"></i>
                </div>
              </div>
            </div>
          </div>
          
          <!-- 表单（可滚动） -->
          <div class="pt-12 px-5 pb-5 overflow-y-auto flex-1">
            <h3 class="text-center text-lg font-bold text-gray-800 mb-2">
              编辑资料
            </h3>
            
            <!-- Tab 切换 -->
            <div class="flex mb-4 bg-gray-100 rounded-lg p-1">
              <button
                @click="activeTab = 'basic'"
                :class="[
                  'flex-1 py-2 text-sm font-medium rounded-md transition-colors',
                  activeTab === 'basic' ? 'bg-white text-orange-500 shadow-sm' : 'text-gray-500'
                ]"
              >
                基本信息
              </button>
              <button
                @click="activeTab = 'profile'"
                :class="[
                  'flex-1 py-2 text-sm font-medium rounded-md transition-colors',
                  activeTab === 'profile' ? 'bg-white text-orange-500 shadow-sm' : 'text-gray-500'
                ]"
              >
                详细画像
              </button>
            </div>
            
            <!-- 基本信息 Tab -->
            <div v-show="activeTab === 'basic'">
              <!-- 头像选择 -->
              <div class="mb-4">
                <label class="block text-xs text-gray-500 mb-2">选择头像</label>
                <div class="flex gap-2 overflow-x-auto pb-2">
                  <div
                    v-for="avatar in avatarOptions"
                    :key="avatar"
                    @click="selectedAvatar = avatar"
                    :class="[
                      'w-10 h-10 rounded-full flex-shrink-0 cursor-pointer border-2 transition-all',
                      selectedAvatar === avatar ? 'border-orange-500 scale-110' : 'border-transparent'
                    ]"
                  >
                    <img :src="avatar" class="w-full h-full rounded-full" />
                  </div>
                </div>
              </div>
              
              <!-- 昵称 -->
              <div class="mb-3">
                <label class="block text-xs text-gray-500 mb-1">昵称 *</label>
                <input
                  v-model="formData.nickname"
                  type="text"
                  placeholder="2-20个字符"
                  maxlength="20"
                  class="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-orange-400 focus:bg-white transition-colors"
                  :disabled="isSubmitting"
                />
              </div>
              
              <!-- 一句话标语 -->
              <div class="mb-3">
                <label class="block text-xs text-gray-500 mb-1">一句话介绍</label>
                <input
                  v-model="formData.tagline"
                  type="text"
                  placeholder="例如：热爱生活的北漂程序员"
                  maxlength="30"
                  class="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-orange-400 focus:bg-white transition-colors"
                  :disabled="isSubmitting"
                />
              </div>
              
              <!-- 微博号 -->
              <div class="mb-3">
                <label class="block text-xs text-gray-500 mb-1">微博号</label>
                <div class="flex items-center">
                  <span class="text-gray-400 text-sm mr-1">@</span>
                  <input
                    v-model="formData.handle"
                    type="text"
                    placeholder="你的微博号"
                    maxlength="30"
                    class="flex-1 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-orange-400 focus:bg-white transition-colors"
                    :disabled="isSubmitting"
                  />
                </div>
              </div>
              
              <!-- 性别 -->
              <div class="mb-3">
                <label class="block text-xs text-gray-500 mb-1">性别</label>
                <div class="flex gap-2">
                  <button
                    v-for="option in genderOptions"
                    :key="option.value"
                    @click="formData.gender = option.value as any"
                    :class="[
                      'flex-1 py-2 rounded-lg text-sm transition-colors',
                      formData.gender === option.value
                        ? 'bg-orange-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    ]"
                    :disabled="isSubmitting"
                  >
                    {{ option.label }}
                  </button>
                </div>
              </div>
              
              <!-- 出生日期 -->
              <div class="mb-3">
                <label class="block text-xs text-gray-500 mb-1">出生日期</label>
                <input
                  v-model="formData.birthday"
                  type="date"
                  class="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-orange-400 focus:bg-white transition-colors"
                  :disabled="isSubmitting"
                />
              </div>
              
              <!-- 简介 -->
              <div class="mb-3">
                <label class="block text-xs text-gray-500 mb-1">简介</label>
                <textarea
                  v-model="formData.bio"
                  placeholder="介绍一下自己吧"
                  maxlength="100"
                  rows="2"
                  class="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-orange-400 focus:bg-white transition-colors resize-none"
                  :disabled="isSubmitting"
                />
                <div class="text-right text-xs text-gray-400 mt-1">
                  {{ formData.bio.length }}/100
                </div>
              </div>
            </div>
            
            <!-- 详细画像 Tab -->
            <div v-show="activeTab === 'profile'">
              <!-- 职业 -->
              <div class="mb-3">
                <label class="block text-xs text-gray-500 mb-1">职业</label>
                <select
                  v-model="formData.occupation"
                  class="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-orange-400 focus:bg-white transition-colors"
                  :disabled="isSubmitting"
                >
                  <option value="">请选择</option>
                  <option v-for="occ in occupationOptions" :key="occ" :value="occ">
                    {{ occ }}
                  </option>
                </select>
              </div>
              
              <!-- 所在地 -->
              <div class="mb-3">
                <label class="block text-xs text-gray-500 mb-1">所在地</label>
                <select
                  v-model="formData.location"
                  class="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-orange-400 focus:bg-white transition-colors"
                  :disabled="isSubmitting"
                >
                  <option value="">请选择</option>
                  <option v-for="loc in locationOptions" :key="loc" :value="loc">
                    {{ loc }}
                  </option>
                </select>
              </div>
              
              <!-- 年龄段 -->
              <div class="mb-3">
                <label class="block text-xs text-gray-500 mb-1">年龄段</label>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="option in ageRangeOptions"
                    :key="option.value"
                    @click="formData.ageRange = option.value"
                    :class="[
                      'px-3 py-1.5 rounded-full text-xs transition-colors',
                      formData.ageRange === option.value
                        ? 'bg-orange-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    ]"
                    :disabled="isSubmitting"
                  >
                    {{ option.label }}
                  </button>
                </div>
              </div>
              
              <!-- 兴趣领域 -->
              <div class="mb-3">
                <label class="block text-xs text-gray-500 mb-1">
                  兴趣领域（最多5个）
                  <span class="text-orange-500">{{ formData.interests.length }}/5</span>
                </label>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="option in interestOptions"
                    :key="option.value"
                    @click="toggleInterest(option.value)"
                    :class="[
                      'px-2.5 py-1.5 rounded-full text-xs transition-colors flex items-center gap-1',
                      formData.interests.includes(option.value)
                        ? 'bg-orange-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    ]"
                    :disabled="isSubmitting || (!formData.interests.includes(option.value) && formData.interests.length >= 5)"
                  >
                    <span>{{ option.icon }}</span>
                    <span>{{ option.label }}</span>
                  </button>
                </div>
              </div>
              
              <!-- 个性标签 -->
              <div class="mb-3">
                <label class="block text-xs text-gray-500 mb-1">个性标签（最多5个）</label>
                <div class="flex flex-wrap gap-2 mb-2">
                  <span
                    v-for="(tag, index) in formData.tags"
                    :key="index"
                    class="inline-flex items-center px-2 py-1 bg-orange-100 text-orange-600 rounded-full text-xs"
                  >
                    {{ tag }}
                    <button
                      @click="removeTag(index)"
                      class="ml-1 hover:text-orange-800"
                      :disabled="isSubmitting"
                    >
                      <i class="fas fa-times text-[10px]"></i>
                    </button>
                  </span>
                </div>
                <div v-if="formData.tags.length < 5" class="flex gap-2">
                  <input
                    v-model="newTag"
                    type="text"
                    placeholder="添加标签"
                    maxlength="10"
                    @keyup.enter="addTag"
                    class="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-orange-400 focus:bg-white transition-colors"
                    :disabled="isSubmitting"
                  />
                  <button
                    @click="addTag"
                    class="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200 transition-colors"
                    :disabled="isSubmitting || !newTag.trim()"
                  >
                    添加
                  </button>
                </div>
              </div>
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
                'w-full py-3 rounded-full text-sm font-medium transition-all',
                isValid && !isSubmitting
                  ? 'bg-orange-500 text-white hover:bg-orange-600'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              ]"
            >
              <span v-if="isSubmitting">
                <i class="fas fa-spinner fa-spin mr-2"></i>保存中...
              </span>
              <span v-else>保存</span>
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
</style>
