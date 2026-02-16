 # 应用商店设计文档

> 本文档定义了小手机模拟器的应用商店系统设计，包括应用包格式规范、分发机制、安装流程等。

## 目录

1. [概述](#概述)
2. [应用类型](#应用类型)
3. [应用包格式规范](#应用包格式规范)
4. [应用清单文件](#应用清单文件)
5. [应用来源与分发](#应用来源与分发)
6. [安装与生命周期](#安装与生命周期)
7. [安全与权限](#安全与权限)
8. [应用商店 UI](#应用商店-ui)
9. [官方仓库结构](#官方仓库结构)

---

## 概述

### 设计目标

1. **简单易用** - 普通用户可以通过 JSON 配置创建简单应用
2. **功能强大** - 高级用户可以创建完整的 Vue 组件应用
3. **安全可控** - 应用运行在沙盒环境中，权限受限
4. **易于分发** - 支持多种应用来源和分发方式

### 运行环境约束

由于项目运行在酒馆的 iframe 沙盒中，存在以下限制：

- ❌ 无法执行任意 JavaScript 代码（安全考虑）
- ❌ 无法动态加载 ES 模块
- ✅ 可以解析 JSON 配置
- ✅ 可以渲染预定义的 Vue 组件
- ✅ 可以存储数据到酒馆变量系统

---

## 应用类型

### 类型一览

| 类型 | 复杂度 | 适用场景 | 技术要求 |
| ------ | -------- | --------- | --------- |
| **配置式应用** | ⭐ | 列表展示、数据查看 | 仅需 JSON |
| **模板式应用** | ⭐⭐ | 自定义布局、简单交互 | JSON + 模板语法 |
| **组合式应用** | ⭐⭐⭐ | 复杂交互、多页面 | JSON + 预置组件 |
| **内置应用扩展** | ⭐⭐⭐⭐ | 扩展现有应用功能 | 需要代码贡献 |

### 类型详解

#### 1. 配置式应用 (Configurable App)

最简单的应用类型，通过 JSON 配置即可创建。

```json
{
  "type": "configurable",
  "layout": "list",
  "dataSource": {
    "type": "static",
    "data": [...]
  }
}
```

**支持的布局类型：**
- `list` - 列表布局
- `grid` - 网格布局
- `detail` - 详情页
- `webview` - 嵌入网页（iframe）

#### 2. 模板式应用 (Template App)

支持简单的模板语法，可以自定义渲染逻辑。

```json
{
  "type": "template",
  "template": "<div class='my-app'>{{title}}</div>",
  "styles": ".my-app { padding: 16px; }",
  "dataSource": {...}
}
```

**模板语法：**
- `{{变量名}}` - 变量插值
- `{{#each items}}...{{/each}}` - 循环
- `{{#if condition}}...{{/if}}` - 条件
- `@click="action"` - 事件绑定（预定义动作）

#### 3. 组合式应用 (Composite App)

使用预置组件组合构建复杂应用。

```json
{
  "type": "composite",
  "pages": [
    {
      "path": "/",
      "components": [
        { "type": "Header", "props": { "title": "我的应用" } },
        { "type": "List", "props": { "dataKey": "items" } }
      ]
    }
  ]
}
```

**预置组件库：**
- `Header` - 页面头部
- `List` / `Grid` - 列表/网格
- `Card` - 卡片
- `Form` - 表单
- `Button` - 按钮
- `Input` - 输入框
- `Image` - 图片
- `Avatar` - 头像
- `Badge` - 徽章
- `Empty` - 空状态
- `Loading` - 加载状态

---

## 应用包格式规范

### 文件结构

应用包是一个 JSON 文件（`.phoneapp.json`），包含应用的所有信息。

```
my-app.phoneapp.json
```

**为什么选择单文件 JSON 格式？**

1. **环境限制** - iframe 沙盒无法动态加载 JS 模块
2. **便于分发** - 单文件易于下载、分享、导入
3. **易于解析** - JSON 原生支持，无需额外工具
4. **安全可控** - 纯数据格式，不包含可执行代码

### 完整应用包结构

```typescript
interface PhoneAppPackage {
  // ===== 元信息 =====
  /** 应用包格式版本 */
  $schema: "https://phone-sim.app/schema/v1.json";
  
  /** 包格式版本 */
  packageVersion: "1.0";
  
  // ===== 基础信息 =====
  /** 应用唯一标识符 */
  id: string;
  
  /** 应用名称 */
  name: string;
  
  /** 应用版本 (语义化版本) */
  version: string;
  
  /** 应用描述 */
  description?: string;
  
  /** 作者信息 */
  author?: {
    name: string;
    email?: string;
    url?: string;
  };
  
  /** 应用主页/仓库地址 */
  homepage?: string;
  
  /** 许可证 */
  license?: string;
  
  /** 关键词 (用于搜索) */
  keywords?: string[];
  
  /** 分类 */
  category?: AppCategory;
  
  // ===== 图标与外观 =====
  /** 应用图标 */
  icon: {
    /** 图标类型 */
    type: "font" | "emoji" | "url" | "base64";
    /** 图标值 */
    value: string;
    /** 背景颜色/渐变 */
    background: string;
    /** 图标颜色（font 类型时使用） */
    color?: string;
  };
  
  // ===== 应用类型与配置 =====
  /** 应用类型 */
  appType: "configurable" | "template" | "composite";
  
  /** 配置式应用配置 */
  configurable?: ConfigurableAppConfig;
  
  /** 模板式应用配置 */
  template?: TemplateAppConfig;
  
  /** 组合式应用配置 */
  composite?: CompositeAppConfig;
  
  // ===== 数据与状态 =====
  /** 数据源配置 */
  dataSource?: DataSourceConfig;
  
  /** 初始状态 */
  initialState?: Record<string, any>;
  
  /** 持久化配置 */
  persistence?: {
    /** 存储键名 */
    key: string;
    /** 存储类型 */
    type: "chat" | "global";
    /** 需要持久化的字段 */
    fields?: string[];
  };
  
  // ===== AI 集成 =====
  /** AI 命令配置 */
  aiCommands?: AICommandConfig[];
  
  /** 内置提示词 */
  prompts?: AppPromptDefinition[];
  
  // ===== 帮助与教程 =====
  /** 应用自带教程 */
  tutorials?: AppTutorial[];
  
  // ===== 权限声明 =====
  /** 所需权限 */
  permissions?: AppPermission[];
  
  // ===== 兼容性 =====
  /** 最低兼容的小手机版本 */
  minPhoneVersion?: string;
  
  /** 依赖的其他应用 */
  dependencies?: {
    [appId: string]: string; // 版本范围
  };
}

// ===== 子类型定义 =====

type AppCategory = 
  | "social"       // 社交
  | "tools"        // 工具
  | "entertainment" // 娱乐
  | "productivity" // 效率
  | "lifestyle"    // 生活
  | "games"        // 游戏
  | "other";       // 其他

type AppPermission =
  | "storage"        // 存储数据
  | "ai-generate"    // 调用 AI 生成
  | "notifications"  // 发送通知
  | "contacts"       // 访问联系人
  | "messages"       // 访问消息
  | "camera"         // 使用相机（虚拟）
  | "location";      // 使用位置（虚拟）

interface DataSourceConfig {
  /** 数据源类型 */
  type: "static" | "worldbook" | "ai-generated" | "api";
  
  /** 静态数据 */
  staticData?: any[];
  
  /** Worldbook 键名 */
  worldbookKey?: string;
  
  /** AI 生成配置 */
  aiGenerate?: {
    promptScene: string;
    variables?: Record<string, string>;
    cacheKey?: string;
    cacheDuration?: number;
  };
  
  /** API 配置（仅限允许的域名） */
  apiConfig?: {
    url: string;
    method?: "GET" | "POST";
    headers?: Record<string, string>;
  };
}

interface AICommandConfig {
  /** 命令触发的应用名称（AI 输出中的 app_name） */
  appName: string;
  /** 命令类型 */
  type: string;
  /** 处理动作 */
  action: CommandAction;
}

type CommandAction =
  | { type: "navigate"; path: string }
  | { type: "updateState"; updates: Record<string, any> }
  | { type: "addItem"; target: string; item: any }
  | { type: "removeItem"; target: string; id: string }
  | { type: "notify"; message: string };

interface AppTutorial {
  /** 教程唯一标识（安装时会自动添加应用ID前缀） */
  id: string;
  
  /** 教程标题 */
  title: string;
  
  /** 简短描述 */
  description: string;
  
  /** 图标（emoji），默认使用应用图标 */
  icon?: string;
  
  /** Markdown 内容 */
  content: string;
  
  /** 排序序号 */
  order?: number;
  
  /** 预计阅读时间（分钟） */
  readTime?: number;
  
  /** 标签 */
  tags?: string[];
}
```

### 示例：备忘录应用

```json
{
  "$schema": "https://phone-sim.app/schema/v1.json",
  "packageVersion": "1.0",
  
  "id": "com.example.notes",
  "name": "备忘录",
  "version": "1.0.0",
  "description": "简单易用的备忘录应用",
  "author": {
    "name": "示例作者",
    "url": "https://github.com/example"
  },
  "license": "MIT",
  "keywords": ["备忘", "笔记", "记录"],
  "category": "productivity",
  
  "icon": {
    "type": "font",
    "value": "fas fa-sticky-note",
    "background": "linear-gradient(135deg, #FFD60A 0%, #FF9500 100%)",
    "color": "#FFFFFF"
  },
  
  "appType": "configurable",
  "configurable": {
    "layout": "list",
    "listConfig": {
      "titleField": "title",
      "subtitleField": "preview",
      "timeField": "updatedAt",
      "emptyText": "暂无备忘录",
      "emptyIcon": "fas fa-sticky-note"
    },
    "itemActions": [
      { "icon": "fas fa-edit", "action": "edit" },
      { "icon": "fas fa-trash", "action": "delete", "confirm": true }
    ],
    "floatingButton": {
      "icon": "fas fa-plus",
      "action": "create"
    }
  },
  
  "dataSource": {
    "type": "worldbook",
    "worldbookKey": "phone_notes"
  },
  
  "initialState": {
    "notes": []
  },
  
  "persistence": {
    "key": "notes_app_data",
    "type": "chat",
    "fields": ["notes"]
  },
  
  "aiCommands": [
    {
      "appName": "备忘录",
      "type": "新建",
      "action": {
        "type": "addItem",
        "target": "notes",
        "item": {
          "id": "{{$uuid}}",
          "title": "{{title}}",
          "content": "{{content}}",
          "createdAt": "{{$now}}",
          "updatedAt": "{{$now}}"
        }
      }
    }
  ],
  
  "prompts": [
    {
      "scene": "notes.generate",
      "name": "生成备忘录",
      "description": "根据主题生成备忘录内容",
      "category": "system",
      "template": "请帮我生成一条关于「{{topic}}」的备忘录...",
      "availableVariables": [
        { "name": "topic", "description": "备忘主题", "type": "string", "required": true }
      ]
    }
  ],
  
  "tutorials": [
    {
      "id": "getting-started",
      "title": "备忘录入门",
      "description": "快速了解如何使用备忘录应用",
      "icon": "📝",
      "order": 1,
      "readTime": 2,
      "tags": ["入门", "基础"],
      "content": "# 备忘录入门\n\n欢迎使用备忘录应用！\n\n## 创建备忘\n\n点击右下角的 **+** 按钮即可创建新备忘录。\n\n## 编辑与删除\n\n- 点击备忘录可查看详情\n- 左滑可以删除\n- 点击编辑按钮可修改内容"
    },
    {
      "id": "ai-features",
      "title": "AI 智能功能",
      "description": "使用 AI 自动生成备忘录内容",
      "icon": "🤖",
      "order": 2,
      "readTime": 3,
      "tags": ["AI", "高级"],
      "content": "# AI 智能功能\n\n备忘录支持 AI 智能生成功能。\n\n## 如何使用\n\n1. 创建新备忘录时，点击「AI 生成」按钮\n2. 输入主题关键词\n3. AI 会自动为你生成内容\n\n## 提示技巧\n\n- 主题越具体，生成效果越好\n- 可以指定格式，如「清单」「大纲」等"
    }
  ],
  
  "permissions": ["storage", "ai-generate"],
  
  "minPhoneVersion": "2.0.0"
}
```

### 示例：待办事项应用

```json
{
  "$schema": "https://phone-sim.app/schema/v1.json",
  "packageVersion": "1.0",
  
  "id": "com.example.todo",
  "name": "待办事项",
  "version": "1.0.0",
  "description": "管理你的日常任务",
  "category": "productivity",
  
  "icon": {
    "type": "font",
    "value": "fas fa-check-circle",
    "background": "#34C759",
    "color": "#FFFFFF"
  },
  
  "appType": "composite",
  "composite": {
    "pages": [
      {
        "path": "/",
        "name": "TodoList",
        "components": [
          {
            "type": "Header",
            "props": {
              "title": "待办事项",
              "rightAction": {
                "icon": "fas fa-plus",
                "action": "navigate:/add"
              }
            }
          },
          {
            "type": "TabBar",
            "props": {
              "tabs": [
                { "id": "all", "label": "全部" },
                { "id": "pending", "label": "待完成" },
                { "id": "done", "label": "已完成" }
              ],
              "defaultTab": "all"
            }
          },
          {
            "type": "List",
            "props": {
              "dataKey": "todos",
              "filter": "{{activeTab === 'all' ? null : (activeTab === 'done' ? item.done : !item.done)}}",
              "itemTemplate": {
                "type": "TodoItem",
                "props": {
                  "title": "{{item.title}}",
                  "done": "{{item.done}}",
                  "onToggle": "toggleTodo:{{item.id}}"
                }
              },
              "emptyText": "暂无待办事项"
            }
          }
        ]
      },
      {
        "path": "/add",
        "name": "AddTodo",
        "components": [
          {
            "type": "Header",
            "props": {
              "title": "新建待办",
              "showBack": true
            }
          },
          {
            "type": "Form",
            "props": {
              "fields": [
                {
                  "name": "title",
                  "label": "标题",
                  "type": "text",
                  "required": true,
                  "placeholder": "输入待办事项..."
                },
                {
                  "name": "dueDate",
                  "label": "截止日期",
                  "type": "date"
                },
                {
                  "name": "priority",
                  "label": "优先级",
                  "type": "select",
                  "options": [
                    { "value": "low", "label": "低" },
                    { "value": "medium", "label": "中" },
                    { "value": "high", "label": "高" }
                  ]
                }
              ],
              "submitButton": {
                "text": "创建",
                "action": "createTodo"
              }
            }
          }
        ]
      }
    ],
    "actions": {
      "toggleTodo": {
        "type": "updateItem",
        "target": "todos",
        "field": "done",
        "value": "{{!item.done}}"
      },
      "createTodo": {
        "type": "addItem",
        "target": "todos",
        "item": {
          "id": "{{$uuid}}",
          "title": "{{form.title}}",
          "dueDate": "{{form.dueDate}}",
          "priority": "{{form.priority || 'medium'}}",
          "done": false,
          "createdAt": "{{$now}}"
        },
        "then": "navigate:/"
      }
    }
  },
  
  "initialState": {
    "todos": [],
    "activeTab": "all"
  },
  
  "persistence": {
    "key": "todo_app_data",
    "type": "chat"
  },
  
  "permissions": ["storage"]
}
```

---

## 应用清单文件

### 清单结构

应用包中的核心清单信息：

```typescript
interface AppManifest {
  // 必填字段
  id: string;           // 唯一标识符，推荐反向域名格式
  name: string;         // 显示名称
  version: string;      // 语义化版本号
  appType: string;      // 应用类型
  icon: IconConfig;     // 图标配置
  
  // 可选字段
  description?: string;
  author?: AuthorInfo;
  category?: AppCategory;
  keywords?: string[];
  permissions?: AppPermission[];
  minPhoneVersion?: string;
}
```

### ID 命名规范

```
格式: <组织>.<应用名>
示例: 
  - com.example.notes
  - io.github.username.myapp
  - org.community.todo
```

**规则：**
- 使用小写字母、数字和点号
- 反向域名格式
- 应用名使用连字符或下划线
- 长度不超过 64 字符

### 版本号规范

遵循语义化版本 (SemVer)：

```
主版本.次版本.修订版本[-预发布版本]

示例:
  1.0.0       - 正式版
  1.0.1       - 修复 bug
  1.1.0       - 新功能
  2.0.0       - 不兼容更新
  2.0.0-beta  - 预发布版本
```

---

## 应用来源与分发

### 来源类型与信任级别

不同来源的应用有不同的信任级别，这决定了身份验证方式和数据隔离策略：

```
┌─────────────────────────────────────────────────────────────┐
│                    应用来源与信任级别                        │
├─────────────────────────────────────────────────────────────┤
│  🏠 内置应用                          信任级别: full        │
│     └─ 系统核心应用，预装在小手机中                           │
│     └─ ✅ 编译时保证，完全信任                               │
├─────────────────────────────────────────────────────────────┤
│  📦 官方商店                          信任级别: repository  │
│     └─ 从官方仓库下载，经过审核的应用                         │
│     └─ ✅ 仓库签名验证，开发者身份由仓库担保                   │
├─────────────────────────────────────────────────────────────┤
│  🌐 社区仓库                          信任级别: repository  │
│     └─ 第三方维护的应用仓库                                  │
│     └─ ✅ 需先添加信任仓库，仓库签名验证                       │
├─────────────────────────────────────────────────────────────┤
│  🔗 URL 导入                          信任级别: tofu        │
│     └─ 从指定 URL 下载应用包                                 │
│     └─ ⚠️ 首次信任(TOFU)，记录 URL + 内容哈希                │
├─────────────────────────────────────────────────────────────┤
│  📁 本地导入                          信任级别: untrusted   │
│     └─ 用户从本地文件导入 .phoneapp.json                     │
│     └─ ❌ 无法验证身份，完全隔离数据                          │
└─────────────────────────────────────────────────────────────┘
```

> 详细的身份识别设计请参阅 [App 身份识别设计文档](../dev/app-identity-design.md)

### 应用仓库索引格式

```typescript
interface AppRegistry {
  /** 仓库元信息 */
  registry: {
    name: string;
    description: string;
    version: string;
    lastUpdated: string;
    maintainer: {
      name: string;
      url?: string;
    };
  };
  
  /** 应用列表 */
  apps: AppRegistryEntry[];
  
  /** 分类信息 */
  categories: {
    id: AppCategory;
    name: string;
    icon: string;
    count: number;
  }[];
  
  /** 精选/推荐 */
  featured?: string[];  // app ids
}

interface AppRegistryEntry {
  /** 应用 ID */
  id: string;
  
  /** 应用名称 */
  name: string;
  
  /** 当前版本 */
  version: string;
  
  /** 简短描述 */
  description: string;
  
  /** 分类 */
  category: AppCategory;
  
  /** 图标 */
  icon: IconConfig;
  
  /** 作者 */
  author: string;
  
  /** 下载量 */
  downloads?: number;
  
  /** 评分 */
  rating?: number;
  
  /** 更新时间 */
  updatedAt: string;
  
  /** 包下载地址 */
  packageUrl: string;
  
  /** 包大小 (bytes) */
  packageSize?: number;
  
  /** SHA256 校验和 */
  checksum?: string;
  
  /** 截图 */
  screenshots?: string[];
  
  /** 所需权限 */
  permissions?: AppPermission[];
  
  /** 兼容性 */
  minPhoneVersion?: string;
}
```

### 官方仓库 URL

```
主索引:  https://raw.githubusercontent.com/phone-sim/app-store/main/registry.json
应用包:  https://raw.githubusercontent.com/phone-sim/app-store/main/apps/{id}/app.phoneapp.json
```

---

## 安装与生命周期

### 安装流程

```
┌─────────────────────────────────────────────────────────────┐
│                        安装流程                             │
└─────────────────────────────────────────────────────────────┘

1. 获取应用包
   ↓
2. 验证包格式
   ├─ 检查 $schema 版本
   ├─ 验证必填字段
   └─ 验证 checksum (如有)
   ↓
3. 检查兼容性
   ├─ minPhoneVersion
   └─ 依赖检查
   ↓
4. 权限确认
   ├─ 显示所需权限
   └─ 用户确认
   ↓
5. 安装应用
   ├─ 保存到已安装列表
   ├─ 注册路由
   ├─ 注册提示词
   ├─ 注册教程到帮助中心
   └─ 初始化状态
   ↓
6. 添加到桌面
   └─ 更新 HomeScreen
```

### 应用状态

```typescript
type AppStatus = 
  | "not-installed"  // 未安装
  | "installing"     // 安装中
  | "installed"      // 已安装
  | "updating"       // 更新中
  | "disabled"       // 已禁用
  | "error";         // 错误状态

interface InstalledApp {
  /** 应用 ID */
  id: string;
  
  /** 安装版本 */
  version: string;
  
  /** 安装时间 */
  installedAt: string;
  
  /** 更新时间 */
  updatedAt?: string;
  
  /** 来源 */
  source: "builtin" | "official" | "community" | "local" | "url";
  
  /** 来源 URL */
  sourceUrl?: string;
  
  /** 状态 */
  status: AppStatus;
  
  /** 应用包数据 */
  package: PhoneAppPackage;
  
  /** 用户授予的权限 */
  grantedPermissions: AppPermission[];
  
  /** 用户数据 */
  userData?: any;
}

/** 扩展版（包含身份识别信息） */
interface InstalledAppExtended extends InstalledApp {
  /** 应用来源详情 */
  sourceInfo: AppSourceInfo;
  
  /** 安装ID（随机生成，用于本地应用数据隔离） */
  installationId: string;
  
  /** 数据命名空间（计算得出） */
  dataNamespace: string;
  
  /** 当前数据版本 */
  currentDataVersion: number;
  
  /** 数据迁移历史 */
  migrationHistory?: MigrationRecord[];
  
  /** 验证状态 */
  verificationStatus: VerificationStatus;
}
```

### 生命周期钩子

虽然应用包是纯 JSON 格式，但系统提供了预定义的生命周期动作：

```typescript
interface AppLifecycleConfig {
  /** 安装后执行 */
  onInstall?: LifecycleAction[];
  
  /** 卸载前执行 */
  onUninstall?: LifecycleAction[];
  
  /** 启动时执行 */
  onActivate?: LifecycleAction[];
  
  /** 后台时执行 */
  onDeactivate?: LifecycleAction[];
  
  /** 更新后执行 */
  onUpdate?: LifecycleAction[];
}

type LifecycleAction =
  | { type: "initState"; state: Record<string, any> }
  | { type: "migrateData"; from: string; to: string }
  | { type: "clearData"; keys: string[] }
  | { type: "showWelcome"; message: string }
  | { type: "notify"; title: string; body: string };
```

### 教程注册机制

应用安装时，系统会自动将应用的 `tutorials` 注册到「使用帮助」应用中：

```typescript
// 教程注册逻辑（系统内部）
function registerAppTutorials(app: InstalledApp) {
  const tutorials = app.package.tutorials || [];
  
  tutorials.forEach(tutorial => {
    // 为教程ID添加应用前缀，避免冲突
    const fullId = `${app.id}:${tutorial.id}`;
    
    // 注册到帮助中心
    tutorialStore.registerTutorial({
      id: fullId,
      categoryId: 'installed-apps',  // 归类到「已安装应用」分类
      title: tutorial.title,
      description: tutorial.description,
      icon: tutorial.icon || app.package.icon.value,
      content: tutorial.content,
      order: tutorial.order || 0,
      readTime: tutorial.readTime,
      tags: tutorial.tags,
      // 来源追踪
      source: {
        type: 'app',
        appId: app.id,
        appName: app.package.name
      }
    });
  });
}

// 卸载时自动移除
function unregisterAppTutorials(appId: string) {
  tutorialStore.removeTutorialsByApp(appId);
}
```

**教程分类管理：**

```
使用帮助
├── 📱 入门指南          # 内置分类
├── 💡 功能介绍          # 内置分类
├── ⚙️ 设置与个性化      # 内置分类
└── 📦 已安装应用        # 动态分类（自动生成）
    ├── 📝 备忘录
    │   ├── 备忘录入门
    │   └── AI 智能功能
    └── ✅ 待办事项
        └── 任务管理指南
```

---

## 安全与权限

### 权限说明

| 权限 | 标识 | 说明 | 风险等级 |
| ------ | ------ | ------ | ---------- |
| 存储 | `storage` | 读写应用数据 | 🟢 低 |
| AI 生成 | `ai-generate` | 调用 AI 生成内容 | 🟡 中 |
| 通知 | `notifications` | 发送系统通知 | 🟢 低 |
| 联系人 | `contacts` | 访问联系人数据 | 🟡 中 |
| 消息 | `messages` | 访问聊天消息 | 🔴 高 |
| 相机 | `camera` | 使用虚拟相机 | 🟢 低 |
| 位置 | `location` | 使用虚拟位置 | 🟢 低 |

### 权限请求 UI

```
┌─────────────────────────────────────────┐
│  📦 备忘录 想要获取以下权限：           │
├─────────────────────────────────────────┤
│                                         │
│  💾 存储                                │
│     用于保存你的备忘录                   │
│                                         │
│  🤖 AI 生成                             │
│     用于智能生成备忘录内容               │
│                                         │
├─────────────────────────────────────────┤
│  [拒绝]                    [允许]       │
└─────────────────────────────────────────┘
```

### 安全沙箱

由于应用是配置式的，没有可执行代码，安全性主要体现在：

1. **数据隔离** - 每个应用根据来源分配独立的数据命名空间
2. **权限控制** - 未授权的权限无法使用
3. **模板沙箱** - 模板表达式只能使用预定义函数
4. **URL 白名单** - API 请求只能访问允许的域名
5. **身份验证** - 仓库应用通过签名验证，防止身份伪造

### 数据命名空间

不同来源的应用使用不同的数据命名空间，确保数据隔离：

| 来源类型 | 命名空间格式 | 示例 |
| ---------- | -------------- | ------ |
| 内置应用 | `builtin/{appId}` | `builtin/calculator` |
| 仓库应用 | `repo/{repoId}/{developerId}/{appId}` | `repo/official/calc-team/super-calc` |
| URL 导入 | `url/{domain}/{contentHash}` | `url/example.com/a1b2c3d4` |
| 本地导入 | `local/{installationId}` | `local/inst_x7y8z9` |

这意味着：
- 同名但不同开发者的应用数据完全隔离
- 同开发者的应用更新可以继承数据
- 本地导入的应用每次都是独立的数据空间

### 模板表达式白名单

```typescript
const allowedFunctions = {
  // 字符串
  'substring', 'toLowerCase', 'toUpperCase', 'trim', 'split', 'join',
  
  // 数组
  'length', 'filter', 'map', 'find', 'includes', 'indexOf',
  
  // 数学
  'Math.min', 'Math.max', 'Math.floor', 'Math.ceil', 'Math.round',
  
  // 日期
  'Date.now', 'new Date',
  
  // 内置变量
  '$uuid',      // 生成 UUID
  '$now',       // 当前时间戳
  '$today',     // 今天日期
  '$random',    // 随机数
};
```

---

## 应用商店 UI

### 商店首页

```
┌─────────────────────────────────────────┐
│ ← 应用商店                    🔍        │
├─────────────────────────────────────────┤
│                                         │
│ 🌟 精选应用                             │
│ ┌─────┐ ┌─────┐ ┌─────┐                │
│ │ 📝  │ │ ✅  │ │ 📊  │                │
│ │备忘录│ │待办 │ │记账 │                │
│ └─────┘ └─────┘ └─────┘                │
│                                         │
│ 📂 分类                                 │
│ ┌─────────────────────────────────────┐ │
│ │ 🛠 工具  📱 社交  🎮 游戏  📈 效率  │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ 🔥 热门应用                             │
│ ┌─────────────────────────────────────┐ │
│ │ 📝 备忘录          v1.0.0  [安装]   │ │
│ │    简单易用的备忘录                   │ │
│ ├─────────────────────────────────────┤ │
│ │ ✅ 待办事项        v1.2.0  [安装]   │ │
│ │    管理你的日常任务                   │ │
│ └─────────────────────────────────────┘ │
│                                         │
└─────────────────────────────────────────┘
```

### 应用详情页

```
┌─────────────────────────────────────────┐
│ ←                                       │
├─────────────────────────────────────────┤
│                                         │
│         ┌───────┐                       │
│         │  📝   │                       │
│         │       │                       │
│         └───────┘                       │
│          备忘录                          │
│     v1.0.0 · 示例作者                    │
│                                         │
│   [════════════════════]  [安装]        │
│                                         │
├─────────────────────────────────────────┤
│                                         │
│ 📖 简介                                 │
│ 简单易用的备忘录应用，帮助你记录         │
│ 日常的想法和待办事项。                   │
│                                         │
│ 📸 截图                                 │
│ ┌─────┐ ┌─────┐ ┌─────┐                │
│ │     │ │     │ │     │                │
│ └─────┘ └─────┘ └─────┘                │
│                                         │
│ 🔐 权限                                 │
│ • 存储 - 保存备忘录数据                  │
│ • AI 生成 - 智能生成内容                 │
│                                         │
│ ℹ️ 信息                                 │
│ • 大小: 2.3 KB                          │
│ • 更新: 2024-01-15                      │
│ • 许可: MIT                             │
│ • 下载: 1,234                           │
│                                         │
└─────────────────────────────────────────┘
```

### 已安装管理

```
┌─────────────────────────────────────────┐
│ ← 已安装应用                            │
├─────────────────────────────────────────┤
│                                         │
│ 📱 内置应用 (8)                         │
│ ┌─────────────────────────────────────┐ │
│ │ 💬 微信                   [运行中]  │ │
│ │ 📧 邮件                   [运行中]  │ │
│ │ 🌐 浏览器                           │ │
│ │ 📺 直播                             │ │
│ │ ⚙️ 设置                             │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ 📦 已安装 (2)                           │
│ ┌─────────────────────────────────────┐ │
│ │ 📝 备忘录  v1.0.0         [卸载]    │ │
│ │    安装于 2024-01-15                 │ │
│ ├─────────────────────────────────────┤ │
│ │ ✅ 待办事项 v1.2.0  🔄    [卸载]    │ │
│ │    有新版本可用                       │ │
│ └─────────────────────────────────────┘ │
│                                         │
└─────────────────────────────────────────┘
```

---

## 官方仓库结构

### GitHub 仓库组织

```
phone-sim/app-store/
├── README.md                    # 仓库说明
├── CONTRIBUTING.md              # 贡献指南
├── registry.json                # 应用索引
├── schema/
│   └── v1.json                  # 应用包 JSON Schema
├── apps/
│   ├── com.example.notes/
│   │   ├── app.phoneapp.json    # 应用包
│   │   ├── README.md            # 应用说明
│   │   ├── CHANGELOG.md         # 更新日志
│   │   └── screenshots/         # 截图
│   │       ├── 1.png
│   │       └── 2.png
│   └── com.example.todo/
│       ├── app.phoneapp.json
│       └── ...
├── categories/
│   └── icons/                   # 分类图标
└── .github/
    └── workflows/
        └── validate.yml         # CI 验证
```

### registry.json 示例

```json
{
  "registry": {
    "name": "小手机官方应用商店",
    "description": "官方维护的应用仓库",
    "version": "1.0.0",
    "lastUpdated": "2024-01-15T10:00:00Z",
    "maintainer": {
      "name": "Phone Sim Team",
      "url": "https://github.com/phone-sim"
    }
  },
  "apps": [
    {
      "id": "com.example.notes",
      "name": "备忘录",
      "version": "1.0.0",
      "description": "简单易用的备忘录应用",
      "category": "productivity",
      "icon": {
        "type": "font",
        "value": "fas fa-sticky-note",
        "background": "#FFD60A"
      },
      "author": "示例作者",
      "downloads": 1234,
      "rating": 4.5,
      "updatedAt": "2024-01-15T10:00:00Z",
      "packageUrl": "https://raw.githubusercontent.com/phone-sim/app-store/main/apps/com.example.notes/app.phoneapp.json",
      "packageSize": 2345,
      "checksum": "sha256:abc123...",
      "screenshots": [
        "https://raw.githubusercontent.com/phone-sim/app-store/main/apps/com.example.notes/screenshots/1.png"
      ],
      "permissions": ["storage", "ai-generate"],
      "minPhoneVersion": "2.0.0"
    }
  ],
  "categories": [
    { "id": "social", "name": "社交", "icon": "fas fa-users", "count": 5 },
    { "id": "tools", "name": "工具", "icon": "fas fa-wrench", "count": 12 },
    { "id": "productivity", "name": "效率", "icon": "fas fa-chart-line", "count": 8 }
  ],
  "featured": ["com.example.notes", "com.example.todo"]
}
```

### 贡献流程

1. Fork 官方仓库
2. 在 `apps/` 目录创建应用文件夹
3. 添加 `app.phoneapp.json` 应用包
4. 提交 PR
5. CI 自动验证格式
6. 维护者审核后合并
7. 自动更新 `registry.json`

---

## 实施计划

### Phase 1: 基础设施 ✅

- [x] 定义 `PhoneAppPackage` TypeScript 类型
- [x] 定义 `InstalledAppExtended` 扩展类型（含身份识别）
- [ ] 创建 JSON Schema 验证器
- [ ] 实现应用包解析器
- [ ] 实现配置式应用渲染器

### Phase 2: 应用管理 ✅

- [x] 创建 `appStoreStore` 状态管理
- [x] 实现应用安装/卸载逻辑
- [x] 实现权限请求系统
- [x] 实现应用持久化存储

### Phase 2.5: 身份识别与数据隔离 ✅

- [x] 实现 `AppSourceInfo` 类型定义
- [x] 实现 `calculateDataNamespace` 命名空间计算
- [x] 实现 `AppDataService` 隔离存储服务
- [x] 实现 `verifyAndInstall` 安装验证
- [x] 实现 `verifyUpdate` 更新验证
- [x] 实现 `executeDataMigration` 数据迁移
- [x] 集成身份验证到 `appStoreStore`

### Phase 3: 商店 UI

- [ ] 商店首页
- [ ] 应用详情页
- [ ] 已安装管理页
- [ ] 搜索功能
-任级别显示
- [ ] 安装警告对话框

### Phase 4: 分发系统

- [ ] 创建官方 GitHub 仓库
- [ ] 实现仓库索引获取
- [ ] 实现应用下载与更新
- [x] URL 导入功能（含 TOFU 验证）
- [x] 本地导入功能（含警告提示）

### Phase 5: 高级功能

- [ ] 模板式应用支持
- [ ] 组合式应用支持
- [ ] 应用评分与评论
- [ ] 社区仓库支持
- [ ] Ed25519 签名验证（完整实现）

---

## 更新日志

| 日期 | 更新内容 |
| ------ | --------- |
| 2024-12-05 | 初稿创建，定义应用包格式规范、应用类型、分发机制 |
| 2024-12-05 | 新增应用自带教程功能，支持安装时自动注册到帮助中心 |
| 2024-12-27 | 集成身份识别与数据隔离机制，更新来源类型说明和实施计划 |