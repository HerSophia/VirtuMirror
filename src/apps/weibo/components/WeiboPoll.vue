<script setup lang="ts">
import { ref, computed } from 'vue';
import type { PollPayload } from '@/types/social';

/**
 * WeiboPoll 组件
 * Phase 3 重构：使用统一的 PollPayload 类型
 */
const props = defineProps<{
  poll: PollPayload;
  postId: string;
}>();

const emit = defineEmits<{
  (e: 'vote', optionIds: string[]): void;
}>();

// 用户选中的选项
const selectedOptions = ref<Set<string>>(new Set());

// 是否已投票
const hasVoted = ref(false);

// 投票是否已结束
const isEnded = computed(() => {
  if (!props.poll.endTime) return false;
  return Date.now() > props.poll.endTime;
});

// 计算总票数
const totalVotes = computed(() => {
  return props.poll.options.reduce((sum, opt) => sum + (opt.votes || 0), 0);
});

// 计算剩余时间
const remainingTime = computed(() => {
  // endTime 是必填字段（PollPayload）
  const endTime = props.poll.endTime;
  const diff = endTime - Date.now();
  
  if (diff <= 0) return '已结束';
  
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}天后结束`;
  }
  if (hours > 0) {
    return `${hours}小时${minutes}分钟后结束`;
  }
  return `${minutes}分钟后结束`;
});

// 获取选项百分比
function getPercentage(votes: number): number {
  if (totalVotes.value === 0) return 0;
  return Math.round((votes / totalVotes.value) * 100);
}

// 切换选项选中状态
function toggleOption(optionId: string) {
  if (hasVoted.value || isEnded.value) return;
  
  if (props.poll.multiSelect) {
    if (selectedOptions.value.has(optionId)) {
      selectedOptions.value.delete(optionId);
    } else {
      selectedOptions.value.add(optionId);
    }
  } else {
    selectedOptions.value.clear();
    selectedOptions.value.add(optionId);
  }
}

// 提交投票
function submitVote() {
  if (selectedOptions.value.size === 0) return;
  
  hasVoted.value = true;
  emit('vote', Array.from(selectedOptions.value));
}

// 检查选项是否选中
function isSelected(optionId: string): boolean {
  return selectedOptions.value.has(optionId);
}
</script>

<template>
  <div class="weibo-poll bg-gray-50 rounded-lg p-3 mt-2">
    <!-- 投票问题 -->
    <div class="flex items-center mb-3">
      <i class="fas fa-poll text-orange-500 mr-2"></i>
      <span class="font-medium text-gray-800">{{ poll.question }}</span>
    </div>
    
    <!-- 投票选项 -->
    <div class="space-y-2">
      <div
        v-for="option in poll.options"
        :key="option.id"
        @click="toggleOption(option.id)"
        class="relative overflow-hidden rounded-lg border transition-all cursor-pointer"
        :class="[
          isSelected(option.id) 
            ? 'border-orange-500 bg-orange-50' 
            : 'border-gray-200 bg-white hover:border-gray-300',
          (hasVoted || isEnded) ? 'cursor-default' : ''
        ]"
      >
        <!-- 进度条背景 -->
        <div
          v-if="hasVoted || isEnded"
          class="absolute inset-0 bg-orange-100 transition-all duration-500"
          :style="{ width: getPercentage(option.votes) + '%' }"
        ></div>
        
        <!-- 选项内容 -->
        <div class="relative flex items-center justify-between px-3 py-2.5">
          <div class="flex items-center">
            <!-- 单选/多选图标 -->
            <div 
              v-if="!hasVoted && !isEnded"
              class="w-5 h-5 mr-2.5 flex items-center justify-center rounded-full border-2 transition-colors"
              :class="[
                isSelected(option.id)
                  ? 'border-orange-500 bg-orange-500'
                  : 'border-gray-300'
              ]"
            >
              <i 
                v-if="isSelected(option.id)" 
                class="fas fa-check text-white text-xs"
              ></i>
            </div>
            
            <!-- 选项文本 -->
            <span class="text-sm text-gray-700">{{ option.text }}</span>
          </div>
          
          <!-- 投票结果 -->
          <div v-if="hasVoted || isEnded" class="flex items-center space-x-2">
            <span class="text-sm text-gray-500">{{ option.votes }}票</span>
            <span class="text-sm font-medium text-orange-600">
              {{ getPercentage(option.votes) }}%
            </span>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 投票按钮和信息 -->
    <div class="mt-3 flex items-center justify-between">
      <div class="text-xs text-gray-400">
        <span v-if="poll.multiSelect" class="mr-2">
          <i class="fas fa-check-double mr-1"></i>可多选
        </span>
        <span>{{ totalVotes }}人参与</span>
        <span class="mx-1">·</span>
        <span>{{ remainingTime }}</span>
      </div>
      
      <button
        v-if="!hasVoted && !isEnded && selectedOptions.size > 0"
        @click.stop="submitVote"
        class="px-4 py-1.5 bg-orange-500 text-white text-sm rounded-full hover:bg-orange-600 transition-colors"
      >
        投票
      </button>
    </div>
  </div>
</template>

<style scoped>
.weibo-poll {
  user-select: none;
}
</style>
