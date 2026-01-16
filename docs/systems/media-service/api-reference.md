# 媒体服务 API 参考

> 本文档提供 MediaService 的完整 API 文档，包括方法签名、参数说明和使用示例。

## 1. 服务获取

### getMediaService()

获取媒体服务单例实例。

```typescript
import { getMediaService } from '@/services/media';

const mediaService = getMediaService();
```

---

## 2. 资产管理 API

### 2.1 queryAssets()

查询媒体资源列表。

```typescript
async queryAssets(options?: QueryAssetsOptions): Promise<MediaAsset[]>
```

**参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| options | `QueryAssetsOptions` | 否 | 查询选项 |

**QueryAssetsOptions**:

```typescript
interface QueryAssetsOptions {
  /** 筛选条件 */
  filter?: MediaFilter;
  
  /** 排序方式 */
  sort?: MediaSort;
  
  /** 返回数量限制 */
  limit?: number;
  
  /** 偏移量（分页用） */
  offset?: number;
}
```

**示例**:

```typescript
// 获取最新 20 张图片
const images = await mediaService.queryAssets({
  filter: { type: 'image' },
  sort: { by: 'createdAt', order: 'desc' },
  limit: 20,
});

// 获取某相册的所有资源
const albumAssets = await mediaService.queryAssets({
  filter: { albumId: 'favorites' },
});

// 获取 AI 生成的图片
const generatedImages = await mediaService.queryAssets({
  filter: { sourceType: 'generated' },
});

// 搜索带特定标签的资源
const taggedAssets = await mediaService.queryAssets({
  filter: { tags: ['风景', '日落'] },
});
```

---

### 2.2 getAssetById()

根据 ID 获取单个媒体资源。

```typescript
async getAssetById(id: string): Promise<MediaAsset | null>
```

**参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | `string` | 是 | 资源 ID |

**示例**:

```typescript
const asset = await mediaService.getAssetById('abc-123');
if (asset) {
  console.log('找到资源:', asset.uri);
}
```

---

### 2.3 getAssetsByIds()

批量获取媒体资源。

```typescript
async getAssetsByIds(ids: string[]): Promise<MediaAsset[]>
```

**参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| ids | `string[]` | 是 | 资源 ID 数组 |

**示例**:

```typescript
const assets = await mediaService.getAssetsByIds(['id1', 'id2', 'id3']);
console.log(`获取到 ${assets.length} 个资源`);
```

---

### 2.4 saveAsset()

保存新的媒体资源。

```typescript
async saveAsset(blob: Blob, options: SaveAssetOptions): Promise<MediaAsset>
```

**参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| blob | `Blob` | 是 | 媒体文件二进制数据 |
| options | `SaveAssetOptions` | 是 | 保存选项 |

**SaveAssetOptions**:

```typescript
interface SaveAssetOptions {
  /** 来源类型 */
  sourceType: MediaSourceType;
  
  /** 来源 App ID */
  sourceAppId?: string;
  
  /** 初始相册 ID 列表 */
  albumIds?: string[];
  
  /** 标签 */
  tags?: string[];
  
  /** 描述 */
  description?: string;
  
  /** 扩展元数据 */
  metadata?: Record<string, any>;
  
  /** 是否自动生成缩略图 */
  generateThumbnail?: boolean;
}
```

**示例**:

```typescript
// 相机拍照保存
const photo = await mediaService.saveAsset(photoBlob, {
  sourceType: 'camera',
  sourceAppId: 'com.camera',
  albumIds: ['camera_roll'],
  metadata: {
    capturedAt: Date.now(),
    location: { latitude: 39.9, longitude: 116.4 },
  },
});

// AI 生成图片保存
const generated = await mediaService.saveAsset(imageBlob, {
  sourceType: 'generated',
  sourceAppId: 'com.gallery',
  description: '一只橘猫在阳台上晒太阳',
  tags: ['猫', '橘猫', 'AI生成'],
  metadata: {
    prompt: 'an orange cat sunbathing on a balcony',
    model: 'stable-diffusion-xl',
    seed: 12345,
    steps: 30,
  },
});
```

---

### 2.5 updateAsset()

更新媒体资源的元数据。

```typescript
async updateAsset(id: string, updates: UpdateAssetOptions): Promise<void>
```

