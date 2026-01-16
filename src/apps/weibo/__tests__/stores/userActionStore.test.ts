/**
 * userActionStore 单元测试
 * 测试用户行为（点赞、收藏、浏览历史）管理
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useUserActionStore } from '../../stores/userActionStore';
import { createMockLocalStorage } from '../setup';

describe('userActionStore', () => {
  let store: ReturnType<typeof useUserActionStore>;
  let mockLocalStorage: ReturnType<typeof createMockLocalStorage>;

  beforeEach(() => {
    setActivePinia(createPinia());
    mockLocalStorage = createMockLocalStorage();
    
    // Mock localStorage
    vi.stubGlobal('localStorage', mockLocalStorage);
    
    store = useUserActionStore();
    store.initialize('test_user_id');
  });

  describe('initialize', () => {
    it('应正确初始化用户 ID', () => {
      expect(store.currentUserId).toBe('test_user_id');
    });

    it('应从 localStorage 加载已有数据', () => {
      const existingLikes = JSON.stringify([{
        id: 'like_1',
        userId: 'test_user_id',
        platformId: 'weibo',
        targetType: 'post',
        targetId: 'post_123',
        actionType: 'like',
        createdAt: Date.now(),
      }]);
      mockLocalStorage.setItem('weibo_user_likes', existingLikes);

      // 重新创建 store
      setActivePinia(createPinia());
      const newStore = useUserActionStore();
      newStore.initialize('test_user_id');

      expect(newStore.likes.length).toBe(1);
    });
  });

  describe('点赞功能', () => {
    it('应正确添加点赞', () => {
      const result = store.toggleLike('post_123');

      expect(result).toBe(true);
      expect(store.isLiked('post_123')).toBe(true);
      expect(store.likeCount).toBe(1);
    });

    it('应正确取消点赞', () => {
      store.toggleLike('post_123');
      const result = store.toggleLike('post_123');

      expect(result).toBe(false);
      expect(store.isLiked('post_123')).toBe(false);
      expect(store.likeCount).toBe(0);
    });

    it('应支持评论点赞', () => {
      store.toggleLike('comment_123', 'comment');

      expect(store.isLiked('comment_123', 'comment')).toBe(true);
      expect(store.isLiked('comment_123', 'post')).toBe(false);
    });

    it('未登录时不应允许点赞', () => {
      store.currentUserId = null;
      const result = store.toggleLike('post_123');

      expect(result).toBe(false);
      expect(store.likeCount).toBe(0);
    });

    it('应持久化到 localStorage', () => {
      store.toggleLike('post_123');

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'weibo_user_likes',
        expect.any(String)
      );
    });

    it('应正确获取点赞的帖子 ID 列表', () => {
      store.toggleLike('post_1');
      store.toggleLike('post_2');
      store.toggleLike('comment_1', 'comment');

      const postIds = store.getLikedPostIds();

      expect(postIds).toContain('post_1');
      expect(postIds).toContain('post_2');
      expect(postIds).not.toContain('comment_1');
      expect(postIds).toHaveLength(2);
    });
  });

  describe('收藏功能', () => {
    it('应正确添加收藏', () => {
      const result = store.toggleFavorite('post_123');

      expect(result).toBe(true);
      expect(store.isFavorited('post_123')).toBe(true);
      expect(store.favoriteCount).toBe(1);
    });

    it('应正确取消收藏', () => {
      store.toggleFavorite('post_123');
      const result = store.toggleFavorite('post_123');

      expect(result).toBe(false);
      expect(store.isFavorited('post_123')).toBe(false);
      expect(store.favoriteCount).toBe(0);
    });

    it('未登录时不应允许收藏', () => {
      store.currentUserId = null;
      const result = store.toggleFavorite('post_123');

      expect(result).toBe(false);
    });

    it('应正确获取收藏的帖子 ID 列表', () => {
      store.toggleFavorite('post_a');
      store.toggleFavorite('post_b');

      const ids = store.getFavoritedPostIds();

      expect(ids).toContain('post_a');
      expect(ids).toContain('post_b');
      expect(ids).toHaveLength(2);
    });
  });

  describe('浏览历史', () => {
    it('应正确添加浏览记录', () => {
      store.addViewHistory('post_123');

      expect(store.viewHistoryCount).toBe(1);
      expect(store.getViewHistoryPostIds()).toContain('post_123');
    });

    it('重复浏览应更新时间而非新增记录', () => {
      store.addViewHistory('post_123');
      const firstTime = store.viewHistory[0].viewedAt;

      // 手动将第一次浏览时间设置为更早，模拟时间流逝
      store.viewHistory[0].viewedAt = firstTime - 1000;
      store.addViewHistory('post_123');

      expect(store.viewHistoryCount).toBe(1);
      expect(store.viewHistory[0].viewedAt).toBeGreaterThanOrEqual(firstTime);
    });

    it('应累计浏览时长', () => {
      store.addViewHistory('post_123', 30);
      store.addViewHistory('post_123', 20);

      expect(store.viewHistory[0].duration).toBe(50);
    });

    it('应限制历史记录数量', () => {
      // 添加超过 200 条记录
      for (let i = 0; i < 210; i++) {
        store.addViewHistory(`post_${i}`);
      }

      expect(store.viewHistoryCount).toBeLessThanOrEqual(200);
    });

    it('应正确清空浏览历史', () => {
      store.addViewHistory('post_1');
      store.addViewHistory('post_2');
      store.clearViewHistory();

      expect(store.viewHistoryCount).toBe(0);
    });

    it('应正确删除单条历史', () => {
      store.addViewHistory('post_1');
      store.addViewHistory('post_2');
      store.removeViewHistory('post_1');

      expect(store.viewHistoryCount).toBe(1);
      expect(store.getViewHistoryPostIds()).not.toContain('post_1');
    });

    it('未登录时不应记录历史', () => {
      store.currentUserId = null;
      store.addViewHistory('post_123');

      expect(store.viewHistoryCount).toBe(0);
    });

    it('历史应按时间倒序排列', () => {
      store.addViewHistory('post_old');
      // 模拟稍后浏览
      store.addViewHistory('post_new');

      const ids = store.getViewHistoryPostIds();

      expect(ids[0]).toBe('post_new');
      expect(ids[1]).toBe('post_old');
    });
  });
});
