# 图标服务 - 组件使用指南

本文档详细说明图标组件 `AppIcon` 和 `DynamicAppIcon` 的使用方法。

## 1. 组件概览

| 组件 | 用途 | 特点 |
| :--- | :--- | :--- |
| **AppIcon** | 桌面图标、App 列表 | 支持主题适配、特效类 |
| **DynamicAppIcon** | 通知、动态列表、任意场景 | 统一处理多种图标来源 |

**选择建议**：

- 需要主题适配（不同主题不同图标风格）→ 使用 `AppIcon`
- 需要显示任意来源的图标（注册表、配置、通知）→ 使用 `DynamicAppIcon`

---

## 2. AppIcon 组件

### 2.1 基本用法

```vue
<template>
  <AppIcon app-id="wechat" size="md" />
</template>

<script setup>
import AppIcon from '@/components/common/AppIcon.vue'
</script>
```

### 2.2 Props

| Prop | 类型 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- |
| `appId` | `string` | - | App ID，用于从主题获取图标配置 |
| `size` | `'xs' \ | 'sm' \ | 'md' \ | 'lg' \ | 'xl'` | `'md'` | 图标尺寸 |
| `badge` | `number` | - | 徽章数字（0 或负数不显示） |
| `customBg` | `string` | - | 自定义背景色（覆盖主题配置） |
| `customIcon` | `string` | - | 自定义图标类名（覆盖主题配置） |
| `icon` | `PackageIconConfig` | - | 应用包定义的图标配置（最高优先级） |

### 2.3 尺寸对照

| Size | 容器尺寸 | 文字大小 | 适用场景 |
| :--- | :--- | :--- | :--- |
| `xs` | 32px (w-8 h-8) | text-sm | 列表小图标 |
| `sm` | 40px (w-10 h-10) | text-lg | 紧凑列表 |
| `md` | 60px (w-[60px]) | text-2xl | **桌面图标（默认）** |
| `lg` | 80px (w-20 h-20) | text-3xl | 大图标展示 |
| `xl` | 96px (w-24 h-24) | text-4xl | 特大图标 |

### 2.4 使用示例

#### 基础使用

```vue
<template>
  <!-- 使用主题配置的图标 -->
  <AppIcon app-id="wechat" />
  <AppIcon app-id="weibo" size="lg" />
  
  <!-- 带徽章 -->
  <AppIcon app-id="messages" :badge="5" />
  <AppIcon app-id="mail" :badge="unreadCount" />
</template>
```

#### 自定义覆盖

```vue
<template>
  <!-- 覆盖背景色 -->
  <AppIcon 
    app-id="settings" 
    custom-bg="linear-gradient(135deg, #667eea, #764ba2)" 
  />
  
  <!-- 覆盖图标 -->
  <AppIcon 
    app-id="custom" 
    custom-icon="fas fa-rocket" 
    custom-bg="#ff6b6b"
  />
</template>
```

#### 使用应用包图标配置

```vue
<template>
  <!-- Emoji 图标 -->
  <AppIcon 
    app-id="my-app"
    :icon="{ type: 'emoji', value: '🚀', background: '#000' }"
  />
  
  <!-- 组件图标 -->
  <AppIcon 
    app-id="weibo"
    :icon="{ type: 'component', value: WeiboLogo, background: '#FF5722' }"
  />
</template>

<script setup>
import WeiboLogo from '@/components/icons/WeiboLogo.vue'
</script>
```

### 2.5 主题适配

AppIcon 会根据当前主题自动切换图标风格：

```typescript
// 主题配置示例
const iosTheme = {
  icons: {
    fontFamily: 'font-awesome',
    icons: {
      wechat: { icon: 'fab fa-weixin', bg: '#07C160', color: '#fff' },
      weibo: { icon: 'fab fa-weibo', bg: '#E6162D', color: '#fff' },
      // ...
    }
  }
}

const materialTheme = {
  icons: {
    fontFamily: 'material-icons',
    icons: {
      wechat: { icon: 'chat', bg: '#07C160', color: '#fff' },
      weibo: { icon: 'public', bg: '#E6162D', color: '#fff' },
      // ...
    }
  }
}
```

