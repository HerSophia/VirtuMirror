# Home App (桌面) 架构文档

> 桌面（Desktop）本身就是一个 App，只是它比较特殊，是整个系统的入口。这样我们开发和维护起来就和其他 App 是一致的。

## 设计理念

将桌面视为一个特殊的 App 带来以下好处：

1. **一致性** - 开发和维护方式与其他 App 统一
2. **可扩展性** - 可以像其他 App 一样添加子页面（如编辑模式、小组件配置）
3. **组件复用** - 桌面组件可以被其他地方复用（如多任务切换器的缩略图）
4. **测试友好** - 可以独立测试桌面组件

## 目录结构

```text
src/apps/home/
├── HomeApp.vue              # 主应用入口组件（多页桌面 + 滑动手势）
├── HomeScreen.vue           # 别名兼容（导出 HomeApp）
├── index.ts                 # 统一导出入口
├── types.ts                 # 类型定义（DesktopItem, DesktopPage, DockAppItem 等）
├── components/              # 桌面共享组件
│   ├── index.ts             # 组件导出
│   ├── DesktopGrid.vue      # 桌面网格（静态布局）
│   ├── AppBlock.vue         # 单个 App 图标块（点击/长按检测）
│   ├── AppContextMenu.vue   # App 长按快捷操作菜单
│   ├── PageIndicator.vue    # 页面指示器（支持滑动进度动画）
│   ├── DockBar.vue          # 底部 Dock 栏
│   ├── RemoveAppDialog.vue  # 删除/卸载确认对话框
│   └── AppGrid.vue          # App 图标网格（旧版本，逐步废弃）
└── composables/             # 组合式函数
    ├── index.ts             # Composables 导出
    ├── useIconPosition.ts   # 图标位置管理（zoom 动画原点）
    ├── useEditMode.ts       # 编辑模式状态管理（可选）
    └── useDesktopOrganize.ts # 桌面整理功能（分类摆放）

src/services/
├── iconRegistryService.ts   # 全局图标注册服务（各 App 可注册图标）
└── builtinApps.ts           # 内置 App 图标配置
```

## 与其他 App 的对比

| 特性 | Home App | 普通 App (如 Chat) |
| ---- | -------- | ------------------ |
| 路由路径 | `/` | `/chat`, `/settings` 等 |
| 入口组件 | `HomeApp.vue` | `ChatApp.vue` |
| KeepAlive | ✅ 缓存 | ✅ 缓存 |
| 子路由 | 可选（编辑模式） | 根据功能定义 |
| 状态栏 | 透明背景 | 各 App 自定义 |
| 导航栏 | 无 | 根据 App 设计 |

## 组件说明

### HomeApp.vue

主入口组件，职责：
- 多页桌面管理（`desktopPages` 数组）
- 滑动手势处理（支持触摸和鼠标）
- 编辑模式控制（长按进入、点击"完成"按钮退出）
- 图标位置注册（用于 zoom 动画）
- 布局持久化（通过 GlobalConfigService）
- **一键整理功能**（按功能分类重排）
- **自动添加新 App**（自动找空位）

```vue
<template>
  <div class="home-app" :class="{ 'is-edit-mode': isEditMode }">
    <div ref="pagesContainerRef" class="pages-container" @mousedown="handleMouseDown">
      <div class="pages-wrapper" :style="{ transform: `translateX(${translateX}%)` }">
        <div v-for="(page, pageIndex) in desktopPages" :key="page.id" class="page">
          <DesktopGrid
            :items="getPageItems(pageIndex)"
            :is-edit-mode="isEditMode"
            :page-index="pageIndex"
            :is-active="pageIndex === currentPageIndex"
            @open="openApp"
            @long-press="handleLongPress"
          />
        </div>
      </div>
    </div>
    <PageIndicator v-if="totalPages > 1" :total="totalPages" :current="currentPageIndex" :progress="swipeProgress" />
    <DockBar :apps="dockApps" @open="openDockApp" />
    
    <!-- 编辑模式工具栏 -->
    <div v-if="isEditMode" class="edit-mode-hint">
      <button class="organize-btn" @click="showOrganizeConfirm">一键整理</button>
      <button class="done-btn" @click="exitEditMode">完成</button>
    </div>
  </div>
</template>
```

