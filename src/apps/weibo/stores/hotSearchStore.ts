/**
 * 微博热搜 Store
 * 管理热搜榜单、热度计算、LLM 热搜生成
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { HotSearchItem } from '../types';
import { db } from '@/services/database';
import { TrendService } from '@/services/social/trendService';
import { writeQueue } from '@/services/database/writeQueue';
import { tryUseAppRuntime } from '@/services/appRuntime';
import { TrafficEngine } from '@/services/social/algorithm';
import type { TrendingTopic } from '@/types/social';
import { v4 as uuidv4 } from 'uuid';
import { 
  getSessionContext, 
  buildSourceFilter,
  syncContextFromNarrative 
} from '../services/sessionContext';
import { getCurrentSourceTracking } from './llm/sourceTracking';
import { loggerService } from '@/services/logger/loggerService';

/**
 * LLM 生成的热搜项类型
 */
export interface GeneratedHotItem {
  keyword: string;
  /** 热度值 (0-100)，可选，不提供时根据 isExplosive/isHot/isNew 自动生成 */
  heat?: number;
  category?: string;
  summary?: string;
  isNew?: boolean;
  isHot?: boolean;
  isExplosive?: boolean;
}

export const useHotSearchStore = defineStore('weiboHotSearch', () => {
  // ==================== 状态 ====================
  
  /** 热搜榜数据（按分类存储） */
  const hotSearches = ref<Record<string, HotSearchItem[]>>({});
  
  /** 当前热搜分类 */
  const currentCategory = ref('热搜');
  
  /** 是否正在加载 */
  const isLoading = ref(false);

  // ==================== 计算属性 ====================
  
  /** 当前分类的热搜列表 */
  const currentHotSearch = computed(() => hotSearches.value[currentCategory.value] || []);
  
  /** 热搜总数 */
  const totalCount = computed(() => {
    return Object.values(hotSearches.value).reduce((sum, list) => sum + list.length, 0);
  });

  // ==================== 方法 ====================
  
  /**
   * 设置热搜分类
   */
  function setCategory(category: string) {
    currentCategory.value = category;
    refreshHotSearch();
  }

  /**
   * 刷新热搜榜
   */
  async function refreshHotSearch() {
    const now = Date.now();
    
    loggerService.debug('HotSearchStore', '正在刷新热搜榜...');

    // 同步会话上下文
    syncContextFromNarrative();
    
    const runtime = tryUseAppRuntime();
    const namespace = runtime?.identity.dataNamespace;
    const ctx = getSessionContext();
    const sourceFilter = buildSourceFilter(ctx);

    const topics = await TrendService.getInstance().getTrendingList('weibo');
    loggerService.debug('HotSearchStore', `从 TrendService 获取到 ${topics.length} 条热搜`);

    // 按命名空间和来源过滤热搜
    const scopedTopics = topics.filter((t) => 
      (!namespace || !t.namespace || t.namespace === namespace) &&
      sourceFilter(t)
    );
    
    // 映射到 UI 模型，使用 TrafficEngine 计算热度和标签
    const items: HotSearchItem[] = scopedTopics.map((topic, index) => {
      const rank = index + 1;
      const heat = topic.currentHeat || TrafficEngine.calculateTopicHeat(topic, now);
      const heatDisplay = TrafficEngine.getHeatDisplay(heat, rank, topic.createdAt, now);
      
      // 根据热度等级确定标签
      let tag: 'hot' | 'new' | 'boil' | 'entertainment' | undefined;
      switch (heatDisplay.level) {
        case 'boil':
          tag = 'boil';
          break;
        case 'explode':
        case 'hot':
          tag = 'hot';
          break;
        case 'new':
          tag = 'new';
          break;
        default:
          tag = undefined;
      }
      
      return {
        rank,
        title: topic.keyword.replace(/#/g, ''),
        heat: heat,
        heatFormatted: heatDisplay.formatted,
        isTop: rank === 1 && heat >= 1000000,
        tag,
        tagType: 'icon' as const,
        createdAt: topic.createdAt,
      };
    });

    hotSearches.value[currentCategory.value] = items;
  }

  /**
   * 应用 LLM 生成的热搜结果到热搜榜
   * 会将热搜保存到数据库，并使用 TrafficEngine 计算热度
   * 
   * @param generatedItems LLM 生成的热搜项目数组
   * @param mode 合并模式：'replace' 替换全部 | 'prepend' 插入到头部 | 'append' 追加到尾部
   */
  async function applyGeneratedHotSearch(
    generatedItems: GeneratedHotItem[],
    mode: 'replace' | 'prepend' | 'append' = 'prepend'
  ): Promise<number> {
    const now = Date.now();
    
    // 将 LLM 生成的热搜保存到数据库
    const runtime = tryUseAppRuntime();
    const namespace = runtime?.identity.dataNamespace;

    const savedTopics: TrendingTopic[] = [];
    for (const item of generatedItems) {
      // 确定 baseScore
      let baseScore: number;
      if (item.heat && item.heat > 0) {
        baseScore = Math.min(100, Math.max(20, Math.pow(item.heat / 0.05, 1/3)));
      } else {
        if (item.isExplosive) {
          baseScore = 90 + Math.random() * 10;
        } else if (item.isHot) {
          baseScore = 70 + Math.random() * 20;
        } else if (item.isNew) {
          baseScore = 50 + Math.random() * 20;
        } else {
          baseScore = 30 + Math.random() * 40;
        }
      }
      
      // 获取来源追踪
      const sourceTracking = getCurrentSourceTracking();
      
      const topic: TrendingTopic = {
        id: uuidv4(),
        platformId: 'weibo',
        namespace,
        keyword: item.keyword.startsWith('#') ? item.keyword : `#${item.keyword}#`,
        summary: item.summary || item.keyword,
        categories: [item.category as any || 'general'],
        isNew: item.isNew ?? true,
        isHot: item.isHot || item.isExplosive || false,
        baseScore: Math.floor(baseScore),
        velocity: 0,
        createdAt: now - Math.floor(Math.random() * 1000 * 60 * 30),
        peakTime: now + (1000 * 60 * 60 * (2 + Math.random() * 10)),
        // 来源追踪（用于会话/楼层/Swipe 绑定）
        source: sourceTracking,
      };
      
      try {
        await writeQueue.enqueue('app', namespace || 'weibo', async () => {
          await db.socialTopics.add(topic);
        });
        savedTopics.push(topic);
        loggerService.debug('HotSearchStore', `已保存热搜到数据库: ${topic.keyword} (ID: ${topic.id})`);
      } catch (e) {
        loggerService.warn('HotSearchStore', '保存热搜话题失败:', e);
        savedTopics.push(topic);
      }
    }
    
    // 使用 TrafficEngine 计算热度并转换为 UI 模型
    const newItems: HotSearchItem[] = savedTopics.map((topic, index) => {
      const rank = index + 1;
      const heat = TrafficEngine.calculateTopicHeat(topic, now);
      const heatDisplay = TrafficEngine.getHeatDisplay(heat, rank, topic.createdAt, now);
      
      let tag: 'hot' | 'new' | 'boil' | 'entertainment' | undefined;
      switch (heatDisplay.level) {
        case 'boil': tag = 'boil'; break;
        case 'explode':
        case 'hot': tag = 'hot'; break;
        case 'new': tag = 'new'; break;
        default: tag = undefined;
      }
      
      return {
        rank,
        title: topic.keyword.replace(/#/g, ''),
        heat,
        heatFormatted: heatDisplay.formatted,
        isTop: false,
        tag,
        tagType: 'icon' as const,
        createdAt: topic.createdAt,
        topicId: topic.id,
      };
    });

    const category = currentCategory.value;
    const currentItems = hotSearches.value[category] || [];

    let mergedItems: HotSearchItem[];
    
    switch (mode) {
      case 'replace':
        mergedItems = newItems;
        break;
      case 'prepend':
        const newTitles = new Set(newItems.map(i => i.title));
        const filteredOld = currentItems.filter(i => !newTitles.has(i.title));
        mergedItems = [...newItems, ...filteredOld];
        break;
      case 'append':
        const existingTitles = new Set(currentItems.map(i => i.title));
        const trulyNew = newItems.filter(i => !existingTitles.has(i.title));
        mergedItems = [...currentItems, ...trulyNew];
        break;
    }

    // 重新计算热度并排序
    mergedItems = mergedItems
      .map(item => {
        if (item.createdAt) {
          const baseScore = Math.pow(item.heat / 0.05, 1/3);
          const recalculatedHeat = TrafficEngine.calculateSimpleHeat(
            Math.min(100, Math.max(1, baseScore)),
            item.createdAt,
            now
          );
          const heatDisplay = TrafficEngine.getHeatDisplay(
            recalculatedHeat,
            item.rank,
            item.createdAt,
            now
          );
          return {
            ...item,
            heat: recalculatedHeat,
            heatFormatted: heatDisplay.formatted,
          };
        }
        return item;
      })
      .sort((a, b) => (b.heat || 0) - (a.heat || 0))
      .slice(0, 50)
      .map((item, idx) => {
        const rank = idx + 1;
        const heatDisplay = TrafficEngine.getHeatDisplay(
          item.heat || 0,
          rank,
          item.createdAt || now,
          now
        );
        
        let tag: 'hot' | 'new' | 'boil' | 'entertainment' | undefined;
        switch (heatDisplay.level) {
          case 'boil': tag = 'boil'; break;
          case 'explode':
          case 'hot': tag = 'hot'; break;
          case 'new': tag = 'new'; break;
          default: tag = undefined;
        }
        
        return {
          ...item,
          rank,
          isTop: rank === 1 && (item.heat || 0) >= 1000000,
          tag,
          heatFormatted: heatDisplay.formatted,
        };
      });

    hotSearches.value[category] = mergedItems;
    
    loggerService.info('HotSearchStore', `已应用 ${newItems.length} 条 LLM 生成的热搜，当前共 ${mergedItems.length} 条`);
    
    return mergedItems.length;
  }

  /**
   * 从 JSON 字符串解析并应用热搜
   * @param jsonOutput LLM 输出的 JSON 字符串
   * @param mode 合并模式
   */
  async function applyHotSearchFromJSON(
    jsonOutput: string,
    mode: 'replace' | 'prepend' | 'append' = 'prepend'
  ): Promise<{ success: boolean; count: number; error?: string }> {
    try {
      // 移除可能的 markdown 代码块
      let cleanJson = jsonOutput.trim();
      if (cleanJson.startsWith('```json')) {
        cleanJson = cleanJson.slice(7);
      } else if (cleanJson.startsWith('```')) {
        cleanJson = cleanJson.slice(3);
      }
      if (cleanJson.endsWith('```')) {
        cleanJson = cleanJson.slice(0, -3);
      }
      cleanJson = cleanJson.trim();
      
      const parsed = JSON.parse(cleanJson);
      const items: GeneratedHotItem[] = Array.isArray(parsed) ? parsed : [parsed];
      
      const validItems = items.filter(item => 
        item && typeof item === 'object' && item.keyword
      );
      
      if (validItems.length === 0) {
        return { success: false, count: 0, error: '没有有效的热搜数据' };
      }
      
      const count = await applyGeneratedHotSearch(validItems, mode);
      return { success: true, count };
    } catch (e: any) {
      loggerService.error('HotSearchStore', '解析热搜 JSON 失败:', e);
      return { success: false, count: 0, error: e.message || '解析失败' };
    }
  }

  /**
   * 清除热搜榜数据
   */
  async function clearHotSearches(): Promise<number> {
    const runtime = tryUseAppRuntime();
    const namespace = runtime?.identity.dataNamespace;

    const allTopics = await db.socialTopics.toArray();
    const weiboTopicIds = allTopics
      .filter(t => t.platformId === 'weibo' && (!namespace || t.namespace === namespace))
      .map(t => t.id);
    
    loggerService.debug('HotSearchStore', `找到 ${weiboTopicIds.length} 条微博热搜待删除`);
    
    if (weiboTopicIds.length > 0) {
      await writeQueue.enqueue('app', namespace || 'weibo', async () => {
        await db.socialTopics.bulkDelete(weiboTopicIds);
      });
    }
    
    hotSearches.value = {};
    
    loggerService.info('HotSearchStore', `已清除 ${weiboTopicIds.length} 条热搜`);
    return weiboTopicIds.length;
  }

  /**
   * 获取热搜数量统计
   */
  async function getHotSearchCount(): Promise<number> {
    const runtime = tryUseAppRuntime();
    const namespace = runtime?.identity.dataNamespace;

    const allTopics = await db.socialTopics.toArray();
    return allTopics.filter(t => t.platformId === 'weibo' && (!namespace || t.namespace === namespace)).length;
  }

  return {
    // 状态
    hotSearches,
    currentCategory,
    isLoading,
    
    // 计算属性
    currentHotSearch,
    totalCount,
    
    // 方法
    setCategory,
    refreshHotSearch,
    applyGeneratedHotSearch,
    applyHotSearchFromJSON,
    clearHotSearches,
    getHotSearchCount,
  };
});
