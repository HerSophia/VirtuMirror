/**
 * Mock联系人数据
 * 用于开发环境测试
 */

import type { Contact, ContactDirectory } from '@/types'

export const mockContactData: ContactDirectory = {
  '小明': {
    id: '小明',
    name: '小明',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=xiaoming',
    type: 'private',
    phone: '13800138001',
    signature: '好好学习，天天向上',
    online: true,
    unreadCount: 2,
    lastMessageTime: Date.now() - 1000 * 60 * 5,
  },
  '小红': {
    id: '小红',
    name: '小红',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=xiaohong',
    type: 'private',
    phone: '13800138002',
    signature: '生活要有仪式感✨',
    online: true,
    unreadCount: 0,
    lastMessageTime: Date.now() - 1000 * 60 * 20,
  },
  '小李': {
    id: '小李',
    name: '小李',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=xiaoli',
    type: 'private',
    phone: '13800138003',
    signature: '代码改变世界',
    online: false,
    unreadCount: 0,
    lastMessageTime: Date.now() - 1000 * 60 * 60,
  },
  '小王': {
    id: '小王',
    name: '小王',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=xiaowang',
    type: 'private',
    phone: '13800138004',
    signature: '',
    online: false,
    unreadCount: 1,
    lastMessageTime: Date.now() - 1000 * 60 * 30,
  },
  '妈妈': {
    id: '妈妈',
    name: '妈妈',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=mama',
    type: 'private',
    phone: '13800138005',
    signature: '儿行千里母担忧',
    online: true,
    unreadCount: 0,
    lastMessageTime: Date.now() - 1000 * 60 * 60 * 2,
  },
  '学习群': {
    id: '学习群',
    name: '学习群',
    avatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=studygroup',
    type: 'group',
    members: ['小明', '小红', '小李', '小王', 'PLAYER_USER'],
    unreadCount: 3,
    lastMessageTime: Date.now() - 1000 * 60 * 10,
  },
  '班级群': {
    id: '班级群',
    name: '2024级1班',
    avatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=classgroup',
    type: 'group',
    members: ['小明', '小红', '小李', '小王', 'PLAYER_USER'],
    unreadCount: 0,
    lastMessageTime: Date.now() - 1000 * 60 * 60 * 24,
  },
}

/**
 * 获取联系人头像URL
 * 如果没有设置头像，返回默认头像
 */
export function getContactAvatar(contact: Contact): string {
  if (contact.avatar) {
    return contact.avatar
  }
  // 使用DiceBear生成默认头像
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(contact.id)}`
}

/**
 * 获取联系人显示名称
 * 优先使用备注名
 */
export function getContactDisplayName(contact: Contact): string {
  return contact.remark || contact.name
}