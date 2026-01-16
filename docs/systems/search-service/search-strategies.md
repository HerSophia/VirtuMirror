# 搜索策略详解

本文档详细介绍搜索服务的四层搜索策略，帮助开发者理解不同策略的适用场景和实现原理。

---

## 策略概览

搜索服务采用分层策略设计，按复杂度和功能递增：

```text
┌─────────────────────────────────────────────────────────────┐
│                    搜索策略分层                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  L4  ┌─────────────────────────────────────────────────┐    │
│      │ 语义搜索 (Semantic Search)                       │    │
│      │ • 向量化 + 相似度计算                            │    │
│      │ • 理解查询意图                                   │    │
│      │ • 需要 Embedding 模型                           │    │
│      └─────────────────────────────────────────────────┘    │
│                           ▲                                  │
│  L3  ┌─────────────────────────────────────────────────┐    │
│      │ 模糊搜索 (Fuzzy Search)                          │    │
│      │ • 编辑距离算法                                   │    │
│      │ • 拼写纠错、近似匹配                             │    │
│      │ • 容错性强                                      │    │
│      └─────────────────────────────────────────────────┘    │
│                           ▲                                  │
│  L2  ┌─────────────────────────────────────────────────┐    │
│      │ 全文搜索 (Full-Text Search)                      │    │
│      │ • 分词 + 倒排索引                                │    │
│      │ • TF-IDF 相关性计算                              │    │
│      │ • 支持中英文混合                                 │    │
│      └─────────────────────────────────────────────────┘    │
│                           ▲                                  │
│  L1  ┌─────────────────────────────────────────────────┐    │
│      │ 精确匹配 (Exact Match)                           │    │
│      │ • IndexedDB 索引查询                             │    │
│      │ • ID、用户名等精确字段                           │    │
│      │ • 速度最快                                      │    │
│      └─────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

| 层级 | 策略       | 实现方式           | 适用场景         | 性能   |
| ---- | ---------- | ------------------ | ---------------- | ------ |
| L1   | 精确匹配   | IndexedDB 索引     | ID/用户名查找    | ⚡ 极快 |
| L2   | 全文搜索   | 分词 + 倒排索引    | 内容搜索         | 🚀 快   |
| L3   | 模糊搜索   | 编辑距离算法       | 纠错、近似匹配   | 🏃 中等 |
| L4   | 语义搜索   | 向量化 + 相似度    | 智能推荐         | 🐢 较慢 |

---

## L1: 精确匹配策略

### 原理

精确匹配是最基础的搜索策略，直接利用 IndexedDB 的索引进行精确查询。

```typescript
class ExactMatchStrategy implements SearchStrategy {
  name = 'exact';
  
  async execute(query: SearchQuery): Promise<SearchResultItem[]> {
    const results: SearchResultItem[] = [];
    const searchText = query.text.trim();
    
    // 1. 按 ID 精确匹配
    const byId = await db.search_index.get(searchText);
    if (byId) {
      results.push({
        id: byId.id,
        type: byId.type,
        score: 1.0,
        data: byId,
      });
    }
    
    // 2. 按用户名精确匹配
    if (query.type === 'account' || !query.type) {
      const byUsername = await db.search_index
        .where('metadata.username')
        .equals(searchText)
        .toArray();
      
      results.push(...byUsername.map(doc => ({
        id: doc.id,
        type: doc.type,
        score: 1.0,
        data: doc,
      })));
    }
    
    return this.dedupe(results);
  }
}
```

### 适用场景

- 用户 ID 查找：`@user_123`
- 帖子 ID 查找：`post_456`
- 用户名搜索：搜索 `小明` 精确匹配用户名为「小明」的账号
- 话题标签：`#苹果发布会#`

### 优缺点

| 优点              | 缺点                    |
| ----------------- | ----------------------- |
| ⚡ 速度极快        | ❌ 必须完全匹配          |
| 📦 无额外依赖      | ❌ 不支持模糊             |
| 💯 结果精确        | ❌ 无法处理拼写错误       |

---

## L2: 全文搜索策略

### 原理

全文搜索使用倒排索引（Inverted Index）实现，核心步骤：