### 2.6 特效类

AppIcon 支持主题定义的特效类：

```css
/* 霓虹发光（赛博朋克主题） */
.neon-glow {
  box-shadow: 
    0 0 10px currentColor,
    0 0 20px currentColor,
    0 0 40px currentColor;
  animation: neon-pulse 2s ease-in-out infinite;
}

/* 像素风格（复古主题） */
.pixel-style {
  image-rendering: pixelated;
  border-radius: 4px !important;
}
```

---

## 3. DynamicAppIcon 组件

### 3.1 基本用法

```vue
<template>
  <!-- 通过 appId 自动获取 -->
  <DynamicAppIcon app-id="wechat" />
  
  <!-- 直接传入配置 -->
  <DynamicAppIcon :icon="{ type: 'emoji', value: '📱' }" />
</template>

<script setup>
import DynamicAppIcon from '@/components/common/DynamicAppIcon.vue'
</script>
```

### 3.2 Props

| Prop | 类型 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- |
| `appId` | `string` | - | 应用 ID，从 iconStore 获取图标 |
| `icon` | `UnifiedIconConfig` | - | 直接传入的图标配置 |
| `size` | `'xxs' \ | 'xs' \ | 'sm' \ | 'md' \ | 'lg' \ | 'xl'` | `'md'` | 图标尺寸 |
| `rounded` | `boolean` | `true` | 是否圆形 |
| `showBackground` | `boolean` | `true` | 是否显示背景 |
| `badge` | `number` | - | 徽章数字 |
| `customBg` | `string` | - | 自定义背景色 |
| `customColor` | `string` | - | 自定义图标颜色 |

### 3.3 尺寸对照

| Size | 容器尺寸 | 适用场景 |
| :--- | :--- | :--- |
| `xxs` | 16px (w-4 h-4) | 超小图标、内联 |
| `xs` | 24px (w-6 h-6) | 列表辅助图标 |
| `sm` | 32px (w-8 h-8) | 通知图标 |
| `md` | 40px (w-10 h-10) | **默认** |
| `lg` | 48px (w-12 h-12) | 强调图标 |
| `xl` | 64px (w-16 h-16) | 大图标展示 |

### 3.4 图标来源优先级

```text
1. icon prop（直接传入的配置）
   ↓
2. appId → iconStore.getIcon(appId).icon
   ↓
3. appId → currentTheme.icons[appId]
   ↓
4. 后备图标（问号）
```

### 3.5 使用示例

#### 从 IconStore 获取

```vue
<template>
  <!-- 自动从 iconStore 获取已注册的图标 -->
  <DynamicAppIcon app-id="wechat" size="sm" />
  <DynamicAppIcon app-id="weibo" size="md" :badge="3" />
</template>
```

#### 直接传入配置

```vue
<template>
  <!-- FontAwesome 图标 -->
  <DynamicAppIcon 
    :icon="{ type: 'font', value: 'fas fa-bell', background: '#4A90D9' }"
  />
  
  <!-- Emoji 图标 -->
  <DynamicAppIcon 
    :icon="{ type: 'emoji', value: '🎉', background: '#FFD93D' }"
  />
  
  <!-- 图片 URL -->
  <DynamicAppIcon 
    :icon="{ type: 'url', value: '/icons/custom.png' }"
  />
</template>
```

#### 通知系统集成

