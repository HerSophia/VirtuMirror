# 设计决策

## 1. 任务实例持久化

**决策**：✅ **IndexedDB 持久化**

| 方案 | 优点 | 缺点 |
| --------------- | ---------------- | -------------- |
| 内存 | 简单、无迁移成本 | 刷新后丢失状态 |
| **IndexedDB** ✅ | 持久化、可恢复 | 需要数据迁移 |
| 混合 | 折中 | 逻辑复杂 |

### 实施要点

* 在 `db.ts` 中新增 `llmTasks` 表
* 任务状态变更时自动同步到数据库
* 应用启动时从数据库恢复任务实例
* 自动执行任务的定时器需要重新调度

```typescript
// src/services/database/schema.ts
interface LLMTaskRecord {
  id: string;
  definitionId: string;
  appId: string;
  status: LLMTaskStatus;
  input: Record<string, any>;
  config: LLMTaskConfig;
  autoConfig?: AutoExecutionConfig;
  output?: string;
  outputHistory?: OutputHistoryEntry[];
  totalExecutions: number;
  createdAt: number;
  updatedAt: number;
}
```

---

## 2. 任务定义的动态更新

**决策**：✅ **自动更新**

| 方案 | 说明 |
| -------------- | ---------------------------- |
| 不更新 | 任务实例保持创建时的定义 |
| **自动更新** ✅ | 定义变更后自动同步到实例 |
| 提示更新 | 检测到定义变更，提示用户选择 |

### 实施要点

* 保留用户的运行时状态（执行次数、输出历史）
* 更新定义部分（name、description、promptTemplate、inputSchema）
* 合并输入：保留用户已填的值，添加新字段的默认值

```typescript
function syncTaskWithDefinition(task: LLMTask, definition: LLMTaskDefinition): LLMTask {
  return {
    ...task,
    // 更新定义相关字段
    name: definition.name,
    description: definition.description,
    // 合并输入（保留用户值）
    input: {
      ...definition.defaultInput,
      ...task.input,
    },
    // 保留运行时状态
    totalExecutions: task.totalExecutions,
    outputHistory: task.outputHistory,
  };
}
```

---

## 3. 跨 App 上下文共享

**决策**：✅ **发布-订阅模式**

* 上下文提供器：App 可选择将内容**发布**为全局可用
* 其他 App：可**订阅**已发布的上下文
* 通过中心化的系统服务实现

### 基本规则

| 扩展点 | 跨 App 共享 | 说明 |
| --------------- | ----------- | --------------------------- |
| ContextProvider | ✅ 可选发布 | App 主动发布，其他 App 订阅 |
| OutputHandler | ❌ 不允许 | 数据写入是 App 特定的 |

> 详细设计参见 [上下文共享服务](./context-sharing.md)。

---

## 4. ID 命名规范

**决策**：使用 `appId:resourceId` 格式

```typescript
// 任务定义
'weibo:generate-post'
'forum:generate-reply'

// 上下文提供器
'weibo:narrative'
'system:time'

// 输出处理器
'weibo:post-handler'
'forum:reply-handler'
```

### 好处

* **命名空间隔离**：不同 App 的资源不会冲突
* **易于查询**：可以按 App 过滤资源
* **自文档化**：从 ID 就能看出归属

---

## 5. 变量替换语法

**决策**：使用 Handlebars 风格语法

```text
{{variable}}           - 简单变量
{{#if condition}}...{{/if}} - 条件块
{{#each items}}...{{/each}} - 循环块
```

### 优点

* 广泛使用，开发者熟悉
* 支持条件和循环逻辑
* 与现有提示词模板兼容

---

## 6. 单例 vs 依赖注入

**决策**：服务使用**单例模式**

```typescript
// 获取服务实例
const service = getLLMTaskService();
```

### 理由

* **简单**：无需配置 DI 容器
* **性能**：避免重复初始化
* **一致性**：全局共享状态

### 权衡

* 测试时需要 mock 全局实例
* 可通过 `resetService()` 方法支持测试

---

## 7. 错误处理策略

**决策**：**分层处理**

| 层级 | 策略 |
| ------------------------- | -------------------------------- |
| TaskExecutor | 捕获并记录错误，更新任务状态 |
| OutputHandler | 返回 `{ success: false, error }` |
| Context空对象，不阻断执行 |
| UI | 显示错误提示，支持重试 |

```typescript
// OutputHandler 错误处理示例
async handle(output, task, context): Promise<OutputHandlerResult> {
  try {
    const data = JSON.parse(output);
    // ...
    return { success: true, data };
  } catch (error: any) {
    context.addLog('error', `解析失败: ${error.message}`);
    return {
      success: false,
      error: error.message,
    };
  }
}
```

---

## 8. 执行优先级

**决策**：复用 AI 服务的 `RequestPriority`

```typescript
enum RequestPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3,
}
```

任务定义可指定默认优先级，运行时可覆盖。
