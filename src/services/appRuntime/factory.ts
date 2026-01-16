/**
 * App 运行时工厂
 *
 * 创建 AppRuntime 实例
 */

import type { AppSourceInfo } from '@/types/appIdentity'
import type { AppRuntime, AppIdentity } from './types'
import { createScopedStorage } from './scopedStorage'
import { createSystemAPI } from './systemAPI'
import { calculateDataNamespace } from '@/services/appIdentityService'
import type { PhoneAppPackage } from '@/types/appPackage'

/**
 * 已安装应用的简化信息
 */
export interface InstalledAppInfo {
  id: string
  name: string
  sourceInfo: AppSourceInfo
  installationId: string
}

/**
 * 创建 App 运行时实例
 */
export function createAppRuntime(app: InstalledAppInfo): AppRuntime {
  // 构建简化的包信息用于命名空间计算
  const pkg: PhoneAppPackage = {
    id: app.id,
    name: app.name,
    version: '1.0.0',
    packageVersion: '1.0',
    appType: 'configurable',
    icon: { type: 'emoji', value: '📱', background: '#f0f0f0' },
  }

  const namespace = calculateDataNamespace(pkg, app.sourceInfo, app.installationId)

  const identity: AppIdentity = {
    appId: app.id,
    appName: app.name,
    dataNamespace: namespace,
    source: app.sourceInfo,
  }

  return {
    identity,
    storage: createScopedStorage(namespace, app.id),
    system: createSystemAPI(app.id),
  }
}

/**
 * 为内置应用创建简化的运行时
 */
export function createBuiltinAppRuntime(appId: string, appName: string): AppRuntime {
  return createAppRuntime({
    id: appId,
    name: appName,
    sourceInfo: { type: 'builtin' },
    installationId: `builtin_${appId}`,
  })
}
