<script setup lang="ts">
import { computed } from 'vue';
import type { VideoPayload } from '@/types/social';

/**
 * WeiboVideo 组件
 * Phase 3 重构：使用统一的 VideoPayload 类型
 */
const props = defineProps<{
  video: VideoPayload;
}>();

// 格式化视频时长
const formattedDuration = computed(() => {
  if (!props.video.duration) return '';
  const minutes = Math.floor(props.video.duration / 60);
  const seconds = props.video.duration % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
});

// 获取视频描述
const displayDescription = computed(() => {
  return props.video.expandedDescription || props.video.description || '视频内容';
});

// 获取封面描述
const coverText = computed(() => {
  return props.video.coverDescription || props.video.description?.slice(0, 30) || '视频';
});
</script>

<template>
  <div class="weibo-video relative rounded-lg overflow-hidden bg-gray-900 mt-2">
    <!-- 视频封面占位 -->
    <div class="aspect-video bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center relative">
      <!-- 封面文字描述 -->
      <div class="absolute inset-0 p-4 flex flex-col items-center justify-center text-center">
        <i class="fas fa-video text-white/30 text-4xl mb-3"></i>
        <p class="text-white/60 text-sm leading-relaxed max-w-[80%] line-clamp-3">
          {{ coverText }}
        </p>
      </div>
      
      <!-- 播放按钮 -->
      <div class="absolute inset-0 flex items-center justify-center">
        <div class="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm cursor-pointer hover:bg-white/30 transition-colors">
          <i class="fas fa-play text-white text-2xl ml-1"></i>
        </div>
      </div>
      
      <!-- 时长标签 -->
      <div 
        v-if="formattedDuration"
        class="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-0.5 rounded"
      >
        {{ formattedDuration }}
      </div>
      
      <!-- 视频图标标签 -->
      <div class="absolute top-2 left-2 bg-orange-500/90 text-white text-xs px-2 py-0.5 rounded flex items-center">
        <i class="fas fa-video mr-1"></i>
        视频
      </div>
    </div>
    
    <!-- 视频描述 -->
    <div v-if="displayDescription" class="p-3 bg-gray-800">
      <p class="text-white/80 text-sm leading-relaxed line-clamp-2">
        {{ displayDescription }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.weibo-video {
  max-width: 100%;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