1. **分词**：将文本拆分为词条（tokens）
2. **建立索引**：维护 `词 → 文档ID列表` 的映射
3. **查询**：对搜索词分词后，查找包含这些词的文档
4. **排序**：使用 TF-IDF 等算法计算相关性分数

```typescript
class FullTextStrategy implements SearchStrategy {
  name = 'fulltext';
  
  private tokenizer: Tokenizer;
  private invertedIndex: Map<string, Set<string>>;
  private forwardIndex: Map<string, IndexedDocument>;
  
  async execute(query: SearchQuery): Promise<SearchResultItem[]> {
    // 1. 对搜索词分词
    const queryTokens = this.tokenizer.tokenize(query.text);
    
    if (queryTokens.length === 0) {
      return [];
    }
    
    // 2. 获取每个词对应的文档集合
    const docSets = queryTokens.map(token => 
      this.invertedIndex.get(token) || new Set<string>()
    );
    
    // 3. 计算交集（AND 逻辑）或并集（OR 逻辑）
    const matchedIds = this.intersectSets(docSets);
    
    // 4. 计算相关性分数并排序
    const results = Array.from(matchedIds).map(id => {
      const doc = this.forwardIndex.get(id)!;
      const score = this.calculateTfIdf(queryTokens, doc);
      
      return {
        id,
        type: doc.type,
        score,
        data: doc,
        matchedTerms: queryTokens.filter(t => doc.tokens.includes(t)),
      };
    });
    
    // 5. 按分数排序
    return results.sort((a, b) => b.score - a.score);
  }
  
  // TF-IDF 计算
  private calculateTfIdf(queryTokens: string[], doc: IndexedDocument): number {
    let score = 0;
    const totalDocs = this.forwardIndex.size;
    
    for (const token of queryTokens) {
      // TF (Term Frequency): 词在文档中的出现频率
      const termCount = doc.tokens.filter(t => t === token).length;
      const tf = termCount / doc.tokens.length;
      
      // IDF (Inverse Document Frequency): 逆文档频率
      const docsWithTerm = this.invertedIndex.get(token)?.size || 1;
      const idf = Math.log((totalDocs + 1) / (docsWithTerm + 1)) + 1;
      
      score += tf * idf;
    }
    
    // 归一化
    return score / queryTokens.length;
  }
  
  // 集合交集
  private intersectSets(sets: Set<string>[]): Set<string> {
    if (sets.length === 0) return new Set();
    if (sets.length === 1) return sets[0];
    
    // 从最小集合开始，提高效率
    const sorted = [...sets].sort((a, b) => a.size - b.size);
    let result = new Set(sorted[0]);
    
    for (let i = 1; i < sorted.length; i++) {
      result = new Set([...result].filter(x => sorted[i].has(x)));
    }
    
    return result;
  }
}
```

### 分词器

分词是全文搜索的关键，需要支持中英文混合：

```typescript
class MixedTokenizer implements Tokenizer {
  tokenize(text: string): string[] {
    const tokens: string[] = [];
    
    // 预处理：转小写、去标点
    const processed = text.toLowerCase().replace(/[\p{P}\p{S}]/gu, ' ');
    
    // 匹配中文字符
    const chineseMatches = processed.match(/[\u4e00-\u9fa5]+/g) || [];
    for (const match of chineseMatches) {
      // 单字分词
      tokens.push(...match.split(''));
      // 二元分词（提高短语匹配）
      for (let i = 0; i < match.length - 1; i++) {
        tokens.push(match.substring(i, i + 2));
      }
    }
    
    // 匹配英文/数字
    const englishMatches = processed.match(/[a-z0-9]+/g) || [];
    tokens.push(...englishMatches);
    
    // 去除停用词
    return tokens.filter(t => !STOP_WORDS.has(t) && t.length > 0);
  }
}

// 常用停用词
const STOP_WORDS = new Set([
  '的', '了', '是', '在', '和', '有', '我', '你', '他',
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be',
]);
```

### 适用场景

- 帖子内容搜索：「苹果发布会」
- 用户简介搜索：「科技博主」
- 话题描述搜索：「游戏评测」

### 优缺点

