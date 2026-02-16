# 媒体服务数据模型

> 本文档定义媒体服务的核心数据类型，包括 MediaAsset、Album 等，并说明与现有 Gallery App 类型的对应关系。

## 1. 核心类型

### 1.1 MediaAsset（媒体资产）

系统中的基本单元，对应一张图片、一个视频或一段音频。

```typescript
/**
 * 媒体类型
 */
type MediaType = 'image' | 'video' | 'audio';

/**
 * 媒体资产
 * 统一的媒体资源数据结构
 */
interface MediaAsset {
  // ========== 基础标识 ==========
  
  /** 唯一标识符 (UUID) */
  id: string;
  
  /** 媒体类型 */
  type: MediaType;
  
  // ========== 资源路径 ==========
  
  /** 
   * 资源的访问路径（虚拟 URI）
   * 格式: internal://media/{type}/{id}
   * 示例: internal://media/images/abc-123
   */
  uri: string;
  
  /** 
   * 缩略图路径
   * 格式: internal://media/thumbnails/{id}
   */
  thumbnailUri?: string;
  
  // ========== 媒体元数据 ==========
  
  /** 宽度（像素） */
  width: number;
  
  /** 高度（像素） */
  height: number;
  
  /** 时长（秒），仅视频/音频 */
  duration?: number;
  
  /** 文件大小（字节） */
  size: number;
  
  /** MIME 类型，如 "image/jpeg", "video/mp4" */
  mimeType: string;
  
  // ========== 时间信息 ==========
  
  /** 创建时间（时间戳） */
  createdAt: number;
  
  /** 修改时间（时间戳） */
  modifiedAt: number;
  
  // ========== 组织信息 ==========
  
  /** 所属相册 ID 列表 */
  albumIds: string[];
  
  /** 标签（用于搜索和 AI 分类） */
  tags: string[];
  
  /** 是否收藏 */
  favorite: boolean;
  
  // ========== 来源追踪 ==========
  
  /** 
   * 来源 App ID
   * 示例: "com.camera", "com.chat", "com.weibo"
   */
  sourceAppId?: string;
  
  /** 
   * 来源类型
   * - 'local': 本地导入
   * - 'generated': AI 生成
   * - 'remote': 远程下载
   * - 'camera': 相机拍摄
   * - 'screenshot': 截图
   */
  sourceType: MediaSourceType;
  
  // ========== 扩展元数据 ==========
  
  /** 描述文本 */
  description?: string;
  
  /** 
   * 扩展元数据
   * 存储来源特定的数据，如：
   * - AI 生成参数 (prompt, seed, model)
   * - EXIF 信息 (camera, location)
   * - 远程来源 (originalUrl, hostId)
   */
  metadata?: Record<string, any>;
}

/**
 * 媒体来源类型
 */
type MediaSourceType = 
  | 'local'       // 本地导入
  | 'generated'   // AI 生成
  | 'remote'      // 远程下载
  | 'camera'      // 相机拍摄
  | 'screenshot'; // 截图
```

### 1.2 Album（相册）

媒体资源的逻辑分组。

```typescript
/**
 * 相册类型
 */
type AlbumType = 
  | 'user'    // 用户创建
  | 'smart'   // 智能相册（基于规则自动填充）
  | 'system'; // 系统相册（如：相机胶卷、收藏）

/**
 * 相册
 */
interface Album {
  /** 唯一标识符 */
  id: string;
  
  /** 相册名称 */
  name: string;
  
  /** 描述 */
  description?: string;
  
  /** 封面资源 ID */
  coverAssetId?: string;
  
  /** 相册类型 */
  type: AlbumType;
  
  /** 
   * 智能相册规则
   * 仅当 type === 'smart' 时有效
   */
  rule?: SmartAlbumRule;
  
  /** 创建时间 */
  createdAt: number;
  
  /** 更新时间 */
  updatedAt: number;
  
  /** 资源数量（缓存值） */
  assetCount: number;
}

/**
 * 智能相册规则
 */
interface SmartAlbumRule {
  /** 筛选条件 */
  filter: MediaFilter;
  
  /** 排序方式 */
  sort?: MediaSort;
  
  /** 最大数量限制 */
  limit?: number;
}
```

