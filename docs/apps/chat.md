# Chat 应用文档

> 仿微信聊天应用，提供消息、通讯录、发现、个人中心等功能。

## 目录结构

```
src/apps/chat/
├── ChatApp.vue              # 主应用入口
├── index.ts                 # 导出入口
├── components/              # 共享组件
│   ├── ChatHeader.vue       # 统一头部组件
│   ├── ListItem.vue         # 通用列表项组件
│   ├── BottomNav.vue        # 底部导航栏组件
│   └── index.ts             # 组件导出
├── composables/             # 组合式函数
│   ├── useTimeFormat.ts     # 时间格式化
│   ├── useMessageFormat.ts  # 消息格式化
│   └── index.ts             # Composables 导出
├── tabs/                    # 底部标签页
│   ├── MessagesTab.vue      # 消息列表
│   ├── ContactsTab.vue      # 通讯录
│   ├── DiscoverTab.vue      # 发现页
│   ├── MeTab.vue            # 个人中心
│   └── index.ts             # 标签页导出
└── views/                   # 子页面视图
    ├── conversation/
    │   └── ChatConversation.vue  # 聊天对话页面
    ├── group/
    │   ├── GroupCreation.vue     # 创建群聊
    │   ├── GroupInvite.vue       # 群聊邀请
    │   ├── GroupMembers.vue      # 群成员管理
    │   └── index.ts
    ├── services/
    │   ├── ServicesPage.vue      # 服务页面
    │   ├── WalletPage.vue        # 钱包页面
    │   └── index.ts
    └── index.ts              # 视图导出
```

## 架构设计

### 设计原则

1. **组件复用** - 通过 `components/` 目录提取共享组件，避免重复代码
2. **关注点分离** - `composables/` 提取可复用的业务逻辑
3. **路由统一** - 所有子页面作为 ChatApp 的子路由，便于管理
4. **按功能分组** - `views/` 目录按功能域划分（conversation、group、services）

### 组件依赖关系

```
ChatApp
├── ChatHeader (共享组件)
├── BottomNav (共享组件)
├── MessagesTab
│   └── ListItem (共享组件)
├── ContactsTab
│   └── ListItem (共享组件)
├── DiscoverTab
│   └── ListItem (共享组件)
└── MeTab
    └── ListItem (共享组件)

ChatConversation
├── ChatHeader (共享组件)
└── useMessageFormat (composable)

GroupCreation / GroupInvite / GroupMembers
├── ChatHeader (共享组件)
└── ListItem (共享组件)

ServicesPage / WalletPage
├── ChatHeader (共享组件)
└── ListItem (共享组件)
```

---

## 共享组件

### ChatHeader.vue

统一的头部导航组件，支持多种配置。

**Props：**
| 属性 | 类型 | 默认值 | 说明 |
| ------ | ------ | -------- | ------ |
| `title` | `string` | `''` | 标题文字 |
| `showBack` | `boolean` | `true` | 是否显示返回按钮 |
| `backTo` | `string` | `''` | 返回目标路由 |
| `bgColor` | `string` | `'#ededed'` | 背景颜色 |
| `showSearch` | `boolean` | `false` | 显示搜索按钮 |
| `showAdd` | `boolean` | `false` | 显示添加按钮 |
| `showMore` | `boolean` | `false` | 显示更多按钮 |

**事件：**
- `@back` - 点击返回按钮
- `@search` - 点击搜索按钮
- `@add` - 点击添加按钮
- `@more` - 点击更多按钮

**插槽：**
- `#left` - 左侧自定义内容
- `#center` - 中间自定义内容
- `#right` - 右侧自定义内容

**使用示例：**
```vue
<ChatHeader 
  title="微信"
  :show-back="true"
  back-to="/"
  :show-search="true"
  :show-add="true"
/>
```

---

### ListItem.vue

通用列表项组件，适用于消息列表、联系人列表、设置列表等场景。

**Props：**
| 属性 | 类型 | 默认值 | 说明 |
| ------ | ------ | -------- | ------ |
| `avatar` | `string` | `''` | 头像 URL |
| `avatarAlt` | `string` | `''` | 头像替代文字 |
| `title` | `string` | `''` | 主标题 |
| `subtitle` | `string` | `''` | 副标题/描述 |
| `time` | `string` | `''` | 右侧时间文字 |
| `badge` | `number` | `0` | 角标数量（0 不显示） |
| `showArrow` | `boolean` | `false` | 是否显示右箭头 |
| `clickable` | `boolean` | `true` | 是否可点击 |
| `iconClass` | `string` | `''` | 图标类名（功能入口） |
| `iconBgColor` | `string` | `''` | 图标背景颜色 |
| `iconColor` | `string` | `''` | 图标颜色 |

