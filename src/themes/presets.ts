/**
 * 预设主题集合
 * 包含 iOS、Android Material You、深色模式、赛博朋克和复古诺基亚风格
 */

import type { Theme, AppIconSet } from '@/types/theme'

// ==================== 图标配置预设 ====================

/**
 * iOS 风格图标配置（使用 Font Awesome）
 */
const iosIconSet: AppIconSet = {
  type: 'font',
  fontFamily: 'font-awesome',
  icons: {
    wechat: { icon: 'fab fa-weixin', bg: '#07C160' },
    email: { icon: 'fas fa-envelope', bg: '#007AFF' },
    browser: { icon: 'fas fa-compass', bg: '#5856D6' },
    live: { icon: 'fas fa-video', bg: '#FF3B30' },
    settings: { icon: 'fas fa-cog', bg: '#8E8E93' },
    contacts: { icon: 'fas fa-address-book', bg: '#5AC8FA' },
    gallery: { icon: 'fas fa-images', bg: '#FF9500' },
    notes: { icon: 'fas fa-sticky-note', bg: '#FFCC00' },
    music: { icon: 'fas fa-music', bg: '#FC3C44' },
    video: { icon: 'fas fa-play-circle', bg: '#5856D6' },
    camera: { icon: 'fas fa-camera-retro', bg: '#8E8E93' },
    calendar: { icon: 'fas fa-calendar-alt', bg: '#FF3B30' },
    clock: { icon: 'fas fa-clock', bg: '#000000' },
    calculator: { icon: 'fas fa-calculator', bg: '#FF9500' },
    weather: { icon: 'fas fa-cloud-sun', bg: '#5AC8FA' },
    maps: { icon: 'fas fa-map-marked-alt', bg: '#34C759' },
    wallet: { icon: 'fas fa-wallet', bg: '#000000' },
    prompts: { icon: 'fas fa-magic', bg: '#AF52DE' },
    tutorial: { icon: 'fas fa-book-open', bg: '#5AC8FA' },
    appstore: { icon: 'fas fa-store', bg: '#007AFF' },
    'api-manager': { icon: 'fas fa-plug', bg: '#5856D6' },
    'pathfinder-student': { icon: 'fas fa-graduation-cap', bg: '#34C759' },
    bridge: { icon: 'fas fa-network-wired', bg: '#FF9500' },
  },
}

/**
 * Android Material You 图标配置（使用 Material Icons）
 */
const androidIconSet: AppIconSet = {
  type: 'font',
  fontFamily: 'material-icons',
  variant: 'rounded',
  icons: {
    wechat: { icon: 'chat', bg: 'linear-gradient(135deg, #07C160 0%, #00A67E 100%)' },
    email: { icon: 'mail', bg: 'linear-gradient(135deg, #2196F3 0%, #1565C0 100%)' },
    browser: { icon: 'explore', bg: 'linear-gradient(135deg, #9C27B0 0%, #6A1B9A 100%)' },
    live: { icon: 'videocam', bg: 'linear-gradient(135deg, #F44336 0%, #C62828 100%)' },
    settings: { icon: 'settings', bg: 'linear-gradient(135deg, #607D8B 0%, #37474F 100%)' },
    contacts: { icon: 'contacts', bg: 'linear-gradient(135deg, #00BCD4 0%, #00838F 100%)' },
    gallery: { icon: 'photo_library', bg: 'linear-gradient(135deg, #FF9800 0%, #EF6C00 100%)' },
    notes: { icon: 'note', bg: 'linear-gradient(135deg, #FFEB3B 0%, #F9A825 100%)', color: '#000' },
    music: { icon: 'music_note', bg: 'linear-gradient(135deg, #E91E63 0%, #AD1457 100%)' },
    video: { icon: 'play_circle', bg: 'linear-gradient(135deg, #673AB7 0%, #4527A0 100%)' },
    camera: { icon: 'camera_alt', bg: 'linear-gradient(135deg, #795548 0%, #4E342E 100%)' },
    calendar: { icon: 'calendar_today', bg: 'linear-gradient(135deg, #F44336 0%, #C62828 100%)' },
    clock: { icon: 'schedule', bg: 'linear-gradient(135deg, #212121 0%, #000000 100%)' },
    calculator: { icon: 'calculate', bg: 'linear-gradient(135deg, #FF9800 0%, #EF6C00 100%)' },
    weather: { icon: 'wb_sunny', bg: 'linear-gradient(135deg, #03A9F4 0%, #0277BD 100%)' },
    maps: { icon: 'map', bg: 'linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%)' },
    wallet: { icon: 'account_balance_wallet', bg: 'linear-gradient(135deg, #3F51B5 0%, #283593 100%)' },
    prompts: { icon: 'auto_fix_high', bg: 'linear-gradient(135deg, #AB47BC 0%, #7B1FA2 100%)' },
    tutorial: { icon: 'menu_book', bg: 'linear-gradient(135deg, #00BCD4 0%, #00838F 100%)' },
    appstore: { icon: 'storefront', bg: 'linear-gradient(135deg, #2196F3 0%, #1565C0 100%)' },
    'api-manager': { icon: 'electrical_services', bg: 'linear-gradient(135deg, #673AB7 0%, #4527A0 100%)' },
    'pathfinder-student': { icon: 'school', bg: 'linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%)' },
    bridge: { icon: 'hub', bg: 'linear-gradient(135deg, #FF9800 0%, #EF6C00 100%)' },
  },
}

