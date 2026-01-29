# 实现方案

> 本文档详细说明 Context Sharing Service 的技术实现细节。

## 1. 文件结构

```text
src/services/contextSharing/
├── index.ts                    # 模块导出
├── ContextSharingService.ts    # 核心服务实现
├── types.ts                    # 类型定义
├── formatters.ts               # 格式化工具
├── Visibility.ts               # 可见性快捷方法
└── __tests__/
    └── ContextSharingService.test.ts

src/composables/
└── useContextSharing.ts        # Vue Composables
```

---

## 2. 类型定义

```typescript
// src/services/contextSharing/types.ts

/**
 * 预定义的上下文类型
 */
export type WellKnownContextType =
  | 'system:time'
  | 'system:session'
  | 'system:player'
  | 'narrative:content'
  | 'narrative:characters'
  | 'narrative:location'
  | 'narrative:mood'
  | 'social:trending'
  | 'social:recentPosts'
  | 'social:hotTopics'
  | 'chat:lastMessage'
  | 'chat:recentHistory'
  | 'chat:participants'
  | 'user:currentAccount'
  | 'user:recentActions'
  | 'user:preferences'
  | 'archive:pinned'
  | 'archive:relevant'
  | 'archive:characters';

export type ContextType = WellKnownContextType | `custom:${string}`;

/**
 * 可见性配置
 */
export interface ContextVisibility {
  level: 'public' | 'restricted' | 'private';
  allowedApps?: string[];
  excludedApps?: string[];
}

/**
 * 缓存配置
 */
export interface CacheConfig {
  ttl: number;
  staleWhileRevalidate?: boolean;
}

/**
 * 共享上下文元信息
 */
export interface SharedContextMeta {
  id: string;
  publisherId: string;
  type: ContextType;
  description: string;
  visibility: ContextVisibility;
  updatedAt: number;
  cache?: CacheConfig;
}

/**
 * 共享上下文完整结构
 */
export interface SharedContext<T = any> extends SharedContextMeta {
  value: T;
  getter?: () => T | Promise<T>;
}

/**
 * 发布选项
 */
export interface PublishContextOptions<T> {
  id?: string;
  type: ContextType;
  description: string;
  value?: T;
  getter?: () => T | Promise<T>;
  visibility?: ContextVisibility;
  cache?: CacheConfig;
}

/**
 * 聚合请求
 */
export interface AggregationRequest {
  requesterId: string;
  types?: ContextType[];
  ids?: string[];
  format?: AggregationFormat;
  maxTokens?: number;
  priority?: ContextType[];
}

export type AggregationFormat = 'raw' | 'text' | 'xml' | 'markdown';

/**
 * 聚合结果
 */
export interface AggregatedContext {
  contexts: Map<ContextType, any[]>;
  formatted?: string;
  meta: {
    totalContexts: number;
    types: ContextType[];
    estimatedTokens?: number;
    truncated?: boolean;
  };
}

/**
 * 搜索查询
 */
export interface ContextSearchQuery {
  type?: ContextType;
  publisherId?: string;
  keyword?: string;
}
```

---

## 3. 可见性快捷方法

```typescript
// src/services/contextSharing/Visibility.ts

import type { ContextVisibility } from './types';

/**
 * 可见性快捷构造器
 */
export const Visibility = {
  /** 所有 App 可访问 */
  PUBLIC: { level: 'public' } as ContextVisibility,
  
  /** 仅发布者可访问 */
  PRIVATE: { level: 'private' } as ContextVisibility,
  
  /** 指定 App 可访问 */
  only: (...appIds: string[]): ContextVisibility => ({
    level: 'restricted',
    allowedApps: appIds,
  }),
  
  /** 排除指定 App */
  except: (...appIds: string[]): ContextVisibility => ({
    level: 'public',
    excludedApps: appIds,
  }),
};
```

---

## 4. 格式化工具

