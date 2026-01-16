<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { useAccountStore } from '@/stores/accountStore';
import { useComposeStore } from '../stores';
import type { 
  ComposePostData, 
  WeiboPostType, 
  WeiboImageConfig, 
  WeiboPollOption,
  WeiboPollConfig,
  WeiboVideoConfig,
  WeiboDraft 
} from '../types';
import { v4 as uuidv4 } from 'uuid';

const props = defineProps<{
  visible: boolean;
  initialDraft?: WeiboDraft | null;
}>(); 

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'posted', postId: string): void;
  (e: 'open-drafts'): void;
}>();

const accountStore = useAccountStore();
const composeStore = useComposeStore();

// 当前发帖类型
const postType = ref<WeiboPostType>('text');

// 表单数据
const content = ref('');
const topics = ref<string[]>([]);
const newTopic = ref('');
const images = ref<WeiboImageConfig[]>([]);
const newImageDesc = ref('');

// 投票配置
const pollQuestion = ref('');
const pollOptions = ref<string[]>(['', '']);
const pollDuration = ref(24); // 小时
const pollMultiSelect = ref(false);

// 视频配置
const videoDescription = ref('');
const videoExpandedDesc = ref('');

// 状态
const isSubmitting = ref(false);
const isExpanding = ref(false);
const useAIExpand = ref(false);
const errorMessage = ref('');
const expandedContent = ref('');
const currentDraftId = ref<string | null>(null);
const showSaveDraftConfirm = ref(false);

// 字数统计
const contentLength = computed(() => content.value.length);
const maxLength = 140;
const isOverLimit = computed(() => contentLength.value > maxLength);

// 验证
const isValid = computed(() => {
  if (isOverLimit.value) return false;
  
  switch (postType.value) {
    case 'text':
      return content.value.trim().length > 0 || images.value.length > 0;
    case 'poll':
      return pollQuestion.value.trim().length > 0 && 
             pollOptions.value.filter(o => o.trim()).length >= 2;
    case 'video':
      return videoDescription.value.trim().length > 0;
    default:
      return false;
  }
});

// 切换发帖类型
function setPostType(type: WeiboPostType) {
  postType.value = type;
}

