# 社交引擎配置 App

## 概述

社交引擎配置 App 是用于管理和配置 **社交媒体模拟引擎 (Social Media Simulation Engine)** 的控制中心。它提供了可视化的界面来配置引擎的各项功能，查看运行状态，以及理解算法原理。

## 目录结构

```text
src/apps/social-engine/
├── SocialEngineApp.vue           # 主应用入口
├── index.ts                      # 导出入口
├── types.ts                      # 类型定义
├── components/                   # 共享组件
│   ├── EngineHeader.vue          # 头部组件
│   ├── StatCard.vue              # 统计卡片
│   ├── PlatformCard.vue          # 平台卡片
│   └── index.ts                  # 组件导出
└── views/                        # Tab 视图
    ├── OverviewTab.vue           # 概览页
    ├── PlatformsTab.vue          # 平台管理页
    ├── DirectorTab.vue           # 导演服务配置页
    ├── UsersTab.vue              # 用户池管理页
    ├── AlgorithmTab.vue          # 算法说明页
    └── index.ts                  # 视图导出
```

## 功能模块

### 1. 概览 (Overview)

显示社交引擎的整体运行状态：

| 统计项 | 说明 |
| ------ | ---- |
| 已注册平台 | PlatformRegistry 中注册的平台数量 |
| 活跃话题 | 最近 3 天内创建的热搜话题数 |
| 博文总数 | socialPosts 表中的记录数 |
| 评论总数 | socialComments 表中的记录数 |
| 影子账号 | origin='llm_generated' 的账号数 |
| 导演服务 | DirectorService 运行状态 |

同时显示各平台的状态卡片，包括：
- 平台名称和 ID
- 该平台的话题数、博文数、账号数
- 启用状态

### 2. 平台管理 (Platforms)

查看已注册的社交平台配置详情：

**内容形态 (Content)**
- 媒体类型：图文 / 视频 / 文章 / 问答
- 是否有标题
- 字数限制

**AI 人设偏置 (aiSetting)**
- 语调风格 (tone)
- 角色类型 (roles)
- 常用俚语 (slang)
- 提示词模板 ID

**交互拓扑 (interaction)**
- 支持的操作：点赞、踩、投币、转发、收藏等
- 评论结构：扁平 / 嵌套 / 弹幕

**私信策略 (dmStrategy)**
- 是否允许陌生人私信
- 是否折叠未关注人消息

### 3. 导演服务 (Director)

控制世界事件的自动生成：

> ⚠️ **默认关闭**：导演服务默认不启用，避免无意中消耗 API 调用。用户需要手动开启才会自动生成世界事件和热搜。

**开关控制**
- 启用/停止导演服务
- 显示下次事件预计时间
- 开启后会显示警告：「已开启：将定期调用 LLM 生成世界事件，会消耗 API 调用」

**频率配置**
- 低：每 12 小时生成一次
- 中：每 6 小时生成一次
- 高：每 2 小时生成一次

**世界设定**
- 可编辑的世界背景描述
- 会注入到事件生成的提示词中

**Token 预算**
- 设置每日 Token 上限
- 超出预算后暂停生成

**手动操作**
- 立即触发一次事件生成（用于测试）

### 4. 用户池 (Users)

管理影子账号（Shadow Accounts）：

**统计数据**
- 总账号数
- 影子账号数（LLM 生成）
- 预设账号数
- 用户创建账号数

**筛选器**
- 按平台筛选
- 按来源筛选（预设/用户/影子）

**账号列表**
- 显示昵称、handle、平台、来源标签
- 显示演化数据（出现次数、语义标签）

**操作**
- 刷新列表
- 清理所有影子账号

### 5. 算法说明 (Algorithm)

展示热度算法的工作原理：

**热度公式**
```
Heat = (BaseScore³ × 0.1) × TimeFactor × Jitter
```

**时间曲线**
- 上升期：正弦曲线模拟发酵
- 衰退期：指数衰减，24 小时半衰期

**热度标签判定**
| 标签 | 条件 |
| ---- | ---- |
| 沸 | 排名前 3 且热度 ≥ 100万 |
| 爆 | 热度 ≥ 50万 |
| 热 | 热度 ≥ 10万 |
| 新 | 创建时间 < 1小时 |

**热度格式化**
- < 1万：原始数值
- 1万 ~ 1亿：X.X万
- ≥ 1亿：X.X亿

**实时测试**
- 滑动条调整 BaseScore
- 实时预览计算结果

**交互概率漏斗**
- 基础曝光计算
- 热搜加成
- 点赞率/评论率/转发率

## 路由配置

| 路径 | 名称 | 说明 |
| ---- | ---- | ---- |
| `/social-engine` | SocialEngineApp | 社交引擎配置主页 |

## 依赖服务

| 服务 | 用途 |
| ---- | ---- |
| PlatformRegistry | 获取已注册的平台配置 |
| DirectorService | 控制事件生成 |
| TrendService | 热搜管理 |
| UserPool | 影子账号管理 |
| TrafficEngine | 热度算法 |
| db (Dexie) | 数据库访问 |

## 类型定义

```typescript
// 导演服务配置
interface DirectorConfig {
  isEnabled: boolean;
  worldSetting: string;
  frequency: 'low' | 'medium' | 'high';
  costLimit: number;
}

// 引擎统计数据
interface EngineStats {
  platformCount: number;
  activeTopicCount: number;
  postCount: number;
  commentCount: number;
  shadowAccountCount: number;
  todayEventCount: number;
}

// 平台状态
interface PlatformStatus {
  id: string;
  name: string;
  enabled: boolean;
  topicCount: number;
  postCount: number;
  accountCount: number;
}
```

## 使用场景

1. **调试开发**：查看引擎运行状态，手动触发事件生成
2. **内容管理**：清理过期的影子账号，释放存储空间
3. **世界观配置**：修改世界背景设定，影响生成内容风格
4. **性能调优**：调整事件生成频率和 Token 预算
5. **学习理解**：通过算法说明页了解热度计算原理

## 注意事项

1. **导演服务依赖 TimeService**：只有在模拟时间流逝时才会触发自动事件生成
2. **影子账号清理不可恢复**：清理后会丢失账号的演化历史数据
3. **平台配置只读**：当前版本不支持动态添加或修改平台配置
4. **热度实时计算**：每次查询热搜榜时都会重新计算热度，不会持久化