| 优点               | 缺点                     |
| ------------------ | ------------------------ |
| 🔍 支持关键词匹配   | ❌ 不理解同义词           |
| 📊 相关性排序       | ❌ 需要精确的词匹配        |
| 🚀 性能好           | ❌ 对拼写错误敏感          |

---

## L3: 模糊搜索策略

### 原理

模糊搜索基于编辑距离（Levenshtein Distance）算法，允许一定程度的字符差异：

- **插入**：添加一个字符
- **删除**：删除一个字符
- **替换**：将一个字符替换为另一个

例如：「苹果发布回」与「苹果发布会」的编辑距离为 1（替换「回」→「会」）

```typescript
class FuzzySearchStrategy implements SearchStrategy {
  name = 'fuzzy';
  
  private fullTextStrategy: FullTextStrategy;
  private fuzzyMatcher: FuzzyMatcher;
  private vocabulary: Set<string>;
  
  async execute(query: SearchQuery): Promise<SearchResultItem[]> {
    const queryTokens = this.tokenizer.tokenize(query.text);
    const maxDistance = query.fuzzyDistance || 2;
    
    // 1. 扩展查询词（添加模糊匹配的变体）
    const expandedTokens: Map<string, number> = new Map();
    
    for (const token of queryTokens) {
      // 原始词权重为 1
      expandedTokens.set(token, 1.0);
      
      // 查找模糊匹配的词
      const fuzzyMatches = this.fuzzyMatcher.findSimilar(
        token,
        this.vocabulary,
        maxDistance
      );
      
      for (const { term, distance } of fuzzyMatches) {
        // 距离越大，权重越低
        const weight = 1 / (1 + distance);
        const existing = expandedTokens.get(term) || 0;
        expandedTokens.set(term, Math.max(existing, weight));
      }
    }
    
    // 2. 使用扩展后的词进行搜索
    const results = await this.fullTextStrategy.execute({
      ...query,
      text: Array.from(expandedTokens.keys()).join(' '),
    });
    
    // 3. 调整分数（考虑模糊匹配的权重损失）
    return results.map(item => ({
      ...item,
      score: item.score * this.calculateFuzzyWeight(item.matchedTerms, expandedTokens),
    }));
  }
}

class FuzzyMatcher {
  // 计算编辑距离
  editDistance(s1: string, s2: string): number {
    const m = s1.length, n = s2.length;
    
    // 使用滚动数组优化空间
    let prev = Array.from({ length: n + 1 }, (_, i) => i);
    let curr = new Array(n + 1);
    
    for (let i = 1; i <= m; i++) {
      curr[0] = i;
      for (let j = 1; j <= n; j++) {
        if (s1[i - 1] === s2[j - 1]) {
          curr[j] = prev[j - 1];
        } else {
          curr[j] = 1 + Math.min(prev[j], curr[j - 1], prev[j - 1]);
        }
      }
      [prev, curr] = [curr, prev];
    }
    
    return prev[n];
  }
  
  // 查找相似词
  findSimilar(
    query: string,
    vocabulary: Set<string>,
    maxDistance: number
  ): { term: string; distance: number }[] {
    const results: { term: string; distance: number }[] = [];
    
    // 优化：只检查长度相近的词
    const minLen = Math.max(1, query.length - maxDistance);
    const maxLen = query.length + maxDistance;
    
    for (const term of vocabulary) {
      if (term.length < minLen || term.length > maxLen) continue;
      if (term === query) continue;  // 跳过完全相同的
      
      const distance = this.editDistance(query, term);
      if (distance <= maxDistance) {
        results.push({ term, distance });
      }
    }
    
    return results.sort((a, b) => a.distance - b.distance);
  }
}
```

### 拼写纠错

模糊搜索可以提供拼写建议：

```typescript
async function searchWithCorrection(query: string): Promise<SearchResult> {
  // 1. 先尝试精确搜索
  const exactResults = await searchService.search({
    text: query,
    fuzzy: false,
  });
  
  if (exactResults.total > 0) {
    return exactResults;
  }
  
  // 2. 没有结果时，尝试模糊搜索
  const fuzzyResults = await searchService.search({
    text: query,
    fuzzy: true,
  });
  
  // 3. 添加「您是不是要找」建议
  if (fuzzyResults.total > 0) {
    fuzzyResults.suggestions = [
      `您是不是要找：${fuzzyResults.items[0].matchedTerms?.join(' ')}`,
    ];
  }
  
  return fuzzyResults;
}
```

