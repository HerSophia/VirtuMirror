/**
 * 系统提示词服务
 * @description 管理全局和 App 级系统提示词，负责组装最终的系统提示词
 *
 * 系统提示词的作用是在所有 LLM 调用中注入全局性的约束和指令。
 *
 * 作用域优先级（从低到高）：
 * 1. 全局系统提示词 (scope: 'global')
 * 2. App 级系统提示词 (scope: 'app', mode: 'append')
 * 3. App 级系统提示词 (scope: 'app', mode: 'override') - 会替换上层
 * 4. 单个 Prompt 自带的 systemPrompt
 */

import type { PromptTemplate, SystemPromptMode, SystemPromptScope } from '@/types/prompts'
import { PromptService } from './promptService'

/**
 * 系统提示词组装选项
 */
export interface AssembleOptions {
  /** 目标 App ID */
  appId?: string
  /** 目标场景 */
  scene?: string
  /** 基础系统提示词（来自单个 Prompt 的 systemPrompt） */
  baseSystemPrompt?: string
}

/**
 * 系统提示词组装结果
 */
export interface AssembleResult {
  /** 组装后的系统提示词 */
  systemPrompt: string
  /** 应用的系统提示词来源列表 */
  appliedPrompts: Array<{
    id: string
    name: string
    scope: SystemPromptScope
  }>
}

/**
 * 系统提示词定义（用于创建）
 */
export interface SystemPromptDefinition {
  /** 名称 */
  name: string
  /** 描述 */
  description?: string
  /** 系统提示词内容 */
  content: string
  /** 作用域 */
  scope: SystemPromptScope
  /** 关联的 App ID（scope 为 'app' 时必填） */
  appId?: string
  /** 继承模式 */
  mode?: SystemPromptMode
  /** 适用场景 */
  applicableScenes?: string[]
  /** 排除场景 */
  excludeScenes?: string[]
  /** 优先级 */
  priority?: number
}

/**
 * 系统提示词服务
 */
export class SystemPromptService {
  /**
   * 获取所有系统提示词
   */
  static getAllSystemPrompts(): PromptTemplate[] {
    const allPrompts = PromptService.getAllPrompts()
    return allPrompts.filter((p) => p.isSystemPrompt === true)
  }

  /**
   * 获取全局系统提示词
   */
  static getGlobalSystemPrompts(): PromptTemplate[] {
    return this.getAllSystemPrompts()
      .filter((p) => p.systemPromptScope === 'global' && p.enabled)
      .sort((a, b) => a.priority - b.priority)
  }

  /**
   * 获取指定 App 的系统提示词
   */
  static getAppSystemPrompts(appId: string): PromptTemplate[] {
    return this.getAllSystemPrompts()
      .filter((p) => {
        if (p.systemPromptScope !== 'app') return false
        if (!p.enabled) return false
        // 检查来源 App ID
        if (p.source.type === 'app' && p.source.appId === appId) return true
        // 或者通过 scene 前缀匹配
        if (p.scene.startsWith(`system.${appId}.`)) return true
        return false
      })
      .sort((a, b) => a.priority - b.priority)
  }

  /**
   * 组装最终的系统提示词
   *
   * 组装顺序：
   * 1. 收集全局系统提示词（按 priority 排序）
   * 2. 收集 App 级系统提示词（如果有 appId）
   * 3. 根据 mode 决定是追加还是覆盖
   * 4. 追加基础 systemPrompt（如果有）
   * 5. 返回拼接后的完整系统提示词
   */
  static assemble(options: AssembleOptions = {}): AssembleResult {
    const { appId, scene, baseSystemPrompt } = options
    const parts: string[] = []
    const appliedPrompts: AssembleResult['appliedPrompts'] = []

    // 1. 收集全局系统提示词
    const globalPrompts = this.getGlobalSystemPrompts().filter((p) =>
      this.isApplicableToScene(p, scene)
    )

    let useGlobalPrompts = true

    // 2. 收集 App 级系统提示词
    let appPrompts: PromptTemplate[] = []
    if (appId) {
      appPrompts = this.getAppSystemPrompts(appId).filter((p) => this.isApplicableToScene(p, scene))

      // 检查是否有 override 模式的 App 提示词
      const hasOverride = appPrompts.some((p) => p.systemPromptMode === 'override')
      if (hasOverride) {
        useGlobalPrompts = false
      }
    }

    // 3. 拼接全局提示词
    if (useGlobalPrompts) {
      for (const prompt of globalPrompts) {
        // 使用 template 字段作为系统提示词内容
        const content = prompt.template.trim()
        if (content) {
          parts.push(content)
          appliedPrompts.push({
            id: prompt.id,
            name: prompt.name,
            scope: 'global',
          })
        }
      }
    }

    // 4. 拼接 App 级提示词
    for (const prompt of appPrompts) {
      const content = prompt.template.trim()
      if (content) {
        parts.push(content)
        appliedPrompts.push({
          id: prompt.id,
          name: prompt.name,
          scope: 'app',
        })
      }
    }

    // 5. 追加基础 systemPrompt
    if (baseSystemPrompt?.trim()) {
      parts.push(baseSystemPrompt.trim())
    }

    return {
      systemPrompt: parts.join('\n\n'),
      appliedPrompts,
    }
  }

  /**
   * 检查系统提示词是否适用于指定场景
   */
  private static isApplicableToScene(prompt: PromptTemplate, scene?: string): boolean {
    if (!scene) return true

    // 检查排除场景
    if (prompt.excludeScenes?.length) {
      for (const pattern of prompt.excludeScenes) {
        if (this.matchScenePattern(scene, pattern)) {
          return false
        }
      }
    }

    // 检查适用场景（为空表示适用所有）
    if (!prompt.applicableScenes?.length) {
      return true
    }

    for (const pattern of prompt.applicableScenes) {
      if (this.matchScenePattern(scene, pattern)) {
        return true
      }
    }

    return false
  }

