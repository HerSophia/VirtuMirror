# 媒体服务迁移指南

> 本文档描述如何将 Gallery App 的私有数据迁移到统一的媒体服务，以及如何将现有代码适配到新的服务接口。

## 1. 迁移概述

### 1.1 迁移目标

将 Gallery App 的私有实现迁移到系统级媒体服务：

| 迁移项 | 迁移前 | 迁移后 |
|--------|--------|--------|
| 数据存储 | `AppDataService` (KV) | `IndexedDB` (专用表) |
| 服务层 | `GalleryService` | `MediaService` |
| 状态管理 | `galleryStore` | `mediaStore` (可选) |
| 类型定义 | `GalleryImage` | `MediaAsset` |
| 资源访问 | 直接 URL | 虚拟 URI |

### 1.2 迁移策略

采用**渐进式迁移**策略，确保迁移过程中 Gallery App 保持正常运行：

```text
Phase 1: 创建新服务
├── 实现 MediaService
├── 创建 IndexedDB 表
└── 不修改现有代码

Phase 2: 数据迁移
├── 编写迁移脚本
├── 复制数据到新表
└── 保留旧数据（回滚用）

Phase 3: 代码适配
├── GalleryStore 调用 MediaService
├── 使用适配层保持 API 兼容
└── 逐步替换类型定义

Phase 4: 清理
├── 确认功能正常
├── 删除旧数据
└── 删除适配层代码
```

---

## 2. 数据迁移

### 2.1 数据结构映射

#### GalleryImage → MediaAsset

```typescript
// 迁移前: GalleryImage
interface GalleryImage {
  id: string;
  source: 'local' | 'generated' | 'remote';
  url: string;
  thumbnail?: string;
  description?: string;
  keywords?: string[];
  createdAt: number;
  width?: number;
  height?: number;
  fileSize?: number;
  favorite?: boolean;
  albumId?: string;
}

// 迁移后: MediaAsset
interface MediaAsset {
  id: string;
  type: 'image';  // 新增
  uri: string;    // 从 url 转换
  thumbnailUri?: string;  // 从 thumbnail 转换
  width: number;
  height: number;
  size: number;   // 从 fileSize 重命名
  mimeType: string;  // 新增，需要推断
  createdAt: number;
  modifiedAt: number;  // 新增
  albumIds: string[];  // 从 albumId 转换为数组
  tags: string[];      // 从 keywords 重命名
  favorite: boolean;
  sourceType: MediaSourceType;  // 从 source 重命名
  sourceAppId?: string;  // 新增
  description?: string;
  metadata?: Record<string, any>;  // 扩展元数据
}
```

#### 字段映射表

| GalleryImage 字段 | MediaAsset 字段 | 转换逻辑 |
|-------------------|-----------------|----------|
| `id` | `id` | 直接复制 |
| `source` | `sourceType` | 重命名 |
| `url` | `uri` | 生成虚拟 URI |
| `thumbnail` | `thumbnailUri` | 生成虚拟 URI |
| `description` | `description` | 直接复制 |
| `keywords` | `tags` | 重命名，空数组默认值 |
| `createdAt` | `createdAt` | 直接复制 |
| `width` | `width` | 提供默认值 0 |
| `height` | `height` | 提供默认值 0 |
| `fileSize` | `size` | 重命名，提供默认值 0 |
| `favorite` | `favorite` | 提供默认值 false |
| `albumId` | `albumIds` | 转换为数组 |
| - | `type` | 新增，固定为 'image' |
| - | `mimeType` | 新增，从 url 推断 |
| - | `modifiedAt` | 新增，使用 createdAt |
| - | `sourceAppId` | 新增，设为 'com.gallery' |

### 2.2 迁移脚本