**参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | `string` | 是 | 资源 ID |
| updates | `UpdateAssetOptions` | 是 | 要更新的字段 |

**UpdateAssetOptions**:

```typescript
interface UpdateAssetOptions {
  description?: string;
  tags?: string[];
  favorite?: boolean;
  albumIds?: string[];
  metadata?: Record<string, any>;
}
```

**示例**:

```typescript
// 添加到收藏
await mediaService.updateAsset('abc-123', {
  favorite: true,
});

// 更新标签
await mediaService.updateAsset('abc-123', {
  tags: ['风景', '旅行', '2024春节'],
});

// 添加到相册
await mediaService.updateAsset('abc-123', {
  albumIds: ['vacation_2024', 'favorites'],
});
```

---

### 2.6 deleteAsset()

删除单个媒体资源。

```typescript
async deleteAsset(id: string): Promise<void>
```

**参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | `string` | 是 | 资源 ID |

**示例**:

```typescript
await mediaService.deleteAsset('abc-123');
```

---

### 2.7 deleteAssets()

批量删除媒体资源。

```typescript
async deleteAssets(ids: string[]): Promise<void>
```

**参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| ids | `string[]` | 是 | 资源 ID 数组 |

**示例**:

```typescript
await mediaService.deleteAssets(['id1', 'id2', 'id3']);
```

---

## 3. 相册管理 API

### 3.1 createAlbum()

创建新相册。

```typescript
async createAlbum(name: string, options?: CreateAlbumOptions): Promise<Album>
```

**参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | `string` | 是 | 相册名称 |
| options | `CreateAlbumOptions` | 否 | 创建选项 |

**CreateAlbumOptions**:

```typescript
interface CreateAlbumOptions {
  description?: string;
  type?: AlbumType;  // 默认 'user'
  coverAssetId?: string;
  rule?: SmartAlbumRule;  // 仅 type='smart' 时有效
}
```

**示例**:

```typescript
// 创建普通相册
const album = await mediaService.createAlbum('2024春节旅行', {
  description: '和家人一起去云南旅行',
});

// 创建智能相册（自动收集最近一周的图片）
const smartAlbum = await mediaService.createAlbum('最近一周', {
  type: 'smart',
  rule: {
    filter: {
      dateRange: {
        start: Date.now() - 7 * 24 * 60 * 60 * 1000,
      },
    },
    sort: { by: 'createdAt', order: 'desc' },
  },
});
```

---

### 3.2 updateAlbum()

更新相册信息。

```typescript
async updateAlbum(id: string, updates: UpdateAlbumOptions): Promise<void>
```

**参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | `string` | 是 | 相册 ID |
| updates | `UpdateAlbumOptions` | 是 | 要更新的字段 |

**示例**:

```typescript
await mediaService.updateAlbum('album-123', {
  name: '新名称',
  description: '更新后的描述',
  coverAssetId: 'new-cover-id',
});
```

---

### 3.3 deleteAlbum()

删除相册（不删除相册内的资源）。

```typescript
async deleteAlbum(id: string): Promise<void>
```

**参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | `string` | 是 | 相册 ID |

**示例**:

```typescript
await mediaService.deleteAlbum('album-123');
```

---

### 3.4 getAlbum()

获取单个相册信息。

```typescript
async getAlbum(id: string): Promise<Album | null>
```

**示例**:

```typescript
const album = await mediaService.getAlbum('album-123');
if (album) {
  console.log(`相册 ${album.name} 有 ${album.assetCount} 个资源`);
}
```

---

### 3.5 getAllAlbums()

获取所有相册列表。

```typescript
async getAllAlbums(): Promise<Album[]>
```

**示例**:

```typescript
const albums = await mediaService.getAllAlbums();
console.log(`共有 ${albums.length} 个相册`);
```

---

### 3.6 addToAlbum()

将资源添加到相册。

```typescript
async addToAlbum(assetId: string, albumId: string): Promise<void>
```

**参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| assetId | `string` | 是 | 资源 ID |
| albumId | `string` | 是 | 相册 ID |

**示例**:

```typescript
await mediaService.addToAlbum('asset-123', 'favorites');
```

---

### 3.7 removeFromAlbum()

从相册中移除资源。

```typescript
async removeFromAlbum(assetId: string, albumId: string): Promise<void>
```

**示例**:

```typescript
await mediaService.removeFromAlbum('asset-123', 'favorites');
```

