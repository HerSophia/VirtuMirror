import { settingsRegistry } from '@/services/settings/settingsRegistry'

export function registerBuiltinSettings() {
  // 1. 网络 (Connectivity)
  settingsRegistry.register({
    id: 'wifi',
    title: '无线局域网',
    subtitle: '未连接',
    icon: { type: 'fontawesome', value: 'fa-wifi', backgroundColor: '#007AFF', color: 'white' },
    category: 'connectivity',
    priority: 10,
    action: { type: 'click', value: () => console.log('WiFi Clicked') }
  })
  
  settingsRegistry.register({
    id: 'bluetooth',
    title: '蓝牙',
    subtitle: '开启',
    icon: { type: 'fontawesome', value: 'fa-bluetooth', backgroundColor: '#007AFF', color: 'white' },
    category: 'connectivity',
    priority: 20,
    action: { type: 'click', value: () => console.log('Bluetooth Clicked') }
  })

  // 2. 个性化 (Personalization)
  settingsRegistry.register({
    id: 'display',
    title: '显示与亮度',
    icon: { type: 'fontawesome', value: 'fa-sun', backgroundColor: '#007AFF', color: 'white' },
    category: 'personalization',
    priority: 10,
    action: { type: 'route', value: '/settings/display' }
  })

  settingsRegistry.register({
    id: 'sound',
    title: '声音与触感',
    icon: { type: 'fontawesome', value: 'fa-volume-up', backgroundColor: '#FF2D55', color: 'white' },
    category: 'personalization',
    priority: 15,
    action: { type: 'route', value: '/settings/sound' }
  })

  // 3. 应用 (Apps)
  settingsRegistry.register({
    id: 'notifications',
    title: '通知',
    icon: { type: 'fontawesome', value: 'fa-bell', backgroundColor: '#FF3B30', color: 'white' },
    category: 'apps',
    priority: 10,
    action: { type: 'route', value: '/settings/notifications' }
  })
  
  settingsRegistry.register({
    id: 'apps',
    title: '应用管理',
    icon: { type: 'fontawesome', value: 'fa-th-large', backgroundColor: '#5856D6', color: 'white' },
    category: 'apps',
    priority: 20,
    action: { type: 'route', value: '/settings/apps' }
  })

  // 4. 系统 (System)
  settingsRegistry.register({
    id: 'general',
    title: '通用',
    icon: { type: 'fontawesome', value: 'fa-cog', backgroundColor: '#8E8E93', color: 'white' },
    category: 'system',
    priority: 10,
    action: { type: 'route', value: '/settings/general' }
  })

  settingsRegistry.register({
    id: 'time',
    title: '日期与时间',
    icon: { type: 'fontawesome', value: 'fa-clock', backgroundColor: '#FF9500', color: 'white' },
    category: 'system',
    priority: 20,
    action: { type: 'route', value: '/settings/time' }
  })

  settingsRegistry.register({
    id: 'cloud',
    title: '云同步',
    icon: { type: 'fontawesome', value: 'fa-cloud', backgroundColor: '#5AC8FA', color: 'white' },
    category: 'system',
    priority: 30,
    action: { type: 'route', value: '/settings/cloud' }
  })
  
  settingsRegistry.register({
    id: 'about',
    title: '关于本机',
    icon: { type: 'fontawesome', value: 'fa-info-circle', backgroundColor: '#8E8E93', color: 'white' },
    category: 'system',
    priority: 100,
    action: { type: 'route', value: '/settings/about' }
  })
}
