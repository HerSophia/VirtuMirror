/**
 * 微博数据迁移模块
 * 处理旧数据的 namespace 补充和会话绑定
 * 
 * Phase 3: 添加账号会话绑定功能
 * - 将微博账号的 scopeSessionId 设置为当前会话
 */

import { db } from '@/services/database';
import { writeQueue } from '@/services/database/writeQueue';
import { loggerService } from '@/services/logger/loggerService';
import { getNarrativeCacheMetadata } from './llm/narrativeIntegration';
import { accountService } from '@/services/account/accountService';
import { useAccountStore } from '@/stores/accountStore';
import type { ContentSourceTracking } from '@/types/social';

const MIGRATION_KEY = 'weibo:data_migration_v1';
const SESSION_BINDING_KEY = 'weibo:session_binding_v1';
const DEFAULT_NAMESPACE = 'builtin/weibo';

/**
 * 检查是否已完成迁移
 */
async function isMigrationCompleted(): Promise<boolean> {
  try {
    const record = await db.appSettings.get(MIGRATION_KEY);
    return record?.value === true;
  } catch {
    return false;
  }
}

/**
 * 标记迁移已完成
 */
async function markMigrationCompleted(): Promise<void> {
  await db.appSettings.put({
    key: MIGRATION_KEY,
    value: true,
    updatedAt: Date.now(),
  });
}

/**
 * 迁移 socialPosts 表中的旧数据
 */
async function migrateSocialPosts(): Promise<number> {
  const allPosts = await db.socialPosts
    .where('platformId')
    .equals('weibo')
    .toArray();
  
  // 筛选出没有 namespace 的记录
  const postsToMigrate = allPosts.filter(p => !p.namespace);
  
  if (postsToMigrate.length === 0) {
    return 0;
  }
  
  loggerService.info('DataMigration', `发现 ${postsToMigrate.length} 条博文需要迁移`);
  
  // 批量更新
  await writeQueue.enqueue('system', 'weibo:migration', async () => {
    const updates = postsToMigrate.map(post => ({
      ...post,
      namespace: DEFAULT_NAMESPACE,
    }));
    await db.socialPosts.bulkPut(updates);
  });
  
  return postsToMigrate.length;
}

/**
 * 迁移 socialComments 表中的旧数据
 */
async function migrateSocialComments(): Promise<number> {
  const allComments = await db.socialComments
    .where('platformId')
    .equals('weibo')
    .toArray();
  
  // 筛选出没有 namespace 的记录
  const commentsToMigrate = allComments.filter(c => !c.namespace);
  
  if (commentsToMigrate.length === 0) {
    return 0;
  }
  
  loggerService.info('DataMigration', `发现 ${commentsToMigrate.length} 条评论需要迁移`);
  
  // 批量更新
  await writeQueue.enqueue('system', 'weibo:migration', async () => {
    const updates = commentsToMigrate.map(comment => ({
      ...comment,
      namespace: DEFAULT_NAMESPACE,
    }));
    await db.socialComments.bulkPut(updates);
  });
  
  return commentsToMigrate.length;
}

/**
 * 迁移 socialTopics 表中的旧数据
 */
async function migrateSocialTopics(): Promise<number> {
  const allTopics = await db.socialTopics
    .where('platformId')
    .equals('weibo')
    .toArray();
  
  // 筛选出没有 namespace 的记录
  const topicsToMigrate = allTopics.filter(t => !t.namespace);
  
  if (topicsToMigrate.length === 0) {
    return 0;
  }
  
  loggerService.info('DataMigration', `发现 ${topicsToMigrate.length} 条热搜需要迁移`);
  
  // 批量更新
  await writeQueue.enqueue('system', 'weibo:migration', async () => {
    const updates = topicsToMigrate.map(topic => ({
      ...topic,
      namespace: DEFAULT_NAMESPACE,
    }));
    await db.socialTopics.bulkPut(updates);
  });
  
  return topicsToMigrate.length;
}

/**
 * 执行完整的数据迁移
 * @returns 迁移结果统计
 */
export async function migrateWeiboData(): Promise<{
  skipped: boolean;
  posts: number;
  comments: number;
  topics: number;
}> {
  // 检查是否已完成迁移
  if (await isMigrationCompleted()) {
    loggerService.debug('DataMigration', '数据迁移已完成，跳过');
    return { skipped: true, posts: 0, comments: 0, topics: 0 };
  }
  
  loggerService.info('DataMigration', '开始微博数据迁移...');
  
  try {
    // 执行各表迁移
    const posts = await migrateSocialPosts();
    const comments = await migrateSocialComments();
    const topics = await migrateSocialTopics();
    
    // 标记迁移完成
    await markMigrationCompleted();
    
    loggerService.info('DataMigration', '微博数据迁移完成:', {
      posts,
      comments,
      topics,
    });
    
    return { skipped: false, posts, comments, topics };
  } catch (error) {
    loggerService.error('DataMigration', '微博数据迁移失败:', error);
    throw error;
  }
}

