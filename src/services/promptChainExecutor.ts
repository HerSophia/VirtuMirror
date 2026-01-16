/**
 * 提示词链执行引擎
 * @description 负责执行提示词链，支持多步模式和单次模式
 */

import type {
  PromptChain,
  ChainStep,
  ChainExecutionContext,
  ChainExecutionResult,
  StepExecutionResult,
  StepExecutionStatus,
  ChainExecutionStatus,
  ChainExecutionEvent,
  ChainExecutionCallback,
  ChainExecutionHistory
} from '@/types/promptChain';
import { PromptService } from './promptService';
import { SystemPromptService } from './systemPromptService';
import { AIGenerateService } from './aiGenerateService';
import { promptChainService } from './promptChainService';

/**
 * 执行器配置
 */
export interface ExecutorConfig {
  /** 默认超时（毫秒） */
  defaultTimeout?: number;
  /** 最大步骤数（防止无限循环） */
  maxSteps?: number;
  /** 是否保存执行历史 */
  saveHistory?: boolean;
  /** 调试模式（输出详细日志） */
  debug?: boolean;
  /** 来源 App ID（用于加载 App 级系统提示词） */
  appId?: string;
  /** 是否禁用系统提示词注入 */
  disableSystemPrompt?: boolean;
}

const DEFAULT_CONFIG: ExecutorConfig = {
  defaultTimeout: 60000,
  maxSteps: 100,
  saveHistory: true,
  debug: false,
  appId: undefined,
  disableSystemPrompt: false,
};

/**
 * 提示词链执行器
 */
export class PromptChainExecutor {
  private config: ExecutorConfig;
  private abortControllers: Map<string, AbortController> = new Map();
  