// 添加话题
function addTopic() {
  const topic = newTopic.value.trim().replace(/^#|#$/g, '');
  if (topic && !topics.value.includes(topic) && topics.value.length < 3) {
    topics.value.push(topic);
    newTopic.value = '';
  }
}

// 删除话题
function removeTopic(index: number) {
  topics.value.splice(index, 1);
}

// 添加图片描述
function addImage() {
  const desc = newImageDesc.value.trim();
  if (desc && images.value.length < 9) {
    images.value.push({
      description: desc,
    });
    newImageDesc.value = '';
  }
}

// 删除图片
function removeImage(index: number) {
  images.value.splice(index, 1);
}

// 添加投票选项
function addPollOption() {
  if (pollOptions.value.length < 6) {
    pollOptions.value.push('');
  }
}

// 删除投票选项
function removePollOption(index: number) {
  if (pollOptions.value.length > 2) {
    pollOptions.value.splice(index, 1);
  }
}

// AI 扩展内容
async function expandContent() {
  if (!content.value.trim() || isExpanding.value) return;
  
  isExpanding.value = true;
  errorMessage.value = '';
  
  try {
    const result = await composeStore.expandPostContent(content.value);
    if (result.success && result.expandedText) {
      expandedContent.value = result.expandedText;
      if (result.suggestedTopics) {
        // 添加建议的话题
        result.suggestedTopics.forEach(topic => {
          if (!topics.value.includes(topic) && topics.value.length < 3) {
            topics.value.push(topic);
          }
        });
      }
    } else {
      errorMessage.value = result.error || 'AI 扩展失败';
    }
  } catch (error: any) {
    errorMessage.value = error.message || 'AI 扩展失败';
  } finally {
    isExpanding.value = false;
  }
}

// 使用扩展后的内容
function useExpandedContent() {
  if (expandedContent.value) {
    content.value = expandedContent.value;
    expandedContent.value = '';
  }
}

// 扩展图片描述
async function expandImageDescription(index: number) {
  const image = images.value[index];
  if (!image || !image.description) return;
  
  try {
    const result = await composeStore.expandImageDescription(image.description);
    if (result.success && result.expandedDescription) {
      images.value[index] = {
        ...image,
        expandedDescription: result.expandedDescription,
      };
    }
  } catch (error) {
    console.error('Failed to expand image description:', error);
  }
}

// 扩展视频描述
async function expandVideoDescription() {
  if (!videoDescription.value.trim()) return;
  
  try {
    const result = await composeStore.expandVideoDescription(videoDescription.value);
    if (result.success && result.expandedDescription) {
      videoExpandedDesc.value = result.expandedDescription;
    }
  } catch (error) {
    console.error('Failed to expand video description:', error);
  }
}

// 提交发布
async function handleSubmit() {
  if (!isValid.value || isSubmitting.value) return;
  
  isSubmitting.value = true;
  errorMessage.value = '';
  
  try {
    // 构建发帖数据
    const postData: ComposePostData = {
      type: postType.value,
      content: useAIExpand.value && expandedContent.value 
        ? expandedContent.value 
        : content.value,
      topics: topics.value,
      images: images.value,
      useAIExpand: useAIExpand.value,
      source: '微博网页版',
    };
    
    // 添加投票配置
    if (postType.value === 'poll') {
      const validOptions = pollOptions.value
        .filter(o => o.trim())
        .map(text => ({
          id: uuidv4(),
          text: text.trim(),
          votes: 0,
        }));
      
      postData.poll = {
        question: pollQuestion.value.trim(),
        options: validOptions,
        duration: pollDuration.value,
        multiSelect: pollMultiSelect.value,
        endTime: Date.now() + pollDuration.value * 60 * 60 * 1000,
      };
    }
    
    // 添加视频配置
    if (postType.value === 'video') {
      postData.video = {
        description: videoDescription.value.trim(),
        expandedDescription: videoExpandedDesc.value || undefined,
      };
    }
    
    // 调用 store 发布
    const result = await composeStore.publishPost(postData);
    
    if (result.success && result.postId) {
      emit('posted', result.postId);
      resetForm();
    } else {
      errorMessage.value = result.error || '发布失败';
    }
  } catch (error: any) {
    console.error('Failed to publish post:', error);
    errorMessage.value = error.message || '发布失败，请重试';
  } finally {
    isSubmitting.value = false;
  }
}

// 重置表单
function resetForm() {
  postType.value = 'text';
  content.value = '';
  topics.value = [];
  newTopic.value = '';
  images.value = [];
  newImageDesc.value = '';
  pollQuestion.value = '';
  pollOptions.value = ['', ''];
  pollDuration.value = 24;
  pollMultiSelect.value = false;
  videoDescription.value = '';
  videoExpandedDesc.value = '';
  expandedContent.value = '';
  useAIExpand.value = false;
  errorMessage.value = '';
}

// 检查是否有内容
const hasContent = computed(() => {
  return content.value.trim().length > 0 || 
         images.value.length > 0 ||
         (postType.value === 'poll' && pollQuestion.value.trim().length > 0) ||
         (postType.value === 'video' && videoDescription.value.trim().length > 0);
});

// 保存草稿
async function handleSaveDraft() {
  if (!hasContent.value) return;
  
  const draftData = {
    type: postType.value,
    content: content.value,
    topics: topics.value,
    images: images.value,
    poll: postType.value === 'poll' ? {
      question: pollQuestion.value.trim(),
      options: pollOptions.value
        .filter(o => o.trim())
        .map(text => ({
          id: uuidv4(),
          text: text.trim(),
          votes: 0,
        })),
      duration: pollDuration.value,
      multiSelect: pollMultiSelect.value,
    } : undefined,
    video: postType.value === 'video' ? {
      description: videoDescription.value.trim(),
      expandedDescription: videoExpandedDesc.value || undefined,
    } : undefined,
  };
  
  const saved = await composeStore.saveDraft(draftData, currentDraftId.value || undefined);
  currentDraftId.value = saved.id;
  
  // 显示保存成功提示
  errorMessage.value = '';
  alert('草稿已保存');
}

// 加载草稿内容
function loadDraft(draft: WeiboDraft) {
  currentDraftId.value = draft.id;
  postType.value = draft.type;
  content.value = draft.content;
  topics.value = [...draft.topics];
  images.value = [...draft.images];
  
  if (draft.poll) {
    pollQuestion.value = draft.poll.question;
    pollOptions.value = draft.poll.options.map(o => o.text);
    pollDuration.value = draft.poll.duration;
    pollMultiSelect.value = draft.poll.multiSelect;
  }
  
  if (draft.video) {
    videoDescription.value = draft.video.description;
    videoExpandedDesc.value = draft.video.expandedDescription || '';
  }
}

function handleClose() {
  if (isSubmitting.value) return;
  
  // 如果有内容且未保存过，询问是否保存草稿
  if (hasContent.value && !currentDraftId.value) {
    if (confirm('是否保存为草稿？')) {
      handleSaveDraft();
    }
  }
  emit('close');
}

// 弹窗打开时重置或加载草稿
watch(() => props.visible, (newVal) => {
  if (newVal) {
    if (props.initialDraft) {
      loadDraft(props.initialDraft);
    } else {
      resetForm();
    }
  }
});
</script>

<template>
  <Transition name="slide-up">
    <div 
      v-if="visible" 
      class="absolute inset-0 z-[100] flex flex-col"
    >
      <!-- 遮罩 -->
      <div 
        class="absolute inset-0 bg-black/50"
        @click="handleClose"
      />
      
      <!-- 弹窗内容 -->
      <div class="relative mt-auto w-full bg-white rounded-t-2xl overflow-hidden shadow-xl max-h-[90%] flex flex-col">
          <!-- 头部 -->
          <div class="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <button 
              @click="handleClose"
              class="text-gray-500 hover:text-gray-700"
              :disabled="isSubmitting"
            >
              取消
            </button>
            <div class="flex items-center space-x-1">
              <span class="font-medium">发微博</span>
            </div>
            <button
              @click="handleSubmit"
              :disabled="!isValid || isSubmitting"
              :class="[
                'px-4 py-1.5 rounded-full text-sm font-medium transition-all',
                isValid && !isSubmitting
                  ? 'bg-orange-500 text-white hover:bg-orange-600'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              ]"
            >
              <span v-if="isSubmitting">
                <i class="fas fa-spinner fa-spin"></i>
              </span>
              <span v-else>发布</span>
            </button>
          </div>
          
          <!-- 类型选择 -->
          <div class="flex-shrink-0 flex items-center space-x-4 px-4 py-2 border-b border-gray-50">
            <button
              v-for="t in (['text', 'poll', 'video'] as WeiboPostType[])"
              :key="t"
              @click="setPostType(t)"
              :class="[
                'flex items-center space-x-1 px-3 py-1.5 rounded-full text-sm transition-colors',
                postType === t 
                  ? 'bg-orange-100 text-orange-600' 
                  : 'text-gray-500 hover:bg-gray-100'
              ]"
            >
              <i :class="[
                'fas',
                t === 'text' ? 'fa-pen' : t === 'poll' ? 'fa-poll' : 'fa-video'
              ]"></i>
              <span>{{ t === 'text' ? '文字' : t === 'poll' ? '投票' : '视频' }}</span>
            </button>
          </div>
          
          <!-- 内容区域（可滚动） -->
          <div class="flex-1 overflow-y-auto px-4 py-3">
            <!-- 文字输入 -->
            <div class="mb-3">
              <textarea
                v-model="content"
                placeholder="有什么新鲜事想告诉大家？"
                rows="4"
                :maxlength="maxLength + 20"
                class="w-full resize-none text-[15px] leading-relaxed focus:outline-none placeholder-gray-400"
                :disabled="isSubmitting"
              />
              <div class="flex items-center justify-between text-xs mt-1">
                <div class="flex items-center space-x-2">
                  <button
                    v-if="content.trim()"
                    @click="expandContent"
                    :disabled="isExpanding"
                    class="text-orange-500 hover:text-orange-600 transition-colors"
                  >
                    <i :class="['fas mr-1', isExpanding ? 'fa-spinner fa-spin' : 'fa-magic']"></i>
                    AI 润色
                  </button>
                </div>
                <span :class="isOverLimit ? 'text-red-500' : 'text-gray-400'">
                  {{ contentLength }}/{{ maxLength }}
                </span>
              </div>
            </div>
            
            <!-- AI 扩展预览 -->
            <div v-if="expandedContent" class="mb-3 p-3 bg-orange-50 rounded-lg">
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs text-orange-600 font-medium">AI 建议</span>
                <div class="flex items-center space-x-2">
                  <button
                    @click="useExpandedContent"
                    class="text-xs text-orange-600 hover:text-orange-700"
                  >
                    使用
                  </button>
                  <button
                    @click="expandedContent = ''"
                    class="text-xs text-gray-400 hover:text-gray-500"
                  >
                    取消
                  </button>
                </div>
              </div>
              <p class="text-sm text-gray-700 leading-relaxed">{{ expandedContent }}</p>
            </div>
            
            <!-- 话题标签 -->
            <div class="mb-3">
              <div class="flex flex-wrap gap-2 mb-2">
                <span
                  v-for="(topic, index) in topics"
                  :key="index"
                  class="inline-flex items-center px-2 py-1 bg-blue-50 text-blue-600 rounded-full text-xs"
                >
                  #{{ topic }}#
                  <button
                    @click="removeTopic(index)"
                    class="ml-1 hover:text-blue-800"
                  >
                    <i class="fas fa-times text-[10px]"></i>
                  </button>
                </span>
              </div>
              <div v-if="topics.length < 3" class="flex items-center gap-2">
                <div class="flex-1 relative">
                  <span class="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">#</span>
                  <input
                    v-model="newTopic"
                    type="text"
                    placeholder="添加话题"
                    maxlength="20"
                    @keyup.enter="addTopic"
                    class="w-full pl-5 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-orange-400"
                  />
                </div>
                <button
                  @click="addTopic"
                  :disabled="!newTopic.trim()"
                  class="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200 disabled:opacity-50"
                >
                  添加
                </button>
              </div>
            </div>
            
            <!-- 图片描述区域（仅文字类型） -->
            <div v-if="postType === 'text'" class="mb-3">
              <label class="block text-xs text-gray-500 mb-2">
                <i class="fas fa-image mr-1"></i>
                图片（描述图片内容，由 AI 理解）
              </label>
              <div class="space-y-2 mb-2">
                <div
                  v-for="(img, index) in images"
                  :key="index"
                  class="flex items-start gap-2 p-2 bg-gray-50 rounded-lg"
                >
                  <div class="w-12 h-12 bg-gray-200 rounded flex items-center justify-center text-gray-400">
                    <i class="fas fa-image"></i>
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm text-gray-700 line-clamp-2">{{ img.description }}</p>
                    <p v-if="img.expandedDescription" class="text-xs text-gray-500 mt-1 line-clamp-1">
                      {{ img.expandedDescription }}
                    </p>
                  </div>
                  <button
                    @click="removeImage(index)"
                    class="text-gray-400 hover:text-red-500"
                  >
                    <i class="fas fa-times"></i>
                  </button>
                </div>
              </div>
              <div v-if="images.length < 9" class="flex gap-2">
                <input
                  v-model="newImageDesc"
                  type="text"
                  placeholder="描述你想配的图片..."
                  maxlength="100"
                  @keyup.enter="addImage"
                  class="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-orange-400"
                />
                <button
                  @click="addImage"
                  :disabled="!newImageDesc.trim()"
                  class="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200 disabled:opacity-50"
                >
                  添加
                </button>
              </div>
              <p class="text-xs text-gray-400 mt-1">已添加 {{ images.length }}/9 张</p>
            </div>
            
            <!-- 投票配置（仅投票类型） -->
            <div v-if="postType === 'poll'" class="mb-3 p-3 bg-blue-50 rounded-lg">
              <label class="block text-xs text-blue-600 font-medium mb-2">
                <i class="fas fa-poll mr-1"></i>
                投票设置
              </label>
              
              <!-- 投票问题 -->
              <input
                v-model="pollQuestion"
                type="text"
                placeholder="投票问题"
                maxlength="50"
                class="w-full px-3 py-2 bg-white border border-blue-200 rounded-lg text-sm focus:outline-none focus:border-blue-400 mb-3"
              />
              
              <!-- 投票选项 -->
              <div class="space-y-2 mb-3">
                <div
                  v-for="(_, index) in pollOptions"
                  :key="index"
                  class="flex items-center gap-2"
                >
                  <span class="w-5 h-5 bg-blue-100 text-blue-600 rounded-full text-xs flex items-center justify-center">
                    {{ index + 1 }}
                  </span>
                  <input
                    v-model="pollOptions[index]"
                    type="text"
                    :placeholder="`选项 ${index + 1}`"
                    maxlength="20"
                    class="flex-1 px-3 py-1.5 bg-white border border-blue-200 rounded-lg text-sm focus:outline-none focus:border-blue-400"
                  />
                  <button
                    v-if="pollOptions.length > 2"
                    @click="removePollOption(index)"
                    class="text-gray-400 hover:text-red-500"
                  >
                    <i class="fas fa-minus-circle"></i>
                  </button>
                </div>
              </div>
              
              <button
                v-if="pollOptions.length < 6"
                @click="addPollOption"
                class="text-blue-600 text-sm hover:text-blue-700"
              >
                <i class="fas fa-plus-circle mr-1"></i>
                添加选项
              </button>
              
              <!-- 投票设置 -->
              <div class="flex items-center gap-4 mt-3 pt-3 border-t border-blue-100">
                <div class="flex items-center gap-2">
                  <span class="text-xs text-gray-600">持续时间</span>
                  <select
                    v-model="pollDuration"
                    class="px-2 py-1 bg-white border border-blue-200 rounded text-sm"
                  >
                    <option :value="6">6小时</option>
                    <option :value="12">12小时</option>
                    <option :value="24">1天</option>
                    <option :value="72">3天</option>
                    <option :value="168">7天</option>
                  </select>
                </div>
                <label class="flex items-center gap-1 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    v-model="pollMultiSelect"
                    class="rounded"
                  />
                  多选
                </label>
              </div>
            </div>
            
            <!-- 视频配置（仅视频类型） -->
            <div v-if="postType === 'video'" class="mb-3 p-3 bg-purple-50 rounded-lg">
              <label class="block text-xs text-purple-600 font-medium mb-2">
                <i class="fas fa-video mr-1"></i>
                视频描述
              </label>
              <p class="text-xs text-gray-500 mb-2">
                由于技术限制，请描述你的视频内容，AI 将帮助扩展和理解
              </p>
              <textarea
                v-model="videoDescription"
                placeholder="描述你的视频内容，如：一段城市夜景延时摄影..."
                rows="3"
                maxlength="200"
                class="w-full px-3 py-2 bg-white border border-purple-200 rounded-lg text-sm focus:outline-none focus:border-purple-400 resize-none mb-2"
              />
              <div class="flex items-center justify-between">
                <button
                  v-if="videoDescription.trim() && !videoExpandedDesc"
                  @click="expandVideoDescription"
                  class="text-purple-600 text-sm hover:text-purple-700"
                >
                  <i class="fas fa-magic mr-1"></i>
                  AI 扩展描述
                </button>
                <span class="text-xs text-gray-400">{{ videoDescription.length }}/200</span>
              </div>
              
              <!-- 扩展后的描述 -->
              <div v-if="videoExpandedDesc" class="mt-2 p-2 bg-white rounded border border-purple-100">
                <div class="flex items-center justify-between mb-1">
                  <span class="text-xs text-purple-600">AI 扩展</span>
                  <button
                    @click="videoExpandedDesc = ''"
                    class="text-xs text-gray-400 hover:text-gray-500"
                  >
                    清除
                  </button>
                </div>
                <p class="text-xs text-gray-600">{{ videoExpandedDesc }}</p>
              </div>
            </div>
            
            <!-- 错误提示 -->
            <div v-if="errorMessage" class="mb-3 p-2 bg-red-50 text-red-600 text-sm rounded-lg">
              <i class="fas fa-exclamation-circle mr-1"></i>
              {{ errorMessage }}
            </div>
          </div>
          
          <!-- 底部工具栏 -->
          <div class="flex-shrink-0 flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
            <div class="flex items-center space-x-4 text-gray-500">
              <button class="hover:text-orange-500 transition-colors" title="表情">
                <i class="far fa-smile text-lg"></i>
              </button>
              <button 
                @click="emit('open-drafts')"
                class="hover:text-orange-500 transition-colors relative" 
                title="草稿箱"
              >
                <i class="fas fa-file-alt text-lg"></i>
                <span 
                  v-if="composeStore.drafts.length > 0"
                  class="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center"
                >
                  {{ composeStore.drafts.length > 9 ? '9+' : composeStore.drafts.length }}
                </span>
              </button>
              <button 
                @click="handleSaveDraft"
                :disabled="!hasContent"
                :class="[
                  'transition-colors',
                  hasContent ? 'hover:text-orange-500' : 'text-gray-300 cursor-not-allowed'
                ]"
                title="保存草稿"
              >
                <i class="fas fa-save text-lg"></i>
              </button>
            </div>
            <div class="text-xs text-gray-400">
              {{ currentDraftId ? '已保存草稿' : '公开可见' }}
            </div>
          </div>
        </div>
      </div>
    </Transition>
</template>

<style scoped>
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0;
}

.slide-up-enter-from .bg-black\/50,
.slide-up-leave-to .bg-black\/50 {
  opacity: 0;
}
</style>
