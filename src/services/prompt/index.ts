/**
 * 提示词服务模块
 * @description 提供提示词模板管理、系统提示词组装、链管理和执行等功能
 */

// ==================== 核心服务 ====================

/** 提示词模板服务 */
export { PromptService } from './promptService'
export { default as promptService } from './promptService'

/** 系统提示词服务 */
export { SystemPromptService } from './systemPromptService'
export { default as systemPromptService } from './systemPromptService'
export type {
  AssembleOptions,
  AssembleResult,
  SystemPromptDefinition,
} from './systemPromptService'

/** 链管理服务 */
export { PromptChainService, promptChainService } from './promptChainService'
export { default as chainService } from './promptChainService'
export type { AppChainDefinition } from './promptChainService'

// ==================== 链执行器 ====================

export {
  PromptChainExecutor,
  promptChainExecutor,
  // 工具函数
  getValueByPath,
  evaluateExpression,
  evaluateCondition,
  renderTemplate,
  parseJSON,
  postProcess,
  computeOutputs,
  // 步骤执行器
  executePromptStep,
  executeTransformStep,
  executeStep,
  executeLoopStep,
} from './chainExecutor'
export type { ExecutorConfig } from './chainExecutor'

// ==================== 别名导出（便于迁移） ====================

// 保持向后兼容，旧的导入路径仍可使用
export { promptChainExecutor as default } from './chainExecutor'