---

### 3.8 getAlbumAssets()

获取相册内的所有资源。

```typescript
async getAlbumAssets(albumId: string): Promise<MediaAsset[]>
```

**示例**:

```typescript
const assets = await mediaService.getAlbumAssets('favorites');
console.log(`收藏夹有 ${assets.length} 个资源`);
```

---

## 4. URI 解析 API

### 4.1 resolveUri()

将内部 URI 解析为可用于浏览器的 URL。

```typescript
async resolveUri(uri: string): Promise<string>
```

**参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| uri | `string` | 是 | 内部 URI |

**返回值**: Blob URL（`blob:http://...`）或 Data URL

**示例**:

```typescript
const asset = await mediaService.getAssetById('abc-123');
if (asset) {
  const displayUrl = await mediaService.resolveUri(asset.uri);
  // 可用于 <img src="..." />
}
```

**在 Vue 组件中使用**:

```vue
<template>
  <img :src="imageUrl" v-if="imageUrl" />
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { getMediaService } from '@/services/media';

const props = defineProps<{ assetUri: string }>();
const imageUrl = ref<string>('');

onMounted(async () => {
  const mediaService = getMediaService();
  imageUrl.value = await mediaService.resolveUri(props.assetUri);
});
</script>
```

---

### 4.2 resolveUris()

批量解析 URI。

```typescript
async resolveUris(uris: string[]): Promise<Map<string, string>>
```

**参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| uris | `string[]` | 是 | 内部 URI 数组 |

**返回值**: Map，key 为原始 URI，value 为解析后的 URL

**示例**:

```typescript
const uris = assets.map(a => a.uri);
const urlMap = await mediaService.resolveUris(uris);

assets.forEach(asset => {
  const url = urlMap.get(asset.uri);
  console.log(`${asset.id} => ${url}`);
});
```

---

### 4.3 generateUri()

生成资源的内部 URI。

```typescript
generateUri(type: MediaType, id: string): string
```

**示例**:

```typescript
const uri = mediaService.generateUri('image', 'abc-123');
// 返回: 'internal://media/images/abc-123'
```

---

## 5. 缩略图 API

### 5.1 getThumbnail()

获取资源的缩略图 URL。

```typescript
async getThumbnail(assetId: string): Promise<string | null>
```

**参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| assetId | `string` | 是 | 资源 ID |

**返回值**: 缩略图 URL，如果不存在则返回 null

**示例**:

```typescript
const thumbnailUrl = await mediaService.getThumbnail('abc-123');
if (thumbnailUrl) {
  // 使用缩略图
} else {
  // 使用原图
  thumbnailUrl = await mediaService.resolveUri(asset.uri);
}
```

---

### 5.2 generateThumbnail()

为资源生成缩略图。

```typescript
async generateThumbnail(
  assetId: string, 
  options?: ThumbnailOptions
): Promise<string>
```

**参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| assetId | `string` | 是 | 资源 ID |
| options | `ThumbnailOptions` | 否 | 生成选项 |

**ThumbnailOptions**:

```typescript
interface ThumbnailOptions {
  maxWidth?: number;   // 默认 256
  maxHeight?: number;  // 默认 256
  quality?: number;    // 0-1，默认 0.8
  format?: 'jpeg' | 'webp' | 'png';  // 默认 'jpeg'
}
```

**示例**:

```typescript
// 使用默认配置生成
const thumbUrl = await mediaService.generateThumbnail('abc-123');

// 自定义配置
const thumbUrl = await mediaService.generateThumbnail('abc-123', {
  maxWidth: 512,
  maxHeight: 512,
  quality: 0.9,
  format: 'webp',
});
```

---

## 6. 事件 API

### 6.1 on()

订阅媒体事件。

```typescript
on(event: MediaEventType, handler: (payload: any) => void): () => void
```

**参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| event | `MediaEventType` | 是 | 事件类型 |
| handler | `Function` | 是 | 事件处理函数 |

**返回值**: 取消订阅函数

**MediaEventType**:

```typescript
type MediaEventType = 
  | 'asset:created'      // 资源创建
  | 'asset:updated'      // 资源更新
  | 'asset:deleted'      // 资源删除
  | 'album:created'      // 相册创建
  | 'album:updated'      // 相册更新
  | 'album:deleted'      // 相册删除
  | 'thumbnail:generated'; // 缩略图生成完成
```