```typescript
// src/services/media/migration/migrateFromGallery.ts

import { getGalleryService } from '@/apps/gallery/services';
import { getMediaService } from '@/services/media';
import type { AnyImage, LocalImage, GeneratedImage, RemoteImage } from '@/apps/gallery/types';
import type { MediaAsset } from '@/services/media/types';

/**
 * 从 Gallery App 迁移数据到 Media Service
 */
export async function migrateFromGallery(): Promise<MigrationResult> {
  const galleryService = getGalleryService();
  const mediaService = getMediaService();
  
  const result: MigrationResult = {
    total: 0,
    migrated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };
  
  try {
    // 1. 获取所有 Gallery 图片
    const galleryImages = await galleryService.getAllImages();
    result.total = galleryImages.length;
    
    console.log(`[Migration] 开始迁移，共 ${result.total} 张图片`);
    
    // 2. 检查是否已迁移
    const existingAssets = await mediaService.queryAssets({});
    const existingIds = new Set(existingAssets.map(a => a.id));
    
    // 3. 逐个迁移
    for (const image of galleryImages) {
      try {
        // 跳过已存在的
        if (existingIds.has(image.id)) {
          result.skipped++;
          continue;
        }
        
        // 转换类型
        const asset = convertToMediaAsset(image);
        
        // 保存到新服务
        await mediaService.importAsset(asset);
        
        result.migrated++;
      } catch (error) {
        result.failed++;
        result.errors.push({
          imageId: image.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    
    console.log(`[Migration] 迁移完成:`, result);
    
  } catch (error) {
    console.error('[Migration] 迁移失败:', error);
    throw error;
  }
  
  return result;
}

/**
 * 将 GalleryImage 转换为 MediaAsset
 */
function convertToMediaAsset(image: AnyImage): MediaAsset {
  // 基础字段
  const base: MediaAsset = {
    id: image.id,
    type: 'image',
    uri: generateUri('image', image.id),
    thumbnailUri: image.thumbnail ? generateUri('thumbnail', image.id) : undefined,
    width: image.width || 0,
    height: image.height || 0,
    size: image.fileSize || 0,
    mimeType: inferMimeType(image.url),
    createdAt: image.createdAt,
    modifiedAt: image.createdAt,
    albumIds: image.albumId ? [image.albumId] : [],
    tags: image.keywords || [],
    favorite: image.favorite || false,
    sourceType: image.source,
    sourceAppId: 'com.gallery',
    description: image.description,
    metadata: {},
  };
  
  // 根据来源类型添加扩展元数据
  switch (image.source) {
    case 'local':
      const local = image as LocalImage;
      base.metadata = {
        localPath: local.localPath,
        resourceConfigId: local.resourceConfigId,
      };
      break;
      
    case 'generated':
      const generated = image as GeneratedImage;
      base.metadata = {
        prompt: generated.prompt,
        negativePrompt: generated.negativePrompt,
        modelId: generated.modelId,
        modelName: generated.modelName,
        seed: generated.seed,
        steps: generated.steps,
        cfgScale: generated.cfgScale,
        sampler: generated.sampler,
        generationTime: generated.generationTime,
        sourceMessageId: generated.sourceMessageId,
      };
      break;
      
    case 'remote':
      const remote = image as RemoteImage;
      base.metadata = {
        originalUrl: remote.originalUrl,
        remoteHostId: remote.remoteHostId,
        cached: remote.cached,
        cachePath: remote.cachePath,
      };
      break;
  }
  
  return base;
}

/**
 * 生成虚拟 URI
 */
function generateUri(type: 'image' | 'thumbnail', id: string): string {
  if (type === 'thumbnail') {
    return `internal://media/thumbnails/${id}`;
  }
  return `internal://media/images/${id}`;
}

/**
 * 从 URL 推断 MIME 类型
 */
function inferMimeType(url: string): string {
  const ext = url.split('.').pop()?.toLowerCase();
  const mimeMap: Record<string, string> = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'bmp': 'image/bmp',
  };
  return mimeMap[ext || ''] || 'image/jpeg';
}

