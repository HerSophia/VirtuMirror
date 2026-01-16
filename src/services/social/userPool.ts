/**
 * @deprecated 此文件已废弃
 * 
 * Phase 2 重构：账号系统已迁移到新的架构
 * 
 * 新的账号系统位置：
 * - 类型定义：src/types/account.ts
 * - 服务实现：src/services/account/accountService.ts
 * - 用户生成器：src/services/account/userPool.ts
 * 
 * 此文件仅用于向后兼容，所有新代码应使用新系统
 * 计划在 v2.0 删除此文件
 * 
 * @see docs/systems/account-service.md
 */

import { accountService } from '../account/accountService';
import { UserPool as NewUserPool } from '../account/userPool';
import { db } from '../database/schema';
import type { PlatformAccount as OldPlatformAccount, SocialIdentity } from '../../types/social';
import { v4 as uuidv4 } from 'uuid';

/**
 * @deprecated 使用 src/services/account/userPool.ts 代替
 */
export class UserPool {
  private static instance: UserPool;

  private constructor() {}

  public static getInstance(): UserPool {
    if (!UserPool.instance) {
      UserPool.instance = new UserPool();
    }
    return UserPool.instance;
  }

  /**
   * @deprecated 使用 accountService.createEntity() 代替
   */
  public async getOrCreateIdentity(name: string, type: SocialIdentity['type'] = 'celebrity'): Promise<SocialIdentity> {
    console.warn('[Deprecated] UserPool.getOrCreateIdentity() is deprecated. Use accountService.createEntity() instead.');
    
    const existing = await db.socialIdentities.where('name').equals(name).first();
    if (existing) {
      return existing;
    }

    const newIdentity: SocialIdentity = {
      id: uuidv4(),
      name,
      type,
      syncStrategy: {
        enable: type !== 'user',
        platforms: ['weibo', 'bilibili']
      }
    };

    await db.socialIdentities.add(newIdentity);
    return newIdentity;
  }

  /**
   * @deprecated 使用 accountService.getPlatformAccount() 代替
   */
  public async getAccount(identityId: string, platformId: string): Promise<OldPlatformAccount | undefined> {
    console.warn('[Deprecated] UserPool.getAccount() is deprecated. Use accountService.getPlatformAccount() instead.');
    
    return await db.socialAccounts
      .where('[platformId+identityId]')
      .equals([platformId, identityId])
      .first();
  }

  /**
   * @deprecated 使用 accountService.createPlatformAccount() 代替
   */
  public async registerAccount(
    identityId: string, 
    platformId: string, 
    handle: string, 
    nickname: string,
    personaPrompt: string
  ): Promise<OldPlatformAccount> {
    console.warn('[Deprecated] UserPool.registerAccount() is deprecated. Use accountService.createPlatformAccount() instead.');
    
    const account: OldPlatformAccount = {
      id: uuidv4(),
      platformId,
      identityId,
      handle,
      nickname,
      persona: {
        prompt: personaPrompt,
        tone: 'official'
      },
      origin: 'user_created',
      persistence: 'permanent'
    };

    await db.socialAccounts.add(account);
    return account;
  }

  /**
   * @deprecated 使用 ContentFactory.ensureCommentAuthorAccount() 或新的 accountService
   * 
   * 捕获影子账号 (Shadow Account Capture)
   * 当 LLM 生成了一个未知的 handle 时调用
   */
  public async captureShadowAccount(
    platformId: string,
    handle: string,
    nickname: string,
    initialContext?: string
  ): Promise<OldPlatformAccount> {
    console.warn('[Deprecated] UserPool.captureShadowAccount() is deprecated. Use new account system instead.');
    
    // 查重
    const existing = await db.socialAccounts
      .where({ platformId, handle })
      .first();
    
    if (existing) return existing;

    // 使用新的 UserPool 生成档案
    const newUserPool = NewUserPool.getInstance();
    const profile = newUserPool.generateRandomProfile({ platform: platformId });

    // 创建影子账号
    const shadowAccount: OldPlatformAccount = {
      id: uuidv4(),
      platformId,
      handle,
      nickname,
      avatar: profile.avatar,
      persona: {
        prompt: `你是${nickname}，在互联网上活跃。`,
        tone: 'casual'
      },
      origin: 'llm_generated',
      persistence: 'permanent',
      evolution: {
        firstAppearanceTime: Date.now(),
        appearanceCount: 1,
        interactionHistory: [],
        semanticTags: [],
        vectorSignature: []
      }
    };

    if (initialContext) {
      shadowAccount.evolution!.interactionHistory.push(initialContext.slice(0, 50));
    }

    await db.socialAccounts.add(shadowAccount);
    return shadowAccount;
  }

  /**
   * @deprecated 使用新的账号系统
   */
  public async getRandomShadowAccount(platformId: string): Promise<OldPlatformAccount | undefined> {
    console.warn('[Deprecated] UserPool.getRandomShadowAccount() is deprecated.');
    
    const count = await db.socialAccounts
      .where({ platformId, origin: 'llm_generated' })
      .count();
    
    if (count === 0) return undefined;

    const offset = Math.floor(Math.random() * count);
    const accounts = await db.socialAccounts
      .where({ platformId, origin: 'llm_generated' })
      .offset(offset)
      .limit(1)
      .toArray();
      
    return accounts[0];
  }
}
