/**
 * 社交账号迁移脚本
 * 
 * 将旧系统 (db.socialAccounts) 的数据迁移到新系统 (db.platformAccounts + db.characterEntities)
 * 
 * 运行方式：
 * 1. 在浏览器控制台执行：await window.__migrateSocialAccounts()
 * 2. 在设置页面点击「迁移旧账号数据」按钮
 * 
 * @see docs/systems/social-content-types.md Phase 2
 */

import { db } from '../database/schema';
import { accountService } from './accountService';
import type { PlatformAccount as OldPlatformAccount } from '@/types/social';
import type { EntityScope, Gender } from '@/types/account';

export interface MigrationResult {
  success: boolean;
  migrated: number;
  skipped: number;
  failed: number;
  errors: string[];
}

/**
 * 迁移单个旧账号到新系统
 */
async function migrateOneAccount(old: OldPlatformAccount): Promise<{ success: boolean; error?: string }> {
  try {
    // 检查是否已经存在相同的账号（通过 handle 判断）
    const existingAccounts = await accountService.getAccountsByPlatform(old.platformId);
    const existing = existingAccounts.find(acc => 
      acc.nickname === old.nickname || 
      (old.handle && acc.handle === old.handle)
    );
    
    if (existing) {
      return { success: true }; // 已存在，跳过
    }

    // 创建 CharacterEntity
    const entity = await accountService.createEntity({
      type: 'npc',
      displayName: old.nickname || old.handle || '未知用户',
      avatar: old.avatar,
      bio: old.persona?.prompt,
      source: old.origin === 'user_created' ? 'manual' : 'social',
      scope: 'session' as EntityScope, // 旧账号默认 session 作用域
    });

    // 创建 PlatformAccount
    await accountService.createPlatformAccount(
      entity.id,
      old.platformId,
      {
        handle: old.handle,
        nickname: old.nickname,
        avatarOverride: old.avatar,
        scope: 'session' as EntityScope,
      }
    );

    console.log(`[Migration] Migrated: ${old.nickname} (${old.platformId})`);
    return { success: true };
  } catch (error: any) {
    console.error(`[Migration] Failed to migrate ${old.nickname}:`, error);
    return { success: false, error: error.message || String(error) };
  }
}

/**
 * 执行完整迁移
 * 
 * @param options 迁移选项
 * @param options.dryRun 如果为 true，只检查不实际迁移
 * @param options.deleteOld 迁移成功后是否删除旧数据
 */
export async function migrateSocialAccounts(options?: {
  dryRun?: boolean;
  deleteOld?: boolean;
}): Promise<MigrationResult> {
  const { dryRun = false, deleteOld = false } = options || {};
  
  console.log('[Migration] Starting social accounts migration...');
  console.log(`[Migration] Options: dryRun=${dryRun}, deleteOld=${deleteOld}`);
  
  const result: MigrationResult = {
    success: true,
    migrated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  try {
    // 获取所有旧账号
    const oldAccounts = await db.socialAccounts.toArray();
    console.log(`[Migration] Found ${oldAccounts.length} old accounts to migrate`);

    if (oldAccounts.length === 0) {
      console.log('[Migration] No accounts to migrate');
      return result;
    }

    if (dryRun) {
      console.log('[Migration] Dry run mode - no changes will be made');
      result.migrated = oldAccounts.length;
      return result;
    }

    // 逐个迁移
    const migratedIds: string[] = [];
    
    for (const old of oldAccounts) {
      const migrationResult = await migrateOneAccount(old);
      
      if (migrationResult.success) {
        result.migrated++;
        migratedIds.push(old.id);
      } else {
        if (migrationResult.error?.includes('已存在') || migrationResult.error?.includes('exist')) {
          result.skipped++;
        } else {
          result.failed++;
          result.errors.push(`${old.nickname}: ${migrationResult.error}`);
        }
      }
    }

    // 可选：删除旧数据
    if (deleteOld && migratedIds.length > 0) {
      console.log(`[Migration] Deleting ${migratedIds.length} old accounts...`);
      await db.socialAccounts.bulkDelete(migratedIds);
      console.log('[Migration] Old accounts deleted');
    }

    result.success = result.failed === 0;
    
    console.log('[Migration] Migration complete:', result);
    return result;
    
  } catch (error: any) {
    console.error('[Migration] Migration failed:', error);
    result.success = false;
    result.errors.push(error.message || String(error));
    return result;
  }
}

/**
 * 检查迁移状态
 */
export async function checkMigrationStatus(): Promise<{
  oldAccountsCount: number;
  newAccountsCount: number;
  needsMigration: boolean;
}> {
  const oldAccounts = await db.socialAccounts.toArray();
  const newAccounts = await db.platformAccounts.toArray();
  
  return {
    oldAccountsCount: oldAccounts.length,
    newAccountsCount: newAccounts.length,
    needsMigration: oldAccounts.length > 0,
  };
}

/**
 * 暴露到全局，方便在控制台调用
 */
if (typeof window !== 'undefined') {
  (window as any).__migrateSocialAccounts = migrateSocialAccounts;
  (window as any).__checkMigrationStatus = checkMigrationStatus;
  
  console.log('[Migration] Migration tools available:');
  console.log('  - window.__checkMigrationStatus() - Check migration status');
  console.log('  - window.__migrateSocialAccounts() - Run migration');
  console.log('  - window.__migrateSocialAccounts({ dryRun: true }) - Dry run');
  console.log('  - window.__migrateSocialAccounts({ deleteOld: true }) - Migrate and delete old');
}