interface MigrationResult {
  total: number;
  migrated: number;
  skipped: number;
  failed: number;
  errors: Array<{ imageId: string; error: string }>;
}
```

### 2.3 迁移 Blob 数据

如果图片数据存储为 Blob，需要同时迁移：

```typescript
/**
 * 迁移 Blob 数据
 */
async function migrateBlobData(image: AnyImage): Promise<void> {
  // 1. 获取原始 Blob
  const blob = await fetchImageBlob(image.url);
  if (!blob) return;
  
  // 2. 存储到新的 Blob 存储
  await mediaService.storageBackend.saveBlob(image.id, blob);
  
  // 3. 如果有缩略图，也迁移
  if (image.thumbnail) {
    const thumbBlob = await fetchImageBlob(image.thumbnail);
    if (thumbBlob) {
      await mediaService.storageBackend.saveBlob(`thumb_${image.id}`, thumbBlob);
    }
  }
}

async function fetchImageBlob(url: string): Promise<Blob | null> {
  try {
    // Data URL
    if (url.startsWith('data:')) {
      return dataUrlToBlob(url);
    }
    
    // Blob URL
    if (url.startsWith('blob:')) {
      const response = await fetch(url);
      return response.blob();
    }
    
    // 普通 URL
    const response = await fetch(url);
    return response.blob();
  } catch (error) {
    console.error('Failed to fetch blob:', error);
    return null;
  }
}
```

---

## 3. 代码适配

### 3.1 适配层设计

为了平滑过渡，创建适配层让 `galleryStore` 可以透明地使用 `MediaService`：

```typescript
// src/apps/gallery/services/mediaServiceAdapter.ts

import { getMediaService } from '@/services/media';
import type { AnyImage, LocalImage, GeneratedImage, RemoteImage } from '../types';
import type { MediaAsset } from '@/services/media/types';

/**
 * MediaService 适配器
 * 提供与 GalleryService 兼容的接口
 */
export class MediaServiceAdapter {
  private mediaService = getMediaService();
  
  // ========== 兼容 GalleryService 的接口 ==========
  
  async getAllImages(): Promise<AnyImage[]> {
    const assets = await this.mediaService.queryAssets({
      filter: { type: 'image' },
    });
    return assets.map(asset => this.toGalleryImage(asset));
  }
  
  async saveImages(images: AnyImage[]): Promise<void> {
    // 批量更新
    for (const image of images) {
      const asset = this.toMediaAsset(image);
      await this.mediaService.updateAsset(asset.id, asset);
    }
  }
  
  async addImage(image: AnyImage): Promise<void> {
    const asset = this.toMediaAsset(image);
    await this.mediaService.importAsset(asset);
  }
  
  async addImages(images: AnyImage[]): Promise<void> {
    for (const image of images) {
      await this.addImage(image);
    }
  }
  
  async updateImage(id: string, updates: Partial<AnyImage>): Promise<void> {
    const updateData: any = {};
    
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.keywords !== undefined) updateData.tags = updates.keywords;
    if (updates.favorite !== undefined) updateData.favorite = updates.favorite;
    if (updates.albumId !== undefined) {
      updateData.albumIds = updates.albumId ? [updates.albumId] : [];
    }
    
