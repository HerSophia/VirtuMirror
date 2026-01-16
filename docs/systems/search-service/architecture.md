# 搜索服务架构设计

本文档描述搜索服务（Search Service）的架构设计，包括分层结构、核心组件和数据流。

---

## 整体架构

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                              应用层 (Apps)                                   │
│   微博搜索 │ B站搜索 │ 知乎搜索 │ 档案搜索 │ 聊天搜索 │ 全局搜索            │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SearchService (搜索服务)                           │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                          SearchQueryProcessor                            │ │
│  │                          (查询处理器)                                    │ │
│  │   解析查询 → 分词 → 选择策略 → 执行搜索 → 合并结果 → 排序/高亮           │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                     │                                        │
│         ┌───────────────────────────┼───────────────────────────┐            │
│         ▼                           ▼                           ▼            │
│  ┌─────────────────┐    ┌─────────────────────┐    ┌────────────────────┐   │
│  │ SearchIndex     │    │ SuggestionEngine    │    │ VectorStore        │   │
│  │ (倒排索引)       │    │ (建议引擎)           │    │ (向量存储)          │   │
│  │                 │    │                     │    │ [可选]             │   │
│  │ - 分词器        │    │ - 前缀树            │    │ - 向量化           │   │
│  │ - 倒排表        │    │ - 热门词            │    │ - 相似度计算       │   │
│  │ - 正排表        │    │ - 历史记录          │    │ - HNSW 索引        │   │
│  └─────────────────┘    └─────────────────────┘    └────────────────────┘   │
│                                     │                                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          存储层 (IndexedDB)                                  │
│   search_index │ search_vocabulary │ search_suggestions │ search_vectors   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 核心组件

### 1. SearchService（搜索服务主类）

搜索服务的入口，提供统一的搜索 API。

```typescript
class SearchService {
  private queryProcessor: SearchQueryProcessor;
  private searchIndex: SearchIndex;
  private suggestionEngine: SuggestionEngine;
  private vectorStore?: IVectorStore;
  
  // 搜索
  async search(query: SearchQuery): Promise<SearchResult>;
  
  // 语义搜索
  async semanticSearch(text: string, options?: SemanticSearchOptions): Promise<SearchResult>;
  
  // 搜索建议
  async suggest(prefix: string, options?: SuggestOptions): Promise<SuggestionItem[]>;
  
  // 索引管理
  async index(item: Indexable): Promise<void>;
  async indexBatch(items: Indexable[]): Promise<void>;
  async remove(id: string, type: IndexableType): Promise<void>;
  async reindex(type?: IndexableType): Promise<void>;
}
```

### 2. SearchQueryProcessor（查询处理器）

负责查询的解析、策略选择和结果处理。

```typescript
class SearchQueryProcessor {
  private tokenizer: Tokenizer;
  private strategies: Map<string, SearchStrategy>;
  
  // 处理搜索查询
  async process(query: SearchQuery): Promise<SearchResult> {
    // 1. 分词
    const tokens = this.tokenizer.tokenize(query.text);
    
    // 2. 选择搜索策略
    const strategy = this.selectStrategy(query);
    
    // 3. 执行搜索
    const rawResults = await strategy.execute(tokens, query);
    
    // 4. 过滤
    const filtered = this.applyFilters(rawResults, query.filters);
    
    // 5. 排序
    const sorted = this.applySort(filtered, query.sort);
    
    // 6. 分页
    const paginated = this.applyPagination(sorted, query.pagination);
    
    // 7. 高亮（可选）
    const highlighted = query.highlight
      ? this.applyHighlight(paginated, tokens)
      : paginated;
    
    return {
      items: highlighted,
      total: filtered.length,
      took: performance.now() - startTime,
      hasMore: filtered.length > paginated.length,
    };
  }
  
  // 选择搜索策略
  private selectStrategy(query: SearchQuery): SearchStrategy {
    if (query.fuzzy) return this.strategies.get('fuzzy');
    if (query.semantic) return this.strategies.get('semantic');
    return this.strategies.get('fulltext');
  }
}
```

### 3. SearchIndex（搜索索引）

基于倒排索引的全文搜索实现。