/**
 * 重置迁移状态（仅用于调试）
 */
export async function resetMigrationStatus(): Promise<void> {
  await db.appSettings.delete(MIGRATION_KEY);
  loggerService.info('DataMigration', '迁移状态已重置');
}

// ==================== 会话绑定迁移 ====================

/**
 * 检查是否已完成会话绑定
 */
async function isSessionBindingCompleted(sessionId: string): Promise<boolean> {
  try {
    const record = await db.appSettings.get(`${SESSION_BINDING_KEY}:${sessionId}`);
    return record?.value === true;
  } catch {
    return false;
  }
}

/**
 * 标记会话绑定已完成
 */
async function markSessionBindingCompleted(sessionId: string): Promise<void> {
  await db.appSettings.put({
    key: `${SESSION_BINDING_KEY}:${sessionId}`,
    value: true,
    updatedAt: Date.now(),
  });
}

/**
 * 将所有无 source 的微博数据绑定到指定会话
 * 
 * 使用场景：
 * - 首次启用会话绑定功能时，将现有数据绑定到当前会话
 * - 测试/开发环境下，将所有数据绑定到测试会话
 * 
 * @param sessionId 会话 ID
 * @param messageId 可选的楼层 ID
 * @param swipeId 可选的 Swipe ID
 * @returns 绑定结果统计
 */
export async function bindDataToSession(
  sessionId: string,
  messageId?: number,
  swipeId?: number
): Promise<{
  posts: number;
  comments: number;
  topics: number;
}> {
  loggerService.info('SessionBinding', '开始将数据绑定到会话:', { sessionId, messageId, swipeId });
  
  const source: ContentSourceTracking = {
    sessionId,
    sourceMessageId: messageId,
    sourceSwipeId: swipeId,
    generatedAt: Date.now(),
  };
  
  let posts = 0;
  let comments = 0;
  let topics = 0;
  
  try {
    // 1. 绑定博文
    const allPosts = await db.socialPosts
      .where('platformId')
      .equals('weibo')
      .filter(p => p.namespace === DEFAULT_NAMESPACE && !p.source?.sessionId)
      .toArray();
    
    if (allPosts.length > 0) {
      loggerService.info('SessionBinding', `发现 ${allPosts.length} 条博文需要绑定`);
      
      await writeQueue.enqueue('system', 'weibo:session-binding', async () => {
        const updates = allPosts.map(post => ({
          ...post,
          source,
        }));
        await db.socialPosts.bulkPut(updates);
      });
      
      posts = allPosts.length;
    }
    
    // 2. 绑定评论
    const allComments = await db.socialComments
      .where('platformId')
      .equals('weibo')
      .filter(c => c.namespace === DEFAULT_NAMESPACE && !c.source?.sessionId)
      .toArray();
    
    if (allComments.length > 0) {
      loggerService.info('SessionBinding', `发现 ${allComments.length} 条评论需要绑定`);
      
      await writeQueue.enqueue('system', 'weibo:session-binding', async () => {
        const updates = allComments.map(comment => ({
          ...comment,
          source,
        }));
        await db.socialComments.bulkPut(updates);
      });
      
      comments = allComments.length;
    }
    
    // 3. 绑定热搜
    const allTopics = await db.socialTopics
      .where('platformId')
      .equals('weibo')
      .filter(t => t.namespace === DEFAULT_NAMESPACE && !t.source?.sessionId)
      .toArray();
    
    if (allTopics.length > 0) {
      loggerService.info('SessionBinding', `发现 ${allTopics.length} 条热搜需要绑定`);
      
      await writeQueue.enqueue('system', 'weibo:session-binding', async () => {
        const updates = allTopics.map(topic => ({
          ...topic,
          source,
        }));
        await db.socialTopics.bulkPut(updates);
      });
      
      topics = allTopics.length;
    }
    
    loggerService.info('SessionBinding', '会话绑定完成:', { posts, comments, topics });
    return { posts, comments, topics };
    
  } catch (error) {
    loggerService.error('SessionBinding', '会话绑定失败:', error);
    throw error;
  }
}

/**
 * 自动将现有数据绑定到当前会话（如果有叙事上下文）
 * 
 * 使用场景：
 * - 在 WeiboApp.vue 启动时调用
 * - 仅在首次绑定时执行
 * 
 * @returns 绑定结果，如果无会话上下文则返回 null
 */
