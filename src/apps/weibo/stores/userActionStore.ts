/**
 * 微博用户行为 Store
 * 管理点赞、收藏、浏览历史等用户交互数据
 * 
 * 重构说明（Phase 5）：
 * - 从 localStorage 迁移到 ScopedStorage（AppRuntime.storage）
 * - 数据按 App 命名空间隔离
 * - 支持从 localStorage 迁移旧数据
 * - 支持按会话隔离（可选）
 */

import { defineStore } from 'pinia';
import { ref, computed, shallowRef } from 'vue';
import type { UserAction, ViewHistory } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { tryUseAppRuntime } from '@/services/appRuntime';
import type { ScopedStorage } from '@/services/appRuntime/types';
import { getNarrativeCacheMetadata } from './llm/narrativeIntegration';
import type { ContentSourceTracking } from '@/types/social';
import { loggerService } from '@/services/logger/loggerService';

// 存储键名（ScopedStorage）
const STORAGE_KEYS = {
  LIKES: 'user_likes',
  FAVORITES: 'user_favorites',
  VIEW_HISTORY: 'view_history',
  MIGRATED: 'data_migrated_v1',  // 标记是否已迁移
};

// 旧版 localStorage 键名（用于迁移）
const LEGACY_STORAGE_KEYS = {
  LIKES: 'weibo_user_likes',
  FAVORITES: 'weibo_user_favorites',
  VIEW_HISTORY: 'weibo_view_history',
};

/**
 * 扩展的用户行为类型，包含来源追踪
 */
export interface UserActionWithSource extends UserAction {
  source?: ContentSourceTracking;
}

/**
 * 扩展的浏览历史类型，包含来源追踪
 */
export interface ViewHistoryWithSource extends ViewHistory {
  source?: ContentSourceTracking;
}

