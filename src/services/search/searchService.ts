import { loggerService } from '@/services/logger'
import type {
  ISearchService,
  IndexableDocument,
  IndexableType,
  SearchFilter,
  SearchQuery,
  SearchResult,
  SearchResultItem,
  SearchSort,
  SearchStats,
  SuggestItem,
  SuggestOptions,
} from './types'

interface StoredDocument {
  id: string
  type: IndexableType
  content: string
  metadata: Record<string, unknown>
  updatedAt: number
  tokens: string[]
}

const DEFAULT_LIMIT = 20
const DEFAULT_OFFSET = 0
const DEFAULT_SUGGEST_LIMIT = 10
const MAX_SUGGEST_LIMIT = 20
const STOP_WORDS = new Set(['的', '了', '是', '在', '和', '有', 'the', 'a', 'an', 'is', 'are'])

const searchLogger = loggerService.child('search:query')
const indexLogger = loggerService.child('search:index')

function makeDocKey(type: IndexableType, id: string): string {
  return `${type}:${id}`
}

function isIndexableType(value: string): value is IndexableType {
  return (
    value === 'post' ||
    value === 'comment' ||
    value === 'account' ||
    value === 'topic' ||
    value === 'archive' ||
    value === 'message'
  )
}

function extractTypeFromDocKey(docKey: string): IndexableType | null {
  const separatorIndex = docKey.indexOf(':')
  if (separatorIndex <= 0) {
    return null
  }

  const type = docKey.slice(0, separatorIndex)
  if (!isIndexableType(type)) {
    return null
  }

  return type
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase()
}

function normalizeTypeFilter(type?: IndexableType | IndexableType[]): Set<IndexableType> | null {
  if (!type) return null
  return new Set(Array.isArray(type) ? type : [type])
}

function asTimestamp(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  return null
}

export class SearchService implements ISearchService {
  private readonly documents = new Map<string, StoredDocument>()
  private readonly postings = new Map<string, Map<string, number>>()
  private readonly termDocFrequency = new Map<string, number>()
  private readonly suggestionWeights = new Map<string, number>()
  private readonly suggestionTypes = new Map<string, Set<IndexableType>>()

  async search(query: SearchQuery): Promise<SearchResult> {
    const startedAt = performance.now()
    const text = normalizeText(query.text)

    if (!text) {
      return {
        items: [],
        total: 0,
        took: 0,
        hasMore: false,
      }
    }

    const typeFilter = normalizeTypeFilter(query.type)
    const exactMatches = this.collectExactMatches(text, typeFilter)

    const tokens = this.tokenize(text)
    const lexicalMatches = this.collectLexicalMatches(tokens, typeFilter)

    const mergedScores = new Map<string, number>()
    const mergedTerms = new Map<string, Set<string>>()

    for (const [docKey, score] of exactMatches) {
      mergedScores.set(docKey, Math.max(score, mergedScores.get(docKey) ?? 0))
      if (!mergedTerms.has(docKey)) {
        mergedTerms.set(docKey, new Set())
      }
      mergedTerms.get(docKey)!.add(text)
    }

    for (const [docKey, score] of lexicalMatches) {
      mergedScores.set(docKey, Math.max(score, mergedScores.get(docKey) ?? 0))
      if (!mergedTerms.has(docKey)) {
        mergedTerms.set(docKey, new Set())
      }
      for (const token of tokens) {
        mergedTerms.get(docKey)!.add(token)
      }
    }

    let items = Array.from(mergedScores.entries())
      .map(([docKey, score]) => this.buildSearchResultItem(docKey, score, mergedTerms.get(docKey)))
      .filter((item): item is SearchResultItem => Boolean(item))

    if (query.filters && query.filters.length > 0) {
      items = items.filter((item) => this.matchesFilters(item, query.filters!))
    }

    this.sortItems(items, query.sort)

    const offset = Math.max(DEFAULT_OFFSET, query.pagination?.offset ?? DEFAULT_OFFSET)
    const limit = Math.max(1, query.pagination?.limit ?? DEFAULT_LIMIT)
    const pagedItems = items.slice(offset, offset + limit)

    const took = Math.round((performance.now() - startedAt) * 100) / 100
    searchLogger.debug('search completed', {
      query: text,
      total: items.length,
      took,
      types: query.type,
    })

    const result: SearchResult = {
      items: pagedItems,
      total: items.length,
      took,
      hasMore: offset + limit < items.length,
    }

    if (items.length === 0) {
      const fallbackSuggestions = await this.suggest(text, {
        limit: 3,
        includePopular: true,
      })
      if (fallbackSuggestions.length > 0) {
        result.suggestions = fallbackSuggestions.map((item) => item.text)
      }
    }

    return result
  }

