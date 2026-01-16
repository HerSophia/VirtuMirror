# 图标服务 - 类型定义

本文档详细说明图标服务的核心类型定义。

## 1. 核心类型

### 1.1 RegisteredAppIcon

注册的 App 图标信息，是图标服务的核心数据结构。

```typescript
// 位置：src/types/icon.ts

export interface RegisteredAppIcon {
  /** 唯一标识（通常与路由相关，如 'wechat', 'email'） */
  id: string
  
  /** 图标 ID（用于主题图标映射） */
  iconId?: AppIconId | string
  
  /** 显示名称 */
  name: string
  
  /** 路由路径 */
  route: string
  
  /** 自定义图标配置（优先级高于 iconId） */
  icon?: PackageIconConfig
  
  /** App 分类（用于一键整理） */
  category?: AppCategory
  
  /** 是否为内置 App */
  isBuiltin?: boolean
  
  /** 获取 badge 数量的函数 */
  getBadge?: () => number
  
  /** 快捷操作配置（长按菜单） */
  quickActions?: QuickActionConfig[]
}
```

**字段说明**：

| 字段 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `id` | `string` | ✅ | 唯一标识，通常与路由名匹配 |
| `name` | `string` | ✅ | 显示名称，用于桌面图标下方文字 |
| `route` | `string` | ✅ | 点击图标跳转的路由路径 |
| `iconId` | `AppIconId` | ❌ | 主题图标 ID，用于主题适配 |
| `icon` | `PackageIconConfig` | ❌ | 自定义图标配置，优先级高于 iconId |
| `category` | `AppCategory` | ❌ | 分类，用于一键整理功能 |
| `isBuiltin` | `boolean` | ❌ | 是否内置应用，默认 false |
| `getBadge` | `() => number` | ❌ | 动态徽章数量获取函数 |
| `quickActions` | `QuickActionConfig[]` | ❌ | 长按快捷操作配置 |

---

### 1.2 AppCategory

App 分类类型，用于桌面一键整理功能。

```typescript
export type AppCategory = 
  | 'social'        // 社交
  | 'tool'          // 工具
  | 'tools'         // 工具（兼容旧值）
  | 'entertainment' // 娱乐
  | 'productivity'  // 效率
  | 'system'        // 系统
  | 'lifestyle'     // 生活
  | 'games'         // 游戏
  | 'other'         // 其他
```

**分类说明**：

| 分类 | 说明 | 示例 App |
| :--- | :--- | :--- |
| `social` | 社交通讯类 | 微信、微博、邮件 |
| `tool` / `tools` | 工具类 | 计算器、便签、设置 |
| `entertainment` | 娱乐类 | 直播、视频、音乐 |
| `productivity` | 效率办公类 | 日历、文档、提示词 |
| `system` | 系统类 | 设置、Bridge、账号管理 |
| `lifestyle` | 生活类 | 健康、天气 |
| `games` | 游戏类 | 游戏应用 |
| `other` | 其他 | 未分类应用 |

---

### 1.3 QuickActionConfig

快捷操作配置，用于图标长按菜单。

```typescript
export interface QuickActionConfig {
  /** 操作唯一标识 */
  id: string
  
  /** 显示文本 */
  label: string
  
  /** 图标（FontAwesome 类名） */
  icon?: string
  
  /** 跳转路由（与 action 二选一） */
  route?: string
  
  /** 自定义操作函数（与 route 二选一） */
  action?: () => void
}
```

**使用示例**：

```typescript
const quickActions: QuickActionConfig[] = [
  {
    id: 'compose',
    label: '发微博',
    icon: 'fas fa-pen',
    route: '/weibo/compose'
  },
  {
    id: 'search',
    label: '搜索',
    icon: 'fas fa-search',
    action: () => openSearchDialog()
  }
]
```

---

### 1.4 PackageIconConfig (AppIconConfig)

图标配置，支持多种图标类型。

