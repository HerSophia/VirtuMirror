# Settings 应用文档

> 系统设置应用，提供设备配置、主题定制、关于手机等功能。
> 采用“设置即平台”架构，支持其他模块动态注册设置项。

## 目录结构

```
src/apps/settings/
├── components/              # 通用 UI 组件
│   ├── SettingsGroup.vue    # 设置分组容器
│   ├── SettingsItem.vue     # 设置项组件
│   ├── ToggleSwitch.vue     # 开关组件
│   ├── SliderControl.vue    # 滑块组件
│   ├── DropdownSelect.vue   # 下拉选择组件
│   └── index.ts             # 组件导出
├── pages/                   # [新增] 独立设置子页面
│   ├── AppManagement.vue        # 应用管理 (App Identity)
│   ├── DisplaySettings.vue      # 显示与亮度
│   ├── GeneralSettings.vue      # 通用设置
│   └── NotificationSettings.vue # 通知设置
├── sections/                # [遗留] 旧版分区组件 (现被 pages 引用，逐步迁移)
│   ├── PersonalSection.vue  # 个人设置 (SettingsApp 头部使用)
│   ├── ThemeSection.vue     # 主题与外观
│   ├── NavigationSection.vue# 导航设置
│   ├── DeviceSection.vue    # 设备模式
│   ├── ScaleSection.vue     # 显示缩放
│   ├── GeneralSection.vue   # 通用+危险操作+系统
│   └── index.ts             # 分区导出
├── services/                # [新增] 设置服务
│   ├── builtin.ts           # 内置设置项注册
│   └── index.ts
├── SettingsApp.vue          # [重构] 动态渲染主入口
├── ThemeEditor.vue          # 主题编辑器
├── AboutPhone.vue           # 关于手机页面
└── index.ts                 # 统一导出入口
```

## 架构设计

### 设置即平台 (Settings as a Platform)

设置应用现在作为一个**宿主容器**，核心职责是渲染由 `SettingsRegistry` 提供的设置项列表。系统服务（如 WiFi、蓝牙、通知）和独立应用可以通过注册机制，将自己的设置入口添加到设置应用中，而无需修改 `SettingsApp.vue` 的源码。

**核心组件：**

1.  **SettingsRegistryService** (`src/services/settings/settingsRegistry.ts`):
    *   全局单例服务，维护所有注册的设置项。
    *   管理设置分类（Connectivity, Personalization, Apps, System 等）。
    *   提供按分类分组的设置项列表供 UI 渲染。

2.  **SettingsApp.vue**:
    *   **动态渲染**：监听 Registry 的变化，动态生成 UI。
    *   **个人信息区**：保留 `PersonalSection` 作为顶部常驻区域。
    *   **版本信息**：底部显示系统版本。

### 注册机制

任何模块想要在设置中添加入口，只需调用 `settingsRegistry.register()`。

**接口定义：**

```typescript
export interface SettingsEntry {
  id: string              // 唯一标识
  title: string           // 显示标题
  subtitle?: string       // 副标题（可选）
  icon?: {                // 图标配置
    type: 'fontawesome' | 'image' | 'text'
    value: string
    backgroundColor?: string
    color?: string
  }
  category: SettingsCategory // 分类
  priority?: number       // 排序优先级
  action?: {              // 交互动作
    type: 'route' | 'click' | 'toggle'
    value: string | (() => void) | Ref<boolean>
  }
}
```

**分类定义 (SettingsCategory)：**
- `connectivity`: 网络与连接
- `personalization`: 个性化
- `apps`: 应用管理
- `privacy`: 隐私与安全
- `system`: 系统
- `other`: 其他

### 内置设置项

为了保持系统基础功能，`src/apps/settings/services/builtin.ts` 负责注册核心的内置设置项：
- **显示与亮度** -> `/settings/display`
- **通知** -> `/settings/notifications`
- **应用管理** -> `/settings/apps`
- **通用** -> `/settings/general`
- **关于本机** -> `/settings/about`

这些入口指向了 `src/apps/settings/pages/` 下的具体实现页面。

---

## 页面与功能详解

### 1. 主界面 (SettingsApp.vue)
- 顶部显示用户头像和昵称 (`PersonalSection`)。
- 下方根据 Registry 动态渲染分组列表。
- 底部显示系统版本号。

### 2. 显示与亮度 (DisplaySettings.vue)
- **依赖**：`ThemeSection`, `ScaleSection`
- **功能**：
    - 主题切换 (Light/Dark)
    - 壁纸设置
    - 屏幕缩放比例调整
    - DPR 显示

