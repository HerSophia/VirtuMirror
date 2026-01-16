# App 身份识别与数据隔离设计

> 解决 App 同名不同开发者、同开发者不同版本、恶意身份伪造等场景下的数据管理和安全问题

## 1. 核心问题

### 1.1 需要解决的场景

| 场景 | 示例 | 预期行为 |
|------|------|----------|
| 同名不同开发者 | 用户A的"计算器" vs 用户B的"计算器" | 数据完全隔离 |
| 同开发者版本更新 | 计算器 v1.0 → v2.0 | 数据继承，支持迁移 |
| 恶意身份伪造 | 伪装成知名开发者 | 阻止访问原应用数据 |

### 1.2 核心原则

**身份验证责任在仓库层，而非应用自证。**

就像 App Store / Google Play 一样，用户信任的是商店，商店负责审核开发者。

---

## 2. 分层信任模型

```
┌─────────────────────────────────────────────────────────────┐
│  Level 0: 内置应用                                           │
│  ══════════════════                                         │
│  • 编译时打包在代码中                                         │
│  • 完全信任，无需验证                                         │
│  • 数据命名空间: builtin/{appId}                              │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  Level 1: 官方仓库                                           │
│  ══════════════════                                         │
│  • 仓库维护者审核上架                                         │
│  • 开发者身份由仓库验证（类似 npm publish 需要登录）           │
│  • 应用包由仓库签名                                           │
│  • 数据命名空间: official/{developerId}/{appId}               │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  Level 2: 第三方仓库                                         │
│  ══════════════════                                         │
│  • 用户需先"添加仓库"并确认信任                               │
│  • 仓库有责任验证其内应用的开发者身份                         │
│  • 仓库签名 ≠ 开发者签名（仓库担保分发完整性）                 │
│  • 数据命名空间: {repoId}/{developerId}/{appId}               │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  Level 3: URL 直接导入                                       │
│  ══════════════════                                         │
│  • ⚠️ 警告用户：无法验证开发者身份                            │
│  • 首次信任 (TOFU)：记录 URL + 内容哈希                       │
│  • 再次从同 URL 更新时，验证来源一致性                        │
│  • 数据命名空间: url/{domain}/{contentHash前8位}              │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  Level 4: 本地文件导入                                       │
│  ══════════════════                                         │
│  • ⚠️ 强警告：完全由用户自行负责                              │
│  • 开发者声明仅供显示，不作为身份依据                         │
│  • 数据命名空间: local/{随机安装ID}                           │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. 类型定义

### 3.1 仓库配置

```typescript
/** 受信任的仓库 */
export interface TrustedRepository {
  /** 仓库唯一 ID */
  id: string
  
  /** 仓库显示名称 */
  name: string
  
  /** 仓库描述 */
  description?: string
  
  /** 索引文件 URL */
  indexUrl: string
  
  /** 
   * 仓库公钥（Ed25519）
   * 用于验证应用包签名
   */
  publicKey: string
  
  /** 信任级别 */
  trustLevel: 'official' | 'community' | 'custom'
  
  /** 添加时间 */
  addedAt: number
  
  /** 最后更新时间 */
  lastUpdatedAt?: number
}

/** 默认官方仓库 */
export const OFFICIAL_REPOSITORY: TrustedRepository = {
  id: 'official',
  name: '小手机官方商店',
  description: '官方维护的应用仓库',
  indexUrl: 'https://phone-sim.example.com/registry/index.json',
  publicKey: 'ed25519:xxxxxx...', // 实际部署时填入
  trustLevel: 'official',
  addedAt: 0 // 内置
}
```

### 3.2 应用来源（扩展）

```typescript
/** 应用来源类型 */
export type AppSourceType = 
  | 'builtin'    // 内置应用
  | 'repository' // 仓库安装
  | 'url'        // URL 导入
  | 'local'      // 本地文件导入

/** 应用来源详情 */
export type AppSourceInfo = 
  | { type: 'builtin' }
  | { 
      type: 'repository'
      repositoryId: string
      signature: string        // 仓库对应用包的签名
      signedAt: number
    }
  | { 
      type: 'url'
      url: string
      contentHash: string      // 首次安装时的内容哈希
      fetchedAt: number
    }
  | { 
      type: 'local'
      fileName: string
      importedAt: number
    }
```

### 3.3 仓库签名

```typescript
/** 应用包中的仓库签名 */
export interface RepositorySignature {
  /** 签名仓库 ID */
  repositoryId: string
  
  /** 
   * 签名值
   * 仓库私钥对 (appId + version + contentHash) 的 Ed25519 签名
   */
  signature: string
  
