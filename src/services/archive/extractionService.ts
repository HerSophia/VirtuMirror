import JSON5 from 'json5'
import { z } from 'zod'
import AIGenerateService from '@/services/aiGenerateService'
import type {
  ArchiveFloorData,
  CharacterUpdate,
  ChatArchive,
  EventImportance,
  EventSubType,
  ExtractOptions,
  ExtractResult,
  Keyword,
  WorldEntry,
  WorldEntryCategory,
} from '@/types/archive'

const extractionSchema = z.object({
  events: z
    .array(
      z.object({
        title: z.string().min(1),
        summary: z.string().min(1),
        subType: z.enum(['plot', 'dialogue', 'discovery', 'decision']).optional(),
        importance: z.enum(['critical', 'major', 'normal', 'minor']).optional(),
        participants: z.array(z.string()).optional(),
        location: z.string().optional(),
        keyQuotes: z.array(z.string()).optional(),
        sourceFloors: z.array(z.number().int().nonnegative()).optional(),
        inWorldTime: z.string().optional(),
        inWorldDate: z.string().optional(),
      })
    )
    .default([]),
  characterUpdates: z
    .array(
      z.object({
        characterId: z.string().optional(),
        name: z.string().min(1),
        isNew: z.boolean().optional(),
        updates: z
          .object({
            aliases: z.array(z.string()).optional(),
            role: z.enum(['protagonist', 'main', 'supporting', 'npc']).optional(),
            baseDescription: z.string().optional(),
            traits: z.array(z.string()).optional(),
            abilities: z.array(z.string()).optional(),
          })
          .passthrough()
          .optional(),
      })
    )
    .default([]),
  worldEntries: z
    .array(
      z.object({
        name: z.string().min(1),
        description: z.string().min(1),
        category: z.enum(['location', 'organization', 'item', 'concept', 'rule', 'history']).optional(),
        details: z.record(z.string(), z.string()).optional(),
        relatedCharacters: z.array(z.string()).optional(),
        relatedEntries: z.array(z.string()).optional(),
        relatedEvents: z.array(z.string()).optional(),
      })
    )
    .default([]),
  keywords: z.array(z.string()).default([]),
})

type ParsedExtraction = z.infer<typeof extractionSchema>

function buildFloorRange(floors: ArchiveFloorData[]): { start: number; end: number } | undefined {
  if (floors.length === 0) {
    return undefined
  }

  const sorted = [...floors].sort((left, right) => left.messageId - right.messageId)
  return {
    start: sorted[0].messageId,
    end: sorted[sorted.length - 1].messageId,
  }
}

function normalizeSubType(subType: string | undefined): EventSubType {
  if (subType === 'dialogue' || subType === 'discovery' || subType === 'decision') {
    return subType
  }
  return 'plot'
}

function normalizeImportance(value: string | undefined): EventImportance {
  if (value === 'critical' || value === 'major' || value === 'minor') {
    return value
  }
  return 'normal'
}

function normalizeCategory(value: string | undefined): WorldEntryCategory {
  if (
    value === 'location' ||
    value === 'organization' ||
    value === 'item' ||
    value === 'concept' ||
    value === 'rule' ||
    value === 'history'
  ) {
    return value
  }

  return 'concept'
}

function extractJsonText(rawText: string): string {
  const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim()

  const firstObject = cleaned.indexOf('{')
  const lastObject = cleaned.lastIndexOf('}')
  if (firstObject !== -1 && lastObject !== -1 && lastObject > firstObject) {
    return cleaned.slice(firstObject, lastObject + 1)
  }

  return cleaned
}

