# JSON Parser Service - 修复策略

## 1. 策略概述

修复策略是 JSON Parser Service 的核心能力，用于处理 LLM 输出中常见的 JSON 格式问题。

### 1.1 设计原则

1. **渐进式修复**：从简单到复杂，逐步尝试
2. **最小改动**：只修复必要的问题，保持原始内容
3. **可组合**：策略可以组合使用
4. **可扩展**：支持自定义策略

### 1.2 内置策略列表

| 优先级 | 策略名称 | 说明 |
| -------- | ---------- | ------ |
| 10 | `extract-boundaries` | 提取 JSON 边界 |
| 20 | `remove-trailing-commas` | 移除尾部逗号 |
| 30 | `single-to-double-quotes` | 单引号转双引号 |
| 40 | `quote-unquoted-keys` | 为无引号键名添加引号 |
| 50 | `remove-comments` | 移除 JS 风格注释 |
| 60 | `fix-escape-sequences` | 修复转义序列 |

---

## 2. 内置策略详解

### 2.1 extract-boundaries（提取边界）

**优先级**: 10

**问题**：JSON 前后有多余的文本

**示例**：
```text
输入: Here is the result: {"key": "value"} Hope this helps!
输出: {"key": "value"}
```

**实现**：
```typescript
{
  name: 'extract-boundaries',
  priority: 10,
  repair: (text: string): string | null => {
    const firstBrace = text.indexOf('{');
    const firstBracket = text.indexOf('[');
    const lastBrace = text.lastIndexOf('}');
    const lastBracket = text.lastIndexOf(']');
    
    let start = -1;
    let end = -1;
    
    // 判断是对象还是数组
    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
      start = firstBrace;
      end = lastBrace;
    } else if (firstBracket !== -1) {
      start = firstBracket;
      end = lastBracket;
    }
    
    if (start !== -1 && end !== -1 && end > start) {
      return text.substring(start, end + 1);
    }
    
    return null;
  },
}
```

---

### 2.2 remove-trailing-commas（移除尾部逗号）

**优先级**: 20

**问题**：对象或数组的最后一个元素后有逗号

**示例**：
```text
输入: {"a": 1, "b": 2,}
输出: {"a": 1, "b": 2}

输入: [1, 2, 3,]
输出: [1, 2, 3]
```

**实现**：
```typescript
{
  name: 'remove-trailing-commas',
  priority: 20,
  repair: (text: string): string | null => {
    const repaired = text
      .replace(/,\s*}/g, '}')
      .replace(/,\s*]/g, ']');
    
    return repaired !== text ? repaired : null;
  },
}
```

---

### 2.3 single-to-double-quotes（单引号转双引号）

**优先级**: 30

**问题**：使用单引号代替双引号

**示例**：
```text
输入: {'name': 'Alice'}
输出: {"name": "Alice"}
```

**实现**：
```typescript
{
  name: 'single-to-double-quotes',
  priority: 30,
  repair: (text: string): string | null => {
    if (!text.includes("'")) {
      return null;
    }
    
    let result = '';
    let inString = false;
    let stringChar = '';
    let i = 0;
    
    while (i < text.length) {
      const char = text[i];
      const prevChar = i > 0 ? text[i - 1] : '';
      
      if (!inString) {
        if (char === "'" || char === '"') {
          inString = true;
          stringChar = char;
          result += '"';
        } else {
          result += char;
        }
      } else {
        if (char === stringChar && prevChar !== '\\') {
          inString = false;
          result += '"';
        } else if (char === '"' && stringChar === "'") {
          // 单引号字符串中的双引号需要转义
          result += '\\"';
        } else {
          result += char;
        }
      }
      
      i++;
    }
    
    return result !== text ? result : null;
  },
}
```

**注意**：这个实现假设引号使用是一致的，复杂的混合情况可能需要更精细的处理。

---

### 2.4 quote-unquoted-keys（添加键名引号）

**优先级**: 40

**问题**：键名没有使用引号

**示例**：
```text
输入: {name: "Alice", age: 25}
输出: {"name": "Alice", "age": 25}
```

**实现**：
```typescript
{
  name: 'quote-unquoted-keys',
  priority: 40,
  repair: (text: string): string | null => {
    // 匹配 { 或 , 后面的无引号标识符
    const repaired = text.replace(
      /([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g,
      '$1"$2":'
    );
    
    return repaired !== text ? repaired : null;
  },
}
```

---

### 2.5 remove-comments（移除注释）

**优先级**: 50

**问题**：包含 JavaScript 风格的注释

**示例**：
```text
输入: {
  "name": "Alice", // 用户名
  /* 年龄信息 */
  "age": 25
}
输出: {
  "name": "Alice",
  "age": 25
}
```

**实现**：
```typescript
{
  name: 'remove-comments',
  priority: 50,
  repair: (text: string): string | null => {
    if (!text.includes('//') && !text.includes('/*')) {
      return null;
    }
    
    // 移除单行注释（注意不要匹配 URL 中的 //）
    let repaired = text.replace(/(?<!:)\/\/[^\n]*/g, '');
    
    // 移除多行注释
    repaired = repaired.replace(/\/\*[\s\S]*?\*\//g, '');
    
    return repaired !== text ? repaired : null;
  },
}
```

