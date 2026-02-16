# App 架构指南

> 本文档总结了项目中 App 开发的标准架构模式和最佳实践，基于 Chat 和 Settings 应用的成功经验。

## 目录

1. [标准目录结构](#标准目录结构)
2. [设计原则](#设计原则)
3. [组件分类](#组件分类)
4. [命名规范](#命名规范)
5. [导出模式](#导出模式)
6. [路由配置](#路由配置)
7. [Store 依赖](#store-依赖)
8. [样式规范](#样式规范)
9. [创建新 App](#创建新-app)
10. [动态配置化 App](#动态配置化-app)
11. [App 身份识别与数据隔离](#app-身份识别与数据隔离)
12. [最佳实践](#最佳实践)

---

## 标准目录结构

每个 App 应遵循以下标准目录结构：

```
src/apps/{app-name}/
├── {AppName}App.vue         # 主应用入口组件
├── index.ts                 # 统一导出入口
├── components/              # App 内共享组件
│   ├── {ComponentName}.vue  # 组件文件
│   └── index.ts             # 组件导出
├── composables/             # 组合式函数（可选）
│   ├── use{Feature}.ts      # Composable 文件
│   └── index.ts             # Composables 导出
├── views/                   # 子页面视图（可选）
│   ├── {feature}/           # 按功能域分组
│   │   ├── {ViewName}.vue   # 视图组件
│   │   └── index.ts         # 分组导出
│   └── index.ts             # 视图导出
├── sections/                # 分区组件（适用于设置类应用）
│   ├── {SectionName}.vue    # 分区组件
│   └── index.ts             # 分区导出
└── tabs/                    # 标签页组件（适用于多 Tab 应用）
    ├── {TabName}Tab.vue     # Tab 组件
    └── index.ts             # Tab 导出
```

### 目录说明

| 目录 | 用途 | 必需 |
| ------ | ------ | ------ |
| `components/` | App 内可复用的 UI 组件 | ✅ |
| `composables/` | 提取的业务逻辑和工具函数 | 可选 |
| `views/` | 子页面/子路由视图 | 可选 |
| `sections/` | 大型页面的分区组件 | 可选 |
| `tabs/` | 底部/顶部标签页内容 | 可选 |

---

## 设计原则

### 1. 组件复用 (Component Reusability)

- 将重复使用的 UI 元素提取到 `components/` 目录
- 组件应具有通用性，通过 Props 配置不同行为
- 使用插槽（Slots）提供灵活的内容定制能力

```vue
<!-- ✅ 好的做法：通用组件通过 Props 配置 -->
<ListItem
  :avatar="user.avatar"
  :title="user.name"
  :show-arrow="true"
  @click="handleClick"
/>

<!-- ❌ 避免：每个场景创建专用组件 -->
<UserListItem :user="user" />
<ContactListItem :contact="contact" />
```

### 2. 关注点分离 (Separation of Concerns)

- **组件**：负责 UI 渲染和用户交互
- **Composables**：负责可复用的业务逻辑
- **Store**：负责全局状态管理
- **Services**：负责核心业务逻辑、数据持久化和外部 API 通信

```typescript
// ✅ 好的做法：逻辑提取到 Composable
// composables/useTimeFormat.ts
export function formatListTime(timestamp: number): string {
  // 时间格式化逻辑
}

// 组件中使用
import { formatListTime } from '../composables'
const timeText = formatListTime(message.timestamp)
```

### 3. 单一职责 (Single Responsibility)

- 每个文件只负责一个明确的功能
- 大型组件拆分为多个小组件
- 避免"上帝组件"（God Component）

```
✅ 好的做法：
SettingsApp.vue (70 行，组合各 section)
├── PersonalSection.vue (负责个人设置)
├── ThemeSection.vue (负责主题设置)
└── DeviceSection.vue (负责设备设置)

❌ 避免：
SettingsApp.vue (500+ 行，包含所有逻辑)
```

### 4. 按功能分组 (Feature-based Organization)

- `views/` 目录按功能域划分子目录
- 相关文件放在一起，便于查找和维护

```
views/
├── conversation/        # 对话相关
│   └── ChatConversation.vue
├── group/              # 群组相关
│   ├── GroupCreation.vue
│   ├── GroupInvite.vue
│   └── GroupMembers.vue
└── services/           # 服务相关
    ├── ServicesPage.vue
    └── WalletPage.vue
```

### 5. 易于扩展 (Easy to Extend)

- 新增功能只需添加新文件，不修改现有代码
- 使用约定优于配置的模式

---

## 组件分类

### 1. 入口组件 (Entry Component)

主应用组件，作为 App 的根组件。

**命名**：`{AppName}App.vue`

**职责**：
- 页面整体布局
- 组合子组件
- 管理 App 级状态

**示例**：
```vue
<!-- ChatApp.vue -->
<template>
  <div class="chat-app">
    <ChatHeader :title="currentTitle" />
    <router-view v-if="hasSubRoute" />
    <template v-else>
      <component :is="currentTab" />
      <BottomNav v-model:active-tab="activeTab" />
    </template>
  </div>
</template>
```

### 2. 共享组件 (Shared Components)

App 内部复用的 UI 组件。

**位置**：`components/`

**特点**：
- 通过 Props 接收数据
- 通过 Events 传递交互
- 使用 Slots 提供定制能力
- 无业务逻辑依赖

**常见组件**：

| 组件类型 | 示例 | 用途 |
| ---------- | ------ | ------ |
| 头部组件 | `ChatHeader.vue` | 统一的导航头部 |
| 列表项组件 | `ListItem.vue` | 通用列表项 |
| 分组容器 | `SettingsGroup.vue` | 设置项分组 |
| 表单控件 | `ToggleSwitch.vue`, `SliderControl.vue` | 交互控件 |
| 导航组件 | `BottomNav.vue` | 底部/标签导航 |

### 3. 视图组件 (View Components)

作为子路由展示的页面组件。

**位置**：`views/{feature}/`

**特点**：
- 对应一个路由
- 可以依赖 Store
- 组合共享组件构建页面

### 4. 分区组件 (Section Components)

大型页面的逻辑分区。

**位置**：`sections/`

**特点**：
- 将大页面拆分为小块
- 每个分区独立管理自己的状态
- 适用于设置页、仪表盘等场景

### 5. 标签组件 (Tab Components)

多 Tab 应用的标签页内容。

**位置**：`tabs/`

**命名**：`{TabName}Tab.vue`

---

## 命名规范

### 文件命名

| 类型 | 命名规范 | 示例 |
| ------ | ---------- | ------ |
| 入口组件 | `{AppName}App.vue` | `ChatApp.vue`, `SettingsApp.vue` |
| 视图组件 | `{FeatureName}.vue` | `ChatConversation.vue`, `GroupMembers.vue` |
| 共享组件 | `{ComponentName}.vue` | `ListItem.vue`, `ChatHeader.vue` |
| 分区组件 | `{Name}Section.vue` | `PersonalSection.vue`, `ThemeSection.vue` |
| 标签组件 | `{Name}Tab.vue` | `MessagesTab.vue`, `ContactsTab.vue` |
| Composables | `use{Feature}.ts` | `useTimeFormat.ts`, `useMessageFormat.ts` |
| 导出文件 | `index.ts` | - |

### Props 命名

```typescript
// ✅ 使用 camelCase
interface Props {
  showBack?: boolean
  bgColor?: string
  iconBgColor?: string
}

// 模板中使用 kebab-case
<ChatHeader :show-back="true" :bg-color="#fff" />
```

### 事件命名

```typescript
// ✅ 使用 kebab-case 或 camelCase
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'click': []
  'tabChange': [tab: string]
}>()
```

---

## 导出模式

### 组件目录导出 (components/index.ts)

```typescript
// 导出所有组件
export { default as ChatHeader } from './ChatHeader.vue'
export { default as ListItem } from './ListItem.vue'
export { default as BottomNav } from './BottomNav.vue'

// 导出类型（如有）
export type { TabName } from './BottomNav.vue'
```

### Composables 导出 (composables/index.ts)

```typescript
// 导出 Composables
export { useTimeFormat } from './useTimeFormat'
export { useMessageFormat } from './useMessageFormat'

// 导出便捷函数
export { formatListTime, formatMessageTime } from './useTimeFormat'
export { getMessageContent, getMessagePreview } from './useMessageFormat'
```

### App 主入口导出 (index.ts)

```typescript
// 主应用组件
export { default as ChatApp } from './ChatApp.vue'

// 视图组件
export * from './views'

// 共享组件
export * from './components'

// Composables
export * from './composables'

// 类型
export type { MessageType, TabName } from './types'
```

---

## 路由配置

### 基础路由模式

```typescript
// 简单应用：单一路由
{
  path: '/settings',
  name: 'Settings',
  component: SettingsApp
}
```

### 嵌套路由模式

```typescript
// 复杂应用：嵌套路由
{
  path: '/chat',
  name: 'ChatApp',
  component: ChatApp,
  children: [
    // 动态路由
    { 
      path: ':contactId', 
      name: 'ChatConversation', 
      component: ChatConversation,
      props: true  // 将路由参数作为 props 传递
    },
    
    // 功能子页面
    { path: 'group/create', name: 'GroupCreation', component: GroupCreation },
    { path: 'group/:contactId/members', name: 'GroupMembers', component: GroupMembers },
    
    // 独立页面
    { path: 'services', name: 'Services', component: ServicesPage },
    { path: 'wallet', name: 'Wallet', component: WalletPage }
  ]
}
```

### 路由命名约定

| 类型 | 命名规范 | 示例 |
| ------ | ---------- | ------ |
| 主应用 | `{AppName}` | `ChatApp`, `Settings` |
| 子页面 | `{Feature}` | `ChatConversation`, `GroupMembers` |
| 编辑页 | `{Feature}Editor` | `ThemeEditor` |
| 详情页 | `{Feature}Detail` | `EmailDetail` |

---

## Store 依赖

### 依赖注入模式

```vue
<script setup lang="ts">
// ✅ 在组件顶层引入 Store
import { useContactStore } from '@/stores'
import { useChatStore } from '@/stores'

const contactStore = useContactStore()
const chatStore = useChatStore()
</script>
```

### 依赖关系文档化

在 App 文档中明确列出 Store 依赖：

```
Store 依赖：
├── MessagesTab → contactStore, chatStore
├── ContactsTab → contactStore
├── ChatConversation → contactStore, chatStore, stagedActionsStore
└── WalletPage → walletStore
```

### 最小依赖原则

- 组件只依赖必需的 Store
- 避免在底层组件中直接依赖 Store
- 通过 Props 传递数据，保持组件纯净

```vue
<!-- ✅ 好的做法：通过 Props 传递 -->
<ListItem :title="contact.name" :avatar="contact.avatar" />

<!-- ❌ 避免：底层组件直接依赖 Store -->
<ListItem :contact-id="contactId" />  <!-- 内部再查询 Store -->
```

---

## 样式规范

### CSS 变量使用

所有颜色应使用 CSS 变量，支持主题切换（除非特意提及，否则需要支持已经写好的全局的主题切换）：

```css
.component {
  background: var(--color-background);
  color: var(--color-text);
  border-color: var(--color-border);
}

.primary-button {
  background: var(--color-primary);
}

.danger-action {
  color: var(--color-error);
}
```

### 标准 CSS 变量

| 变量名 | 用途 |
| -------- | ------ |
| `--color-background` | 页面背景 |
| `--color-surface` | 卡片/分组背景 |
| `--color-surface-variant` | 变体表面 |
| `--color-text` | 主文字 |
| `--color-text-secondary` | 次要文字 |
| `--color-border` | 边框 |
| `--color-primary` | 主色调 |
| `--color-success` | 成功状态 |
| `--color-error` | 错误/危险 |

### Tailwind CSS + scoped

```vue
<style scoped>
.settings-item {
  @apply flex items-center justify-between p-4;
  @apply bg-[var(--color-surface)];
  @apply border-b border-[var(--color-border)];
}
</style>
```

### 样式隔离

- 每个组件使用 `scoped` CSS
- 避免全局样式污染
- 共享样式提取到独立 CSS 文件

---

## 创建新 App

### 步骤 1：创建目录结构

```bash
src/apps/{app-name}/
├── {AppName}App.vue
├── index.ts
└── components/
    └── index.ts
```

### 步骤 2：创建入口组件

```vue
<!-- {AppName}App.vue -->
<script setup lang="ts">
import { ref } from 'vue'
// 导入组件
</script>

<template>
  <div class="{app-name}-app">
    <!-- App 内容 -->
  </div>
</template>

<style scoped>
.{app-name}-app {
  @apply h-full flex flex-col;
  background: var(--color-background);
}
</style>
```

### 步骤 3：创建导出入口

```typescript
// index.ts
export { default as {AppName}App } from './{AppName}App.vue'
export * from './components'
```

### 步骤 4：配置路由

```typescript
// router/index.ts
import { {AppName}App } from '@/apps/{app-name}'

const routes = [
  // ...其他路由
  {
    path: '/{app-name}',
    name: '{AppName}',
    component: {AppName}App
  }
]
```

### 步骤 5：添加到主屏幕（可选）

在 `HomeScreen.vue` 中添加 App 图标入口。

---

## 动态配置化 App

除了标准的 Vue 组件开发模式，系统还支持通过 JSON 配置定义轻量级应用。这种方式无需重新编译打包，支持运行时动态导入，特别适合快速原型开发或简单的工具类应用。

### 核心特性

- **免编译**：基于 JSON 定义，无需构建过程。
- **动态导入**：可通过应用商店直接导入 JSON 文件安装。
- **自定义图标**：支持 Emoji、FontAwesome 或图片 URL 作为图标。
- **灵活布局**：支持列表、网格等多种内置布局。
- **身份验证**：支持多种来源的身份验证和数据隔离。
- **数据迁移**：支持版本升级时的数据结构迁移。

### 配置结构 (JSON)

```json
{
  "id": "dynamic-app-id",
  "name": "应用名称",
  "version": "1.0.0",
  "icon": {
    "type": "emoji", // 支持 emoji, fontawesome, image
    "value": "🚀",
    "color": "#FF5722",
    "backgroundColor": "#FFFFFF"
  },
  "layout": {
    "type": "list", // 支持 list, grid
    "items": [
      {
        "id": "item-1",
        "title": "列表项标题",
        "subtitle": "副标题描述",
        "icon": "fa-star",
        "action": {
          "type": "toast",
          "params": {
            "message": "点击了项目",
            "type": "success"
          }
        }
      }
    ]
  }
}
```

### 应用来源与信任级别

动态应用支持多种安装来源，每种来源有不同的信任级别：

| 来源类型 | 信任级别 | 身份验证 | 数据隔离 |
| ---------- | ---------- | ---------- | ---------- |
| 内置应用 | `full` | ✅ 编译保证 | `builtin/{appId}` |
| 官方仓库 | `repository` | ✅ 仓库签名 | `repo/{repoId}/{developerId}/{appId}` |
| 第三方仓库 | `repository` | ✅ 仓库签名 | `repo/{repoId}/{developerId}/{appId}` |
| URL 导入 | `tofu` | ⚠️ 首次信任 | `url/{domain}/{contentHash}` |
| 本地文件 | `untrusted` | ❌ 无验证 | `local/{installationId}` |

> 详细设计请参阅 [App 身份识别设计文档](../dev/app-identity-design.md)

### 适用场景

- 简单的列表或网格展示
- 静态信息展示
- 原型验证
- 需要热更新配置的工具
- 无需复杂交互逻辑的场景

---

## App 身份识别与数据隔离

为了解决 App 同名不同开发者、版本更新数据继承、恶意身份伪造等问题，系统实现了完整的身份识别与数据隔离机制。

### 核心原则

**身份验证责任在仓库层，而非应用自证。** 就像 App Store / Google Play 一样，用户信任的是商店，商店负责审核开发者。

### 分层信任模型

```
Level 0: 内置应用     → 编译时打包，完全信任
    ↓
Level 1: 官方仓库     → 仓库维护者审核，仓库签名验证
    ↓
Level 2: 第三方仓库   → 用户手动添加信任，仓库签名验证
    ↓
Level 3: URL 导入     → 首次信任(TOFU)，警告用户风险
    ↓
Level 4: 本地文件     → 无法验证，强警告，完全隔离
```

### 数据命名空间

不同来源的应用使用不同的数据命名空间，确保数据隔离：

```typescript
// 命名空间计算示例
function calculateDataNamespace(app: InstalledApp): string {
  switch (app.sourceInfo.type) {
    case 'builtin':
      return `builtin/${app.package.id}`
    case 'repository':
      return `repo/${source.repositoryId}/${developerId}/${app.package.id}`
    case 'url':
      return `url/${domain}/${contentHash.substring(0, 8)}`
    case 'local':
      return `local/${app.installationId}`
  }
}
```

### 版本与数据迁移

当应用的 `dataVersion` 变化时，系统会自动执行数据迁移：

```json
{
  "id": "my-app",
  "version": "2.0.0",
  "dataVersion": 2,
  "dataMigrations": {
    "1:2": [
      { "type": "rename", "from": "oldKey", "to": "newKey" },
      { "type": "setDefault", "field": "newField", "value": [] }
    ]
  }
}
```

支持的迁移动作：

| 动作类型 | 说明 | 示例 |
| ---------- | ------ | ------ |
| `rename` | 重命名字段 | `{ "type": "rename", "from": "old", "to": "new" }` |
| `delete` | 删除字段 | `{ "type": "delete", "fields": ["obsolete"] }` |
| `setDefault` | 设置默认值 | `{ "type": "setDefault", "field": "x", "value": 0 }` |
| `merge` | 合并多个字段 | `{ "type": "merge", "source": ["a", "b"], "target": "c" }` |
| `transform` | 数据转换 | `{ "type": "transform", "field": "x", "transformer": "intToFloat" }` |

### 安装验证流程

1. **来源检查**：确定应用来源类型
2. **签名验证**：仓库应用验证 Ed25519 签名
3. **用户提示**：根据信任级别显示相应警告
4. **数据隔离**：计算并分配数据命名空间
5. **迁移检查**：如果是更新，检查是否需要数据迁移

> 完整的类型定义和实现细节请参阅 [App 身份识别设计文档](../dev/app-identity-design.md)

---

## 最佳实践

### ✅ 推荐做法

1. **组件粒度适中**
   - 单个组件 100-300 行为宜
   - 超过 300 行考虑拆分

2. **Props 设计**
   - 提供合理的默认值
   - 使用 TypeScript 定义类型
   - 避免过多 Props（超过 10 个考虑重构）

3. **事件设计**
   - 使用 `update:modelValue` 支持 v-model
   - 事件名称清晰表达意图

4. **插槽使用**
   - 为常见定制场景提供命名插槽
   - 提供默认插槽内容

5. **文档维护**
   - 每个 App 创建对应的 `docs/apps/{app-name}.md`
   - 记录组件 Props、Events、Slots
   - 记录依赖关系

### ❌ 避免做法

1. **过度抽象**
   - 不要为只用一次的代码创建组件
   - 不要过早优化

2. **循环依赖**
   - 避免组件间循环引用
   - 避免 Store 间循环依赖

3. **直接操作 DOM**
   - 优先使用 Vue 响应式系统
   - 必要时使用 `ref` 和生命周期钩子

4. **硬编码**
   - 颜色使用 CSS 变量
   - 配置项提取到常量或配置文件

---

## 参考示例

- **Home 应用**：桌面即 App 设计、图标位置管理 → [home.md](./home.md)
- **Chat 应用**：多 Tab、嵌套路由、Composables 使用 → [chat.md](./chat.md)
- **Settings 应用**：分区组件、表单控件复用 → [settings.md](./settings.md)
- **App 身份识别**：身份验证、数据隔离、版本迁移 → [app-identity-design.md](../dev/app-identity-design.md)

---

## 检查清单

创建新 App 时，确认以下事项：

- [ ] 目录结构符合规范
- [ ] 入口组件命名为 `{AppName}App.vue`
- [ ] 创建了 `index.ts` 导出文件
- [ ] 共享组件放在 `components/` 目录
- [ ] 组件使用 CSS 变量而非硬编码颜色
- [ ] 路由已配置
- [ ] Store 依赖已明确
 ] 创建了对应的文档 `docs/apps/{app-name}.md`
- [ ] 动态应用已配置正确的 `dataVersion`
- [ ] 如需数据迁移，已定义 `dataMigrations`