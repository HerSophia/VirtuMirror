# 身份服务 (IdentityService)

> 提供应用身份验证、命名空间计算、安装验证等功能

## 概述

`identityService` 是 AppRuntime 模块的内部服务，提供应用身份相关的核心功能。这些功能在创建 AppRuntime 时被调用，确保每个应用获得正确的数据隔离。

**源文件**：`src/services/appRuntime/identityService.ts`

## 核心功能

### 1. 命名空间计算

根据应用来源计算数据隔离的命名空间：

```typescript
function calculateDataNamespace(
  pkg: PhoneAppPackage,
  sourceInfo: AppSourceInfo,
  installationId: string
): string
```

**命名空间规则**：

| 来源类型 | 格式 | 示例 |
| -------- | ---- | ---- |
| 内置应用 | `builtin/{appId}` | `builtin/calculator` |
| 商店应用 | `repo/{repoId}/{developerId}/{appId}` | `repo/official/dev1/notes` |
| URL 导入 | `url/{domain}/{hash}` | `url/example.com/a1b2c3d4` |
| 本地导入 | `local/{installationId}` | `local/inst_xyz12345` |

### 2. 安装验证

验证应用安装的合法性和信任级别：

```typescript
async function verifyAndInstall(
  pkg: PhoneAppPackage,
  source: AppSourceInfo
): Promise<InstallVerificationResult>
```

**信任级别**：

| 级别 | 来源 | 说明 |
| ---- | ---- | ---- |
| `full` | 内置应用 | 完全信任 |
| `repository` | 商店应用 | 仓库担保 |
| `tofu` | URL 导入 | 首次使用信任 |
| `untrusted` | 本地导入 | 不可信 |

### 3. 更新验证

验证应用更新的来源一致性：

```typescript
async function verifyUpdate(
  installed: InstalledAppExtended,
  newPkg: PhoneAppPackage,
  newSource: AppSourceInfo
): Promise<UpdateVerificationResult>
```

**验证规则**：
- 来源类型必须一致
- 仓库应用必须来自同一仓库
- URL 应用必须来自同一 URL
- 本地应用不支持更新

### 4. 数据迁移

处理应用版本升级时的数据迁移：

```typescript
function checkDataMigration(
  installed: InstalledAppExtended,
  newPkg: PhoneAppPackage
): DataMigrationCheck

async function executeDataMigration(
  namespace: string,
  migrations: DataMigrationAction[]
): Promise<MigrationResult>
```

**支持的迁移操作**：

| 类型 | 说明 |
| ---- | ---- |
| `rename` | 重命名字段 |
| `delete` | 删除字段 |
| `setDefault` | 设置默认值 |
| `merge` | 合并多个字段 |
| `transform` | 数据转换 |

## 受信任仓库服务

管理受信任的应用仓库：

```typescript
class TrustedRepositoryService {
  async initialize(): Promise<void>
  async getAll(): Promise<TrustedRepository[]>
  async getEnabled(): Promise<TrustedRepository[]>
  async getById(id: string): Promise<TrustedRepository | undefined>
  async add(repo: TrustedRepository): Promise<void>
  async update(id: string, updates: Partial<TrustedRepository>): Promise<void>
  async delete(id: string): Promise<boolean>
  async toggleEnabled(id: string): Promise<void>
}

// 单例实例
export const trustedRepositoryService: TrustedRepositoryService
```

## 导出的 API

从 `@/services/appRuntime` 导出：

```typescript
// 命名空间计算
export { calculateDataNamespace } from './identityService'

// 验证功能
export { verifyAndInstall, verifyUpdate } from './identityService'

// 仓库服务
export { TrustedRepositoryService, trustedRepositoryService } from './identityService'

// 数据迁移
export {
  checkDataMigration,
  executeDataMigration,
  createMigrationRecord,
} from './identityService'

// 验证状态
export { createVerificationStatus } from './identityService'
```

## 与其他模块的关系

```
┌─────────────────────────────────────────────────────────┐
│                    factory.ts                           │
│              createAppRuntime()                         │
└──────────────────────┬──────────────────────────────────┘
                       │ 调用
                       ▼
┌─────────────────────────────────────────────────────────┐
│                identityService.ts                       │
│                                                         │
│  calculateDataNamespace() ──────────────┐               │
│                                         │               │
│  verifyAndInstall() ───┐                │               │
│                        │                │               │
│  executeDataMigration()│                │               │
│          │             │                │               │
│          ▼             ▼                ▼               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │dataService  │  │trustedRepo  │  │ namespace   │     │
│  │  .ts        │  │  Service    │  │  string     │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
└─────────────────────────────────────────────────────────┘
```

## 使用示例

### 计算命名空间

```typescript
import { calculateDataNamespace } from '@/services/appRuntime'

const namespace = calculateDataNamespace(
  { id: 'my-app', name: 'My App', ... },
  { type: 'builtin' },
  'inst_123'
)
// 返回: "builtin/my-app"
```

### 验证安装

```typescript
import { verifyAndInstall } from '@/services/appRuntime'

const result = await verifyAndInstall(pkg, { type: 'repository', repositoryId: 'official' })

if (result.canInstall) {
  console.log('可以安装，信任级别:', result.trustLevel)
} else {
  console.error('无法安装:', result.error)
}
```

### 管理仓库

```typescript
import { trustedRepositoryService } from '@/services/appRuntime'

// 获取所有仓库
const repos = await trustedRepositoryService.getAll()

// 添加新仓库
await trustedRepositoryService.add({
  id: 'my-repo',
  name: '我的仓库',
  url: 'https://my-repo.example.com',
  publicKey: '...',
  enabled: true,
  official: false,
})
```

## 相关文档

- [AppRuntime 概述](./README.md)
- [隔离存储](./scoped-storage.md)
- [应用身份识别设计](../../dev/app-identity-design.md)
- [数据隔离设计](../../dev/Security/data-isolation.md)
