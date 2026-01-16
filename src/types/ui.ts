/**
 * UI相关类型定义
 */

/** 视图名称枚举 */
export type ViewName = 
  | 'HomeScreen'
  | 'ChatList'
  | 'ChatConversation'
  | 'ContactList'
  | 'Profile'
  | 'Homepage'
  | 'VoiceCall'
  | 'PhoneCall'
  | 'GroupMembers'
  | 'GroupInvite'
  | 'EmailList'
  | 'EmailDetail'
  | 'Browser'
  | 'ForumBoardList'
  | 'ForumPostList'
  | 'ForumPostDetail'
  | 'LiveCenter'
  | 'LiveStreamList'
  | 'LiveStreamRoom'
  | 'Creation'
  | 'Settings'
  | 'Wallet'
  | 'Gallery'
  | 'AppStore'
  | 'Calendar'
  | 'Clock'
  | 'Weather'
  | 'Notes'
  | 'Files'
  | 'Calculator'
  | 'Camera'
  | string

/** 子视图名称枚举 */
export type SubViewName = 
  | 'messages'
  | 'contacts'
  | 'moments'
  | 'dialer'
  | 'recents'
  | 'settings'
  | string

/** UI位置信息 */
export interface UIPosition {
  x: number
  y: number
  scale: number
}

/** UI自定义设置 */
export interface UICustomization {
  enabled: boolean
  playerNickname: string
  playerAvatar?: string
  homescreenWallpaper?: string
  chatlistWallpaper?: string
  chatviewWallpaper?: string
  muted: boolean
  theme?: string
  fontSize?: 'small' | 'medium' | 'large'
  [key: string]: any
}