### 1.3 MediaFilter（筛选条件）

用于查询媒体资源的筛选条件。

```typescript
/**
 * 媒体筛选条件
 */
interface MediaFilter {
  /** 媒体类型 */
  type?: MediaType | MediaType[];
  
  /** 来源类型 */
  sourceType?: MediaSourceType | MediaSourceType[];
  
  /** 来源 App ID */
  sourceAppId?: string;
  
  /** 相册 ID */
  albumId?: string;
  
  /** 是否收藏 */
  favorite?: boolean;
  
  /** 标签（任意匹配） */
  tags?: string[];
  
  /** 搜索文本（匹配描述、标签） */
  searchText?: string;
  
  /** 时间范围 */
  dateRange?: {
    start?: number;  // 开始时间戳
    end?: number;    // 结束时间戳
  };
  
  /** 文件大小范围（字节） */
  sizeRange?: {
    min?: number;
    max?: number;
  };
  
  /** MIME 类型（模糊匹配） */
  mimeType?: string;
}
```

### 1.4 MediaSort（排序方式）

```typescript
/**
 * 排序字段
 */
type MediaSortBy = 
  | 'createdAt'   // 创建时间
  | 'modifiedAt'  // 修改时间
  | 'size'        // 文件大小
  | 'name'        // 名称（描述）
  | 'random';     // 随机

/**
 * 排序顺序
 */
type SortOrder = 'asc' | 'desc';

/**
 * 媒体排序
 */
interface MediaSort {
  by: MediaSortBy;
  order: SortOrder;
}
```

---

## 2. 扩展元数据类型

不同来源的媒体有不同的扩展元数据，通过 `metadata` 字段存储。

### 2.1 AI 生成图片元数据

```typescript
/**
 * AI 生成图片的扩展元数据
 * 存储在 MediaAsset.metadata 中
 */
interface GeneratedImageMetadata {
  /** 生成提示词 */
  prompt: string;
  
  /** 负面提示词 */
  negativePrompt?: string;
  
  /** 使用的模型 ID */
  modelId?: string;
  
  /** 模型名称 */
  modelName?: string;
  
  /** 随机种子 */
  seed?: number;
  
  /** 采样步数 */
  steps?: number;
  
  /** CFG Scale */
  cfgScale?: number;
  
  /** 采样器名称 */
  sampler?: string;
  
  /** 生成耗时（毫秒） */
  generationTime?: number;
  
  /** 来源消息 ID（追溯 AI 对话） */
  sourceMessageId?: number;
}
```

### 2.2 本地导入图片元数据

```typescript
/**
 * 本地导入图片的扩展元数据
 */
interface LocalImageMetadata {
  /** 本地文件路径 */
  localPath: string;
  
  /** 所属资源配置 ID */
  resourceConfigId?: string;
  
  /** 原始文件名 */
  originalFilename?: string;
}
```

### 2.3 远程图片元数据

```typescript
/**
 * 远程图片的扩展元数据
 */
interface RemoteImageMetadata {
  /** 原始 URL */
  originalUrl: string;
  
  /** 图床配置 ID */
  remoteHostId?: string;
  
  /** 是否已缓存到本地 */
  cached: boolean;
  
  /** 本地缓存路径 */
  cachePath?: string;
}
```

### 2.4 相机拍摄元数据

```typescript
/**
 * 相机拍摄的扩展元数据
 */
interface CameraMetadata {
  /** 拍摄时间 */
  capturedAt: number;
  
  /** 地理位置 */
  location?: {
    latitude: number;
    longitude: number;
    altitude?: number;
  };
  
  /** 相机信息 */
  camera?: {
    make?: string;      // 制造商
    model?: string;     // 型号
    focalLength?: number;
    aperture?: number;
    iso?: number;
    exposureTime?: number;
  };
}
```

---

