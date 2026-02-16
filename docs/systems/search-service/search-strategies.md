# 搜索策略详解

> Search MVP 默认启用 L1 + L2；L3/L4 作为后续增强层。

## 1. 分层策略

| 层级 | 策略 | 状态 | 适用场景 |
| ---- | ---- | ---- | ---- |
| L1 | 精确匹配 (Exact Match) | MVP | ID、用户名、固定标识 |
| L2 | 全文搜索 (Full-Text) | MVP | 帖子正文、档案摘要、用户简介 |
| L3 | 模糊搜索 (Fuzzy) | 规划中 | 拼写纠错、近似匹配 |
| L4 | 语义搜索 (Semantic) | 规划中 | 意图检索、相似内容召回 |

## 2. L1 精确匹配

核心思路：先走最便宜路径，优先命中高确定性结果。

- 查询特征：
  - `post_123` / `acc_456` 这类主键
  - `@username` 这类明确账号标识
  - `#话题#` 这类规范标签
- 实现方式：
  - 直接查 `search_documents` 索引字段
  - 命中后给高分（例如 `score = 1.0`）

优点：快、稳定、低开销。  
限制：不能处理错别字和语义近义词。

## 3. L2 全文搜索

核心思路：分词 -> 倒排检索 -> 相关性打分 -> 排序。

### 3.1 分词规则（MVP）

- 英文：按单词切分并转小写
- 中文：单字 + 二元词组合（兼顾召回和成本）
- 过滤：停用词、纯标点、超短无意义 token

### 3.2 召回与排序

- 召回：按 query token 查询倒排表并合并候选文档
- 排序：默认 `score desc`，评分可用 TF-IDF 或 BM25-lite
- 二次排序：可叠加时间衰减（例如 `timestamp`）

### 3.3 过滤与分页

- 先过滤（type/platform/time），再排序分页，避免无效排序开销
- 分页参数：`offset + limit`

## 4. 策略路由建议

```text
if looksLikeExactQuery(query):
  run L1
  if hit enough: return
run L2
if empty and fuzzy enabled: run L3 (future)
if still weak and semantic enabled: run L4 (future)
```

- 默认阈值建议：L1 命中 >= 3 条时可直接返回。
- 如需稳定体验，可将 L1 命中插入 L2 结果头部并去重。

## 5. L3/L4 演进预案

### L3 模糊搜索（后续）

- 算法：编辑距离（Levenshtein）
- 范围控制：仅对短 query 或低结果场景开启
- 成本控制：限制词表扫描范围（长度窗口 + 前缀过滤）

### L4 语义搜索（后续）

- 依赖：Vector Store + Embedding Provider
- 作用：补召回，不直接替代 L2
- 融合：`finalScore = alpha * lexical + beta * semantic`

## 6. 参数调优建议

- `minTokenLength`: 1-2（中文建议 1，英文建议 2）
- `maxResultWindow`: 200（避免深分页高开销）
- `suggestLimit`: 5-10
- `reindexBatchSize`: 100-300

## 7. 质量评估基线

- 精确率：Top10 人工抽样准确率
- 召回率：预设 query 集合的命中率
- 性能：不同规模数据下 P95 查询耗时
- 稳定性：索引更新后可见性延迟
