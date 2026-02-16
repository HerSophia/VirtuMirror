# Pathfinder Student App (学员端)

> Pathfinder Student 是 Pathfinder Academy 学员的专属移动端应用，集成了学习、生活、训练数据分析与生涯管理功能。

## 目录

1. [目录结构](#目录结构)
2. [功能模块](#功能模块)
3. [组件架构](#组件架构)
4. [核心概念](#核心概念)
5. [样式规范](#样式规范)

---

## 目录结构

符合标准 App 架构，采用基于 Tab 的导航模式。

```
src/apps/pathfinder-student/
├── PathfinderStudentApp.vue  # 主应用入口（布局容器）
├── index.ts                  # 统一导出
├── components/               # 共享组件
│   ├── BottomNav.vue         # 底部导航栏
│   └── index.ts
└── tabs/                     # 标签页视图
    ├── ExploreTab.vue        # 探索（首页）
    ├── DataTab.vue           # 数据中心
    ├── CareerTab.vue         # 生涯档案
    ├── ProfileTab.vue        # 我的（个人中心）
    └── index.ts
```

---

## 功能模块

### 1. 探索 (Explore)
**入口组件**: `tabs/ExploreTab.vue`

学员的每日仪表盘，提供高频信息聚合：
- **智能日程**: 展示当前/下一节课程或训练赛，包含签到功能和作业提醒。
- **状态监控**: 展示手腕疲劳度与专注力指数。
- **生活服务**: 食堂推荐与一键预订。
- **Artemis Eye 周报**: 简要展示本周训练评分雷达图与 AI 教练建议。
- **赫尔墨斯大厅**: 展示精选的微订单悬赏。

### 2. 数据 (Data)
**入口组件**: `tabs/DataTab.vue`

深度训练数据分析系统，支持周/月/赛季视图切换（UI）：
- **PP (Pathfinder Points)**: 综合评分系统与六边形雷达图，展示年级排名与模板对比。
- **基础数据**: K/D, 胜率, ADR, HS% 等传统 FPS 数据。
- **能力维度详解**:
  - **致命性与机械控制 (Red)**: TTD, 预瞄保持率。
  - **战术效能 (Blue)**: 道具效率, 信息获取率 (IAR), 空间撕裂值。
  - **经济博弈 (Yellow)**: DPC (每金币伤害), ECO 局贡献。
  - **心态与残局 (Purple)**: Clutch Factor, HRV (心率变异度)。
- **LOGOS 模型评估**: AI 生成的综合评价文本。

### 3. 生涯 (Career)
**入口组件**: `tabs/CareerTab.vue`

记录学员在校期间的所有成就与经历：
- **赛事履历**: 时间轴展示参与的赛事、获得的名次及个人高光时刻（MVP/关键先生）。
- **社团与项目**: 展示参与的社团活动及个人/合作项目（Sandbox）。
- **实习与微订单**: 展示校企合作实习经历及企业评价。
- **导出功能**: 支持导出 PDF 格式的生涯档案。

### 4. 我的 (Profile)
**入口组件**: `tabs/ProfileTab.vue`

个人信息与校园生活管理：
- **个人信息**: 头像、ID、专业标签及角色（如宿舍长）。
- **数字一卡通**: 余额查询、充值、门禁卡包。
- **宿舍管家**: 宿舍温湿度监控、水电费余额及一键缴费。
- **设备控制中心 (Artemis·Link)**: 个人 PC 状态、外设云同步、宿舍智能家居控制（空调/饮水机）。
- **健康保险**: 医保信息概览。

---

## 组件架构

### 1. 入口组件 (PathfinderStudentApp.vue)
- 负责整体布局结构。
- 维护 `activeTab` 状态。
- 根据当前 Tab 动态渲染对应组件。
- 包含底部的 `BottomNav` 组件。

### 2. 共享组件 (components/)
- **BottomNav.vue**: 
  - 底部导航栏，封装了四个核心 Tab 的切换逻辑。
  - Props: `activeTab`
  - Events: `update:activeTab`

### 3. Tab 组件 (tabs/)
- 均为自包含的视图组件，目前主要负责静态展示 UI 结构和模拟数据。
- 内部使用了大量的 Tailwind Utility Class 进行排版。

---

## 核心概念

| 概念 | 说明 | 对应颜色 |
| ------ | ------ | ---------- |
| **PP** | Pathfinder Points，学员综合能力评分 | Blue |
| **Artemis Eye** | 训练数据分析系统 | - |
| **Hermes** | 任务悬赏与微订单系统 | Purple |
| **Sandbox** | 项目与社团活动 | - |
| **LOGOS** | AI 评估模型 | - |

---

## 样式规范

### 颜色系统
App 内部使用特定的语义化颜色来区分不同的能力维度：

- **致命性 (Lethality)**: `#ef4444` (Red-500)
- **战术 (Tactical)**: `#3b82f6` (Blue-500)
- **经济 (Economy)**: `#f59e0b` (Yellow-500)
- **心态 (Mental)**: `#a855f7` (Purple-500)

### 布局
- **卡片式设计**: 广泛使用圆角卡片 (`rounded-2xl`, `shadow-sm`) 承载内容。
- **背景**: 整体使用淡灰色背景 (`#f3f4f6`)，卡片使用半透明白色 (`rgba(255, 255, 255, 0.9)`) 增加层次感。
- **字体**: 数据展示部分使用等宽字体 (`font-mono`) 强调专业感。