  /**
   * 匹配场景模式（支持通配符 *）
   */
  private static matchScenePattern(scene: string, pattern: string): boolean {
    // 精确匹配
    if (scene === pattern) return true

    // 通配符匹配
    if (pattern.endsWith('.*')) {
      const prefix = pattern.slice(0, -1) // 保留点号
      return scene.startsWith(prefix)
    }

    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1)
      return scene.startsWith(prefix)
    }

    return false
  }

  // ========== CRUD 操作 ==========

  /**
   * 创建系统提示词
   */
  static create(definition: SystemPromptDefinition): PromptTemplate {
    const {
      name,
      description,
      content,
      scope,
      appId,
      mode,
      applicableScenes,
      excludeScenes,
      priority,
    } = definition

    // 生成 scene ID
    const scenePrefix = scope === 'global' ? 'system.global' : `system.${appId || 'app'}`
    const sceneId = `${scenePrefix}.${Date.now()}`

    const prompt = PromptService.addPrompt({
      name,
      description,
      category: 'system',
      scene: sceneId,
      template: content,
      availableVariables: [],
      enabled: true,
      priority: priority ?? 0,
      version: '1.0.0',
    })

    // 更新系统提示词专用字段
    PromptService.updatePrompt(prompt.id, {
      isSystemPrompt: true,
      systemPromptScope: scope,
      systemPromptMode: mode ?? 'append',
      applicableScenes,
      excludeScenes,
    })

    return PromptService.getPromptById(prompt.id)!
  }

  /**
   * 更新系统提示词
   */
  static update(
    id: string,
    updates: Partial<{
      name: string
      description: string
      content: string
      mode: SystemPromptMode
      applicableScenes: string[]
      excludeScenes: string[]
      enabled: boolean
      priority: number
    }>
  ): boolean {
    const prompt = PromptService.getPromptById(id)
    if (!prompt || !prompt.isSystemPrompt) return false

    const promptUpdates: Partial<PromptTemplate> = {}

    if (updates.name !== undefined) promptUpdates.name = updates.name
    if (updates.description !== undefined) promptUpdates.description = updates.description
    if (updates.content !== undefined) promptUpdates.template = updates.content
    if (updates.mode !== undefined) promptUpdates.systemPromptMode = updates.mode
    if (updates.applicableScenes !== undefined)
      promptUpdates.applicableScenes = updates.applicableScenes
    if (updates.excludeScenes !== undefined) promptUpdates.excludeScenes = updates.excludeScenes
    if (updates.enabled !== undefined) promptUpdates.enabled = updates.enabled
    if (updates.priority !== undefined) promptUpdates.priority = updates.priority

    return PromptService.updatePrompt(id, promptUpdates)
  }

  /**
   * 删除系统提示词
   */
  static delete(id: string): boolean {
    const prompt = PromptService.getPromptById(id)
    if (!prompt || !prompt.isSystemPrompt) return false
    return PromptService.deletePrompt(id)
  }

  /**
   * 切换启用状态
   */
  static toggle(id: string): boolean {
    const prompt = PromptService.getPromptById(id)
    if (!prompt || !prompt.isSystemPrompt) return false
    return PromptService.togglePrompt(id)
  }

  // ========== 统计与查询 ==========

  /**
   * 获取统计信息
   */
  static getStats(): {
    total: number
    global: number
    app: number
    enabled: number
    byApp: Record<string, number>
  } {
    const all = this.getAllSystemPrompts()
    const globalPrompts = all.filter((p) => p.systemPromptScope === 'global')
    const appPrompts = all.filter((p) => p.systemPromptScope === 'app')
    const enabledPrompts = all.filter((p) => p.enabled)

    // 按 App 分组统计
    const byApp: Record<string, number> = {}
    for (const prompt of appPrompts) {
      if (prompt.source.type === 'app') {
        const appId = prompt.source.appId
        byApp[appId] = (byApp[appId] || 0) + 1
      }
    }

    return {
      total: all.length,
      global: globalPrompts.length,
      app: appPrompts.length,
      enabled: enabledPrompts.length,
      byApp,
    }
  }

  /**
   * 预览组装结果（调试用）
   */
  static preview(options: AssembleOptions): {
    result: AssembleResult
    breakdown: Array<{
      source: string
      content: string
    }>
  } {
    const result = this.assemble(options)

    const breakdown: Array<{ source: string; content: string }> = []

    // 分解每个来源
    const globalPrompts = this.getGlobalSystemPrompts().filter((p) =>
      this.isApplicableToScene(p, options.scene)
    )

    for (const prompt of globalPrompts) {
      if (result.appliedPrompts.some((ap) => ap.id === prompt.id)) {
        breakdown.push({
          source: `[全局] ${prompt.name}`,
          content: prompt.template,
        })
      }
    }

    if (options.appId) {
      const appPrompts = this.getAppSystemPrompts(options.appId).filter((p) =>
        this.isApplicableToScene(p, options.scene)
      )

      for (const prompt of appPrompts) {
        if (result.appliedPrompts.some((ap) => ap.id === prompt.id)) {
          breakdown.push({
            source: `[App: ${options.appId}] ${prompt.name}`,
            content: prompt.template,
          })
        }
      }
    }

    if (options.baseSystemPrompt?.trim()) {
      breakdown.push({
        source: '[Prompt 自带]',
        content: options.baseSystemPrompt,
      })
    }

    return { result, breakdown }
  }
}

export default SystemPromptService