  /** 签名时间戳 */
  signedAt: number
}
```

### 3.4 扩展 PhoneAppPackage

```typescript
export interface PhoneAppPackage {
  // ... 现有字段 ...
  
  /** 
   * 数据版本号
   * - 用于数据迁移判断
   * - 仅当数据结构变化时递增
   * - 默认为 1
   */
  dataVersion?: number
  
  /** 
   * 数据迁移配置
   * - 键为 "fromVersion:toVersion"
   * - 值为迁移动作数组
   */
  dataMigrations?: Record<string, DataMigrationAction[]>
  
  /** 仓库签名（仓库分发时附加） */
  repositorySignature?: RepositorySignature
}

/** 数据迁移动作 */
export type DataMigrationAction =
  | { type: 'rename'; from: string; to: string }
  | { type: 'transform'; field: string; transformer: string }
  | { type: 'delete'; fields: string[] }
  | { type: 'merge'; source: string[]; target: string }
  | { type: 'setDefault'; field: string; value: unknown }
```

### 3.5 扩展 InstalledApp

```typescript
export interface InstalledApp {
  // ... 现有字段 ...
  
  /** 应用来源详情 */
  sourceInfo: AppSourceInfo
  
  /** 
   * 安装 ID（随机生成）
   * - 用于本地导入应用的数据隔离
   */
  installationId: string
  
  /** 数据命名空间（计算得出） */
  dataNamespace: string
  
  /** 当前数据版本 */
  currentDataVersion: number
  
  /** 数据迁移历史 */
  migrationHistory?: MigrationRecord[]
  
  /** 验证状态 */
  verificationStatus: VerificationStatus
}

/** 迁移记录 */
export interface MigrationRecord {
  fromVersion: number
  toVersion: number
  migratedAt: string
  success: boolean
  error?: string
}

/** 验证状态 */
export interface VerificationStatus {
  /** 是否已验证 */
  verified: boolean
  
  /** 信任级别 */
  trustLevel: 'full' | 'repository' | 'tofu' | 'untrusted'
  
  /** 担保方（仓库名称） */
  guaranteedBy?: string
  
  /** 警告信息 */
  warnings?: string[]
}
```

---

## 4. 数据命名空间

### 4.1 计算规则

```typescript
function calculateDataNamespace(app: InstalledApp): string {
  const pkg = app.package
  const source = app.sourceInfo
  
  switch (source.type) {
    case 'builtin':
      // 内置应用：直接用 appId
      return `builtin/${pkg.id}`
    
    case 'repository':
      // 仓库应用：仓库担保身份，可信任 developerId
      const developerId = pkg.author?.id ?? pkg.author?.name ?? 'unknown'
      return `repo/${source.repositoryId}/${developerId}/${pkg.id}`
    
    case 'url':
      // URL 导入：用域名 + 内容哈希（TOFU）
      const domain = new URL(source.url).hostname
      const hash = source.contentHash.substring(0, 8)
      return `url/${domain}/${hash}`
    
    case 'local':
      // 本地导入：用随机安装 ID 完全隔离
      return `local/${app.installationId}`
  }
}
```

### 4.2 隔离效果示例

```
场景：多个"计算器"应用

1. 内置计算器
   命名空间: builtin/calculator

2. 官方商店的"超级计算器"（开发者: calc-team）
   命名空间: repo/official/calc-team/super-calculator

3. 社区仓库的"计算器"（开发者: community-dev）
   命名空间: repo/community/community-dev/calculator

4. 从 example.com 导入的"计算器"
   命名空间: url/example.com/a1b2c3d4

5. 本地导入的"计算器"
   命名空间: local/inst_x7y8z9