function collectDefaultKeywords(floors: ArchiveFloorData[]): string[] {
  const words: string[] = []
  for (const floor of floors) {
    const segments = floor.content
      .replace(/[\n#"'`~]/g, ' ')
      .split(/[\s,，。！？!?；;、|/:()\[\]{}<>]+/)
      .map((word) => word.trim())
      .filter((word) => word.length >= 2 && word.length <= 18)

    words.push(...segments)
  }

  return Array.from(new Set(words)).slice(0, 12)
}

function mapEvents(
  events: ParsedExtraction['events'],
  floors: ArchiveFloorData[],
  sessionId: string,
  now: number
): ChatArchive[] {
  const floorIndex = new Map(floors.map((floor) => [floor.messageId, floor]))

  return events.map((event, index) => {
    const eventId = `archive:event:${now}:${index}`
    const sourceFloorIds = event.sourceFloors && event.sourceFloors.length > 0
      ? event.sourceFloors
      : floors.slice(-2).map((floor) => floor.messageId)

    const sourceFloors = sourceFloorIds.map((messageId) => {
      const floor = floorIndex.get(messageId)
      return {
        messageId,
        swipeId: floor?.swipeId ?? 0,
        excerpt: floor?.content?.slice(0, 120),
      }
    })

    const keywords = Array.from(
      new Set(
        [event.title, event.summary, ...(event.participants ?? [])]
          .join(' ')
          .split(/[\s,，。！？!?；;、|/:()\[\]{}<>]+/)
          .map((word) => word.trim().toLowerCase())
          .filter((word) => word.length >= 2 && word.length <= 18)
      )
    ).slice(0, 8)

    return {
      id: eventId,
      sessionId,
      type: 'event',
      subType: normalizeSubType(event.subType),
      sourceFloors,
      extractedAt: now,
      title: event.title,
      summary: event.summary,
      keyQuotes: event.keyQuotes,
      participants: event.participants ?? [],
      inWorldTime: event.inWorldTime,
      inWorldDate: event.inWorldDate,
      realTimestamp: now,
      location: event.location,
      importance: normalizeImportance(event.importance),
      status: 'pending',
      injectionLevel: 'contextual',
      keywords,
      createdAt: now,
      lastUpdated: now,
      injectionPriority: 50,
    }
  })
}

function mapCharacterUpdates(characterUpdates: ParsedExtraction['characterUpdates']): CharacterUpdate[] {
  return characterUpdates.map((item) => ({
    characterId: item.characterId,
    name: item.name,
    isNew: item.isNew ?? !item.characterId,
    updates: item.updates ?? {},
  }))
}

function mapWorldEntries(
  entries: ParsedExtraction['worldEntries'],
  sessionId: string,
  now: number
): WorldEntry[] {
  return entries.map((entry, index) => {
    const keywords = Array.from(
      new Set(
        `${entry.name} ${entry.description}`
          .split(/[\s,，。！？!?；;、|/:()\[\]{}<>]+/)
          .map((word) => word.trim().toLowerCase())
          .filter((word) => word.length >= 2 && word.length <= 18)
      )
    ).slice(0, 8)

    return {
      id: `archive:world:${now}:${index}`,
      sessionId,
      type: 'world',
      category: normalizeCategory(entry.category),
      name: entry.name,
      description: entry.description,
      details: entry.details,
      relatedCharacters: entry.relatedCharacters ?? [],
      relatedEntries: entry.relatedEntries ?? [],
      relatedEvents: entry.relatedEvents ?? [],
      source: 'chat_extract',
      injectionLevel: 'contextual',
      keywords,
      createdAt: now,
      lastUpdated: now,
      injectionPriority: 45,
    }
  })
}

function mapKeywords(
  keywords: string[],
  floors: ArchiveFloorData[],
  sessionId: string,
  now: number
): Keyword[] {
  const fallbackKeywords = keywords.length > 0 ? keywords : collectDefaultKeywords(floors)

  return fallbackKeywords.slice(0, 20).map((keyword, index) => ({
    id: `archive:keyword:${now}:${index}`,
    sessionId,
    text: keyword,
    usageCount: 1,
    linkedArchives: [],
    linkedCharacters: [],
    linkedEntries: [],
    source: 'ai_generated',
    createdAt: now,
  }))
}

function buildPrompt(floors: ArchiveFloorData[], options: Required<Pick<ExtractOptions, 'extractEvents' | 'extractCharacters' | 'extractWorld' | 'generateKeywords'>>): string {
  const floorContent = floors
    .sort((left, right) => left.messageId - right.messageId)
    .map(
      (floor) =>
        `[${floor.messageId}/${floor.swipeId}](${floor.role}) ${floor.content.replace(/\s+/g, ' ').trim()}`
    )
    .join('\n')

  const focus = [
    options.extractEvents ? '事件' : null,
    options.extractCharacters ? '角色更新' : null,
    options.extractWorld ? '世界设定' : null,
    options.generateKeywords ? '关键词' : null,
  ]
    .filter(Boolean)
    .join('、')

  return `请从以下聊天楼层中提取结构化信息。\n\n提取重点：${focus || '事件、角色更新、世界设定、关键词'}\n\n输出要求：\n1. 只输出 JSON，不要附加解释。\n2. 字段必须为 events/characterUpdates/worldEntries/keywords。\n3. 若没有可提取内容，输出空数组。\n\n聊天内容：\n${floorContent}`
}

export class ExtractionService {
  async extractFromChat(floors: ArchiveFloorData[], options?: ExtractOptions): Promise<ExtractResult> {
    const now = Date.now()
    const floorRange = buildFloorRange(floors)
    const sessionId = options?.sessionId ?? 'session:unknown'
    const toggles = {
      extractEvents: options?.extractEvents ?? true,
      extractCharacters: options?.extractCharacters ?? true,
      extractWorld: options?.extractWorld ?? true,
      generateKeywords: options?.generateKeywords ?? true,
    }

    if (floors.length === 0) {
      return {
        success: true,
        events: [],
        characterUpdates: [],
        worldEntries: [],
        keywords: [],
        metadata: {
          floorRange,
          extractedAt: now,
          llmTokensUsed: 0,
        },
      }
    }

    const prompt = buildPrompt(floors, toggles)

    try {
      const result = await AIGenerateService.generate(
        {
          systemPrompt:
            '你是档案提取助手。请从聊天内容中提取事件、角色更新、世界设定与关键词，返回 JSON。',
          userPrompt: prompt,
        },
        {
          maxTokens: options?.maxTokens ?? 1800,
          temperature: 0.2,
          scene: options?.scene ?? 'archive.extract.mvp',
          appId: 'archives',
        }
      )

      if (!result.success) {
        return {
          success: false,
          events: [],
          characterUpdates: [],
          worldEntries: [],
          keywords: [],
          metadata: {
            floorRange,
            extractedAt: now,
            llmTokensUsed: result.usage?.totalTokens ?? 0,
          },
          error: result.error ?? 'Archive extraction failed',
        }
      }

      const parsedText = extractJsonText(result.text)
      const parsedRaw = JSON5.parse(parsedText)
      const parsed = extractionSchema.safeParse(parsedRaw)

      if (!parsed.success) {
        return {
          success: false,
          events: [],
          characterUpdates: [],
          worldEntries: [],
          keywords: [],
          metadata: {
            floorRange,
            extractedAt: now,
            llmTokensUsed: result.usage?.totalTokens ?? 0,
          },
          error: `Archive extraction schema validation failed: ${parsed.error.issues[0]?.message ?? 'unknown error'}`,
        }
      }

      const payload = parsed.data

      const events = toggles.extractEvents ? mapEvents(payload.events, floors, sessionId, now) : []
      const characterUpdates = toggles.extractCharacters
        ? mapCharacterUpdates(payload.characterUpdates)
        : []
      const worldEntries = toggles.extractWorld ? mapWorldEntries(payload.worldEntries, sessionId, now) : []
      const keywords = toggles.generateKeywords ? mapKeywords(payload.keywords, floors, sessionId, now) : []

      return {
        success: true,
        events,
        characterUpdates,
        worldEntries,
        keywords,
        metadata: {
          floorRange,
          extractedAt: now,
          llmTokensUsed: result.usage?.totalTokens ?? 0,
        },
      }
    } catch (error) {
      return {
        success: false,
        events: [],
        characterUpdates: [],
        worldEntries: [],
        keywords: [],
        metadata: {
          floorRange,
          extractedAt: now,
          llmTokensUsed: 0,
        },
        error: error instanceof Error ? error.message : 'Archive extraction failed',
      }
    }
  }
}