## 3. 与 Gallery App 类型的对应关系

现有 Gallery App 使用独立的类型定义，需要在迁移时进行映射。

### 3.1 类型映射表

| Gallery App 类型 | 媒体服务类型 | 映射说明 |
| ----------------- | ------------- | ---------- |
| `GalleryImage` | `MediaAsset` | 基础图片类型 |
| `LocalImage` | `MediaAsset` (sourceType: 'local') | 本地图片 |
| `GeneratedImage` | `MediaAsset` (sourceType: 'generated') | AI 生成图片 |
| `RemoteImage` | `MediaAsset` (sourceType: 'remote') | 远程图片 |
| `Album` | `Album` | 基本一致 |
| `ImageSource` | `MediaSourceType` | 来源类型 |
| `ImageFilter` | `MediaFilter` | 筛选条件 |
| `ImageSort` | `MediaSort` | 排序方式 |

### 3.2 字段映射详情

```typescript
// GalleryImage → MediaAsset
{
  // 直接映射
  id: image.id,
  type: 'image',
  width: image.width,
  height: image.height,
  size: image.fileSize,
  createdAt: image.createdAt,
  description: image.description,
  tags: image.keywords || [],
  favorite: image.favorite || false,
  albumIds: image.albumId ? [image.albumId] : [],
  
  // 字段重命名
  uri: `internal://media/images/${image.id}`,  // 从 url 生成
  thumbnailUri: image.thumbnail ? `internal://media/thumbnails/${image.id}` : undefined,
  
  // 来源映射
  sourceType: image.source,  // 'local' | 'generated' | 'remote'
  
  // 扩展元数据
  metadata: {
    // 根据 source 类型填充不同的元数据
    ...(image.source === 'local' && {
      localPath: (image as LocalImage).localPath,
      resourceConfigId: (image as LocalImage).resourceConfigId,
    }),
    ...(image.source === 'generated' && {
      prompt: (image as GeneratedImage).prompt,
      negativePrompt: (image as GeneratedImage).negativePrompt,
      modelId: (image as GeneratedImage).modelId,
      seed: (image as GeneratedImage).seed,
      steps: (image as GeneratedImage).steps,
      cfgScale: (image as GeneratedImage).cfgScale,
      sampler: (image as GeneratedImage).sampler,
      generationTime: (image as GeneratedImage).generationTime,
      sourceMessageId: (image as GeneratedImage).sourceMessageId,
    }),
    ...(image.source === 'remote' && {
      originalUrl: (image as RemoteImage).originalUrl,
      remoteHostId: (image as RemoteImage).remoteHostId,
      cached: (image as RemoteImage).cached,
      cachePath: (image as RemoteImage).cachePath,
    }),
  },
}
```

---

## 4. 虚拟 URI 系统

### 4.1 URI 格式规范

媒体服务使用统一的 URI 协议来屏蔽底层存储差异：

```text
协议: internal://
路径结构: /{namespace}/{type}/{id}

示例:
  internal://media/images/abc-123           # 图片资源
  internal://media/videos/xyz-456           # 视频资源
  internal://media/thumbnails/abc-123       # 缩略图
  internal://assets/builtin/wallpapers/1    # 内置资源
```

### 4.2 URI 生成规则

```typescript
/**
 * 生成媒体资源 URI
 */
function generateMediaUri(type: MediaType, id: string): string {
  const typeMap: Record<MediaType, string> = {
    image: 'images',
    video: 'videos',
    audio: 'audios',
  };
  return `internal://media/${typeMap[type]}/${id}`;
}

/**
 * 生成缩略图 URI
 */
function generateThumbnailUri(assetId: string): string {
  return `internal://media/thumbnails/${assetId}`;
}
```

### 4.3 URI 解析流程

```typescript
/**
 * 将内部 URI 解析为可用于浏览器的 URL
 */
