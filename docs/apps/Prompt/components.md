# 组件说明

## 共享组件

### PromptCard

提示词展示卡片，用于列表页中展示单个提示词。

**路径**: `src/apps/prompts/components/PromptCard.vue`

**Props**:

| 属性 | 类型 | 说明 |
| :----- | :----- | :----- |
| `prompt` | `PromptTemplate` | 提示词数据 |

**Events**:

| 事件 | 参数 | 说明 |
| :----- | :----- | :----- |
| `edit` | `PromptTemplate` | 点击编辑按钮 |
| `toggle` | `PromptTemplate` | 切换启用状态 |
| `reset` | `string` (id) | 重置为默认值 |
| `delete` | `string` (id) | 删除提示词 |
| `duplicate` | `string` (id) | 复制提示词 |
| `view` | `PromptTemplate` | 点击卡片查看详情 |

**使用示例**:

```vue
<PromptCard
  :prompt="prompt"
  @edit="onEdit"
  @toggle="handleToggle"
  @reset="handleReset"
  @delete="handleDelete"
  @duplicate="handleDuplicate"
  @view="onView"
/>
```

---

### PromptAddDialog

新建提示词对话框。

**路径**: `src/apps/prompts/components/PromptAddDialog.vue`

**Events**:

| 事件 | 参数 | 说明 |
| :----- | :----- | :----- |
| `save` | `Omit<PromptTemplate, 'id' \ | ...>` | 保存新提示词 |
| `close` | - | 关闭对话框 |

**功能特性**:

- 三个标签页：基本信息、提示词模板、变量定义
- 快速模板：内置「聊天回复」「内容生成」模板
- 变量提示：显示已定义的变量列表

**使用示例**:

```vue
<PromptAddDialog
  v-if="showAddDialog"
  @save="onAdd"
  @close="showAddDialog = false"
/>
```

---

### PromptEditDialog

编辑提示词对话框。

**路径**: `src/apps/prompts/components/PromptEditDialog.vue`

**Props**:

| 属性 | 类型 | 说明 |
| :----- | :----- | :----- |
| `prompt` | `PromptTemplate` | 要编辑的提示词 |

**Events**:

| 事件 | 参数 | 说明 |
| :----- | :----- | :----- |
| `save` | `PromptTemplate` | 保存修改 |
| `close` | - | 关闭对话框 |

**权限控制**:

根据 `PromptService.isPromptEditable()` 自动禁用不可编辑的字段。

---

### VariableEditor

变量定义编辑器，用于编辑提示词的可用变量列表。

**路径**: `src/apps/prompts/components/VariableEditor.vue`

**Props**:

| 属性 | 类型 | 说明 |
| :----- | :----- | :----- |
| `variables` | `PromptVariable[]` | 变量列表 |
| `disabled` | `boolean` | 是否禁用编辑 |

**Events**:

| 事件 | 参数 | 说明 |
| :----- | :----- | :----- |
| `update` | `PromptVariable[]` | 变量列表更新 |

**支持的变量类型**:

| 类型 | 说明 |
| :----- | :----- |
| `string` | 文本 |
| `number` | 数字 |
| `boolean` | 布尔值 |
| `array` | 数组 |

**使用示例**:

```vue
<VariableEditor
  :variables="formData.availableVariables"
  :disabled="!canEditField('availableVariables')"
  @update="handleVariablesUpdate"
/>
```

---

## Composables

### usePromptActions

提示词 CRUD 操作的逻辑复用 hook。

**路径**: `src/apps/prompts/composables/usePromptActions.ts`

**参数**:

| 参数 | 类型 | 说明 |
| :----- | :----- | :----- |
| `refreshCallback` | `() => void` | 操作完成后的刷新回调 |

**返回值**:

| 方法 | 说明 |
| :----- | :----- |
| `handleToggle(prompt)` | 切换提示词启用状态 |
| `handleReset(id)` | 重置提示词为默认值（带确认） |
| `handleDelete(id)` | 删除提示词（带确认） |
| `handleDuplicate(id)` | 复制提示词 |
| `handleExport()` | 导出所有配置为 JSON |
| `handleImport()` | 导入 JSON 配置文件 |

**使用示例**:

```typescript
import { usePromptActions } from '../composables/usePromptActions';

const { 
  handleToggle, 
  handleDelete, 
  handleReset, 
  handleDuplicate,
  handleExport,
  handleImport
} = usePromptActions(() => loadData());
```

---

## 视图组件

### PromptsHome

首页视图，提供统计入口和快捷操作。

**路径**: `src/apps/prompts/views/PromptsHome.vue`

**特性**:
- 统计卡片：全部、我的、提示词链、系统提示词
- 快捷操作列表
- App 注册分组展示
- 帮助对话框（三个标签页）
- 搜索入口

---

### PromptsList

列表页视图，展示特定 scope 下的提示词。

**路径**: `src/apps/prompts/views/PromptsList.vue`

**Props**:

| 属性 | 类型 | 说明 |
| :----- | :----- | :----- |
| `scope` | `string` | 筛选范围 |

---

### PromptDetail

详情页视图，查看和测试提示词。

**路径**: `src/apps/prompts/views/PromptDetail.vue`

**特性**:
- 基本信息展示
- 模板内容预览
- 变量表单自动生成
- 渲染预览
- AI 生成测试（使用 `AIStore`）
- 取消生成功能
