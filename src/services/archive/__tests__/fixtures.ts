import type { ArchiveRecord } from '@/types/archive'

export function createEventArchive(
  overrides: Partial<Extract<ArchiveRecord, { type: 'event' }>> = {}
): Extract<ArchiveRecord, { type: 'event' }> {
  const now = Date.now()
  return {
    id: `event-${Math.random().toString(36).slice(2, 10)}`,
    sessionId: 'session-test',
    type: 'event',
    subType: 'plot',
    sourceFloors: [{ messageId: 1, swipeId: 0 }],
    extractedAt: now,
    title: '测试事件',
    summary: '测试事件摘要',
    participants: ['Alice'],
    realTimestamp: now,
    importance: 'normal',
    status: 'pending',
    injectionLevel: 'contextual',
    injectionPriority: 50,
    keywords: ['测试', '事件'],
    createdAt: now,
    lastUpdated: now,
    ...overrides,
  }
}

export function createCharacterArchive(
  overrides: Partial<Extract<ArchiveRecord, { type: 'character' }>> = {}
): Extract<ArchiveRecord, { type: 'character' }> {
  const now = Date.now()
  return {
    id: `character-${Math.random().toString(36).slice(2, 10)}`,
    sessionId: 'session-test',
    type: 'character',
    name: '艾琳',
    aliases: [],
    role: 'main',
    traits: ['理性', '谨慎'],
    knownFacts: [],
    recentActions: [],
    source: 'manual',
    updateHistory: [],
    injectionLevel: 'contextual',
    injectionPriority: 50,
    keywords: ['艾琳', '角色'],
    createdAt: now,
    lastUpdated: now,
    ...overrides,
  }
}

export function createWorldArchive(
  overrides: Partial<Extract<ArchiveRecord, { type: 'world' }>> = {}
): Extract<ArchiveRecord, { type: 'world' }> {
  const now = Date.now()
  return {
    id: `world-${Math.random().toString(36).slice(2, 10)}`,
    sessionId: 'session-test',
    type: 'world',
    category: 'location',
    name: '魔法学院',
    description: '世界观中的主要地点',
    relatedCharacters: [],
    relatedEntries: [],
    relatedEvents: [],
    source: 'manual',
    injectionLevel: 'contextual',
    injectionPriority: 45,
    keywords: ['学院', '魔法'],
    createdAt: now,
    lastUpdated: now,
    ...overrides,
  }
}
