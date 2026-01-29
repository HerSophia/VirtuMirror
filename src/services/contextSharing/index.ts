/**
 * Context Sharing Service 模块导出
 * @module services/contextSharing
 */

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
  ContextItem,
  CacheEntry,
  SubscribeCallback,
  TypeSubscribeCallback,
} from './types';