→ 5 个应用，5 个独立的数据空间，互不干扰
```

---

## 5. 安装验证流程

### 5.1 验证函数

```typescript
async function verifyAndInstall(
  pkg: PhoneAppPackage, 
  source: AppSourceInfo
): Promise<InstallVerificationResult> {
  
  // Level 0: 内置应用
  if (source.type === 'builtin') {
    return { 
      verified: true, 
      trustLevel: 'full',
      canInstall: true
    }
  }
  
  // Level 1-2: 仓库来源
  if (source.type === 'repository') {
    const repo = getTrustedRepository(source.repositoryId)
    if (!repo) {
      return { 
        verified: false, 
        trustLevel: 'untrusted',
        canInstall: false,
        error: '未知仓库，请先添加该仓库' 
      }
    }
    
    // 验证仓库签名
    const signatureValid = await verifyEd25519Signature(
      getSignableContent(pkg),
      source.signature,
      repo.publicKey
    )
    
    if (!signatureValid) {
      return { 
        verified: false, 
        trustLevel: 'untrusted',
        canInstall: false,
        error: '应用签名验证失败，可能已被篡改' 
      }
    }
    
    return { 
      verified: true, 
      trustLevel: 'repository',
      guaranteedBy: repo.name,
      canInstall: true
    }
  }
  
  // Level 3: URL 导入
  if (source.type === 'url') {
    return {
      verified: false,
      trustLevel: 'tofu',
      canInstall: true,  // 允许安装，但需警告
      warnings: [
        '无法验证开发者身份',
        '任何人都可以在应用中声称任意开发者名称',
        '请仅安装来自您信任的 URL'
      ],
      tofu: {
        url: source.url,
        contentHash: calculateContentHash(pkg)
      }
    }
  }
  
  // Level 4: 本地导入
  if (source.type === 'local') {
    return {
      verified: false,
      trustLevel: 'untrusted',
      canInstall: true,  // 允许安装，但需强警告
      warnings: [
        '无法验证开发者身份',
        '无法验证应用来源',
        '无法验证应用完整性',
        '该应用数据将完全独立存储'
      ]
    }
  }
}

/** 获取用于签名的内容 */
function getSignableContent(pkg: PhoneAppPackage): string {
  return JSON.stringify({
    id: pkg.id,
    version: pkg.version,
    name: pkg.name,
    appType: pkg.appType
  })
}
```

### 5.2 更新时的额外验证

```typescript
async function verifyUpdate(
  installed: InstalledApp,
  newPkg: PhoneAppPackage,
  newSource: AppSourceInfo
): Promise<UpdateVerificationResult> {
  
  const oldSource = installed.sourceInfo
  
  // 检查来源一致性
  if (oldSource.type !== newSource.type) {
    return {
      allowed: false,
      reason: '更新来源类型与原安装不符',
      suggestion: '请卸载后重新安装'
    }
  }
  
  // 仓库应用：必须来自同一仓库
  if (oldSource.type === 'repository' && newSource.type === 'repository') {
    if (oldSource.repositoryId !== newSource.repositoryId) {
      return {
        allowed: false,
        reason: '更新来自不同仓库',
        suggestion: '请从原仓库获取更新'
      }
    }
  }
  
  // URL 应用：必须来自同一 URL（TOFU）
  if (oldSource.type === 'url' && newSource.type === 'url') {
    if (oldSource.url !== newSource.url) {
      return {
        allowed: false,
        reason: '更新 URL 与原安装不符',
        warning: '这可能是尝试劫持应用数据的攻击'
      }
    }
  }
  
  // 通过基本检查，继续数据迁移检查
  return {
    allowed: true,
    dataMigration: checkDataMigration(installed, newPkg)
  }
}
```

---

## 6. 数据迁移

### 6.1 迁移时机

当 `dataVersion` 变化时触发迁移：

```typescript
interface DataMigrationCheck {
  needed: boolean
  fromVersion: number
  toVersion: number
  migrations: DataMigrationAction[]
}

function checkDataMigration(
  installed: InstalledApp,
  newPkg: PhoneAppPackage
): DataMigrationCheck {
  const oldVersion = installed.currentDataVersion
  const newVersion = newPkg.dataVersion ?? 1
  
  if (newVersion <= oldVersion) {
    return { needed: false, fromVersion: oldVersion, toVersion: newVersion, migrations: [] }
  }
  
  // 收集所有需要执行的迁移
  const allMigrations: DataMigrationAction[] = []
  const migrationDefs = newPkg.dataMigrations ?? {}
  
  for (let v = oldVersion; v < newVersion; v++) {
    const key = `${v}:${v + 1}`
    const actions = migrationDefs[key] ?? []
    allMigrations.push(...actions)
  }
  
  return {
    needed: true,
    fromVersion: oldVersion,
    toVersion: newVersion,
    migrations: allMigrations
  }
}
```

### 6.2 迁移执行

```typescript
async function executeDataMigration(
  namespace: string,
  migrations: DataMigrationAction[]
): Promise<MigrationResult> {
  const dataService = new AppDataService(namespace)
  
  try {
    for (const action of migrations) {
      switch (action.type) {
        case 'rename':
          const value = await dataService.get(action.from)
          if (value !== undefined) {
            await dataService.set(action.to, value)
            await dataService.delete(action.from)
          }
          break
          
        case 'delete':
          for (const field of action.fields) {
            await dataService.delete(field)
          }
          break
          
        case 'setDefault':
          const existing = await dataService.get(action.field)
          if (existing === undefined) {
            await dataService.set(action.field, action.value)
          }
          break
          
        case 'merge':
          const sources = await Promise.all(
            action.source.map(s => dataService.get(s))
          )
          const merged = Object.assign({}, ...sources.filter(Boolean))
          await dataService.set(action.target, merged)
          for (const s of action.source) {
            await dataService.delete(s)
          }
          break
          
        case 'transform':
          // 预定义的转换器
          const transformers: Record<string, (v: unknown) => unknown> = {
            'intToFloat': (v) => typeof v === 'number' ? v : parseFloat(String(v)),
            'stringToArray': (v) => typeof v === 'string' ? v.split(',') : v,
            'boolToInt': (v) => v ? 1 : 0
          }
          const transformer = transformers[action.transformer]
          if (transformer) {
            const oldVal = await dataService.get(action.field)
            if (oldVal !== undefined) {
              await dataService.set(action.field, transformer(oldVal))
            }
          }
          break
      }
    }
    
    return { success: true }
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '迁移失败' 
    }
  }
}
```

---

## 7. 存储层设计

### 7.1 IndexedDB Schema

```typescript
// 扩展 PhoneDatabase
export class PhoneDatabase extends Dexie {
  // ... 现有表 ...
  