/**
 * 深色模式图标配置（基于 iOS 风格，调整背景）
 */
const darkIconSet: AppIconSet = {
  type: 'font',
  fontFamily: 'font-awesome',
  icons: {
    wechat: { icon: 'fab fa-weixin', bg: '#1DB954' },
    email: { icon: 'fas fa-envelope', bg: '#0A84FF' },
    browser: { icon: 'fas fa-compass', bg: '#5E5CE6' },
    live: { icon: 'fas fa-video', bg: '#FF453A' },
    settings: { icon: 'fas fa-cog', bg: '#636366' },
    contacts: { icon: 'fas fa-address-book', bg: '#64D2FF' },
    gallery: { icon: 'fas fa-images', bg: '#FF9F0A' },
    notes: { icon: 'fas fa-sticky-note', bg: '#FFD60A', color: '#000' },
    music: { icon: 'fas fa-music', bg: '#FF375F' },
    video: { icon: 'fas fa-play-circle', bg: '#BF5AF2' },
    camera: { icon: 'fas fa-camera-retro', bg: '#636366' },
    calendar: { icon: 'fas fa-calendar-alt', bg: '#FF453A' },
    clock: { icon: 'fas fa-clock', bg: '#1C1C1E' },
    calculator: { icon: 'fas fa-calculator', bg: '#FF9F0A' },
    weather: { icon: 'fas fa-cloud-sun', bg: '#64D2FF' },
    maps: { icon: 'fas fa-map-marked-alt', bg: '#30D158' },
    wallet: { icon: 'fas fa-wallet', bg: '#1C1C1E' },
    prompts: { icon: 'fas fa-magic', bg: '#BF5AF2' },
    tutorial: { icon: 'fas fa-book-open', bg: '#64D2FF' },
    appstore: { icon: 'fas fa-store', bg: '#0A84FF' },
    'api-manager': { icon: 'fas fa-plug', bg: '#5E5CE6' },
    'pathfinder-student': { icon: 'fas fa-graduation-cap', bg: '#30D158' },
    bridge: { icon: 'fas fa-network-wired', bg: '#FF9F0A' },
  },
}

// ==================== 主题定义 ====================

/**
 * iOS 风格主题
 * 苹果设计语言，简洁明亮
 */
