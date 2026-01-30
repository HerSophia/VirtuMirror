/**
 * 微博设置 Store
 * 
 * 使用 ScopedStorage 持久化用户设置，支持数据隔离
 * 
 * 存储的设置项：
 * - autoGenerate: 自动内容生成配置
 * - autoNarrativeAnalysis: 自动叙事分析开关
 * - llmSettings: LLM 相关设置
 */

import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { tryUseAppRuntime, ScopedStorage } from '@/services/appRuntime';
import { loggerService } from '@/services/logger/loggerService';

// ==================== 类型定义 ====================

/** 自动生成配置 */
export interface AutoGenerateConfig {
  /** 当首页无内容时自动触发 Director 生成事件和博文 */
  onEmptyFeed: boolean;
  /** 当评论不足时自动生成评论 */
  onFewComments: boolean;
}

/** LLM 全局设置 */
export interface LLMSettings {
  /** 是否使用全局设置作为默认值 */
  useGlobalAsDefault: boolean;
  /** 默认预设 ID */
  defaultPresetId?: string;
  /** 默认参数覆盖 */
  defaultOverrides?: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
  };
}

/** 微博设置 */
export interface WeiboSettings {
  /** 自动生成配置 */
  autoGenerate: AutoGenerateConfig;
  /** 自动叙事分析开关 */
  autoNarrativeAnalysis: boolean;
  /** LLM 设置 */
  llmSettings: LLMSettings;
  /** 版本号（用于迁移） */
  version: number;
}

// ==================== 默认值 ====================

const DEFAULT_AUTO_GENERATE_CONFIG: AutoGenerateConfig = {
  onEmptyFeed: false,
  onFewComments: false,
};

const DEFAULT_LLM_SETTINGS: LLMSettings = {
  useGlobalAsDefault: true,
  defaultPresetId: undefined,
  defaultOverrides: undefined,
};

const DEFAULT_SETTINGS: WeiboSettings = {
  autoGenerate: DEFAULT_AUTO_GENERATE_CONFIG,
  autoNarrativeAnalysis: false,
  llmSettings: DEFAULT_LLM_SETTINGS,
  version: 1,
};

// ==================== 存储键 ====================

const STORAGE_KEY = 'weibo_settings';
const MIGRATION_KEY = 'settings_migrated_v1';

// localStorage 旧键（用于迁移）
const LEGACY_KEYS = {
  autoGenerate: 'weibo_auto_generate_config',
  autoNarrativeAnalysis: 'weibo_auto_narrative_analysis',
};

// ==================== Store 定义 ====================

