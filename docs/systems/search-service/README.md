# 搜索服务 (Search Service)

> **状态**: 📋 设计完成，待实现  
> **版本**: v1.0  
> **优先级**: 🟡 中  
> **最后更新**: 2026-01-16

## 概述

搜索服务（Search Service）是系统级的内容搜索能力中心。它为所有 App 提供统一的全文搜索、模糊匹配和语义搜索能力，支持对帖子、评论、用户、话题、档案、私信等多种内容类型进行索引和检索。

### 核心能力

* **全文搜索**：基于分词的文本内容检索
* **精确匹配**：ID、用户名等字段的精确查找
* **模糊搜索**：支持拼写纠错和近似匹配
* **语义搜索**：基于向量化的智能语义匹配（可选）
* **搜索建议**：输入时的自动补全和搜索建议
* **多类型索引**：支持帖子、用户、话题等多种内容类型

### 设计目标

| 维度         | 说明                                          |
| ------------ | --------------------------------------------- |
| 跨平台复用   | 微博、B站、知乎等所有 App 共享搜索能力         |
| 分层搜索     | 从精确匹配到语义搜索，按需选择搜索策略         |
| 高性能       | 利用 IndexedDB 索引和缓存优化搜索速度          |
| 可扩展       | 支持自定义索引类型和搜索策略                   |
| 渐进增强     | 基础功能零依赖，高级功能按需启用               |

### 问题背景

当前各 App 缺乏统一的搜索能力：

1. **能力分散**：各 App 自行实现简单的过滤逻辑，无法复用
2. **功能有限**：仅支持简单的字符串匹配，缺乏模糊和语义搜索
3. **索引缺失**：没有专门的搜索索引，大数据量时性能差
4. **体验不一致**：不同 App 搜索体验差异大

---

## 文档导航

| 文档                                | 说明                                      |
| ----------------------------------- | ----------------------------------------- |
| [架构设计](./architecture.md)       | 分层架构、索引策略、数据流                 |
| [类型定义](./types.md)              | SearchQuery、SearchResult、Indexable 等   |
| [使用示例](./usage.md)              | 搜索、索引管理、搜索建议示例               |
| [搜索策略](./search-strategies.md)  | 四层搜索策略详解                           |
| [系统集成](./integration.md)        | 与社交引擎、档案服务的集成                 |

---

## 快速开始

### 1. 基础搜索

```typescript
import { searchService } from '@/services/search';

// 简单文本搜索
const result = await searchService.search({
  text: '科技发布会',
  type: 'post',
});

console.log(`找到 ${result.total} 条结果，耗时 ${result.took}ms`);
result.items.forEach(item => {
  console.log(`[${item.type}] ${item.data.title} (相关度: ${item.score})`);
});
```

### 2. 多类型搜索

```typescript
import { searchService } from '@/services/search';

// 同时搜索帖子和用户
const result = await searchService.search({
  text: '小米',
  type: ['post', 'account'],
  pagination: { offset: 0, limit: 20 },
});
```

### 3. 带过滤条件的搜索

```typescript
import { searchService } from '@/services/search';

// 搜索特定平台、特定时间范围的内容
const result = await searchService.search({
  text: '热门话题',
  type: 'post',
  filters: [
    { field: 'platformId', operator: 'eq', value: 'weibo' },
    { field: 'timestamp', operator: 'gte', value: Date.now() - 86400000 },
  ],
  sort: { field: 'timestamp', order: 'desc' },
});
```

### 4. 模糊搜索

```typescript
import { searchService } from '@/services/search';

// 启用模糊匹配（容错拼写错误）
const result = await searchService.search({
  text: '苹果发布回', // 故意拼写错误
  type: 'post',
  fuzzy: true,
});
// 仍能匹配到「苹果发布会」相关内容
```

### 5. 搜索建议

```typescript
import { searchService } from '@/services/search';

// 获取搜索建议（用于自动补全）
const suggestions = await searchService.suggest('苹果', {
  limit: 5,
  types: ['topic', 'account'],
});
// ['苹果发布会', '苹果公司', '苹果手机', ...]
```

### 6. 索引管理

```typescript
import { searchService } from '@/services/search';

// 索引新内容
await searchService.index({
  id: 'post_123',
  type: 'post',
  content: '今天的科技发布会太精彩了！',
  metadata: {
    authorId: 'user_456',
    platformId: 'weibo',
    timestamp: Date.now(),
  },
});

// 批量索引
await searchService.indexBatch(posts.map(post => ({
  id: post.id,
  type: 'post',
  content: post.content,
  metadata: { authorId: post.authorId, platformId: post.platformId },
})));

// 删除索引
await searchService.remove('post_123', 'post');

// 重建索引
await searchService.reindex('post');
```

---

## 核心概念

### 可索引类型

```typescript
type IndexableType =
  | 'post'      // 帖子/博文
  | 'comment'   // 评论
  | 'account'   // 用户/账号
  | 'topic'     // 话题/热搜
  | 'archive'   // 档案
  | 'message';  // 私信
```

### 搜索能力分层

| 层级 | 能力       | 实现方式           | 适用场景         |
| ---- | ---------- | ------------------ | ---------------- |
| L1   | 精确匹配   | IndexedDB 索引     | ID/用户名查找    |
| L2   | 全文搜索   | 分词 + 倒排索引    | 内容搜索         |
| L3   | 模糊搜索   | 编辑距离算法       | 纠错、近似匹配   |
| L4   | 语义搜索   | 向量化 + 相似度    | 智能推荐         |

