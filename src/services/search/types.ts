export type IndexableType =
  | 'post'
  | 'comment'
  | 'account'
  | 'topic'
  | 'archive'
  | 'message'

export interface IndexableDocument {
  id: string
  type: IndexableType
  content: string
  metadata?: Record<string, unknown>
  updatedAt?: number
}

export interface SearchQuery {
  text: string
  type?: IndexableType | IndexableType[]
  filters?: SearchFilter[]
  sort?: SearchSort
  pagination?: SearchPagination
  highlight?: boolean
  fuzzy?: boolean
}

export interface SearchFilter {
  field: string
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains'
  value: unknown
}

export interface SearchSort {
  field: 'score' | 'timestamp' | string
  order: 'asc' | 'desc'
}

export interface SearchPagination {
  offset: number
  limit: number
}

export interface SearchResult {
  items: SearchResultItem[]
  total: number
  took: number
  hasMore: boolean
  suggestions?: string[]
}

export interface SearchResultItem {
  id: string
  type: IndexableType
  score: number
  data: Record<string, unknown>
  highlights?: Record<string, string[]>
  matchedTerms?: string[]
}

export interface SuggestOptions {
  limit?: number
  types?: IndexableType[]
  includePopular?: boolean
}

export interface SuggestItem {
  text: string
  type: 'completion' | 'popular'
  score: number
  contentType?: IndexableType
}

export interface SearchStats {
  totalDocuments: number
  totalTerms: number
  totalPostings: number
  updatedAt: number
  byType: Partial<Record<IndexableType, number>>
}

export interface ISearchService {
  search(query: SearchQuery): Promise<SearchResult>
  suggest(prefix: string, options?: SuggestOptions): Promise<SuggestItem[]>

  index(document: IndexableDocument): Promise<void>
  indexBatch(documents: IndexableDocument[]): Promise<void>
  remove(id: string, type: IndexableType): Promise<void>
  reindex(type?: IndexableType): Promise<void>

  getStats(): Promise<SearchStats>
}