  // 应用数据表（新增）
  appData!: Table<AppDataRecord>
  
  // 受信任仓库表（新增）
  trustedRepositories!: Table<TrustedRepository>
  
  constructor() {
    super('PhoneSimulator')
    
    this.version(2).stores({
      // ... 现有表 ...
      
      // 应用数据：按命名空间隔离
      appData: '[namespace+key], namespace, updatedAt',
      
      // 受信任仓库
      trustedRepositories: 'id, trustLevel, addedAt'
    })
  }
}

/** 应用数据记录 */
export interface AppDataRecord {
  /** 数据命名空间 */
  namespace: string
  
  /** 数据键 */
  key: string
  
  /** 数据值 */
  value: unknown
  
  /** 数据版本 */
  version: number
  
  /** 更新时间 */
  updatedAt: number
}
```

### 7.2 数据服务封装

```typescript
export class AppDataService {
  constructor(private namespace: string) {}
  
  async get<T>(key: string): Promise<T | undefined> {
    const record = await db.appData.get([this.namespace, key])
    return record?.value as T
  }
  
  async set<T>(key: string, value: T): Promise<void> {
    await db.appData.put({
      namespace: this.namespace,
      key,
      value,
      version: 1,
      updatedAt: Date.now()
    })
  }
  
  async delete(key: string): Promise<void> {
    await db.appData.delete([this.namespace, key])
  }
  
  async list(): Promise<string[]> {
    const records = await db.appData
      .where('namespace')
      .equals(this.namespace)
      .toArray()
    return records.map(r => r.key)
  }
  
  async clear(): Promise<void> {
    await db.appData
      .where('namespace')
      .equals(this.namespace)
      .delete()
  }
  