**关键状态：**
- `isEditMode` - 是否处于编辑模式
- `currentPageIndex` - 当前页索引
- `swipeProgress` - 滑动进度（-1 到 1）
- `isSwiping` - 是否正在滑动
- `showOrganizeDialog` - 是否显示整理确认对话框

**关键方法：**
- `handleTouchStart/Move/End` - 触摸滑动手势处理
- `handleMouseDown/Move/Up` - 鼠标滑动手势处理（PC 端支持）
- `openApp(item, event)` - 打开 App（设置 zoom 动画原点）
- `enterEditMode()` / `exitEditMode()` - 编辑模式控制
- `showOrganizeConfirm()` / `doOrganize()` - 一键整理功能
- `loadLayout()` / `saveLayout()` - 布局持久化

### DesktopGrid.vue

桌面网格组件（静态布局）：
- 使用 CSS Grid 布局显示图标
- 支持点击打开 App
- 支持长按显示快捷菜单
- **不再支持拖拽排序**（已移除 GridStack.js）

**Props:**

| 属性 | 类型 | 默认值 | 说明 |
| ---- | ---- | ------ | ---- |
| `items` | `DesktopItem[]` | - | 桌面布局项 |
| `isEditMode` | `boolean` | `false` | 是否处于编辑模式 |
| `columns` | `number` | `4` | 列数 |
| `pageIndex` | `number` | `0` | 页面索引 |
| `isActive` | `boolean` | `true` | 是否为当前激活的页面 |

**Events:**

| 事件 | 参数 | 说明 |
| ---- | ---- | ---- |
| `open` | `item: AppItem, event: MouseEvent \ | TouchEvent` | 点击打开 App |
| `iconRef` | `appId: string, el: HTMLElement \ | null` | 图标元素引用（用于 zoom 动画） |
| `longPress` | `item: DesktopItem, event: MouseEvent \ | TouchEvent` | 长按触发 |
| `longPressDrag` | `item: DesktopItem, event: MouseEvent \ | TouchEvent` | 长按后拖拽（进入编辑模式） |
| `deleteApp` | `item: AppItem` | 删除按钮点击 |

### AppBlock.vue

单个 App 图标块：
- 封装 AppIcon + 名称
- 处理点击、长按检测
- 长按显示快捷菜单，长按+拖拽进入编辑模式
- 编辑模式下显示抖动动画和删除按钮

**Props:**

| 属性 | 类型 | 默认值 | 说明 |
| ---- | ---- | ------ | ---- |
| `app` | `AppItem` | - | App 信息 |
| `showName` | `boolean` | `true` | 是否显示名称 |
| `size` | `'xs' \ | 'sm' \ | 'md' \ | 'lg' \ | 'xl'` | `'md'` | 图标尺寸 |
| `isEditMode` | `boolean` | `false` | 是否处于编辑模式 |
| `wobbleDelay` | `number` | `0` | 抖动动画延迟（ms） |

**Events:**

| 事件 | 参数 | 说明 |
| ---- | ---- | ---- |
| `click` | `event: MouseEvent \ | TouchEvent` | 点击事件 |
| `longPress` | `event: MouseEvent \ | TouchEvent` | 长按事件（显示快捷菜单） |
| `longPressDrag` | `event: MouseEvent \ | TouchEvent` | 长按后拖拽事件（进入编辑模式） |
| `delete` | `app: AppItem` | 删除按钮点击 |

### PageIndicator.vue

页面指示器组件：示当前页面位置（小圆点）
- 支持滑动过程中的平滑过渡动画

**Props:**

| 属性 | 类型 | 说明 |
| ---- | ---- | ---- |
| `total` | `number` | 总页数 |
| `current` | `number` | 当前页索引（0-based） |
| `progress` | `number` | 滑动进度 (-1 到 1) |

### DockBar.vue

底部 Dock 栏组件：
- 显示常用 App 快捷入口（固定 4 个）
- 毛玻璃背景效果
- 支持 badge 显示

### AppContextMenu.vue

