/**
 * 提示词链服务
 * @description 管理提示词链的 CRUD 操作和持久化
 */

import type {
  ChainExecutionHistory,
  ChainStep,
  PromptChain,
  StoredPromptChain,
} from '@/types/promptChain'
import { db } from '../database'
import { loggerService } from '@/services/logger'

const logger = loggerService.child('service:promptChain')

/**
 * App 注册的链定义（不包含 id/createdAt/updatedAt）
 */
export type AppChainDefinition = Omit<
  PromptChain,
  'id' | 'createdAt' | 'updatedAt' | 'source' | 'appId'
>

/**
 * 提示词链服务
 */
export class PromptChainService {
  private static instance: PromptChainService

  /** App 注册的链（内存缓存） */
  private appChains: Map<string, PromptChain[]> = new Map()

  private constructor() {}

  static getInstance(): PromptChainService {
    if (!this.instance) {
      this.instance = new PromptChainService()
    }
    return this.instance
  }

  // ==================== CRUD 操作 ====================

  // ==================== App 链注册 ====================

  /**
   * 注册 App 的链
   * @param appId 应用 ID
   * @param chains 链定义列表
   */
  registerAppChains(appId: string, chains: AppChainDefinition[]): void {
    const now = new Date().toISOString()
    const registeredChains: PromptChain[] = chains.map((chain, index) => ({
      ...chain,
      id: `chain.${appId}.${chain.name.replace(/\s+/g, '-').toLowerCase()}.${index}`,
      appId,
      source: 'app' as const,
      createdAt: now,
      updatedAt: now,
    }))

    this.appChains.set(appId, registeredChains)
    logger.info(`注册 ${appId} 的 ${chains.length} 个链`)
  }

  /**
   * 注销 App 的链
   */
  unregisterAppChains(appId: string): void {
    this.appChains.delete(appId)
    logger.info(`注销 ${appId} 的链`)
  }

  /**
   * 获取指定 App 的链
   */
  getAppChains(appId: string): PromptChain[] {
    return this.appChains.get(appId) || []
  }

  /**
   * 获取所有 App 链
   */
  getAllAppChains(): PromptChain[] {
    const allChains: PromptChain[] = []
    this.appChains.forEach((chains) => allChains.push(...chains))
    return allChains
  }

  /**
   * 获取已注册链的 App ID 列表
   */
  getRegisteredAppIds(): string[] {
    return Array.from(this.appChains.keys())
  }

  // ==================== CRUD 操作 ====================

  /**
   * 获取所有链（包含 App 链和用户链）
   */
  async getAllChains(): Promise<PromptChain[]> {
    const userChains = await db.promptChains.toArray()
    const appChains = this.getAllAppChains()
    return [...appChains, ...userChains]
  }

  /**
   * 获取用户创建的链（不含 App 链）
   */
  async getUserChains(): Promise<PromptChain[]> {
    return db.promptChains.toArray()
  }

  /**
   * 根据 ID 获取链（包含 App 链）
   */
  async getChainById(id: string): Promise<PromptChain | undefined> {
    // 先查 App 链
    for (const chains of this.appChains.values()) {
      const found = chains.find((c) => c.id === id)
      if (found) return found
    }
    // 再查用户链
    return db.promptChains.get(id)
  }

  /**
   * 获取启用的链
   */
  async getEnabledChains(): Promise<PromptChain[]> {
    return db.promptChains.where('enabled').equals(1).toArray()
  }

  /**
   * 按标签筛选链
   */
  async getChainsByTag(tag: string): Promise<PromptChain[]> {
    return db.promptChains.where('tags').equals(tag).toArray()
  }

  /**
   * 按来源筛选链
   */
  async getChainsBySource(source: 'builtin' | 'user' | 'imported'): Promise<PromptChain[]> {
    return db.promptChains.where('source').equals(source).toArray()
  }

