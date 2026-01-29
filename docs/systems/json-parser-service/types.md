# JSON Parser Service - 类型定义

## 1. 核心接口

### 1.1 服务接口

```typescript
// src/services/jsonParser/types.ts

/**
 * JSON 解析服务接口
 */
export interface JsonParserService {
  // ==================== 解析方法 ====================
  
  /**
   * 安全解析 JSON（不抛异常）
   * @param text 待解析文本
   * @param options 解析选项
   * @returns 解析结果
   */
  parse<T = unknown>(text: string, options?: ParseOptions): ParseResult<T>;
  
  /**
   * 严格解析 JSON（失败时抛异常）
   * @param text 待解析文本
   * @param options 解析选项
   * @throws JsonParseError
   */
  parseStrict<T = unknown>(text: string, options?: ParseOptions): T;
  
  /**
   * 带类型验证的解析
   * @param text 待解析文本
   * @param validator 类型守卫函数
   * @param options 解析选项
   */
  parseWithValidator<T>(
    text: string,
    validator: (data: unknown) => data is T,
    options?: ParseOptions
  ): ParseResult<T>;
  
  // ==================== 提取方法 ====================
  
  /**
   * 从混合文本中提取第一个 JSON
   * @returns JSON 字符串，未找到返回 null
   */
  extractJson(text: string): string | null;
  
  /**
   * 从混合文本中提取所有 JSON 块
   */
  extractAllJson(text: string): string[];
  
  // ==================== 修复方法 ====================
  
  /**
   * 尝试修复 JSON 字符串
   */
  repair(text: string): string;
  
  /**
   * 清理 Markdown 代码块标记
   */
  cleanMarkdown(text: string): string;
  
  // ==================== 配置方法 ====================
  
  /**
   * 注册自定义修复策略
   */
  registerRepairStrategy(strategy: RepairStrategy): void;
  
  /**
   * 获取解析统计
   */
  getStats(): ParserStats;
  
  /**
   * 重置统计
   */
  resetStats(): void;
}
```

---

## 2. 配置类型

### 2.1 解析选项

```typescript
/**
 * 解析选项
 */
export interface ParseOptions {
  /**
   * 允许 JSON5 语法
   * 包括：注释、尾逗号、单引号、无引号键名等
   * @default true
   */
  allowJson5?: boolean;
  
  /**
   * 允许尾部逗号（仅在 allowJson5 为 false 时单独生效）
   * @default false
   */
  allowTrailingComma?: boolean;
  
  /**
   * 允许单引号字符串（仅在 allowJson5 为 false 时单独生效）
   * @default false
   */
  allowSingleQuotes?: boolean;
  
  /**
   * 允许注释（仅在 allowJson5 为 false 时单独生效）
   * @default false
   */
  allowComments?: boolean;
  
  /**
   * 解析失败时自动尝试修复
   * @default true
   */
  autoRepair?: boolean;
  
  /**
   * 从 Markdown 代码块中提取 JSON
   * @default true
   */
  extractFromCodeBlock?: boolean;
  
  /**
   * 从混合文本中提取 JSON
   * @default true
   */
  extractFromText?: boolean;
  
  /**
   * 解析失败时返回的默认值
   * 设置后，失败不会返回 success: false，而是返回默认值
   */
  defaultValue?: unknown;
  
  /**
   * 启用解析日志（用于调试）
   * @default false
   */
  enableLogging?: boolean;
}
```

### 2.2 默认选项

```typescript
/**
 * 默认解析选项
 */
export const DEFAULT_PARSE_OPTIONS: Required<Omit<ParseOptions, 'defaultValue'>> = {
  allowJson5: true,
  allowTrailingComma: false,
  allowSingleQuotes: false,
  allowComments: false,
  autoRepair: true,
  extractFromCodeBlock: true,
  extractFromText: true,
  enableLogging: false,
};
```

---

