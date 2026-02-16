# 搜索服务类型定义

> 本文档给出 Search MVP 对外契约，供服务实现和调用方统一使用。

## 1. 基础类型

```typescript
export type IndexableType =
  | 'post'
  | 'comment'
  | 'account'
  | 'topic'
  | 'archive'
  | 'message';

export interface IndexableDocument {
  id: string;
  type: IndexableType;
  content: string;
  metadata?: Record<string, unknown>;
  updatedAt?: number;
}
```

## 2. 查询类型

```typescript
export interface SearchQuery {
  text: string;
  type?: IndexableType | IndexableType[];
  filters?: SearchFilter[];
  sort?: SearchSort;
  pagination?: SearchPagination;
  highlight?: boolean;
  fuzzy?: boolean; // MVP 默认 false，可预留
}

export interface SearchFilter {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains';
  value: unknown;
}

export interface SearchSort {
  field: 'score' | 'timestamp' | string;
  order: 'asc' | 'desc';
}

export interface SearchPagination {
  offset: number;
  limit: number;
}
```

## 3. 返回结果

```typescript
export interface SearchResult {
  items: SearchResultItem[];
  total: number;
  took: number;
  hasMore: boolean;
  suggestions?: string[];
}

export interface SearchResultItem {
  id: string;
  type: IndexableType;
  score: number;
  data: Record<string, unknown>;
  highlights?: Record<string, string[]>;
  matchedTerms?: string[];
}
```

## 4. 建议能力

```typescript
export interface SuggestOptions {
  limit?: number;
  types?: IndexableType[];
  includePopular?: boolean;
}

export interface SuggestItem {
  text: string;
  type: 'completion' | 'popular';
  score: number;
  contentType?: IndexableType;
}
```

## 5. 服务接口

```typescript
export interface ISearchService {
  search(query: SearchQuery): Promise<SearchResult>;
  suggest(prefix: string, options?: SuggestOptions): Promise<SuggestItem[]>;

  index(document: IndexableDocument): Promise<void>;
  indexBatch(documents: IndexableDocument[]): Promise<void>;
  remove(id: string, type: IndexableType): Promise<void>;
  reindex(type?: IndexableType): Promise<void>;

  getStats(): Promise<SearchStats>;
}

export interface SearchStats {
  totalDocuments: number;
  totalTerms: number;
  totalPostings: number;
  updatedAt: number;
  byType: Partial<Record<IndexableType, number>>;
}
```

## 6. 可选扩展（非 MVP）

```typescript
export interface SemanticSearchOptions {
  topK: number;
  threshold?: number;
  types?: IndexableType[];
}

export interface ISemanticSearchExtension {
  semanticSearch(query: string, options?: SemanticSearchOptions): Promise<SearchResult>;
}
```

## 7. 事件契约（建议）

```typescript
export type SearchEventMap = {
  'search:indexed': { id: string; type: IndexableType };
  'search:removed': { id: string; type: IndexableType };
  'search:reindexed': { type?: IndexableType; costMs: number };
  'search:failed': { action: 'index' | 'search' | 'reindex'; reason: string };
};
```