```typescript
// src/services/contextSharing/formatters.ts

import type { ContextType, AggregationFormat } from './types';

interface FormatResult {
  text: string;
  truncated: boolean;
}

/**
 * 格式化上下文为指定格式
 */
export function formatContexts(
  contexts: Map<ContextType, any[]>,
  format: AggregationFormat,
  maxTokens?: number
): FormatResult {
  let text = '';
  let truncated = false;
  
  const parts: string[] = [];
  
  for (const [type, items] of contexts) {
    switch (format) {
      case 'xml':
        parts.push(formatAsXml(type, items));
        break;
      case 'markdown':
        parts.push(formatAsMarkdown(type, items));
        break;
      case 'text':
      default:
        parts.push(formatAsText(type, items));
        break;
    }
  }
  
  text = parts.join('\n');
  
  // Token 限制
  if (maxTokens) {
    const estimatedTokens = Math.ceil(text.length / 4);
    if (estimatedTokens > maxTokens) {
      // 简单截断策略
      const maxChars = maxTokens * 4;
      text = text.slice(0, maxChars) + '\n... (内容已截断)';
      truncated = true;
    }
  }
  
  return { text, truncated };
}

function formatAsXml(type: ContextType, items: any[]): string {
  const lines: string[] = [`<context type="${type}">`];
  for (const item of items) {
    const valueStr = typeof item.value === 'string' 
      ? item.value 
      : JSON.stringify(item.value);
    lines.push(`  <item id="${item.id}" description="${item.description}">${valueStr}</item>`);
  }
  lines.push('</context>');
  return lines.join('\n');
}

function formatAsMarkdown(type: ContextType, items: any[]): string {
  const lines: string[] = [`## ${type}`, ''];
  for (const item of items) {
    lines.push(`### ${item.description}`);
    lines.push('```json');
    lines.push(JSON.stringify(item.value, null, 2));
    lines.push('```');
    lines.push('');
  }
  return lines.join('\n');
}

function formatAsText(type: ContextType, items: any[]): string {
  const lines: string[] = [`[${type}]`];
  for (const item of items) {
    const valueStr = typeof item.value === 'string'
      ? item.value
      : JSON.stringify(item.value);
    lines.push(`- ${item.description}: ${valueStr}`);
  }
  lines.push('');
  return lines.join('\n');
}
```

---

## 5. Vue Composables

```typescript
// src/composables/useContextSharing.ts

import { ref, onUnmounted, watch, type Ref } from 'vue';
import { contextSharingService } from '@/services/contextSharing';
import type { ContextType, PublishContextOptions } from '@/services/contextSharing/types';

/**
 * 订阅单个上下文
 */
export function useContext<T>(id: string): {
  value: Ref<T | undefined>;
  loading: Ref<boolean>;
} {
  const value = ref<T | undefined>() as Ref<T | undefined>;
  const loading = ref(true);
  
  const unsubscribe = contextSharingService.subscribe<T>(id, (v) => {
    value.value = v;
    loading.value = false;
  });
  
  // 如果订阅后没有立即收到值，尝试异步获取
  if (value.value === undefined) {
    contextSharingService.getAsync<T>(id).then((v) => {
      if (v !== undefined) {
        value.value = v;
      }
      loading.value = false;
    });
  }
  
  onUnmounted(unsubscribe);
  
  return {
    value,
    loading,
  };
}

/**
 * 订阅某类型的所有上下文
 */
export function useContextsByType<T>(type: ContextType): Ref<Map<string, T>> {
  const contexts = ref<Map<string, T>>(new Map()) as Ref<Map<string, T>>;
  
  const unsubscribe = contextSharingService.subscribeByType<T>(type, (c) => {
    contexts.value = c;
  });
  
  onUnmounted(unsubscribe);
  
  return contexts;
}

/**
 * 发布并自动同步上下文
 */
export function usePublishContext<T>(
  options: Omit<PublishContextOptions<T>, 'value'>,
  source: () => T
): string {
  const id = contextSharingService.publish<T>({
    ...options,
    value: source(),
  });
  
  // 监听源变化，自动更新
  watch(source, (newValue) => {
    contextSharingService.replace(id, newValue);
  }, { deep: true });
  
  onUnmounted(() => {
    contextSharingService.unpublish(id);
  });
  
  return id;
}

/**
 * 聚合上下文（异步）
 */
export async function useAggregatedContext(
  requesterId: string,
  types: ContextType[],
  format: 'xml' | 'text' | 'markdown' = 'xml'
): Promise<string> {
  const result = await contextSharingService.aggregate({
    requesterId,
    types,
    format,
  });
  
  return result.formatted || '';
}
```

---

## 6. 模块导出

```typescript
// src/services/contextSharing/index.ts