  async getAll(): Promise<Record<string, unknown>> {
    const records = await db.appData
      .where('namespace')
      .equals(this.namespace)
      .toArray()
    return Object.fromEntries(records.map(r => [r.key, r.value]))
  }
}
```

---

## 8. 用户界面提示

### 8.1 安装仓库应用（已验证）

```
┌─────────────────────────────────────────┐
│  📦 安装应用                             │
├─────────────────────────────────────────┤
│  🧮 高级计算器                           │
│  版本 2.0.0                              │
│                                         │
│  开发者: calculator-dev                  │
│  来源: 小手机官方商店                     │
│                                         │
│  ✅ 开发者身份已由官方商店验证            │
│                                         │
│  所需权限:                               │
│  • 📁 存储 - 读写应用数据                 │
│                                         │
│  [取消]              [安装]              │
└─────────────────────────────────────────┘
```

### 8.2 安装 URL 导入应用（警告）

```
┌─────────────────────────────────────────┐
│  ⚠️ 安装未验证应用                       │
├─────────────────────────────────────────┤
│  🧮 神奇计算器                           │
│  版本 1.0.0                              │
│                                         │
│  声称开发者: super-dev                   │
│  来源: https://example.com/app.json     │
│                                         │
│  ⚠️ 警告:                                │
│  • 无法验证开发者身份真实性               │
│  • 任何人都可以声称是 "super-dev"        │
│  • 请仅安装您信任的来源                  │
│                                         │
│  [取消]      [我了解风险，继续安装]       │
└─────────────────────────────────────────┘
```

### 8.3 安装本地文件（强警告）

```
┌─────────────────────────────────────────┐
│  🔴 安装本地应用                         │
├─────────────────────────────────────────┤
│  📁 my-app.json                         │
│                                         │
│  ❌ 无法验证:                            │
│  • 开发者身份                            │
│  • 应用来源                              │
│  • 应用完整性                            │
│                                         │
│  该应用数据将独立存储，不会与其他         │
│  同名应用共享或冲突。                    │
│                                         │
│  [取消]      [我信任此文件，继续安装]     │
└─────────────────────────────────────────┘
```

### 8.4 同名应用提示

```
┌─────────────────────────────────────────┐
│  ℹ️ 发现同名应用                         │
├─────────────────────────────────────────┤
│  您已安装了另一个 "计算器" 应用。         │
│                                         │
│  已安装:                                 │
│    开发者: official-team                 │
│    来源: 官方商店 ✅                      │
│                                         │
│  待安装:                                 │
│    开发者: community-user                │
│    来源: 社区仓库 ✅                      │
│                                         │
│  两个应用将独立运行，数据互不影响。       │
│                                         │
│  [取消]              [同时保留两个]       │
└─────────────────────────────────────────┘
```

### 8.5 更新来源不匹配

```
┌─────────────────────────────────────────┐
│  🚫 无法更新                             │
├─────────────────────────────────────────┤
│  更新来源与原安装不符。                   │
│                                         │
│  原安装来源:                             │
│    https://trusted-site.com/app.json    │
│                                         │
│  更新来源:                               │
│    https://suspicious-site.com/app.json │
│                                         │
│  ⚠️ 这可能是尝试劫持应用数据的攻击。      │
│                                         │
│  如需使用新来源的应用，请先卸载           │
│  现有应用，再重新安装。                   │
│                                         │
│  [知道了]                                │
└─────────────────────────────────────────┘
```

---

## 9. 总结

### 9.1 安全保障矩阵

| 来源类型 | 身份验证 | 数据隔离依据 | 更新验证 | 用户提示 |
|----------|----------|--------------|----------|----------|
| 内置 | ✅ 编译保证 | `appId` | N/A | 无 |
| 官方仓库 | ✅ 仓库签名 | `仓库/开发者/appId` | 仓库一致 | ✓ 已验证 |
| 第三方仓库 | ✅ 仓库签名 | `仓库/开发者/appId` | 仓库一致 | ✓ 已验证 |
| URL 导入 | ⚠️ TOFU | `域名/内容哈希` | URL 一致 | ⚠️ 警告 |
| 本地文件 | ❌ 无 | `随机安装ID` | 不允许 | 🔴 强警告 |

### 9.2 关键设计决策

1. **身份验证在仓库层** - 用户信任仓库，仓库负责审核开发者
2. **签名用于防篡改** - 验证应用包在传输中未被修改
3. **TOFU 用于 URL 导入** - 首次信任，后续验证一致性
4. **随机 ID 隔离本地应用** - 完全隔离，防止任何数据访问
5. **数据版本独立于代码版本** - 仅数据结构变化时迁移

---

## 10. 实现路线图

### Phase 1: 基础数据隔离 ✅
- [x] 扩展 `InstalledApp` 类型定义 (`src/types/appPackage.ts`)
- [x] 实现 `calculateDataNamespace` 函数 (`src/services/appIdentityService.ts`)
- [x] 创建 `AppDataService` 封装 (`src/services/appDataService.ts`)
- [x] 扩展 IndexedDB schema (`src/services/database/schema.ts`)

### Phase 2: 仓库信任机制 ✅
- [x] 实现 `TrustedRepository` 管理 (`src/services/appIdentityService.ts`)
- [x] 集成 Ed25519 签名验证 (简化实现，需要后续完善)
- [x] 实现安装时验证流程 (`verifyAndInstall`)

### Phase 3: 版本迁移 ✅
- [x] 实现 `dataVersion` 支持
- [x] 实现迁移执行器 (`executeDataMigration`)
- [x] 添加迁移历史记录 (`createMigrationRecord`)

### Phase 3.5: Store 集成 ✅
- [x] 更新 `appStoreStore.ts` 使用 `InstalledAppExtended` 类型
- [x] 集成 `installApp` 方法的身份验证流程
- [x] 集成 `importFromFile` 方法（本地导入警告）
- [x] 集成 `importFromUrl` 方法（TOFU 验证）
- [x] 集成 `updateApp` 方法的来源验证和数据迁移

### Phase 4: 用户界面
- [ ] 验证状态显示组件
- [ ] 安装警告对话框（URL/本地导入时显示）
- [ ] 同名应用处理对话框
- [ ] 更新来源不匹配提示
- [ ] 应用详情页显示信任级别