```typescript
// 位置：src/types/appPackage.ts

export interface AppIconConfig {
  /** 图标类型 */
  type: 'font' | 'emoji' | 'url' | 'base64' | 'component'
  
  /** 图标值（根据 type 不同含义不同） */
  value: string | Component
  
  /** 背景色 */
  background?: string
  
  /** 图标颜色（仅 font 类型有效） */
  color?: string
}
```

**图标类型说明**：

| type | value 类型 | 说明 | 示例 |
| :--- | :--- | :--- | :--- |
| `font` | `string` | FontAwesome / Material Icons 类名 | `'fas fa-home'` |
| `emoji` | `string` | Emoji 字符 | `'🏠'` |
| `url` | `string` | 图片 URL | `'https://...'` |
| `base64` | `string` | Base64 图片数据 | `'data:image/png;...'` |
| `component` | `Component` | Vue 组件 | `WeiboLogo` |

**使用示例**：

```typescript
// FontAwesome 图标
const fontIcon: AppIconConfig = {
  type: 'font',
  value: 'fas fa-envelope',
  background: 'linear-gradient(135deg, #00a9ff, #0066ff)',
  color: '#ffffff'
}

// Emoji 图标
const emojiIcon: AppIconConfig = {
  type: 'emoji',
  value: '📧',
  background: '#4A90D9'
}

// 图片 URL
const urlIcon: AppIconConfig = {
  type: 'url',
  value: '/icons/my-app.png',
  background: '#ffffff'
}

// Vue 组件
import WeiboLogo from '@/components/icons/WeiboLogo.vue'
const componentIcon: AppIconConfig = {
  type: 'component',
  value: WeiboLogo,
  background: '#FF5722'
}
```

---

### 1.5 IconRegistrationOptions

图标注册选项。

```typescript
export interface IconRegistrationOptions {
  /** 是否覆盖已存在的注册 */
  override?: boolean
}
```

**使用场景**：

```typescript
// 默认情况：已存在则跳过
iconService.register(icon) // 如果 id 已存在，会打印警告并跳过

// 强制覆盖
iconService.register(icon, { override: true }) // 覆盖已有配置
```

---

## 2. 主题相关类型

### 2.1 AppIconId

主题图标 ID，用于主题适配。

```typescript
// 位置：src/types/theme.ts

export type AppIconId = 
  | 'phone'
  | 'messages'
  | 'safari'
  | 'mail'
  | 'music'
  | 'photos'
  | 'camera'
  | 'settings'
  | 'wechat'
  | 'weibo'
  // ... 更多预定义 ID
```

### 2.2 ThemeIconConfig

主题中的图标配置。

```typescript
export interface ThemeIconConfig {
  /** 图标类名 */
  icon: string
  
  /** 背景色 */
  bg: string
  
  /** 图标颜色（可选） */
  color?: string
  
  /** 边框圆角（可选） */
  borderRadius?: string
  
  /** 特效类名（可选） */
  effectClass?: string
}
```

---

## 3. 类型导出

```typescript
// 从 icon.ts 导出
import type { 
  RegisteredAppIcon, 
  AppCategory, 
  QuickActionConfig,
  IconRegistrationOptions,
  PackageIconConfig,
  AppIconId
} from '@/types/icon'

// 从 iconRegistryService.ts 重新导出（兼容）
import type { 
  RegisteredAppIcon, 
  AppCategory, 
  QuickActionConfig 
} from '@/services/iconRegistryService'
```

---

## 4. 图标优先级

当多个图标配置同时存在时，按以下优先级解析：

```text
优先级（从高到低）：

1. icon 属性（RegisteredAppIcon.icon）
   - 直接指定的自定义图标配置
   
2. iconId 属性 + 主题配置
   - 根据 iconId 从当前主题获取图标
   
3. 主题默认图标
   - 使用 appId 作为 key 从主题获取
   
4. 后备图标
   - 显示问号图标（fas fa-question）
```

**示例**：

```typescript
const app: RegisteredAppIcon = {
  id: 'my-app',
  name: '我的应用',
  route: '/my-app',
  iconId: 'mail',              // 优先级 2：从主题获取 mail 图标
  icon: { type: 'emoji', value: '📱' } // 优先级 1：使用这个！
}
```