  async suggest(prefix: string, options: SuggestOptions = {}): Promise<SuggestItem[]> {
    const normalizedPrefix = normalizeText(prefix)
    if (!normalizedPrefix) {
      return []
    }

    const limit = Math.min(Math.max(options.limit ?? DEFAULT_SUGGEST_LIMIT, 1), MAX_SUGGEST_LIMIT)
    const typeFilter = options.types ? new Set(options.types) : null
    const suggestions: SuggestItem[] = []

    for (const [term, weight] of this.suggestionWeights.entries()) {
      if (!term.startsWith(normalizedPrefix)) {
        continue
      }

      const termTypes = this.suggestionTypes.get(term)
      if (typeFilter && termTypes) {
        const hasType = Array.from(termTypes).some((type) => typeFilter.has(type))
        if (!hasType) {
          continue
        }
      }

      suggestions.push({
        text: term,
        type: options.includePopular ? 'popular' : 'completion',
        score: weight,
      })
    }

    suggestions.sort((a, b) => b.score - a.score || a.text.localeCompare(b.text))

    return suggestions.slice(0, limit)
  }

  async index(document: IndexableDocument): Promise<void> {
    const normalizedContent = document.content.trim()
    if (!normalizedContent) {
      return
    }

    const docKey = makeDocKey(document.type, document.id)
    const existing = this.documents.get(docKey)
    if (existing) {
      this.removeTokenReferences(existing)
    }

    const tokens = this.tokenize(normalizedContent)
    if (tokens.length === 0) {
      return
    }

    const storedDocument: StoredDocument = {
      id: document.id,
      type: document.type,
      content: normalizedContent,
      metadata: document.metadata ?? {},
      updatedAt: document.updatedAt ?? Date.now(),
      tokens,
    }

    this.documents.set(docKey, storedDocument)
    this.addTokenReferences(storedDocument)

    indexLogger.debug('document indexed', {
      id: document.id,
      type: document.type,
      tokenCount: tokens.length,
    })
  }

  async indexBatch(documents: IndexableDocument[]): Promise<void> {
    for (const document of documents) {
      await this.index(document)
    }
  }

  async remove(id: string, type: IndexableType): Promise<void> {
    const docKey = makeDocKey(type, id)
    const existing = this.documents.get(docKey)
    if (!existing) {
      return
    }

    this.removeTokenReferences(existing)
    this.documents.delete(docKey)

    indexLogger.debug('document removed', { id, type })
  }

  async reindex(type?: IndexableType): Promise<void> {
    const startedAt = Date.now()

    if (!type) {
      this.postings.clear()
      this.termDocFrequency.clear()
      this.suggestionWeights.clear()
      this.suggestionTypes.clear()

      for (const doc of this.documents.values()) {
        this.addTokenReferences(doc)
      }

      indexLogger.info('reindex completed', {
        type: 'all',
        costMs: Date.now() - startedAt,
        documentCount: this.documents.size,
      })

      return
    }

    const docs = Array.from(this.documents.values()).filter((doc) => doc.type === type)
    for (const doc of docs) {
      this.removeTokenReferences(doc)
    }
    for (const doc of docs) {
      this.addTokenReferences(doc)
    }

    indexLogger.info('reindex completed', {
      type,
      costMs: Date.now() - startedAt,
      documentCount: this.documents.size,
    })
  }