export const iosTheme: Theme = {
  id: 'ios',
  name: 'iOS 风格',
  description: '苹果设计语言，简洁明亮的视觉体验',
  colors: {
    primary: '#007AFF',
    secondary: '#5856D6',
    background: '#F2F2F7',
    surface: '#FFFFFF',
    surfaceVariant: '#E5E5EA',
    text: '#000000',
    textSecondary: '#8E8E93',
    border: '#C7C7CC',
    success: '#34C759',
    warning: '#FF9500',
    error: '#FF3B30',
  },
  device: {
    notchStyle: 'dynamic-island',
    borderRadius: 40,
    frameColor: '#1C1C1E',
    shadowIntensity: 'medium',
  },
  wallpapers: {
    homescreen: 'linear-gradient(180deg, #667eea 0%, #764ba2 100%)',
  },
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", sans-serif',
    baseFontSize: 16,
    fontWeight: 'normal',
  },
  icons: iosIconSet,
  isBuiltin: true,
  author: '系统',
  version: '1.0.0',
}

/**
 * Android Material You 风格主题
 * Google Material Design 3 设计语言
 */
export const androidTheme: Theme = {
  id: 'android',
  name: 'Material You',
  description: 'Google Material Design 3 设计语言',
  colors: {
    primary: '#6750A4',
    secondary: '#958DA5',
    background: '#FEF7FF',
    surface: '#FFFBFE',
    surfaceVariant: '#E7E0EC',
    text: '#1C1B1F',
    textSecondary: '#49454F',
    border: '#CAC4D0',
    success: '#4CAF50',
    warning: '#FF9800',
    error: '#F44336',
  },
  device: {
    notchStyle: 'pill',
    borderRadius: 24,
    frameColor: '#1C1B1F',
    shadowIntensity: 'light',
  },
  wallpapers: {
    homescreen: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
  },
  typography: {
    fontFamily: '"Roboto", "Noto Sans SC", "Google Sans", sans-serif',
    baseFontSize: 16,
    fontWeight: 'normal',
  },
  icons: androidIconSet,
  isBuiltin: true,
  author: '系统',
  version: '1.0.0',
}

/**
 * 深色模式主题
 * OLED 友好的纯黑背景设计
 */
export const darkTheme: Theme = {
  id: 'dark',
  name: '深色模式',
  description: 'OLED 友好的纯黑背景，护眼又省电',
  colors: {
    primary: '#0A84FF',
    secondary: '#5E5CE6',
    background: '#000000',
    surface: '#1C1C1E',
    surfaceVariant: '#2C2C2E',
    text: '#FFFFFF',
    textSecondary: '#8E8E93',
    border: '#38383A',
    success: '#30D158',
    warning: '#FF9F0A',
    error: '#FF453A',
  },
  device: {
    notchStyle: 'dynamic-island',
    borderRadius: 40,
    frameColor: '#000000',
    shadowIntensity: 'heavy',
  },
  wallpapers: {
    homescreen: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%)',
  },
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", sans-serif',
    baseFontSize: 16,
    fontWeight: 'normal',
  },
  icons: darkIconSet,
  isBuiltin: true,
  author: '系统',
  version: '1.0.0',
}

/**
 * 赛博朋克主题
 * 霓虹灯效果，充满未来感
 */
