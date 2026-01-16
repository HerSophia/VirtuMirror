/**
 * 图库App类型定义
 */

// ==================== 图片来源 ====================

/** 图片来源类型 */
export type ImageSource = 'local' | 'generated' | 'remote'

// ==================== 图片数据 ====================

/** 图库图片基础信息 */
export interface GalleryImage {
  /** 唯一标识 */
  id: string
  /** 来源类型 */
  source: ImageSource
  /** 图片URL（可以是本地路径、data URL或远程URL） */
  url: string
  /** 缩略图URL */
  thumbnail?: string
  /** 图片描述（人工或AI生成的语义描述） */
  description?: string
  /** 关键词标签（用于搜索和分类） */
  keywords?: string[]
  /** 创建/导入时间 */
  createdAt: number
  /** 图片尺寸 */
  width?: number
  height?: number
  /** 文件大小（字节） */
  fileSize?: number
  /** 是否收藏 */
  favorite?: boolean
  /** 自定义分组/相册ID */
  albumId?: string
}

/** 本地图片扩展信息 */
export interface LocalImage extends GalleryImage {
  source: 'local'
  /** 本地文件路径（相对于项目根目录） */
  localPath: string
  /** 所属资源配置ID */
  resourceConfigId?: string
}

/** AI生成图片扩展信息 */
export interface GeneratedImage extends GalleryImage {
  source: 'generated'
  /** 生成提示词 */
  prompt: string
  /** 负面提示词 */
  negativePrompt?: string
  /** 使用的模型ID/名称 */
  modelId?: string
  /** 模型名称（显示用） */
  modelName?: string
  /** 随机种子 */
  seed?: number
  /** 采样步数 */
  steps?: number
  /** CFG Scale */
  cfgScale?: number
  /** 采样器名称 */
  sampler?: string
  /** 生成耗时（毫秒） */
  generationTime?: number
  /** 来源消息ID（追溯AI对话） */
  sourceMessageId?: number
}

/** 图床/远程图片扩展信息 */
export interface RemoteImage extends GalleryImage {
  source: 'remote'
  /** 图床配置ID */
  remoteHostId: string
  /** 原始URL */
  originalUrl: string
  /** 是否已缓存到本地 */
  cached?: boolean
  /** 本地缓存路径 */
  cachePath?: string
}

/** 联合图片类型 */
export type AnyImage = LocalImage | GeneratedImage | RemoteImage

// ==================== 配置类型 ====================

/** 本地资源配置 */
export interface LocalResourceConfig {
  /** 配置ID */
  id: string
  /** 配置名称 */
  name: string
  /** 路径列表（相对于项目根目录或绝对路径） */
  paths: string[]
  /** 是否启用 */
  enabled: boolean
  /** 是否扫描子目录 */
  scanSubdirs: boolean
  /** 文件类型过滤（扩展名，如 ['jpg', 'png', 'webp']） */
  fileTypes?: string[]
  /** 上次扫描时间 */
  lastScanAt?: number
  /** 扫描到的图片数量 */
  imageCount?: number
}

/** 图床配置 */
export interface RemoteHostConfig {
  /** 配置ID */
  id: string
  /** 显示名称 */
  name: string
  /** 图床类型 */
  type: 'custom' | 'imgur' | 'smms' | 'cloudinary'
  /** 基础URL */
  baseUrl: string
  /** API密钥（如需要） */
  apiKey?: string
  /** 其他认证信息 */
  authConfig?: Record<string, string>
  /** 是否启用 */
  enabled: boolean
  /** 创建时间 */
  createdAt: number
}

/** 图片生成配置 */
export interface ImageGenerationConfig {
  /** 默认模型ID */
  defaultModelId?: string
  /** 默认尺寸 */
  defaultSize?: { width: number; height: number }
  /** 默认采样步数 */
  defaultSteps?: number
  /** 默认CFG Scale */
  defaultCfgScale?: number
  /** 保存路径（相对于项目根目录） */
  savePath: string
  /** 是否自动生成缩略图 */
  autoThumbnail: boolean
  /** 缩略图尺寸 */
  thumbnailSize?: number
}

// ==================== 相册/分组 ====================

/** 相册 */
export interface Album {
  id: string
  name: string
  description?: string
  coverImageId?: string
  imageCount: number
  createdAt: number
  updatedAt: number
}

// ==================== 图片生成请求/响应 ====================

/** 图片生成请求 */
export interface ImageGenerationRequest {
  /** 提示词 */
  prompt: string
  /** 负面提示词 */
  negativePrompt?: string
  /** 模型ID */
  modelId?: string
  /** 图片尺寸 */
  size?: { width: number; height: number }
  /** 生成数量 */
  count?: number
  /** 随机种子（-1表示随机） */
  seed?: number
  /** 采样步数 */
  steps?: number
  /** CFG Scale */
  cfgScale?: number
  /** 采样器 */
  sampler?: string
  /** 参考图片（用于img2img） */
  referenceImage?: string
  /** 图片描述（由LLM提供，用于存储） */
  description?: string
  /** 关键词（由LLM提供，用于存储） */
  keywords?: string[]
  /** 来源消息ID */
  sourceMessageId?: number
}

/** 图片生成响应 */
export interface ImageGenerationResponse {
  success: boolean
  images?: GeneratedImage[]
  error?: string
  /** 生成耗时 */
  duration?: number
}

// ==================== 本地资源加载 ====================

/** 资源加载请求 */
export interface ResourceLoadRequest {
  /** 资源配置ID列表（空表示加载所有启用的配置） */
  configIds?: string[]
  /** 是否强制重新扫描 */
  forceRescan?: boolean
}

/** 资源加载结果 */
export interface ResourceLoadResult {
  success: boolean
  /** 加载的图片数量 */
  loadedCount: number
  /** 新增图片数量 */
  newCount: number
  /** 失败数量 */
  failedCount: number
  /** 失败详情 */
  errors?: Array<{ path: string; error: string }>
  /** 加载耗时 */
  duration: number
}

// ==================== 筛选和搜索 ====================

/** 图片筛选条件 */
export interface ImageFilter {
  /** 来源类型 */
  source?: ImageSource | ImageSource[]
  /** 关键词（任意匹配） */
  keywords?: string[]
  /** 搜索文本（匹配描述、提示词、关键词） */
  searchText?: string
  /** 相册ID */
  albumId?: string
  /** 是否收藏 */
  favorite?: boolean
  /** 时间范围 */
  dateRange?: { start?: number; end?: number }
  /** 模型ID（仅生成图片） */
  modelId?: string
}

/** 排序方式 */
export type ImageSortBy = 'createdAt' | 'name' | 'size' | 'random'
export type SortOrder = 'asc' | 'desc'

/** 图片排序 */
export interface ImageSort {
  by: ImageSortBy
  order: SortOrder
}

// ==================== Gallery Store 状态 ====================

/** 图库状态 */
export interface GalleryState {
  /** 所有图片 */
  images: Map<string, AnyImage>
  /** 相册列表 */
  albums: Album[]
  /** 本地资源配置 */
  localConfigs: LocalResourceConfig[]
  /** 图床配置 */
  remoteHosts: RemoteHostConfig[]
  /** 生成配置 */
  generationConfig: ImageGenerationConfig
  /** 当前筛选条件 */
  currentFilter: ImageFilter
  /** 当前排序 */
  currentSort: ImageSort
  /** 是否正在加载 */
  loading: boolean
  /** 是否正在生成 */
  generating: boolean
  /** 选中的图片ID列表 */
  selectedIds: string[]
}
