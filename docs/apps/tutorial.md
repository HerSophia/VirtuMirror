# Tutorial 教程应用

> 为用户提供小手机使用帮助和教程的应用，支持 Markdown 内容渲染。

## 目录

1. [功能概述](#功能概述)
2. [目录结构](#目录结构)
3. [组件说明](#组件说明)
4. [数据结构](#数据结构)
5. [路由配置](#路由配置)
6. [使用示例](#使用示例)
7. [扩展教程](#扩展教程)

---

## 功能概述

Tutorial 应用是一个内置的帮助中心，帮助用户了解和学习小手机的各项功能。

### 核心功能

- **分类浏览** - 教程按分类组织，便于用户查找
- **Markdown 渲染** - 支持丰富的文档格式
- **阅读进度** - 显示预计阅读时间
- **上下文导航** - 支持在同分类教程间快速切换

### 界面特点

- 清晰的分类卡片
- 简洁的教程列表
- 舒适的阅读体验
- 响应式布局设计

---

## 目录结构

```
src/apps/tutorial/
├── TutorialApp.vue          # 主应用入口组件
├── index.ts                 # 统一导出入口
├── types.ts                 # 类型定义
├── components/              # 共享组件
│   ├── TutorialHeader.vue   # 头部导航组件
│   ├── TutorialCard.vue     # 教程卡片组件
│   ├── CategoryCard.vue     # 分类卡片组件
│   └── index.ts             # 组件导出
├── views/                   # 视图组件
│   ├── TutorialHome.vue     # 教程首页
│   ├── TutorialCategory.vue # 分类详情页
│   ├── TutorialDetail.vue   # 教程详情页
│   └── index.ts             # 视图导出
└── data/                    # 数据
    └── tutorials.ts         # 教程数据和工具函数
```

---

## 组件说明

### TutorialApp.vue

主应用入口组件，负责：
- 管理子路由显示
- 提供默认首页视图

### TutorialHeader.vue

头部导航组件。

**Props:**

| 属性 | 类型 | 默认值 | 说明 |
| ------ | ------ | -------- | ------ |
| `title` | `string` | `'教程'` | 标题文字 |
| `showBack` | `boolean` | `false` | 是否显示返回按钮 |
| `showSearch` | `boolean` | `false` | 是否显示搜索按钮 |

**Events:**

| 事件 | 参数 | 说明 |
| ------ | ------ | ------ |
| `search` | - | 点击搜索按钮时触发 |

### TutorialCard.vue

教程卡片组件，用于教程列表项展示。

**Props:**

| 属性 | 类型 | 说明 |
| ------ | ------ | ------ |
| `tutorial` | `Tutorial \ | TutorialListItem` | 教程数据 |

**Events:**

| 事件 | 参数 | 说明 |
| ------ | ------ | ------ |
| `click` | - | 点击卡片时触发 |

### CategoryCard.vue

分类卡片组件，用于分类列表项展示。

**Props:**

| 属性 | 类型 | 说明 |
| ------ | ------ | ------ |
| `category` | `TutorialCategory` | 分类数据 |
| `count` | `number` | 该分类下的教程数量（可选） |

**Events:**

| 事件 | 参数 | 说明 |
| ------ | ------ | ------ |
| `click` | - | 点击卡片时触发 |

---

## 数据结构

### TutorialCategory

教程分类。

```typescript
interface TutorialCategory {
  id: string           // 分类唯一标识
  name: string         // 分类名称
  icon: string         // 分类图标（emoji）
  description?: string // 分类描述
}
```

### Tutorial

教程内容。

```typescript
interface Tutorial {
  id: string           // 教程唯一标识
  categoryId: string   // 所属分类ID
  title: string        // 教程标题
  description: string  // 简短描述
  icon: string         // 图标（emoji）
  content: string      // Markdown 内容
  order: number        // 排序序号
  readTime?: number    // 预计阅读时间（分钟）
  tags?: string[]      // 标签
}
```

### 数据工具函数

```typescript
// 获取所有分类
getAllCategories(): TutorialCategory[]

// 根据ID获取分类
getCategoryById(id: string): TutorialCategory | undefined

// 根据分类ID获取教程列表
getTutorialsByCategory(categoryId: string): Tutorial[]

// 根据ID获取教程
getTutorialById(id: string): Tutorial | undefined

// 搜索教程
searchTutorials(keyword: string): Tutorial[]
```

---

## 路由配置

```typescript
{
  path: '/tutorial',
  name: 'TutorialApp',
  component: TutorialApp,
  meta: { title: '使用帮助', keepAlive: true },
  children: [
    {
      path: 'category/:categoryId',
      name: 'TutorialCategory',
      component: TutorialCategory,
      props: true,
      meta: { title: '教程分类' }
    },
    {
      path: ':tutorialId',
      name: 'TutorialDetail',
      component: TutorialDetail,
      props: true,
      meta: { title: '教程详情' }
    }
  ]
}
```

### 路由说明

| 路由名 | 路径 | 说明 |
| -------- | ------ | ------ |
| `TutorialApp` | `/tutorial` | 教程首页 |
| `TutorialCategory` | `/tutorial/category/:categoryId` | 分类详情 |
| `TutorialDetail` | `/tutorial/:tutorialId` | 教程详情 |

---

## 使用示例

### 导航到教程

```typescript
import { useRouter } from 'vue-router'

const router = useRouter()

// 打开教程首页
router.push({ name: 'TutorialApp' })

// 打开特定分类
router.push({ 
  name: 'TutorialCategory', 
  params: { categoryId: 'getting-started' } 
})

// 打开特定教程
router.push({ 
  name: 'TutorialDetail', 
  params: { tutorialId: 'welcome' } 
})
```

### 使用 MarkdownRenderer 组件

Tutorial 应用使用了通用的 `MarkdownRenderer` 组件来渲染 Markdown 内容：

```vue
<script setup lang="ts">
import { MarkdownRenderer } from '@/components/common'
</script>

<template>
  <MarkdownRenderer :content="markdownContent" />
</template>
```

**MarkdownRenderer Props:**

| 属性 | 类型 | 默认值 | 说明 |
| ------ | ------ | -------- | ------ |
| `content` | `string` | - | Markdown 内容 |
| `breaks` | `boolean` | `true` | 是否将换行符转换为 `<br>` |
| `gfm` | `boolean` | `true` | 是否启用 GitHub 风格 Markdown |

---

## 扩展教程

### 添加新分类

在 `data/tutorials.ts` 中的 `categories` 数组添加：

```typescript
{
  id: 'new-category',
  name: '新分类名称',
  icon: '📚',
  description: '分类描述'
}
```

### 添加新教程

在 `data/tutorials.ts` 中的 `tutorials` 数组添加：

```typescript
{
  id: 'new-tutorial',
  categoryId: 'getting-started',  // 所属分类
  title: '新教程标题',
  description: '教程简短描述',
  icon: '📝',
  order: 10,
  readTime: 5,
  tags: ['标签1', '标签2'],
  content: `# 教程标题

这里是 **Markdown** 内容。

## 小节

- 列表项1
- 列表项2

\`\`\`javascript
// 代码示例
console.log('Hello!')
\`\`\`
`
}
```

### Markdown 支持的格式

MarkdownRenderer 组件支持以下 Markdown 格式：

- 标题（h1-h6）
- 段落和换行
- **粗体** 和 *斜体*
- 链接和图片
- 有序/无序列表
- 代码块和行内代码
- 引用块
- 表格
- 水平线
- 任务列表（复选框）

---

## Store 依赖

Tutorial 应用目前不依赖任何 Store，所有数据直接从 `data/tutorials.ts` 获取。

如果未来需要添加阅读历史、收藏等功能，可以创建 `tutorialStore`。

---

## 样式规范

组件使用 CSS 变量实现主题适配：

```css
.tutorial-card {
  background: var(--color-surface);
  color: var(--color-text);
}

.category-count {
  background: var(--color-primary);
  color: white;
}
```

---

## 检查清单

- [x] 目录结构符合规范
- [x] 入口组件命名为 `TutorialApp.vue`
- [x] 创建了 `index.ts` 导出文件
- [x] 共享组件放在 `components/` 目录
- [x] 组件使用 CSS 变量
- [x] 路由已配置
- [x] 创建了文档