    await this.mediaService.updateAsset(id, updateData);
  }
  
  async deleteImage(id: string): Promise<void> {
    await this.mediaService.deleteAsset(id);
  }
  
  async deleteImages(ids: string[]): Promise<void> {
    await this.mediaService.deleteAssets(ids);
  }
  
  // ========== 类型转换 ==========
  
  private toGalleryImage(asset: MediaAsset): AnyImage {
    const base = {
      id: asset.id,
      source: asset.sourceType as 'local' | 'generated' | 'remote',
      url: asset.uri,  // 需要解析为实际 URL
      thumbnail: asset.thumbnailUri,
      description: asset.description,
      keywords: asset.tags,
      createdAt: asset.createdAt,
      width: asset.width,
      height: asset.height,
      fileSize: asset.size,
      favorite: asset.favorite,
      albumId: asset.albumIds[0],
    };
    
    // 根据来源类型添加扩展字段
    switch (asset.sourceType) {
      case 'local':
        return {
          ...base,
          source: 'local',
          localPath: asset.metadata?.localPath || '',
          resourceConfigId: asset.metadata?.resourceConfigId,
        } as LocalImage;
        
      case 'generated':
        return {
          ...base,
          source: 'generated',
          prompt: asset.metadata?.prompt || '',
          negativePrompt: asset.metadata?.negativePrompt,
          modelId: asset.metadata?.modelId,
          modelName: asset.metadata?.modelName,
          seed: asset.metadata?.seed,
          steps: asset.metadata?.steps,
          cfgScale: asset.metadata?.cfgScale,
          sampler: asset.metadata?.sampler,
          generationTime: asset.metadata?.generationTime,
          sourceMessageId: asset.metadata?.sourceMessageId,
        } as GeneratedImage;
        
      case 'remote':
        return {
          ...base,
          source: 'remote',
          originalUrl: asset.metadata?.originalUrl || '',
          remoteHostId: asset.metadata?.remoteHostId || '',
          cached: asset.metadata?.cached,
          cachePath: asset.metadata?.cachePath,
        } as RemoteImage;
        
      default:
        return base as AnyImage;
    }
  }
  
  private toMediaAsset(image: AnyImage): MediaAsset {
    // 使用迁移脚本中的 convertToMediaAsset 函数
    return convertToMediaAsset(image);
  }
}

// 单例
let adapter: MediaServiceAdapter | null = null;

export function getMediaServiceAdapter(): MediaServiceAdapter {
  if (!adapter) {
    adapter = new MediaServiceAdapter();
  }
  return adapter;
}
```

### 3.2 切换 Store 调用

修改 `galleryStore` 使用适配器：

```typescript
// src/apps/gallery/stores/galleryStore.ts

import { getMediaServiceAdapter } from '../services/mediaServiceAdapter';
// import { getGalleryService } from '../services';  // 旧代码

export const useGalleryStore = defineStore('gallery', () => {
  // ...
  
  async function init() {
    if (initialized.value) return;
    
    loading.value = true;
    try {
      // 使用适配器而非直接使用 GalleryService
      const adapter = getMediaServiceAdapter();
      
      const allImages = await adapter.getAllImages();
      images.value = new Map(allImages.map(img => [img.id, img]));
      
      // 其他初始化...
      
      initialized.value = true;
    } finally {
      loading.value = false;
    }
  }
  
  async function addImage(image: AnyImage) {
    images.value.set(image.id, image);
    await getMediaServiceAdapter().addImage(image);
  }
  
  // ... 其他方法类似修改
});
```

### 3.3 配置特性开关

使用特性开关控制是否使用新服务：

```typescript
// src/services/media/config.ts

export const mediaServiceConfig = {
  /**
   * 是否启用新的媒体服务
   * true: 使用 MediaService
   * false: 使用旧的 GalleryService
   */
  useMediaService: true,
  
  /**
   * 是否启用虚拟 URI
   */
  useVirtualUri: false,  // 可逐步开启
  
  /**
   * 是否自动生成缩略图
   */
  autoGenerateThumbnail: false,  // 可逐步开启
};

// 使用
import { mediaServiceConfig } from '@/services/media/config';

function getService() {
  if (mediaServiceConfig.useMediaService) {
    return getMediaServiceAdapter();
  }
  return getGalleryService();
}
```

---

## 4. 验证与回滚

### 4.1 验证清单

迁移后需要验证以下功能：

| 功能 | 验证步骤 | 预期结果 |
|------|----------|----------|
| **图片列表** | 打开图库 App | 显示所有图片，数量与迁移前一致 |
| **图片详情** | 点击图片 | 正确显示大图和元数据 |
| **筛选** | 按来源/收藏筛选 | 正确筛选结果 |
| **排序** | 按时间/大小排序 | 正确排序 |
| **收藏** | 点击收藏按钮 | 收藏状态正确切换和保存 |
| **删除** | 删除图片 | 图片被删除，列表更新 |
| **相册** | 添加到相册 | 图片归属正确 |
| **AI 生成图片** | 查看生成参数 | Prompt、模型等信息正确 |
| **本地图片** | 查看路径信息 | 本地路径正确显示 |

### 4.2 自动化测试

```typescript
// tests/migration.test.ts

