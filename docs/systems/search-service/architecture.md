# 搜索服务架构设计

> 目标：支撑 Search MVP（L1/L2 + Suggest + 增量索引），并为 L3/L4 预留扩展位。

## 1. 分层架构

```text
┌────────────────────────────────────────────────────────────┐
│ 应用层 (Apps)                                               │
│ Weibo / Archive / Account Manager / Future IM             │
└────────────────────────────────────────────────────────────┘
                           │ search/index/suggest
                           ▼
┌────────────────────────────────────────────────────────────┐
│ Search Service                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ QueryProcessor                                       │  │
│  │ - normalize query                                    │  │
│  │ - select strategy (L1/L2)                            │  │
│  │ - filter/sort/paginate                               │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────┐ ┌──────────────────┐ ┌───────────┐  │
│  │ IndexRepository  │ │ SuggestionEngine │ │ Tokenizer │  │
│  │ - inverted index │ │ - prefix lookup  │ │ zh/en mix │  │
│  │ - forward doc    │ │ - hot terms      │ │           │  │
│  └──────────────────┘ └──────────────────┘ └───────────┘  │
└────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────────┐
│ Storage (IndexedDB / Dexie tables)                         │
│ search_documents / search_terms / search_postings / suggest│
└────────────────────────────────────────────────────────────┘
```

## 2. 核心组件职责

| 组件 | 职责 | 备注 |
| ---- | ---- | ---- |
| `SearchService` | 对外统一 API、参数校验、异常封装 | 对 App 暴露单一入口 |
| `QueryProcessor` | 查询归一化、策略路由、结果后处理 | 支持 L1/L2 策略切换 |
| `IndexRepository` | 索引增删改查、批量写入、重建 | 与数据库层对接 |
| `Tokenizer` | 中英文混合分词、停用词过滤 | L2 核心依赖 |
| `SuggestionEngine` | 前缀补全、热门词统计 | 由索引更新驱动 |
| `RankingEngine` | 相关性评分（TF-IDF/BM25-lite） | MVP 推荐 TF-IDF |

## 3. 索引模型（MVP）

| 表/结构 | 主键 | 关键字段 | 用途 |
| ---- | ---- | ---- | ---- |
| `search_documents` | `docId` | `type`, `content`, `metadata`, `updatedAt` | 正排索引，保存文档原文 |
| `search_postings` | `token+docId` | `token`, `docId`, `tf`, `type` | 倒排索引，支撑全文检索 |
| `search_terms` | `token` | `df`, `lastSeenAt` | 词项统计，用于相关性计算 |
| `search_suggestions` | `term` | `weight`, `type` | 前缀建议与热词 |

## 4. 查询执行流程

```text
search(query)
  -> normalize query (trim/lowercase/default pagination)
  -> strategy select
      - L1: exact (id/username/hash tag)
      - L2: fulltext (tokenize + postings lookup)
  -> merge + dedupe
  -> filter(metadata)
  -> sort(score/timestamp/custom)
  -> paginate
  -> optional highlight
```

## 5. 增量索引流程

```text
index(document)
  -> load old doc (if exists)
  -> remove old postings
  -> tokenize new content
  -> write document
  -> write postings + term stats
  -> update suggestion terms
```

- 更新文档按“先删后写”保证一致性。
- 批量写入使用事务，避免中途部分成功。
- 删除文档时同步清理 postings 和 suggestion 计数。

## 6. 一致性与恢复

- 写入策略：单文档原子事务；批量写入分批事务（例如每 200 条）
- 冷启动：若索引表为空，触发一次全量 `reindex`（按类型分批）
- 恢复机制：索引构建中断时记录 checkpoint，支持续跑
- 校验任务：可由 Scheduler 每日执行 `reconcile(type)` 对账

## 7. 性能与扩展点

- 优先项
  - 小词过滤与停用词过滤，减少倒排膨胀
  - 查询侧先按类型缩小候选集
  - 建议词表使用前缀缓存
- 扩展位
  - L3 模糊搜索：在 QueryProcessor 增加 `fuzzy` 分支
  - L4 语义搜索：接入 Vector Store 作为补充召回层
  - 排序策略：按业务场景替换 `RankingEngine`