**注意**：使用了负向后瞻 `(?<!:)` 来避免匹配 URL 中的 `://`。

---

### 2.6 fix-escape-sequences（修复转义序列）

**优先级**: 60

**问题**：不正确的转义序列

**示例**：
```text
输入: {"path": "C:\Users\name"}
输出: {"path": "C:\\Users\\name"}
```

**实现**：
```typescript
{
  name: 'fix-escape-sequences',
  priority: 60,
  repair: (text: string): string | null => {
    // 修复 Windows 路径中的反斜杠
    // 这是一个简化实现，只处理常见情况
    
    let repaired = text;
    let changed = false;
    
    // 匹配字符串中的单个反斜杠（后面不是有效的转义字符）
    repaired = repaired.replace(
      /"([^"]*?)\\([^"\\nrtbfu\/])/g,
      (match, before, after) => {
        changed = true;
        return `"${before}\\\\${after}`;
      }
    );
    
    return changed ? repaired : null;
  },
}
```

---

## 3. 策略实现文件

```typescript
// src/services/jsonParser/strategies.ts

import type { RepairStrategy } from './types';

/**
 * 内置修复策略列表
 */
export const BUILTIN_REPAIR_STRATEGIES: RepairStrategy[] = [
  // 策略 1: 提取边界
  {
    name: 'extract-boundaries',
    description: '提取 JSON 对象或数组的边界',
    priority: 10,
    repair: (text: string): string | null => {
      const firstBrace = text.indexOf('{');
      const firstBracket = text.indexOf('[');
      const lastBrace = text.lastIndexOf('}');
      const lastBracket = text.lastIndexOf(']');
      
      let start = -1;
      let end = -1;
      
      if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
        start = firstBrace;
        end = lastBrace;
      } else if (firstBracket !== -1) {
        start = firstBracket;
        end = lastBracket;
      }
      
      if (start !== -1 && end !== -1 && end > start) {
        return text.substring(start, end + 1);
      }
      
      return null;
    },
  },
  
  // 策略 2: 移除尾部逗号
  {
    name: 'remove-trailing-commas',
    description: '移除对象和数组中的尾部逗号',
    priority: 20,
    repair: (text: string): string | null => {
      const repaired = text
        .replace(/,\s*}/g, '}')
        .replace(/,\s*]/g, ']');
      
      return repaired !== text ? repaired : null;
    },
  },
  
  // 策略 3: 单引号转双引号
  {
    name: 'single-to-double-quotes',
    description: '将单引号字符串转换为双引号',
    priority: 30,
    repair: (text: string): string | null => {
      if (!text.includes("'")) {
        return null;
      }
      
      let result = '';
      let inString = false;
      let stringChar = '';
      let i = 0;
      
      while (i < text.length) {
        const char = text[i];
        const prevChar = i > 0 ? text[i - 1] : '';
        
        if (!inString) {
          if (char === "'" || char === '"') {
            inString = true;
            stringChar = char;
            result += '"';
          } else {
            result += char;
          }
        } else {
          if (char === stringChar && prevChar !== '\\') {
            inString = false;
            result += '"';
          } else if (char === '"' && stringChar === "'") {
            result += '\\"';
          } else {
            result += char;
          }
        }
        
        i++;
      }
      
      return result !== text ? result : null;
    },
  },
  
  // 策略 4: 添加键名引号
  {
    name: 'quote-unquoted-keys',
    description: '为无引号的键名添加双引号',
    priority: 40,
    repair: (text: string): string | null => {
      const repaired = text.replace(
        /([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g,
        '$1"$2":'
      );
      
      return repaired !== text ? repaired : null;
    },
  },
  
  // 策略 5: 移除注释
  {
    name: 'remove-comments',
    description: '移除 JavaScript 风格的注释',
    priority: 50,
    repair: (text: string): string | null => {
      if (!text.includes('//') && !text.includes('/*')) {
        return null;
      }
      
      // 移除单行注释
      let repaired = text.replace(/\/\/[^\n]*/g, '');
      
      // 移除多行注释
      repaired = repaired.replace(/\/\*[\s\S]*?\*\//g, '');
      
      return repaired !== text ? repaired : null;
    },
  },
  
  // 策略 6: 修复转义序列
  {
    name: 'fix-escape-sequences',
    description: '修复不正确的转义序列',
    priority: 60,
    repair: (text: string): string | null => {
      let repaired = text;
      let changed = false;
      
      // 修复字符串中的无效转义
      repaired = repaired.replace(
        /"([^"]*?)\\([^"\\nrtbfu\/])/g,
        (match, before, after) => {
          changed = true;
          return `"${before}\\\\${after}`;
        }
      );
      
      return changed ? repaired : null;
    },
  },
];
```

---

## 4. 自定义策略

### 4.1 创建自定义策略

```typescript
import { getJsonParserService } from '@/services/jsonParser';
import type { RepairStrategy } from '@/services/jsonParser';

// 自定义策略：将 NaN 替换为 null
const nanToNullStrategy: RepairStrategy = {
  name: 'nan-to-null',
  description: '将 NaN 值替换为 null',
  priority: 55, // 在 remove-comments 和 fix-escape-sequences 之间
  repair: (text: string): string | null => {
    if (!text.includes('NaN')) {
      return null;
    }
    return text.replace(/\bNaN\b/g, 'null');
  },
};

// 注册策略
const parser = getJsonParserService();
parser.registerRepairStrategy(nanToNullStrategy);
```

### 4.2 禁用内置策略

```typescript
// 注册一个同名但禁用的策略会覆盖原有策略
parser.registerRepairStrategy({
  name: 'remove-comments',
  priority: 50,
  enabled: false, // 禁用此策略
  repair: () => null,
});
```

### 4.3 调整策略优先级

```typescript
// 重新注册同名策略，使用不同优先级
parser.registerRepairStrategy({
  name: 'remove-trailing-commas',
  priority: 5, // 提高优先级，使其最先执行
  repair: (text) => {
    const repaired = text
      .replace(/,\s*}/g, '}')
      .replace(/,\s*]/g, ']');
    return repaired !== text ? repaired : null;
  },
});
```

---

## 5. 策略测试

```typescript
// src/services/jsonParser/__tests__/strategies.test.ts