### 搜索查询

```typescript
interface SearchQuery {
  text: string;                       // 搜索文本
  type?: IndexableType | IndexableType[];  // 搜索范围
  filters?: SearchFilter[];           // 过滤条件
  sort?: SearchSort;                  // 排序方式
  pagination?: { offset: number; limit: number };
  
  // 高级选项
  fuzzy?: boolean;                    // 模糊匹配
  highlight?: boolean;                // 高亮匹配
}
```

### 搜索结果

```typescript
interface SearchResult {
  items: SearchResultItem[];          // 结果列表
  total: number;                      // 总匹配数
  took: number;                       // 耗时 ms
  suggestions?: string[];             // 搜索建议
}

interface SearchResultItem {
  id: string;                         // 内容 ID
  type: IndexableType;                // 内容类型
  score: number;                      // 相关性分数
  highlights?: Record<string, string[]>;  // 高亮片段
  data: any;                          // 原始数据
}
```

### 数据模型

```text
┌─────────────────────────────────────────────────────────────┐
│ SearchService                                                │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ SearchIndex (搜索索引)                                  │ │
│  │ └── 倒排索引：词 → 文档ID列表                           │ │
│  │     正排索引：文档ID → 原始内容                         │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ Tokenizer (分词器)                                      │ │
│  │ └── 中文分词、英文分词、标点处理                         │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ VectorStore (向量存储) [可选]                           │ │
│  │ └── 文本向量化、相似度计算                               │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ SuggestionEngine (建议引擎)                             │ │
│  │ └── 前缀匹配、热门搜索词                                 │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 核心 API 概览

### SearchService 主要方法

| 方法                  | 说明                              |
| --------------------- | --------------------------------- |
| **搜索相关**          |                                   |
| `search()`            | 执行搜索查询                      |
| `semanticSearch()`    | 语义搜索（需要向量存储）           |
| `suggest()`           | 获取搜索建议                      |
| **索引管理**          |                                   |
| `index()`             | 索引单个内容                      |
| `indexBatch()`        | 批量索引                          |
| `remove()`            | 删除索引                          |
| `reindex()`           | 重建指定类型的索引                |
| **配置相关**          |                                   |
| `setTokenizer()`      | 设置分词器                        |
| `setVectorStore()`    | 设置向量存储（启用语义搜索）       |
| `getStats()`          | 获取索引统计信息                  |

---

## 与其他服务的集成

```text
┌─────────────────────────────────────────────────────────────┐
│                      SearchService                           │
│                      (搜索服务)                              │
└─────────────────────────────────────────────────────────────┘
         │              │              │              │
         ▼              ▼              ▼              ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ Social      │ │ Archive     │ │ Account     │ │ IM          │
│ Media Engine│ │ Service     │ │ Service     │ │ Service     │
│ (社交引擎)  │ │ (档案服务)   │ │ (账号服务)  │ │ (即时通讯)  │
│             │ │             │ │             │ │             │
│ 帖子索引    │ │ 档案索引    │ │ 用户索引    │ │ 消息索引    │
│ 话题索引    │ │ 语义搜索    │ │ 账号搜索    │ │ 聊天搜索    │
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
         │              │              │              │
         └──────────────┴──────────────┴──────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    各 App (微博/B站/知乎)                    │
│                                                              │
│  搜索框输入 → searchService.suggest()                        │
│  搜索按钮 → searchService.search()                           │
│  新内容发布 → searchService.index()                          │
└─────────────────────────────────────────────────────────────┘
```

**核心集成点**：

* **社交媒体引擎**：新帖子创建时自动索引，支持内容搜索
* **档案服务**：档案内容索引，支持语义搜索
* **账号服务**：用户信息索引，支持用户搜索
* **即时通讯**：消息内容索引，支持聊天记录搜索

---

## 实施状态

| Phase   | 内容                       | 状态       |
| ------- | -------------------------- | ---------- |
| Phase 1 | 核心接口设计               | ✅ 已完成  |
| Phase 2 | L1/L2 搜索实现             | ⏳ 待实现  |
| Phase 3 | L3 模糊搜索                | ⏳ 待实现  |
| Phase 4 | L4 语义搜索（可选）         | ⏳ 待实现  |
| Phase 5 | 与社交引擎集成             | ⏳ 待实现  |

**预估工作量**：6-8 小时

---

## 文件结构

```text
src/
├── types/
│   └── search.ts                 # 类型定义
├── services/
│   └── search/
│       ├── index.ts              # 模块入口
│       ├── searchService.ts      # 核心服务（单例）
│       ├── searchIndex.ts        # 倒排索引实现
│       ├── tokenizer.ts          # 分词器
│       ├── fuzzyMatcher.ts       # 模糊匹配
│       ├── suggestionEngine.ts   # 搜索建议
│       └── vectorStore.ts        # 向量存储（可选）
└── stores/
    └── searchStore.ts            # Pinia Store（可选）
```

---

## 参考资料

* [服务开发指南](../service-development-guide.md)
* [社交内容平台架构](../architecture/Service-for-social-media-platform.md)
* [档案服务](../archive-service/README.md)
* [社交媒体引擎](../social-media-engine/README.md)