**示例**:

```typescript
// 监听新资源创建
const unsubscribe = mediaService.on('asset:created', (asset: MediaAsset) => {
  console.log('新资源:', asset.id);
  // 刷新列表...
});

// 取消订阅
unsubscribe();
```

---

### 6.2 once()

订阅一次性事件（触发后自动取消）。

```typescript
once(event: MediaEventType, handler: (payload: any) => void): void
```

**示例**:

```typescript
mediaService.once('thumbnail:generated', ({ assetId, url }) => {
  console.log(`资源 ${assetId} 的缩略图已生成: ${url}`);
});
```

---

## 7. 统计 API

### 7.1 getStats()

获取媒体库统计信息。

```typescript
async getStats(): Promise<MediaStats>
```

**返回值**:

```typescript
interface MediaStats {
  /** 总资源数 */
  total: number;
  
  /** 按类型统计 */
  byType: {
    image: number;
    video: number;
    audio: number;
  };
  
  /** 按来源统计 */
  bySource: {
    local: number;
    generated: number;
    remote: number;
    camera: number;
    screenshot: number;
  };
  
  /** 收藏数 */
  favorites: number;
  
  /** 相册数 */
  albumCount: number;
  
  /** 总存储大小（字节） */
  totalSize: number;
}
```

**示例**:

```typescript
const stats = await mediaService.getStats();
console.log(`媒体库共有 ${stats.total} 个资源`);
c其中图片 ${stats.byType.image} 张，视频 ${stats.byType.video} 个`);
console.log(`总存储大小: ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`);
```

---

### 7.2 count()

统计符合条件的资源数量。

```typescript
async count(filter?: MediaFilter): Promise<number>
```

**示例**:

```typescript
// 统计所有收藏的图片
const favoriteCount = await mediaService.count({
  type: 'image',
  favorite: true,
});
console.log(`收藏了 ${favoriteCount} 张图片`);
```

---

## 8. 完整使用示例

### 8.1 相机 App 保存照片

```typescript
// camera/CameraApp.vue
import { getMediaService } from '@/services/media';

async function savePhoto(photoBlob: Blob) {
  const mediaService = getMediaService();
  
  const asset = await mediaService.saveAsset(photoBlob, {
    sourceType: 'camera',
    sourceAppId: 'com.camera',
    albumIds: ['camera_roll'],
    generateThumbnail: true,
    metadata: {
      capturedAt: Date.now(),
    },
  });
  
  console.log('照片已保存:', asset.id);
  return asset;
}
```

### 8.2 聊天 App 选择并发送图片

```typescript
// chat/composables/useImagePicker.ts
import { getMediaService } from '@/services/media';

export function useImagePicker() {
  const mediaService = getMediaService();
  
  async function pickAndSend() {
    // 1. 打开图片选择器（调用图库 App 的 Picker 模式）
    const selectedAssets = await openMediaPicker({ multiple: true });
    
    if (selectedAssets.length === 0) return;
    
    // 2. 获取图片 URL 用于预览
    const urls = await mediaService.resolveUris(
      selectedAssets.map(a => a.uri)
    );
    
    // 3. 发送消息
    for (const asset of selectedAssets) {
      await sendMessage({
        type: 'image',
        content: {
          uri: asset.uri,
          width: asset.width,
          height: asset.height,
          previewUrl: urls.get(asset.uri),
        },
      });
    }
  }
  
  return { pickAndSend };
}
```

### 8.3 图库 App 列表展示

```typescript
// gallery/stores/galleryStore.ts
import { defineStore } from 'pinia';
import { getMediaService } from '@/services/media';

export const useGalleryStore = defineStore('gallery', () => {
  const mediaService = getMediaService();
  const assets = ref<MediaAsset[]>([]);
  const loading = ref(false);
  
  // 加载资源
  async function loadAssets(filter?: MediaFilter) {
    loading.value = true;
    try {
      assets.value = await mediaService.queryAssets({
        filter,
        sort: { by: 'createdAt', order: 'desc' },
      });
    } finally {
      loading.value = false;
    }
  }
  
  // 监听变化，自动刷新
  mediaService.on('asset:created', () => loadAssets());
  mediaService.on('asset:deleted', () => loadAssets());
  
  return { assets, loading, loadAssets };
});
```
