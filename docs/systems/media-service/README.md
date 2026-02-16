# 媒体服务 (Media Service)

> **版本**: 1.0  
> **状态**: 设计完成，部分实现  
> **最后更新**: 2026-01-16  
> **相关代码**: `src/apps/gallery/`, `src/services/appDataService.ts`

## 1. 概述

媒体服务（Media Service）是系统级的多媒体资源管理中心，负责图片、视频、音频等资产的索引、存储、元数据管理及跨应用共享。它是「Core & Skin」架构中的核心能力服务，为所有需要媒体资源的应用提供统一的底层支撑。

### 1.1 解决的问题

目前，各 App（如图库、聊天、相机）各自维护自己的媒体数据，形成了**数据孤岛**：

* 相机拍摄的照片无法自动出现在图库中
* 聊天应用无法方便地选择图库中的照片发送
* 浏览器下载的图片无法被其他 App 访问
* 社交 App（微博、朋友圈）的配图难以统一管理

媒体服务旨在打破这种隔离，提供一个统一的「媒体库（Media Store）」。

### 1.2 核心职责

| 职责 | 说明 |
| ------ | ------ |
| **资产管理** | 统一存储和索引媒体文件元数据（路径、尺寸、创建时间、来源） |
| **相册管理** | 支持逻辑上的分组（相册），支持智能相册（基于时间、位置、标签） |
| **缩略图生成** | 自动为大图生成和缓存缩略图，优化列表加载性能 |
| **跨应用共享** | 提供标准的媒体选择器接口，支持 Content Provider 模式 |
| **虚拟 URI** | 统一的资源访问协议，屏蔽底层存储差异 |

### 1.3 设计原则

遵循「Core & Skin」架构的核心原则：

1. **引擎与皮肤分离**：媒体服务作为 Core，各 App（图库、相机）作为 Skin
2. **统一数据模型**：跨平台共享同一套 `MediaAsset` 数据结构
3. **可插拔扩展**：通过注册机制支持不同类型的媒体源和存储后端
4. **按需加载**：服务懒加载，避免不必要的资源占用

---

## 2. 文档索引

| 文档 | 说明 |
| ------ | ------ |
| [架构设计](./architecture.md) | 服务分层架构、组件关系图 |
| [数据模型](./data-model.md) | MediaAsset、Album 等核心类型定义 |
| [API 参考](./api-reference.md) | MediaService 完整接口文档 |
| [实现状态](./implementation-status.md) | 当前实现进度与代码位置 |
| [迁移指南](./migration-guide.md) | 从 Gallery App 私有数据迁移到统一媒体库 |

---

## 3. 快速开始

### 3.1 获取服务实例

```typescript
import { getMediaService } from '@/services/media';

const mediaService = getMediaService();
```

### 3.2 查询媒体资源

```typescript
// 获取最新 20 张图片
const assets = await mediaService.queryAssets({
  type: 'image',
  sortBy: 'createdAt',
  order: 'desc',
  limit: 20,
});

// 获取某相册内的资源
const albumAssets = await mediaService.queryAssets({
  albumId: 'favorites',
});
```

### 3.3 保存新资源

```typescript
// 从 Blob 保存图片
const newAsset = await mediaService.saveAsset(imageBlob, {
  source: 'camera',
  albumIds: ['camera_roll'],
  metadata: { capturedAt: Date.now() },
});
```

### 3.4 解析虚拟 URI

```typescript
// 将内部 URI 转为可用于 <img> 的 URL
const displayUrl = await mediaService.resolveUri(asset.uri);
// <img :src="displayUrl" />
```

---

## 4. 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                      应用层 (App Skins)                       │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐         │
│  │  图库   │  │  相机   │  │  聊天   │  │  微博   │  ...    │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘         │
└───────┼────────────┼────────────┼────────────┼──────────────┘
        │            │            │            │
        └────────────┴─────┬──────┴────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                     MediaStore (Pinia)                       │
│              统一状态管理，响应式数据绑定                     │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                     MediaService                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ Asset Indexer│  │ Thumbnail   │  │ Album Manager│       │
│  │ 资产索引器   │  │ Generator   │  │ 相册管理器   │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                     存储层                                   │
│  ┌──────────────┐  ┌──────────────┐                         │
│  │ IndexedDB    │  │ Blob Storage │                         │
│  │ 元数据索引   │  │ 二进制存储   │                         │
│  └──────────────┘  └──────────────┘                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. 当前实现状态

### 5.1 已实现（Gallery App 私有实现）

| 功能 | 代码位置 | 说明 |
| ------ | ---------- | ------ |
| 图片数据模型 | `src/apps/gallery/types.ts` | GalleryImage 类型定义 |
| 图片 CRUD | `src/apps/gallery/services/galleryService.ts` | 增删改查操作 |
| 状态管理 | `src/apps/gallery/stores/galleryStore.ts` | Pinia Store |
| 筛选与排序 | `galleryStore.filteredImages` | 多维度筛选 |
| 本地资源配置 | `LocalResourceConfig` | 资源路径管理 |

### 5.2 待实现（系统服务化）

| 功能 | 优先级 | 说明 |
| ------ | -------- | ------ |
| 独立 IndexedDB 表 | 🔴 高 | `media_assets`, `media_albums` |
| 虚拟 URI 系统 | 🔴 高 | `internal://media/images/{id}` |
| 缩略图自动生成 | 🟡 中 | Canvas 压缩或 Worker |
| 跨应用选择器 | 🟡 中 | Picker Mode |
| 数据迁移脚本 | 🟡 中 | 从 AppDataService 迁移 |

---

## 6. 相关文档

* [服务架构总览](../architecture/Service-for-social-media-platform.md)
* [统一内容模型](../已完成的/social-content-types.md) - MediaAsset 类型定义
* [Gallery App 文档](../../apps/gallery.md)
* [AppDataService](../appDataService.md) - 当前使用的 KV 存储

---

## 7. 版本历史

| 版本 | 日期 | 变更内容 |
| ------ | ------ | ---------- |
| 1.0 | 2026-01-16 | 初始版本，基于现有 Gallery App 实现整理 |
