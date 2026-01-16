/**
 * ContentDispatcher - 内容分发器（总部）
 * 
 * Phase 5: 总部-分部解析器架构
 * 负责：
 * 1. 解析 JSON
 * 2. 识别顶层 key
 * 3. 拓扑排序（依赖优先）
 * 4. 分发到对应 Parser
 * 5. 收集结果 & 处理 tempId 映射
 * 
 * @see docs/systems/social-content-types.md Section 11
 */

import type {
  ContentParser,
  ParseContext,
  ParseResult,
  ParseError,
  ParseTask,
  ResolvedData,
} from './types';

/**
 * 内容分发器
 */
export class ContentDispatcher {
  private static instance: ContentDispatcher;
  
  /** 注册的解析器 */
  private parsers: Map<string, ContentParser> = new Map();
  
  /** 别名到解析器 key 的映射 */
  private aliasMap: Map<string, string> = new Map();
  
  private constructor() {
    // 私有构造函数，使用单例
  }
  
  /**
   * 获取单例实例
   */
  public static getInstance(): ContentDispatcher {
    if (!ContentDispatcher.instance) {
      ContentDispatcher.instance = new ContentDispatcher();
    }
    return ContentDispatcher.instance;
  }
  
  /**
   * 注册解析器
   */
  public register(parser: ContentParser): void {
    this.parsers.set(parser.key, parser);
    
    // 注册所有别名
    parser.aliases.forEach(alias => {
      this.aliasMap.set(alias.toLowerCase(), parser.key);
    });
    
    console.log(`[ContentDispatcher] 注册解析器: ${parser.key} (别名: ${parser.aliases.join(', ')})`);
  }
  
  /**
   * 批量注册解析器
   */
  public registerAll(parsers: ContentParser[]): void {
    parsers.forEach(p => this.register(p));
  }
  
  /**
   * 获取解析器
   */
  public getParser(key: string): ContentParser | undefined {
    return this.parsers.get(key);
  }
  
  /**
   * 通过别名获取解析器 key
   */
  public getParserKeyByAlias(alias: string): string | undefined {
    return this.aliasMap.get(alias.toLowerCase());
  }
  
  /**
   * 获取所有注
   */
  public getAllParsers(): ContentParser[] {
    return Array.from(this.parsers.values());
  }
  
  /**
   * 解析复合输出
   * 
   * @param jsonOutput LLM 输出的 JSON 字符串
   * @param context 解析上下文（不含 resolved，会自动创建）
   * @returns 解析结果
   */
  public async dispatch(
    jsonOutput: string,
    context: Omit<ParseContext, 'resolved'>
  ): Promise<ParseResult> {
    const result: ParseResult = {
      success: true,
      data: {},
      errors: [],
      stats: {},
    };
    
    // 1. 解析 JSON
    let parsed: Record<string, any>;
    try {
      parsed = this.parseJSON(jsonOutput);
    } catch (e: any) {
      result.success = false;
      result.errors.push({
        parser: 'dispatcher',
        messages: [`JSON 解析失败: ${e.message}`],
      });
      return result;
    }
    
    // 2. 创建共享上下文
    const fullContext: ParseContext = {
      ...context,
      resolved: this.createResolvedData(),
    };
    
    // 3. 识别需要处理的 key 并拓扑排序
    const tasks = this.identifyAndSortTasks(parsed);
    
    if (tasks.length === 0) {
      context.log('warn', '没有找到可识别的内容字段');
      return result;
    }
    
    context.log('info', `识别到 ${tasks.length} 个内容类型: ${tasks.map(t => t.parserKey).join(', ')}`);
    
    // 4. 按顺序执行解析器
    for (const task of tasks) {
      const parser = this.parsers.get(task.parserKey);
      if (!parser) {
        result.errors.push({
          parser: task.parserKey,
          messages: [`未找到解析器: ${task.parserKey}`],
        });
        continue;
      }
      
      try {
        // 验证
        const validation = parser.validate(task.data);
        if (!validation.valid) {
          result.errors.push({
            parser: task.parserKey,
            messages: validation.errors,
            rawInput: task.data,
          });
          context.log('warn', `${task.parserKey} 验证失败: ${validation.errors.join(', ')}`);
          continue;
        }
        
        if (validation.warnings?.length) {
          validation.warnings.forEach(w => context.log('warn', `${task.parserKey}: ${w}`));
        }
        
        // 转换
        const transformed = await parser.transform(task.data, fullContext);
        
        // 持久化
        const persistResult = await parser.persist(transformed, fullContext);
        
        // 记录结果
        result.data[task.parserKey as keyof typeof result.data] = persistResult.ids;
        result.stats[task.parserKey] = persistResult.count;
        
        context.log('info', `${task.parserKey}: 成功处理 ${persistResult.count} 条`);
        
        if (persistResult.failedCount) {
          context.log('warn', `${task.parserKey}: 失败 ${persistResult.failedCount} 条`);
        }
      } catch (e: any) {
        result.success = false;
        result.errors.push({
          parser: task.parserKey,
          messages: [e.message],
          rawInput: task.data,
        });
        context.log('error', `${task.parserKey} 处理失败: ${e.message}`);
      }
    }
    
    // 判断整体是否成功
    result.success = result.errors.filter(e => !e.messages.every(m => m.includes('验证失败'))).length === 0;
    
    return result;
  }
  