```typescript
class SearchIndex {
  private invertedIndex: Map<string, Set<string>>;  // 词 → 文档ID集合
  private forwardIndex: Map<string, IndexedDocument>; // 文档ID → 文档内容
  private vocabulary: Set<string>;  // 词汇表
  private tokenizer: Tokenizer;
  
  // 添加文档到索引
  async add(item: Indexable): Promise<void> {
    const tokens = this.tokenizer.tokenize(item.content);
    
    // 更新倒排索引
    for (const token of tokens) {
      if (!this.invertedIndex.has(token)) {
        this.invertedIndex.set(token, new Set());
      }
      this.invertedIndex.get(token)!.add(item.id);
      this.vocabulary.add(token);
    }
    
    // 更新正排索引
    this.forwardIndex.set(item.id, {
      id: item.id,
      type: item.type,
      content: item.content,
      tokens,
      metadata: item.metadata,
    });
  }
  
  // 搜索
  async search(tokens: string[]): Promise<SearchResultItem[]> {
    // 获取每个词对应的文档集合
    const docSets = tokens.map(token => 
      this.invertedIndex.get(token) || new Set()
    );
    
    // 计算交集（AND 逻辑）
    const matchedIds = this.intersect(docSets);
    
    // 计算相关性分数
    return Array.from(matchedIds).map(id => {
      const doc = this.forwardIndex.get(id)!;
      const score = this.calculateScore(tokens, doc);
      return { id, type: doc.type, score, data: doc };
    });
  }
  
  // TF-IDF 分数计算
  private calculateScore(queryTokens: string[], doc: IndexedDocument): number {
    let score = 0;
 const totalDocs = this.forwardIndex.size;
    
    for (const token of queryTokens) {
      // TF: 词在文档中出现的频率
      const tf = doc.tokens.filter(t => t === token).length / doc.tokens.length;
      
      // IDF: 逆文档频率
      const docsWithToken = this.invertedIndex.get(token)?.size || 1;
      const idf = Math.log(totalDocs / docsWithToken);
      
      score += tf * idf;
    }
    
    return score;
  }
}
```

### 4. Tokenizer（分词器）

支持中英文混合分词。

```typescript
class Tokenizer {
  private config: TokenizerConfig;
  private stopWords: Set<string>;
  
  constructor(config: TokenizerConfig = {}) {
    this.config = {
      type: 'mixed',
      minLength: 1,
      lowercase: true,
      removePunctuation: true,
      ...config,
    };
    this.stopWords = new Set(config.stopWords || DEFAULT_STOP_WORDS);
  }
  
  tokenize(text: string): string[] {
    let processed = text;
    
    // 转小写
    if (this.config.lowercase) {
      processed = processed.toLowerCase();
    }
    
    // 移除标点
    if (this.config.removePunctuation) {
      processed = processed.replace(/[\p{P}\p{S}]/gu, ' ');
    }
    
    // 分词
    const tokens = this.splitTokens(processed);
    
    // 过滤
    return tokens.filter(token => 
      token.length >= this.config.minLength! &&
      !this.stopWords.has(token)
    );
  }
  
  private splitTokens(text: string): string[] {
    switch (this.config.type) {
      case 'simple':
        // 简单空格分词
        return text.split(/\s+/).filter(Boolean);
        
      case 'chinese':
        // 中文单字分词 + 二元分词
        return this.chineseTokenize(text);
        
      case 'mixed':
      default:
        // 混合分词：英文按空格，中文按字符
        return this.mixedTokenize(text);
    }
  }
  
  private mixedTokenize(text: string): string[] {
    const tokens: string[] = chinesePattern = /[\u4e00-\u9fa5]+/g;
    const englishPattern = /[a-zA-Z0-9]+/g;
    
    // 提取中文词
    let match;
    while ((match = chinesePattern.exec(text)) !== null) {
      // 中文单字
      tokens.push(...match[0].split(''));
      // 中文二元组合
      for (let i = 0; i < match[0].length - 1; i++) {
        tokens.push(match[0].substring(i, i + 2));
      }
    }
    
    // 提取英文词
    while ((match = englishPattern.exec(text)) !== null) {
      tokens.push(match[0]);
    }
    
    return tokens;
  }
}
```

### 5. SuggestionEngine（建议引擎）

提供搜索建议和自动补全。

```typescript
class SuggestionEngine {
  private prefixTree: PrefixTree;    // 前缀树（用于补全）
  private popularTerms: Map<string, number>;  // 热门搜索词
  private userHistory: Map<string, string[]>; // 用户搜索历史
  
  // 获取搜索建议
  async suggest(prefix: string, options: SuggestOptions = {}): Promise<SuggestionItem[]> {
    const suggestions: SuggestionItem[] = [];
    const limit = options.limit || 10;
    
    // 1. 前缀补全
    const completions = this.prefixTree.search(prefix, 5);
    suggestions.push(...completions.map(text => ({
      text,
      type: 'completion' as const,
      weight: 1,
    })));
    
    // 2. 热门搜索（可选）
    if (options.includePopular) {
      const popular = this.getPopularMatching(prefix, 3);
      suggestions.push(...popular.map(([text, count]) => ({
        text,
        type: 'popular' as const,
        weight: count,
      })));
    }
    
    // 3. 历史搜索（可选）
    if (options.includeHistory) {
      const history = this.getUserHistoryMatching(prefix, 3);
      suggestions.push(...history.map(text => ({
        text,
        type: 'history' as const,
        weight: 0.5,
      })));
    }
    
    // 去重、排序、截断
    return this.dedupeAndSort(suggestions).slice(0, limit);
  }
  
  // 更新词汇表（索引新内容时调用）
  updateVocabulary(tokens: string[]): void {
    for (const token of tokens) {
      this.prefixTree.insert(token);
    }
  }
  
  // 记录搜索（用于热门和历史）
  recordSearch(userId: string, query: string): void {
    // 更新热门
    this.popularTerms.set(query, (this.popularTerms.get(query) || 0) + 1);
    
    // 更新用户历史
    if (!this.userHistory.has(userId)) {
      this.userHistory.set(userId, []);
    }
    const history = this.userHistory.get(userId)!;
    history.unshift(query);
    if (history.length > 50) history.pop();
  }
}
```

