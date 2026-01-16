/**
 * 微博 App 输出处理器
 *
 * 将现有 outputHandlers 转换为 OutputHandler 接口
 * @see docs/systems/llm-task-service.md
 */

import type {
  OutputHandler,
  OutputHandlerResult,
  TaskExecutionContext,
  LLMTask,
} from '@/services/llmTask/types';
import { cleanJsonOutput } from '@/services/llmTask/utils';
import { tryUseAppRuntime } from '@/services/appRuntime';
import { useHotSearchStore } from '../stores/hotSearchStore';
import {
  saveSinglePostToDatabase,
  saveBatchPostsToDatabase,
  saveEngagementToDatabase,
  preprocessEngagementInput,
  type LogFunction,
} from '../stores/llm/outputHandlers';
import { parseCompositeOutput } from '../stores/llm/parsers';
import { WEIBO_APP_ID } from './weiboTaskDefinitions';

// ==================== 辅助函数 ====================

/**
 * 将 TaskExecutionContext 的 addLog 转换为 LogFunction
 */
function createLogFunction(context: TaskExecutionContext): LogFunction {
  return (taskId: string, level: 'info' | 'warn' | 'error', message: string) => {
    context.addLog(level, message);
  };
}

// ==================== 单条博文处理器 ====================

/**
 * 单条微博博文处理器
 * 解析 LLM 输出并保存为 UniversalPost
 */