## 3. 结果类型

### 3.1 解析结果

```typescript
/**
 * 解析结果
 */
export interface ParseResult<T> {
  /** 是否成功 */
  success: boolean;
  
  /** 解析后的数据（成功时存在） */
  data?: T;
  
  /** 错误信息（失败时存在） */
  error?: string;
  
  /** 是否经过修复 */
  repaired?: boolean;
  
  /** 使用的修复策略名称 */
  repairStrategy?: string;
  
  /** 修复过程中的警告信息 */
  warnings?: string[];
  
  /** 原始输入文本（用于调试） */
  originalText?: string;
  
  /** 处理后的文本（用于调试） */
  processedText?: string;
}
```

### 3.2 统计信息

```typescript
/**
 * 解析统计
 */
export interface ParserStats {
  /** 总解析次数 */
  totalParses: number;
  
  /** 成功次数 */
  successCount: number;
  
  /** 失败次数 */
  failureCount: number;
  
  /** 经过修复的次数 */
  repairCount: number;
  
  /** 各修复策略使用次数 */
  repairStrategyUsage: Record<string, number>;
  
  /** 错误类型统计 */
  errorTypes: Record<string, number>;
}
```

---

## 4. 修复策略类型

### 4.1 策略接口

```typescript
/**
 * 修复策略
 */
export interface RepairStrategy {
  /** 策略名称（唯一标识） */
  name: string;
  
  /** 策略描述 */
  description?: string;
  
  /**
   * 优先级（越小越先执行）
   * 建议范围：10-100
   * - 10-30: 简单提取
   * - 30-60: 格式修复
   * - 60-90: 复杂修复
   */
  priority: number;
  
  /**
   * 修复函数
   * @param text 待修复的文本
   * @returns 修复后的文本，无法修复返回 null
   */
  repair: (text: string) => string | null;
  
  /**
   * 是否启用
   * @default true
   */
  enabled?: boolean;
}
```

### 4.2 内置策略名称

```typescript
/**
 * 内置修复策略名称
 */
export type BuiltinStrategyName =
  | 'extract-boundaries'
  | 'remove-trailing-commas'
  | 'single-to-double-quotes'
  | 'quote-unquoted-keys'
  | 'remove-comments'
  | 'fix-escape-sequences';
```

---

## 5. 错误类型

```typescript
/**
 * JSON 解析错误
 */
export class JsonParseError extends Error {
  /** 错误名称 */
  readonly name = 'JsonParseError';
  
  /** 原始输入文本 */
  readonly originalText: string;
  
  /** 原始错误 */
  readonly cause?: Error;
  
  constructor(
    message: string,
    originalText: string,
    cause?: Error
  ) {
    super(message);
    this.originalText = originalText;
    this.cause = cause;
  }
}
```

---

## 6. 工具类型

```typescript
/**
 * 类型守卫函数
 */
export type TypeGuard<T> = (data: unknown) => data is T;

/**
 * 深度部分类型
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
```

---

## 7. 使用示例

### 7.1 带类型验证的解析

```typescript
interface UserData {
  id: number;
  name: string;
  email: string;
}

// 类型守卫
function isUserData(data: unknown): data is UserData {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof (data as UserData).id === 'number' &&
    typeof (data as UserData).name === 'string' &&
    typeof (data as UserData).email === 'string'
  );
}

// 使用
const result = parser.parseWithValidator(text, isUserData);
if (result.success) {
  // result.data 的类型是 UserData
  console.log(result.data.name);
}
```

### 7.2 自定义修复策略

```typescript
const myStrategy: RepairStrategy = {
  name: 'fix-nan-values',
  description: '将 NaN 替换为 null',
  priority: 55,
  repair: (text) => {
    if (!text.includes('NaN')) return null;
    return text.replace(/\bNaN\b/g, 'null');
  },
};

parser.registerRepairStrategy(myStrategy);
```