  async getStats(): Promise<SearchStats> {
    const byType: Partial<Record<IndexableType, number>> = {}

    for (const doc of this.documents.values()) {
      byType[doc.type] = (byType[doc.type] ?? 0) + 1
    }

    let totalPostings = 0
    for (const postingsByDoc of this.postings.values()) {
      totalPostings += postingsByDoc.size
    }

    let updatedAt = 0
    for (const doc of this.documents.values()) {
      if (doc.updatedAt > updatedAt) {
        updatedAt = doc.updatedAt
      }
    }

    return {
      totalDocuments: this.documents.size,
      totalTerms: this.postings.size,
      totalPostings,
      updatedAt,
      byType,
    }
  }

  private tokenize(text: string): string[] {
    const normalized = normalizeText(text)
    if (!normalized) {
      return []
    }

    const tokens = new Set<string>()

    const englishMatches = normalized.match(/[a-z0-9]+/g) ?? []
    for (const token of englishMatches) {
      if (token.length <= 1 || STOP_WORDS.has(token)) {
        continue
      }
      tokens.add(token)
    }

    const chineseMatches = normalized.match(/[\u4e00-\u9fa5]+/g) ?? []
    for (const segment of chineseMatches) {
      for (let i = 0; i < segment.length; i += 1) {
        const single = segment[i]
        if (!STOP_WORDS.has(single)) {
          tokens.add(single)
        }

        if (i < segment.length - 1) {
          const biGram = segment.slice(i, i + 2)
          if (!STOP_WORDS.has(biGram)) {
            tokens.add(biGram)
          }
        }
      }
    }

    return Array.from(tokens)
  }

  private collectExactMatches(text: string, typeFilter: Set<IndexableType> | null): Map<string, number> {
    const matches = new Map<string, number>()

    for (const [docKey, doc] of this.documents.entries()) {
      if (typeFilter && !typeFilter.has(doc.type)) {
        continue
      }

      if (doc.id.toLowerCase() === text) {
        matches.set(docKey, 1)
        continue
      }

      const username = doc.metadata.username
      if (typeof username === 'string' && normalizeText(username) === text) {
        matches.set(docKey, 0.95)
      }
    }

    return matches
  }

  private collectLexicalMatches(tokens: string[], typeFilter: Set<IndexableType> | null): Map<string, number> {
    const scores = new Map<string, number>()
    if (tokens.length === 0) {
      return scores
    }

    const totalDocs = Math.max(this.documents.size, 1)

    for (const token of tokens) {
      const posting = this.postings.get(token)
      if (!posting) {
        continue
      }

      const docsWithToken = posting.size
      const idf = Math.log((totalDocs + 1) / (docsWithToken + 1)) + 1

      for (const [docKey, tf] of posting.entries()) {
        const doc = this.documents.get(docKey)
        if (!doc) {
          continue
        }

        if (typeFilter && !typeFilter.has(doc.type)) {
          continue
        }

        const score = (scores.get(docKey) ?? 0) + tf * idf
        scores.set(docKey, score)
      }
    }

    return scores
  }

  private buildSearchResultItem(
    docKey: string,
    score: number,
    matchedTerms?: Set<string>
  ): SearchResultItem | null {
    const doc = this.documents.get(docKey)
    if (!doc) {
      return null
    }

    return {
      id: doc.id,
      type: doc.type,
      score,
      data: {
        id: doc.id,
        type: doc.type,
        content: doc.content,
        metadata: doc.metadata,
        updatedAt: doc.updatedAt,
      },
      matchedTerms: matchedTerms ? Array.from(matchedTerms) : undefined,
    }
  }

  private matchesFilters(item: SearchResultItem, filters: SearchFilter[]): boolean {
    const metadata = (item.data.metadata ?? {}) as Record<string, unknown>

    for (const filter of filters) {
      const value = metadata[filter.field]
      if (!this.evaluateFilter(value, filter)) {
        return false
      }
    }

    return true
  }

  private evaluateFilter(left: unknown, filter: SearchFilter): boolean {
    switch (filter.operator) {
      case 'eq':
        return left === filter.value
      case 'ne':
        return left !== filter.value
      case 'gt':
        return this.compareNumber(left, filter.value, (a, b) => a > b)
      case 'gte':
        return this.compareNumber(left, filter.value, (a, b) => a >= b)
      case 'lt':
        return this.compareNumber(left, filter.value, (a, b) => a < b)
      case 'lte':
        return this.compareNumber(left, filter.value, (a, b) => a <= b)
      case 'in':
        return Array.isArray(filter.value) && filter.value.includes(left)
      case 'contains':
        return typeof left === 'string' && typeof filter.value === 'string'
          ? left.includes(filter.value)
          : false
      default:
        return false
    }
  }

