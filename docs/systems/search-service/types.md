# 搜索服务类型定义

本文档定义搜索服务（Search Service）的所有 TypeScript 类型。

---

## 可索引类型

```typescript
/**
 * 可索引的内容类型
 */
type IndexableType =
  | 'post'      // 帖子/博文
  | 'comment'   // 评论
  | 'account'   // 用户/账号
  | 'topic'     // 话题/热搜
  | 'archive'   // 档案
  | 'message';  // 私信
```

---

## 可索引内容

```typescript
/**
 * 可索引的内容项
 */
interface Indexable {
  /** 内容唯一标识 */
  id: string;
  
  /** 内容类型 */
  type: IndexableType;
  
  /** 要索引的文本内容 */
  content: string;
  
  /** 额外的元数据（用于过滤和排序） */
  metadata?: IndexableMetadata;
}

/**
 * 可索引内容的元数据
 */
interface IndexableMetadata {
  /** 作者 ID */
  authorId?: string;
  
  /** 平台 ID */
  platformId?: string;
  
  /** 创建时间戳 */
  timestamp?: number;
  
  /** 标签列表 */
  tags?: string[];
  
  /** 自定义字段 */
  [key: string]: any;
}
```

---

## 搜索查询

```typescript
/**
 * 搜索查询参数
 */
interface SearchQuery {
  /** 搜索文本 */
  text: string;
  
  /** 搜索范围（单个类型或多个类型） */
  type?: IndexableType | IndexableType[];
  
  /** 过滤条件 */
  filters?: SearchFilter[];
  
  /** 排序方式 */
  sort?: SearchSort;
  
  /** 分页参数 */
  pagination?: SearchPagination;
  
  /** 是否启用模糊匹配 */
  fuzzy?: boolean;
  
  /** 是否高亮匹配内容 */
  highlight?: boolean;
  
  /** 模糊匹配的最大编辑距离（默认 2） */
  fuzzyDistance?: number;
}

/**
 * 搜索过滤条件
 */
interface SearchFilter {
  /** 字段名 */
  field: string;
  
  /** 操作符 */
  operator: FilterOperator;
  
  /** 比较值 */
  value: any;
}

/**
 * 过滤操作符
 */
type FilterOperator =
  | 'eq'       // 等于
  | 'ne'       // 不等于
  | 'gt'       // 大于
  | 'gte'      // 大于等于
  | 'lt'       // 小于
  | 'lte'      // 小于等于
  | 'in'       // 在列表中
  | 'nin'      // 不在列表中
  | 'contains' // 包含（字符串）
  | 'startsWith' // 以...开头
  | 'endsWith';  // 以...结尾

/**
 * 排序参数
 */
interface SearchSort {
  /** 排序字段 */
  field: string;
  
  /** 排序方向 */
  order: 'asc' | 'desc';
}

/**
 * 分页参数
 */
interface SearchPagination {
  /** 偏移量 */
  offset: number;
  
  /** 每页数量 */
  limit: number;
}
```

---

## 搜索结果

```typescript
/**
 * 搜索结果
 */
interface SearchResult {
  /** 结果列表 */
  items: SearchResultItem[];
  
  /** 总匹配数量 */
  total: number;
  
  /** 搜索耗时（毫秒） */
  took: number;
  
  /** 搜索建议（当结果较少时） */
  suggestions?: string[];
  
  /** 是否有更多结果 */
  hasMore: boolean;
}

/**
 * 搜索结果项
 */
interface SearchResultItem {
  /** 内容 ID */
  id: string;
  
  /** 内容类型 */
  type: IndexableType;
  
  /** 相关性分数（0-1） */
  score: number;
  
  /** 高亮片段（字段名 → 高亮文本数组） */
  highlights?: Record<string, string[]>;
  
  /** 原始数据 */
  data: any;
  
  /** 匹配的关键词 */
  matchedTerms?: string[];
}
```

---

## 搜索建议

```typescript
/**
 * 搜索建议选项
 */
interface SuggestOptions {
  /** 最大建议数量 */
  limit?: number;
  
  /** 限制搜索类型 */
  types?: IndexableType[];
  
  /** 是否包含热门搜索 */
  includePopular?: boolean;
  
  /** 是否包含历史搜索 */
  includeHistory?: boolean;
}

/**
 * 搜索建议项
 */
interface SuggestionItem {
  /** 建议文本 */
  text: string;
  
  /** 建议类型 */
  type: 'completion' | 'popular' | 'history' | 'correction';
  
  /** 相关内容类型 */
  contentType?: IndexableType;
  
  /** 热度/权重 */
  weight?: number;
}
```

---

## 语义搜索

```typescript
/**
 * 语义搜索选项
 */
interface SemanticSearchOptions {
  /** 返回结果数量 */
  topK: number;
  
  /** 相似度阈值（0-1） */
  threshold?: number;
  
  /** 限制搜索类型 */
  types?: IndexableType[];
  
  /** 元数据过滤 */
  filter?: Record<string, any>;
  
  /** 是否返回向量 */
  includeVector?: boolean;
}

/**
 * 向量查询选项
 */
interface VectorQueryOptions {
  /** 查询向量 */
  vector?: number[];
  
  /** 查询文本（自动向量化） */
  text?: string;
  
  /** 返回数量 */
  topK: number;
  
  /** 相似度阈值 */
  threshold?: number;
  
  /** 元数据过滤 */
  filter?: Record<string, any>;
  
  /** 是否返回元数据 */
  includeMetadata?: boolean;
  
  /** 是否返回向量 */
  includeVector?: boolean;
}

/**
 * 向量查询结果
 */
interface VectorQueryResult {
  /** 内容 ID */
  id: string;
  
  /** 相似度分数（0-1） */
  score: number;
  
  /** 元数据 */
  metadata?: Record<string, any>;
  
  /** 向量 */
  vector?: number[];
}
```

