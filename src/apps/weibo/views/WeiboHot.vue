<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useWeiboStore } from '@/stores/weiboStore';
import { useLLMTaskStore } from '../stores';
import { storeToRefs } from 'pinia';

const store = useWeiboStore();
const llmTaskStore = useLLMTaskStore();
const { currentCategory, currentHotSearch, isLoading } = storeToRefs(store);

// 更新热榜状态
const isUpdating = ref(false);

// 页面加载时刷新热搜
onMounted(async () => {
  // 初始化内置任务
  llmTaskStore.initializeBuiltinTasks();
  
  if (currentHotSearch.value.length === 0) {
    await store.refreshHotSearch();
  }
});

/**
 * 更新热榜
 * 触发更新热榜任务（只执行一次）
 */
async function handleUpdateTrending() {
  if (isUpdating.value) return;
  
  isUpdating.value = true;
  
  try {
    // 查找更新热榜的内置任务
    // 新系统任务定义 ID 格式: weibo:update-trending，builtinId 为 update-trending
    const updateTrendingTask = llmTaskStore.builtinTasks.find(
      t => t.builtinId === 'update-trending' || t.builtinId === 'weibo-update-trending'
    );
    
    if (updateTrendingTask) {
      // 执行任务（只执行一次）
      await llmTaskStore.executeTask(updateTrendingTask.id);
      // 刷新热搜列表
      await store.refreshHotSearch();
    } else {
      console.warn('[WeiboHot] 未找到更新热榜任务');
      // 降级：使用普通刷新
      await store.refreshHotSearch();
    }
  } catch (error) {
    console.error('[WeiboHot] 更新热榜失败:', error);
  } finally {
    isUpdating.value = false;
  }
}

const categories = ['我的', '热搜', '文娱', '生活', '社会', '同城', '体育', 'ACG', '科技'];

// Banner configurations for different categories
const bannerConfigs: Record<string, any> = {
  '热搜': {
    gradient: 'from-orange-500 to-orange-400',
    iconColor: 'text-yellow-200',
    titleParts: ['微', '博', '热', '搜'],
    hotIndex: 2, // Index of the character that has the 'hot' icon
    slogan: '懂你的热点雷达',
    iconClass: 'fas fa-bolt'
  },
  '文娱': {
    gradient: 'from-pink-500 to-pink-400',
    iconColor: 'text-pink-200',
    titleParts: ['文', '娱', '热', '搜'],
    hotIndex: -1, 
    slogan: '按圈内实时热度排序',
    iconClass: 'fas fa-star' // Decorative
  },
  '生活': {
    gradient: 'from-orange-400 to-yellow-400',
    iconColor: 'text-white',
    titleParts: ['生', '活', '热', '搜'],
    hotIndex: -1,
    slogan: '专治无聊的快乐处方',
    iconClass: 'fas fa-glass-cheers'
  },
  '社会': {
    gradient: 'from-blue-400 to-cyan-400',
    iconColor: 'text-white',
    titleParts: ['社', '会', '热', '搜'],
    hotIndex: -1,
    slogan: '社会热点，每分钟更新一次',
    iconClass: 'fas fa-newspaper'
  },
  '同城': {
    gradient: 'from-green-500 to-green-400',
    iconColor: 'text-white',
    titleParts: ['同', '城', '热', '搜'],
    hotIndex: -1,
    slogan: '汇聚同城最热资讯',
    iconClass: 'fas fa-city'
  },
  '体育': {
    gradient: 'from-red-600 to-orange-600',
    iconColor: 'text-yellow-300',
    titleParts: ['体', '育', '热', '搜'],
    hotIndex: -1,
    slogan: '连接场内外热爱',
    iconClass: 'fas fa-running'
  },
  'ACG': {
    gradient: 'from-pink-500 to-purple-500',
    iconColor: 'text-white',
    titleParts: ['A', 'C', 'G', '热', '搜'],
    hotIndex: -1,
    slogan: '解锁次元新动向',
    iconClass: 'fas fa-gamepad'
  },
  '科技': {
    gradient: 'from-blue-600 to-blue-500',
    iconColor: 'text-cyan-200',
    titleParts: ['科', '技', '热', '搜'],
    hotIndex: -1,
    slogan: '洞悉行业发展新趋势',
    iconClass: 'fas fa-robot'
  }
};