export const cyberpunkTheme: Theme = {
  id: 'cyberpunk',
  name: '赛博朋克',
  description: '霓虹灯光效果，充满未来科技感',
  colors: {
    primary: '#00F0FF',
    secondary: '#FF00FF',
    background: '#0D0D0D',
    surface: '#1A1A2E',
    surfaceVariant: '#16213E',
    text: '#00F0FF',
    textSecondary: 'rgba(0, 240, 255, 0.6)',
    border: '#FF00FF',
    success: '#00FF00',
    warning: '#FFFF00',
    error: '#FF0000',
  },
  device: {
    frameColor: '#FF00FF',
    borderRadius: 4,
    notchStyle: 'none',
    shadowIntensity: 'heavy',
  },
  wallpapers: {
    homescreen: 'linear-gradient(135deg, #0D0D0D 0%, #1A1A2E 50%, #16213E 100%)',
  },
  typography: {
    fontFamily: '"Courier New", "Fira Code", "JetBrains Mono", monospace',
    baseFontSize: 14,
    fontWeight: 'normal',
  },
  icons: {
    type: 'font',
    fontFamily: 'font-awesome',
    icons: {
      wechat: { icon: 'fab fa-weixin', bg: '#00F0FF', color: '#0D0D0D', effectClass: 'neon-glow' },
      email: { icon: 'fas fa-envelope', bg: '#FF00FF', color: '#0D0D0D', effectClass: 'neon-glow' },
      browser: { icon: 'fas fa-globe', bg: '#00F0FF', color: '#0D0D0D', effectClass: 'neon-glow' },
      live: { icon: 'fas fa-broadcast-tower', bg: '#FF0000', effectClass: 'neon-glow' },
      settings: { icon: 'fas fa-cogs', bg: '#FF00FF', color: '#0D0D0D', effectClass: 'neon-glow' },
      contacts: { icon: 'fas fa-user-friends', bg: '#00F0FF', color: '#0D0D0D', effectClass: 'neon-glow' },
      gallery: { icon: 'fas fa-images', bg: '#FFFF00', color: '#0D0D0D', effectClass: 'neon-glow' },
      notes: { icon: 'fas fa-file-alt', bg: '#00FF00', color: '#0D0D0D', effectClass: 'neon-glow' },
      prompts: { icon: 'fas fa-magic', bg: '#FF00FF', color: '#0D0D0D', effectClass: 'neon-glow' },
      tutorial: { icon: 'fas fa-book-open', bg: '#00F0FF', color: '#0D0D0D', effectClass: 'neon-glow' },
      appstore: { icon: 'fas fa-store', bg: '#00F0FF', color: '#0D0D0D', effectClass: 'neon-glow' },
      'api-manager': { icon: 'fas fa-plug', bg: '#FF00FF', color: '#0D0D0D', effectClass: 'neon-glow' },
      'pathfinder-student': { icon: 'fas fa-graduation-cap', bg: '#00FF00', color: '#0D0D0D', effectClass: 'neon-glow' },
      bridge: { icon: 'fas fa-network-wired', bg: '#FFFF00', color: '#0D0D0D', effectClass: 'neon-glow' },
    },
  },
  isBuiltin: true,
  author: '系统',
  version: '1.0.0',
}

/**
 * 复古诺基亚主题
 * 致敬经典功能机的怀旧设计
 */
export const retroTheme: Theme = {
  id: 'retro',
  name: '复古诺基亚',
  description: '致敬经典功能机的怀旧设计风格',
  colors: {
    primary: '#4A7C59',
    secondary: '#6B8E4E',
    background: '#C4CFA1',
    surface: '#9EAD86',
    surfaceVariant: '#B5C496',
    text: '#2D3A1F',
    textSecondary: '#4A5A3A',
    border: '#6B8E4E',
    success: '#4A7C59',
    warning: '#8B7355',
    error: '#8B4513',
  },
  device: {
    notchStyle: 'none',
    borderRadius: 8,
    frameColor: '#2D3A1F',
    shadowIntensity: 'none',
  },
  wallpapers: {
    homescreen: '#C4CFA1',
  },
  typography: {
    fontFamily: '"Nokia Pure Text", "Pixel", "Press Start 2P", Arial, sans-serif',
    baseFontSize: 14,
    fontWeight: 'medium',
  },
  icons: {
    type: 'font',
    fontFamily: 'font-awesome',
    icons: {
      wechat: { icon: 'fas fa-comment-dots', bg: '#4A7C59', borderRadius: '4px', effectClass: 'pixel-style' },
      email: { icon: 'fas fa-envelope', bg: '#4A7C59', borderRadius: '4px', effectClass: 'pixel-style' },
      browser: { icon: 'fas fa-globe', bg: '#4A7C59', borderRadius: '4px', effectClass: 'pixel-style' },
      live: { icon: 'fas fa-tv', bg: '#4A7C59', borderRadius: '4px', effectClass: 'pixel-style' },
      settings: { icon: 'fas fa-wrench', bg: '#4A7C59', borderRadius: '4px', effectClass: 'pixel-style' },
      contacts: { icon: 'fas fa-address-book', bg: '#4A7C59', borderRadius: '4px', effectClass: 'pixel-style' },
      gallery: { icon: 'fas fa-image', bg: '#4A7C59', borderRadius: '4px', effectClass: 'pixel-style' },
      notes: { icon: 'fas fa-sticky-note', bg: '#4A7C59', borderRadius: '4px', effectClass: 'pixel-style' },
      prompts: { icon: 'fas fa-magic', bg: '#4A7C59', borderRadius: '4px', effectClass: 'pixel-style' },
      tutorial: { icon: 'fas fa-book', bg: '#4A7C59', borderRadius: '4px', effectClass: 'pixel-style' },
      appstore: { icon: 'fas fa-store', bg: '#4A7C59', borderRadius: '4px', effectClass: 'pixel-style' },
      'api-manager': { icon: 'fas fa-plug', bg: '#4A7C59', borderRadius: '4px', effectClass: 'pixel-style' },
      'pathfinder-student': { icon: 'fas fa-graduation-cap', bg: '#4A7C59', borderRadius: '4px', effectClass: 'pixel-style' },
      bridge: { icon: 'fas fa-network-wired', bg: '#4A7C59', borderRadius: '4px', effectClass: 'pixel-style' },
    },
  },
  isBuiltin: true,
  author: '系统',
  version: '1.0.0',
}

