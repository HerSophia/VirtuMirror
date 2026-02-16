# 测试指南

## 测试策略概览

```text
┌─────────────────────────────────────────────────────────────────────┐
│                          测试金字塔                                   │
│                                                                      │
│                           ┌─────┐                                    │
│                          │ E2E │  少量集成测试                        │
│                         ┌┴─────┴┐                                    │
│                        │ 集成测试 │  Bridge + Service                 │
│                       ┌┴────────┴┐                                   │
│                      │  单元测试   │  大量覆盖边缘情况                  │
│                     └─────────────┘                                  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 1. SessionContextService 单元测试

### 1.1 初始状态测试

| 测试用例 | 预期结果 |
| ---------- | ---------- |
| 服务初始化后的 context | `sessionId: null, messageId: null, swipeId: null` |
| 服务初始化后的 isConnected | `false` |
| 初始状态调用 getContext() | 返回所有字段为 null 的对象 |
| 初始状态调用 getCurrentSourceTracking() | 返回 `undefined` |

### 1.2 updateContext 测试

| 测试用例 | 输入 | 预期结果 |
| ---------- | ------ | ---------- |
| 更新单个字段 | `{ sessionId: 'abc' }` | 只有 sessionId 变化，其他保持 null |
| 更新多个字段 | `{ sessionId: 'abc', messageId: 10 }` | 两个字段都更新 |
| 部分字段为 undefined | `{ sessionId: 'abc', messageId: undefined }` | 只更新 sessionId，messageId 保持原值 |
| 更新为 null | `{ sessionId: null }` | sessionId 变为 null |
| 空对象 | `{}` | 状态不变 |
| 连续更新 | 多次调用 | 最终状态正确累积 |

### 1.3 isConnected 联动测试

| 测试用例 | 操作 | 预期 isConnected |
| ---------- | ------ | ------------------ |
| 设置有效 sessionId | `updateContext({ sessionId: 'abc' })` | `true` |
| 设置 sessionId 为 null | `updateContext({ sessionId: null })` | `false` |
| 设置 sessionId 为空字符串 | `updateContext({ sessionId: '' })` | `false`（空字符串视为无效） |
| 清空上下文 | `clearContext()` | `false` |
| 只更新其他字段 | `updateContext({ messageId: 10 })` | 保持原值 |

### 1.4 clearContext 测试

| 测试用例 | 前置状态 | 预期结果 |
| ---------- | ---------- | ---------- |
| 清空有数据的上下文 | 所有字段有值 | 所有字段变为 null/undefined |
| 清空空上下文 | 已经是空 | 状态不变，不报错 |
| 清空后 isConnected | 有连接 | `false` |
| 清空后 getCurrentSourceTracking | 有连接 | `undefined` |

### 1.5 getCurrentSourceTracking 测试

| 测试用例 | 上下文状态 | 预期返回 |
| ---------- | ------------ | ---------- |
| 无 sessionId | `{ sessionId: null }` | `undefined` |
| 只有 sessionId | `{ sessionId: 'abc', messageId: null }` | `{ sessionId: 'abc', generatedAt: ... }` |
| 完整上下文 | 所有字段有值 | 包含所有字段 |
| messageId 为 0 | `{ messageId: 0 }` | 包含 `sourceMessageId: 0`（0 是有效值） |
| swipeId 为 0 | `{ swipeId: 0 }` | 包含 `sourceSwipeId: 0`（0 是有效值） |
| generatedAt 时间戳 | 任意 | 接近当前时间（误差 < 100ms） |

---

## 2. buildSourceFilter 测试

### 2.1 'all' 模式测试

| 测试用例 | 记录 | 预期结果 |
| ---------- | ------ | ---------- |
| 任意记录 | `{ source: { sessionId: 'any' } }` | `true` |
| 无 source 记录 | `{}` | `true` |
| 空 source | `{ source: {} }` | `true` |
| null source | `{ source: null }` | `true` |

### 2.2 'session' 模式 - 基础过滤

| 测试用例 | 当前上下文 | 记录 | 预期 |
| ---------- | ------------ | ------ | ------ |
| 匹配的 sessionId | `{ sessionId: 'abc' }` | `{ source: { sessionId: 'abc' } }` | `true` |
| 不匹配的 sessionId | `{ sessionId: 'abc' }` | `{ source: { sessionId: 'xyz' } }` | `false` |
| 记录无 source | `{ sessionId: 'abc' }` | `{}` | `true`（历史数据兼容） |
| 记录 source 无 sessionId | `{ sessionId: 'abc' }` | `{ source: {} }` | `true`（兼容） |
| 上下文无 sessionId | `{ sessionId: null }` | `{ source: { sessionId: 'abc' } }` | `true`（不过滤） |

### 2.3 'session' 模式 - 边缘情况

| 测试用例 | 场景 | 预期 |
| ---------- | ------ | ------ |
| sessionId 为空字符串 | 上下文 `sessionId: ''` | 视为无 session，不过滤 |
| 记录 sessionId 为空字符串 | 记录 `source.sessionId: ''` | 需要明确定义行为 |
| 特殊字符 sessionId | `sessionId: 'a/b:c'` | 正常匹配 |
| 超长 sessionId | 256+ 字符 | 正常匹配 |
| Unicode sessionId | 中文/emoji | 正常匹配 |

### 2.4 'message' 模式测试

| 测试用例 | 当前 messageId | 记录 sourceMessageId | 预期 |
| ---------- | ---------------- | --------------------- | ------ |
| 相等 | 10 | 10 | `true` |
| 记录更小 | 10 | 5 | `true` |
| 记录更大 | 10 | 15 | `false` |
| 记录为 0 | 10 | 0 | `true`（0 是有效楼层） |
| 当前为 0 | 0 | 0 | `true` |
| 当前为 0，记录为 1 | 0 | 1 | `false` |
| 记录无 messageId | 10 | undefined | `true`（兼容） |
| 当前无 messageId | null | 10 | `true`（退化为 session 模式） |
| 负数 messageId | 10 | -1 | 需要明确定义（理论上不应存在） |

### 2.5 'swipe' 模式测试 - 非最后楼层

| 测试用例 | 当前 msg/swipe | 记录 msg/swipe | 预期 |
| ---------- | ---------------- | ---------------- | ------ |
| 早期楼层，任意 swipe | 10/0 | 5/99 | `true`（已固化） |
| 早期楼层，无 swipeId | 10/0 | 5/undefined | `true` |

### 2.6 'swipe' 模式测试 - 最后楼层

| 测试用例 | 当前 msg/swipe | 记录 msg/swipe | 预期 |
| ---------- | ---------------- | ---------------- | ------ |
| 匹配 | 10/2 | 10/2 | `true` |
| swipeId 不匹配 | 10/2 | 10/0 | `false` |
| swipeId 不匹配 | 10/2 | 10/3 | `false` |
| 记录无 swipeId | 10/2 | 10/undefined | `true`（兼容） |
| swipeId 为 0 | 10/0 | 10/0 | `true` |
| 当前 swipeId 为 null | 10/null | 10/0 | `true`（退化） |

### 2.7 'swipe' 模式测试 - 未来楼层

| 测试用例 | 当前 msg/swipe | 记录 msg/swipe | 预期 |
| ---------- | ---------------- | ---------------- | ------ |
| 未来楼层 | 10/0 | 15/0 | `false`（理论上不应存在） |

### 2.8 过滤器组合测试

| 测试用例 | 场景 | 预期 |
| ---------- | ------ | ------ |
| session 通过但 message 不通过 | `mode='message'`，sessionId 匹配但 messageId 超前 | `false` |
| session 不通过 | `mode='swipe'`，sessionId 不匹配 | `false`（在 session 层就被过滤） |
| 多重 undefined | source 存在但所有字段都是 undefined | 根据模式决定 |

---

## 3. 响应式行为测试

### 3.1 context 响应式

| 测试用例 | 操作 | 预期 |
| ---------- | ------ | ------ |
| watch 监听触发 | updateContext | watch 回调被调用 |
| computed 自动更新 | updateContext | computed 值更新 |
| 多次快速更新 | 连续 updateContext | 最终状态正确 |
| 批量更新 | 一次 updateContext 多字段 | 只触发一次响应 |

### 3.2 isConnected 响应式

| 测试用例 | 操作 | 预期 |
| ---------- | ------ | ------ |
| 从 false 到 true | 设置有效 sessionId | watch 被触发 |
| 从 true 到 false | clearContext | watch 被触发 |
| 保持 true | 更新 messageId（sessionId 不变） | watch 不触发 |

---

## 4. Bridge 集成测试

### 4.1 事件监听初始化

| 测试用例 | 场景 | 预期 |
| ---------- | ------ | ------ |
| 正常初始化 | 首次调用 initSessionContextListeners | 成功，无警告 |
| 重复初始化 | 再次调用 | 跳过，输出警告 |
| 销毁后重新初始化 | destroy 后再 init | 成功 |

### 4.2 sync 事件处理

| 测试用例 | 事件数据 | 预期上下文 |
| ---------- | ---------- | ------------ |
| 完整数据 | 所有字段 | 所有字段更新 |
| 部分数据 | 只有 sessionId | 只更新 sessionId |
| 空数据 | `{}` | 不变 |
| null 字段 | `{ sessionId: null }` | sessionId 变为 null |

### 4.3 swipe_changed 事件处理

| 测试用例 | 事件数据 | 预期 |
| ---------- | ---------- | ------ |
| 正常切换 | `{ messageId: 10, newSwipeId: 2 }` | 更新对应字段 |
| swipeId 为 0 | `{ newSwipeId: 0 }` | 正常更新为 0 |
| 缺少字段 | `{ messageId: 10 }` | 只更新 messageId |

### 4.4 disconnect 事件处理

| 测试用例 | 前置状态 | 预期 |
| ---------- | ---------- | ------ |
| 正常断开 | 已连接 | 上下文清空，isConnected 变 false |
| 已经断开 | 未连接 | 状态不变，不报错 |

### 4.5 事件顺序测试

| 测试用例 | 事件序列 | 预期 |
| ---------- | ---------- | ------ |
| 快速连续 sync | sync → sync → sync | 最终状态是最后一个 |
| sync 后立即 disconnect | sync → disconnect | 上下文清空 |
| disconnect 后 sync | disconnect → sync | 上下文恢复 |
| swipe_changed 在 disconnect 后 | disconnect → swipe_changed | 可以更新（或应该忽略？需要明确） |

---

## 5. 并发与时序测试

### 5.1 快速状态变更

| 测试用例 | 场景 | 预期 |
| ---------- | ------ | ------ |
| 连续 10 次 updateContext | 同步调用 | 最终状态正确 |
| 并发 Promise.all | 多个异步更新 | 最终状态是某个有效状态 |
| 更新期间读取 | updateContext 同时 getContext | 不会读到中间状态 |

### 5.2 过滤器闭包

| 测试用例 | 场景 | 预期 |
| ---------- | ------ | ------ |
| 创建过滤器后上下文变化 | buildSourceFilter → updateContext → filter() | 使用创建时的上下文（闭包捕获） |
| 每次调用创建新过滤器 | 多次 buildSourceFilter | 各自独立 |

---

## 6. 数据边界测试

### 6.1 极端值

| 测试用例 | 输入 | 预期 |
| ---------- | ------ | ------ |
| messageId 为 Number.MAX_SAFE_INTEGER | 极大值 | 正常处理 |
| messageId 为 0 | 最小有效值 | 正常处理 |
| messageId 为负数 | -1 | 需要定义行为（报错或忽略） |
| messageId 为小数 | 10.5 | 需要定义行为（截断或报错） |
| sessionId 超长 | 10000 字符 | 正常处理 |
| sessionId 包含特殊字符 | `\n\t\0` | 正常处理 |

### 6.2 类型错误

| 测试用例 | 输入 | 预期 |
| ---------- | ------ | ------ |
| sessionId 为数字 | `{ sessionId: 123 }` | TypeScript 报错 / 运行时处理 |
| messageId 为字符串 | `{ messageId: '10' }` | TypeScript 报错 / 运行时处理 |
| source 为数组 | `{ source: [] }` | 需要定义行为 |

---

## 7. 内存与性能测试

### 7.1 内存泄漏

| 测试用例 | 场景 | 检查项 |
| ---------- | ------ | -------- |
| 反复 init/destroy | 1000 次循环 | 内存不持续增长 |
| 大量 watch | 创建 100 个 watch 后清理 | 内存释放 |
| 创建大量过滤器 | buildSourceFilter 1000 次 | 无内存泄漏 |

### 7.2 性能基准

| 测试用例 | 操作 | 预期 |
| ---------- | ------ | ------ |
| updateContext 性能 | 10000 次调用 | < 100ms |
| buildSourceFilter 性能 | 10000 次调用 | < 100ms |
| 过滤 10000 条记录 | filter() | < 50ms |
| getCurrentSourceTracking | 10000 次调用 | < 50ms |

---

## 8. 与微博实现的兼容性测试

### 8.1 行为一致性

| 测试用例 | 微博行为 | 系统服务行为 | 是否一致 |
| ---------- | ---------- | -------------- | ---------- |
| 无 session 时的 source | undefined | undefined | ✅ |
| 历史数据过滤 | 通过 | 通过 | ✅ |
| swipe 0 处理 | 有效值 | 有效值 | ✅ |
| messageId 0 处理 | 有效值 | 有效值 | ✅ |

### 8.2 迁移测试

| 测试用例 | 场景 | 预期 |
| ---------- | ------ | ------ |
| 微博数据被系统服务过滤 | 使用微博 source 格式的数据 | 正常过滤 |
| 系统服务数据被微博过滤 | 使用系统服务 source 格式的数据 | 正常过滤 |

---

## 9. 错误恢复测试

### 9.1 异常输入

| 测试用例 | 输入 | 预期 |
| ---------- | ------ | ------ |
| updateContext(null) | null | 不崩溃，忽略或警告 |
| updateContext(undefined) | undefined | 不崩溃，忽略或警告 |
| buildSourceFilter 传入无效 mode | `'invalid'` | 退化为默认行为或报错 |

### 9.2 服务状态恢复

| 测试用例 | 场景 | 预期 |
| ---------- | ------ | ------ |
| 连接断开后重连 | disconnect → sync | 状态正确恢复 |
| 部分状态丢失 | 只收到部分 sync 数据 | 保持已有数据，更新新数据 |

---

## 10. 测试工具与 Mock

### 10.1 服务重置

```typescript
// 每个测试前重置服务状态
beforeEach(() => {
  SessionContextService.resetInstance();
});
```

### 10.2 Mock Bridge Adapter

```typescript
const mockAdapter = {
  listeners: new Map<string, Function[]>(),
  
  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
    return () => { /* cleanup */ };
  },
  
  emit(event: string, data: any) {
    this.listeners.get(event)?.forEach(cb => cb(data));
  },
};
```

### 10.3 测试数据工厂

```typescript
function createMockRecord(overrides?: Partial<Sourceable>): Sourceable {
  return {
    source: {
      sessionId: 'test-session',
      sourceMessageId: 10,
      sourceSwipeId: 0,
      generatedAt: Date.now(),
    },
    ...overrides,
  };
}

