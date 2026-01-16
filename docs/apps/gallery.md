# 图库 App (Gallery)

图库应用用于管理本地图片、AI生成图片和图床图片，提供统一的图片浏览、搜索和管理功能。

## 目录结构

```
src/apps/gallery/
├── GalleryApp.vue           # 主应用入口
├── index.ts                 # 统一导出
├── types.ts                 # 类型定义
├── components/              # 共享组件
│   ├── GalleryHeader.vue    # 头部导航
│   ├── ImageCard.vue        # 图片卡片
│   ├── ImageGrid.vue        # 图片网格
│   ├── FilterBar.vue        # 筛选栏
│   └── index.ts
├── views/                   # 视图组件
│   ├── GalleryDetail.vue    # 图片详情
│   ├── GallerySettings.vue  # 设置页面
│   └── index.ts
├── stores/                  # 状态管理
│   ├── galleryStore.ts
│   └── index.ts
└── services/                # 服务层
    ├── galleryService.ts
    └── index.ts
```

## 核心功能

### 1. 图片来源

图库支持三种图片来源：

| 来源 | 标识 | 说明 |
|------|------|------|
| 本地图片 | `local` | 从配置的本地路径加载的图片 |
| AI生成 | `generated` | 通过LLM或生图模型生成的图片 |
| 图床 | `remote` | 从配置的图床服务获取的图片 |

### 2. 本地资源管理

用户可以配置多个本地资源路径：

```typescript
interface LocalResourceConfig {
  id: string
  name: string          // 配置名称
  paths: string[]       // 路径列表
  enabled: boolean      // 是否启用
  scanSubdirs: boolean  // 是否扫描子目录
  fileTypes?: string[]  // 文件类型过滤
}
```

**使用场景**：
- 项目启动时，根据配置的路径列表批量加载图片
- 支持多个独立的资源配置，可分别启用/禁用
- 支持递归扫描子目录

### 3. AI图片生成

当LLM需要生成图片时，通过类似 function_call 的方式调用生图服务：

```typescript
interface ImageGenerationRequest {
  prompt: string            // 生成提示词
  negativePrompt?: string   // 负面提示词
  description?: string      // 图片描述（LLM提供）
  keywords?: string[]       // 关键词（LLM提供）
  sourceMessageId?: number  // 来源消息ID
  // ... 其他生成参数
}
```

**工作流程**：
1. LLM决定需要生成图片
2. LLM提供 prompt、description、keywords 等信息
3. 调用生图服务（SD WebUI、本地模型等）
4. 生成的图片保存到项目图片文件夹
5. 图片元数据（提示词、关键词等）自动记录

### 4. 图床管理

用户可以配置外部图床服务：

```typescript
interface RemoteHostConfig {
  id: string
  name: string
  type: 'custom' | 'imgur' | 'smms' | 'cloudinary'
  baseUrl: string
  apiKey?: string
  enabled: boolean
}
```

**注意**：使用图床时，用户需要自行管理图片的关键词和描述。

## Store 依赖

```
GalleryApp
├── useGalleryStore
│   ├── images: Map<string, AnyImage>    // 所有图片
│   ├── localConfigs: LocalResourceConfig[]  // 本地配置
│   ├── remoteHosts: RemoteHostConfig[]      // 图床配置
│   ├── generationConfig: ImageGenerationConfig  // 生成配置
│   ├── currentFilter: ImageFilter     // 筛选条件
│   └── currentSort: ImageSort         // 排序方式
└── useRouter
```

## 路由配置

```typescript
{
  path: '/gallery',
  name: 'GalleryApp',
  component: GalleryApp,
  children: [
    {
      path: ':imageId',
      name: 'GalleryDetail',
      component: GalleryDetail
    },
    {
      path: 'settings',
      name: 'GallerySettings',
      component: GallerySettings
    }
  ]
}
```

## 组件说明

### GalleryHeader

头部导航组件。

**Props**:
- `title?: string` - 标题文本
- `showBack?: boolean` - 是否显示返回按钮
- `showSearch?: boolean` - 是否显示搜索按钮
- `showMenu?: boolean` - 是否显示菜单按钮

**Events**:
- `search` - 点击搜索
- `menu` - 点击菜单

### ImageCard

单个图片卡片组件。

**Props**:
- `image: AnyImage` - 图片数据
- `selected?: boolean` - 是否选中
- `selectionMode?: boolean` - 是否处于选择模式

**Events**:
- `click` - 点击图片
- `select` - 选择图片（选择模式下）
- `longPress` - 长按图片

### ImageGrid

图片网格布局组件。

**Props**:
- `images: AnyImage[]` - 图片列表
- `columns?: number` - 列数（默认3）
- `selectionMode?: boolean` - 选择模式
- `selectedIds?: string[]` - 选中的ID列表
- `emptyText?: string` - 空状态文本

**Events**:
- `imageClick` - 点击图片
- `imageSelect` - 选择图片
- `imageLongPress` - 长按图片

### FilterBar

筛选和排序栏。

**Props**:
- `activeSource?: ImageSource | 'all' | 'favorite'` - 当前来源筛选
- `currentSort: ImageSort` - 当前排序

**Events**:
- `update:activeSource` - 更新来源筛选
- `update:currentSort` - 更新排序

## 服务接口

### GalleryService

```typescript
class GalleryService {
  // 图片管理
  getAllImages(): Promise<AnyImage[]>
  addImage(image: AnyImage): Promise<void>
  updateImage(id: string, updates: Partial<AnyImage>): Promise<void>
  deleteImage(id: string): Promise<void>
  
  // 本地资源
  getLocalConfigs(): Promise<LocalResourceConfig[]>
  addLocalConfig(config): Promise<LocalResourceConfig>
  loadLocalResources(request): Promise<ResourceLoadResult>
  
  // 图床
  getRemoteHosts(): Promise<RemoteHostConfig[]>
  addRemoteHost(host): Promise<RemoteHostConfig>
  
  // 图片生成
  generateImage(request): Promise<ImageGenerationResponse>
}
```

## 外部集成点

### 1. 本地资源加载器

需要实现一个方法来扫描和加载本地图片文件。该方法在项目启动时被调用：

```typescript
// 待实现
async function scanLocalImages(paths: string[]): Promise<LocalImage[]> {
  // 扫描指定路径
  // 读取图片文件
  // 生成缩略图（可选）
  // 返回 LocalImage 对象数组
}
```

### 2. 图片生成服务

需要对接实际的图片生成服务：

```typescript
// 待实现
async function callImageGeneration(request: ImageGenerationRequest): Promise<string> {
  // 调用 SD WebUI API 或其他生图服务
  // 保存生成的图片
  // 返回图片路径或URL
}
```

### 3. LLM Function Call

当LLM需要生成图片时，调用方式类似于：

```json
{
  "function": "generate_image",
  "arguments": {
    "prompt": "一只橘猫坐在窗台上",
    "description": "温暖阳光下的橘猫",
    "keywords": ["橘猫", "窗台", "阳光"]
  }
}
```

## 数据持久化

图库数据通过 `AppDataService` 持久化到 IndexedDB：

- 命名空间：`builtin/gallery`
- 存储键：
  - `gallery_images` - 图片列表
  - `local_configs` - 本地资源配置
  - `remote_hosts` - 图床配置
  - `generation_config` - 生成配置
  - `albums` - 相册列表

## 待实现功能

- [ ] 本地文件扫描器集成
- [ ] 图片生成服务集成（SD WebUI等）
- [ ] 图床API对接
- [ ] 相册/分组管理
- [ ] 图片编辑功能
- [ ] 批量操作
- [ ] 导入/导出功能