### 适用场景

- 拼写错误容错：「苹果发布回」→「苹果发布会」
- 输入法误触：「科技博足」→「科技博主」
- 同音字错误：「科计」→「科技」

### 优缺点

| 优点              | 缺点                     |
| ----------------- | ------------------------ |
| 🔧 容错性强        | 🐢 性能较低               |
| 📝 支持拼写纠错    | 🎯 可能匹配不相关内容      |
| 👥 用户体验好      | 💾 需要维护词汇表          |

---

## L4: 语义搜索策略

### 原理

语义搜索通过向量化技术理解文本含义，而不仅仅是关键词匹配：

1. **文本向量化**：使用 Embedding 模型将文本转换为高维向量
2. **相似度计算**：计算查询向量与文档向量的余弦相似度
3. **近似检索**：使用 HNSW 等算法加速向量检索

```typescript
class SemanticSearchStrategy implements SearchStrategy {
  name = 'semantic';
  
  private embedder: TextEmbedder;
  private vectorStore: IVectorStore;
  
  async execute(query: SearchQuery): Promise<SearchResultItem[]> {
    // 1. 将查询文本向量化
    const queryVector = await this.embedder.embed(query.text);
    
    // 2. 在向量存储中进行相似度搜索
    const vectorResults = await this.vectorStore.query({
      vector: queryVector,
      topK: query.pagination?.limit || 20,
      threshold: 0.6,  // 相似度阈值
      filter: this.buildMetadataFilter(query),
    });
    
    // 3. 转换为搜索结果
    return vectorResults.map(r => ({
      id: r.id,
      type: r.metadata?.type as IndexableType,
      score: r.score,
      data: r.metadata,
    }));
  }
  
  private buildMetadataFilter(query: SearchQuery): Record<string, any> | undefined {
    if (!query.filters || query.filters.length === 0) {
      return undefined;
    }
    
    const filter: Record<string, any> = {};
    for (const f of query.filters) {
      if (f.operator === 'eq') {
        filter[f.field] = f.value;
      }
    }
    return filter;
  }
}
```

### 向量化实现

```typescript
interface TextEmbedder {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}

// 本地 Embedding（使用 Transformers.js）
class LocalEmbedder implements TextEmbedder {
  private model: any;
  
  async init() {
    const { pipeline } = await import('@xenova/transformers');
    this.model = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  
  async embed(text: string): Promise<number[]> {
    const output = await this.model(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  }
  
  async embedBatch(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map(t => this.embed(t)));
  }
}

// 远程 Embedding（使用 OpenAI API）
class OpenAIEmbedder implements TextEmbedder {
  private apiKey: string;
  
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }
  
  async embed(text: string): Promise<number[]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text,
      }),
    });
    
    const data = await response.json();
    return data.data[0].embedding;
  }
}
```

### 向量存储

```typescript
// 基于 IndexedDB 的简单向量存储
class IndexedDBVectorStore implements IVectorStore {
  private db: IDBDatabase;
  
  async query(options: VectorQueryOptions): Promise<VectorQueryResult[]> {
    const allVectors = await this.getAllVectors();
    
    // 计算余弦相似度
    const results = allVectors
      .map(item => ({
        ...item,
        score: this.cosineSimilarity(options.vector!, item.vector),
      }))
      .filter(item => item.score >= (options.threshold || 0))
      .sort((a, b) => b.score - a.score)
      .slice(0, options.topK);
    
    return results;
  }
  
  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}
```

### 适用场景

- 语义相关搜索：「角色之间的冲突」→ 找到描述角色矛盾的档案
- 同义词理解：「手机」≈「智能手机」≈「移动设备」
- 概念搜索：「科技巨头」→ 匹配苹果、谷歌、微软相关内容

### 优缺点

| 优点                | 缺点                     |
| ------------------- | ------------------------ |
| 🧠 理解语义          | 🐢 性能较慢               |
| 🔗 支持同义词        | 💾 需要向量存储           |
| 🎯 查询意图理解      | 🔌 需要 Embedding 模型    |
| 🌐 跨语言支持        | 💰 远程 API 有成本        |