---

## 索引配置

```typescript
/**
 * 索引配置
 */
interface IndexConfig {
  /** 索引名称 */
  name: string;
  
  /** 索引类型 */
  type: IndexableType;
  
  /** 可搜索的字段 */
  searchableFields: string[];
  
  /** 可过滤的字段 */
  filterableFields?: string[];
  
  /** 可排序的字段 */
  sortableFields?: string[];
  
  /** 分词器配置 */
  tokenizer?: TokenizerConfig;
  
  /** 是否启用向量索引 */
  enableVector?: boolean;
}

/**
 * 分词器配置
 */
interface TokenizerConfig {
  /** 分词器类型 */
  type: 'simple' | 'chinese' | 'mixed';
  
  /** 最小词长 */
  minLength?: number;
  
  /** 停用词列表 */
  stopWords?: string[];
  
  /** 是否转小写 */
  lowercase?: boolean;
  
  /** 是否去除标点 */
  removePunctuation?: boolean;
}
```

---

## 索引统计

```typescript
/**
 * 索引统计信息
 */
interface IndexStats {
  /** 各类型的文档数量 */
  documentCounts: Record<IndexableType, number>;
  
  /** 总文档数 */
  totalDocuments: number;
  
  /** 索引大小（字节） */
  indexSize: number;
  
  /** 最后更新时间 */
  lastUpdated: number;
  
  /** 词汇表大小 */
  vocabularySize: number;
}
```

---

## 服务接口

```typescript
/**
 * 搜索服务接口
 */
interface ISearchService {
  // === 搜索接口 ===
  
  /**
   * 执行搜索查询
   */
  search(query: SearchQuery): Promise<SearchResult>;
  
  /**
   * 语义搜索（需要向量存储）
   */
  semanticSearch(query: string, options?: SemanticSearchOptions): Promise<SearchResult>;
  
  /**
   * 获取搜索建议
   */
  suggest(prefix: string, options?: SuggestOptions): Promise<SuggestionItem[]>;
  
  // === 索引管理 ===
  
  /**
   * 索引单个内容
   */
  index(item: Indexable): Promise<void>;
  
  /**
   * 批量索引
   */
  indexBatch(items: Indexable[]): Promise<void>;
  
  /**
   * 删除索引
   */
  remove(id: string, type: IndexableType): Promise<void>;
  
  /**
   * 重建指定类型的索引
   */
  reindex(type?: IndexableType): Promise<void>;
  
  /**
   * 清空所有索引
   */
  clear(): Promise<void>;
  
  // === 配置相关 ===
  
  /**
   * 设置分词器
   */
  setTokenizer(config: TokenizerConfig): void;
  
  /**
   * 设置向量存储（启用语义搜索）
   */
  setVectorStore(store: IVectorStore): void;
  
  /**
   * 获取索引统计信息
   */
  getStats(): Promise<IndexStats>;
}
```

---

## 向量存储接口

```typescript
/**
 * 向量存储接口
 */
interface IVectorStore {
  /**
   * 插入或更新向量
   */
  upsert(id: string, vector: number[], metadata?: Record<string, any>): Promise<void>;
  
  /**
   * 删除向量
   */
  delete(id: string): Promise<void>;
  
  /**
   * 相似度查询
   */
  query(options: VectorQueryOptions): Promise<VectorQueryResult[]>;
  
  /**
   * 批量插入
   */
  upsertBatch(items: VectorItem[]): Promise<void>;
  
  /**
   * 批量删除
   */
  deleteBatch(ids: string[]): Promise<void>;
  
  /**
   * 获取向量数量
   */
  count(): Promise<number>;
  
  /**
   * 清空向量存储
   */
  clear(): Promise<void>;
}

/**
 * 向量项
 */
interface VectorItem {
  id: string;
  vector: number[];
  metadata?: Record<string, any>;
}
```

---

## 事件类型

```typescript
/**
 * 搜索服务事件
 */
type SearchServiceEvent =
  | 'index:added'      // 索引添加
  | 'index:removed'    // 索引删除
  | 'index:updated'    // 索引更新
  | 'index:reindexed'  // 重建索引完成
  | 'search:executed'; // 搜索执行

/**
 * 索引事件数据
 */
interface IndexEventData {
  id: string;
  type: IndexableType;
  timestamp: number;
}

/**
 * 搜索执行事件数据
 */
interface SearchExecutedEventData {
  query: SearchQuery;
  resultCount: number;
  took: number;
  timestamp: number;
}
```

---

## 类型导出

```typescript
// src/types/search.ts

export type {
  // 基础类型
  IndexableType,
  Indexable,
  IndexableMetadata,
  
  // 查询类型
  SearchQuery,
  SearchFilter,
  FilterOperator,
  SearchSort,
  SearchPagination,
  
  // 结果类型
  SearchResult,
  SearchResultItem,
  
  // 建议类型
  SuggestOptions,
  SuggestionItem,
  
  // 语义搜索
  SemanticSearchOptions,
  VectorQueryOptions,
  VectorQueryResult,
  VectorItem,
  
  // 配置类型
  IndexConfig,
  TokenizerConfig,
  IndexStats,
  
  // 接口
  ISearchService,
  IVectorStore,
  
  // 事件
  SearchServiceEvent,
  IndexEventData,
  SearchExecutedEventData,
};
```