App 长按快捷操作菜单：
- 显示 App 的快捷入口（如微信的扫一扫、收付款等）
- 显示系统操作（分享、卸载）
- 毛玻璃背景效果
- 点击外部自动关闭

## Composables

### useIconPosition

管理图标位置，用于 zoom 动画的原点计算：

```typescript
import { useIconPosition } from './composables'

const {
  setIconRef,        // 注册单个图标元素
  registerAllIcons,  // 批量注册
  getIconPosition,   // 获取图标位置（返回 { x, y } 百分比）
} = useIconPosition()
```

### useDesktopOrganize

桌面整理功能，提供自动整理和分类摆放能力：

```typescript
import { useDesktopOrganize } from './composables'

const {
  findFirstEmptySlot,  // 查找第一个空位
  autoAddApp,          // 自动添加新 App 到空位
  organizeDesktop,     // 一键整理桌面（按分类重排）
  getOrganizePreview,  // 获取整理预览信息
  getAppCategory,      // 获取 App 的分类
} = useDesktopOrganize()
```

**App 分类：**

| 分类 | 说明 | 示例 App |
| ---- | ---- | -------- |
| `social` | 社交通讯 | 微信、邮箱 |
| `productivity` | 效率办公 | 提示词、Pathfinder |
| `tool` | 工具 | 浏览器、应用商店 |
| `entertainment` | 娱乐 | 直播 |
| `system` | 系统 | 设置、使用帮助 |
| `other` | 其他 | 未分类的 App |

**整理顺序：** 社交通讯 → 效率办公 → 工具 → 娱乐 → 系统 → 其他

### useEditMode (可选)

编辑模式状态管理：

```typescript
import { useEditMode } from './composables'

const {
  isEditMode,
  enterEditMode,
  exitEditMode,
  toggleEditMode,
} = useEditMode()
```

## 类型定义

```typescript
// types.ts
import type { AppIconId } from '@/types/theme'

/** 桌面项型 */
export type DesktopItemType = 'app' | 'widget' | 'group'

/** 基础桌面项配置 */
export interface BaseDesktopItem {
  id: string
  type: DesktopItemType
  w: number  // 网格宽度 (1-4)
  h: number  // 网格高度
  x?: number // X 坐标 (可选)
  y?: number // Y 坐标 (可选)
}

/** 桌面 App 项配置 */
export interface AppItem extends BaseDesktopItem {
  type: 'app'
  iconId: AppIconId | string
  name: string
  route: string
  badge?: number
}

/** 桌面小组件配置 */
export interface WidgetItem extends BaseDesktopItem {
  type: 'widget'
  widgetType: string
  content?: string
}

/** 分组框配置 */
export interface GroupItem extends BaseDesktopItem {
  type: 'group'
  title: string
  children: AppItem[]
}

/** 桌面项联合类型 */
export type DesktopItem = AppItem | WidgetItem | GroupItem

/** 桌面页配置 */
export interface DesktopPage {
  id: string
  items: DesktopItem[]
}

/** App 分类 */
export type AppCategory = 'social' | 'tool' | 'entertainment' | 'system' | 'productivity' | 'other'
```

## 已实现功能

### 多页桌面 ✅

- ✅ 页面指示器（PageIndicator.vue）带滑动进度动画
- ✅ 自动分页排列图标
- ✅ 滑动手势切换页面（支持触摸和鼠标）
- ✅ 边界阻尼效果
- ✅ 滑动过程中所有页面内容可见
- ✅ 布局持久化

### 编辑模式 ✅

- ✅ 长按进入编辑模式
- ✅ 图标抖动动画
- ✅ 编辑模式提示 UI（顶部悬浮提示 + 完成按钮）
- ✅ 点击完成按钮退出编辑模式
- ✅ 删除按钮显示
- ✅ 震动反馈
- ❌ ~~拖拽排序~~（已移除，改为一键整理）

### 一键整理 ✅ (新功能)

- ✅ 按 App 功能自动分类
- ✅ 整理前显示预览信息
- ✅ 确认后自动重排所有页面
- ✅ 震动反馈

### 自动添加新 App ✅