function createMockContext(overrides?: Partial<SessionContext>): SessionContext {
  return {
    sessionId: 'test-session',
    messageId: 10,
    swipeId: 0,
    characterName: 'Test Character',
    playerName: 'Test Player',
    ...overrides,
  };
}
```

---

## 11. 测试覆盖率目标

| 模块 | 行覆盖率 | 分支覆盖率 | 说明 |
| ------ | ---------- | ------------ | ------ |
| SessionContextService | > 90% | > 85% | 核心服务 |
| buildSourceFilter | > 95% | > 90% | 过滤逻辑复杂 |
| bridgeIntegration | > 80% | > 75% | 事件处理 |
| types | N/A | N/A | 纯类型定义 |

---

## 12. 测试命名规范

```typescript
describe('SessionContextService', () => {
  describe('updateContext 更新上下文', () => {
    it('传入部分字段时只更新对应字段', () => {});
    it('字段值为 undefined 时不更新该字段', () => {});
    it('设置有效 sessionId 后 isConnected 变为 true', () => {});
  });
  
  describe('buildSourceFilter 构建过滤器', () => {
    describe('session 模式', () => {
      it('sessionId 匹配时返回 true', () => {});
      it('sessionId 不匹配时返回 false', () => {});
      it('无 source 的历史数据返回 true', () => {});
    });
    
    describe('swipe 模式', () => {
      describe('非最后楼层的记录', () => {
        it('无论 swipeId 如何都返回 true', () => {});
      });
      
      describe('最后楼层的记录', () => {
        it('仅当 swipeId 匹配时返回 true', () => {});
      });
    });
  });
});
```