  /**
   * 创建链
   */
  async createChain(
    chain: Omit<PromptChain, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<PromptChain> {
    const now = new Date().toISOString()
    const newChain: PromptChain = {
      ...chain,
      id: `chain.${crypto.randomUUID()}`,
      createdAt: now,
      updatedAt: now,
    }

    await db.promptChains.add(newChain as StoredPromptChain)
    logger.info(`创建链: ${newChain.name} (${newChain.id})`)

    return newChain
  }

  /**
   * 更新链
   */
  async updateChain(id: string, updates: Partial<PromptChain>): Promise<boolean> {
    const existing = await this.getChainById(id)
    if (!existing) return false

    const updatedChain = {
      ...existing,
      ...updates,
      id, // 确保 ID 不变
      updatedAt: new Date().toISOString(),
    }

    await db.promptChains.put(updatedChain as StoredPromptChain)
    logger.info(`更新链: ${id}`)

    return true
  }

  /**
   * 删除链
   */
  async deleteChain(id: string): Promise<boolean> {
    const existing = await this.getChainById(id)
    if (!existing) return false

    // 内置链不可删除
    if (existing.source === 'builtin') {
      logger.warn(`无法删除内置链: ${id}`)
      return false
    }

    await db.promptChains.delete(id)
    logger.info(`删除链: ${id}`)

    return true
  }

  /**
   * 复制链
   */
  async duplicateChain(id: string): Promise<PromptChain | null> {
    const original = await this.getChainById(id)
    if (!original) return null

    const { id: _, createdAt, updatedAt, ...rest } = original

    return this.createChain({
      ...rest,
      name: `${original.name} (副本)`,
      source: 'user',
    })
  }

  /**
   * 切换启用状态
   */
  async toggleChain(id: string): Promise<boolean> {
    const chain = await this.getChainById(id)
    if (!chain) return false

    return this.updateChain(id, { enabled: !chain.enabled })
  }

  // ==================== 步骤管理 ====================

  /**
   * 添加步骤
   */
  async addStep(chainId: string, step: ChainStep, index?: number): Promise<boolean> {
    const chain = await this.getChainById(chainId)
    if (!chain) return false

    const steps = [...chain.steps]
    if (index !== undefined && index >= 0 && index <= steps.length) {
      steps.splice(index, 0, step)
    } else {
      steps.push(step)
    }

    return this.updateChain(chainId, { steps })
  }

  /**
   * 更新步骤
   */
  async updateStep(chainId: string, stepId: string, updates: Partial<ChainStep>): Promise<boolean> {
    const chain = await this.getChainById(chainId)
    if (!chain) return false

    const steps = chain.steps.map((s) => (s.id === stepId ? { ...s, ...updates } : s))

    return this.updateChain(chainId, { steps })
  }

  /**
   * 删除步骤
   */
  async deleteStep(chainId: string, stepId: string): Promise<boolean> {
    const chain = await this.getChainById(chainId)
    if (!chain) return false

    const steps = chain.steps.filter((s) => s.id !== stepId)
    return this.updateChain(chainId, { steps })
  }

  /**
   * 重新排序步骤
   */
  async reorderSteps(chainId: string, stepIds: string[]): Promise<boolean> {
    const chain = await this.getChainById(chainId)
    if (!chain) return false

    const stepMap = new Map(chain.steps.map((s) => [s.id, s]))
    const reordered = stepIds
      .map((id) => stepMap.get(id))
      .filter((s): s is ChainStep => s !== undefined)

    if (reordered.length !== chain.steps.length) {
      logger.warn('步骤排序时发现缺失')
      return false
    }

    return this.updateChain(chainId, { steps: reordered })
  }

  // ==================== 执行历史 ====================

  /**
   * 保存执行历史
   */
  async saveExecutionHistory(history: ChainExecutionHistory): Promise<void> {
    await db.chainExecutionHistory.add(history)
  }

  /**
   * 获取链的执行历史
   */
  async getExecutionHistory(chainId: string, limit = 20): Promise<ChainExecutionHistory[]> {
    return db.chainExecutionHistory
      .where('chainId')
      .equals(chainId)
      .reverse()
      .limit(limit)
      .toArray()
  }

  /**
   * 获取单次执行详情
   */
  async getExecutionById(executionId: string): Promise<ChainExecutionHistory | undefined> {
    return db.chainExecutionHistory.get(executionId)
  }

  /**
   * 清理旧的执行历史
   */
  async cleanupOldHistory(olderThanDays = 30): Promise<number> {
    const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000
    return db.chainExecutionHistory.where('executedAt').below(cutoff).delete()
  }

  // ==================== 导入导出 ====================

  /**
   * 导出链为 JSON
   */
  async exportChain(id: string): Promise<string | null> {
    const chain = await this.getChainById(id)
    if (!chain) return null

    // 移除内部元数据
    const exportData = {
      ...chain,
      source: 'imported',
      createdAt: undefined,
      updatedAt: undefined,
    }

    return JSON.stringify(exportData, null, 2)
  }

  /**
   * 从 JSON 导入链
   */
  async importChain(jsonString: string): Promise<PromptChain | null> {
    try {
      const data = JSON.parse(jsonString)

      // 验证基本结构
      if (!data.name || !data.steps || !Array.isArray(data.steps)) {
        throw new Error('Invalid chain format')
      }

      // 移除可能冲突的字段
      const { id, createdAt, updatedAt, ...rest } = data

      return this.createChain({
        ...rest,
        source: 'imported',
        version: rest.version || '1.0.0',
        enabled: true,
        executionMode: rest.executionMode || 'multi-step',
        inputs: rest.inputs || [],
        outputs: rest.outputs || {},
      })
    } catch (error) {
      logger.error('导入链失败:', error)
      return null
    }
  }

  // ==================== 验证 ====================

  /**
   * 验证链配置
   */
  validateChain(chain: PromptChain): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    // 基本验证
    if (!chain.name?.trim()) {
      errors.push('链名称不能为空')
    }

    if (!chain.steps || chain.steps.length === 0) {
      errors.push('链必须包含至少一个步骤')
    }

    // 步骤验证
    const stepIds = new Set<string>()
    chain.steps.forEach((step, index) => {
      if (!step.id) {
        errors.push(`步骤 ${index + 1}: ID 不能为空`)
      } else if (stepIds.has(step.id)) {
        errors.push(`步骤 ${index + 1}: ID "${step.id}" 重复`)
      } else {
        stepIds.add(step.id)
      }

      if (!step.name?.trim()) {
        errors.push(`步骤 ${index + 1}: 名称不能为空`)
      }

      if (step.type === 'prompt' && !step.promptId && !step.inlineTemplate) {
        errors.push(`步骤 ${index + 1}: Prompt 步骤必须指定 promptId 或 inlineTemplate`)
      }

      if (!step.outputKey?.trim()) {
        errors.push(`步骤 ${index + 1}: outputKey 不能为空`)
      }
    })

    // 单次模式验证
    if (chain.executionMode === 'single-shot') {
      if (!chain.singleShotConfig?.responseMapping) {
        errors.push('单次模式必须配置 responseMapping')
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }

  // ==================== 工厂方法 ====================

  /**
   * 创建空白链
   */
  createEmptyChain(): Omit<PromptChain, 'id' | 'createdAt' | 'updatedAt'> {
    return {
      name: '新建链',
      description: '',
      executionMode: 'multi-step',
      inputs: [],
      steps: [],
      outputs: {},
      source: 'user',
      version: '1.0.0',
      enabled: true,
    }
  }

  /**
   * 创建空白步骤
   */
  createEmptyStep(type: ChainStep['type'] = 'prompt'): ChainStep {
    return {
      id: `step.${crypto.randomUUID().slice(0, 8)}`,
      name: '新步骤',
      type,
      inputMapping: {},
      outputKey: '',
    }
  }
}

export const promptChainService = PromptChainService.getInstance()
export default promptChainService