/**
 * 糖果色主题
 * 明亮活泼的糖果色彩
 */
export const candyTheme: Theme = {
  id: 'candy',
  name: '糖果色',
  description: '明亮活泼的糖果色彩，充满活力',
  colors: {
    primary: '#FF6B9D',
    secondary: '#C44569',
    background: '#FFF5F5',
    surface: '#FFFFFF',
    surfaceVariant: '#FFE4E9',
    text: '#2D2D2D',
    textSecondary: '#666666',
    border: '#FFB6C1',
    success: '#7BD389',
    warning: '#FFD93D',
    error: '#FF6B6B',
  },
  device: {
    notchStyle: 'dynamic-island',
    borderRadius: 36,
    frameColor: '#FF6B9D',
    shadowIntensity: 'light',
  },
  wallpapers: {
    homescreen: 'linear-gradient(135deg, #FFB6C1 0%, #FFC3A0 50%, #FFECB3 100%)',
  },
  typography: {
    fontFamily: '"Nunito", "Comic Sans MS", "PingFang SC", sans-serif',
    baseFontSize: 16,
    fontWeight: 'medium',
  },
  icons: {
    type: 'font',
    fontFamily: 'font-awesome',
    icons: {
      wechat: { icon: 'fab fa-weixin', bg: 'linear-gradient(135deg, #7BD389 0%, #52C41A 100%)' },
      email: { icon: 'fas fa-envelope', bg: 'linear-gradient(135deg, #FF6B9D 0%, #FF85B3 100%)' },
      browser: { icon: 'fas fa-compass', bg: 'linear-gradient(135deg, #A78BFA 0%, #8B5CF6 100%)' },
      live: { icon: 'fas fa-video', bg: 'linear-gradient(135deg, #FF6B6B 0%, #FF5252 100%)' },
      settings: { icon: 'fas fa-cog', bg: 'linear-gradient(135deg, #B8B8B8 0%, #9E9E9E 100%)' },
      contacts: { icon: 'fas fa-address-book', bg: 'linear-gradient(135deg, #64D2FF 0%, #5AC8FA 100%)' },
      gallery: { icon: 'fas fa-images', bg: 'linear-gradient(135deg, #FFC3A0 0%, #FFAB76 100%)' },
      notes: { icon: 'fas fa-sticky-note', bg: 'linear-gradient(135deg, #FFECB3 0%, #FFD93D 100%)', color: '#2D2D2D' },
      prompts: { icon: 'fas fa-magic', bg: 'linear-gradient(135deg, #E040FB 0%, #D500F9 100%)' },
      tutorial: { icon: 'fas fa-book-open', bg: 'linear-gradient(135deg, #64D2FF 0%, #5AC8FA 100%)' },
      appstore: { icon: 'fas fa-store', bg: 'linear-gradient(135deg, #FF6B9D 0%, #FF85B3 100%)' },
      'api-manager': { icon: 'fas fa-plug', bg: 'linear-gradient(135deg, #A78BFA 0%, #8B5CF6 100%)' },
      'pathfinder-student': { icon: 'fas fa-graduation-cap', bg: 'linear-gradient(135deg, #7BD389 0%, #52C41A 100%)' },
      bridge: { icon: 'fas fa-network-wired', bg: 'linear-gradient(135deg, #FFC3A0 0%, #FFAB76 100%)' },
    },
  },
  isBuiltin: true,
  author: '系统',
  version: '1.0.0',
}

