# JSON Parser Service（JSON 解析服务）

> **版本**: 1.0  
> **状态**: 已实现 
> **最后更新**: 2026-01-08  
> **优先级**: 🟡 中（基础设施层）

## 1. 概述

### 1.1 背景与问题

LLM 输出的 JSON 经常存在格式问题，导致标准 `JSON.parse()` 无法解析：

| 问题类型 | 示例 | 出现频率 |
| ---------- | ------ | ---------- |
| Markdown 代码块包裹 | `` ```json\n{...}\n``` `` | 🔴 高 |
| 多余前缀/后缀文本 | `Sure! Here's the JSON: {...}` | 🔴 高 |
| 尾部逗号 | `{"a": 1, "b": 2,}` | 🟡 中 |
| 单引号 | `{'key': 'value'}` | 🟡 中 |
| 注释 | `{"a": 1 // comment}` | 🟢 低 |
| 缺少引号的键名 | `{key: "value"}` | 🟢 低 |

### 1.2 当前实现分析

代码库中存在 **多处重复** 的 JSON 清理逻辑：

| 位置 | 实现方式 | 能力 |
| ------ | ---------- | ------ |
| `llmTask/utils.ts` | `cleanJsonOutput()` + `safeParseJson()` | 移除 Markdown 标记 |
| `prompt/chainExecutor/utils.ts` | `parseJSON()` | 提取代码块 + 对象/数组匹配 |
| `social/contentFactory.ts` | `parseAndRepairJSON()` | JSON5 + 边界修复 |
| 微博各 Store | 内联实现（重复 10+ 处） | 移除 Markdown 标记 |
| `social/directorService.ts` | 内联实现 | 移除 Markdown 标记 |

**问题**：

1. 代码重复严重，维护成本高
2. 各实现能力不一致
3. 缺乏统一的错误处理和日志
4. 无法进行渐进式修复（先尝试简单方法，再尝试复杂方法）

### 1.3 设计目标

1. **统一入口**：所有 JSON 解析统一使用此服务
2. **鲁棒性**：处理各种常见的 LLM 输出格式问题
3. **渐进式修复**：从简单到复杂，逐步尝试修复
4. **可扩展**：支持自定义修复策略
5. **可观测**：提供解析统计和错误日志

---

## 2. 文档结构

| 文档 | 说明 |
| ------ | ------ |
| [types.md](./types.md) | 类型定义 |
| [implementation.md](./implementation.md) | 实现设计 |
| [strategies.md](./strategies.md) | 内置修复策略 |
| [migration.md](./migration.md) | 迁移指南 |

---

## 3. 快速开始

### 3.1 基本用法

```typescript
import { getJsonParserService } from '@/services/jsonParser';

const parser = getJsonParserService();

// 安全解析（不抛异常）
const result = parser.parse<MyType>(llmOutput);
if (result.success) {
  console.log('解析成功:', result.data);
  if (result.repaired) {
    console.log('使用修复策略:', result.repairStrategy);
  }
} else {
  console.log('解析失败:', result.error);
}

// 严格解析（失败抛异常）
try {
  const data = parser.parseStrict<MyType>(llmOutput);
} catch (e) {
  console.error('解析失败:', e);
}
```

### 3.2 提取 JSON

```typescript
// 从混合文本中提取
const json = parser.extractJson('Here is the result: {"key": "value"} done.');
// => '{"key": "value"}'

// 提取所有 JSON 块
const allJson = parser.extractAllJson(text);
```

### 3.3 自定义选项

```typescript
const result = parser.parse(text, {
  allowJson5: true,           // 使用 JSON5 解析
  autoRepair: true,           // 自动尝试修复
  extractFromCodeBlock: true, // 从代码块提取
  extractFromText: true,      // 从混合文本提取
  defaultValue: [],           // 失败时的默认值
});
```

---

## 4. 核心接口

```typescript
interface JsonParserService {
  // 解析方法
  parse<T>(text: string, options?: ParseOptions): ParseResult<T>;
  parseStrict<T>(text: string, options?: ParseOptions): T;
  parseWithValidator<T>(text: string, validator: (data: unknown) => data is T): ParseResult<T>;
  
  // 提取方法
  extractJson(text: string): string | null;
  extractAllJson(text: string): string[];
  
  // 修复方法
  repair(text: string): string;
  cleanMarkdown(text: string): string;
  
  // 配置方法
  registerRepairStrategy(strategy: RepairStrategy): void;
  getStats(): ParserStats;
  resetStats(): void;
}
```

---

## 5. 修复策略

服务内置以下修复策略（按优先级排序）：

| 策略 | 优先级 | 说明 |
| ------ | -------- | ------ |
| `extract-boundaries` | 10 | 提取 JSON 对象/数组边界 |
| `remove-trailing-commas` | 20 | 移除尾部逗号 |
| `single-to-double-quotes` | 30 | 单引号转双引号 |
| `quote-unquoted-keys` | 40 | 为无引号的键名添加引号 |
| `remove-comments` | 50 | 移除 JS 风格注释 |
| `fix-escape-sequences` | 60 | 修复转义序列问题 |

详见 [strategies.md](./strategies.md)。

---

## 6. 与现有代码的关系

### 6.1 迁移计划

| 阶段 | 内容 | 状态 |
| ------ | ------ | ------ |
| Phase 1 | 创建服务，实现核心功能 | 📋 待实现 |
| Phase 2 | 迁移 `llmTask/utils.ts` | 📋 待实现 |
| Phase 3 | 迁移 `prompt/chainExecutor/utils.ts` | 📋 待实现 |
| Phase 4 | 迁移 `social/contentFactory.ts` | 📋 待实现 |
| Phase 5 | 迁移微博各 Store | 📋 待实现 |

### 6.2 兼容性

- 现有函数保留为包装器，内部调用新服务
- 逐步迁移，不影响现有功能
- 提供迁移指南

---

## 7. 依赖关系

```text
┌─────────────────────────────────────────────┐
│                应用层                        │
│  微博 Store │ LLM Task │ Content Factory    │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│           JSON Parser Service               │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐     │
│  │ 解析器   │  │ 提取器   │  │ 修复器   │     │
│  └─────────┘  └─────────┘  └─────────┘     │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│              依赖库                          │
│         JSON5 (可选)                        │
└─────────────────────────────────────────────┘
```

---

## 8. 工作量预估

| 任务 | 预估时间 |
| ------ | ---------- |
| 核心服务实现 | 3-4h |
| 修复策略实现 | 2-3h |
| 单元测试 | 2h |
| 迁移现有代码 | 3-4h |
| 文档完善 | 1h |
| **总计** | **11-14h** |

---

## 9. 参考文档

- [Logger Service](../logger-service/README.md) - 日志服务（可选集成）
- [LLM Task Service](../llm-task-service/README.md) - LLM 任务服务（主要消费者）
- [Prompt Service](../prompt-service/README.md) - 提示词服务（主要消费者）