  /**
   * 解析 JSON（处理 markdown 代码块）
   */
  private parseJSON(jsonOutput: string): Record<string, any> {
    let cleanJson = jsonOutput.trim();
    
    // 移除 markdown 代码块
    if (cleanJson.startsWith('```json')) {
      cleanJson = cleanJson.slice(7);
    } else if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.slice(3);
    }
    
    if (cleanJson.endsWith('```')) {
      cleanJson = cleanJson.slice(0, -3);
    }
    
    cleanJson = cleanJson.trim();
    
    const parsed = JSON.parse(cleanJson);
    
    // 如果是数组，包装为对象
    if (Array.isArray(parsed)) {
      // 尝试推断类型
      if (parsed.length > 0) {
        const first = parsed[0];
        if (first.keyword || first.heat !== undefined) {
          return { hotSearches: parsed };
        }
        if (first.primaryType || first.payload || first.text) {
          return { posts: parsed };
        }
        if (first.content && (first.nickname || first.postId)) {
          return { comments: parsed };
        }
      }
      // 默认作为 posts
      return { posts: parsed };
    }
    
    return parsed;
  }
  
  /**
   * 识别并按依赖排序任务
   */
  private identifyAndSortTasks(parsed: Record<string, any>): ParseTask[] {
    const tasks: ParseTask[] = [];
    
    // 遍历所有顶层 key
    for (const [fieldName, data] of Object.entries(parsed)) {
      const parserKey = this.aliasMap.get(fieldName.toLowerCase());
      if (parserKey && data != null) {
        tasks.push({
          parserKey,
          data,
          fieldName,
        });
      }
    }
    
    // 拓扑排序：依赖在前
    return this.topologicalSort(tasks);
  }
  
  /**
   * 拓扑排序
   */
  private topologicalSort(tasks: ParseTask[]): ParseTask[] {
    const taskMap = new Map(tasks.map(t => [t.parserKey, t]));
    const visited = new Set<string>();
    const result: ParseTask[] = [];
    
    const visit = (parserKey: string) => {
      if (visited.has(parserKey)) return;
      visited.add(parserKey);
      
      const parser = this.parsers.get(parserKey);
      if (parser?.dependencies) {
        for (const dep of parser.dependencies) {
          if (taskMap.has(dep)) {
            visit(dep);
          }
        }
      }
      
      const task = taskMap.get(parserKey);
      if (task) {
        result.push(task);
      }
    };
    
    for (const task of tasks) {
      visit(task.parserKey);
    }
    
    return result;
  }
  
  /**
   * 创建空的 resolved 数据
   */
  private createResolvedData(): ResolvedData {
    return {
      posts: new Map(),
      users: new Map(),
      hotSearches: new Map(),
      comments: new Map(),
    };
  }
  
  /**
   * 重置（清除所有注册的解析器）
   */
  public reset(): void {
    this.parsers.clear();
    this.aliasMap.clear();
  }
}

// 导出单例获取函数
export function getDispatcher(): ContentDispatcher {
  return ContentDispatcher.getInstance();
}