**插槽：**
- `#left` - 左侧自定义内容
- `#content` - 内容区自定义
- `#right` - 右侧自定义内容

**使用示例：**
```vue
<!-- 消息列表项 -->
<ListItem
  :avatar="contact.avatar"
  :title="contact.name"
  :subtitle="lastMessage"
  :time="formatTime(contact.lastMessageTime)"
  :badge="contact.unreadCount"
  @click="openConversation(contact)"
/>

<!-- 功能入口项 -->
<ListItem
  icon-class="fas fa-users"
  icon-bg-color="#22c55e"
  icon-color="#fff"
  title="群聊"
  :show-arrow="true"
/>
```

---

### BottomNav.vue

微信风格的底部导航栏组件。

**Props：**
| 属性 | 类型 | 必填 | 说明 |
| ------ | ------ | ------ | ------ |
| `activeTab` | `TabName` | ✅ | 当前激活的标签 |

**类型定义：**
```typescript
type TabName = 'messages' | 'contacts' | 'discover' | 'me'
```

**事件：**
- `@update:activeTab` - 标签切换（支持 v-model）
- `@tabChange` - 标签变化回调

---

## Composables

### useTimeFormat

时间格式化组合式函数。

**导出函数：**

```typescript
// 格式化列表时间（刚刚、X分钟前、时:分、昨天、月/日）
formatListTime(timestamp?: number): string

// 格式化消息时间（时:分）
formatMessageTime(timestamp: number): string

// 格式化完整日期时间
formatFullDateTime(timestamp: number): string

// 判断是否为今天
isToday(timestamp: number): boolean

// 判断是否为昨天
isYesterday(timestamp: number): boolean
```

**使用示例：**
```typescript
import { formatListTime, formatMessageTime } from '@/apps/chat/composables'

const listTime = formatListTime(contact.lastMessageTime) // "刚刚" | "5分钟前" | "14:30"
const msgTime = formatMessageTime(message.timestamp) // "14:30"
```

---

### useMessageFormat

消息格式化组合式函数。

**导出函数：**

```typescript
// 获取消息内容的文本表示
getMessageContent(message: Message): string

// 获取消息预览（可截断）
getMessagePreview(message: Message, maxLength?: number): string

// 判断消息类型
isSpecialMessage(message: Message): boolean
isSystemMessage(message: Message): boolean
isMediaMessage(message: Message): boolean
isTransactionMessage(message: Message): boolean
```

**消息类型支持：**
```typescript
type MessageType = 'text' | 'image' | 'voice' | 'sticker' | 
                   'transfer' | 'red_packet' | 'location' | 
                   'system' | 'recall'
```

---

## 视图组件

### ChatConversation.vue

聊天对话页面，支持查看和发送消息。

**路由：** `/chat/:contactId`

**Props：**
| 属性 | 类型 | 必填 | 说明 |
| ------ | ------ | ------ | ------ |
| `contactId` | `string` | ✅ | 联系人/群组 ID |

**功能特性：**
- 消息列表展示（支持多种消息类型）
- 系统消息特殊样式
- 发送消息（暂存到 `stagedActionsStore`）
- 自动滚动到底部
- 进入对话时自动清除未读数
- 使用 `ChatHeader` 共享组件
- 使用 `getMessageContent` 格式化消息

---

### GroupCreation.vue

发起群聊页面。

**路由：** `/chat/group/create`

**功能特性：**
- 搜索联系人
- 面对面建群入口
- 从已有群选择入口
- 联系人多选列表
- 使用 `ChatHeader`、`ListItem` 共享组件

---

### GroupInvite.vue

群聊邀请页面，用于邀请新成员加入群聊。

**路由：** `/chat/group/:contactId/invite`

**Props：**
| 属性 | 类型 | 必填 | 说明 |
| ------ | ------ | ------ | ------ |
| `contactId` | `string` | ✅ | 群组 ID |

---

### GroupMembers.vue

群聊信息/成员管理页面。

**路由：** `/chat/group/:contactId/members`

**Props：**
| 属性 | 类型 | 必填 | 说明 |
| ------ | ------ | ------ | ------ |
| `contactId` | `string` | ✅ | 群组 ID |

