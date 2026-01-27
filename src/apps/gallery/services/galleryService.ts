/**
 * 图库服务
 * 
 * 提供图片管理的核心功能：
 * - 本地资源扫描和加载
 * - 图片生成请求
 * - 图床管理
 */

import type {
  AnyImage,
  LocalImage,
  GeneratedImage,
  RemoteImage,
  LocalResourceConfig,
  RemoteHostConfig,
  ImageGenerationRequest,
  ImageGenerationResponse,
  ResourceLoadRequest,
  ResourceLoadResult,
} from '../types'
import { createAppDataService, type AppDataService } from '@/services/appRuntime'

/**
 * 生成唯一ID
 */
function generateId(): string {
  // 优先使用 crypto.randomUUID
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // 降级方案
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// 数据键名常量
const KEYS = {
  IMAGES: 'gallery_images',
  LOCAL_CONFIGS: 'local_configs',
  REMOTE_HOSTS: 'remote_hosts',
  GENERATION_CONFIG: 'generation_config',
  ALBUMS: 'albums',
}

/**
 * 图库服务类
 */
export class GalleryService {
  private dataService: AppDataService
  
  constructor(namespace: string = 'builtin/gallery') {
    this.dataService = createAppDataService(namespace)
  }
  
  // ==================== 图片管理 ====================
  
  /**
   * 获取所有图片
   */
  async getAllImages(): Promise<AnyImage[]> {
    const images = await this.dataService.get<AnyImage[]>(KEYS.IMAGES)
    return images || []
  }
  
  /**
   * 保存图片列表
   */
  async saveImages(images: AnyImage[]): Promise<void> {
    await this.dataService.set(KEYS.IMAGES, images)
  }
  
  /**
   * 添加图片
   */
  async addImage(image: AnyImage): Promise<void> {
    const images = await this.getAllImages()
    images.push(image)
    await this.saveImages(images)
  }
  
  /**
   * 批量添加图片
   */
  async addImages(newImages: AnyImage[]): Promise<void> {
    const images = await this.getAllImages()
    images.push(...newImages)
    await this.saveImages(images)
  }
  
  /**
   * 更新图片
   */
  async updateImage(id: string, updates: Partial<AnyImage>): Promise<void> {
    const images = await this.getAllImages()
    const index = images.findIndex(img => img.id === id)
    if (index !== -1) {
      images[index] = { ...images[index], ...updates } as AnyImage
      await this.saveImages(images)
    }
  }
  
  /**
   * 删除图片
   */
  async deleteImage(id: string): Promise<void> {
    const images = await this.getAllImages()
    const filtered = images.filter(img => img.id !== id)
    await this.saveImages(filtered)
  }
  
  /**
   * 批量删除图片
   */
  async deleteImages(ids: string[]): Promise<void> {
    const images = await this.getAllImages()
    const idSet = new Set(ids)
    const filtered = images.filter(img => !idSet.has(img.id))
    await this.saveImages(filtered)
  }
  
  // ==================== 本地资源配置 ====================
  
  /**
   * 获取本地资源配置列表
   */
  async getLocalConfigs(): Promise<LocalResourceConfig[]> {
    const configs = await this.dataService.get<LocalResourceConfig[]>(KEYS.LOCAL_CONFIGS)
    return configs || []
  }
  
  /**
   * 保存本地资源配置
   */
  async saveLocalConfigs(configs: LocalResourceConfig[]): Promise<void> {
    await this.dataService.set(KEYS.LOCAL_CONFIGS, configs)
  }
  
  /**
   * 添加本地资源配置
   */
  async addLocalConfig(config: Omit<LocalResourceConfig, 'id'>): Promise<LocalResourceConfig> {
    const newConfig: LocalResourceConfig = {
      ...config,
      id: generateId(),
    }
    const configs = await this.getLocalConfigs()
    configs.push(newConfig)
    await this.saveLocalConfigs(configs)
    return newConfig
  }
  
  /**
   * 更新本地资源配置
   */
  async updateLocalConfig(id: string, updates: Partial<LocalResourceConfig>): Promise<void> {
    const configs = await this.getLocalConfigs()
    const index = configs.findIndex(c => c.id === id)
    if (index !== -1) {
      configs[index] = { ...configs[index], ...updates }
      await this.saveLocalConfigs(configs)
    }
  }
  
  /**
   * 删除本地资源配置
   */
  async deleteLocalConfig(id: string): Promise<void> {
    const configs = await this.getLocalConfigs()
    const filtered = configs.filter(c => c.id !== id)
    await this.saveLocalConfigs(filtered)
  }
  
  // ==================== 图床配置 ====================
  
  /**
   * 获取图床配置列表
   */
  async getRemoteHosts(): Promise<RemoteHostConfig[]> {
    const hosts = await this.dataService.get<RemoteHostConfig[]>(KEYS.REMOTE_HOSTS)
    return hosts || []
  }
  
  /**
   * 保存图床配置
   */
  async saveRemoteHosts(hosts: RemoteHostConfig[]): Promise<void> {
    await this.dataService.set(KEYS.REMOTE_HOSTS, hosts)
  }
  
  /**
   * 添加图床配置
   */
  async addRemoteHost(host: Omit<RemoteHostConfig, 'id' | 'createdAt'>): Promise<RemoteHostConfig> {
    const newHost: RemoteHostConfig = {
      ...host,
      id: generateId(),
      createdAt: Date.now(),
    }
    const hosts = await this.getRemoteHosts()
    hosts.push(newHost)
    await this.saveRemoteHosts(hosts)
    return newHost
  }
  
  /**
   * 更新图床配置
   */
  async updateRemoteHost(id: string, updates: Partial<RemoteHostConfig>): Promise<void> {
    const hosts = await this.getRemoteHosts()
    const index = hosts.findIndex(h => h.id === id)
    if (index !== -1) {
      hosts[index] = { ...hosts[index], ...updates }
      await this.saveRemoteHosts(hosts)
    }
  }
  
  /**
   * 删除图床配置
   */
  async deleteRemoteHost(id: string): Promise<void> {
    const hosts = await this.getRemoteHosts()
    const filtered = hosts.filter(h => h.id !== id)
    await this.saveRemoteHosts(filtered)
  }
  
  // ==================== 本地资源加载 ====================
  
  /**
   * 加载本地资源
   * 
   * 注意：这个方法需要调用外部的资源加载器
   * 实际的文件扫描和读取需要在运行时环境中完成
   */
  async loadLocalResources(request: ResourceLoadRequest): Promise<ResourceLoadResult> {
    const startTime = Date.now()
    const configs = await this.getLocalConfigs()
    
    // 筛选要加载的配置
    let targetConfigs = configs.filter(c => c.enabled)
    if (request.configIds && request.configIds.length > 0) {
      const idSet = new Set(request.configIds)
      targetConfigs = targetConfigs.filter(c => idSet.has(c.id))
    }
    
    if (targetConfigs.length === 0) {
      return {
        success: true,
        loadedCount: 0,
        newCount: 0,
        failedCount: 0,
        duration: Date.now() - startTime,
      }
    }
    
    // 收集所有路径
    const allPaths: Array<{ path: string; configId: string }> = []
    for (const config of targetConfigs) {
      for (const path of config.paths) {
        allPaths.push({ path, configId: config.id })
      }
    }
    
    // TODO: 调用外部资源加载方法
    // 这里返回一个占位结果，实际实现需要：
    // 1. 调用文件系统API扫描路径
    // 2. 读取图片文件
    // 3. 生成缩略图
    // 4. 创建 LocalImage 记录
    
    console.log('[GalleryService] 待加载的路径:', allPaths)
    
    return {
      success: true,
      loadedCount: 0,
      newCount: 0,
      failedCount: 0,
      duration: Date.now() - startTime,
    }
  }
  
  /**
   * 创建本地图片记录
   * 供外部资源加载器调用
   */
  createLocalImage(params: {
    localPath: string
    url: string
    thumbnail?: string
    description?: string
    keywords?: string[]
    width?: number
    height?: number
    fileSize?: number
    resourceConfigId?: string
  }): LocalImage {
    return {
      id: generateId(),
      source: 'local',
      url: params.url,
      thumbnail: params.thumbnail,
      localPath: params.localPath,
      description: params.description,
      keywords: params.keywords,
      width: params.width,
      height: params.height,
      fileSize: params.fileSize,
      createdAt: Date.now(),
      resourceConfigId: params.resourceConfigId,
    }
  }
  
  // ==================== 图片生成 ====================
  
  /**
   * 请求生成图片
   * 
   * 注意：这个方法需要调用外部的图片生成服务
   * 可以是本地部署的 Stable Diffusion 或云端的生图API
   */
  async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    const startTime = Date.now()
    
    // TODO: 调用外部图片生成API
    // 这里返回一个占位结果，实际实现需要：
    // 1. 调用生图API（SD WebUI、Midjourney等）
    // 2. 保存生成的图片到本地
    // 3. 创建 GeneratedImage 记录
    
    console.log('[GalleryService] 生图请求:', request)
    
    return {
      success: false,
      error: '图片生成服务尚未配置',
      duration: Date.now() - startTime,
    }
  }
  
  /**
   * 创建生成图片记录
   * 供外部生成服务调用
   */
  createGeneratedImage(params: {
    url: string
    thumbnail?: string
    prompt: string
    negativePrompt?: string
    description?: string
    keywords?: string[]
    modelId?: string
    modelName?: string
    seed?: number
    steps?: number
    cfgScale?: number
    sampler?: string
    width?: number
    height?: number
    fileSize?: number
    generationTime?: number
    sourceMessageId?: number
  }): GeneratedImage {
    return {
      id: generateId(),
      source: 'generated',
      url: params.url,
      thumbnail: params.thumbnail,
      prompt: params.prompt,
      negativePrompt: params.negativePrompt,
      description: params.description,
      keywords: params.keywords,
      modelId: params.modelId,
      modelName: params.modelName,
      seed: params.seed,
      steps: params.steps,
      cfgScale: params.cfgScale,
      sampler: params.sampler,
      width: params.width,
      height: params.height,
      fileSize: params.fileSize,
      generationTime: params.generationTime,
      sourceMessageId: params.sourceMessageId,
      createdAt: Date.now(),
    }
  }
  
  /**
   * 创建远程图片记录
   */
  createRemoteImage(params: {
    url: string
    originalUrl: string
    thumbnail?: string
    description?: string
    keywords?: string[]
    remoteHostId: string
    width?: number
    height?: number
    fileSize?: number
  }): RemoteImage {
    return {
      id: generateId(),
      source: 'remote',
      url: params.url,
      originalUrl: params.originalUrl,
      thumbnail: params.thumbnail,
      description: params.description,
      keywords: params.keywords,
      remoteHostId: params.remoteHostId,
      width: params.width,
      height: params.height,
      fileSize: params.fileSize,
      createdAt: Date.now(),
      cached: false,
    }
  }
}

// 单例
let galleryService: GalleryService | null = null

/**
 * 获取图库服务实例
 */
export function getGalleryService(): GalleryService {
  if (!galleryService) {
    galleryService = new GalleryService()
  }
  return galleryService
}

/**
 * 重置图库服务（用于测试）
 */
export function resetGalleryService(): void {
  galleryService = null
}