export const useSettingsStore = defineStore('weiboSettings', () => {
  // ==================== 状态 ====================
  
  /** 自动生成配置 */
  const autoGenerateConfig = ref<AutoGenerateConfig>({ ...DEFAULT_AUTO_GENERATE_CONFIG });
  
  /** 自动叙事分析开关 */
  const autoNarrativeAnalysisEnabled = ref(false);
  
  /** LLM 设置 */
  const llmSettings = ref<LLMSettings>({ ...DEFAULT_LLM_SETTINGS });
  
  /** 是否已初始化 */
  const initialized = ref(false);
  
  /** 是否正在保存 */
  const isSaving = ref(false);

  // ==================== 辅助函数 ====================
  
  /**
   * 获取 ScopedStorage 实例
   */
  function getStorage(): ScopedStorage | null {
    const runtime = tryUseAppRuntime();
    return runtime?.storage || null;
  }

  /**
   * 从 localStorage 迁移旧数据
   */
  async function migrateFromLocalStorage(storage: ScopedStorage): Promise<boolean> {
    // 检查是否已迁移
    const migrated = await storage.get<boolean>(MIGRATION_KEY);
    if (migrated) {
      return false;
    }

    loggerService.info('SettingsStore', '检查 localStorage 旧数据...');
    let hasMigratedData = false;
    const migratedSettings: Partial<WeiboSettings> = {};

    // 尝试迁移自动生成配置
    try {
      const oldAutoGenerate = localStorage.getItem(LEGACY_KEYS.autoGenerate);
      if (oldAutoGenerate) {
        const parsed = JSON.parse(oldAutoGenerate);
        migratedSettings.autoGenerate = {
          onEmptyFeed: parsed.onEmptyFeed ?? false,
          onFewComments: parsed.onFewComments ?? false,
        };
        localStorage.removeItem(LEGACY_KEYS.autoGenerate);
        hasMigratedData = true;
        loggerService.info('SettingsStore', '迁移自动生成配置:', migratedSettings.autoGenerate);
      }
    } catch (e) {
      loggerService.warn('SettingsStore', '迁移自动生成配置失败:', e);
    }

    // 尝试迁移自动叙事分析开关
    try {
      const oldNarrative = localStorage.getItem(LEGACY_KEYS.autoNarrativeAnalysis);
      if (oldNarrative) {
        migratedSettings.autoNarrativeAnalysis = oldNarrative === 'true';
        localStorage.removeItem(LEGACY_KEYS.autoNarrativeAnalysis);
        hasMigratedData = true;
        loggerService.info('SettingsStore', '迁移自动叙事分析:', migratedSettings.autoNarrativeAnalysis);
      }
    } catch (e) {
      loggerService.warn('SettingsStore', '迁移自动叙事分析失败:', e);
    }

    // 保存迁移后的数据
    if (hasMigratedData) {
      const fullSettings: WeiboSettings = {
        ...DEFAULT_SETTINGS,
        ...migratedSettings,
      };
      await storage.set(STORAGE_KEY, fullSettings);
      loggerService.info('SettingsStore', '数据迁移完成');
    }

    // 标记迁移完成
    await storage.set(MIGRATION_KEY, true);
    return hasMigratedData;
  }

  // ==================== 核心方法 ====================
  
  /**
   * 初始化设置（从 ScopedStorage 加载）
   * 应在 WeiboApp.vue 的 onMounted 中调用
   */
  async function initialize(): Promise<void> {
    if (initialized.value) return;

    const storage = getStorage();
    if (!storage) {
      loggerService.warn('SettingsStore', 'ScopedStorage 不可用，使用默认设置');
      initialized.value = true;
      return;
    }

    try {
      // 先尝试迁移旧数据
      await migrateFromLocalStorage(storage);

      // 加载设置
      const saved = await storage.get<WeiboSettings>(STORAGE_KEY);
      if (saved) {
        autoGenerateConfig.value = saved.autoGenerate ?? DEFAULT_AUTO_GENERATE_CONFIG;
        autoNarrativeAnalysisEnabled.value = saved.autoNarrativeAnalysis ?? false;
        llmSettings.value = saved.llmSettings ?? DEFAULT_LLM_SETTINGS;
        loggerService.info('SettingsStore', '设置已加载:', saved);
      } else {
        loggerService.debug('SettingsStore', '使用默认设置');
      }

      initialized.value = true;
    } catch (e) {
      loggerService.error('SettingsStore', '加载设置失败:', e);
      initialized.value = true;
    }
  }

  /**
   * 保存设置到 ScopedStorage
   */
  async function saveSettings(): Promise<void> {
    const storage = getStorage();
    if (!storage) {
      loggerService.warn('SettingsStore', 'ScopedStorage 不可用，设置未保存');
      return;
    }

    if (isSaving.value) return;
    isSaving.value = true;

    try {
      const settings: WeiboSettings = {
        autoGenerate: autoGenerateConfig.value,
        autoNarrativeAnalysis: autoNarrativeAnalysisEnabled.value,
        llmSettings: llmSettings.value,
        version: 1,
      };
      await storage.set(STORAGE_KEY, settings);
      loggerService.debug('SettingsStore', '设置已保存');
    } catch (e) {
      loggerService.error('SettingsStore', '保存设置失败:', e);
    } finally {
      isSaving.value = false;
    }
  }

  // ==================== 设置更新方法 ====================
  
  /**
   * 更新自动生成配置
   */
  async function setAutoGenerateConfig(config: Partial<AutoGenerateConfig>): Promise<void> {
    Object.assign(autoGenerateConfig.value, config);
    await saveSettings();
    loggerService.info('SettingsStore', '自动生成配置已更新:', autoGenerateConfig.value);
  }

  /**
   * 切换自动叙事分析
   */
  async function toggleAutoNarrativeAnalysis(enabled?: boolean): Promise<void> {
    autoNarrativeAnalysisEnabled.value = enabled ?? !autoNarrativeAnalysisEnabled.value;
    await saveSettings();
    loggerService.info('SettingsStore', '自动叙事分析:', autoNarrativeAnalysisEnabled.value);
  }

  /**
   * 更新 LLM 设置
   */
  async function setLLMSettings(settings: Partial<LLMSettings>): Promise<void> {
    Object.assign(llmSettings.value, settings);
    await saveSettings();
    loggerService.info('SettingsStore', 'LLM 设置已更新:', llmSettings.value);
  }

  /**
   * 重置所有设置为默认值
   */
  async function resetToDefaults(): Promise<void> {
    autoGenerateConfig.value = { ...DEFAULT_AUTO_GENERATE_CONFIG };
    autoNarrativeAnalysisEnabled.value = false;
    llmSettings.value = { ...DEFAULT_LLM_SETTINGS };
    await saveSettings();
    loggerService.info('SettingsStore', '设置已重置为默认值');
  }

  /**
   * 导出设置（用于备份）
   */
  function exportSettings(): WeiboSettings {
    return {
      autoGenerate: { ...autoGenerateConfig.value },
      autoNarrativeAnalysis: autoNarrativeAnalysisEnabled.value,
      llmSettings: { ...llmSettings.value },
      version: 1,
    };
  }

  /**
   * 导入设置（用于恢复）
   */
  async function importSettings(settings: Partial<WeiboSettings>): Promise<void> {
    if (settings.autoGenerate) {
      autoGenerateConfig.value = { ...DEFAULT_AUTO_GENERATE_CONFIG, ...settings.autoGenerate };
    }
    if (settings.autoNarrativeAnalysis !== undefined) {
      autoNarrativeAnalysisEnabled.value = settings.autoNarrativeAnalysis;
    }
    if (settings.llmSettings) {
      llmSettings.value = { ...DEFAULT_LLM_SETTINGS, ...settings.llmSettings };
    }
    await saveSettings();
    loggerService.info('SettingsStore', '设置已导入');
  }

  return {
    // 状态
    autoGenerateConfig,
    autoNarrativeAnalysisEnabled,
    llmSettings,
    initialized,
    isSaving,

    // 核心方法
    initialize,
    saveSettings,

    // 设置更新
    setAutoGenerateConfig,
    toggleAutoNarrativeAnalysis,
    setLLMSettings,
    resetToDefaults,

    // 导入/导出
    exportSettings,
    importSettings,
  };
});