**功能特性：**
- 成员网格展示
- 邀请新成员入口
- 群设置项（名称、二维码、公告等）
- 开关控件（消息免打扰、置顶聊天、保存到通讯录）
- 删除并退出群聊

---

### ServicesPage.vue

微信服务/支付入口页面。

**路由：** `/chat/services`

**功能区块：**
- 顶部支付区域（收付款、钱包）
- 金融理财（信用卡还款、理财通、保险服务）
- 生活服务（手机充值、生活缴费等）
- 交通出行（出行服务、火车票机票等）
- 购物消费（京东购物、拼多多等）

---

### WalletPage.vue

钱包管理页面，支持查看和编辑余额。

**路由：** `/chat/wallet`

**功能特性：**
- 零钱余额显示与编辑
- 零钱通余额显示与编辑（含收益率波动）
- 银行卡、亲属卡入口
- 支付分、客服中心入口
- 弹窗编辑模式

---

## 路由配置

Chat 应用采用嵌套路由结构：

```typescript
{
  path: '/chat',
  name: 'ChatApp',
  component: ChatApp,
  children: [
    // 聊天对话
    { path: ':contactId', name: 'ChatConversation', component: ChatConversation },
    
    // 群组相关
    { path: 'group/create', name: 'GroupCreation', component: GroupCreation },
    { path: 'group/:contactId/members', name: 'GroupMembers', component: GroupMembers },
    { path: 'group/:contactId/invite', name: 'GroupInvite', component: GroupInvite },
    
    // 服务相关
    { path: 'services', name: 'Services', component: ServicesPage },
    { path: 'wallet', name: 'Wallet', component: WalletPage }
  ]
}
```

---

## 样式规范

### 颜色使用

| 元素 | 颜色值 | 说明 |
| ------ | -------- | ------ |
| 背景色 | `#ededed` | 主背景 |
| 消息气泡（自己） | `#95ec69` | 微信绿 |
| 消息气泡（他人） | `#fff` | 白色 |
| 发送按钮 | `#07c160` | 微信按钮绿 |
| 激活状态 | `#07c160` | 底部导航激活色 |
| 支付区域渐变 | `#07c160 → #06ad56` | 绿色渐变 |

### 组件样式

- 使用 Tailwind CSS + `@apply` 指令
- 共享组件封装常用样式
- 消息气泡带三角箭头效果

---

## 依赖关系

### Store 依赖

```
MessagesTab → contactStore, chatStore
ContactsTab → contactStore
DiscoverTab → router
MeTab → uiStore, router

ChatConversation → contactStore, chatStore, stagedActionsStore
ServicesPage → walletStore
WalletPage → walletStore
```

### 组件依赖

```
ChatApp
├── components/ChatHeader
├── components/BottomNav
└── tabs/*

tabs/*
└── components/ListItem

views/*
├── components/ChatHeader
├── components/ListItem
└── composables/*
```

---

## 使用示例

### 进入聊天对话

```typescript
import { useRouter } from 'vue-router'

const router = useRouter()

router.push({ name: 'ChatConversation', params: { contactId: 'contact_001' } })
```

### 使用共享组件

```vue
<script setup lang="ts">
import { ChatHeader, ListItem } from '@/apps/chat/components'
import { formatListTime } from '@/apps/chat/composables'
</script>

<template>
  <ChatHeader title="我的页面" :show-back="true" />
  
  <ListItem
    :avatar="user.avatar"
    :title="user.name"
    :time="formatListTime(user.lastActive)"
    :show-arrow="true"
    @click="handleClick"
  />
</template>
```

### 使用 Composables

```typescript
import { formatListTime, getMessageContent } from '@/apps/chat/composables'

// 格式化时间
const timeText = formatListTime(Date.now() - 60000) // "1分钟前"

// 格式化消息
const preview = getMessageContent(message) // "[图片]" | "消息内容" | ...
```

---

## 导出入口

### index.ts

```typescript
// 主应用
export { ChatApp } from './ChatApp.vue'

// 视图组件
export { ChatConversation, GroupCreation, GroupInvite, GroupMembers, ServicesPage, WalletPage } from './views'

// 共享组件
export { ChatHeader, ListItem, BottomNav } from './components'
export type { TabName } from './components'

// Composables
export { useTimeFormat, formatListTime, formatMessageTime, useMessageFormat, getMessageContent, getMessagePreview } from './composables'