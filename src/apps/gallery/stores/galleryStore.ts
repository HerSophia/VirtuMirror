/**
 * 图库状态管理
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  AnyImage,
  LocalImage,
  GeneratedImage,
  RemoteImage,
  Album,
  LocalResourceConfig,
  RemoteHostConfig,
  ImageGenerationConfig,
  ImageFilter,
  ImageSort,
  ImageGenerationRequest,
  ResourceLoadRequest,
} from '../types'
import { getGalleryService } from '../services'

/**
 * 默认生成配置
 */
const defaultGenerationConfig: ImageGenerationConfig = {
  savePath: 'assets/gallery/generated',
  autoThumbnail: true,
  thumbnailSize: 256,
  defaultSteps: 20,
  defaultCfgScale: 7,
}

/**
 * 默认排序
 */
const defaultSort: ImageSort = {
  by: 'createdAt',
  order: 'desc',
}

export const useGalleryStore = defineStore('gallery', () => {
  // ==================== 状态 ====================
  
  /** 所有图片 */
  const images = ref<Map<string, AnyImage>>(new Map())
  
  /** 相册列表 */
  const albums = ref<Album[]>([])
  
  /** 本地资源配置 */
  const localConfigs = ref<LocalResourceConfig[]>([])
  
  /** 图床配置 */
  const remoteHosts = ref<RemoteHostConfig[]>([])
  
  /** 生成配置 */
  const generationConfig = ref<ImageGenerationConfig>(defaultGenerationConfig)
  
  /** 当前筛选条件 */
  const currentFilter = ref<ImageFilter>({})
  
  /** 当前排序 */
  const currentSort = ref<ImageSort>(defaultSort)
  
  /** 加载状态 */
  const loading = ref(false)
  
  /** 生成中状态 */
  const generating = ref(false)
  
  /** 选中的图片ID */
  const selectedIds = ref<string[]>([])
  
  /** 是否已初始化 */
  const initialized = ref(false)
  
  // ==================== 计算属性 ====================
  
  /** 图片列表（数组形式） */
  const imageList = computed(() => Array.from(images.value.values()))
  
  /** 本地图片 */
  const localImages = computed(() => 
    imageList.value.filter((img): img is LocalImage => img.source === 'local')
  )
  
  /** 生成的图片 */
  const generatedImages = computed(() =>
    imageList.value.filter((img): img is GeneratedImage => img.source === 'generated')
  )
  
  /** 远程图片 */
  const remoteImages = computed(() =>
    imageList.value.filter((img): img is RemoteImage => img.source === 'remote')
  )
  
  /** 收藏的图片 */
  const favoriteImages = computed(() =>
    imageList.value.filter(img => img.favorite)
  )
  
  /** 根据筛选和排序返回的图片 */
  const filteredImages = computed(() => {
    let result = imageList.value
    
    const filter = currentFilter.value
    
    // 按来源筛选
    if (filter.source) {
      const sources = Array.isArray(filter.source) ? filter.source : [filter.source]
      result = result.filter(img => sources.includes(img.source))
    }
    
    // 按收藏筛选
    if (filter.favorite !== undefined) {
      result = result.filter(img => img.favorite === filter.favorite)
    }
    
    // 按相册筛选
    if (filter.albumId) {
      result = result.filter(img => img.albumId === filter.albumId)
    }
    
    // 按关键词筛选
    if (filter.keywords && filter.keywords.length > 0) {
      const keywords = filter.keywords.map(k => k.toLowerCase())
      result = result.filter(img => {
        if (!img.keywords) return false
        return keywords.some(k => 
          img.keywords!.some(ik => ik.toLowerCase().includes(k))
        )
      })
    }
    
    // 按搜索文本筛选
    if (filter.searchText) {
      const text = filter.searchText.toLowerCase()
      result = result.filter(img => {
        // 搜索描述
        if (img.description?.toLowerCase().includes(text)) return true
        // 搜索关键词
        if (img.keywords?.some(k => k.toLowerCase().includes(text))) return true
        // 搜索提示词（仅生成图片）
        if (img.source === 'generated') {
          const genImg = img as GeneratedImage
          if (genImg.prompt.toLowerCase().includes(text)) return true
        }
        return false
      })
    }
    
    // 按时间范围筛选
    if (filter.dateRange) {
      if (filter.dateRange.start) {
        result = result.filter(img => img.createdAt >= filter.dateRange!.start!)
      }
      if (filter.dateRange.end) {
        result = result.filter(img => img.createdAt <= filter.dateRange!.end!)
      }
    }
    
    // 按模型筛选（仅生成图片）
    if (filter.modelId) {
      result = result.filter(img => {
        if (img.source !== 'generated') return false
        return (img as GeneratedImage).modelId === filter.modelId
      })
    }
    
    // 排序
    const sort = currentSort.value
    result = [...result].sort((a, b) => {
      let comparison = 0
      switch (sort.by) {
        case 'createdAt':
          comparison = a.createdAt - b.createdAt
          break
        case 'name':
          comparison = (a.description || '').localeCompare(b.description || '')
          break
        case 'size':
          comparison = (a.fileSize || 0) - (b.fileSize || 0)
          break
        case 'random':
          comparison = Math.random() - 0.5
          break
      }
      return sort.order === 'asc' ? comparison : -comparison
    })
    
    return result
  })
  
  /** 统计信息 */
  const stats = computed(() => ({
    total: imageList.value.length,
    local: localImages.value.length,
    generated: generatedImages.value.length,
    remote: remoteImages.value.length,
    favorites: favoriteImages.value.length,
  }))
  
  // ==================== 操作方法 ====================
  
  /**
   * 初始化：从存储加载数据
   */
  async function init() {
    if (initialized.value) return
    
    loading.value = true
    try {
      const service = getGalleryService()
      
      // 加载图片
      const allImages = await service.getAllImages()
      images.value = new Map(allImages.map(img => [img.id, img]))
      
      // 加载配置
      localConfigs.value = await service.getLocalConfigs()
      remoteHosts.value = await service.getRemoteHosts()
      
      initialized.value = true
      console.log('[GalleryStore] 初始化完成，加载了', allImages.length, '张图片')
    } catch (error) {
      console.error('[GalleryStore] 初始化失败:', error)
    } finally {
      loading.value = false
    }
  }
  
  /**
   * 添加图片
   */
  async function addImage(image: AnyImage) {
    images.value.set(image.id, image)
    await getGalleryService().addImage(image)
  }
  
  /**
   * 批量添加图片
   */
  async function addImages(newImages: AnyImage[]) {
    for (const img of newImages) {
      images.value.set(img.id, img)
    }
    await getGalleryService().addImages(newImages)
  }
  
  /**
   * 更新图片
   */
  async function updateImage(id: string, updates: Partial<AnyImage>) {
    const existing = images.value.get(id)
    if (existing) {
      const updated = { ...existing, ...updates } as AnyImage
      images.value.set(id, updated)
      await getGalleryService().updateImage(id, updates)
    }
  }
  
  /**
   * 删除图片
   */
  async function deleteImage(id: string) {
    images.value.delete(id)
    selectedIds.value = selectedIds.value.filter(sid => sid !== id)
    await getGalleryService().deleteImage(id)
  }
  
  /**
   * 批量删除图片
   */
  async function deleteImages(ids: string[]) {
    const idSet = new Set(ids)
    for (const id of ids) {
      images.value.delete(id)
    }
    selectedIds.value = selectedIds.value.filter(sid => !idSet.has(sid))
    await getGalleryService().deleteImages(ids)
  }
  
  /**
   * 切藏
   */
  async function toggleFavorite(id: string) {
    const img = images.value.get(id)
    if (img) {
      await updateImage(id, { favorite: !img.favorite })
    }
  }
  
  /**
   * 设置图片到相册
   */
  async function setImageAlbum(id: string, albumId: string | undefined) {
    await updateImage(id, { albumId })
  }
  
  // ==================== 筛选和排序 ====================
  
  /**
   * 设置筛选条件
   */
  function setFilter(filter: ImageFilter) {
    currentFilter.value = filter
  }
  
  /**
   * 清除筛选条件
   */
  function clearFilter() {
    currentFilter.value = {}
  }
  
  /**
   * 设置排序
   */
  function setSort(sort: ImageSort) {
    currentSort.value = sort
  }
  
  // ==================== 选择操作 ====================
  
  /**
   * 选择图片
   */
  function selectImage(id: string) {
    if (!selectedIds.value.includes(id)) {
      selectedIds.value.push(id)
    }
  }
  
  /**
   * 取消选择图片
   */
  function deselectImage(id: string) {
    selectedIds.value = selectedIds.value.filter(sid => sid !== id)
  }
  
  /**
   * 切换选择
   */
  function toggleSelect(id: string) {
    if (selectedIds.value.includes(id)) {
      deselectImage(id)
    } else {
      selectImage(id)
    }
  }
  
  /**
   * 全选
   */
  function selectAll() {
    selectedIds.value = filteredImages.value.map(img => img.id)
  }
  
  /**
   * 清除选择
   */
  function clearSelection() {
    selectedIds.value = []
  }
  
  // ==================== 本地资源配置 ====================
  
  /**
   * 添加本地资源配置
   */
  async function addLocalConfig(config: Omit<LocalResourceConfig, 'id'>) {
    const newConfig = await getGalleryService().addLocalConfig(config)
    localConfigs.value.push(newConfig)
    return newConfig
  }
  
  /**
   * 更新本地资源配置
   */
  async function updateLocalConfig(id: string, updates: Partial<LocalResourceConfig>) {
    await getGalleryService().updateLocalConfig(id, updates)
    const index = localConfigs.value.findIndex(c => c.id === id)
    if (index !== -1) {
      localConfigs.value[index] = { ...localConfigs.value[index], ...updates }
    }
  }
  
  /**
   * 删除本地资源配置
   */
  async function deleteLocalConfig(id: string) {
    await getGalleryService().deleteLocalConfig(id)
    localConfigs.value = localConfigs.value.filter(c => c.id !== id)
  }
  
  /**
   * 加载本地资源
   */
  async function loadLocalResources(request: ResourceLoadRequest = {}) {
    loading.value = true
    try {
      const result = await getGalleryService().loadLocalResources(request)
      // 重新加载图片列表
      const allImages = await getGalleryService().getAllImages()
      images.value = new Map(allImages.map(img => [img.id, img]))
      return result
    } finally {
      loading.value = false
    }
  }
  
  // ==================== 图床配置 ====================
  
  /**
   * 添加图床配置
   */
  async function addRemoteHost(host: Omit<RemoteHostConfig, 'id' | 'createdAt'>) {
    const newHost = await getGalleryService().addRemoteHost(host)
    remoteHosts.value.push(newHost)
    return newHost
  }
  
  /**
   * 更新图床配置
   */
  async function updateRemoteHost(id: string, updates: Partial<RemoteHostConfig>) {
    await getGalleryService().updateRemoteHost(id, updates)
    const index = remoteHosts.value.findIndex(h => h.id === id)
    if (index !== -1) {
      remoteHosts.value[index] = { ...remoteHosts.value[index], ...updates }
    }
  }
  
  /**
   * 删除图床配置
   */
  async function deleteRemoteHost(id: string) {
    await getGalleryService().deleteRemoteHost(id)
    remoteHosts.value = remoteHosts.value.filter(h => h.id !== id)
  }
  
  // ==================== 图片生成 ====================
  
  /**
   * 生成图片
   */
  async function generateImage(request: ImageGenerationRequest) {
    generating.value = true
    try {
      const result = await getGalleryService().generateImage(request)
      if (result.success && result.images) {
        await addImages(result.images)
      }
      return result
    } finally {
      generating.value = false
    }
  }
  
  /**
   * 更新生成配置
   */
  function setGenerationConfig(config: Partial<ImageGenerationConfig>) {
    generationConfig.value = { ...generationConfig.value, ...config }
  }
  
  // ==================== 获取单个图片 ====================
  
  /**
   * 根据ID获取图片
   */
  function getImageById(id: string): AnyImage | undefined {
    return images.value.get(id)
  }
  
  return {
    // 状态
    images,
    albums,
    localConfigs,
    remoteHosts,
    generationConfig,
    currentFilter,
    currentSort,
    loading,
    generating,
    selectedIds,
    initialized,
    
    // 计算属性
    imageList,
    localImages,
    generatedImages,
    remoteImages,
    favoriteImages,
    filteredImages,
    stats,
    
    // 操作方法
    init,
    addImage,
    addImages,
    updateImage,
    deleteImage,
    deleteImages,
    toggleFavorite,
    setImageAlbum,
    getImageById,
    
    // 筛选和排序
    setFilter,
    clearFilter,
    setSort,
    
    // 选择操作
    selectImage,
    deselectImage,
    toggleSelect,
    selectAll,
    clearSelection,
    
    // 本地资源配置
    addLocalConfig,
    updateLocalConfig,
    deleteLocalConfig,
    loadLocalResources,
    
    // 图床配置
    addRemoteHost,
    updateRemoteHost,
    deleteRemoteHost,
    
    // 图片生成
    generateImage,
    setGenerationConfig,
  }
})