export { contextSharingService, ContextSharingService } from './ContextSharingService';
export { Visibility } from './Visibility';
export { formatContexts } from './formatters';

export type {
  ContextType,
  WellKnownContextType,
  ContextVisibility,
  CacheConfig,
  SharedContext,
  SharedContextMeta,
  PublishContextOptions,
  AggregationRequest,
  AggregationFormat,
  AggregatedContext,
  ContextSearchQuery,
} from './types';
```

---

## 7. 事件定义

在 Event Bus 中添加以下事件类型：

```typescript
// src/services/eventBus/event-types.ts

interface ContextSharingEvents {
  'contextSharing:published': {
    id: string;
    type: ContextType;
  };
  'contextSharing:updated': {
    id: string;
  };
  'contextSharing:unpublished': {
    id: string;
    type: ContextType;
  };
}
```

---

## 8. 测试用例

```typescript
// src/services/contextSharing/__tests__/ContextSharingService.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContextSharingService } from '../ContextSharingService';

describe('ContextSharingService', () => {
  let service: ContextSharingService;
  
  beforeEach(() => {
    service = new ContextSharingService();
  });
  
  describe('publish', () => {
    it('应该发布上下文并返回 ID', () => {
      const id = service.publish({
        type: 'social:trending',
        description: '热搜',
        value: [{ title: '热搜1' }],
      });
      
      expect(id).toBeTruthy();
      expect(service.get(id)).toEqual([{ title: '热搜1' }]);
    });
    
    it('应该使用提供的 ID', () => {
      const id = service.publish({
        id: 'weibo:trending',
        type: 'social:trending',
        description: '热搜',
        value: [],
      });
      
      expect(id).toBe('weibo:trending');
    });
  });
  
  describe('subscribe', () => {
    it('订阅后应该立即收到当前值', () => {
      service.publish({
        id: 'test:context',
        type: 'custom:test',
        description: '测试',
        value: 'hello',
      });
      
      const callback = vi.fn();
      service.subscribe('test:context', callback);
      
      expect(callback).toHaveBeenCalledWith('hello');
    });
    
    it('更新后应该收到新值', () => {
      service.publish({
        id: 'test:context',
        type: 'custom:test',
        description: '测试',
        value: 'hello',
      });
      
      const callback = vi.fn();
      service.subscribe('test:context', callback);
      
      service.replace('test:context', 'world');
      
      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenLastCalledWith('world');
    });
  });
  
  describe('visibility', () => {
    it('private 上下文应该只对发布者可见', () => {
      service.setCurrentAppId('app1');
      service.publish({
        id: 'private:context',
        type: 'custom:private',
        description: '私有',
        value: 'secret',
        visibility: { level: 'private' },
      });
      
      // 发布者可以访问
      expect(service.get('private:context')).toBe('secret');
      
      // 切换到其他 App
      service.setCurrentAppId('app2');
      expect(service.get('private:context')).toBeUndefined();
    });
  });
  
  describe('aggregate', () => {
    it('应该聚合多个上下文', async () => {
      service.publish({
        id: 'ctx1',
        type: 'narrative:content',
        description: '叙事',
        value: '故事内容',
      });
      
      service.publish({
        id: 'ctx2',
        type: 'social:trending',
        description: '热搜',
        value: [{ title: '热搜1' }],
      });
      
      const result = await service.aggregate({
        requesterId: 'test',
        types: ['narrative:content', 'social:trending'],
        format: 'text',
      });
      
      expect(result.meta.totalContexts).toBe(2);
      expect(result.formatted).toContain('叙事');
      expect(result.formatted).toContain('热搜');
    });
  });
});
```

---

## 9. 实施步骤

| 步骤 | 内容 | 预估时间 |
|------|------|----------|
| 1 | 创建类型定义文件 | 30min |
| 2 | 实现核心服务类 | 2h |
| 3 | 实现格式化工具 | 30min |
| 4 | 实现 Vue Composables | 1h |
| 5 | 添加事件定义 | 15min |
| 6 | 编写测试用例 | 1h |
| 7 | 文档更新 | 30min |

**总计**：约 5-6 小时
