/**
 * 应用商店 Store
 * 
 * 管理应用商店的状态，包括：
 * - 可用应用列表
 * - 已安装应用
 * - 安装/卸载逻辑
 * - 权限管理
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  PhoneAppPackage,
  InstalledApp,
  InstalledAppExtended,
  AppRegistry,
  AppRegistryEntry,
  AppPermission,
  AppCategory,
  AppSource,
  AppStatus
} from '@/types/appPackage'
import type { AppSourceInfo, VerificationStatus } from '@/types/appIdentity'
import { generateInstallationId, calculateContentHash } from '@/types/appIdentity'
import {
  calculateDataNamespace,
  verifyAndInstall,
  verifyUpdate,
  executeDataMigration,
  checkDataMigration,
  createMigrationRecord,
  createVerificationStatus,
} from '@/services/appIdentityService'

// ===== 示例应用数据 =====

const SAMPLE_APPS: AppRegistryEntry[] = [
  {
    id: 'com.example.notes',
    name: '备忘录',
    version: '1.0.0',
    description: '简单易用的备忘录应用，帮助你记录日常想法',
    category: 'productivity',
    icon: {
      type: 'font',
      value: 'fas fa-sticky-note',
      background: 'linear-gradient(135deg, #FFD60A 0%, #FF9500 100%)',
      color: '#FFFFFF'
    },
    author: '示例作者',
    downloads: 1234,
    rating: 4.5,
    updatedAt: '2024-01-15T10:00:00Z',
    packageUrl: '',
    packageSize: 2345,
    permissions: ['storage', 'ai-generate'],
    minPhoneVersion: '2.0.0'
  },
  {
    id: 'com.example.todo',
    name: '待办事项',
    version: '1.2.0',
    description: '管理你的日常任务，提高工作效率',
    category: 'productivity',
    icon: {
      type: 'font',
      value: 'fas fa-check-circle',
      background: '#34C759',
      color: '#FFFFFF'
    },
    author: '示例作者',
    downloads: 2567,
    rating: 4.8,
    updatedAt: '2024-01-20T10:00:00Z',
    packageUrl: '',
    packageSize: 3456,
    permissions: ['storage'],
    minPhoneVersion: '2.0.0'
  },
  {
    id: 'com.example.calculator',
    name: '计算器',
    version: '1.0.0',
    description: '简洁实用的计算器',
    category: 'tools',
    icon: {
      type: 'font',
      value: 'fas fa-calculator',
      background: '#FF9500',
      color: '#FFFFFF'
    },
    author: '工具开发者',
    downloads: 5678,
    rating: 4.2,
    updatedAt: '2024-01-10T10:00:00Z',
    packageUrl: '',
    packageSize: 1234,
    permissions: [],
    minPhoneVersion: '2.0.0'
  },
  {
    id: 'com.example.weather',
    name: '天气',
    version: '2.0.0',
    description: '查看实时天气和天气预报',
    category: 'lifestyle',
    icon: {
      type: 'font',
      value: 'fas fa-cloud-sun',
      background: 'linear-gradient(135deg, #5AC8FA 0%, #007AFF 100%)',
      color: '#FFFFFF'
    },
    author: '天气团队',
    downloads: 8901,
    rating: 4.6,
    updatedAt: '2024-01-25T10:00:00Z',
    packageUrl: '',
    packageSize: 4567,
    permissions: ['location'],
    minPhoneVersion: '2.0.0'
  },
  {
    id: 'com.example.music',
    name: '音乐播放器',
    version: '1.5.0',
    description: '听你喜欢的音乐',
    category: 'entertainment',
    icon: {
      type: 'font',
      value: 'fas fa-music',
      background: 'linear-gradient(135deg, #FF2D55 0%, #FF375F 100%)',
      color: '#FFFFFF'
    },
    author: '音乐开发者',
    downloads: 3456,
    rating: 4.4,
    updatedAt: '2024-01-18T10:00:00Z',
    packageUrl: '',
    packageSize: 5678,
    permissions: ['storage'],
    minPhoneVersion: '2.0.0'
  },
  {
    id: 'com.example.diary',
    name: '日记本',
    version: '1.0.0',
    description: '记录每一天的心情',
    category: 'lifestyle',
    icon: {
      type: 'font',
      value: 'fas fa-book',
      background: 'linear-gradient(135deg, #AF52DE 0%, #5856D6 100%)',
      color: '#FFFFFF'
    },
    author: '生活应用',
    downloads: 1890,
    rating: 4.7,
    updatedAt: '2024-01-22T10:00:00Z',
    packageUrl: '',
    packageSize: 3456,
    permissions: ['storage', 'ai-generate'],
    minPhoneVersion: '2.0.0'
  }
]

// ===== 默认仓库 =====

const DEFAULT_REGISTRY: AppRegistry = {
  registry: {
    name: '小手机官方应用商店',
    description: '官方维护的应用仓库',
    version: '1.0.0',
    lastUpdated: new Date().toISOString(),
    maintainer: {
      name: 'Phone Sim Team',
      url: 'https://github.com/phone-sim'
    }
  },
  apps: SAMPLE_APPS,
  categories: [
    { id: 'social', name: '社交', icon: 'fas fa-users', count: 0 },
    { id: 'tools', name: '工具', icon: 'fas fa-wrench', count: 1 },
    { id: 'entertainment', name: '娱乐', icon: 'fas fa-film', count: 1 },
    { id: 'productivity', name: '效率', icon: 'fas fa-chart-line', count: 2 },
    { id: 'lifestyle', name: '生活', icon: 'fas fa-heart', count: 2 },
    { id: 'games', name: '游戏', icon: 'fas fa-gamepad', count: 0 },
    { id: 'other', name: '其他', icon: 'fas fa-ellipsis-h', count: 0 }
  ],
  featured: ['com.example.notes', 'com.example.todo', 'com.example.weather']
}

// ===== Store 定义 =====

export const useAppStoreStore = defineStore('appStore', () => {
  // ===== 状态 =====
  
  /** 应用仓库数据 */
  const registry = ref<AppRegistry>(DEFAULT_REGISTRY)
  
  /** 已安装应用列表（使用扩展类型支持身份识别） */
  const installedApps = ref<InstalledAppExtended[]>([])
  
  /** 当前查看的应用 ID */
  const currentAppId = ref<string | null>(null)
  
  /** 搜索关键词 */
  const searchQuery = ref('')
  
  /** 当前选中的分类 */
  const selectedCategory = ref<AppCategory | 'all'>('all')
  
  /** 加载状态 */
  const isLoading = ref(false)
  
  /** 错误信息 */
  const error = ref<string | null>(null)
  
  /** 权限请求对话框状态 */
  const permissionDialog = ref<{
    visible: boolean
    appId: string | null
    permissions: AppPermission[]
    resolve: ((granted: boolean) => void) | null
  }>({
    visible: false,
    appId: null,
    permissions: [],
    resolve: null
  })
  
  // ===== 计算属性 =====
  
  /** 所有可用应用 */
  const availableApps = computed(() => registry.value.apps)
  
  /** 精选应用 */
  const featuredApps = computed(() => {
    const featuredIds = registry.value.featured || []
    return registry.value.apps.filter(app => featuredIds.includes(app.id))
  })
  
  /** 分类列表（带统计） */
  const categories = computed(() => {
    const counts: Record<string, number> = {}
    registry.value.apps.forEach(app => {
      counts[app.category] = (counts[app.category] || 0) + 1
    })
    
    return registry.value.categories.map(cat => ({
      ...cat,
      count: counts[cat.id] || 0
    }))
  })
  
  /** 过滤后的应用列表 */
  const filteredApps = computed(() => {
    let apps = registry.value.apps
    
    // 按分类过滤
    if (selectedCategory.value !== 'all') {
      apps = apps.filter(app => app.category === selectedCategory.value)
    }
    
    // 按搜索词过滤
    if (searchQuery.value.trim()) {
      const query = searchQuery.value.toLowerCase()
      apps = apps.filter(app =>
        app.name.toLowerCase().includes(query) ||
        app.description.toLowerCase().includes(query) ||
        (app.author && app.author.toLowerCase().includes(query))
      )
    }
    
    return apps
  })
  
  /** 当前查看的应用详情 */
  const currentApp = computed(() => {
    if (!currentAppId.value) return null
    return registry.value.apps.find(app => app.id === currentAppId.value) || null
  })
  
  /** 已安装应用 ID 集合 */
  const installedAppIds = computed(() => 
    new Set(installedApps.value.map(app => app.id))
  )
  
  /** 检查应用是否已安装 */
  const isInstalled = computed(() => (appId: string) => 
    installedAppIds.value.has(appId)
  )
  
  /** 获取已安装应用 */
  const getInstalledApp = computed(() => (appId: string) => 
    installedApps.value.find(app => app.id === appId)
  )
  
  /** 有可用更新的应用 */
  const appsWithUpdates = computed(() => {
    return installedApps.value.filter(installed => {
      const registryApp = registry.value.apps.find(app => app.id === installed.id)
      if (!registryApp) return false
      return compareVersions(registryApp.version, installed.version) > 0
    })
  })
  
  // ===== 方法 =====
  
  /**
   * 设置搜索关键词
   */
  function setSearchQuery(query: string) {
    searchQuery.value = query
  }
  
  /**
   * 设置选中分类
   */
  function setSelectedCategory(category: AppCategory | 'all') {
    selectedCategory.value = category
  }
  
  /**
   * 设置当前查看的应用
   */
  function setCurrentApp(appId: string | null) {
    currentAppId.value = appId
  }
  
  /**
   * 请求权限
   */
  function requestPermissions(appId: string, permissions: AppPermission[]): Promise<boolean> {
    return new Promise((resolve) => {
      if (permissions.length === 0) {
        resolve(true)
        return
      }
      
      permissionDialog.value = {
        visible: true,
        appId,
        permissions,
        resolve
      }
    })
  }
  
  /**
   * 响应权限请求
   */
  function respondToPermissionRequest(granted: boolean) {
    if (permissionDialog.value.resolve) {
      permissionDialog.value.resolve(granted)
    }
    permissionDialog.value = {
      visible: false,
      appId: null,
      permissions: [],
      resolve: null
    }
  }
  
  /**
   * 安装应用（集成身份验证）
   */
  async function installApp(appId: string, source: AppSource = 'official'): Promise<boolean> {
    const registryApp = registry.value.apps.find(app => app.id === appId)
    if (!registryApp) {
      error.value = '应用不存在'
      return false
    }
    
    if (isInstalled.value(appId)) {
      error.value = '应用已安装'
      return false
    }
    
    // 请求权限
    const permissions = registryApp.permissions || []
    const granted = await requestPermissions(appId, permissions)
    if (!granted) {
      return false
    }
    
    isLoading.value = true
    error.value = null
    
    try {
      // 模拟下载和安装过程
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // 创建应用包（简化版，实际需要从 URL 下载）
      const appPackage: PhoneAppPackage = {
        packageVersion: '1.0',
        id: registryApp.id,
        name: registryApp.name,
        version: registryApp.version,
        description: registryApp.description,
        icon: registryApp.icon,
        appType: 'configurable',
        category: registryApp.category,
        permissions: registryApp.permissions,
        dataVersion: 1,
        configurable: {
          layout: 'list',
          listConfig: {
            titleField: 'title',
            subtitleField: 'subtitle',
            emptyText: '暂无内容'
          }
        }
      }
      
      // 构建来源信息
      const sourceInfo: AppSourceInfo = source === 'official' || source === 'community'
        ? {
            type: 'repository',
            repositoryId: source === 'official' ? 'official' : 'community',
            signature: 'mock-signature', // 实际需要从仓库获取
            signedAt: Date.now(),
          }
        : { type: 'builtin' }
      
      // 验证安装
      const verifyResult = await verifyAndInstall(appPackage, sourceInfo)
      if (!verifyResult.canInstall) {
        error.value = verifyResult.error || '验证失败'
        return false
      }
      
      // 生成安装ID和计算命名空间
      const installationId = generateInstallationId()
      const dataNamespace = calculateDataNamespace(appPackage, sourceInfo, installationId)
      
      const installedApp: InstalledAppExtended = {
        id: appId,
        version: registryApp.version,
        installedAt: new Date().toISOString(),
        source,
        status: 'installed',
        package: appPackage,
        grantedPermissions: permissions,
        // 扩展字段
        sourceInfo,
        installationId,
        dataNamespace,
        currentDataVersion: appPackage.dataVersion ?? 1,
        verificationStatus: createVerificationStatus(verifyResult),
      }
      
      installedApps.value.push(installedApp)
      
      // 持久化到本地存储
      saveInstalledApps()
      
      return true
    } catch (e) {
      error.value = e instanceof Error ? e.message : '安装失败'
      return false
    } finally {
      isLoading.value = false
    }
  }
  
  /**
   * 卸载应用
   */
  async function uninstallApp(appId: string): Promise<boolean> {
    const index = installedApps.value.findIndex(app => app.id === appId)
    if (index === -1) {
      error.value = '应用未安装'
      return false
    }
    
    isLoading.value = true
    error.value = null
    
    try {
      // 模拟卸载过程
      await new Promise(resolve => setTimeout(resolve, 300))
      
      installedApps.value.splice(index, 1)
      
      // 持久化到本地存储
      saveInstalledApps()
      
      return true
    } catch (e) {
      error.value = e instanceof Error ? e.message : '卸载失败'
      return false
    } finally {
      isLoading.value = false
    }
  }
  
  /**
   * 更新应用（带来源验证和数据迁移）
   */
  async function updateApp(appId: string): Promise<boolean> {
    const installed = installedApps.value.find(app => app.id === appId)
    if (!installed) {
      error.value = '应用未安装'
      return false
    }
    
    const registryApp = registry.value.apps.find(app => app.id === appId)
    if (!registryApp) {
      error.value = '应用不在仓库中'
      return false
    }
    
    isLoading.value = true
    installed.status = 'updating'
    error.value = null
    
    try {
      // 模拟下载新版本
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // 创建新版本应用包
      const newPackage: PhoneAppPackage = {
        ...installed.package,
        version: registryApp.version,
      }
      
      // 构建新的来源信息
      const newSourceInfo: AppSourceInfo = installed.sourceInfo.type === 'repository'
        ? {
            type: 'repository',
            repositoryId: installed.sourceInfo.repositoryId,
            signature: 'mock-signature-updated',
            signedAt: Date.now(),
          }
        : installed.sourceInfo
      
      // 验证更新（检查来源一致性）
      const updateResult = await verifyUpdate(installed, newPackage, newSourceInfo)
      if (!updateResult.allowed) {
        error.value = updateResult.reason || '更新验证失败'
        installed.status = 'installed'
        return false
      }
      
      // 检查并执行数据迁移
      if (updateResult.dataMigration?.needed) {
        const migrationResult = await executeDataMigration(
          installed.dataNamespace,
          updateResult.dataMigration.migrations
        )
        
        // 记录迁移历史
        const migrationRecord = createMigrationRecord(
          updateResult.dataMigration.fromVersion,
          updateResult.dataMigration.toVersion,
          migrationResult
        )
        
        if (!installed.migrationHistory) {
          installed.migrationHistory = []
        }
        installed.migrationHistory.push(migrationRecord)
        
        if (!migrationResult.success) {
          console.error('[AppStore] 数据迁移失败:', migrationResult.error)
          // 迁移失败不阻止更新，但记录错误
        }
        
        // 更新数据版本
        installed.currentDataVersion = updateResult.dataMigration.toVersion
      }
      
      // 更新版本
      installed.version = registryApp.version
      installed.updatedAt = new Date().toISOString()
      installed.status = 'installed'
      installed.package = newPackage
      installed.sourceInfo = newSourceInfo
      
      // 持久化
      saveInstalledApps()
      
      return true
    } catch (e) {
      installed.status = 'error'
      error.value = e instanceof Error ? e.message : '更新失败'
      return false
    } finally {
      isLoading.value = false
    }
  }
  
  /**
   * 从本地文件导入应用（带身份验证警告）
   */
  async function importFromFile(packageJson: string, fileName: string = 'unknown.json'): Promise<boolean> {
    try {
      const appPackage = JSON.parse(packageJson) as PhoneAppPackage
      
      // 验证必填字段
      if (!appPackage.id || !appPackage.name || !appPackage.version || !appPackage.appType) {
        error.value = '应用包格式无效'
        return false
      }
      
      // 本地导入的来源信息
      const sourceInfo: AppSourceInfo = {
        type: 'local',
        fileName,
        importedAt: Date.now(),
      }
      
      // 验证（本地导入会返回警告但允许安装）
      const verifyResult = await verifyAndInstall(appPackage, sourceInfo)
      
      // 显示警告信息（如果有）
      if (verifyResult.warnings && verifyResult.warnings.length > 0) {
        console.warn('[AppStore] 本地导入警告:', verifyResult.warnings)
        // TODO: 显示警告对话框让用户确认
      }
      
      // 请求权限
      const permissions = appPackage.permissions || []
      const granted = await requestPermissions(appPackage.id, permissions)
      if (!granted) {
        return false
      }
      
      // 生成安装ID和计算命名空间
      const installationId = generateInstallationId()
      const dataNamespace = calculateDataNamespace(appPackage, sourceInfo, installationId)
      
      const installedApp: InstalledAppExtended = {
        id: appPackage.id,
        version: appPackage.version,
        installedAt: new Date().toISOString(),
        source: 'local',
        status: 'installed',
        package: appPackage,
        grantedPermissions: permissions,
        // 扩展字段
        sourceInfo,
        installationId,
        dataNamespace,
        currentDataVersion: appPackage.dataVersion ?? 1,
        verificationStatus: createVerificationStatus(verifyResult),
      }
      
      installedApps.value.push(installedApp)
      saveInstalledApps()
      
      return true
    } catch (e) {
      error.value = e instanceof Error ? e.message : '导入失败'
      return false
    }
  }
  
  /**
   * 从 URL 导入应用（带 TOFU 验证）
   */
  async function importFromUrl(url: string): Promise<boolean> {
    isLoading.value = true
    error.value = null
    
    try {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error('下载失败')
      }
      
      const packageJson = await response.text()
      const appPackage = JSON.parse(packageJson) as PhoneAppPackage
      
      // 验证必填字段
      if (!appPackage.id || !appPackage.name || !appPackage.version || !appPackage.appType) {
        error.value = '应用包格式无效'
        return false
      }
      
      // 计算内容哈希（用于 TOFU）
      const contentHash = await calculateContentHash(packageJson)
      
      // URL 导入的来源信息
      const sourceInfo: AppSourceInfo = {
        type: 'url',
        url,
        contentHash,
        fetchedAt: Date.now(),
      }
      
      // 验证（URL 导入使用 TOFU）
      const verifyResult = await verifyAndInstall(appPackage, sourceInfo)
      
      // 显示警告信息
      if (verifyResult.warnings && verifyResult.warnings.length > 0) {
        console.warn('[AppStore] URL 导入警告:', verifyResult.warnings)
        // TODO: 显示警告对话框让用户确认
      }
      
      // 请求权限
      const permissions = appPackage.permissions || []
      const granted = await requestPermissions(appPackage.id, permissions)
      if (!granted) {
        return false
      }
      
      // 生成安装ID和计算命名空间
      const installationId = generateInstallationId()
      const dataNamespace = calculateDataNamespace(appPackage, sourceInfo, installationId)
      
      const installedApp: InstalledAppExtended = {
        id: appPackage.id,
        version: appPackage.version,
        installedAt: new Date().toISOString(),
        source: 'url',
        sourceUrl: url,
        status: 'installed',
        package: appPackage,
        grantedPermissions: permissions,
        // 扩展字段
        sourceInfo,
        installationId,
        dataNamespace,
        currentDataVersion: appPackage.dataVersion ?? 1,
        verificationStatus: createVerificationStatus(verifyResult),
      }
      
      installedApps.value.push(installedApp)
      saveInstalledApps()
      
      return true
    } catch (e) {
      error.value = e instanceof Error ? e.message : '导入失败'
      return false
    } finally {
      isLoading.value = false
    }
  }
  
  /**
   * 刷新仓库数据
   */
  async function refreshRegistry(): Promise<void> {
    isLoading.value = true
    error.value = null
    
    try {
      // TODO: 从远程获取仓库数据
      // 目前使用默认数据
      await new Promise(resolve => setTimeout(resolve, 500))
      registry.value = DEFAULT_REGISTRY
    } catch (e) {
      error.value = e instanceof Error ? e.message : '刷新失败'
    } finally {
      isLoading.value = false
    }
  }
  
  /**
   * 保存已安装应用到本地存储
   */
  function saveInstalledApps() {
    try {
      localStorage.setItem('phone-sim-installed-apps', JSON.stringify(installedApps.value))
    } catch (e) {
      console.error('[AppStore] 保存已安装应用失败:', e)
    }
  }
  
  /**
   * 从本地存储加载已安装应用
   */
  function loadInstalledApps() {
    try {
      const saved = localStorage.getItem('phone-sim-installed-apps')
      if (saved) {
        installedApps.value = JSON.parse(saved)
      }
    } catch (e) {
      console.error('[AppStore] 加载已安装应用失败:', e)
    }
  }
  
  /**
   * 初始化 Store
   */
  function initialize() {
    loadInstalledApps()
  }
  
  // 初始化
  initialize()
  
  return {
    // 状态
    registry,
    installedApps,
    currentAppId,
    searchQuery,
    selectedCategory,
    isLoading,
    error,
    permissionDialog,
    
    // 计算属性
    availableApps,
    featuredApps,
    categories,
    filteredApps,
    currentApp,
    installedAppIds,
    isInstalled,
    getInstalledApp,
    appsWithUpdates,
    
    // 方法
    setSearchQuery,
    setSelectedCategory,
    setCurrentApp,
    requestPermissions,
    respondToPermissionRequest,
    installApp,
    uninstallApp,
    updateApp,
    importFromFile,
    importFromUrl,
    refreshRegistry,
    saveInstalledApps,
    loadInstalledApps,
    initialize
  }
})

// ===== 工具函数 =====

/**
 * 比较语义化版本号
 * @returns 正数表示 v1 > v2，负数表示 v1 < v2，0 表示相等
 */
function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number)
  const parts2 = v2.split('.').map(Number)
  
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0
    const p2 = parts2[i] || 0
    if (p1 !== p2) {
      return p1 - p2
    }
  }
  
  return 0
}