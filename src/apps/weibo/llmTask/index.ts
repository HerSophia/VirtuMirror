/**
 * 微博 App LLM 任务扩展
 *
 * 注册微博专用的任务定义、上下文提供器和输出处理器到系统服务
 * @see docs/systems/llm-task-service.md
 */

import { getLLMTaskService } from '@/services/llmTask';
import { initializeNarrativeSubscription } from '../stores/llm/narrativeIntegration';
import { initializeParsers } from '../stores/llm/parsers';

// 导出子模块
export * from './weiboTaskDefinitions';
export * from './weiboContextProviders';
export * from './weiboOutputHandlers';

// 导入注册内容
import { weiboTaskDefinitions, weiboTaskTemplates, WEIBO_APP_ID } from './weiboTaskDefinitions';
import { weiboContextProviders } from './weiboContextProviders';
import { weiboOutputHandlers } from './weiboOutputHandlers';

// ==================== 注册状态 ====================

let isRegistered = false;

// ==================== 注册函数 ====================

/**
 * 注册微博 App 的 LLM 任务扩展
 *
 * 在 WeiboApp.vue 的 onMounted 或应用初始化时调用
 */
export function registerWeiboLLMExtensions(): void {
  if (isRegistered) {
    console.log('[Weibo/LLMTask] 扩展已注册，跳过');
    return;
  }

  const service = getLLMTaskService();

  // 1. 注册上下文提供器
  weiboContextProviders.forEach((provider) => {
    service.registerContextProvider(provider);
  });
  console.log(`[Weibo/LLMTask] 已注册 ${weiboContextProviders.length} 个上下文提供器`);

  // 2. 注册输出处理器
  weiboOutputHandlers.forEach((handler) => {
    service.registerOutputHandler(handler);
  });
  console.log(`[Weibo/LLMTask] 已注册 ${weiboOutputHandlers.length} 个输出处理器`);

  // 3. 注册任务定义
  service.registerTaskDefinitions(weiboTaskDefinitions);
  console.log(`[Weibo/LLMTask] 已注册 ${weiboTaskDefinitions.length} 个任务定义`);

  // 4. 注册任务模板
  service.registerTaskTemplates(weiboTaskTemplates);
  console.log(`[Weibo/LLMTask] 已注册 ${weiboTaskTemplates.length} 个任务模板`);

  // 5. 初始化叙事订阅
  initializeNarrativeSubscription((level, msg) => {
    console.log(`[Weibo/LLMTask] Narrative ${level}: ${msg}`);
  });

  // 6. 初始化解析器
  initializeParsers();

  isRegistered = true;

  console.log('[Weibo/LLMTask] 扩展注册完成', {
    tasks: weiboTaskDefinitions.length,
    templates: weiboTaskTemplates.length,
    providers: weiboContextProviders.length,
    handlers: weiboOutputHandlers.length,
  });
}

/**
 * 注销微博 App 的 LLM 任务扩展
 *
 * 在应用卸载时调用（可选）
 */
export function unregisterWeiboLLMExtensions(): void {
  if (!isRegistered) {
    return;
  }

  const service = getLLMTaskService();

  // 1. 注销任务定义
  weiboTaskDefinitions.forEach((def) => {
    service.unregisterTaskDefinition(def.id);
  });

  // 2. 注销任务模板
  weiboTaskTemplates.forEach((template) => {
    service.unregisterTaskTemplate(template.id);
  });

  // 3. 注销输出处理器
  weiboOutputHandlers.forEach((handler) => {
    service.unregisterOutputHandler(handler.id);
  });

  // 4. 注销上下文提供器
  weiboContextProviders.forEach((provider) => {
    service.unregisterContextProvider(provider.id);
  });

  isRegistered = false;
  console.log('[Weibo/LLMTask] 扩展已注销');
}

/**
 * 初始化内置任务实例
 *
 * 为每个 showByDefault=true 的定义创建任务实例
 */
export function initializeBuiltinTasks(): void {
  const service = getLLMTaskService();

  // 获取微博任务定义
  const definitions = service.getTaskDefinitionsByApp(WEIBO_APP_ID);

  // 为默认显示的定义创建任务实例
  definitions
    .filter((def) => def.showByDefault)
    .forEach((def) => {
      // 检查是否已存在
      const existingTasks = service.getAllTasks().filter((t) => t.definitionId === def.id);

      if (existingTasks.length === 0) {
        service.createTask(def.id);
        console.log(`[Weibo/LLMTask] 已创建内置任务: ${def.name}`);
      }
    });
}

/**
 * 检查扩展是否已注册
 */
export function isWeiboLLMExtensionsRegistered(): boolean {
  return isRegistered;
}
