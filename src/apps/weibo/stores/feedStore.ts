/**
 * 微博信息流 Store
 * 管理博文、评论、互动数据
 * 
 * Phase 3 重构完成：
 * - 统一使用 DisplayPost 类型
 * - 使用 UniversalPost.primaryType 替代 payload.type/postType
 * - 使用 UniversalPost.media 替代 payload.images
 * - 已移除 WeiboPostUI 依赖
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { WeiboUser, WeiboCommentUI, StoryItem, MessageItem, WeiboPollConfig, WeiboPollOption } from '../types';
import { stories as mockStories, messageGridItems as mockGrid, messageListItems as mockMessages } from '../data/mockData';
import { db } from '@/services/database';
import { TrendService } from '@/services/social/trendService';
import { writeQueue } from '@/services/database/writeQueue';
import { tryUseAppRuntime } from '@/services/appRuntime';
import { useSettingsStore } from './settingsStore';
import { 
  getSessionContext, 
  buildSourceFilter,
  syncContextFromNarrative 
} from '../services/sessionContext';
import { ContentFactory } from '@/services/social/contentFactory';
import { DirectorService } from '@/services/social/directorService';
import type { 
  UniversalPost, 
  PrimaryContentType, 
  MediaAsset, 
  PostPayload,
  DisplayPost,
  PostAuthor,
} from '@/types/social';
import { 
  convertImagesToMediaAssets, 
  buildContentFlags, 
  getWeiboPrimaryType,
  formatRelativeTime,
  getImagesFromPost as getImagesFromPostUtil,
  getPrimaryTypeFromPost as getPrimaryTypeFromPostUtil,
} from '@/types/social';
import { v4 as uuidv4 } from 'uuid';
import { PromptService } from '@/services/promptService';
import { useAIStore } from '@/stores/aiStore';
import { accountService } from '@/services/account/accountService';
import { UserPool } from '@/services/account/userPool';

export const useFeedStore = defineStore('weiboFeed', () => {
  // ==================== 状态 ====================
  
  /** 博文列表 */
  const displayPosts = ref<DisplayPost[]>([]);
  
  /** Stories 列表 */
  const stories = ref<StoryItem[]>([...mockStories]);
  
  /** 消息列表 */
  const messages = ref<MessageItem[]>([...mockMessages]);
  
  /** 消息网格 */
  const messageGrid = ref([...mockGrid]);
  
  /** 是否正在加载 */
  const isLoading = ref(false);
  
  /**
   * 获取自动生成配置（从 settingsStore 获取）
   * @deprecated 请直接使用 useSettingsStore().autoGenerateConfig
   */
  const autoGenerateConfig = computed(() => {
    try {
      const settingsStore = useSettingsStore();
      return settingsStore.autoGenerateConfig;
    } catch {
      // 如果 settingsStore 未初始化，返回默认值
      return {
        onEmptyFeed: false,
        onFewComments: false,
      };
    }
  });

  // ==================== 计算属性 ====================
  
  /** 博文总数 */
  const postCount = computed(() => displayPosts.value.length);

  // ==================== 方法 ====================
  
  /**
   * 刷新信息流
   */
  async function refreshFeed() {
    isLoading.value = true;

    // 同步会话上下文
    syncContextFromNarrative();
    
    const runtime = tryUseAppRuntime();
    const namespace = runtime?.identity.dataNamespace;
    const ctx = getSessionContext();
    const sourceFilter = buildSourceFilter(ctx);
    
    // 获取最新的 UniversalPost（按平台 + 命名空间 + 来源过滤）
    const storedPosts = await db.socialPosts
      .where('platformId')
      .equals('weibo')
      .filter(p => 
        (!namespace || p.namespace === namespace) && 
        sourceFilter(p)
      )
      .reverse()
      .sortBy('timestamp')
      .then(posts => posts.slice(0, 20));

    // 如果没有内容，根据配置决定是否自动生成
    if (storedPosts.length === 0) {
      const settingsStore = useSettingsStore();
      if (settingsStore.autoGenerateConfig.onEmptyFeed) {
        console.log('[FeedStore] No posts found, triggering Director (autoGenerate enabled)...');
        await DirectorService.getInstance().triggerManualEvent();
        
        const topics = await TrendService.getInstance().getTrendingList('weibo');
        if (topics.length > 0) {
          await TrendService.getInstance().ensureTopicContent(topics[0].id);
          const retryPosts = await db.socialPosts
            .where('platformId')
            .equals('weibo')
            .filter(p => !namespace || p.namespace === namespace)
            .reverse()
            .sortBy('timestamp')
            .then(posts => posts.slice(0, 20));
          await mapPostsToDisplay(retryPosts);
        }
      } else {
        console.log('[FeedStore] No posts found. Auto-generation is disabled.');
      }
    } else {
      await mapPostsToDisplay(storedPosts);
    }
    
    isLoading.value = false;
  }

  /**
   * 加载更多博文
   */
  async function loadMore() {
    isLoading.value = true;
    // TODO: cursor based pagination
    isLoading.value = false;
  }

  /**
   * 根据 ID 获取博文
   * Phase 3 重构：返回 DisplayPost 替代 WeiboPostUI
   */
  async function getPostById(id: string): Promise<DisplayPost | undefined> {
    // 先检查内存缓存 (新格式)
    const cached = displayPosts.value.find(p => p.id === id);
    if (cached) return cached;

    // 从数据库获取
    const post = await db.socialPosts.get(id);
    if (post) {
      return await mapSinglePostToDisplay(post);
    }
    return undefined;
  }

  /**
   * 将单个 UniversalPost 映射到 DisplayPost
   * Phase 3 新方法：直接返回 DisplayPost，无需中间类型转换
   */
  async function mapSinglePostToDisplay(p: UniversalPost): Promise<DisplayPost> {
    const userInfo = await getUserInfo(p.authorId);
    
    // 构建 PostAuthor
    const author: PostAuthor = {
      id: userInfo.id,
      name: userInfo.name,
      avatar: userInfo.avatar,
      verified: userInfo.verified,
      verifiedType: userInfo.verifiedType,
      vipLevel: userInfo.vipLevel,
    };
    
    // 获取图片 URL 列表
    const imageUrls = getImagesFromPost(p);
    
    // 构建 DisplayPost（继承 UniversalPost 所有字段）
    return {
      ...p,
      author,
      displayTime: formatTime(p.timestamp),
      imageUrls,
      isFollowing: false,
    };
  }

  /**
   * 从 UniversalPost 获取主类型
   * 优先使用 primaryType，兼容 payload.type/postType
   */
  function getPrimaryTypeFromPost(post: UniversalPost): PrimaryContentType {
    // 优先使用新字段
    if (post.primaryType) {
      return post.primaryType;
    }
    
    // 兼容旧字段
    const legacyType = post.payload.type || post.payload.postType;
    if (legacyType) {
      // 映射旧类型到新类型
      if (legacyType === 'text' || legacyType === 'poll' || legacyType === 'video') {
        return legacyType as PrimaryContentType;
      }
    }
    
    // 如果有 contentFlags，使用工具函数计算
    if (post.contentFlags && post.media) {
      return getWeiboPrimaryType(post.contentFlags, post.media);
    }
    
    // 最后根据内容推断
    if (post.payload.poll) return 'poll';
    if (post.payload.video) return 'video';
    if (post.payload.repost) return 'repost';
    if (post.payload.article) return 'article';
    
    return 'text';
  }

  /**
   * 从 UniversalPost 获取图片列表
   * 优先使用 media 字段，兼容 payload.images
   */
  function getImagesFromPost(post: UniversalPost): string[] {
    // 优先使用新的 media 字段
    if (post.media && post.media.length > 0) {
      return post.media
        .filter(m => m.type === 'image')
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map(m => {
          // 如果有实际 URL，使用 URL
          if (m.url) return m.url;
          // 否则生成占位图
          const desc = m.expandedDescription || m.description || '图片';
          return `https://via.placeholder.com/400x300?text=${encodeURIComponent(desc.slice(0, 20))}`;
        });
    }
    
    // 兼容旧的 payload.images
    return normalizeImages(post.payload.images);
  }

  /**
   * 获取博文的评论列表
   */
  async function getCommentsForPost(postId: string): Promise<WeiboCommentUI[]> {
    const post = await db.socialPosts.get(postId);
    if (!post) return [];

    // 从数据库获取现有评论
    const runtime = tryUseAppRuntime();
    const namespace = runtime?.identity.dataNamespace;

    let comments = await db.socialComments
      .where('postId')
      .equals(postId)
      .filter(c => !namespace || c.namespace === namespace)
      .sortBy('likes')
      .then(list => list.reverse());

    // 惰性生成（仅在配置开启时）
    const settingsStore = useSettingsStore();
    if (comments.length < 3 && settingsStore.autoGenerateConfig.onFewComments) {
      try {
        console.log('[FeedStore] Generating comments for post (autoGenerate enabled)', postId);
        const generated = await ContentFactory.getInstance().generateComments(
          'weibo',
          post.payload.text || '',
          5
        );

        for (const gen of generated) {
          // 使用新账号系统创建评论者
          const authorId = await ensureCommenterAccount(gen.nickname || '网友', gen.content);
          
          const newComment = {
            id: uuidv4(),
            postId,
            platformId: 'weibo',
            authorId,
            content: gen.content,
            likes: gen.likes || 0,
            timestamp: Date.now() - Math.floor(Math.random() * 3600000)
          };
          
          await db.socialComments.add(newComment);
          comments.push(newComment as any);
        }
      } catch (err) {
        console.error('Failed to generate comments', err);
      }
    }

    // 映射到 UI 模型（使用 getUserInfo 获取用户信息）
    const uiComments: WeiboCommentUI[] = [];
    for (const c of comments) {
      const userInfo = await getUserInfo(c.authorId);
      uiComments.push({
        id: c.id,
        user: {
          id: c.authorId,
          name: userInfo.name,
          avatar: userInfo.avatar,
        },
        content: c.content,
        time: formatTime(c.timestamp),
        likes: c.likes,
        replies: []
      });
    }

    return uiComments;
  }

  /**
   * 获取指定用户发布的所有博文
   * Phase 3 重构：返回 DisplayPost 替代 WeiboPostUI
   */
  async function getPostsByAuthor(authorId: string): Promise<DisplayPost[]> {
    // 先获取该用户的所有博文
    const runtime = tryUseAppRuntime();
    const namespace = runtime?.identity.dataNamespace;

    const allPosts = await db.socialPosts
      .where('authorId')
      .equals(authorId)
      .toArray();
    
    // 过滤微博平台 + 命名空间，并按时间倒序排列
    const storedPosts = allPosts
      .filter(p => p.platformId === 'weibo' && (!namespace || p.namespace === namespace))
      .sort((a, b) => b.timestamp - a.timestamp);

    const result: DisplayPost[] = [];
    for (const p of storedPosts) {
      result.push(await mapSinglePostToDisplay(p));
    }
    return result;
  }

  /**
   * 获取指定用户发布的博文数量
   */
  async function getPostCountByAuthor(authorId: string): Promise<number> {
    const runtime = tryUseAppRuntime();
    const namespace = runtime?.identity.dataNamespace;

    const allPosts = await db.socialPosts
      .where('authorId')
      .equals(authorId)
      .toArray();
    
    return allPosts.filter(p => p.platformId === 'weibo' && (!namespace || p.namespace === namespace)).length;
  }

  /**
   * 根据 authorId 获取用户信息
   * 
   * Phase 2 重构：
   * - 统一使用 accountService (新账号系统)
   * - 移除对旧 db.socialAccounts 的 fallback
   * - 旧数据需要通过迁移脚本处理
   */
  async function getUserInfo(authorId: string): Promise<WeiboUser> {
    // 从 accountService 获取账号信息
    const platformAccount = await accountService.getPlatformAccount(authorId);
    
    if (platformAccount) {
      // 获取关联的实体信息
      const entity = await accountService.getEntity(platformAccount.entityId);
      const platformData = platformAccount.platformData || {};
      
      // 将详细的认证类型映射到 UI 类型
      // WeiboVerifyType: personal_* | org_* | super_topic_host
      // UI 简化为: personal | org
      let verifiedType: 'personal' | 'org' = 'personal';
      if (platformData.verifyType) {
        const vt = String(platformData.verifyType);
        if (vt.startsWith('org_')) {
          verifiedType = 'org';
        } else {
          verifiedType = 'personal';
        }
      }
      
      return {
        id: authorId,
        name: platformAccount.nickname || entity?.displayName || '用户',
        avatar: platformAccount.avatarOverride || entity?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${authorId}`,
        verified: platformData.verified ?? false,
        verifiedType,
        vipLevel: platformData.vipLevel ?? 0
      };
    }
    
    // 如果账号不存在，返回默认用户信息
    // 注意：这种情况只应在数据迁移期间出现
    console.warn(`[FeedStore] Account not found: ${authorId}, using default profile`);
    return {
      id: authorId,
      name: '未知用户',
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${authorId}`,
      verified: false,
      verifiedType: 'personal',
      vipLevel: 0
    };
  }

  /**
   * 将 UniversalPost 数组映射到 DisplayPost
   * Phase 3 新方法
   */
  async function mapPostsToDisplay(universalPosts: UniversalPost[]) {
    const newDisplayPosts: DisplayPost[] = [];

    for (const p of universalPosts) {
      newDisplayPosts.push(await mapSinglePostToDisplay(p));
    }

    displayPosts.value = newDisplayPosts;
  }

  /**
   * 标准化图片数据（支持字符串和对象两种格式）
   * @deprecated 优先使用 getImagesFromPost，此函数用于兼容旧的 payload.images
   */
  function normalizeImages(images: any[] | undefined): string[] {
    if (!images || !Array.isArray(images)) return [];
    
    return images.map((img: any) => {
      // 如果是字符串
      if (typeof img === 'string') {
        return img.startsWith('http') 
          ? img 
          : `https://via.placeholder.com/400x300?text=${encodeURIComponent(img.slice(0, 10))}`;
      }
      // 如果是对象（如 {description: "..."}）
      if (typeof img === 'object' && img !== null) {
        const desc = img.description || img.expandedDescription || '图片';
        return `https://via.placeholder.com/400x300?text=${encodeURIComponent(desc.slice(0, 20))}`;
      }
      return 'https://via.placeholder.com/400x300?text=图片';
    });
  }

  /**
   * 标准化投票数据（确保 options 是对象数组格式）
   * 支持两种输入格式：
   * 1. 字符串数组: ["选项1", "选项2"]
   * 2. 对象数组: [{id: "...", text: "...", votes: 0}]
   */
  function normalizePoll(poll: any | undefined): WeiboPollConfig | undefined {
    if (!poll || typeof poll !== 'object') return undefined;
    
    // 确保 options 存在且是非空数组
    if (!poll.options || !Array.isArray(poll.options) || poll.options.length === 0) return undefined;
    
    // 标准化 options
    const normalizedOptions: WeiboPollOption[] = poll.options.map((opt: any, idx: number) => {
      // 如果是字符串，转换为对象
      if (typeof opt === 'string') {
        return {
          id: `opt_${idx}`,
          text: opt,
          votes: Math.floor(Math.random() * 100), // 随机初始票数
        };
      }
      // 如果已经是对象，确保有必需字段
      if (typeof opt === 'object' && opt !== null) {
        return {
          id: opt.id || `opt_${idx}`,
          text: opt.text || `选项${idx + 1}`,
          votes: typeof opt.votes === 'number' ? opt.votes : Math.floor(Math.random() * 100),
        };
      }
      // 其他情况返回默认选项
      return {
        id: `opt_${idx}`,
        text: `选项${idx + 1}`,
        votes: 0,
      };
    });
    
    return {
      question: poll.question || '',
      options: normalizedOptions,
      duration: poll.duration || 24,
      multiSelect: poll.multiSelect || false,
      endTime: poll.endTime,
    };
  }

  /**
   * 点赞博文
   */
  function likePost(postId: string) {
    const post = displayPosts.value.find(p => p.id === postId);
    if (post) {
      post.stats.likes++;
      // TODO: Update DB
    }
  }

  /**
   * 关注用户
   */
  function followUser(userId: string) {
    displayPosts.value.forEach(post => {
      if (post.author.id === userId) {
        post.isFollowing = true;
        // TODO: Update DB
      }
    });
  }

  /**
   * 为博文生成互动数据（评论、点赞、转发）
   */
  async function generatePostEngagement(
    postId: string,
    postContent: string,
    authorInfo: {
      name: string;
      bio: string;
      followerCount: number;
      accountType: string;
    }
  ): Promise<void> {
    console.log('[FeedStore] 开始为博文生成互动数据:', postId);
    
    try {
      const aiStore = useAIStore();
      const prompt = PromptService.getPromptByScene('social.post.engagement.weibo');
      
      if (!prompt) {
        console.warn('[FeedStore] 未找到互动生成提示词');
        return;
      }

      const runtime = tryUseAppRuntime();
      const namespace = runtime?.identity.dataNamespace;
      
      // 获取叙事内容
      let narrativeContent = '';
      try {
        const { useLLMTaskStore } = await import('./index');
        const llmTaskStore = useLLMTaskStore();
        const narrativeContext = llmTaskStore.getNarrativeContext();
        if (narrativeContext.available) {
          narrativeContent = narrativeContext.content;
        }
      } catch (e) {
        console.warn('[FeedStore] 获取叙事内容失败:', e);
      }
      
      // 填充模板
      let filledTemplate = prompt.template
        .replace('{{authorName}}', authorInfo.name)
        .replace('{{authorBio}}', authorInfo.bio || '这个人很懒，什么都没留下')
        .replace('{{followerCount}}', String(authorInfo.followerCount))
        .replace('{{accountType}}', authorInfo.accountType)
        .replace('{{postContent}}', postContent)
        .replace('{{minComments}}', '10');
      
      // 处理叙事内容的条件块
      if (narrativeContent) {
        filledTemplate = filledTemplate
          .replace(/\{\{#if narrative\}\}([\s\S]*?)\{\{\/if\}\}/g, '$1')
          .replace('{{narrative}}', narrativeContent);
      } else {
        filledTemplate = filledTemplate.replace(/\{\{#if narrative\}\}[\s\S]*?\{\{\/if\}\}/g, '');
      }
      
      // 调用 LLM
      const generateResult = await aiStore.generate({
        messages: [
          { role: 'system', content: prompt.systemPrompt || '' },
          { role: 'user', content: filledTemplate }
        ]
      });
      const result = generateResult.text;
      
      if (!result) {
        console.warn('[FeedStore] LLM 返回空结果');
        return;
      }
      
      // 解析结果
      let parsed: any;
      try {
        let cleanJson = result.trim();
        if (cleanJson.startsWith('```json')) {
          cleanJson = cleanJson.slice(7);
        } else if (cleanJson.startsWith('```')) {
          cleanJson = cleanJson.slice(3);
        }
        if (cleanJson.endsWith('```')) {
          cleanJson = cleanJson.slice(0, -3);
        }
        parsed = JSON.parse(cleanJson.trim());
      } catch (e) {
        console.error('[FeedStore] 解析互动数据失败:', e);
        return;
      }
      
      // 更新博文统计数据
      if (parsed.stats) {
        const post = await db.socialPosts.get(postId);
        if (post) {
          await writeQueue.enqueue('app', namespace || 'weibo', async () => {
            await db.socialPosts.update(postId, {
              stats: {
                views: parsed.stats.views || Math.floor(Math.random() * 1000),
                likes: parsed.stats.likes || 0,
                comments: (parsed.comments?.length || 0),
                shares: parsed.stats.shares || parsed.stats.reposts || 0,
              }
            });
          });
          console.log('[FeedStore] 已更新博文统计:', parsed.stats);
        }
      }
      
      // 保存评论到数据库
      if (parsed.comments && Array.isArray(parsed.comments)) {
        for (const comment of parsed.comments) {
          if (!comment.content) continue;
          
          const nickname = comment.nickname || '微博网友';
          
          // 使用新账号系统创建评论者
          const authorId = await ensureCommenterAccount(nickname, comment.persona);
          
          const commentId = uuidv4();
          await db.socialComments.add({
            id: commentId,
            postId,
            platformId: 'weibo',
            authorId,
            content: comment.content,
            likes: comment.likes || Math.floor(Math.random() * 50),
            timestamp: Date.now() - Math.floor(Math.random() * 3600000),
          });
        }
        
        console.log(`[FeedStore] 已保存 ${parsed.comments.length} 条评论`);
      }
      
      // 刷新首页以显示更新后的数据
      await refreshFeed();
      
    } catch (error) {
      console.error('[FeedStore] 生成互动数据失败:', error);
    }
  }

  /**
   * 清除所有博文数据
   */
  async function clearAllPosts(): Promise<number> {
    const runtime = tryUseAppRuntime();
    const namespace = runtime?.identity.dataNamespace;

    const allPosts = await db.socialPosts.toArray();
    const weiboPostIds = allPosts
      .filter(p => p.platformId === 'weibo' && (!namespace || p.namespace === namespace))
      .map(p => p.id);
    
    if (weiboPostIds.length > 0) {
      await writeQueue.enqueue('app', namespace || 'weibo', async () => {
        await db.socialPosts.bulkDelete(weiboPostIds);
      });
    }
    
    // 同时清除相关评论
    const allComments = await db.socialComments.toArray();
    const weiboCommentIds = allComments
      .filter(c => c.platformId === 'weibo' && (!namespace || c.namespace === namespace))
      .map(c => c.id);
    
    if (weiboCommentIds.length > 0) {
      await writeQueue.enqueue('app', namespace || 'weibo', async () => {
        await db.socialComments.bulkDelete(weiboCommentIds);
      });
    }
    
    displayPosts.value = [];
    
    console.log(`[FeedStore] 已清除 ${weiboPostIds.length} 条博文, ${weiboCommentIds.length} 条评论`);
    return weiboPostIds.length;
  }

  /**
   * 设置自动生成配置
   * @deprecated 请使用 useSettingsStore().setAutoGenerateConfig()
   */
  function setAutoGenerateConfig(config: Partial<{ onEmptyFeed: boolean; onFewComments: boolean }>) {
    const settingsStore = useSettingsStore();
    settingsStore.setAutoGenerateConfig(config);
    console.log('[FeedStore] Auto-generate config updated (via settingsStore)');
  }

  /**
   * 确保评论作者账号存在
   * 使用新的账号系统创建 NPC 账号
   * 
   * Phase 2 重构：统一使用 accountService
   */
  async function ensureCommenterAccount(
    nickname: string,
    persona?: string
  ): Promise<string> {
    // 尝试查找已存在的账号（通过昵称）
    const existingAccounts = await accountService.getAccountsByPlatform('weibo');
    const existing = existingAccounts.find(acc => acc.nickname === nickname);
    
    if (existing) {
      return existing.id;
    }

    // 使用 UserPool 生成随机档案
    const userPool = UserPool.getInstance();
    const profile = userPool.generateRandomProfile({ platform: 'weibo' });

    // 创建 NPC 实体
    const entity = await accountService.createEntity({
      type: 'npc',
      displayName: nickname,
      avatar: profile.avatar,
      bio: persona || profile.bio,
      gender: profile.gender,
      source: 'social',
      scope: 'session', // 评论者默认 session 作用域
    });

    // 创建平台账号
    const handle = `user_${Math.random().toString(36).substr(2, 9)}`;
    const account = await accountService.createPlatformAccount(
      entity.id,
      'weibo',
      {
        handle,
        nickname,
        scope: 'session',
      }
    );

    console.log(`[FeedStore] Created commenter account: ${nickname} (${account.id})`);
    return account.id;
  }

  /**
   * 格式化时间
   */
  function formatTime(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    return new Date(timestamp).toLocaleDateString();
  }

  /**
   * 获取博文和评论数量统计
   */
  async function getPostStats(): Promise<{ posts: number; comments: number }> {
    const runtime = tryUseAppRuntime();
    const namespace = runtime?.identity.dataNamespace;

    const allPosts = await db.socialPosts.toArray();
    const allComments = await db.socialComments.toArray();
    
    return {
      posts: allPosts.filter(p => p.platformId === 'weibo' && (!namespace || p.namespace === namespace)).length,
      comments: allComments.filter(c => c.platformId === 'weibo' && (!namespace || c.namespace === namespace)).length,
    };
  }

  /**
   * 删除单条博文
   */
  async function deletePost(postId: string): Promise<boolean> {
    try {
      const runtime = tryUseAppRuntime();
      const namespace = runtime?.identity.dataNamespace;

      // 删除博文（仅当前命名空间）
      await writeQueue.enqueue('app', namespace || 'weibo', async () => {
        await db.socialPosts.delete(postId);
      });
      
      // 删除相关评论
      const comments = await db.socialComments
        .where('postId')
        .equals(postId)
        .filter(c => !namespace || c.namespace === namespace)
        .toArray();
      const commentIds = comments.map(c => c.id);
      if (commentIds.length > 0) {
        await writeQueue.enqueue('app', namespace || 'weibo', async () => {
          await db.socialComments.bulkDelete(commentIds);
        });
      }
      
      // 从内存中移除
      const index = displayPosts.value.findIndex(p => p.id === postId);
      if (index !== -1) {
        displayPosts.value.splice(index, 1);
      }
      
      console.log(`[FeedStore] 已删除博文 ${postId} 及 ${commentIds.length} 条评论`);
      return true;
    } catch (error) {
      console.error('[FeedStore] 删除博文失败:', error);
      return false;
    }
  }

  /**
   * 更新博文内容
   */
  async function updatePost(
    postId: string,
    updates: {
      content?: string;
      images?: string[];
    }
  ): Promise<boolean> {
    try {
      const post = await db.socialPosts.get(postId);
      if (!post) {
        console.warn('[FeedStore] 博文不存在:', postId);
        return false;
      }
      
      // 更新数据库
      const runtime = tryUseAppRuntime();
      const namespace = runtime?.identity.dataNamespace;

      await writeQueue.enqueue('app', namespace || 'weibo', async () => {
        await db.socialPosts.update(postId, {
          payload: {
            ...post.payload,
            text: updates.content ?? post.payload.text,
            images: updates.images ?? post.payload.images,
          },
          // updatedAt removed - not in UniversalPost type
        });
      });
      
      // 更新内存中的数据
      const displayPost = displayPosts.value.find(p => p.id === postId);
      if (displayPost) {
        if (updates.content !== undefined) {
          displayPost.payload.text = updates.content;
        }
        if (updates.images !== undefined) {
          displayPost.imageUrls = updates.images;
        }
      }
      
      console.log('[FeedStore] 已更新博文:', postId);
      return true;
    } catch (error) {
      console.error('[FeedStore] 更新博文失败:', error);
      return false;
    }
  }

  /**
   * 为博文生成评论（仅评论，增量添加）
   */
  async function generateCommentsForPost(
    postId: string,
    count: number = 5
  ): Promise<{ success: boolean; count: number }> {
    console.log('[FeedStore] 开始为博文生成评论:', postId, '数量:', count);
    
    try {
      const post = await db.socialPosts.get(postId);
      if (!post) {
        console.warn('[FeedStore] 博文不存在:', postId);
        return { success: false, count: 0 };
      }
      
      const aiStore = useAIStore();
      const prompt = PromptService.getPromptByScene('social.comment.batch.weibo');
      
      if (!prompt) {
        console.warn('[FeedStore] 未找到评论生成提示词');
        return { success: false, count: 0 };
      }

      const runtime = tryUseAppRuntime();
      const namespace = runtime?.identity.dataNamespace;
      
      // 获取叙事内容
      let narrativeContent = '';
      try {
        const { useLLMTaskStore } = await import('./index');
        const llmTaskStore = useLLMTaskStore();
        const narrativeContext = llmTaskStore.getNarrativeContext();
        if (narrativeContext.available) {
          narrativeContent = narrativeContext.content;
        }
      } catch (e) {
        console.warn('[FeedStore] 获取叙事内容失败:', e);
      }
      
      // 填充模板
      let filledTemplate = prompt.template
        .replace('{{postContent}}', post.payload.text || '')
        .replace('{{count}}', String(count));
      
      // 处理叙事内容
      if (narrativeContent) {
        filledTemplate = filledTemplate
          .replace(/\{\{#if narrative\}\}([\s\S]*?)\{\{\/if\}\}/g, '$1')
          .replace('{{narrative}}', narrativeContent);
      } else {
        filledTemplate = filledTemplate.replace(/\{\{#if narrative\}\}[\s\S]*?\{\{\/if\}\}/g, '');
      }
      
      // 调用 LLM
      const generateResult = await aiStore.generate({
        messages: [
          { role: 'system', content: prompt.systemPrompt || '' },
          { role: 'user', content: filledTemplate }
        ]
      });
      const result = generateResult.text;
      
      if (!result) {
        console.warn('[FeedStore] LLM 返回空结果');
        return { success: false, count: 0 };
      }
      
      // 解析结果
      let parsed: any;
      try {
        let cleanJson = result.trim();
        if (cleanJson.startsWith('```json')) {
          cleanJson = cleanJson.slice(7);
        } else if (cleanJson.startsWith('```')) {
          cleanJson = cleanJson.slice(3);
        }
        if (cleanJson.endsWith('```')) {
          cleanJson = cleanJson.slice(0, -3);
        }
        parsed = JSON.parse(cleanJson.trim());
      } catch (e) {
        console.error('[FeedStore] 解析评论数据失败:', e);
        return { success: false, count: 0 };
      }
      
      // 保存评论到数据库（使用新账号系统）
      const commentsData = Array.isArray(parsed) ? parsed : (parsed.comments || []);
      let savedCount = 0;
      
      for (const comment of commentsData) {
        if (!comment.content) continue;
        
        const nickname = comment.nickname || '微博网友';
        
        // 使用新账号系统创建评论者
        const authorId = await ensureCommenterAccount(nickname, comment.persona);
        
        const commentId = uuidv4();
        await writeQueue.enqueue('app', namespace || 'weibo', async () => {
          await db.socialComments.add({
            id: commentId,
            postId,
            platformId: 'weibo',
            namespace,
            authorId,
            content: comment.content,
            likes: comment.likes || Math.floor(Math.random() * 50),
            timestamp: Date.now() - Math.floor(Math.random() * 3600000),
          });
        });
        savedCount++;
      }
      
      // 更新博文评论数
      if (savedCount > 0) {
        const currentPost = await db.socialPosts.get(postId);
        if (currentPost) {
          await writeQueue.enqueue('app', namespace || 'weibo', async () => {
            await db.socialPosts.update(postId, {
              stats: {
                ...currentPost.stats,
                comments: (currentPost.stats.comments || 0) + savedCount,
              }
            });
          });
        }
        
        // 更新内存中的数据
        const displayPost = displayPosts.value.find(p => p.id === postId);
        if (displayPost) {
          displayPost.stats.comments = (displayPost.stats.comments || 0) + savedCount;
        }
      }
      
      console.log(`[FeedStore] 已生成 ${savedCount} 条评论`);
      return { success: true, count: savedCount };
      
    } catch (error) {
      console.error('[FeedStore] 生成评论失败:', error);
      return { success: false, count: 0 };
    }
  }

  /**
   * 获取博文原始数据（用于编辑）
   * 
   * Phase 2 重构：使用 getUserInfo 获取作者信息
   */
  async function getPostRawData(postId: string) {
    const post = await db.socialPosts.get(postId);
    if (!post) return null;
    
    const userInfo = await getUserInfo(post.authorId);
    
    return {
      id: post.id,
      authorId: post.authorId,
      authorName: userInfo.name,
      content: post.payload.text || '',
      images: post.payload.images || [],
      topics: extractTopics(post.payload.text || ''),
      timestamp: post.timestamp,
    };
  }

  /**
   * 从文本中提取话题
   */
  function extractTopics(text: string): string[] {
    const matches = text.match(/#([^#]+)#/g) || [];
    return matches.map(m => m.replace(/#/g, ''));
  }

  /**
   * 检查是否是当前用户的博文
   */
  async function isPostOwner(postId: string, userId: string): Promise<boolean> {
    const post = await db.socialPosts.get(postId);
    return post?.authorId === userId;
  }

  /**
   * 根据 ID 获取 DisplayPost
   * Phase 3 新方法
   */
  async function getDisplayPostById(id: string): Promise<DisplayPost | undefined> {
    // 先检查内存缓存
    const cached = displayPosts.value.find(p => p.id === id);
    if (cached) return cached;

    // 从数据库获取
    const post = await db.socialPosts.get(id);
    if (post) {
      return await mapSinglePostToDisplay(post);
    }
    return undefined;
  }

  /**
   * 获取指定用户发布的所有博文 (DisplayPost 格式)
   * Phase 3 新方法
   */
  async function getDisplayPostsByAuthor(authorId: string): Promise<DisplayPost[]> {
    const allPosts = await db.socialPosts
      .where('authorId').equals(authorId)
      .toArray();
    
    const storedPosts = allPosts
      .filter(p => p.platformId === 'weibo')
      .sort((a, b) => b.timestamp - a.timestamp);

    const result: DisplayPost[] = [];
    for (const p of storedPosts) {
      result.push(await mapSinglePostToDisplay(p));
    }
    return result;
  }

  return {
    // 状态
    displayPosts,
    stories,
    messages,
    messageGrid,
    isLoading,
    autoGenerateConfig,
    
    // 计算属性
    postCount,
    
    // 方法
    refreshFeed,
    loadMore,
    getPostById,
    getDisplayPostById,
    getCommentsForPost,
    mapPostsToDisplay,
    likePost,
    followUser,
    generatePostEngagement,
    clearAllPosts,
    setAutoGenerateConfig,
    formatTime,
    getPostStats,
    // 新增方法
    deletePost,
    updatePost,
    generateCommentsForPost,
    getPostRawData,
    isPostOwner,
    // 用户博文相关
    getPostsByAuthor,
    getDisplayPostsByAuthor,  // Phase 3: 新增
    getPostCountByAuthor,
  };
});
