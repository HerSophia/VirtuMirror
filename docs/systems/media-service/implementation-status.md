# 媒体服务实现状态

> 本文档记录媒体服务的当前实现进度、代码位置，以及与目标架构的差距分析。

## 1. 实现状态总览

```text
整体进度: ████████░░░░░░░░░░░░ 40%

┌─────────────────────────────────────────────────────────────────────────┐
│ 功能模块                │ 状态     │ 说明                               │
├─────────────────────────────────────────────────────────────────────────┤
│ 数据模型定义            │ ✅ 已完成 │ GalleryImage 类型体系               │
│ 图片 CRUD 操作          │ ✅ 已完成 │ galleryService 实现                 │
│ 状态管理 (Store)        │ ✅ 已完成 │ galleryStore (Pinia)               │
│ 筛选与排序              │ ✅ 已完成 │ 多维度筛选，四种排序方式            │
│ 相册管理                │ ⚠️ 部分   │ Album 类型定义，缺少完整 CRUD       │
│ 本地资源配置            │ ✅ 已完成 │ LocalResourceConfig 管理            │
│ 图床配置                │ ✅ 已完成 │ RemoteHostConfig 管理               │
│ 图片生成请求            │ ⚠️ 占位   │ 接口定义，实际调用未实现            │
├─────────────────────────────────────────────────────────────────────────┤
│ 独立 IndexedDB 表       │ ❌ 未实现 │ 目前使用 KV 存储                    │
│ 虚拟 URI 系统           │ ❌ 未实现 │ 目前直接使用 URL                    │
│ 缩略图自动生成          │ ❌ 未实现 │ 依赖外部提供                        │
│ 跨应用事件广播          │ ❌ 未实现 │ 无事件机制                          │
│ 媒体选择器组件          │ ❌ 未实现 │ 无 Picker Mode                      │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 已实现功能详解

### 2.1 数据模型定义

**位置**: `src/apps/gallery/types.ts`

**已定义类型**:

| 类型 | 说明 | 行数 |
| ------ | ------ | ------ |
| `ImageSource` | 图片来源类型 (`local` / `generated` / `remote`) | L8 |
| `GalleryImage` | 图片基础信息 | L13-37 |
| `LocalImage` | 本地图片扩展信息 | L40-46 |
| `GeneratedImage` | AI 生成图片扩展信息 | L49-71 |
| `RemoteImage` | 远程图片扩展信息 | L74-84 |
| `AnyImage` | 联合图片类型 | L87 |
| `LocalResourceConfig` | 本地资源配置 | L92-109 |
| `RemoteHostConfig` | 图床配置 | L112-129 |
| `ImageGenerationConfig` | 图片生成配置 | L132-147 |
| `Album` | 相册类型 | L152-160 |
| `ImageFilter` | 筛选条件 | L231-246 |
| `ImageSort` | 排序方式 | L249-256 |
| `GalleryState` | Store 状态 | L261-282 |

**评价**: ✅ 类型定义完善，覆盖了多种图片来源场---

### 2.2 图片 CRUD 操作

**位置**: `src/apps/gallery/services/galleryService.ts`

**已实现方法**:

```typescript
class GalleryService {
  // 图片管理
  getAllImages(): Promise<AnyImage[]>
  saveImages(images: AnyImage[]): Promise<void>
  addImage(image: AnyImage): Promise<void>
  addImages(newImages: AnyImage[]): Promise<void>
  updateImage(id: string, updates: Partial<AnyImage>): Promise<void>
  deleteImage(id: string): Promise<void>
  deleteImages(ids: string[]): Promise<void>
  
  // 本地资源配置
  getLocalConfigs(): Promise<LocalResourceConfig[]>
  saveLocalConfigs(configs: LocalResourceConfig[]): Promise<void>
  addLocalConfig(config): Promise<LocalResourceConfig>
  updateLocalConfig(id: string, updates): Promise<void>
  deleteLocalConfig(id: string): Promise<void>
  
  // 图床配置
  getRemoteHosts(): Promise<RemoteHostConfig[]>
  saveRemoteHosts(hosts: RemoteHostConfig[]): Promise<void>
  addRemoteHost(host): Promise<RemoteHostConfig>
  updateRemoteHost(id: string, updates): Promise<void>
  deleteRemoteHost(id: string): Promise<void>
  
