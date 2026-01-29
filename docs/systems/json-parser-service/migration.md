# JSON Parser Service - 迁移指南

## 1. 概述

本文档描述如何将现有的 JSON 解析代码迁移到统一的 JSON Parser Service。

---

## 2. 现有代码清单

### 2.1 需要迁移的位置

| 文件 | 函数/方法 | 重复次数 | 优先级 |
|------|-----------|----------|--------|
| `src/services/llmTask/utils.ts` | `cleanJsonOutput`, `safeParseJson` | 1 | 🔴 高 |
| `src/services/prompt/chainExecutor/utils.ts` | `parseJSON` | 1 | 🔴 高 |
| `src/services/social/contentFactory.ts` | `parseAndRepairJSON` | 1 | 🟡 中 |
| `src/services/social/directorService.ts` | 内联清理逻辑 | 1 | 🟡 中 |
| `src/apps/weibo/stores/feedStore.ts` | 内联清理逻辑 | 2 | 🟢 低 |
| `src/apps/weibo/stores/composeStore.ts` | 内联清理逻辑 | 3 | 🟢 低 |
| `src/apps/weibo/stores/hotSearchStore.ts` | 内联清理逻辑 | 1 | 🟢 低 |
| `src/apps/weibo/composables/useNarrativeSubscription.ts` | 内联清理逻辑 | 1 | 🟢 低 |
| `src/apps/weibo/llmTask/weiboOutputHandlers.ts` | `cleanJsonOutput` 调用 | 4 | 🟢 低 |

---

## 3. 迁移步骤

### Phase 1: 创建服务并保持兼容

**目标**：创建新服务，同时保持现有代码正常工作。

#### Step 1.1: 创建服务文件

```bash
mkdir -p src/services/jsonParser
touch src/services/jsonParser/index.ts
touch src/services/jsonParser/types.ts
touch src/services/jsonParser/JsonParserService.ts
touch src/services/jsonParser/strategies.ts
```

#### Step 1.2: 实现服务（参考 implementation.md）

#### Step 1.3: 修改 llmTask/utils.ts 为包装器

```typescript
// src/services/llmTask/utils.ts

import { getJsonParserService } from '@/services/jsonParser';

/**
 * 清理 LLM 输出中的 JSON
 * @deprecated 请直接使用 jsonParser.cleanMarkdown()
 */
export function cleanJsonOutput(output: string): string {
  return getJsonParserService().cleanMarkdown(output);
}

/**
 * 安全解析 JSON
 * @deprecated 请直接使用 jsonParser.parse()
 */
export function safeParseJson<T>(text: string): T | null {
  const result = getJsonParserService().parse<T>(text);
  return result.success ? result.data! : null;
}
```

---

### Phase 2: 迁移 prompt/chainExecutor

#### Step 2.1: 修改 utils.ts

**Before**:
```typescript
// src/services/prompt/chainExecutor/utils.ts

export function parseJSON(text: string): unknown {
  const jsonBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonBlockMatch) {
    text = jsonBlockMatch[1];
  }
  
  const objectMatch = text.match(/\{[\s\S]*\}/);
  const arrayMatch = text.match(/\[[\s\S]*\]/);
  const jsonText = objectMatch?.[0] || arrayMatch?.[0] || text;
  
  return JSON.parse(jsonText);
}
```

**After**:
```typescript
// src/services/prompt/chainExecutor/utils.ts

import { getJsonParserService } from '@/services/jsonParser';

/**
 * 解析 JSON
 * @deprecated 请直接使用 jsonParser.parseStrict()
 */
export function parseJSON(text: string): unknown {
  return getJsonParserService().parseStrict(text);
}
```

---

### Phase 3: 迁移 contentFactory

#### Step 3.1: 移除私有方法

**Before**:
```typescript
// src/services/social/contentFactory.ts

class ContentFactory {
  private async parseAndRepairJSON(text: string): Promise<any> {
    let cleanText = text
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();
    
    try {
      return JSON5.parse(cleanText);
    } catch (e) {
      // 边界修复逻辑...
    }
  }
  
  async generatePosts(...) {
    // ...
    return this.parseAndRepairJSON(result.text);
  }
}
```

**After**:
```typescript
// src/services/social/contentFactory.ts

import { getJsonParserService } from '@/services/jsonParser';

class ContentFactory {
  private jsonParser = getJsonParserService();
  
  async generatePosts(...) {
    // ...
    const result = this.jsonParser.parse(result.text);
    if (!result.success) {
      throw new Error(`Failed to parse posts: ${result.error}`);
    }
    return result.data;
  }
}
```

---

### Phase 4: 迁移 directorService

**Before**:
```typescript
// src/services/social/directorService.ts

try {
  const cleanJson = result.text
    .replace(/```json/g, '')
    .replace(/```/g, '')
    .trim();
  eventData = JSON.parse(cleanJson);
} catch (e) {
  console.error('[Director] Failed to parse event JSON', e);
  return;
}
```

**After**:
```typescript
// src/services/social/directorService.ts

import { getJsonParserService } from '@/services/jsonParser';

const parseResult = getJsonParserService().parse(result.text);
if (!parseResult.success) {
  console.error('[Director] Failed to parse event JSON:', parseResult.error);
  return;
}
eventData = parseResult.data;
```

---

### Phase 5: 迁移微博 Stores

微博各 Store 中有大量重复的内联 JSON 清理逻辑，需要统一替换。

#### 通用模式

**Before（典型重复代码）**:
```typescript
let cleanJson = result.trim();
if (cleanJson.startsWith('```json')) {
  cleanJson = cleanJson.slice(7);
} else if (cleanJson.startsWith('```')) {
  cleanJson = cleanJson.slice(3);
}
if (cleanJson.endsWith('```')) {
  cleanJson = cleanJson.slice(0, -3);
}
cleanJson = cleanJson.trim();
parsed = JSON.parse(cleanJson);
```

**After**:
```typescript
import { getJsonParserService } from '@/services/jsonParser';