### 6. FuzzyMatcher（模糊匹配器）

基于编辑距离的模糊搜索。

```typescript
class FuzzyMatcher {
  // 计算编辑距离（Levenshtein Distance）
  editDistance(s1: string, s2: string): number {
    const m = s1.length, n = s2.length;
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
    
    for (let i = 0; i <= m; i++) dp[i][0] = i;
     0; j <= n; j++) dp[0][j] = j;
    
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (s1[i - 1] === s2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
      }
    }
    
    return dp[m][n];
  }
  
  // 模糊匹配
  fuzzyMatch(
    query: string,
    candidates: string[],
    maxDistance: number = 2
  ): { term: string; distance: number }[] {
    const results: { term: string; distance: number }[] = [];
    
    for (const candidate of candidates) {
      const distance = this.editDistance(query, candidate);
      if (distance <= maxDistance) {
        results.push({ term: candidate, distance });
      }
    }
    
    // 按编辑距离排序
    return results.sort((a, b) => a.distance - b.distance);
  }
  
  // 拼写纠错建议
  suggest(query: string, vocabulary: Set<string>): string[] {
    const matches = this.fuzzyMatch(query, Array.from(vocabulary), 2);
    return matches.slice(0, 5).map(m => m.term);
  }
}
```

---

## 搜索策略

搜索服务支持四层搜索策略，按复杂度递增：

### L1: 精确匹配策略

```typescript
class ExactMatchStrategy implements SearchStrategy {
  async execute(query: SearchQuery): Promise<SearchResultItem[]> {
    // 直接查询 IndexedDB 索引
    const results = await db.searchIndex
      .where('id').equals(query.text)
      .or('metadata.username').equals(query.text)
      .toArray();
    
    return results.map(doc => ({
      id: doc.id,
      type: doc.type,
      score: 1.0,  // 精确匹配分数为 1
      data: doc,
    }));
  }
}
```

### L2: 全文搜索策略

```typescript
class FullTextStrategy implements SearchStrategy {
  private searchIndex: SearchIndex;
  
  async execute(tokens: string[], query: SearchQuery): Promise<SearchResultItem[]> {
    // 使用倒排索引搜索
    return this.searchIndex.search(tokens);
  }
}
```

### L3: 模糊搜索策略

```typescript
class FuzzySearchStrategy implements SearchStrategy {
  private searchIndex: SearchIndex;
  private fuzzyMatcher: FuzzyMatcher;
  
  async execute(tokens: string[], query: SearchQuery): Promise<SearchResultItem[]> {
    // 1. 对每个词进行模糊扩展
    const expandedTokens: string[] = [];
    for (const token of tokens) {
      const fuzzyMatches = this.fuzzyMatcher.suggest(
        token,
        this.searchIndex.vocabulary
      );
      expandedTokens.push(token, ...fuzzyMatches);
    }
    
    // 2. 使用扩展后的词搜索
    return this.searchIndex.search(expandedTokens);
  }
}
```

### L4: 语义搜索策略

```typescript
class SemanticSearchStrategy implements SearchStrategy {
  private vectorStore: IVectorStore;
  private embedder: TextEmbedder;
  
  async execute(query: SearchQuery): Promise<SearchResultItem[]> {
    // 1. 将查询文本向量化
    const queryVector = await this.embedder.embed(query.text);
    
    // 2. 在向量存储中进行相似度搜索
    const results = await this.vectorStore.query({
      vector: queryVector,
      topK: query.pagination?.limit || 20,
      threshold: 0.7,
    });
    
    // 3. 转换为搜索结果
    return results.map(r => ({
      id: r.id,
      type: r.metadata?.type,
      score: r.score,
      data: r.metadata,
    }));
  }
}
```

---

## 数据流

### 索引流程