  // 工厂方法
  createLocalImage(params): LocalImage
  createGeneratedImage(params): GeneratedImage
  createRemoteImage(params): RemoteImage
}
```

**存储方式**: 使用 `AppDataService` (KV 存储)

```typescript
// 数据键名
const KEYS = {
  IMAGES: 'gallery_images',
  LOCAL_CONFIGS: 'local_configs',
  REMOTE_HOSTS: 'remote_hosts',
  GENERATION_CONFIG: 'generation_config',
  ALBUMS: 'albums',
};
```

**问题**:
- ⚠️ 所有图片数据存储在单个 KV 键中，无法高效查询
- ⚠️ 无索引支持，筛选需要全量加载后内存过滤
- ⚠️ 数据量大时性能会成为瓶颈

---

### 2.3 状态管理 (Store)

**位置**: `src/apps/gallery/stores/galleryStore.ts`

**状态定义**:

```typescript
// 核心状态
const images = ref<Map<string, AnyImage>>(new Map())
const albums = ref<Album[]>([])
const localConfigs = ref<LocalResourceConfig[]>([])
const remoteHosts = ref<RemoteHostConfig[]>([])
const generationConfig = ref<ImageGenerationConfig>(defaultGenerationConfig)
const currentFilter = ref<ImageFilter>({})
const currentSort = ref<ImageSort>(defaultSort)
const loading = ref(false)
const generating = ref(false)
const selectedIds = ref<string[]>([])
const initialized = ref(false)
```

**计算属性**:

```typescript
// 派生状态
const imageList = computed(() => Array.from(images.value.values()))
const localImages = computed(() => /* 筛选 source === 'local' */)
const generatedImages = computed(() => /* 筛选 source === 'generated' */)
const remoteImages = computed(() => /* 筛选 source === 'remote' */)
const favoriteImages = computed(() => /* 筛选 favorite === true */)
const filteredImages = computed(() => /* 应用 currentFilter 和 currentSort */)
const stats = computed(() => /* 统计信息 */)
```

**已实现操作**:

| 操作 | 方法 | 说明 |
| ------ | ------ | ------ |
| 初始化 | `init()` | 从 Service 加载数据 |
| 图片增删改 | `addImage()`, `updateImage()`, `deleteImage()` | 同步更新 Store 和 Service |
| 收藏切换 | `toggleFavorite(id)` | 切换收藏状态 |
| 相册设置 | `setImageAlbum(id, albumId)` | 设置图片所属相册 |
| 筛选排序 | `setFilter()`, `setSort()` | 更新筛选/排序条件 |
| 选择操作 | `selectImage()`, `toggleSelect()`, `selectAll()` | 多选功能 |

**评价**: ✅ Store 结构清晰，支持响应式更新

---

### 2.4 筛选与排序

**位置**: `src/apps/gallery/stores/galleryStore.ts` (L104-193)

**支持的筛选维度**:

| 维度 | 字段 | 说明 |
| ------ | ------ | ------ |
| 来源类型 | `filter.source` | 本地/生成/远程 |
| 收藏状态 | `filter.favorite` | 是否收藏 |
| 相册 | `filter.albumId` | 所属相册 |
| 关键词 | `filter.keywords` | 标签匹配 |
| 搜索文本 | `filter.searchText` | 描述/提示词/关键词 |
| 时间范围 | `filter.dateRange` | 创建时间区间 |
| 模型 | `filter.modelId` | AI 生成模型 |

**支持的排序方式**:

| 排序 | 说明 |
| ------ | ------ |
| `createdAt` | 创建时间 |
| `name` | 名称（描述） |
| `size` | 文件大小 |
| `random` | 随机 |

**评价**: ✅ 筛选功能完善，覆盖常见使用场景

---

## 3. 未实现功能分析

### 3.1 独立 IndexedDB 表

**当前状态**: 使用 `AppDataService` 的 KV 结构

```typescript
// 当前实现
await appDataService.set('gallery_images', imagesArray);
const images = await appDataService.get('gallery_images');
```

**问题**:
1. 无法使用 IndexedDB 索引进行高效查询
2. 每次操作需要读写整个数组
3. 数据量增大后性能急剧下降

**目标实现**:

```typescript
// 目标实现
const db = await openDB('media-service', 1, {
  upgrade(db) {
    const store = db.createObjectStore('media_assets', { keyPath: 'id' });
    store.createIndex('type', 'type');
    store.createIndex('createdAt', 'createdAt');
    store.createIndex('albumIds', 'albumIds', { multiEntry: true });
    store.createIndex('tags', 'tags', { multiEntry: true });
  },
});

