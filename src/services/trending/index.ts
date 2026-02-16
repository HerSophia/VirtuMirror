export { TrendingService, getTrendingService, resetTrendingService } from './trendingService';
export {
  PlatformConfigRegistry,
} from './platformConfigRegistry';
export { SharePolicyManager } from './sharePolicyManager';
export { TrendingEventBridge } from './eventBridge';
export type {
  CreateOptions,
  ITrendingService,
  SharePolicy,
  SharedTrendingOptions,
  TrendingConfig,
  TrendingQueryOptions,
  TrendingUpdateEvent,
  TrendingUpdateType,
} from './types';

import { getTrendingService } from './trendingService';

export const trendingService = getTrendingService();