async function resolveUri(uri: string): Promise<string> {
  // 1. 解析 URI 结构
  const parsed = parseUri(uri);
  // { namespace: 'media', type: 'images', id: 'abc-123' }
  
  // 2. 根据类型从存储层获取数据
  const blob = await blobStorage.get(parsed.id);
  
  // 3. 创建 Blob URL
  const blobUrl = URL.createObjectURL(blob);
  
  return blobUrl;
}

/**
 * 解析 URI 字符串
 */
function parseUri(uri: string): ParsedUri | null {
  const match = uri.match(/^internal:\/\/(\w+)\/(\w+)\/(.+)$/);
  if (!match) return null;
  
  return {
    namespace: match[1],  // 'media' | 'assets'
    type: match[2],       // 'images' | 'videos' | 'thumbnails'
    id: match[3],
  };
}
```

---

## 5. 数据库索引设计

### 5.1 media_assets 表索引

```typescript
// IndexedDB 表定义
const mediaAssetsSchema = {
  name: 'media_assets',
  keyPath: 'id',
  indexes: [
    // 单字段索引
    { name: 'type', keyPath: 'type' },
    { name: 'createdAt', keyPath: 'createdAt' },
    { name: 'modifiedAt', keyPath: 'modifiedAt' },
    { name: 'sourceType', keyPath: 'sourceType' },
    { name: 'sourceAppId', keyPath: 'sourceAppId' },
    { name: 'favorite', keyPath: 'favorite' },
    
    // 多值索引（MultiEntry）
    { name: 'albumIds', keyPath: 'albumIds', multiEntry: true },
    { name: 'tags', keyPath: 'tags', multiEntry: true },
    
    // 复合索引
    { name: 'type_createdAt', keyPath: ['type', 'createdAt'] },
  ],
};
```

### 5.2 常用查询优化

| 查询场景 | 使用的索引 | 说明 |
| ---------- | ----------- | ------ |
| 按时间倒序列表 | `createdAt` | 默认列表展示 |
| 筛选图片类型 | `type` | 只看图片/视频 |
| 查看相册内容 | `albumIds` (MultiEntry) | 相册详情页 |
| 查看收藏 | `favorite` | 收藏列表 |
| 按来源筛选 | `sourceType` | 只看 AI 生成 |
| 按标签搜索 | `tags` (MultiEntry) | 标签筛选 |

---

## 6. 类型工具函数

### 6.1 类型守卫

```typescript
/**
 * 判断是否为 AI 生成图片
 */
function isGeneratedImage(asset: MediaAsset): asset is MediaAsset & {
  sourceType: 'generated';
  metadata: GeneratedImageMetadata;
} {
  return asset.sourceType === 'generated';
}

/**
 * 判断是否为本地导入图片
 */
function isLocalImage(asset: MediaAsset): asset is MediaAsset & {
  sourceType: 'local';
  metadata: LocalImageMetadata;
} {
  return asset.sourceType === 'local';
}

/**
 * 判断是否为远程图片
 */
function isRemoteImage(asset: MediaAsset): asset is MediaAsset & {
  sourceType: 'remote';
  metadata: RemoteImageMetadata;
} {
  return asset.sourceType === 'remote';
}
```

### 6.2 工厂函数

```typescript
/**
 * 创建新的媒体资产
 */
function createMediaAsset(
  type: MediaType,
  blob: Blob,
  options: CreateAssetOptions
): MediaAsset {
  const id = generateUUID();
  const now = Date.now();
  
  return {
    id,
    type,
    uri: generateMediaUri(type, id),
    width: options.width,
    height: options.height,
    size: blob.size,
    mimeType: blob.type,
    createdAt: now,
    modifiedAt: now,
    albumIds: options.albumIds || [],
    tags: options.tags || [],
    favorite: false,
    sourceType: options.sourceType || 'local',
    sourceAppId: options.sourceAppId,
    description: options.description,
    metadata: options.metadata,
  };
}

interface CreateAssetOptions {
  width: number;
  height: number;
  sourceType?: MediaSourceType;
  sourceAppId?: string;
  albumIds?: string[];
  tags?: string[];
  description?: string;
  metadata?: Record<string, any>;
}
```