```text
新内容发布
    │
    ▼
┌─────────────────┐
│ searchService   │
│ .index(item)    │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌────────┐
│分词    │ │向量化  │
│Tokenize│ │Embed   │
└───┬────┘ └───┬────┘
    │          │
    ▼          ▼
┌────────┐ ┌────────┐
│倒排索引│ │向量存储│
│更新    │ │更新    │
└───┬────┘ └───┬────┘
    │          │
    └────┬─────┘
         ▼
┌─────────────────┐
│ IndexedDB 持久化 │
└─────────────────┘
```

### 搜索流程

```text
用户输入搜索词
    │
    ▼
┌─────────────────┐
│ searchService   │
│ .search(query)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ QueryProcessor  │
│ 解析 & 分词      │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌────────┐
│全文搜索│ │语义搜索│
│L1-L3   │ │L4      │
└───┬────┘ └───┬────┘
    │          │
    └────┬─────┘
         ▼
┌─────────────────┐
│ 结果合并 & 排序  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 过滤 & 分页      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 高亮处理        │
└────────┬────────┘
         │
         ▼
    SearchResult
```

---

## 数据库表结构

```typescript
// IndexedDB Schema
const searchSchema = {
  // 搜索索引表
  search_index: {
    keyPath: 'id',
    indexes: [
      { name: 'type', keyPath: 'type' },
      { name: 'timestamp', keyPath: 'metadata.timestamp' },
      { name: 'platformId', keyPath: 'metadata.platformId' },
      { name: 'authorId', keyPath: 'metadata.authorId' },
    ],
  },
  
  // 倒排索引表
  search_inverted: {
    keyPath: 'term',
    // value: { term: string, docIds: string[] }
  },
  
  // 词汇表
  search_vocabulary: {
    keyPath: 'term',
    indexes: [
      { name: 'frequency', keyPath: 'frequency' },
    ],
  },
  
  // 搜索建议
  search_suggestions: {
    keyPath: 'term',
    indexes: [
      { name: 'popularity', keyPath: 'popularity' },
      { name: 'lastUsed', keyPath: 'lastUsed' },
    ],
  },
  
  // 向量存储（可选）
  search_vectors: {
    keyPath: 'id',
    // value: { id: string, vector: number[], metadata: any }
  },
};
```

---

## 性能优化

### 1. 索引优化

```typescript
// 批量索引时使用事务
async indexBatch(items: Indexable[]): Promise<void> {
  await db.transaction('rw', [db.search_index, db.search_inverted], async () => {
    for (const item of items) {
      await this.indexSingle(item);
    }
  });
}

// 增量索引而非全量重建
async updateIndex(item: Indexable): Promise<void> {
  const existing = await db.search_index.get(item.id);
  if (existing) {
    await this.removeFromInvertedIndex(existing);
  }
  await this.addToIndex(item);
}
```

### 2. 搜索优化

```typescript
// 结果缓存
class SearchCache {
  private cache = new LRUCache<string, SearchResult>(100);
  
  getCacheKey(query: SearchQuery): string {
    return JSON.stringify(query);
  }
  
  get(query: SearchQuery): SearchResult | undefined {
    return this.cache.get(this.getCacheKey(query));
  }
  
  set(query: SearchQuery, result: SearchResult): void {
    this.cache.set(this.getCacheKey(query), result);
  }
}

// 搜索时先查缓存
async search(query: SearchQuery): Promise<SearchResult> {
  const cached = this.cache.get(query);
  if (cached) return cached;
  
  const result = await this.doSearch(query);
  this.cache.set(query, result);
  return result;
}
```

### 3. 分词优化

```typescript
// 分词结果缓存
class TokenCache {
  private cache = new Map<string, string[]>();
  
  tokenize(text: string): string[] {
    if (this.cache.has(text)) {
      return this.cache.get(text)!;
    }
    
    const tokens = this.doTokenize(text);
    this.cache.set(text, tokens);
    return tokens;
  }
}
```

---

## 扩展点

### 自定义分词器

```typescript
// 注册自定义分词器
searchService.setTokenizer({
  type: 'custom',
  tokenize: (text: string) => {
    // 自定义分词逻辑
    return myCustomTokenizer(text);
  },
});
```

### 自定义向量化

```typescript
// 使用外部 Embedding API
searchService.setVectorStore({
  embedder: {
    provider: 'openai',
    model: 'text-embedding-3-small',
  },
  storage: new IndexedDBVectorStore(),
});
```

### 自定义排序

```typescript
// 注册自定义排序函数
searchService.registerSortFunction('popularity', (a, b) => {
  return (b.data.likes + b.data.comments) - (a.data.likes + a.data.comments);
});

// 使用
await searchService.search({
  text: '科技',
  sort: { field: 'popularity', order: 'desc' },
});
```