import { migrateFromGallery } from '@/services/media/migration';

describe('Gallery → MediaService Migration', () => {
  beforeAll(async () => {
    // 准备测试数据
    await setupTestData();
  });
  
  test('should migrate all images', async () => {
    const result = await migrateFromGallery();
    
    expect(result.failed).toBe(0);
    expect(result.migrated + result.skipped).toBe(result.total);
  });
  
  test('should preserve image metadata', async () => {
    const mediaService = getMediaService();
    const assets = await mediaService.queryAssets({});
    
    // 验证字段完整性
    for (const asset of assets) {
      expect(asset.id).toBeDefined();
      expect(asset.type).toBe('image');
      expect(asset.uri).toMatch(/^internal:\/\//);
      expect(asset.createdAt).toBeGreaterThan(0);
    }
  });
  
  test('should handle generated image metadata', async () => {
    const mediaService = getMediaService();
    const generated = await mediaService.queryAssets({
      filter: { sourceType: 'generated' },
    });
    
    for (const asset of generated) {
      expect(asset.metadata?.prompt).toBeDefined();
    }
  });
});
```

### 4.3 回滚方案

如果迁移后出现问题，可以快速回滚：

```typescript
// 回滚步骤

// 1. 关闭特性开关
mediaServiceConfig.useMediaService = false;

// 2. 切换回旧服务
// galleryStore 将自动使用 GalleryService

// 3. 保留新数据（可选）
// 新数据保存在独立的 IndexedDB 表中，不影响旧数据
```

---

## 5. 时间线与里程碑

### 5.1 迁移时间线

```text
Week 1: 准备阶段
├── Day 1-2: 创建 Media 骨架
├── Day 3-4: 实现 IndexedDB 表和基础 CRUD
└── Day 5: 单元测试

Week 2: 迁移阶段
├── Day 1-2: 编写和测试迁移脚本
├── Day 3: 创建适配层
├── Day 4: 集成到 galleryStore
└── Day 5: 端到端测试

Week 3: 验证阶段
├── Day 1-2: 功能验证
├── Day 3: 修复问题
├── Day 4: 性能测试
└── Day 5: 清理和文档
```

### 5.2 里程碑

| 里程碑 | 完成标准 | 目标日期 |
|--------|----------|----------|
| M1: 服务就绪 | MediaService 可独立运行 | Week 1 |
| M2: 数据迁移 | 所有图片数据迁移完成 | Week 2 Day 2 |
| M3: 功能验证 | 所有功能通过验证 | Week 2 Day 5 |
| M4: 上线 | 切换到新服务 | Week 3 Day 3 |
| M5: 清理 | 删除旧代码和数据 | Week 3 Day 5 |

---

## 6. 常见问题

### Q1: 迁移会丢失数据吗？

**A**: 不会。迁移脚本会复制数据到新表，旧数据保持不变。只有在验证完成后才会清理旧数据。

### Q2: 迁移过程中可以使用图库吗？

**A**: 可以。迁移过程中默认使用旧服务，不影响正常使用。

### Q3: 如果迁移失败怎么办？

**A**: 迁移脚本会记录失败的图片 ID 和错误原因。可以针对失败的图片单独处理，或使用回滚方案恢复到旧服务。

### Q4: 新旧服务可以并存吗？

**A**: 可以。通过特性开关可以随时切换，适配层会处理类型转换。

### Q5: 需要更新 UI 组件吗？

**A**: 短期内不需要。适配层会将 MediaAsset 转换回 GalleryImage 格式，UI 组件无需修改。长期可以逐步更新为直接使用 MediaAsset。