### 3. 通用设置 (GeneralSettings.vue)
- **依赖**：`NavigationSection`, `DeviceSection`, `GeneralSection`
- **功能**：
    - 导航方式切换（手势/三键）
    - 设备模式切换（手机/平板/桌面）
    - 屏幕方向（横屏/竖屏）
    - 静音模式
    - 重置 UI / 重置数据

### 4. 通知设置 (NotificationSettings.vue)
- **依赖**：`NotificationStore`, `AppStoreStore`
- **功能**：
    - 全局通知开关
    - 勿扰模式 (DND) 开关
    - **应用列表**：集成 `AppStoreStore`，列出所有已安装应用，支持针对每个应用的通知权限管理。

### 5. 应用管理 (AppManagement.vue)
- **依赖**：`AppStoreStore`
- **功能**：
    - 默认应用设置（浏览器、电话、短信）
    - **已安装应用列表**：展示应用名称、图标以及**来源信息**（如“官方商店”、“内置”）。这是 App Identity 系统的前端展示部分。

---

## 开发指南

### 如何添加新的设置页面

1.  **创建页面组件**：
    在 `src/apps/settings/pages/` 下创建新的 Vue 组件，例如 `BluetoothSettings.vue`。可以使用 `SettingsGroup` 和 `SettingsItem` 快速构建 UI。

    ```vue
    <template>
      <div class="page-container">
        <PageHeader title="蓝牙" />
        <SettingsGroup>
          <SettingsItem label="开启蓝牙">
            <template #right><ToggleSwitch v-model="enabled" /></template>
          </SettingsItem>
        </SettingsGroup>
      </div>
    </template>
    ```

2.  **配置路由**：
    在 `src/router/index.ts` 中添加路由规则。

    ```typescript
    {
      path: '/settings/bluetooth',
      component: () => import('@/apps/settings/pages/BluetoothSettings.vue'),
      meta: { title: '蓝牙设置' }
    }
    ```

3.  **注册入口**：
    在对应的服务初始化代码中（或者 `builtin.ts` 中）注册入口。

    ```typescript
    settingsRegistry.register({
      id: 'bluetooth',
      title: '蓝牙',
      icon: { type: 'fontawesome', value: 'fa-bluetooth', backgroundColor: '#007AFF' },
      category: 'connectivity',
      action: { type: 'route', value: '/settings/bluetooth' }
    })
    ```

### 如何复用通用组件

`src/apps/settings/components/` 下的组件设计为通用组件，可在任何 App 中使用。

```typescript
import { SettingsGroup, SettingsItem, ToggleSwitch } from '@/apps/settings/components'
```

详细 API 请参考旧版文档或源码类型定义。

---

## 主题图标系统

### 多主题图标支持

设置应用的主题切换功能涉及到图标系统的渲染。不同主题使用不同的图标字体：

| 主题 | 图标字体 | 示例 |
| ------ | ---------- | ------ |
| iOS | FontAwesome | `fas fa-envelope` |
| Material You (Android) | Material Symbols | `mail` |
| 深色模式 | FontAwesome | `fas fa-envelope` |
| 赛博朋克 | FontAwesome | `fas fa-envelope` |
| 复古诺基亚 | FontAwesome | `fas fa-comment-dots` |

### 图标渲染逻辑

`DynamicAppIcon.vue` 组件负责根据当前主题自动选择正确的渲染方式：

1. **FontAwesome 图标**：使用 `<i class="fas fa-xxx">` 渲染
2. **Material Icons**：使用 `<span class="material-symbols-rounded">icon_name</span>` 渲染

判断逻辑：
- 检查主题配置中的 `icons.fontFamily`
- 如果是 `material-icons`，使用 Material Symbols 渲染
- 如果图标值包含 `fa-` 前缀，强制使用 FontAwesome 渲染

### 字体加载

两种图标字体都在 `index.html` 中通过 CDN 加载：

```html
<!-- FontAwesome 6 -->
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" />

<!-- Material Symbols Rounded -->
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,400,1,0" />
```

---

## 样式规范

设置应用遵循全局 CSS 变量规范，确保深色模式和主题切换的兼容性。

| CSS 变量 | 说明 |
| ---------- | ------ |
| `--color-background` | 页面背景 |
| `--color-surface` | 卡片/分组背景 |
| `--color-surface-variant` | 变体表面（Hover 态） |
| `--color-text` | 主文字 |
| `--color-text-secondary` | 次要文字 |
| `--color-border` | 边框分隔线 |