export const useUserActionStore = defineStore('weiboUserAction', () => {
  // ==================== 状态 ====================
  
  /** 点赞记录（包含来源追踪） */
  const likes = ref<UserActionWithSource[]>([]);
  
  /** 收藏记录（包含来源追踪） */
  const favorites = ref<UserActionWithSource[]>([]);
  
  /** 浏览历史（包含来源追踪） */
  const viewHistory = ref<ViewHistoryWithSource[]>([]);
  
  /** 当前用户 ID */
  const currentUserId = ref<string | null>(null);
  
  /** 是否已初始化 */
  const isInitialized = ref(false);
  
  /** 是否正在加载 */
  const isLoading = ref(false);
  
  /** 缓存的 storage 引用 */
  const cachedStorage = shallowRef<ScopedStorage | null>(null);
  
  /** 是否按会话过滤数据（默认关闭，显示所有数据） */
  const filterBySession = ref(false);
  
  /** 当前会话 ID（用于过滤） */
  const currentSessionId = ref<string | null>(null);

  // ==================== 计算属性 ====================
  
  /** 点赞数量（考虑会话过滤） */
  const likeCount = computed(() => {
    if (!filterBySession.value || !currentSessionId.value) {
      return likes.value.length;
    }
    return likes.value.filter(l => 
      !l.source?.sessionId || l.source.sessionId === currentSessionId.value
    ).length;
  });
  
  /** 收藏数量（考虑会话过滤） */
  const favoriteCount = computed(() => {
    if (!filterBySession.value || !currentSessionId.value) {
      return favorites.value.length;
    }
    return favorites.value.filter(f => 
      !f.source?.sessionId || f.source.sessionId === currentSessionId.value
    ).length;
  });
  
  /** 浏览历史数量（考虑会话过滤） */
  const viewHistoryCount = computed(() => {
    if (!filterBySession.value || !currentSessionId.value) {
      return viewHistory.value.length;
    }
    return viewHistory.value.filter(v => 
      !v.source?.sessionId || v.source.sessionId === currentSessionId.value
    ).length;
  });

  // ==================== 私有方法 ====================
  
  /**
   * 获取 ScopedStorage
   * 优先使用缓存，避免重复查找 runtime
   */
  function getStorage(): ScopedStorage | null {
    if (cachedStorage.value) {
      return cachedStorage.value;
    }
    
    const runtime = tryUseAppRuntime();
    if (runtime) {
      cachedStorage.value = runtime.storage;
      return runtime.storage;
    }
    
    return null;
  }
  
  /**
   * 获取当前来源追踪信息
   */
  function getCurrentSourceTracking(): ContentSourceTracking | undefined {
    const metadata = getNarrativeCacheMetadata();
    
    if (!metadata?.sessionId) {
      return undefined;
    }
    
    return {
      sessionId: metadata.sessionId,
      sourceMessageId: metadata.messageId,
      sourceSwipeId: metadata.swipeId,
      generatedAt: Date.now(),
    };
  }
  
  /**
   * 更新当前会话 ID
   */
  function updateCurrentSession(): void {
    const metadata = getNarrativeCacheMetadata();
    currentSessionId.value = metadata?.sessionId ?? null;
  }
  
  /**
   * 从 localStorage 迁移旧数据
   */
  async function migrateFromLocalStorage(storage: ScopedStorage): Promise<void> {
    // 检查是否已迁移
    const migrated = await storage.get<boolean>(STORAGE_KEYS.MIGRATED);
    if (migrated) {
      loggerService.debug('UserActionStore', '数据已迁移，跳过');
      return;
    }
    
    loggerService.info('UserActionStore', '开始从 localStorage 迁移数据...');
    
    try {
      // 迁移点赞
      const likesData = localStorage.getItem(LEGACY_STORAGE_KEYS.LIKES);
      if (likesData) {
        const parsedLikes = JSON.parse(likesData) as UserAction[];
        if (parsedLikes.length > 0) {
          await storage.set(STORAGE_KEYS.LIKES, parsedLikes);
          loggerService.info('UserActionStore', `迁移 ${parsedLikes.length} 条点赞记录`);
        }
      }
      
      // 迁移收藏
      const favoritesData = localStorage.getItem(LEGACY_STORAGE_KEYS.FAVORITES);
      if (favoritesData) {
        const parsedFavorites = JSON.parse(favoritesData) as UserAction[];
        if (parsedFavorites.length > 0) {
          await storage.set(STORAGE_KEYS.FAVORITES, parsedFavorites);
          loggerService.info('UserActionStore', `迁移 ${parsedFavorites.length} 条收藏记录`);
        }
      }
      
      // 迁移浏览历史
      const historyData = localStorage.getItem(LEGACY_STORAGE_KEYS.VIEW_HISTORY);
      if (historyData) {
        const parsedHistory = JSON.parse(historyData) as ViewHistory[];
        if (parsedHistory.length > 0) {
          await storage.set(STORAGE_KEYS.VIEW_HISTORY, parsedHistory);
          loggerService.info('UserActionStore', `迁移 ${parsedHistory.length} 条浏览历史`);
        }
      }
      
      // 标记已迁移
      await storage.set(STORAGE_KEYS.MIGRATED, true);
      
      // 清理旧数据（可选，暂时保留作为备份）
      // localStorage.removeItem(LEGACY_STORAGE_KEYS.LIKES);
      // localStorage.removeItem(LEGACY_STORAGE_KEYS.FAVORITES);
      // localStorage.removeItem(LEGACY_STORAGE_KEYS.VIEW_HISTORY);
      
      loggerService.info('UserActionStore', '数据迁移完成');
    } catch (error) {
      loggerService.error('UserActionStore', '数据迁移失败:', error);
    }
  }
  
  /**
   * 从 ScopedStorage 加载数据
   */
  async function loadFromStorage(): Promise<void> {
    const storage = getStorage();
    if (!storage) {
      loggerService.warn('UserActionStore', 'ScopedStorage 不可用，使用空数据');
      return;
    }
    
    try {
      // 先尝试迁移旧数据
      await migrateFromLocalStorage(storage);
      
      // 加载点赞
      const likesData = await storage.get<UserAction[]>(STORAGE_KEYS.LIKES);
      if (likesData) {
        likes.value = likesData;
      }
      
      // 加载收藏
      const favoritesData = await storage.get<UserAction[]>(STORAGE_KEYS.FAVORITES);
      if (favoritesData) {
        favorites.value = favoritesData;
      }
      
      // 加载浏览历史
      const historyData = await storage.get<ViewHistory[]>(STORAGE_KEYS.VIEW_HISTORY);
      if (historyData) {
        viewHistory.value = historyData;
      }
      
      loggerService.info('UserActionStore', '从 ScopedStorage 加载完成:', {
        likes: likes.value.length,
        favorites: favorites.value.length,
        viewHistory: viewHistory.value.length,
      });
    } catch (error) {
      loggerService.error('UserActionStore', '加载数据失败:', error);
    }
  }
  
  /**
   * 保存点赞到 ScopedStorage
   */
  async function saveLikesToStorage(): Promise<void> {
    const storage = getStorage();
    if (!storage) {
      loggerService.warn('UserActionStore', 'ScopedStorage 不可用，点赞未保存');
      return;
    }
    
    try {
      await storage.set(STORAGE_KEYS.LIKES, likes.value);
    } catch (error) {
      loggerService.error('UserActionStore', '保存点赞失败:', error);
    }
  }
  
  /**
   * 保存收藏到 ScopedStorage
   */
  async function saveFavoritesToStorage(): Promise<void> {
    const storage = getStorage();
    if (!storage) {
      loggerService.warn('UserActionStore', 'ScopedStorage 不可用，收藏未保存');
      return;
    }
    
    try {
      await storage.set(STORAGE_KEYS.FAVORITES, favorites.value);
    } catch (error) {
      loggerService.error('UserActionStore', '保存收藏失败:', error);
    }
  }
  
  /**
   * 保存浏览历史到 ScopedStorage
   */
  async function saveViewHistoryToStorage(): Promise<void> {
    const storage = getStorage();
    if (!storage) {
      loggerService.warn('UserActionStore', 'ScopedStorage 不可用，浏览历史未保存');
      return;
    }
    
    try {
      await storage.set(STORAGE_KEYS.VIEW_HISTORY, viewHistory.value);
    } catch (error) {
      loggerService.error('UserActionStore', '保存浏览历史失败:', error);
    }
  }

  // ==================== 公开方法 ====================
  
  /**
   * 初始化（加载本地数据）
   */
  async function initialize(userId: string): Promise<void> {
    if (isLoading.value) {
      loggerService.debug('UserActionStore', '正在初始化中，跳过');
      return;
    }
    
    isLoading.value = true;
    currentUserId.value = userId;
    
    try {
      await loadFromStorage();
      
      // 过滤出当前用户的数据
      likes.value = likes.value.filter(l => l.userId === userId);
      favorites.value = favorites.value.filter(f => f.userId === userId);
      viewHistory.value = viewHistory.value.filter(v => v.userId === userId);
      
      isInitialized.value = true;
      loggerService.info('UserActionStore', '初始化完成，用户:', userId);
    } finally {
      isLoading.value = false;
    }
  }
  
  /**
   * 检查是否已点赞
   */
  function isLiked(targetId: string, targetType: 'post' | 'comment' = 'post'): boolean {
    return likes.value.some(
      l => l.targetId === targetId && l.targetType === targetType
    );
  }
  
  /**
   * 检查是否已收藏
   */
  function isFavorited(targetId: string): boolean {
    return favorites.value.some(f => f.targetId === targetId);
  }
  
  /**
   * 点赞/取消点赞
   */
  async function toggleLike(targetId: string, targetType: 'post' | 'comment' = 'post'): Promise<boolean> {
    if (!currentUserId.value) {
      loggerService.warn('UserActionStore', 'No user logged in');
      return false;
    }
    
    const existingIndex = likes.value.findIndex(
      l => l.targetId === targetId && l.targetType === targetType
    );
    
    if (existingIndex !== -1) {
      // 取消点赞
      likes.value.splice(existingIndex, 1);
      await saveLikesToStorage();
      loggerService.debug('UserActionStore', '取消点赞:', targetId);
      return false;
    } else {
      // 添加点赞，包含来源追踪
      const action: UserActionWithSource = {
        id: uuidv4(),
        userId: currentUserId.value,
        platformId: 'weibo',
        targetType,
        targetId,
        actionType: 'like',
        createdAt: Date.now(),
        source: getCurrentSourceTracking(),
      };
      likes.value.push(action);
      await saveLikesToStorage();
      loggerService.debug('UserActionStore', '点赞:', targetId);
      return true;
    }
  }
  
  /**
   * 收藏/取消收藏
   */
  async function toggleFavorite(targetId: string): Promise<boolean> {
    if (!currentUserId.value) {
      loggerService.warn('UserActionStore', 'No user logged in');
      return false;
    }
    
    const existingIndex = favorites.value.findIndex(f => f.targetId === targetId);
    
    if (existingIndex !== -1) {
      // 取消收藏
      favorites.value.splice(existingIndex, 1);
      await saveFavoritesToStorage();
      loggerService.debug('UserActionStore', '取消收藏:', targetId);
      return false;
    } else {
      // 添加收藏，包含来源追踪
      const action: UserActionWithSource = {
        id: uuidv4(),
        userId: currentUserId.value,
        platformId: 'weibo',
        targetType: 'post',
        targetId,
        actionType: 'favorite',
        createdAt: Date.now(),
        source: getCurrentSourceTracking(),
      };
      favorites.value.push(action);
      await saveFavoritesToStorage();
      loggerService.debug('UserActionStore', '收藏:', targetId);
      return true;
    }
  }
  
  /**
   * 添加浏览历史
   */
  async function addViewHistory(postId: string, duration?: number): Promise<void> {
    if (!currentUserId.value) {
      return;
    }
    
    // 检查是否已存在，存在则更新时间
    const existingIndex = viewHistory.value.findIndex(v => v.postId === postId);
    
    if (existingIndex !== -1) {
      // 移动到最前面
      const [existing] = viewHistory.value.splice(existingIndex, 1);
      existing.viewedAt = Date.now();
      if (duration !== undefined) {
        existing.duration = (existing.duration || 0) + duration;
      }
      // 更新来源追踪（使用最新的会话上下文）
      existing.source = getCurrentSourceTracking();
      viewHistory.value.unshift(existing);
    } else {
      // 新增记录，包含来源追踪
      const record: ViewHistoryWithSource = {
        id: uuidv4(),
        userId: currentUserId.value,
        platformId: 'weibo',
        postId,
        viewedAt: Date.now(),
        duration,
        source: getCurrentSourceTracking(),
      };
      viewHistory.value.unshift(record);
      
      // 限制历史记录数量（最多保留 200 条）
      if (viewHistory.value.length > 200) {
        viewHistory.value = viewHistory.value.slice(0, 200);
      }
    }
    
    await saveViewHistoryToStorage();
  }
  
  /**
   * 获取点赞的博文 ID 列表（考虑会话过滤）
   */
  function getLikedPostIds(): string[] {
    let filtered = likes.value.filter(l => l.targetType === 'post');
    
    // 按会话过滤
    if (filterBySession.value && currentSessionId.value) {
      filtered = filtered.filter(l => 
        !l.source?.sessionId || l.source.sessionId === currentSessionId.value
      );
    }
    
    return filtered
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(l => l.targetId);
  }
  
  /**
   * 获取收藏的博文 ID 列表（考虑会话过滤）
   */
  function getFavoritedPostIds(): string[] {
    let filtered = favorites.value;
    
    // 按会话过滤
    if (filterBySession.value && currentSessionId.value) {
      filtered = filtered.filter(f => 
        !f.source?.sessionId || f.source.sessionId === currentSessionId.value
      );
    }
    
    return filtered
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(f => f.targetId);
  }
  
  /**
   * 获取浏览历史博文 ID 列表（考虑会话过滤）
   */
  function getViewHistoryPostIds(): string[] {
    let filtered = viewHistory.value;
    
    // 按会话过滤
    if (filterBySession.value && currentSessionId.value) {
      filtered = filtered.filter(v => 
        !v.source?.sessionId || v.source.sessionId === currentSessionId.value
      );
    }
    
    return filtered
      .sort((a, b) => b.viewedAt - a.viewedAt)
      .map(v => v.postId);
  }
  
  /**
   * 清空浏览历史
   */
  async function clearViewHistory(): Promise<void> {
    viewHistory.value = [];
    await saveViewHistoryToStorage();
    loggerService.info('UserActionStore', '浏览历史已清空');
  }
  
  /**
   * 删除单条浏览历史
   */
  async function removeViewHistory(postId: string): Promise<void> {
    const index = viewHistory.value.findIndex(v => v.postId === postId);
    if (index !== -1) {
      viewHistory.value.splice(index, 1);
      await saveViewHistoryToStorage();
    }
  }
  
  /**
   * 获取存储使用情况
   */
  async function getStorageUsage(): Promise<{ count: number; estimatedSize: number } | null> {
    const storage = getStorage();
    if (!storage) {
      return null;
    }
    return storage.getUsage();
  }
  
  /**
   * 设置是否按会话过滤
   */
  function setFilterBySession(enabled: boolean): void {
    filterBySession.value = enabled;
    if (enabled) {
      updateCurrentSession();
    }
    loggerService.debug('UserActionStore', '会话过滤:', enabled ? '开启' : '关闭');
  }
  
  /**
   * 同步会话上下文（在 swipe 切换时调用）
   */
  function syncSessionContext(): void {
    updateCurrentSession();
  }

  return {
    // 状态
    likes,
    favorites,
    viewHistory,
    currentUserId,
    isInitialized,
    isLoading,
    
    // 计算属性
    likeCount,
    favoriteCount,
    viewHistoryCount,
    
    // 会话过滤相关
    filterBySession,
    currentSessionId,
    
    // 方法
    initialize,
    isLiked,
    isFavorited,
    toggleLike,
    toggleFavorite,
    addViewHistory,
    getLikedPostIds,
    getFavoritedPostIds,
    getViewHistoryPostIds,
    clearViewHistory,
    removeViewHistory,
    getStorageUsage,
    setFilterBySession,
    syncSessionContext,
  };
});