- ✅ 监听应用商店安装事件
- ✅ 自动查找空位添加
- ✅ 页面满时自动创建新页

### 手势交互 ✅

- ✅ 点击 App 图标打开应用（带 zoom 动画原点）
- ✅ 水平滑动切换桌面页（不触发点击）
- ✅ 长按 App 图标显示快捷操作菜单
- ✅ 长按 + 拖拽进入编辑模式
- ✅ **空白区域长按**显示快捷操作菜单（一键整理、编辑桌面）

### Zoom 动画 ✅

- ✅ 图标位置收集（`useIconPosition`）
- ✅ 动画原点设置
- ✅ Dock 栏图标也支持 zoom 动画

## 与系统组件的交互

### 状态栏 (StatusBar)

桌面使用透明状态栏：

```css
.home-app + .status-bar {
  background: transparent;
}
```

### 多任务切换器 (AppSwitcher)

桌面本身不出现在多任务切换器中（特殊处理）。

### 导航系统

从桌面进入 App 使用 zoom 动画，从 App 返回桌面也使用 zoom 动画（反向）。

## 未来扩展

### 小组件

支持添加不同尺寸的小组件：
- WidgetItem 类型已定义
- 2x2、2x4、4x4 等尺寸（通过 w/h 属性）
- 与 App 混排

### 分组框

支持 App 分组：
- GroupItem 类型已定义
- 分组标题和内容

---

## 依赖

- Vue 3 Composition API
- Tailwind CSS
- `iconRegistryService` - 全局图标注册服务
- `builtinApps` - 内置 App 配置

## 全局图标注册服务

为了降低耦合度，桌面不再硬编码所有 App 的图标信息。各个 App 可以通过 `iconRegistryService` 注册自己的图标配置：

### 注册 App 图标

```typescript
import { getIconRegistryService } from '@/services/iconRegistryService'

const iconRegistry = getIconRegistryService()

// 注册单个 App
iconRegistry.register({
  id: 'my-app',
  iconId: 'my-app',
  name: '我的应用',
  route: '/my-app',
  category: 'tool',
  isBuiltin: false,
  icon: {
    type: 'emoji',
    value: '🚀',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
  }
})
```

### RegisteredAppIcon 类型

| 属性 | 类型 | 必填 | 说明 |
| ---- | ---- | ---- | ---- |
| `id` | `string` | ✅ | 唯一标识 |
| `iconId` | `string` | - | 图标 ID（用于主题映射） |
| `name` | `string` | ✅ | 显示名称 |
| `route` | `string` | ✅ | 路由路径 |
| `icon` | `IconConfig` | - | 自定义图标配置 |
| `category` | `AppCategory` | - | 分类（用于一键整理） |
| `isBuiltin` | `boolean` | - | 是否为内置 App |
| `getBadge` | `() => number` | - | 获取徽章数量函数 |
| `quickActions` | `QuickActionConfig[]` | - | 快捷操作配置 |

### 内置 App 注册

内置 App 在应用初始化时自动注册（`main.ts` 中调用 `registerBuiltinApps()`）：

```typescript
// src/services/builtinApps.ts
export const BUILTIN_APPS: RegisteredAppIcon[] = [
  { id: 'wechat', name: '微信', route: '/chat', category: 'social', ... },
  { id: 'email', name: '邮箱', route: '/email', category: 'social', ... },
  // ...
]
```

## 迁移清单

- [x] 创建架构设计文档
- [x] 创建 `types.ts` 类型定义
- [x] 创建 `composables/useIconPosition.ts`
- [x] 创建 `composables/useEditMode.ts`
- [x] 创建 `composables/useDesktopOrganize.ts`（新增）
- [x] 创建 `composables/index.ts`
- [x] 创建 `components/AppBlock.vue`
- [x] 创建 `components/DesktopGrid.vue`（静态网格）
- [x] 创建 `components/DockBar.vue`
- [x] 创建 `components/PageIndicator.vue`
- [x] 创建 `components/index.ts`
- [x] 创建 `HomeApp.vue`
- [x] 实现多页桌面
- [x] 实现编辑模式
- [x] 实现布局持久化
- [x] 实现一键整理功能
- [x] 移除拖拽排序功能