  constructor(config: ExecutorConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  /**
   * 执行链
   */
  async execute(
    chain: PromptChain,
    inputs: Record<string, unknown>,
    callback?: ChainExecutionCallback
  ): Promise<ChainExecutionResult> {
    const executionId = `exec.${crypto.randomUUID()}`;
    const abortController = new AbortController();
    this.abortControllers.set(executionId, abortController);
    
    // 初始化上下文
    const context: ChainExecutionContext = {
      chainId: chain.id,
      executionId,
      inputs,
      variables: { ...inputs },
      currentStepIndex: 0,
      startTime: Date.now(),
      aborted: false,
    };
    
    // 发送开始事件
    this.emit(callback, {
      type: 'start',
      executionId,
      chainId: chain.id,
      timestamp: Date.now(),
    });
    
    try {
      let result: ChainExecutionResult;
      
      if (chain.executionMode === 'single-shot') {
        result = await this.executeSingleShot(chain, context, callback, abortController.signal);
      } else {
        result = await this.executeMultiStep(chain, context, callback, abortController.signal);
      }
      
      // 保存执行历史
      if (this.config.saveHistory) {
        await this.saveHistory(chain, result);
      }
      
      // 发送完成事件
      this.emit(callback, {
        type: 'complete',
        executionId,
        chainId: chain.id,
        data: result,
        timestamp: Date.now(),
      });
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      
      this.emit(callback, {
        type: 'error',
        executionId,
        chainId: chain.id,
        error: errorMessage,
        timestamp: Date.now(),
      });
      
      return {
        executionId,
        chainId: chain.id,
        status: 'failed',
        outputs: {},
        stepResults: [],
        error: errorMessage,
        totalUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        totalDuration: Date.now() - context.startTime,
        executionMode: chain.executionMode,
      };
    } finally {
      this.abortControllers.delete(executionId);
    }
  }
  
  /**
   * 中止执行
   */
  abort(executionId: string): boolean {
    const controller = this.abortControllers.get(executionId);
    if (controller) {
      controller.abort();
      return true;
    }
    return false;
  }
  
  /**
   * 中止所有执行
   */
  abortAll(): void {
    this.abortControllers.forEach(controller => controller.abort());
    this.abortControllers.clear();
  }
  
  // ==================== 多步模式执行 ====================
  
  private async executeMultiStep(
    chain: PromptChain,
    context: ChainExecutionContext,
    callback?: ChainExecutionCallback,
    signal?: AbortSignal
  ): Promise<ChainExecutionResult> {
    const stepResults: StepExecutionResult[] = [];
    let totalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    let status: ChainExecutionStatus = 'running';
    
    for (let i = 0; i < chain.steps.length; i++) {
      // 检查是否中止
      if (signal?.aborted) {
        context.aborted = true;
        status = 'aborted';
        break;
      }
      
      // 防止无限循环
      const maxSteps = this.config.maxSteps ?? 100;
      if (i >= maxSteps) {
        throw new Error(`超过最大步骤数限制: ${maxSteps}`);
      }
      
      const step = chain.steps[i];
      context.currentStepIndex = i;
      
      // 发送步骤开始事件
      this.emit(callback, {
        type: 'step-start',
        executionId: context.executionId,
        chainId: chain.id,
        stepId: step.id,
        stepIndex: i,
        timestamp: Date.now(),
      });
      
      try {
        // 检查条件
        if (step.condition && !this.evaluateCondition(step.condition, context)) {
          const skipResult: StepExecutionResult = {
            stepId: step.id,
            status: 'skipped',
          };
          stepResults.push(skipResult);
          
          this.emit(callback, {
            type: 'step-complete',
            executionId: context.executionId,
            chainId: chain.id,
            stepId: step.id,
            stepIndex: i,
            data: skipResult,
            timestamp: Date.now(),
          });
          
          continue;
        }
        
        // 执行步骤
        let stepResult: StepExecutionResult;
        
        if (step.loop) {
          stepResult = await this.executeLoopStep(step, context, chain, signal);
        } else {
          stepResult = await this.executeStep(step, context, chain, signal);
        }
        
        stepResults.push(stepResult);
        
        // 累加 token 用量
        if (stepResult.usage) {
          totalUsage.promptTokens += stepResult.usage.promptTokens;
          totalUsage.completionTokens += stepResult.usage.completionTokens;
          totalUsage.totalTokens += stepResult.usage.totalTokens;
        }
        
        // 将输出存入上下文
        if (stepResult.status === 'completed' && step.outputKey) {
          context.variables[step.outputKey] = stepResult.output;
        }
        
        // 发送步骤完成事件
        this.emit(callback, {
          type: 'step-complete',
          executionId: context.executionId,
          chainId: chain.id,
          stepId: step.id,
          stepIndex: i,
          data: stepResult,
          timestamp: Date.now(),
        });
        
        // 如果步骤失败且不是跳过策略，终止执行
        if (stepResult.status === 'failed' && step.onError !== 'skip') {
          status = 'failed';
          break;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '步骤执行失败';
        
        const failedResult: StepExecutionResult = {
          stepId: step.id,
          status: 'failed',
          error: errorMessage,
        };
        stepResults.push(failedResult);
        
        this.emit(callback, {
          type: 'step-error',
          executionId: context.executionId,
          chainId: chain.id,
          stepId: step.id,
          stepIndex: i,
          error: errorMessage,
          timestamp: Date.now(),
        });
        
        if (step.onError !== 'skip') {
          status = 'failed';
          break;
        }
      }
    }
    
    // 确定最终状态
    if (status === 'running') {
      status = 'completed';
    }
    
    // 计算输出
    const outputs = this.computeOutputs(chain.outputs, context);
    
    return {
      executionId: context.executionId,
      chainId: chain.id,
      status,
      outputs,
      stepResults,
      totalUsage,
      totalDuration: Date.now() - context.startTime,
      executionMode: 'multi-step',
    };
  }
  
  /**
   * 执行单个步骤
   */
  private async executeStep(
    step: ChainStep,
    context: ChainExecutionContext,
    chain: PromptChain,
    signal?: AbortSignal
  ): Promise<StepExecutionResult> {
    const startTime = Date.now();
    
    if (step.type === 'prompt') {
      return this.executePromptStep(step, context, chain, signal);
    } else if (step.type === 'transform') {
      return this.executeTransformStep(step, context);
    } else {
      throw new Error(`不支持的步骤类型: ${step.type}`);
    }
  }
  
  /**
   * 执行 Prompt 步骤
   */
  private async executePromptStep(
    step: ChainStep,
    context: ChainExecutionContext,
    chain: PromptChain,
    signal?: AbortSignal
  ): Promise<StepExecutionResult> {
    const startTime = Date.now();
    
    // 解析输入变量
    const variables: Record<string, unknown> = {};
    for (const [key, expression] of Object.entries(step.inputMapping)) {
      variables[key] = this.evaluateExpression(expression, context);
    }
    
    // 获取提示词模板
    let userPrompt: string;
    let systemPrompt: string | undefined = step.systemPrompt;
    
    if (step.inlineTemplate) {
      // 使用内联模板
      userPrompt = this.renderTemplate(step.inlineTemplate, variables);
    } else if (step.promptId) {
      // 使用提示词服务
      const template = PromptService.getPromptByScene(step.promptId) 
        || PromptService.getPromptById(step.promptId);
      
      if (!template) {
        throw new Error(`未找到提示词: ${step.promptId}`);
      }
      
      const rendered = PromptService.renderPrompt(template, variables);
      userPrompt = rendered.userPrompt;
      systemPrompt = systemPrompt || rendered.systemPrompt;
    } else {
      throw new Error('步骤必须指定 promptId 或 inlineTemplate');
    }
    
    // 组装系统提示词（包含全局和 App 级系统提示词）
    let finalSystemPrompt = systemPrompt;
    
    if (!this.config.disableSystemPrompt) {
      const assembled = SystemPromptService.assemble({
        appId: this.config.appId || chain.appId,
        scene: step.promptId,
        baseSystemPrompt: systemPrompt,
      });
      finalSystemPrompt = assembled.systemPrompt || undefined;
    }
    
    // 调用 AI 生成
    const result = await AIGenerateService.generate(
      { userPrompt, systemPrompt: finalSystemPrompt },
      {
        maxTokens: step.provider?.overrides?.maxTokens,
        temperature: step.provider?.overrides?.temperature,
        disableSystemPrompt: true, // 已经在这里组装过了，避免重复
        // TODO: 支持 step.provider.presetId 切换 Provider
      }
    );
    
    if (!result.success) {
      return {
        stepId: step.id,
        status: 'failed',
        error: result.error,
        rawResponse: result.text,
        duration: Date.now() - startTime,
      };
    }
    
    // 后处理
    let output: unknown = result.text;
    
    if (step.postProcess) {
      output = this.postProcess(result.text, step.postProcess);
    }
    
    return {
      stepId: step.id,
      status: 'completed',
      output,
      rawResponse: result.text,
      usage: result.usage,
      duration: Date.now() - startTime,
    };
  }
  
  /**
   * 执行 Transform 步骤
   */
  private executeTransformStep(
    step: ChainStep,
    context: ChainExecutionContext
  ): StepExecutionResult {
    const startTime = Date.now();
    
    try {
      // Transform 步骤使用 inputMapping 中的表达式计算输出
      const result: Record<string, unknown> = {};
      
      for (const [key, expression] of Object.entries(step.inputMapping)) {
        result[key] = this.evaluateExpression(expression, context);
      }
      
      return {
        stepId: step.id,
        status: 'completed',
        output: Object.keys(result).length === 1 ? Object.values(result)[0] : result,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        stepId: step.id,
        status: 'failed',
        error: error instanceof Error ? error.message : '转换失败',
        duration: Date.now() - startTime,
      };
    }
  }
  
  /**
   * 执行循环步骤
   */
  private async executeLoopStep(
    step: ChainStep,
    context: ChainExecutionContext,
    chain: PromptChain,
    signal?: AbortSignal
  ): Promise<StepExecutionResult> {
    const startTime = Date.now();
    const loop = step.loop!;
    const iterations: StepExecutionResult[] = [];
    const outputs: unknown[] = [];
    let totalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    
    const maxIterations = loop.maxIterations || 50;
    let items: unknown[] = [];
    
    if (loop.type === 'over' && loop.over) {
      const value = this.evaluateExpression(loop.over, context);
      if (Array.isArray(value)) {
        items = value;
      } else {
        throw new Error(`循环目标不是数组: ${loop.over}`);
      }
    } else if (loop.type === 'times' && loop.times) {
      items = Array.from({ length: Math.min(loop.times, maxIterations) }, (_, i) => i);
    }
    
    // 限制迭代次数
    items = items.slice(0, maxIterations);
    
    for (let i = 0; i < items.length; i++) {
      if (signal?.aborted) break;
      
      // 创建迭代上下文
      const iterContext: ChainExecutionContext = {
        ...context,
        variables: {
          ...context.variables,
          [loop.as || 'item']: items[i],
          [loop.indexAs || 'index']: i,
        },
      };
      
      // 执行步骤（不带循环配置）
      const iterStep = { ...step, loop: undefined };
      const iterResult = await this.executeStep(iterStep, iterContext, chain, signal);
      
      iterations.push(iterResult);
      
      if (iterResult.status === 'completed') {
        outputs.push(iterResult.output);
      }
      
      if (iterResult.usage) {
        totalUsage.promptTokens += iterResult.usage.promptTokens;
        totalUsage.completionTokens += iterResult.usage.completionTokens;
        totalUsage.totalTokens += iterResult.usage.totalTokens;
      }
      
      // 如果迭代失败且不是跳过策略，终止循环
      if (iterResult.status === 'failed' && step.onError !== 'skip') {
        break;
      }
    }
    
    const allCompleted = iterations.every(r => r.status === 'completed' || r.status === 'skipped');
    
    return {
      stepId: step.id,
      status: allCompleted ? 'completed' : 'failed',
      output: outputs,
      usage: totalUsage,
      duration: Date.now() - startTime,
      iterations,
    };
  }
  
  // ==================== 单次模式执行 ====================
  
  private async executeSingleShot(
    chain: PromptChain,
    context: ChainExecutionContext,
    callback?: ChainExecutionCallback,
    signal?: AbortSignal
  ): Promise<ChainExecutionResult> {
    const startTime = Date.now();
    
    // 组装复合提示词
    const compositePrompt = this.composePrompt(chain, context);
    
    if (this.config.debug) {
      console.log('[PromptChainExecutor] 组装后的提示词:', compositePrompt);
    }
    
    // 单次调用 LLM
    const result = await AIGenerateService.generate(
      { userPrompt: compositePrompt },
      {
        maxTokens: chain.singleShotConfig?.maxTokens || 4096,
      }
    );
    
    if (!result.success) {
      return {
        executionId: context.executionId,
        chainId: chain.id,
        status: 'failed',
        outputs: {},
        stepResults: [],
        error: result.error,
        totalUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        totalDuration: Date.now() - startTime,
        executionMode: 'single-shot',
      };
    }
    
    // 解析响应
    let parsedOutputs: Record<string, unknown> = {};
    
    try {
      const jsonResponse = this.parseJSON(result.text);
      
      if (chain.singleShotConfig?.responseMapping) {
        for (const [key, path] of Object.entries(chain.singleShotConfig.responseMapping)) {
          parsedOutputs[key] = this.getValueByPath(jsonResponse, path);
        }
      } else if (jsonResponse && typeof jsonResponse === 'object' && !Array.isArray(jsonResponse)) {
        parsedOutputs = jsonResponse as Record<string, unknown>;
      } else {
        parsedOutputs = { result: jsonResponse };
      }
    } catch (error) {
      return {
        executionId: context.executionId,
        chainId: chain.id,
        status: 'failed',
        outputs: {},
        stepResults: [{
          stepId: 'composite',
          status: 'failed',
          rawResponse: result.text,
          error: '响应解析失败',
        }],
        error: '响应 JSON 解析失败',
        totalUsage: result.usage || { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        totalDuration: Date.now() - startTime,
        executionMode: 'single-shot',
      };
    }
    
    return {
      executionId: context.executionId,
      chainId: chain.id,
      status: 'completed',
      outputs: parsedOutputs,
      stepResults: [{
        stepId: 'composite',
        status: 'completed',
        output: parsedOutputs,
        rawResponse: result.text,
        usage: result.usage,
        duration: Date.now() - startTime,
      }],
      totalUsage: result.usage || { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      totalDuration: Date.now() - startTime,
      executionMode: 'single-shot',
    };
  }
  
  /**
   * 组装单次模式的复合提示词
   */
  private composePrompt(chain: PromptChain, context: ChainExecutionContext): string {
    // 使用自定义模板
    if (chain.singleShotConfig?.compositeTemplate) {
      return this.renderTemplate(chain.singleShotConfig.compositeTemplate, context.variables);
    }
    
    // 自动组装
    const sections: string[] = [];
    
    sections.push('你需要完成以下多个任务，并将所有结果以 JSON 格式一次性返回。\n');
    
    chain.steps.forEach((step, index) => {
      if (step.type !== 'prompt') return;
      
      // 解析变量
      const variables: Record<string, unknown> = {};
      for (const [key, expression] of Object.entries(step.inputMapping)) {
        variables[key] = this.evaluateExpression(expression, context);
      }
      
      let taskContent = '';
      
      if (step.inlineTemplate) {
        taskContent = this.renderTemplate(step.inlineTemplate, variables);
      } else if (step.promptId) {
        const template = PromptService.getPromptByScene(step.promptId)
          || PromptService.getPromptById(step.promptId);
        
        if (template) {
          const rendered = PromptService.renderPrompt(template, variables);
          taskContent = rendered.userPrompt;
        }
      }
      
      if (taskContent) {
        sections.push(`## 任务 ${index + 1}: ${step.name}`);
        sections.push(taskContent);
        sections.push('');
      }
    });
    
    // 生成输出 Schema
    const outputSchema = this.generateOutputSchema(chain);
    sections.push('---');
    sections.push('请严格按照以下 JSON 格式返回（不要包含其他内容）：');
    sections.push('```json');
    sections.push(outputSchema);
    sections.push('```');
    
    return sections.join('\n');
  }
  
  /**
   * 生成输出 Schema
   */
  private generateOutputSchema(chain: PromptChain): string {
    const schema: Record<string, string> = {};
    
    chain.steps.forEach(step => {
      if (step.type === 'prompt' && step.outputKey) {
        schema[step.outputKey] = `<${step.name}的结果>`;
      }
    });
    
    return JSON.stringify(schema, null, 2);
  }
  
  // ==================== 工具方法 ====================
  
  /**
   * 求值表达式
   * 支持简单的路径表达式，如 "step1.result.title" 或 "inputs.name"
   */
  private evaluateExpression(expression: string, context: ChainExecutionContext): unknown {
    // 去除空白
    expression = expression.trim();
    
    // 字面量
    if (expression.startsWith('"') && expression.endsWith('"')) {
      return expression.slice(1, -1);
    }
    if (expression.startsWith("'") && expression.endsWith("'")) {
      return expression.slice(1, -1);
    }
    if (expression === 'true') return true;
    if (expression === 'false') return false;
    if (expression === 'null') return null;
    if (/^-?\d+(\.\d+)?$/.test(expression)) {
      return parseFloat(expression);
    }
    
    // 路径表达式
    return this.getValueByPath(context.variables, expression);
  }
  
  /**
   * 根据路径获取值
   */
  private getValueByPath(obj: unknown, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;
    
    for (const part of parts) {
      if (current == null) return undefined;
      
      // 支持数组索引 [0]
      const arrayMatch = part.match(/^(.+)\[(\d+)\]$/);
      if (arrayMatch) {
        const [, key, index] = arrayMatch;
        current = (current as Record<string, unknown>)[key];
        if (Array.isArray(current)) {
          current = current[parseInt(index, 10)];
        } else {
          return undefined;
        }
      } else {
        current = (current as Record<string, unknown>)[part];
      }
    }
    
    return current;
  }
  
  /**
   * 求值条件表达式
   */
  private evaluateCondition(condition: string, context: ChainExecutionContext): boolean {
    try {
      // 简单条件求值
      // 支持: "step1.result" (truthy), "!step1.error" (falsy), "step1.count > 0"
      
      // 否定表达式
      if (condition.startsWith('!')) {
        const value = this.evaluateExpression(condition.slice(1), context);
        return !value;
      }
      
      // 比较表达式
      const compareMatch = condition.match(/^(.+?)\s*(===?|!==?|>=?|<=?|>|<)\s*(.+)$/);
      if (compareMatch) {
        const [, left, op, right] = compareMatch;
        const leftValue = this.evaluateExpression(left, context);
        const rightValue = this.evaluateExpression(right, context);
        
        switch (op) {
         case '=': case '==': case '===': return leftValue === rightValue;
          case '!=': case '!==': return leftValue !== rightValue;
          case '>': return (leftValue as number) > (rightValue as number);
          case '>=': return (leftValue as number) >= (rightValue as number);
          case '<': return (leftValue as number) < (rightValue as number);
          case '<=': return (leftValue as number) <= (rightValue as number);
        }
      }
      
      // Truthy 判断
      const value = this.evaluateExpression(condition, context);
      return !!value;
    } catch {
      return false;
    }
  }
  
  /**
   * 渲染模板（简单的变量替换）
   */
  private renderTemplate(template: string, variables: Record<string, unknown>): string {
    return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
      const value = this.getValueByPath(variables, path);
      if (value === undefined) return match;
      if (typeof value === 'object') return JSON.stringify(value);
      return String(value);
    });
  }
  
  /**
   * 后处理响应
   */
  private postProcess(text: string, config: NonNullable<ChainStep['postProcess']>): unknown {
    try {
      switch (config.parseAs) {
        case 'json':
          const json = this.parseJSON(text);
          if (config.extract) {
            return this.getValueByPath(json, config.extract);
          }
          return json;
        
        case 'lines':
          return text.split('\n').filter(line => line.trim());
        
        case 'regex':
          if (config.extract) {
            const regex = new RegExp(config.extract);
            const match = text.match(regex);
            return match ? (match[1] || match[0]) : config.defaultValue;
          }
          return text;
        
        case 'text':
        default:
          return text;
      }
    } catch {
      return config.defaultValue ?? text;
    }
  }
  
  /**
   * 解析 JSON（容错）
   */
  private parseJSON(text: string): unknown {
    // 尝试提取 JSON 块
    const jsonBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonBlockMatch) {
      text = jsonBlockMatch[1];
    }
    
    // 尝试提取 {} 或 []
    const objectMatch = text.match(/\{[\s\S]*\}/);
    const arrayMatch = text.match(/\[[\s\S]*\]/);
    
    const jsonText = objectMatch?.[0] || arrayMatch?.[0] || text;
    
    return JSON.parse(jsonText);
  }
  
  /**
   * 计算最终输出
   */
  private computeOutputs(
    outputMapping: Record<string, string>,
    context: ChainExecutionContext
  ): Record<string, unknown> {
    const outputs: Record<string, unknown> = {};
    
    for (const [key, expression] of Object.entries(outputMapping)) {
      outputs[key] = this.evaluateExpression(expression, context);
    }
    
    return outputs;
  }
  
  /**
   * 发送事件
   */
  private emit(callback: ChainExecutionCallback | undefined, event: ChainExecutionEvent): void {
    if (callback) {
      try {
        callback(event);
      } catch (error) {
        console.error('[PromptChainExecutor] 事件回调错误:', error);
      }
    }
  }
  
  /**
   * 保存执行历史
   */
  private async saveHistory(
    chain: PromptChain,
    result: ChainExecutionResult
  ): Promise<void> {
    try {
      const history: ChainExecutionHistory = {
        executionId: result.executionId,
        chainId: chain.id,
        chainName: chain.name,
        status: result.status,
        inputs: {}, // 可选：保存输入
        outputs: result.outputs,
        totalUsage: result.totalUsage,
        totalDuration: result.totalDuration,
        executedAt: Date.now(),
        error: result.error,
      };
      
      await promptChainService.saveExecutionHistory(history);
    } catch (error) {
      console.error('[PromptChainExecutor] 保存历史失败:', error);
    }
  }
}

// 默认执行器实例
export const promptChainExecutor = new PromptChainExecutor();
export default promptChainExecutor;
