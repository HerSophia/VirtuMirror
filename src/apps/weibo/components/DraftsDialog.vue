<script setup lang="ts">
import { computed } from 'vue';
import { useComposeStore } from '../stores';
import type { WeiboDraft } from '../types';

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'select', draft: WeiboDraft): void;
}>();

const composeStore = useComposeStore();

const drafts = computed(() => composeStore.drafts);

function formatTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  const date = new Date(timestamp);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function getPreviewText(draft: WeiboDraft): string {
  let text = draft.content || '';
  if (draft.topics.length > 0) {
    text = draft.topics.map(t => `#${t}#`).join(' ') + ' ' + text;
  }
  return text.slice(0, 50) + (text.length > 50 ? '...' : '');
}

function getTypeIcon(type: string): string {
  switch (type) {
    case 'poll': return 'fa-poll';
    case 'video': return 'fa-video';
    default: return 'fa-pen';
  }
}

function getTypeLabel(type: string): string {
  switch (type) {
    case 'poll': return '投票';
    case 'video': return '视频';
    default: return '文字';
  }
}

function handleSelect(draft: WeiboDraft) {
  emit('select', draft);
  emit('close');
}

async function handleDelete(e: Event, draftId: string) {
  e.stopPropagation();
  if (confirm('确定要删除这条草稿吗？')) {
    await composeStore.deleteDraft(draftId);
  }
}

async function handleClearAll() {
  if (drafts.value.length === 0) return;
  if (confirm(`确定要清空全部 ${drafts.value.length} 条草稿吗？`)) {
    await composeStore.clearAllDrafts();
  }
}
</script>

<template>
  <Transition name="fade">
    <div 
      v-if="visible" 
      class="absolute inset-0 z-[100] flex flex-col bg-gray-50"
    >
      <!-- 顶部导航 -->
      <div class="flex-shrink-0 flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100">
        <button 
          @click="emit('close')"
          class="text-gray-500 hover:text-gray-700"
        >
          <i class="fas fa-arrow-left"></i>
        </button>
        <span class="font-medium">草稿箱</span>
        <button
          v-if="drafts.length > 0"
          @click="handleClearAll"
          class="text-red-500 text-sm hover:text-red-600"
        >
          清空
        </button>
        <span v-else class="w-8"></span>
      </div>
      
      <!-- 草稿列表 -->
      <div class="flex-1 overflow-y-auto">
        <!-- 空状态 -->
        <div v-if="drafts.length === 0" class="flex flex-col items-center justify-center h-full text-gray-400">
          <i class="fas fa-file-alt text-4xl mb-3"></i>
          <p class="text-sm">暂无草稿</p>
          <p class="text-xs mt-1">发布时点击保存草稿可在此查看</p>
        </div>
        
        <!-- 草稿项 -->
        <div v-else class="divide-y divide-gray-100">
          <div
            v-for="draft in drafts"
            :key="draft.id"
            @click="handleSelect(draft)"
            class="bg-white px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer"
          >
            <div class="flex items-start gap-3">
              <!-- 类型图标 -->
              <div class="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                <i :class="['fas', getTypeIcon(draft.type), 'text-orange-500']"></i>
              </div>
              
              <!-- 内容预览 -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1">
                  <span class="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                    {{ getTypeLabel(draft.type) }}
                  </span>
                  <span class="text-xs text-gray-400">{{ formatTime(draft.updatedAt) }}</span>
                </div>
                <p class="text-sm text-gray-700 line-clamp-2">
                  {{ getPreviewText(draft) || '(无内容)' }}
                </p>
                
                <!-- 附件提示 -->
                <div class="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                  <span v-if="draft.images.length > 0">
                    <i class="fas fa-image mr-1"></i>{{ draft.images.length }}张图片
                  </span>
                  <span v-if="draft.poll">
                    <i class="fas fa-poll mr-1"></i>{{ draft.poll.options.length }}个选项
                  </span>
                  <span v-if="draft.video">
                    <i class="fas fa-video mr-1"></i>视频
                  </span>
                </div>
              </div>
              
              <!-- 删除按钮 -->
              <button
                @click="(e) => handleDelete(e, draft.id)"
                class="p-2 text-gray-400 hover:text-red-500 transition-colors"
              >
                <i class="fas fa-trash-alt"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 底部提示 -->
      <div v-if="drafts.length > 0" class="flex-shrink-0 px-4 py-2 bg-gray-50 text-center text-xs text-gray-400 border-t border-gray-100">
        共 {{ drafts.length }} 条草稿
      </div>
    </div>
  </Transition>
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