const parseResult = getJsonParserService().parse(result);
if (!parseResult.success) {
  console.error('Failed to parse:', parseResult.error);
  return;
}
parsed = parseResult.data;
```

#### 需要修改的文件

1. `src/apps/weibo/stores/feedStore.ts` - 2 处
2. `src/apps/weibo/stores/composeStore.ts` - 3 处
3. `src/apps/weibo/stores/hotSearchStore.ts` - 1 处
4. `src/apps/weibo/composables/useNarrativeSubscription.ts` - 1 处
5. `src/apps/weibo/llmTask/weiboOutputHandlers.ts` - 4 处

---

## 4. 迁移脚本

可以使用以下脚本辅助迁移：

```typescript
// scripts/migrate-json-parser.ts

/**
 * 查找所有需要迁移的位置
 */
const patterns = [
  // Markdown 清理模式
  /\.replace\(\s*\/```json\/g?,?\s*['"].*?['"]\s*\)/g,
  /\.replace\(\s*\/```\/g?,?\s*['"].*?['"]\s*\)/g,
  
  // 直接 JSON.parse 调用
  /JSON\.parse\s*\([^)]+\)/g,
  
  // cleanJsonOutput 调用
  /cleanJsonOutput\s*\(/g,
  
  // safeParseJson 调用
  /safeParseJson\s*\(/g,
];

// 使用 grep 或 AST 工具进行搜索和替换
```

---

## 5. 测试验证

### 5.1 单元测试

确保新服务的单元测试覆盖所有现有功能：

```typescript
describe('迁移兼容性', () => {
  it('应该兼容 cleanJsonOutput 行为', () => {
    const input = '```json\n{"key": "value"}\n```';
    const expected = '{"key": "value"}';
    
    expect(jsonParser.cleanMarkdown(input)).toBe(expected);
    expect(cleanJsonOutput(input)).toBe(expected); // 旧函数
  });
  
  it('应该兼容 safeParseJson 行为', () => {
    const input = '```json\n{"key": "value"}\n```';
    
    const result = jsonParser.parse(input);
    const oldResult = safeParseJson(input);
    
    expect(result.success).toBe(true);
    expect(result.data).toEqual(oldResult);
  });
  
  it('应该兼容 parseAndRepairJSON 行为', () => {
    const input = '{"a": 1,}'; // 尾逗号
    
    const result = jsonParser.parse(input);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ a: 1 });
  });
});
```

### 5.2 集成测试

在迁移每个模块后，运行相关的集成测试：

```bash
# 测试 LLM Task Service
npm run test -- src/services/llmTask

# 测试 Prompt Service
npm run test -- src/services/prompt

# 测试 Social Service
npm run test -- src/services/social

# 测试微博 App
npm run test -- src/apps/weibo
```

---

## 6. 回滚计划

如果迁移出现问题，可以快速回滚：

### 6.1 保留旧实现

在迁移初期，保留旧实现作为备份：

```typescript
// src/services/llmTask/utils.ts

// 使用新服务
const USE_NEW_JSON_PARSER = true;

export function safeParseJson<T>(text: string): T | null {
  if (USE_NEW_JSON_PARSER) {
    const result = getJsonParserService().parse<T>(text);
    return result.success ? result.data! : null;
  }
  
  // 旧实现（备份）
  try {
    const cleaned = cleanJsonOutputLegacy(text);
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

function cleanJsonOutputLegacy(output: string): string {
  return output
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}
```

### 6.2 功能开关

可以通过环境变量控制：

```typescript
const USE_NEW_JSON_PARSER = import.meta.env.VITE_USE_NEW_JSON_PARSER !== 'false';
```

---

## 7. 时间线

| 阶段 | 内容 | 预计时间 | 风险 |
|------|------|----------|------|
| Phase 1 | 创建服务，修改 llmTask | 2h | 低 |
| Phase 2 | 迁移 prompt/chainExecutor | 1h | 低 |
| Phase 3 | 迁移 contentFactory | 1h | 中 |
| Phase 4 | 迁移 directorService | 30min | 低 |
| Phase 5 | 迁移微博 Stores | 2h | 中 |
| 测试 | 单元测试 + 集成测试 | 2h | - |
| **总计** | | **8.5h** | |

---

## 8. 注意事项

### 8.1 类型安全

新服务使用泛型，确保类型正确传递：

```typescript
// ✅ 正确
const result = jsonParser.parse<MyType>(text);
if (result.success) {
  const data: MyType = result.data; // 类型正确
}

// ❌ 避免
const result = jsonParser.parse(text);
const data = result.data as MyType; // 类型断言不安全
```

### 8.2 错误处理

新服务的错误处理更加结构化：

```typescript
// 旧方式
try {
  const data = JSON.parse(cleanJson);
} catch (e) {
  console.error('Failed to parse', e);
}

// 新方式
const result = jsonParser.parse(text);
if (!result.success) {
  console.error('Failed to parse:', result.error);
  if (result.warnings) {
    console.warn('Warnings:', result.warnings);
  }
}
```

### 8.3 性能监控

迁移后可以使用统计功能监控解析情况：

```typescript
// 在应用启动时
setInterval(() => {
  const stats = jsonParser.getStats();
  console.log('JSON Parser Stats:', {
    total: stats.totalParses,
    success: stats.successCount,
    failure: stats.failureCount,
    repairRate: stats.repairCount / stats.successCount,
  });
}, 60000); // 每分钟输出一次
```