---

## 策略选择

### 自动策略选择

搜索服务可以根据查询自动选择最合适的策略：

```typescript
class StrategySelector {
  selectStrategy(query: SearchQuery): SearchStrategy {
    // 1. 用户明确指定
    if (query.semantic) return this.semanticStrategy;
    if (query.fuzzy) return this.fuzzyStrategy;
    
    // 2. 根据查询特征自动选择
    const text = query.text.trim();
    
    // 看起来像 ID
    if (text.match(/^[a-z]+_[a-z0-9]+$/i)) {
      return this.exactMatchStrategy;
    }
    
    // 看起来像 @用户名
    if (text.startsWith('@')) {
      return this.exactMatchStrategy;
    }
    
    // 较长的自然语言查询，可能需要语义搜索
    if (text.length > 20 && this.semanticStrategy.isAvailable()) {
      return this.semanticStrategy;
    }
    
    // 默认使用全文搜索
    return this.fullTextStrategy;
  }
}
```

### 混合策略

最佳实践是组合多种策略：

```typescript
class HybridSearchStrategy implements SearchStrategy {
  name = 'hybrid';
  
  async execute(query: SearchQuery): Promise<SearchResultItem[]> {
    const results: Map<string, SearchResultItem> = new Map();
    
    // 1. 先做精确匹配
    const exactResults = await this.exactMatchStrategy.execute(query);
    for (const item of exactResults) {
      results.set(item.id, { ...item, score: item.score * 1.5 });  // 精确匹配加权
    }
    
    // 2. 全文搜索
    const fulltextResults = await this.fullTextStrategy.execute(query);
    for (const item of fulltextResults) {
      const existing = results.get(item.id);
      if (existing) {
        existing.score += item.score;
      } else {
        results.set(item.id, item);
      }
    }
    
    // 3. 如果结果不足，补充语义搜索
    if (results.size < 10 && this.semanticStrategy.isAvailable()) {
      const semanticResults = await this.semanticStrategy.execute(query);
      for (const item of semanticResults) {
        if (!results.has(item.id)) {
          results.set(item.id, { ...item, score: item.score * 0.8 });  // 语义结果降权
        }
      }
    }
    
    // 4. 排序返回
    return Array.from(results.values())
      .sort((a, b) => b.score - a.score);
  }
}
```

---

## 性能对比

| 策略     | 索引内容 1000 条 | 索引内容 10000 条 | 索引内容 100000 条 |
| -------- | ---------------- | ----------------- | ------------------ |
| 精确匹配 | < 1ms            | < 1ms             | < 5ms              |
| 全文搜索 | < 10ms           | < 50ms            | < 200ms            |
| 模糊搜索 | < 50ms           | < 200ms           | < 1000ms           |
| 语义搜索 | < 100ms          | < 300ms           | < 500ms            |

> 注：语义搜索使用 HNSW 索引时，大数据量下性能反而更好

---

## 最佳实践

### 1. 渐进降级

```typescript
async function searchWithFallback(query: string): Promise<SearchResult> {
  // 尝试精确匹配
  let result = await searchService.search({ text: query });
  if (result.total > 0) return result;
  
  // 尝试模糊搜索
  result = await searchService.search({ text: query, fuzzy: true });
  if (result.total > 0) return result;
  
  // 尝试语义搜索
  result = await searchService.semanticSearch(query);
  return result;
}
```

### 2. 缓存策略结果

```typescript
const strategyCache = new LRUCache<string, SearchResult>(100);

async function cachedSearch(query: SearchQuery): Promise<SearchResult> {
  const key = `${query.text}:${query.type}:${query.fuzzy}`;
  
  if (strategyCache.has(key)) {
    return strategyCache.get(key)!;
  }
  
  const result = await searchService.search(query);
  strategyCache.set(key, result);
  return result;
}
```

### 3. 异步预热

```typescript
// 应用启动时预热常用搜索
async function warmupSearch() {
  const popularQueries = ['热门', '推荐', '最新'];
  
  for (const query of popularQueries) {
    await searchService.search({ text: query });
  }
}
```
