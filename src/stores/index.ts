/**
 * Pinia Store 入口
 */

export { usePhoneStore } from './phoneStore'
export { useContactStore } from './contactStore'
export { useChatStore } from './chatStore'
export { useUIStore } from './uiStore'
export { useStagedActionsStore } from './stagedActionsStore'
export { useDeviceStore, type DeviceMode, type DeviceDimensions, type LayoutConfig, type SizePreset, type Orientation, SIZE_PRESETS } from './deviceStore'
export { useAppStoreStore } from './appStoreStore'
export { useSwipeStore } from './swipeStore'
export { useDialogStore, useDialog } from './dialogStore'
export { useNotificationStore } from './notificationStore'
export { useAudioStore } from './audioStore'
export { useTimeStore } from './timeStore'
export { useAccountStore } from './accountStore'
export { useAIStore } from './aiStore'
export { useLLMTaskStore } from './llmTaskStore'
export type {
  DialogType,
  DialogButton,
  ConfirmDialogOptions,
  AlertDialogOptions,
  InputDialogOptions,
  CustomDialogOptions,
} from './dialogStore'
