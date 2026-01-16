/**
 * 图库 App 入口
 */

// 主应用
export { default as GalleryApp } from './GalleryApp.vue'

// 视图
export * from './views'

// 组件
export * from './components'

// Store
export { useGalleryStore } from './stores'

// 服务
export { getGalleryService, GalleryService } from './services'

// 类型
export type {
  ImageSource,
  GalleryImage,
  LocalImage,
  GeneratedImage,
  RemoteImage,
  AnyImage,
  LocalResourceConfig,
  RemoteHostConfig,
  ImageGenerationConfig,
  Album,
  ImageGenerationRequest,
  ImageGenerationResponse,
  ResourceLoadRequest,
  ResourceLoadResult,
  ImageFilter,
  ImageSort,
  ImageSortBy,
  SortOrder,
} from './types'