```vue
<template>
  <div class="notification-item">
    <DynamicAppIcon 
      :icon="notification.icon"
      size="sm"
      :rounded="true"
    />
    <div class="notification-content">
      <span class="title">{{ notification.title }}</span>
      <span class="body">{{ notification.body }}</span>
    </div>
  </div>
</template>

<script setup>
// notification.icon 能是：
// { type: 'fontawesome', value: 'fas fa-comment', backgroundColor: '#4A90D9' }
// { type: 'emoji', value: '💬' }
// { type: 'image', value: 'https://...' }
</script>
```

#### 无背景模式

```vue
<template>
  <!-- 纯图标，无背景 -->
  <DynamicAppIcon 
    :icon="{ type: 'font', value: 'fas fa-cog' }"
    :show-background="false"
    custom-color="#666"
  />
</template>
```

#### 方形图标

```vue
<template>
  <!-- 方形圆角图标 -->
  <DynamicAppIcon 
    app-id="app-store"
    :rounded="false"
  />
</template>
```

### 3.6 支持的图标类型

| type | 说明 | 渲染方式 |
| :--- | :--- | :--- |
| `font` | 字体图标 | `<i>` 或 `<span>` |
| `fontawesome` | FontAwesome（通知兼容） | `<i>` |
| `emoji` | Emoji | `<span>` |
| `url` | 图片 URL | `<img>` |
| `base64` | Base64 图片 | `<img>` |
| `image` | 图片（通知兼容） | `<img>` |
| `svg` | SVG（内联或 URL） | `<div v-html>` 或 `<img>` |
| `component` | Vue 组件 | `<component :is>` |

---

## 4. 两个组件的对比

| 特性 | AppIcon | DynamicAppIcon |
| :--- | :--- | :--- |
| **主题适配** | ✅ 完整支持 | ⚠️ 有限支持 |
| **图标来源** | 主题配置为主 | 多来源统一 |
| **尺寸范围** | xs ~ xl | xxs ~ xl |
| **特效类** | ✅ 支持 | ❌ 不支持 |
| **圆角控制** | 主题控制 | rounded prop |
| **通知兼容** | ❌ | ✅ 完整支持 |
| **适用场景** | 桌面、App 列表 | 通知、动态列表 |

---

## 5. 最佳实践

### 5.1 桌面图标

```vue
<template>
  <div class="desktop-grid">
    <div 
      v-for="icon in iconStore.allIcons" 
      :key="icon.id"
      class="app-item"
      @click="navigateTo(icon.route)"
    >
      <AppIcon 
        :app-id="icon.iconId || icon.id" 
        :icon="icon.icon"
        :badge="icon.getBadge?.()"
        size="md"
      />
      <span class="app-name">{{ icon.name }}</span>
    </div>
  </div>
</template>
```

### 5.2 通知列表

```vue
<template>
  <div class="notification-list">
    <div 
      v-for="notification in notifications" 
      :key="notification.id"
      class="notification-item"
    >
      <DynamicAppIcon 
        :app-id="notification.appId"
        :icon="notification.icon"
        size="sm"
      />
      <div class="content">
        <span class="title">{{ notification.title }}</span>
        <span class="body">{{ notification.body }}</span>
      </div>
    </div>
  </div>
</template>
```

### 5.3 App 选择器

```vue
<template>
  <div class="app-selector">
    <button 
      v-for="app in iconStore.getByCategory('social')" 
      :key="app.id"
      @click="selectApp(app)"
    >
      <DynamicAppIcon :app-id="app.id" size="lg" />
      <span>{{ app.name }}</span>
    </button>
  </div>
</template>
```

---

## 6. 样式定制

### 6.1 全局 CSS 变量

```css
:root {
  /* 徽章颜色 */
  --color-error: #FF3B30;
  
  /* 图标默认圆角 */
  --app-icon-radius: 22.5%;
}
```

### 6.2 覆盖样式

```vue
<style scoped>
/* 自定义徽章样式 */
:deep(.app-badge) {
  background-color: #007AFF;
  font-size: 10px;
}

/* 自定义图标容器 */
:deep(.app-icon) {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}
</style>
```