/**
 * 森林主题
 * 自然绿色调，舒适护眼
 */
export const forestTheme: Theme = {
  id: 'forest',
  name: '森林',
  description: '自然绿色调，舒适护眼的自然风格',
  colors: {
    primary: '#2E7D32',
    secondary: '#558B2F',
    background: '#F1F8E9',
    surface: '#FFFFFF',
    surfaceVariant: '#DCEDC8',
    text: '#1B5E20',
    textSecondary: '#33691E',
    border: '#A5D6A7',
    success: '#4CAF50',
    warning: '#FFC107',
    error: '#E53935',
  },
  device: {
    notchStyle: 'notch',
    borderRadius: 32,
    frameColor: '#1B5E20',
    shadowIntensity: 'medium',
  },
  wallpapers: {
    homescreen: 'linear-gradient(180deg, #81C784 0%, #4CAF50 50%, #2E7D32 100%)',
  },
  typography: {
    fontFamily: '"Lora", "Georgia", "Noto Serif SC", serif',
    baseFontSize: 16,
    fontWeight: 'normal',
  },
  icons: {
    type: 'font',
    fontFamily: 'font-awesome',
    icons: {
      wechat: { icon: 'fab fa-weixin', bg: '#4CAF50' },
      email: { icon: 'fas fa-envelope', bg: '#81C784' },
      browser: { icon: 'fas fa-compass', bg: '#558B2F' },
      live: { icon: 'fas fa-video', bg: '#E53935' },
      settings: { icon: 'fas fa-cog', bg: '#795548' },
      contacts: { icon: 'fas fa-address-book', bg: '#43A047' },
      gallery: { icon: 'fas fa-images', bg: '#9CCC65' },
      notes: { icon: 'fas fa-sticky-note', bg: '#CDDC39', color: '#1B5E20' },
      prompts: { icon: 'fas fa-magic', bg: '#7CB342' },
      tutorial: { icon: 'fas fa-book-open', bg: '#66BB6A' },
      appstore: { icon: 'fas fa-store', bg: '#43A047' },
      'api-manager': { icon: 'fas fa-plug', bg: '#558B2F' },
      'pathfinder-student': { icon: 'fas fa-graduation-cap', bg: '#66BB6A' },
      bridge: { icon: 'fas fa-network-wired', bg: '#8BC34A' },
    },
  },
  isBuiltin: true,
  author: '系统',
  version: '1.0.0',
}

/**
 * 所有预设主题集合
 */
export const presetThemes: Record<string, Theme> = {
  ios: iosTheme,
  android: androidTheme,
  dark: darkTheme,
  cyberpunk: cyberpunkTheme,
  retro: retroTheme,
  candy: candyTheme,
  forest: forestTheme,
}

/**
 * 获取所有预设主题列表
 */
export function getPresetThemeList(): Theme[] {
  return Object.values(presetThemes)
}

/**
 * 根据 ID 获取预设主题
 */
export function getPresetTheme(id: string): Theme | undefined {
  return presetThemes[id]
}

/**
 * 默认主题 ID
 */
export const DEFAULT_THEME_ID = 'ios'

/**
 * 获取默认主题
 */
export function getDefaultTheme(): Theme {
  return iosTheme
}