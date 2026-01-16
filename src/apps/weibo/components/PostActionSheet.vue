<script setup lang="ts">
import { computed } from 'vue';
import type { DisplayPost } from '@/types/social';

/**
 * PostActionSheet 组件
 * Phase 3 重构：统一使用 DisplayPost 类型
 */
const props = defineProps<{
  visible: boolean;
  post: DisplayPost;
  /** 是否是自己的博文（可编辑/删除） */
  isOwner?: boolean;
  /** 是否已收藏 */
  isFavorited?: boolean;
  /** 是否正在执行操作 */
  loading?: boolean;
}>();

// 直接使用 DisplayPost 属性
const authorName = computed(() => props.post.author.name);
const authorAvatar = computed(() => props.post.author.avatar);
const postTime = computed(() => props.post.displayTime);
const postContent = computed(() => props.post.payload.text || '');

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'edit'): void;
  (e: 'delete'): void;
  (e: 'generate-engagement'): void;
  (e: 'generate-comments'): void;
  (e: 'copy-content'): void;
  (e: 'copy-id'): void;
  (e: 'favorite'): void;
}>();

// 操作项定义
interface ActionItem {
  id: string;
  icon: string;
  label: string;
  description?: string;
  color?: string;
  danger?: boolean;
  ownerOnly?: boolean;
  handler: () => void;
}

const actions = computed<ActionItem[]>(() => {
  const items: ActionItem[] = [];
  
  // 收藏/取消收藏
  items.push({
    id: 'favorite',
    icon: props.isFavorited ? 'fa-star' : 'fa-star',
    label: props.isFavorited ? '取消收藏' : '收藏',
    description: props.isFavorited ? '从收藏列表移除' : '添加到我的收藏',
    color: props.isFavorited ? 'text-yellow-500' : 'text-gray-600',
    handler: () => emit('favorite'),
  });
  
  // 编辑（仅博主可用）
  if (props.isOwner) {
    items.push({
      id: 'edit',
      icon: 'fa-edit',
      label: '编辑博文',
      description: '修改博文内容',
      color: 'text-blue-500',
      ownerOnly: true,
      handler: () => emit('edit'),
    });
  }
  
  // 生成互动
  items.push({
    id: 'generate-engagement',
    icon: 'fa-magic',
    label: '生成互动',
    description: '生成评论、点赞、转发数据',
    color: 'text-orange-500',
    handler: () => emit('generate-engagement'),
  });
  
  // 仅生成评论
  items.push({
    id: 'generate-comments',
    icon: 'fa-comments',
    label: '生成评论',
    description: '仅生成新评论（增量）',
    color: 'text-green-500',
    handler: () => emit('generate-comments'),
  });
  
  // 复制内容
  items.push({
    id: 'copy-content',
    icon: 'fa-copy',
    label: '复制内容',
    description: '复制博文文字内容',
    color: 'text-gray-600',
    handler: () => emit('copy-content'),
  });
  
  // 复制博文 ID（开发用）
  items.push({
    id: 'copy-id',
    icon: 'fa-fingerprint',
    label: '复制博文ID',
    description: '用于 LLM 任务等场景',
    color: 'text-gray-400',
    handler: () => emit('copy-id'),
  });
  
  // 删除（仅博主可用）
  if (props.isOwner) {
    items.push({
      id: 'delete',
      icon: 'fa-trash-alt',
      label: '删除博文',
      description: '删除后无法恢复',
      color: 'text-red-500',
      danger: true,
      ownerOnly: true,
      handler: () => emit('delete'),
    });
  }
  
  return items;
});

function handleAction(action: ActionItem) {
  if (props.loading) return;
  action.handler();
}

function handleClose() {
  if (props.loading) return;
  emit('close');
}
</script>

<template>
  <Transition name="fade">
    <div
      v-if="visible"
      class="absolute inset-0 z-[200] flex items-center justify-center p-4"
      @click.self="handleClose"
    >
      <!-- 遮罩 -->
      <div
        class="absolute inset-0 bg-black/40"
        @click="handleClose"
      />
      
      <!-- 操作面板 -->
      <Transition name="scale">
        <div
          v-if="visible"
          class="relative w-full max-w-sm bg-white rounded-2xl overflow-hidden shadow-xl"
        >
          <!-- 标题栏 -->
          <div class="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div class="flex items-center space-x-2">
              <img
                :src="authorAvatar"
                class="w-8 h-8 rounded-full object-cover"
              />
              <div class="text-sm">
                <div class="font-medium text-gray-900">{{ authorName }}</div>
                <div class="text-xs text-gray-400">{{ postTime }}</div>
              </div>
            </div>
            <button
              @click="handleClose"
              :disabled="loading"
              class="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
            >
              <i class="fas fa-times"></i>
            </button>
          </div>
          
          <!-- 博文预览 -->
          <div class="px-4 py-2 bg-gray-50 border-b border-gray-100">
            <p class="text-sm text-gray-600 line-clamp-2">{{ postContent }}</p>
          </div>
          
          <!-- 加载状态 -->
          <div v-if="loading" class="px-4 py-6 text-center">
            <i class="fas fa-spinner fa-spin text-2xl text-orange-500 mb-2"></i>
            <p class="text-sm text-gray-500">正在处理...</p>
          </div>
          
          <!-- 操作列表 -->
          <div v-else class="py-2">
            <button
              v-for="action in actions"
              :key="action.id"
              @click="handleAction(action)"
              class="w-full flex items-center px-4 py-3 hover:bg-gray-50 active:bg-gray-100 transition-colors"
            >
              <div
                :class="[
                  'w-10 h-10 rounded-full flex items-center justify-center mr-3',
                  action.danger ? 'bg-red-50' : 'bg-gray-100'
                ]"
              >
                <i
                  :class="[
                    'fas',
                    action.icon,
                    action.color || 'text-gray-600'
                  ]"
                ></i>
              </div>
              <div class="flex-1 text-left">
                <div
                  :class="[
                    'font-medium',
                    action.danger ? 'text-red-500' : 'text-gray-900'
                  ]"
                >
                  {{ action.label }}
                </div>
                <div v-if="action.description" class="text-xs text-gray-400 mt-0.5">
                  {{ action.description }}
                </div>
              </div>
              <i class="fas fa-chevron-right text-gray-300 text-sm"></i>
            </button>
          </div>
          
          <!-- 取消按钮 -->
          <div class="px-4 py-3 border-t border-gray-100">
            <button
              @click="handleClose"
              :disabled="loading"
              class="w-full py-3 text-center text-gray-600 font-medium bg-gray-100 rounded-xl hover:bg-gray-200 active:bg-gray-300 transition-colors disabled:opacity-50"
            >
              取消
            </button>
          </div>
        </div>
      </Transition>
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

.scale-enter-active,
.scale-leave-active {
  transition: all 0.2s ease;
}

.scale-enter-from,
.scale-leave-to {
  opacity: 0;
  transform: scale(0.9);
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
