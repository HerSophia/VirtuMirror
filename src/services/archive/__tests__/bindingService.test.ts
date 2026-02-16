import './setup'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/services/database'
import { AccountService } from '@/services/account'
import { BindingService } from '../bindingService'
import { ArchiveRepository } from '../repository'
import { createCharacterArchive } from './fixtures'

vi.mock('uuid', () => ({
  v4: vi.fn(() => `mock-uuid-${Math.random().toString(36).slice(2, 10)}`),
}))

async function clearTables(): Promise<void> {
  await db.archives.clear()
  await db.archiveConfigs.clear()
  await db.archiveInjectionHistory.clear()
  await db.platformAccounts.clear()
  await db.characterEntities.clear()
  await db.socialRelations.clear()
}

describe('BindingService', () => {
  const repository = new ArchiveRepository()
  const bindingService = new BindingService()
  let accountService: AccountService

  beforeEach(async () => {
    await clearTables()
    accountService = AccountService.getInstance()
    accountService.setSessionContext({
      sessionId: 'session-test',
      characterCardId: 'card-test',
    })
  })

  afterEach(async () => {
    await clearTables()
  })

  async function createAccount(accountId = 'account-1'): Promise<string> {
    const entity = await accountService.createEntity({
      type: 'npc',
      displayName: '绑定测试账号',
      source: 'manual',
      scope: 'session',
      scopeSessionId: 'session-test',
    })

    const account = await accountService.createPlatformAccount(entity.id, 'weibo', {
      scope: 'session',
      scopeSessionId: 'session-test',
      handle: accountId,
      nickname: '绑定测试账号',
    })

    return account.id
  }

  it('绑定和解绑应保持 archive/account 双向一致', async () => {
    const archive = createCharacterArchive({ id: 'archive-bind-1' })
    await repository.saveArchive(archive)

    const accountId = await createAccount('bind-acc')

    await bindingService.bindToAccount(archive.id, accountId)

    const boundArchive = await repository.getArchive(archive.id)
    const boundAccount = await db.platformAccounts.get(accountId)

    expect(boundArchive?.boundAccountIds).toEqual([accountId])
    expect(boundAccount?.boundArchiveIds).toEqual([archive.id])

    await bindingService.unbindFromAccount(archive.id, accountId)

    const unboundArchive = await repository.getArchive(archive.id)
    const unboundAccount = await db.platformAccounts.get(accountId)

    expect(unboundArchive?.boundAccountIds).toBeUndefined()
    expect(unboundAccount?.boundArchiveIds).toBeUndefined()
  })

  it('getAccountArchives 应返回账号绑定档案', async () => {
    const archiveA = createCharacterArchive({ id: 'archive-a' })
    const archiveB = createCharacterArchive({ id: 'archive-b', name: '另一个角色' })

    await repository.saveArchive(archiveA)
    await repository.saveArchive(archiveB)

    const accountId = await createAccount('query-acc')

    await bindingService.bindToAccount(archiveA.id, accountId)
    await bindingService.bindToAccount(archiveB.id, accountId)

    const archives = await bindingService.getAccountArchives(accountId)
    expect(archives.map((archive) => archive.id)).toEqual(['archive-a', 'archive-b'])
  })

  it('删除账号时应级联清理 archive.boundAccountIds', async () => {
    const archive = createCharacterArchive({ id: 'archive-cascade-1' })
    await repository.saveArchive(archive)

    const accountId = await createAccount('cascade-acc')
    await bindingService.bindToAccount(archive.id, accountId)

    await accountService.deletePlatformAccount(accountId)

    const reloadedArchive = await repository.getArchive(archive.id)
    expect(reloadedArchive?.boundAccountIds).toBeUndefined()
  })
})
