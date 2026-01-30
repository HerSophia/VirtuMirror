/**
 * 内置上下文提供器
 * 提供系统级的上下文变量
 */

import { contextSharingService } from '@/services/contextSharing';
import type { ContextProvider, SharedContextConfig } from './types';
import { getContextProviderRegistry } from './ContextProviderRegistry';
import { loggerService } from '@/services/logger';

const logger = loggerService.child('service:builtinProviders');

// ==================== 时间上下文提供器 ====================

/**
 * 系统时间上下文提供器
 * 提供当前时间、日期、时段等信息
 */
export const timeContextProvider: ContextProvider = {
  id: 'system:time',
  appId: 'system',
  name: '时间上下文',
  description: '提供当前时间、日期、时段等信息',
  priority: 0, // 最高优先级

  async getContext(): Promise<Record<string, string>> {
    const now = new Date();
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const hour = now.getHours();

    // 时段描述
    let timePeriod = '';
    if (hour >= 5 && hour < 9) timePeriod = '清晨';
    else if (hour >= 9 && hour < 12) timePeriod = '上午';
    else if (hour >= 12 && hour < 14) timePeriod = '中午';
    else if (hour >= 14 && hour < 18) timePeriod = '下午';
    else if (hour >= 18 && hour < 22) timePeriod = '晚上';
    else timePeriod = '深夜';

    // 工作日/周末
    const isWeekend = now.getDay() === 0 || now.getDay() === 6;
    const dayType = isWeekend ? '周末' : '工作日';

    // 季节
    const month = now.getMonth() + 1;
    let season = '';
    if (month >= 3 && month <= 5) season = '春季';
    else if (month >= 6 && month <= 8) season = '夏季';
    else if (month >= 9 && month <= 11) season = '秋季';
    else season = '冬季';

    return {
      currentTime: now.toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      currentDate: now.toLocaleDateString('zh-CN', {
        month: 'long',
        day: 'numeric',
      }),
      currentYear: String(now.getFullYear()),
      currentMonth: String(now.getMonth() + 1),
      currentDay: String(now.getDate()),
      currentWeekday: weekdays[now.getDay()],
      currentHour: String(hour),
      timePeriod,
      dayType,
      season,
      isWeekend: isWeekend ? 'true' : 'false',
      fullDateTime: `${now.toLocaleDateString('zh-CN')} ${weekdays[now.getDay()]} ${timePeriod}`,
      timestamp: String(now.getTime()),
      isoDate: now.toISOString(),
    };
  },

  getMetadata() {
    return {
      type: 'builtin',
      category: 'time',
    };
  },
};

// ==================== 用户上下文提供器 ====================

/**
 * 系统用户上下文提供器（占位）
 * 在实际环境中会从用户服务获取信息
 */
export const userContextProvider: ContextProvider = {
  id: 'system:user',
  appId: 'system',
  name: '用户上下文',
  description: '提供当前用户信息（占位）',
  priority: 5,

  async getContext(): Promise<Record<string, string>> {
    // TODO: 从用户服务获取实际信息
    return {
      userName: '用户',
      userRole: 'user',
    };
  },

  getMetadata() {
    return {
      type: 'builtin',
      category: 'user',
    };
  },
};

// ==================== 环境上下文提供器 ====================

/**
 * 系统环境上下文提供器
 * 提供运行环境信息
 */
export const environmentContextProvider: ContextProvider = {
  id: 'system:environment',
  appId: 'system',
  name: '环境上下文',
  description: '提供运行环境信息',
  priority: 10,

  async getContext(): Promise<Record<string, string>> {
    return {
      platform: 'web',
      language: navigator.language || 'zh-CN',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai',
      isDevelopment: import.meta.env.DEV ? 'true' : 'false',
    };
  },

  getMetadata() {
    return {
      type: 'builtin',
      category: 'environment',
    };
  },
};

// ==================== 共享上下文提供器 ====================

/**
 * 共享上下文提供器选项
 */
export interface SharedContextProviderOptions {
  config: SharedContextConfig;
  appId?: string;
  taskId?: string;
}

/**
 * 共享上下文提供器
 * 从 Context Sharing Service 获取聚合上下文
 */
export const sharedContextProvider = {
  id: 'system:shared-context',
  appId: 'system',
  name: '共享上下文',
  description: '从 Context Sharing Service 聚合跨应用上下文',
  priority: 50, // 较高优先级，确保在其他提供器之前执行

  async getContext(options?: SharedContextProviderOptions): Promise<Record<string, string>> {
    // 如果没有配置，返回空对象
    if (!options?.config) {
      return {};
    }

    const { config, appId } = options;

    try {
      const aggregated = await contextSharingService.aggregate({
        requesterId: appId || 'llm-task',
        types: config.types,
        ids: config.ids,
        format: config.format || 'xml',
        maxTokens: config.maxTokens || 2000,
        priority: config.priority,
      });

      const variableName = config.variableName || 'sharedContext';

      return {
        [variableName]: aggregated.formatted || '',
        [`${variableName}Meta`]: JSON.stringify(aggregated.meta),
      };
    } catch (error) {
      logger.error('获取共享上下文失败:', error);
      return {
        [config.variableName || 'sharedContext']: '',
      };
    }
  },
};

// ==================== 内置提供器列表 ====================

/** 所有内置上下文提供器 */
export const BUILTIN_CONTEXT_PROVIDERS: ContextProvider[] = [
  timeContextProvider,
  userContextProvider,
  environmentContextProvider,
];

/**
 * 注册所有内置上下文提供器
 */
export function registerBuiltinProviders(): void {
  const registry = getContextProviderRegistry();

  for (const provider of BUILTIN_CONTEXT_PROVIDERS) {
    if (!registry.has(provider.id)) {
      registry.register(provider);
    }
  }

  logger.info(`已注册 ${BUILTIN_CONTEXT_PROVIDERS.length} 个内置提供器`);
}