  private compareNumber(
    left: unknown,
    right: unknown,
    comparator: (left: number, right: number) => boolean
  ): boolean {
    return typeof left === 'number' && typeof right === 'number' ? comparator(left, right) : false
  }

  private sortItems(items: SearchResultItem[], sort?: SearchSort): void {
    const order = sort?.order ?? 'desc'

    if (!sort || sort.field === 'score') {
      items.sort((a, b) => (order === 'asc' ? a.score - b.score : b.score - a.score))
      return
    }

    const field = sort.field
    const direction = order === 'asc' ? 1 : -1

    items.sort((a, b) => {
      const left = this.extractSortableValue(a, field)
      const right = this.extractSortableValue(b, field)

      if (left === right) {
        return b.score - a.score
      }

      if (left === null) return 1
      if (right === null) return -1

      if (typeof left === 'number' && typeof right === 'number') {
        return (left - right) * direction
      }

      return String(left).localeCompare(String(right)) * direction
    })
  }

  private extractSortableValue(item: SearchResultItem, field: string): string | number | null {
    if (field === 'timestamp') {
      const metadata = (item.data.metadata ?? {}) as Record<string, unknown>
      return asTimestamp(metadata.timestamp)
    }

    const metadata = (item.data.metadata ?? {}) as Record<string, unknown>
    const value = metadata[field]

    if (typeof value === 'number' || typeof value === 'string') {
      return value
    }

    return null
  }

  private addTokenReferences(doc: StoredDocument): void {
    const tokenCounts = new Map<string, number>()

    for (const token of doc.tokens) {
      tokenCounts.set(token, (tokenCounts.get(token) ?? 0) + 1)
    }

    for (const [token, count] of tokenCounts.entries()) {
      if (!this.postings.has(token)) {
        this.postings.set(token, new Map())
      }

      const posting = this.postings.get(token)!
      const tf = count / doc.tokens.length
      posting.set(makeDocKey(doc.type, doc.id), tf)

      this.termDocFrequency.set(token, posting.size)
      this.suggestionWeights.set(token, (this.suggestionWeights.get(token) ?? 0) + count)

      if (!this.suggestionTypes.has(token)) {
        this.suggestionTypes.set(token, new Set())
      }
      this.suggestionTypes.get(token)!.add(doc.type)
    }
  }

  private removeTokenReferences(doc: StoredDocument): void {
    const docKey = makeDocKey(doc.type, doc.id)
    const tokenCounts = new Map<string, number>()

    for (const token of doc.tokens) {
      tokenCounts.set(token, (tokenCounts.get(token) ?? 0) + 1)
    }

    for (const [token, count] of tokenCounts.entries()) {
      const posting = this.postings.get(token)
      if (!posting) {
        continue
      }

      posting.delete(docKey)
      if (posting.size === 0) {
        this.postings.delete(token)
        this.termDocFrequency.delete(token)
        this.suggestionWeights.delete(token)
        this.suggestionTypes.delete(token)
        continue
      }

      this.termDocFrequency.set(token, posting.size)

      const nextWeight = Math.max((this.suggestionWeights.get(token) ?? 0) - count, 0)
      if (nextWeight === 0) {
        this.suggestionWeights.delete(token)
      } else {
        this.suggestionWeights.set(token, nextWeight)
      }

      const types = new Set<IndexableType>()
      for (const relatedDocKey of posting.keys()) {
        const extractedType = extractTypeFromDocKey(relatedDocKey)
        if (extractedType) {
          types.add(extractedType)
        }
      }
      if (types.size === 0) {
        this.suggestionTypes.delete(token)
      } else {
        this.suggestionTypes.set(token, types)
      }
    }
  }
}

let searchServiceInstance: SearchService | null = null

export function getSearchService(): SearchService {
  if (!searchServiceInstance) {
    searchServiceInstance = new SearchService()
  }

  return searchServiceInstance
}

export function resetSearchService(): void {
  searchServiceInstance = null
}

export const searchService = getSearchService()
