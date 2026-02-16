# Weibo App 单元测试

本目录包含微博 App 的完整单元测试套件。

## 测试结构

```
__tests__/
├── setup.ts                          # 测试配置、Mock 工厂、工具函数
├── README.md                         # 本文档
├── index.test.ts                     # 模块导出集成测试
├── types.test.ts                     # Weibo 类型定义测试
├── social-types.test.ts              # 社交类型系统工具函数测试
├── composables/
│   └── usePostDisplay.test.ts        # 帖子展示 Composable 测试
└── stores/
    ├── hotSearchStore.test.ts        # 热搜 Store 测试
    ├── feedStore.test.ts             # 信息流 Store 测试
    ├── composeStore.test.ts          # 发布/草稿 Store 测试
    ├── userActionStore.test.ts       # 用户行为 Store 测试
    └── llm/
        ├── postTransformer.test.ts   # LLM 输出转换层测试
        └── parsers/
            ├── dispatcher.test.ts    # 内容分发器测试
            ├── postParser.test.ts    # 博文解析器测试
            ├── commentParser.test.ts # 评论解析器测试
            └── hotSearchParser.test.ts # 热搜解析器测试
```

## 测试覆盖范围

### Stores 测试

| Store | 测试文件 | 覆盖功能 |
| ------- | --------- | ---------- |
| `useHotSearchStore` | `hotSearchStore.test.ts` | 热搜刷新、LLM 热搜生成应用、JSON 解析、热度计算、清除功能 |
| `useFeedStore` | `feedStore.test.ts` | 信息流加载、博文获取、评论获取、点赞、关注、删除、更新 |
| `useComposeStore` | `composeStore.test.ts` | 草稿 CRUD、AI 扩展、发布博文、类型判断 |
| `useUserActionStore` | `userActionStore.test.ts` | 点赞、收藏、浏览历史、localStorage 持久化 |

### LLM 模块测试

| 模块 | 测试文件 | 覆盖功能 |
| ------ | --------- | ---------- |
| `postTransformer` | `postTransformer.test.ts` | 新旧格式转换、图片/投票/视频/转发转换、话题提取、验证 |
| `ContentDispatcher` | `dispatcher.test.ts` | 解析器注册、别名、拓扑排序、JSON 解析、错误处理 |
| `PostParser` | `postParser.test.ts` | 博文验证、转换、tempId 映射、账号创建、持久化 |
| `CommentParser` | `commentParser.test.ts` | 评论验证、postId 解析、账号复用、持久化 |
| `HotSearchParser` | `hotSearchParser.test.ts` | 热搜验证、keyword 格式化、baseScore 计算、持久化 |

### Composables 测试

| Composable | 测试文件 | 覆盖功能 |
| ------------ | --------- | ---------- |
| `usePostDisplay` | `usePostDisplay.test.ts` | 类型解析、话题高亮、投票/视频/转发检测、选项归一化 |

### 类型测试

| 测试文件 | 覆盖范围 |
| --------- | ---------- |
| `types.test.ts` | 认证类型配置、getVerifyTypeConfig |
| `social-types.test.ts` | ContentFlags、Stats、primaryType 判断、媒体转换、时间格式化 |

## 运行测试

```bash
# 运行所有 Weibo 测试
npx vitest run src/apps/weibo

# 运行特定测试文件
npx vitest run src/apps/weibo/__tests__/stores/hotSearchStore.test.ts

# 监听模式
npx vitest src/apps/weibo

# 生成覆盖率报告
npx vitest run src/apps/weibo --coverage
```

## Mock 策略

### 数据库 Mock

使用 `vi.mock('@/services/database')` 模拟 IndexedDB 操作：

```typescript
const mockDb = {
  socialPosts: {
    add: vi.fn().mockResolvedValue('post_id'),
    get: vi.fn().mockResolvedValue(mockPost),
    toArray: vi.fn().mockResolvedValue([...mockPosts]),
  },
};
```

### 服务 Mock

- `accountService`: 账号创建、查询
- `TrendService`: 热搜获取
- `TrafficEngine`: 热度计算
- `AIStore`: LLM 请求

### localStorage Mock

使用 `createMockLocalStorage()` 创建内存存储：

```typescript
const mockLocalStorage = createMockLocalStorage();
vi.stubGlobal('localStorage', mockLocalStorage);
```

## 测试工具函数

### setup.ts 提供的工具

```typescript
// 创建 Mock 数据
create MockPost(overrides?)         // 创建 UniversalPost
createMockDisplayPost(overrides?)  // 创建 DisplayPost
createMockHotSearchItem(overrides?) // 创建热搜项
createMockDraft(overrides?)        // 创建草稿
createMockLegacyLLMOutput(overrides?) // 创建旧格式 LLM 输出
createMockNewLLMOutput(overrides?)    // 创建新格式 LLM 输出

// 创建 Mock 服务
createMockDB()                      // 创建模拟数据库
createMockAccountService()          // 创建模拟账号服务
createMockLocalStorage()            // 创建模拟 localStorage

// 工具函数
setupTestPinia()                    // 初始化测试 Pinia
flushPromises()                     // 等待异步操作
```

## 编写新测试指南

### 1. Store 测试模板

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

// Mock 依赖
vi.mock('@/services/database', () => ({ db: mockDb }));

import { useMyStore } from '../../stores/myStore';

describe('myStore', () => {
  let store: ReturnType<typeof useMyStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    store = useMyStore();
    vi.clearAllMocks();
  });

  describe('功能组', () => {
    it('应...', () => {
      // 测试逻辑
    });
  });
});
```

### 2. 解析器测试模板

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ParseContext } from '../../../../stores/llm/parsers/types';

describe('MyParser', () => {
  const createMockContext = (): ParseContext => ({
    taskId: 'test_task_id',
    platformId: 'weibo',
    timestamp: Date.now(),
    log: vi.fn(),
    resolved: {
      posts: new Map(),
      users: new Map(),
      hotSearches: new Map(),
      comments: new Map(),
    },
  });

  describe('validate', () => { ... });
  describe('transform', () => { ... });
  describe('persist', () => { ... });
});
```

## 注意事项

1. **Mock 顺序**: `vi.mock()` 必须在 import 被测模块之前
2. **Pinia 初始化**: 每个测试前需要 `setActivePinia(createPinia())`
3. **清理 Mock**: 使用 `vi.clearAllMocks()` 确保测试隔离
4. **异步测试**: 使用 `async/await` 或返回 Promise
5. **类型安全**: 使用 `as any` 处理部分 mock 数据的类型问题