const currentBanner = computed(() => {
  return bannerConfigs[currentCategory.value] || bannerConfigs['热搜'];
});

const isCityTab = computed(() => currentCategory.value === '同城');

// 格式化热度数字
function formatHeat(heat: number): string {
  if (heat < 10000) {
    return heat.toString();
  } else if (heat < 100000000) {
    const wan = heat / 10000;
    if (wan < 10) {
      return `${wan.toFixed(1)}万`;
    } else {
      return `${Math.floor(wan)}万`;
    }
  } else {
    const yi = heat / 100000000;
    return `${yi.toFixed(1)}亿`;
  }
}
</script>

<template>
  <div class="h-full flex flex-col bg-white">
    <!-- Search Bar (Image 3 style) -->
    <div class="p-2 bg-white flex items-center sticky top-0 z-20">
      <div class="flex-1 bg-gray-100 rounded-full flex items-center px-4 py-1.5 mx-2">
        <i class="fas fa-search text-gray-400 mr-2 text-sm"></i>
        <input 
          type="text" 
          placeholder="大家正在搜: 张泽禹直播" 
          class="bg-transparent text-sm w-full outline-none placeholder-gray-400 text-gray-700"
        />
      </div>
      <!-- 更新热榜按钮 -->
      <button 
        @click="handleUpdateTrending"
        :disabled="isUpdating"
        class="w-8 h-8 rounded-full flex items-center justify-center mr-1 transition-colors"
        :class="isUpdating ? 'text-gray-300' : 'text-gray-500 hover:bg-gray-100 hover:text-orange-500'"
        title="更新热榜"
      >
        <i :class="['fas', isUpdating ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles']"></i>
      </button>
      <span class="text-orange-500 text-base font-bold mr-2">搜索</span>
    </div>

    <!-- Scrollable Area -->
    <div class="flex-1 overflow-y-auto hide-scrollbar">
      
      <!-- Dynamic Banner -->
      <div :class="['bg-gradient-to-r p-4 pb-2 text-white relative overflow-hidden', currentBanner.gradient]">
        <!-- Background decorative circles -->
        <div class="absolute top-0 left-10 w-32 h-32 border-[10px] border-white/10 rounded-full"></div>
        <div class="absolute -top-10 right-10 w-40 h-40 border-[20px] border-white/10 rounded-full"></div>
        
        <!-- Decorative Icon (Big background) -->
         <div class="absolute -bottom-4 right-4 opacity-20 text-6xl rotate-12">
           <i :class="currentBanner.iconClass"></i>
         </div>

        <div class="relative z-10">
          <div class="flex items-center text-3xl font-black italic tracking-wider" style="font-family: 'Arial Black', sans-serif;">
            <template v-for="(char, idx) in currentBanner.titleParts" :key="idx">
              <span class="relative mr-0.5">
                {{ char }}
                <i v-if="idx === currentBanner.hotIndex" 
                   :class="[currentBanner.iconClass, currentBanner.iconColor, 'absolute -top-2 -right-3 text-lg']"></i>
              </span>
            </template>
          </div>
          <div class="text-[11px] mt-2 opacity-90 tracking-widest font-medium">{{ currentBanner.slogan }}</div>
        </div>
      </div>

      <!-- Category Tabs -->
      <div class="sticky top-0 bg-white z-10 border-b border-gray-100 flex items-center px-2 py-2 overflow-x-auto hide-scrollbar">
        <button 
          v-for="cat in categories" 
          :key="cat"
          @click="store.setCategory(cat)"
          class="whitespace-nowrap px-4 py-1 text-base font-bold transition-all relative"
          :class="currentCategory === cat ? 'text-black text-lg' : 'text-gray-500'"
        >
          {{ cat }}
          <div v-if="currentCategory === cat" class="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-4 h-1 bg-orange-500 rounded-full"></div>
        </button>
      </div>

      <!-- City Location Bar (Only for City Tab) -->
      <div v-if="isCityTab" class="px-4 py-3 bg-white border-b border-gray-100 flex items-center justify-between">
        <div class="flex items-center text-black font-bold text-base">
          <div class="w-5 h-5 bg-green-500 rounded text-white flex items-center justify-center mr-2 text-xs">
            <i class="fas fa-map-marker-alt"></i>
          </div>
          当前城市：桂林
        </div>
        <div class="text-xs text-gray-400">点击切换</div>
      </div>

      <!-- Info Bar (Hidden for City Tab as it has its own) -->
      <div v-else class="px-4 py-2 bg-gray-50 text-xs text-gray-400 flex items-center">
        <span>{{ currentBanner.slogan }}</span>
      </div>

      <!-- List -->
      <div class="pb-4 bg-white">
        <!-- 加载状态 -->
        <div v-if="(isUpdating || isLoading) && currentHotSearch.length === 0" class="py-12 text-center">
          <i class="fas fa-spinner fa-spin text-3xl text-orange-400 mb-3"></i>
          <p class="text-sm text-gray-400">
            {{ isUpdating ? '正在生成热搜...' : '正在加载热搜...' }}
          </p>
        </div>
        
        <!-- 空状态 -->
        <div v-else-if="currentHotSearch.length === 0" class="py-12 text-center">
          <i class="fas fa-fire-alt text-4xl text-gray-300 mb-3"></i>
          <p class="text-sm text-gray-400 mb-2">暂无热搜数据</p>
          <p class="text-xs text-gray-400 mb-4">点击上方按钮生成热搜</p>
          <button 
            @click="handleUpdateTrending"
            :disabled="isUpdating"
            class="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm"
          >
            <i :class="['fas mr-1', isUpdating ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles']"></i>
            生成热搜
          </button>
        </div>
        
        <!-- 正在更新提示 -->
        <div v-if="isUpdating && currentHotSearch.length > 0" class="py-2 text-center text-xs text-orange-500">
          <i class="fas fa-spinner fa-spin mr-1"></i>
          正在生成新热搜...
        </div>
        
        <!-- 热搜列表 -->
        <div 
          v-for="(item, index) in currentHotSearch" 
          :key="index"
          class="flex items-start py-3 px-4 border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer"
        >
          <!-- Rank Number/Icon -->
          <div class="mr-3 mt-0.5 flex flex-col items-center justify-center w-6">
            <div v-if="item.isTop" class="text-red-500 text-sm">
              <i class="fas fa-arrow-up"></i>
            </div>
            <div 
              v-else
              class="font-bold text-base italic"
              :class="[
                item.rank <= 3 ? 'text-red-500' : 'text-orange-300'
              ]"
            >
              {{ item.rank }}
            </div>
          </div>

          <!-- Content -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center">
              <span class="text-[15px] text-[#333] font-medium truncate">{{ item.title }}</span>
              <!-- Tag -->
              <span v-if="item.tag === 'hot'" class="ml-2 bg-orange-500 text-white text-[10px] px-1 rounded flex items-center justify-center h-4">热</span>
              <span v-if="item.tag === 'new'" class="ml-2 bg-red-500 text-white text-[10px] px-1 rounded flex items-center justify-center h-4">新</span>
              <span v-if="item.tag === 'entertainment'" class="ml-2 bg-purple-500 text-white text-[10px] px-1 rounded flex items-center justify-center h-4">娱</span>
              <span v-if="item.tag === 'boil'" class="ml-2 bg-red-600 text-white text-[10px] px-1 rounded flex items-center justify-center h-4">沸</span>
              
              <!-- Text Tag -->
              <span v-if="item.tagType === 'text'" class="ml-2 text-gray-400 text-[10px] border border-gray-200 px-1 rounded h-4 flex items-center">{{ item.tagText }}</span>
            </div>
            
            <div class="mt-1 text-xs text-gray-400">
              <span v-if="isCityTab">同城热度 {{ item.heatFormatted || item.heat }}</span>
              <span v-else-if="item.heat > 0">{{ item.heatFormatted || formatHeat(item.heat) }}</span>
            </div>
          </div>

          <!-- Right Icon (optional hot indicator) -->
          <div v-if="item.tag === 'hot' && !item.isTop" class="ml-2">
            <span class="text-[10px] text-orange-500 bg-orange-50 px-1 rounded border border-orange-100">热</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hide-scrollbar::-webkit-scrollbar {
  display: none;
}
.hide-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