export async function autoBindToCurrentSession(): Promise<{
  posts: number;
  comments: number;
  topics: number;
} | null> {
  // 获取当前叙事缓存元数据
  const metadata = getNarrativeCacheMetadata();
  
  if (!metadata?.sessionId) {
    loggerService.debug('SessionBinding', '无会话上下文，跳过自动绑定');
    return null;
  }
  
  const { sessionId, messageId, swipeId } = metadata;
  
  // 检查是否已完成此会话的绑定
  if (await isSessionBindingCompleted(sessionId)) {
    loggerService.debug('SessionBinding', '会话已绑定过，跳过:', sessionId);
    return null;
  }
  
  // 执行绑定
  const result = await bindDataToSession(sessionId, messageId, swipeId);
  
  // 标记完成
  await markSessionBindingCompleted(sessionId);
  
  return result;
}

/**
 * 重置会话绑定状态（仅用于调试）
 */
export async function resetSessionBindingStatus(sessionId?: string): Promise<void> {
  if (sessionId) {
    await db.appSettings.delete(`${SESSION_BINDING_KEY}:${sessionId}`);
    loggerService.info('SessionBinding', '会话绑定状态已重置:', sessionId);
  } else {
    // 删除所有会话绑定记录
    const allSettings = await db.appSettings.toArray();
    const bindingKeys = allSettings
      .filter(s => s.key.startsWith(SESSION_BINDING_KEY))
      .map(s => s.key);
    
    if (bindingKeys.length > 0) {
      await db.appSettings.bulkDelete(bindingKeys);
      loggerService.info('SessionBinding', `已重置 ${bindingKeys.length} 个会话绑定状态`);
    }
  }
}

// ==================== 账号会话绑定 (Phase 3) ====================

const ACCOUNT_BINDING_KEY = 'weibo:account_binding_v1';

/**
 * 检查账号是否已绑定到会话
 */
async function isAccountBoundToSession(accountId: string, sessionId: string): Promise<boolean> {
  try {
    const record = await db.appSettings.get(`${ACCOUNT_BINDING_KEY}:${accountId}:${sessionId}`);
    return record?.value === true;
  } catch {
    return false;
  }
}

/**
 * 标记账号已绑定到会话
 */
async function markAccountBoundToSession(accountId: string, sessionId: string): Promise<void> {
  await db.appSettings.put({
    key: `${ACCOUNT_BINDING_KEY}:${accountId}:${sessionId}`,
    value: true,
    updatedAt: Date.now(),
  });
}

/**
 * 将当前玩家的微博账号绑定到当前会话
 * 
 * 这是一次性迁移代码，用于：
 * - 将 scope: 'session' 的账号的 scopeSessionId 设置为当前会话 ID
 * - 确保账号系统与 Bridge Adapter 的会话信息一致
 * 
 * 使用场景：
 * - 在设置页面点击「绑定到当前会话」按钮时调用
 * - 首次启用会话绑定功能时自动执行
 * 
 * @returns 绑定结果
 */
export async function bindWeiboAccountToCurrentSession(): Promise<{
  success: boolean;
  accountId?: string;
  sessionId?: string;
message: string;
}> {
  try {
    // 1. 获取当前会话 ID
    const accountStore = useAccountStore();
    const sessionContext = accountStore.sessionContext;
    
    if (!sessionContext?.sessionId) {
      return {
        success: false,
        message: '无法获取当前会话信息，请确保已连接到酒馆',
      };
    }
    
    const sessionId = sessionContext.sessionId;
    loggerService.debug('AccountBinding', '当前会话 ID:', sessionId);
    
    // 2. 获取玩家的微博账号
    const playerAccount = await accountStore.getPlayerAccountForPlatform('weibo');
    
    if (!playerAccount) {
      return {
        success: false,
        sessionId,
        message: '未找到微博账号，请先创建账号',
      };
    }
    
    const accountId = playerAccount.id;
    loggerService.debug('AccountBinding', '微博账号 ID:', accountId);
    
    // 3. 检查是否已绑定
    if (await isAccountBoundToSession(accountId, sessionId)) {
      return {
        success: true,
        accountId,
        sessionId,
        message: '账号已绑定到当前会话',
      };
    }
    
    // 4. 更新账号的 scopeSessionId
    // 如果账号是 session 级别，需要更新 scopeSessionId
    if (playerAccount.scope === 'session' || !playerAccount.scopeSessionId) {
      // 通过 accountService 更新账号
      await accountService.updatePlatformAccount(accountId, {
        scope: 'session',
        scopeSessionId: sessionId,
      });
      
      loggerService.debug('AccountBinding', '已更新账号 scopeSessionId:', sessionId);
    }
    
    // 5. 标记绑定完成
    await markAccountBoundToSession(accountId, sessionId);
    
    loggerService.info('AccountBinding', '账号会话绑定完成:', { accountId, sessionId });
    
    return {
      success: true,
      accountId,
      sessionId,
      message: '账号已成功绑定到当前会话',
    };
    
  } catch (error: any) {
    loggerService.error('AccountBinding', '账号会话绑定失败:', error);
    return {
      success: false,
      message: `绑定失败: ${error.message || '未知错误'}`,
    };
  }
}