import { describe, it, expect } from 'vitest';
import { BUILTIN_REPAIR_STRATEGIES } from '../strategies';

describe('修复策略', () => {
  describe('extract-boundaries', () => {
    const strategy = BUILTIN_REPAIR_STRATEGIES.find(s => s.name === 'extract-boundaries')!;
    
    it('应该提取对象边界', () => {
      expect(strategy.repair('prefix {"a": 1} suffix')).toBe('{"a": 1}');
    });
    
    it('应该提取数组边界', () => {
      expect(strategy.repair('data: [1, 2, 3]')).toBe('[1, 2, 3]');
    });
    
    it('无法提取时返回 null', () => {
      expect(strategy.repair('no json here')).toBeNull();
    });
  });
  
  describe('remove-trailing-commas', () => {
    const strategy = BUILTIN_REPAIR_STRATEGIES.find(s => s.name === 'remove-trailing-commas')!;
    
    it('应该移除对象尾逗号', () => {
      expect(strategy.repair('{"a": 1,}')).toBe('{"a": 1}');
    });
    
    it('应该移除数组尾逗号', () => {
      expect(strategy.repair('[1, 2, 3,]')).toBe('[1, 2, 3]');
    });
    
    it('没有尾逗号时返回 null', () => {
      expect(strategy.repair('{"a": 1}')).toBeNull();
    });
  });
  
  describe('single-to-double-quotes', () => {
    const strategy = BUILTIN_REPAIR_STRATEGIES.find(s => s.name === 'single-to-double-quotes')!;
    
    it('应该转换单引号', () => {
      expect(strategy.repair("{'name': 'Alice'}")).toBe('{"name": "Alice"}');
    });
    
    it('应该处理嵌套引号', () => {
      expect(strategy.repair("{'say': 'he said \"hi\"'}")).toContain('"say"');
    });
    
    it('没有单引号时返回 null', () => {
      expect(strategy.repair('{"a": 1}')).toBeNull();
    });
  });
  
  describe('quote-unquoted-keys', () => {
    const strategy = BUILTIN_REPAIR_STRATEGIES.find(s => s.name === 'quote-unquoted-keys')!;
    
    it('应该为无引号键名添加引号', () => {
      expect(strategy.repair('{name: "Alice"}')).toBe('{"name": "Alice"}');
    });
    
    it('应该处理多个键', () => {
      expect(strategy.repair('{name: "Alice", age: 25}')).toBe('{"name": "Alice", "age": 25}');
    });
  });
  
  describe('remove-comments', () => {
    const strategy = BUILTIN_REPAIR_STRATEGIES.find(s => s.name === 'remove-comments')!;
    
    it('应该移除单行注释', () => {
      const input = '{\n  "a": 1 // comment\n}';
      expect(strategy.repair(input)).not.toContain('//');
    });
    
    it('应该移除多行注释', () => {
      const input = '{/* comment */ "a": 1}';
      expect(strategy.repair(input)).not.toContain('/*');
    });
  });
});
```

---

## 6. 常见问题

### 6.1 策略执行顺序

策略按优先级从小到大执行。一旦某个策略使得文本可以成功解析，就停止执行后续策略。

### 6.2 策略失败处理

如果策略的 `repair` 函数返回 `null`，表示该策略无法修复文本，会跳过并尝试下一个策略。

### 6.3 性能影响

每个策略都会增加一定的处理时间。如果确定某些策略不需要，可以禁用它们以提高性能。

### 6.4 边缘情况

某些策略（如单引号转换）在处理复杂嵌套时可能出现问题。如果遇到问题，可以：

1. 禁用有问题的策略
2. 使用 `allowJson5: true` 来使用 JSON5 解析器
3. 实现更精细的自定义策略