// 高效查询
const images = await db.getAllFromIndex('media_assets', 'type', 'image');
```

**优先级**: 🔴 高

---

### 3.2 虚拟 URI 系统

**当前状态**: 直接使用 URL 字符串

```typescript
// 当前实现
interface GalleryImage {
  url: string;         // 直接存储可访问的 URL
  thumbnail?: string;  // 直接存储缩略图 URL
}
```

**问题**:
1. URL 可能失效（远程资源）
2. 无法统一管理存储后端
3. 难以实现 Blob 存储优化

**目标实现**:

```typescript
// 目标实现
interface MediaAsset {
  uri: string;           // 'internal://media/images/abc-123'
  thumbnailUri?: string; // 'internal://media/thumbnails/abc-123'
}
// 使用时解析
const displayUrl = await mediaService.resolveUri(asset.uri);
```

**优先级**: 🔴 高

---

### 3.3 缩略图自动生成

**当前状态**: 依赖外部提供缩略图

```typescript
// 当前实现
createLocalImage(params: {
  thumbnail?: string;  // 需要外部提供
}): LocalImage
```

**目标实现**:

```typescript
// 目标实现
async function saveAsset(blob: Blob, options: SaveOptions) {
  // 自动生成缩略图
  const thumbnail = await thumbnailGenerator.generate(blob, {
    maxWidth: 256,
    maxHeight: 256,
  });
  
  // 存储缩略图
  await blobStorage.set(`thumb_${id}`, thumbnail);
}
```

**优先级**: 🟡 中

---

### 3.4 跨应用事件广播

**当前状态**: 无事件机制

```typescript
// 当前实现
async function addImage(image: AnyImage) {
  images.value.set(image.id, image);
  await getGalleryService().addImage(image);
  // 没有事件通知其他 App
}
```

**目标实现**:

```typescript
// 目标实现
async function saveAsset(blob, options) {
  const asset = await this.createAsset(blob, options);
  
  // 广播事件
  this.eventDispatcher.emit('asset:created', asset);
  
  return asset;
}

// 其他 App 监听
mediaService.on('asset:created', (asset) => {
  console.log('新资源已添加:', asset.id);
});
```

**优先级**: 🟡 中

---

### 3.5 媒体选择器组件

**当前状态**: 无 Picker Mode

**目标实现**:

```typescript
// 调用选择器
const selected = await mediaService.openPicker({
  mode: 'select',
  multiple: true,
  filter: { type: 'image' },
  maxCount: 9,
});

// 返回结果
// [{ uri, width, height, mimeType }, ...]
```

**优先级**: 🟡 中

---

## 4. 代码位置索引

### 4.1 Gallery App 文件结构

```text
src/apps/gallery/
├── components/
│   ├── FilterBar.vue          # 筛选栏组件
│   ├── GalleryHeader.vue      # 头部组件
│   ├── ImageCard.vue          # 图片卡片
│   ├── ImageGrid.vue          # 图片网格
│   └── index.ts               # 组件导出
├── services/
│   ├── galleryService.ts      # 核心服务 ⭐
│   └── index.ts               # 服务导出
├── stores/
│   ├── galleryStore.ts        # Pinia Store ⭐
│   └── index.ts               # Store 导出
├── views/
│   ├── GalleryDetail.vue      # 图片详情页
│   ├── GallerySettings.vue    # 设置页
│   └── index.ts               # 视图导出
├── GalleryApp.vue             # 主入口
├── index.ts                   # App 导出
└── types.ts                   # 类型定义 ⭐
```

### 4.2 依赖的系统服务

| 服务 | 文件 | 用途 |
| ------ | ------ | ------ |
| AppDataService | `src/services/appDataService.ts` | KV 数据存储 |

---

## 5. 迁移路径

### Phase 1: 创建系统服务 (4-6h)

1. 创建 `src/services/media/` 目录
2. 实现 `MediaService` 核心类
3. 创建 IndexedDB 表 (`media_assets`, `media_albums`)
4. 实现基础 CRUD 操作

### Phase 2: 数据迁移 (2-3h)

1. 编写迁移脚本
2. 将 `gallery_images` 数据迁移到新表
3. 类型转换 (`GalleryImage` → `MediaAsset`)
4. 验证数据完整性

### Phase 3: Store 接入 (2-3h)

1. 修改 `galleryStore` 调用 `MediaService`
2. 保持 API 兼容（适配层）
3. 验证现有功能正常

### Phase 4: 增强功能 (3-4h)

1. 实现虚拟 URI 系统
2. 实现缩略图自动生成
3. 实现事件广播机制
4. 实现媒体选择器

### 总预估工作量: 11-16h

---

## 6. 风险与注意事项

### 6.1 数据迁移风险

| 风险 | 影响 | 缓解措施 |
| ------ | ------ | ---------- |
| 数据丢失 | 高 | 迁移前备份，保留旧数据 |
| 类型不兼容 | 中 | 充分测试类型转换逻辑 |
| 字段遗漏 | 中 | 检查所有字段映射 |

### 6.2 兼容性注意

1. **保持 Gallery App 正常运行**: 迁移过程中不破坏现有功能
2. **渐进式迁移**: 可以先让新旧系统并存，逐步切换
3. **回滚机制**: 保留旧数据，支持回滚

### 6.3 性能考量

1. **大量图片时的加载策略**: 分页加载，虚拟滚动
2. **缩略图生成的时机**: 异步生成，不阻塞主流程
3. **内存管理**: 及时释放 Blob URL
