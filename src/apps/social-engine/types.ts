/**
 * 社交引擎配置 App 类型定义
 */

// 导演服务配置
export interface DirectorConfig {
  /** 是否启用自动事件生成 */
  isEnabled: boolean;
  /** 世界背景设定 */
  worldSetting: string;
  /** 事件生成频率 */
  frequency: 'low' | 'medium' | 'high';
  /** Token 预算上限 */
  costLimit: number;
}

// 频率选项
export const FREQUENCY_OPTIONS = [
  { value: 'low', label: '低', description: '每12小时生成一次事件' },
  { value: 'medium', label: '中', description: '每6小时生成一次事件' },
  { value: 'high', label: '高', description: '每2小时生成一次事件' },
] as const;

// 引擎统计数据
export interface EngineStats {
  /** 已注册平台数量 */
  platformCount: number;
  /** 活跃话题数量 */
  activeTopicCount: number;
  /** 博文总数 */
  postCount: number;
  /** 评论总数 */
  commentCount: number;
  /** 影子账号数量 */
  shadowAccountCount: number;
  /** 今日生成事件数 */
  todayEventCount: number;
}

// 平台状态信息（扩展 PlatformConfig）
export interface PlatformStatus {
  id: string;
  name: string;
  /** 是否已启用 */
  enabled: boolean;
  /** 该平台的话题数 */
  topicCount: number;
  /** 该平台的博文数 */
  postCount: number;
  /** 该平台的账号数 */
  accountCount: number;
}

// Tab 定义
export type TabId = 'overview' | 'platforms' | 'director' | 'users' | 'algorithm';

export interface TabItem {
  id: TabId;
  label: string;
  icon: string;
}

export const TABS: TabItem[] = [
  { id: 'overview', label: '概览', icon: 'LayoutDashboard' },
  { id: 'platforms', label: '平台', icon: 'Globe' },
  { id: 'director', label: '导演', icon: 'Clapperboard' },
  { id: 'users', label: '用户', icon: 'Users' },
  { id: 'algorithm', label: '算法', icon: 'TrendingUp' },
];