/**
 * 自动将微博账号绑定到当前会话（如果尚未绑定）
 * 
 * 在 WeiboApp.vue 初始化时调用
 * 仅当有有效会话且账号未绑定时执行
 */
export async function autoBindAccountToCurrentSession(): Promise<boolean> {
  try {
    const accountStore = useAccountStore();
    const sessionContext = accountStore.sessionContext;
    
    // 没有会话信息，跳过
    if (!sessionContext?.sessionId || sessionContext.sessionId === 'standalone-session') {
      loggerService.debug('AccountBinding', '独立模式或无会话，跳过自动绑定');
      return false;
    }
    
    // 获取玩家账号
    const playerAccount = await accountStore.getPlayerAccountForPlatform('weibo');
    if (!playerAccount) {
      loggerService.debug('AccountBinding', '无微博账号，跳过自动绑定');
      return false;
    }
    
    // 检查是否已绑定
    if (await isAccountBoundToSession(playerAccount.id, sessionContext.sessionId)) {
      loggerService.debug('AccountBinding', '账号已绑定，跳过');
      return false;
    }
    
    // 执行绑定
    const result = await bindWeiboAccountToCurrentSession();
    return result.success;
    
  } catch (error) {
    loggerService.warn('AccountBinding', '自动绑定失败:', error);
    return false;
  }
}

/**
 * 账号绑定状态类型
 */
export interface AccountBindingStatus {
  hasAccount: boolean;
  accountId: string | undefined;
  currentSessionId: string | undefined;
  isBound: boolean;
  boundSessionId: string | undefined;
}

/**
 * 获取账号绑定状态
 */
export async function getAccountBindingStatus(): Promise<AccountBindingStatus> {
  try {
    const accountStore = useAccountStore();
    const sessionContext = accountStore.sessionContext;
    const playerAccount = await accountStore.getPlayerAccountForPlatform('weibo');
    
    if (!playerAccount) {
      return {
        hasAccount: false,
        accountId: undefined,
        currentSessionId: sessionContext?.sessionId ?? undefined,
        isBound: false,
        boundSessionId: undefined,
      };
    }
    
    const isBound = sessionContext?.sessionId
      ? await isAccountBoundToSession(playerAccount.id, sessionContext.sessionId)
      : false;
    
    return {
      hasAccount: true,
      accountId: playerAccount.id,
      currentSessionId: sessionContext?.sessionId ?? undefined,
      isBound,
      boundSessionId: playerAccount.scopeSessionId ?? undefined,
    };
  } catch (error) {
    loggerService.warn('AccountBinding', '获取绑定状态失败:', error);
    return {
      hasAccount: false,
      accountId: undefined,
      currentSessionId: undefined,
      isBound: false,
      boundSessionId: undefined,
    };
  }
}

/**
 * 获取数据绑定统计信息
 */
export async function getBindingStats(): Promise<{
  totalPosts: number;
  boundPosts: number;
  unboundPosts: number;
  totalComments: number;
  boundComments: number;
  unboundComments: number;
  totalTopics: number;
  boundTopics: number;
  unboundTopics: number;
}> {
  const allPosts = await db.socialPosts
    .where('platformId').equals('weibo')
    .filter(p => p.namespace === DEFAULT_NAMESPACE)
    .toArray();
  
  const allComments = await db.socialComments
    .where('platformId').equals('weibo')
    .filter(c => c.namespace === DEFAULT_NAMESPACE)
    .toArray();
  
  const allTopics = await db.socialTopics
    .where('platformId').equals('weibo')
    .filter(t => t.namespace === DEFAULT_NAMESPACE)
    .toArray();
  
  const boundPosts = allPosts.filter(p => p.source?.sessionId).length;
  const boundComments = allComments.filter(c => c.source?.sessionId).length;
  const boundTopics = allTopics.filter(t => t.source?.sessionId).length;
  
  return {
    totalPosts: allPosts.length,
    boundPosts,
    unboundPosts: allPosts.length - boundPosts,
    totalComments: allComments.length,
    boundComments,
    unboundComments: allComments.length - boundComments,
    totalTopics: allTopics.length,
    boundTopics,
    unboundTopics: allTopics.length - boundTopics,
  };
}
