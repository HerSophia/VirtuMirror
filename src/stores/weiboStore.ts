/**
 * 微博 Store - 兼容层
 * 
 * 此文件保留以维持向后兼容性。
 * 新功能已分离到 src/apps/weibo/stores/ 下的专用 stores：
 * - hotSearchStore: 热搜榜管理
 * - feedStore: 信息流、博文、评论
 * - composeStore: 发布、草稿、AI 扩展
 * - llmTaskStore: LLM 任务管理
 * 
 * 建议新代码直接使用分离后的 stores：
 * import { useHotSearchStore, useFeedStore, useComposeStore } from '@/apps/weibo/stores';
 */

import { defineStore } from 'pinia';
import { computed } from 'vue';
import { useHotSearchStore } from '@/apps/weibo/stores/hotSearchStore';
import { useFeedStore } from '@/apps/weibo/stores/feedStore';
import { useComposeStore } from '@/apps/weibo/stores/composeStore';
import type { HotSearchItem, StoryItem, MessageItem, WeiboCommentUI, ComposePostData, WeiboDraft } from '@/apps/weibo/types';

/**
 * @deprecated 请使用分离后的 stores:
 * - useHotSearchStore: 热搜相关
 * - useFeedStore: 信息流相关
 * - useComposeStore: 发布和草稿相关
 */
export const useWeiboStore = defineStore('weibo', () => {
  // 获取分离后的 stores
  const hotSearchStore = useHotSearchStore();
  const feedStore = useFeedStore();
  const composeStore = useComposeStore();

  // ==================== 兼容性导出 ====================
  
  // 从 feedStore 代理的状态
  const displayPosts = computed(() => feedStore.displayPosts);
  const stories = computed(() => feedStore.stories);
  const messages = computed(() => feedStore.messages);
  const messageGrid = computed(() => feedStore.messageGrid);
  const isLoading = computed(() => feedStore.isLoading || hotSearchStore.isLoading);
  const autoGenerateConfig = computed(() => feedStore.autoGenerateConfig);
  
  // 从 hotSearchStore 代理的状态
  const hotSearches = computed(() => hotSearchStore.hotSearches);
  const currentCategory = computed(() => hotSearchStore.currentCategory);
  const currentHotSearch = computed(() => hotSearchStore.currentHotSearch);
  
  // 从 composeStore 代理的状态
  const drafts = computed(() => composeStore.drafts);

  // ==================== 热搜相关方法（代理到 hotSearchStore） ====================
  
  function setCategory(category: string) {
    return hotSearchStore.setCategory(category);
  }
  
  async function refreshHotSearch() {
    return hotSearchStore.refreshHotSearch();
  }
  
  async function applyGeneratedHotSearch(
    generatedItems: any[],
    mode: 'replace' | 'prepend' | 'append' = 'prepend'
  ) {
    return hotSearchStore.applyGeneratedHotSearch(generatedItems, mode);
  }
  
  async function applyHotSearchFromJSON(
    jsonOutput: string,
    mode: 'replace' | 'prepend' | 'append' = 'prepend'
  ) {
    return hotSearchStore.applyHotSearchFromJSON(jsonOutput, mode);
  }
  
  async function clearHotSearches() {
    return hotSearchStore.clearHotSearches();
  }

  // ==================== 信息流相关方法（代理到 feedStore） ====================
  
  async function refreshFeed() {
    return feedStore.refreshFeed();
  }
  
  async function loadMore() {
    return feedStore.loadMore();
  }
  
  async function getPostById(id: string) {
    return feedStore.getPostById(id);
  }
  
  async function getCommentsForPost(postId: string) {
    return feedStore.getCommentsForPost(postId);
  }
  
  function likePost(postId: string) {
    return feedStore.likePost(postId);
  }
  
  function followUser(userId: string) {
    return feedStore.followUser(userId);
  }
  
  async function generatePostEngagement(
    postId: string,
    postContent: string,
    authorInfo: {
      name: string;
      bio: string;
      followerCount: number;
      accountType: string;
    }
  ) {
    return feedStore.generatePostEngagement(postId, postContent, authorInfo);
  }
  
  async function clearAllPosts() {
    return feedStore.clearAllPosts();
  }
  
  function setAutoGenerateConfig(config: any) {
    return feedStore.setAutoGenerateConfig(config);
  }

  // ==================== 发布相关方法（代理到 composeStore） ====================
  
  async function expandPostContent(userContent: string) {
    return composeStore.expandPostContent(userContent);
  }
  
  async function expandImageDescription(imageDescription: string) {
    return composeStore.expandImageDescription(imageDescription);
  }
  
  async function expandVideoDescription(videoDescription: string) {
    return composeStore.expandVideoDescription(videoDescription);
  }
  
  async function publishPost(postData: ComposePostData, options?: any) {
    return composeStore.publishPost(postData, options);
  }

  // ==================== 草稿相关方法（代理到 composeStore） ====================
  
  function loadDrafts() {
    return composeStore.loadDrafts();
  }
  
  function saveDraft(draftData: any, draftId?: string) {
    return composeStore.saveDraft(draftData, draftId);
  }
  
  function getDraftById(draftId: string) {
    return composeStore.getDraftById(draftId);
  }
  
  function deleteDraft(draftId: string) {
    return composeStore.deleteDraft(draftId);
  }
  
  function clearAllDrafts() {
    return composeStore.clearAllDrafts();
  }
  
  function getDraftCount() {
    return composeStore.getDraftCount();
  }

  // ==================== 缓存管理（组合多个 store） ====================
  
  async function clearAllCache() {
    const [postsCount, hotSearchesCount] = await Promise.all([
      feedStore.clearAllPosts(),
      hotSearchStore.clearHotSearches(),
    ]);
    
    const stats = await feedStore.getPostStats();
    
    return {
      posts: postsCount,
      hotSearches: hotSearchesCount,
      comments: stats.comments,
    };
  }
  
  async function getCacheStats() {
    const [postStats, hotSearchCount] = await Promise.all([
      feedStore.getPostStats(),
      hotSearchStore.getHotSearchCount(),
    ]);
    
    return {
      posts: postStats.posts,
      hotSearches: hotSearchCount,
      comments: postStats.comments,
    };
  }

  return {
    // 状态
    displayPosts,
    stories,
    hotSearches,
    messages,
    messageGrid,
    currentCategory,
    currentHotSearch,
    isLoading,
    autoGenerateConfig,
    drafts,
    
    // 热搜相关
    setCategory,
    refreshHotSearch,
    applyGeneratedHotSearch,
    applyHotSearchFromJSON,
    clearHotSearches,
    
    // 信息流相关
    refreshFeed,
    loadMore,
    getPostById,
    getCommentsForPost,
    likePost,
    followUser,
    generatePostEngagement,
    clearAllPosts,
    setAutoGenerateConfig,
    
    // 发布相关
    expandPostContent,
    expandImageDescription,
    expandVideoDescription,
    publishPost,
    
    // 草稿相关
    loadDrafts,
    saveDraft,
    getDraftById,
    deleteDraft,
    clearAllDrafts,
    getDraftCount,
    
    // 缓存管理
    clearAllCache,
    getCacheStats,
  };
});
