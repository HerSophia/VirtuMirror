/**
 * 微博 App Stores 入口
 *
 * 将原来的巨型 weiboStore 分离为多个专用 store：
 * - hotSearchStore: 热搜榜管理
 * - feedStore: 信息流、博文、评论
 * - composeStore: 发布、草稿、AI 扩展
 * - llmTaskStore: LLM 任务管理
 * - userActionStore: 用户行为（点赞、收藏、浏览历史）
 * - settingsStore: 用户设置（自动生成、LLM 配置等）
 */

export { useHotSearchStore, type GeneratedHotItem } from './hotSearchStore';
export { useFeedStore } from './feedStore';
export { useComposeStore } from './composeStore';
export { useUserActionStore } from './userActionStore';
export { useLLMTaskStore } from './llmTaskStore';
export {
  useSettingsStore,
  type AutoGenerateConfig,
  type LLMSettings,
  type WeiboSettings,
} from './settingsStore';