export const postHandler: OutputHandler = {
  id: 'weibo:post-handler',
  appId: WEIBO_APP_ID,
  name: '微博博文处理器',
  description: '解析 LLM 输出并保存为单条微博博文',

  async handle(
    output: string,
    task: LLMTask,
    context: TaskExecutionContext
  ): Promise<OutputHandlerResult> {
    const logFn = createLogFunction(context);

    try {
      const result = await saveSinglePostToDatabase(output, task.id, logFn);

      if (result.success) {
        return {
          success: true,
          data: { postId: result.postId, type: result.type },
          recordsCreated: 1,
          logs: [`已保存博文: ${result.postId} (类型: ${result.type})`],
        };
      } else {
        return {
          success: false,
          error: result.error || '保存博文失败',
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  },

  supportsPreview: true,

  async preview(output: string) {
    try {
      const cleanJson = cleanJsonOutput(output);
      const parsed = JSON.parse(cleanJson);
      return {
        data: parsed,
        summary: `将创建 ${parsed.primaryType || 'text'} 类型的博文`,
      };
    } catch (e: any) {
      return {
        data: null,
        summary: `预览失败: ${e.message}`,
      };
    }
  },
};

// ==================== 批量博文处理器 ====================

/**
 * 批量博文处理器
 * 解析并保存多条博文
 */
export const batchPostsHandler: OutputHandler = {
  id: 'weibo:batch-posts-handler',
  appId: WEIBO_APP_ID,
  name: '批量博文处理器',
  description: '解析 LLM 输出并批量保存微博博文',

  async handle(
    output: string,
    task: LLMTask,
    context: TaskExecutionContext
  ): Promise<OutputHandlerResult> {
    const logFn = createLogFunction(context);

    try {
      const savedCount = await saveBatchPostsToDatabase(output, task.id, logFn);

      return {
        success: savedCount > 0,
        recordsCreated: savedCount,
        logs: [`已保存 ${savedCount} 条博文`],
        warnings: savedCount === 0 ? ['没有保存任何博文'] : undefined,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  },

  supportsPreview: true,

  async preview(output: string) {
    try {
      const cleanJson = cleanJsonOutput(output);
      const parsed = JSON.parse(cleanJson);
      const posts = Array.isArray(parsed) ? parsed : [parsed];
      return {
        data: posts,
        summary: `将创建 ${posts.length} 条博文`,
      };
    } catch (e: any) {
      return {
        data: null,
        summary: `预览失败: ${e.message}`,
      };
    }
  },
};

// ==================== 热搜处理器 ====================

/**
 * 热搜处理器
 * 解析并应用热搜数据
 */
export const hotListHandler: OutputHandler = {
  id: 'weibo:hot-list-handler',
  appId: WEIBO_APP_ID,
  name: '热搜处理器',
  description: '解析 LLM 输出并应用到热搜榜',

  async handle(
    output: string,
    _task: LLMTask,
    context: TaskExecutionContext
  ): Promise<OutputHandlerResult> {
    try {
      const hotSearchStore = useHotSearchStore();
      const result = await hotSearchStore.applyHotSearchFromJSON(output, 'prepend');

      if (result.success) {
        context.addLog('info', `已将 ${result.count} 条热搜应用到热搜榜`);
        return {
          success: true,
          recordsCreated: result.count,
          logs: [`已应用 ${result.count} 条热搜`],
        };
      } else {
        return {
          success: false,
          error: result.error || '应用热搜失败',
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  },

  supportsPreview: true,

  async preview(output: string) {
    try {
      const cleanJson = cleanJsonOutput(output);
      const parsed = JSON.parse(cleanJson);
      const topics = Array.isArray(parsed) ? parsed : [parsed];
      return {
        data: topics,
        summary: `将添加 ${topics.length} 条热搜`,
      };
    } catch (e: any) {
      return {
        data: null,
        summary: `预览失败: ${e.message}`,
      };
    }
  },
};

// ==================== 评论处理器 ====================

/**
 * 评论处理器
 * 目前仅记录日志，可扩展为保存评论
 */
export const commentsHandler: OutputHandler = {
  id: 'weibo:comments-handler',
  appId: WEIBO_APP_ID,
  name: '评论处理器',
  description: '处理生成的评论内容',

  async handle(
    output: string,
    _task: LLMTask,
    context: TaskExecutionContext
  ): Promise<OutputHandlerResult> {
    try {
      const cleanJson = cleanJsonOutput(output);
      const parsed = JSON.parse(cleanJson);
      const comments = Array.isArray(parsed) ? parsed : [parsed];

      context.addLog('info', `评论生成完成，共 ${comments.length} 条`);

      return {
        success: true,
        data: comments,
        logs: [`生成 ${comments.length} 条评论`],
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  },
};

// ==================== 互动处理器 ====================

/**
 * 互动处理器
 * 处理评论、点赞、转发等互动数据
 */
export const engagementHandler: OutputHandler = {
  id: 'weibo:engagement-handler',
  appId: WEIBO_APP_ID,
  name: '互动处理器',
  description: '解析并保存博文互动数据（评论、点赞、转发）',

  async handle(
    output: string,
    task: LLMTask,
    context: TaskExecutionContext
  ): Promise<OutputHandlerResult> {
    const logFn = createLogFunction(context);
    const postId = task.input?.postId as string | undefined;

    try {
      const result = await saveEngagementToDatabase(output, task.id, postId, logFn);

      if (result.success) {
        return {
          success: true,
          data: {
            comments: result.comments,
            likes: result.likes,
            shares: result.shares,
          },
          recordsCreated: result.comments,
          logs: [
            `已生成: ${result.comments} 评论, ${result.likes} 点赞, ${result.shares} 转发`,
          ],
        };
      } else {
        return {
          success: false,
          error: result.error || '处理互动数据失败',
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  },
};

// ==================== 复合内容处理器 ====================

/**
 * 复合内容处理器
 * 使用解析器分发架构处理包含多种内容的输出
 */
export const compositeHandler: OutputHandler = {
  id: 'weibo:composite-handler',
  appId: WEIBO_APP_ID,
  name: '复合内容处理器',
  description: '处理包含热搜、博文、评论、转发的复合输出',

  async handle(
    output: string,
    task: LLMTask,
    context: TaskExecutionContext
  ): Promise<OutputHandlerResult> {
    try {
      // 获取命名空间用于数据隔离
      const runtime = tryUseAppRuntime();
      const namespace = runtime?.identity.dataNamespace || 'weibo';

      const result = await parseCompositeOutput(output, {
        taskId: task.id,
        platformId: 'weibo',
        namespace,
        log: (level, msg) => context.addLog(level, msg),
      });

      if (result.success) {
        const stats = Object.entries(result.stats)
          .map(([k, v]) => `${k}: ${v}`)
          .join(', ');

        return {
          success: true,
          data: result.stats,
          recordsCreated: Object.values(result.stats).reduce((a, b) => a + b, 0),
          logs: [`复合内容处理完成: ${stats}`],
        };
      } else {
        return {
          success: false,
          error: `处理失败，${result.errors.length} 个错误`,
          warnings: result.errors.map((e) => `${e.parser}: ${e.messages.join(', ')}`),
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  },
};

// ==================== JSON 处理器 ====================

/**
 * 通用 JSON 处理器
 * 仅解析 JSON，不做特殊处理
 */
export const jsonHandler: OutputHandler = {
  id: 'weibo:json-handler',
  appId: WEIBO_APP_ID,
  name: 'JSON 处理器',
  description: '解析并返回 JSON 数据',

  async handle(
    output: string,
    _task: LLMTask,
    context: TaskExecutionContext
  ): Promise<OutputHandlerResult> {
    try {
      const cleanJson = cleanJsonOutput(output);
      const parsed = JSON.parse(cleanJson);

      context.addLog('info', '结构化数据生成完成');

      return {
        success: true,
        data: parsed,
      };
    } catch (error: any) {
      return {
        success: false,
        error: `JSON 解析失败: ${error.message}`,
      };
    }
  },
};

// ==================== 链结果处理器 ====================

/**
 * 链执行结果处理器
 * 处理提示词链的执行结果
 */
export const chainResultHandler: OutputHandler = {
  id: 'weibo:chain-result-handler',
  appId: WEIBO_APP_ID,
  name: '链结果处理器',
  description: '处理提示词链的执行结果',

  async handle(
    output: string,
    _task: LLMTask,
    context: TaskExecutionContext
  ): Promise<OutputHandlerResult> {
    context.addLog('info', '链执行结果已生成');

    return {
      success: true,
      data: output,
      logs: ['链执行完成'],
    };
  },
};

// ==================== 导出 ====================

/**
 * 微博输出处理器列表
 */
export const weiboOutputHandlers: OutputHandler[] = [
  postHandler,
  batchPostsHandler,
  hotListHandler,
  commentsHandler,
  engagementHandler,
  compositeHandler,
  jsonHandler,
  chainResultHandler,
];

/**
 * 获取微博输出处理器
 */
export function getWeiboOutputHandler(handlerId: string): OutputHandler | undefined {
  return weiboOutputHandlers.find((h) => h.id === handlerId);
}

// ==================== 输入预处理 ====================

/**
 * 预处理互动生成任务的输入
 * 如果提供了 postId，自动获取博文和博主信息
 */
export { preprocessEngagementInput };
