/**
 * 微博数据清理脚本
 * 
 * 一次性清除所有微博相关数据，用于版本升级后重置
 * 
 * 清理范围：
 * - socialPosts 表中 platformId = 'weibo' 的所有帖子
 * - socialComments 表中 platformId = 'weibo' 的所有评论
 * - socialTopics 表中 platformId = 'weibo' 的所有话题
 * - appData 表中 namespace 以 'builtin/weibo' 开头的所有数据（ScopedStorage）
 * - appSettings 表中的迁移标记
 * 
 * 使用方式：
 * 1. 在微博设置页面添加「清除所有数据」按钮
 * 2. 或者在控制台执行：
 *    import { clearAllWeiboData } from '@/apps/weibo/scripts/clearAllWeiboData'
 *    await clearAllWeiboData()
 */

import { db } from '@/services/database';

export interface ClearResult {
  postsDeleted: number;
  commentsDeleted: number;
  topicsDeleted: number;
  appDataDeleted: number;
  accountsDeleted: number;
  settingsCleared: string[];
}

/**
 * 清除所有微博相关数据
 */
export async function clearAllWeiboData(): Promise<ClearResult> {
  console.log('[ClearWeiboData] 开始清理微博数据...');
  
  const result: ClearResult = {
    postsDeleted: 0,
    commentsDeleted: 0,
    topicsDeleted: 0,
    appDataDeleted: 0,
    accountsDeleted: 0,
    settingsCleared: [],
  };

  try {
    // 1. 清除微博帖子
    const posts = await db.socialPosts
      .where('platformId')
      .equals('weibo')
      .toArray();
    
    if (posts.length > 0) {
      const postIds = posts.map(p => p.id);
      await db.socialPosts.bulkDelete(postIds);
      result.postsDeleted = posts.length;
      console.log(`[ClearWeiboData] 已删除 ${posts.length} 条帖子`);
    }

    // 2. 清除微博评论
    const comments = await db.socialComments
      .where('platformId')
      .equals('weibo')
      .toArray();
    
    if (comments.length > 0) {
      const commentIds = comments.map(c => c.id);
      await db.socialComments.bulkDelete(commentIds);
      result.commentsDeleted = comments.length;
      console.log(`[ClearWeiboData] 已删除 ${comments.length} 条评论`);
    }

    // 3. 清除微博话题/热搜
    const topics = await db.socialTopics
      .where('platformId')
      .equals('weibo')
      .toArray();
    
    if (topics.length > 0) {
      const topicIds = topics.map(t => t.id);
      await db.socialTopics.bulkDelete(topicIds);
      result.topicsDeleted = topics.length;
      console.log(`[ClearWeiboData] 已删除 ${topics.length} 条热搜`);
    }

    // 4. 清除微博 ScopedStorage 数据（appData 表）
    // AppDataRecord 使用 [namespace+key] 作为复合主键
    const appDataRecords = await db.appData
      .where('namespace')
      .startsWith('builtin/weibo')
      .toArray();
    
    if (appDataRecords.length > 0) {
      // 使用 namespace+key 组合作为主键删除
      const keys = appDataRecords.map(r => [r.namespace, r.key] as [string, string]);
      await db.appData.bulkDelete(keys);
      result.appDataDeleted = appDataRecords.length;
      console.log(`[ClearWeiboData] 已删除 ${appDataRecords.length} 条 App 数据`);
    }

    // 5. 清除微博平台账号（platformAccounts 表）
    const accounts = await db.platformAccounts
      .where('platformId')
      .equals('weibo')
      .toArray();
    
    if (accounts.length > 0) {
      const accountIds = accounts.map(a => a.id);
      await db.platformAccounts.bulkDelete(accountIds);
      result.accountsDeleted = accounts.length;
      console.log(`[ClearWeiboData] 已删除 ${accounts.length} 个微博账号`);
    }

    // 6. 清除迁移标记（appSettings 表）
    const migrationKeys = [
      'weibo_data_migration_completed',
      'weibo_namespace_migration_v1',
      'weibo_account_binding_v1',
    ];
    
    for (const key of migrationKeys) {
      const setting = await db.appSettings.get(key);
      if (setting) {
        await db.appSettings.delete(key);
        result.settingsCleared.push(key);
        console.log(`[ClearWeiboData] 已清除设置: ${key}`);
      }
    }

    console.log('[ClearWeiboData] 清理完成!', result);
    return result;

  } catch (error) {
    console.error('[ClearWeiboData] 清理失败:', error);
    throw error;
  }
}

/**
 * 获取微博数据统计（用于显示确认对话框）
 */
export async function getWeiboDataStats(): Promise<{
  posts: number;
  comments: number;
  topics: number;
  appData: number;
  accounts: number;
}> {
  const [posts, comments, topics, appData, accounts] = await Promise.all([
    db.socialPosts.where('platformId').equals('weibo').count(),
    db.socialComments.where('platformId').equals('weibo').count(),
    db.socialTopics.where('platformId').equals('weibo').count(),
    db.appData.where('namespace').startsWith('builtin/weibo').count(),
    db.platformAccounts.where('platformId').equals('weibo').count(),
  ]);

  return { posts, comments, topics, appData, accounts };
}

// 暴露到 window 对象，方便在控制台调用
if (typeof window !== 'undefined') {
  (window as any).clearAllWeiboData = clearAllWeiboData;
  (window as any).getWeiboDataStats = getWeiboDataStats;
  console.log('[ClearWeiboData] 函数已注册到 window 对象，可在控制台使用:');
  console.log('  - await getWeiboDataStats()  // 查看数据统计');
  console.log('  - await clearAllWeiboData()  // 清除所有微博数据');
}
