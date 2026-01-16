/**
 * 组合式函数模块入口
 */

export {
  // Injection Keys
  AdapterKey,
  ChatDataServiceKey,
  GlobalConfigServiceKey,
  ChatSyncServiceKey,
  
  // Provider
  provideAdapterServices,
  
  // Composables
  useAdapter,
  useChatDataService,
  useGlobalConfigService,
  useChatSyncService,
  useEnvironment,
  usePersistentData,
  useCustomApi,
} from './useAdapter'

// 主题系统
export { useTheme } from './useTheme'

// 手势系统
export { useSwipeGesture, type SwipeGestureOptions, type SwipeInfo } from './useSwipeGesture'
export { useLongPress, type LongPressOptions } from './useLongPress'