# 架构设计

## 分层架构

```text
┌─────────────────────────────────────────────────────────────────────┐
│                           UI Layer                                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐      │
│  │ AccountManager  │  │ Weibo App       │  │ Other Apps      │      │
│  │ App             │  │                 │  │                 │      │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘      │
└───────────┼─────────────────────┼─────────────────────┼──────────────┘
            │                     │                     │
            └─────────────────────┼─────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          Store Layer                                 │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                      AccountStore (Pinia)                      │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │  │
│  │  │ State       │  │ Getters     │  │ Actions     │            │  │
│  │  │ - entities  │  │ - current   │  │ - initialize│            │  │
│  │  │ - accounts  │  │   Player    │  │ - ensure    │            │  │
│  │  │ - context   │  │ - visible   │  │   Account   │            │  │
│  │  │ - playerId  │  │   Accounts  │  │ - switch    │            │  │
│  │  │ - loading   │  │ - contacts  │  │   Session   │            │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘            │  │
│  └───────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Service Layer                                │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                      AccountService                            │  │
│  │                        (Singleton)                             │  │
│  │                                                                │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │  │
│  │  │ Entity      │  │ Account     │  │ Relation    │            │  │
│  │  │ Management  │  │ Management  │  │ Management  │            │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘            │  │
│  │                                                                │  │
│  │  ┌─────────────────────────────────────────────────┐          │  │
│  │  │          Scope Validation & Visibility          │          │  │
│  │  └─────────────────────────────────────────────────┘          │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌─────────────────┐                                                │
│  │ UserPool        │  随机用户生成器（纯生成，不负责存储）            │
│  │ (Singleton)     │                                                │
│  └─────────────────┘                                                │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       Infrastructure Layer                           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐      │
│  │ Database (Dexie)│  │ Session Context │  │ Bridge Adapter  │      │
│  │ - entities      │  │ (内部管理)       │  │ (事件来源)       │      │
│  │ - accounts      │  │                 │  │ - chat_changed  │      │
│  │ - relations     │  │                 │  │ - full_sync     │      │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 核心组件

| 组件                    | 职责                                       | 类型     | 文件位置                           |
| ----------------------- | ------------------------------------------ | -------- | ---------------------------------- |
| `AccountService`        | 服务入口，实体/账号/关系的 CRUD            | 单例     | `src/services/account/accountService.ts` |
| `AccountStore`          | 响应式状态管理，自动监听会话切换           | Store    | `src/stores/accountStore.ts`       |
| `UserPool`              | 随机用户生成器，支持完整画像生成           | 单例     | `src/services/account/userPool.ts` |
| `CreateAccountDialog`   | 通用账号创建弹窗组件                       | 组件     | `src/components/common/`           |
| `AccountCard`           | 账号卡片展示组件                           | 组件     | `src/apps/account-manager/components/` |

---

## 目录结构

### 服务层

```text
src/services/account/
├── index.ts                    # 统一导出 accountService, userPool
├── accountService.ts           # 核心服务实现 (AccountService 类)
├── userPool.ts                 # 随机用户生成器 (UserPool 类)
└── migrateSocialAccounts.ts    # 数据迁移工具
```

### Store 层

```text
src/stores/
└── accountStore.ts             # Pinia Store（响应式 + 事件监听）
```

### 类型定义

```text
src/types/
└── account.ts                  # 类型定义（包含用户画像扩展类型）
```

### UI 组件

```text
src/components/common/
└── CreateAccountDialog.vue     # 账号创建弹窗

src/apps/account-manager/
├── AccountManagerApp.vue       # 账号管理 App 主界面
└── components/
    └── AccountCard.vue         # 账号卡片组件
```

---

## AccountService 内部结构

```typescript
export class AccountService {
  private static instance: AccountService;
  private currentContext: SessionContext | null = null;
  
  // ==================== 会话上下文 ====================
  setSessionContext(context: SessionContext): void;
  getSessionContext(): SessionContext | null;
  private requireContext(): SessionContext;
  
  // ==================== 作用域验证 ====================
  validateAccountScope(entityScope: EntityScope, accountScope: AccountScope): boolean;
  isEntityVisible(entity: CharacterEntity, context?: SessionContext): boolean;
  isAccountVisible(account: PlatformAccount, entity: CharacterEntity, context?: SessionContext): boolean;
  
  // ==================== 实体管理 ====================
  private inferEntityScope(data: CreateEntityInput): { scope, scopeSessionId?, scopeCharacterCardId? };
  createEntity(data: CreateEntityInput): Promise<CharacterEntity>;
  getEntity(id: string): Promise<CharacterEntity | null>;
  updateEntity(id: string, data: Partial<CharacterEntity>): Promise<CharacterEntity>;
  deleteEntity(id: string): Promise<void>;  // 级联删除
  getVisibleEntities(context?: SessionContext): Promise<CharacterEntity[]>;
  searchEntities(query: string, options?: SearchOptions): Promise<CharacterEntity[]>;
  getAllEntities(options?: QueryOptions): Promise<CharacterEntity[]>;
  getEntitiesByType(type: EntityType, options?: QueryOptions): Promise<CharacterEntity[]>;
  getPlayerEntity(): Promise<CharacterEntity | null>;
  getOrCreatePlayerEntity(playerName: string): Promise<CharacterEntity>;
  
  // ==================== 平台账号管理 ====================
  private inferAccountScope(entity, data): { scope, scopeSessionId?, scopeCharacterCardId? };
  createPlatformAccount(entityId, platformId, data): Promise<PlatformAccount>;
  getPlatformAccount(id: string): Promise<PlatformAccount | null>;
  findAccountByHandle(platformId: string, handle: string): Promise<PlatformAccount | null>;
  getAccountsByEntity(entityId: string): Promise<PlatformAccount[]>;
  getVisibleAccounts(platformId: string, context?: SessionContext): Promise<PlatformAccount[]>;
  findPlayerAccountForContext(platformId: string, context?: SessionContext): Promise<PlatformAccount | null>;
  getPlayerAllAccounts(): Promise<PlatformAccount[]>;
  checkMissingPlayerAccount(platformId: string): Promise<MissingAccountInfo | null>;
  getAccountsByPlatform(platformId: string, options?: QueryOptions): Promise<PlatformAccount[]>;
  getRandomAccountForPlatform(platformId: string): Promise<PlatformAccount | null>;
  updatePlatformAccount(id: string, data: Partial<PlatformAccount>): Promise<PlatformAccount>;
  deletePlatformAccount(id: string): Promise<void>;
  
  // ==================== 社交关系管理（基于账号）====================
  followAccount(fromAccountId: string, toAccountId: string): Promise<SocialRelation>;
  unfollowAccount(fromAccountId: string, toAccountId: string): Promise<void>;
  addFriendAccounts(accountIdA: string, accountIdB: string): Promise<void>;  // 双向
  removeFriendAccounts(accountIdA: string, accountIdB: string): Promise<void>;
  getFollowingAccounts(accountId: string): Promise<PlatformAccount[]>;
  getFollowerAccounts(accountId: string): Promise<PlatformAccount[]>;
  getFriendAccounts(accountId: string): Promise<PlatformAccount[]>;
  hasAccountRelation(fromAccountId, toAccountId, type: RelationType): Promise<boolean>;
  private findAccountRelation(fromAccountId, toAccountId, type): Promise<SocialRelation | null>;
  
  // ==================== 便捷方法 ====================
  getFullProfile(accountId: string): Promise<FullProfile | null>;
  getFullProfileByEntityAndPlatform(entityId, platformId): Promise<FullProfile | null>;
  syncFromCharacterCard(cardId, cardData): Promise<CharacterEntity>;
  getStats(): Promise<{ totalEntities, totalAccounts, totalRelations, ... }>;
}
```

---

## AccountStore 内部结构

```typescript
export const useAccountStore = defineStore('account', () => {
  // === 状态 ===
  const sessionContext = ref<SessionContext | null>(null);
  const entities = ref<Map<string, CharacterEntity>>(new Map());
  const accounts = ref<Map<string, PlatformAccount>>(new Map());
  const currentPlayerId = ref<string | null>(null);
  const isLoading = ref(false);
  const isInitialized = ref(false);
  const eventUnsubscribers = ref<(() => void)[]>([]);
  
  // === Getters ===
  const currentPlayer = computed(...);
  const visibleEntities = computed(...);
  const visibleAccountsByPlatform = computed(...);
  const chatContacts = computed(...);
  const entityList = computed(...);
  const npcEntities = computed(...);
  
  // === 会话上下文自动管理 ===
  function getSessionContextFromBridge(): SessionContext;
  function setupEventListeners(): void;  // 监听 chat_changed, full_sync 等
  function cleanupEventListeners(): void;
  
  // === Actions ===
  async function initialize(playerName, context?): Promise<void>;
  async function switchSession(context): Promise<void>;
  async function refreshVisibleData(): Promise<void>;
  // ... 其他 CRUD actions
  function cleanup(): void;
  function reset(): void;
});
```

---

## UserPool 内部结构

```typescript
export class UserPool {
  private static instance: UserPool;
  
  // === 基础生成 ===
  generateRandomProfile(context?: GenerationContext): GeneratedProfile;
  randomName(gender?: Gender): string;
  randomGender(): Gender;
  randomAvatar(): string;
  randomBio(context?: GenerationContext): string;
  generateHandle(name: string, platform: string): string;
  generateBatch(count: number, context?): GeneratedProfile[];
  
  // === 完整画像生成 ===
  generateFullProfile(context?: GenerationContext): CharacterProfile;
  generateRichProfile(context?: GenerationContext): GeneratedProfile;  // 包含 profile 字段
  generateTagline(profile: CharacterProfile): string;
  
  // === 属性生成 ===
  randomAgeRange(): AgeRange;
  randomOccupation(context?): string;
  randomLocation(): string;
  randomInterests(count: number): InterestDomain[];
  randomPersonality(): PersonalityType;
  randomActivityLevel(): ActivityLevel;
  randomInfluenceLevel(): InfluenceLevel;
  randomContentStyle(): ContentStyle;
  generateTags(interests, occupation?): string[];
  generateBehaviorTendencies(personality, activity): BehaviorTendencies;
  getFollowersByLevel(level: InfluenceLevel): number;
  
  // === 角色化生成 ===
  generateByRole(role: string, context?): GeneratedProfile;  // fan, hater, kol, official
}
```

---

## 数据流

### 账号创建流程

```text
用户操作（创建账号）
       │
       ▼
┌─────────────────┐
│ CreateAccount   │
│ Dialog          │
│ 收集用户输入     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ AccountStore    │
│ action          │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ AccountService  │
│ createEntity()  │
│ + createPlatform│
│   Account()     │
└────────┬────────┘
         │
    验证作用域
    推断默认值
         │
         ▼
┌─────────────────┐
│ Database        │
│ db.entities.add │
│ db.accounts.add │
└────────┬────────┘
         │
    响应式更新
         │
         ▼
┌─────────────────┐
│ Vue 组件        │
│ 自动重渲染       │
└─────────────────┘
```

### 可见性查询流程

```text
App 请求可见账号
       │
       ▼
┌─────────────────┐
│ AccountService  │
│ getVisible      │
│ Accounts()      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 获取当前会话     │
│ 上下文          │
│ - sessionId     │
│ - characterCard │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ 遍历所有账号，检查可见性              │
│                                      │
│ 1. 检查实体可见性                     │
│    isEntityVisible(entity, context)  │
│                                      │
│ 2. 检查账号可见性                     │
│    isAccountVisible(account, entity) │
└────────┬────────────────────────────┘
         │
    过滤后的账号列表
         │
         ▼
┌─────────────────┐
│ 返回可见账号     │
└─────────────────┘
```

### 会话切换自动响应流程

```text
┌─────────────────┐
│ Bridge Adapter  │
│ 发出事件:        │
│ - chat_changed  │
│ - full_sync     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ AccountStore    │
│ 事件监听器       │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ getSessionContextFromBridge()       │
│ 获取新的会话上下文                    │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ switchSession(newContext)           │
│ - 更新 sessionContext               │
│ - 调用 accountService.setSession... │
│ - 刷新可见数据                        │
└─────────────────────────────────────┘
```

### 玩家进入新世界流程

```text
玩家打开微博 App
       │
       ▼
┌─────────────────┐
│ WeiboApp        │
│ onMounted       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ AccountStore    │
│ ensurePlayer    │
│ Account('weibo')│
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ AccountService                       │
│ checkMissingPlayerAccount('weibo')   │
│ findPlayerAccountForContext('weibo') │
└────────┬────────────────────────────┘
         │
    ┌────┴────┐
    │         │
   有账号    无账号
    │         │
    ▼         ▼
┌────────┐  ┌────────────────────┐
│ 返回   │  │ 返回 MissingAccount │
│ 账号   │  │ Info               │
└────────┘  └─────────┬──────────┘
                      │
                      ▼
            ┌─────────────────┐
            │ 显示账号创建     │
            │ 弹窗            │
            └─────────────────┘
```

---

## 数据库设计

### Schema 定义

```typescript
// src/services/database/index.ts
class PhoneDatabase extends Dexie {
  characterEntities!: Table<CharacterEntity>;
  platformAccounts!: Table<PlatformAccount>;
  socialRelations!: Table<SocialRelation>;
  
  constructor() {
    super('PhoneSimulator');
    
    this.version(5).stores({
      // 角色实体表
      characterEntities: `
        id,
        type,
        displayName,
        scope,
        scopeSessionId,
        scopeCharacterCardId,
        linkedCharacterCardId,
        source,
        createdAt,
        [scope+scopeSessionId],
        [scope+scopeCharacterCardId]
      `,
      
      // 平台账号表（独立作用域）
      platformAccounts: `
        id,
        entityId,
        platformId,
        scope,
        scopeSessionId,
        scopeCharacterCardId,
        [platformId+handle],
        [platformId+scope],
        [platformId+scopeCharacterCardId],
        [entityId+platformId],
        createdAt
      `,
      
      // 社交关系表（基于账号）
      socialRelations: `
        id,
        fromAccountId,
        toAccountId,
        type,
        [fromAccountId+type],
        [toAccountId+type],
        createdAt
      `
    });
  }
}
```

### 索引说明

| 表                 | 索引                            | 用途                     |
| ------------------ | ------------------------------- | ------------------------ |
| characterEntities  | `type`                          | 按类型筛选 NPC/玩家      |
| characterEntities  | `scope`                         | 按作用域筛选             |
| characterEntities  | `linkedCharacterCardId`         | 按关联角色卡查找         |
| characterEntities  | `[scope+scopeSessionId]`        | 查询会话级实体           |
| characterEntities  | `[scope+scopeCharacterCardId]`  | 查询角色卡级实体         |
| platformAccounts   | `entityId`                      | 获取实体的所有账号       |
| platformAccounts   | `platformId`                    | 获取平台的所有账号       |
| platformAccounts   | `[platformId+handle]`           | 唯一性检查（handle 唯一） |
| platformAccounts   | `[entityId+platformId]`         | 获取实体在某平台的账号   |
| socialRelations    | `[fromAccountId+type]`          | 获取关注/好友列表        |
| socialRelations    | `[toAccountId+type]`            | 获取粉丝列表             |

---

## ER 图

```text
┌─────────────────────────────────────────────────────────────────────┐
│                        CharacterEntity                               │
├─────────────────────────────────────────────────────────────────────┤
│ PK  id: string                                                       │
│     type: 'npc' | 'player'                                          │
│     displayName: string                                              │
│     avatar?: string                                                  │
│     bio?: string                                                     │
│     gender?: Gender                                                  │
│     tagline?: string                    # 一句话介绍                  │
│     profile?: CharacterProfile          # 详细画像                   │
│     backstory?: string                  # 背景故事                   │
│     scope: EntityScope                                               │
│ FK  scopeSessionId?: string                                          │
│ FK  scopeCharacterCardId?: string                                    │
│ FK  linkedCharacterCardId?: string                                   │
│     source: EntitySource                                             │
│     createdAt: number                                                │
│     updatedAt: number                                                │
│     metadata?: Record<string, unknown>                               │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               │ 1:N
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        PlatformAccount                               │
├─────────────────────────────────────────────────────────────────────┤
│ PK  id: string                                                       │
│ FK  entityId: string                                                 │
│     platformId: string                                               │
│     handle?: string                                                  │
│     nickname?: string                                                │
│     avatarOverride?: string                                          │
│     bioOverride?: string                                             │
│     scope: AccountScope                                              │
│     scopeSessionId?: string                                          │
│     scopeCharacterCardId?: string                                    │
│     platformData?: PlatformSpecificData  # 平台特定数据              │
│     boundArchiveIds?: string[]           # 绑定的档案 ID             │
│     archiveInjection?: object            # 档案注入配置              │
│     createdAt: number                                                │
│     updatedAt: number                                                │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               │ N:M (via SocialRelation)
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        SocialRelation                                │
├─────────────────────────────────────────────────────────────────────┤
│ PK  id: string                                                       │
│ FK  fromAccountId: string                                            │
│ FK  toAccountId: string                                              │
│     type: RelationType                                               │
│     strength?: number                    # 关系强度 0-100            │
│     createdAt: number                                                │
│     metadata?: Record<string, unknown>                               │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 服务交互图

```text
                    ┌─────────────────────────────────┐
                    │         AccountStore            │
                    │          (响应式)               │
                    │    - 自动监听 Bridge 事件       │
                    │    - 会话切换自动响应           │
                    └────────────┬────────────────────┘
                                 │
                    ┌────────────┴────────────────────┐
                    │                                 │
                    ▼                                 ▼
        ┌─────────────────────┐          ┌─────────────────────┐
        │   AccountService    │          │   Bridge Adapter    │
        │   (业务逻辑)         │◄─────────│   (事件来源)         │
        └──────────┬──────────┘          └─────────────────────┘
                   │                              │
                   │                    ┌─────────┘
                   │                    ▼
     ┌─────────────┼─────────────┐  ┌─────────────────────┐
     │             │             │  │   UserPool          │
     ▼             ▼             ▼  │   (随机用户生成)     │
┌─────────┐  ┌─────────┐  ┌─────────┐  └─────────────────────┘
│ Entity  │  │ Account │  │Relation │
│ Table   │  │ Table   │  │ Table   │
└─────────┘  └─────────┘  └─────────┘
     │             │             │
     └─────────────┼─────────────┘
                   │
                   ▼
        ┌─────────────────────┐
        │   IndexedDB (Dexie) │
        └─────────────────────┘
```

---

## 关键设计点

### 1. 单例模式

`AccountService` 和 `UserPool` 都采用单例模式，确保全局唯一实例：

```typescript
export class AccountService {
  private static instance: AccountService;
  
  private constructor() {}
  
  static getInstance(): AccountService {
    if (!AccountService.instance) {
      AccountService.instance = new AccountService();
    }
    return AccountService.instance;
  }
}

export const accountService = AccountService.getInstance();
```

### 2. Vue 响应式代理处理

存储到 IndexedDB 前，需要深拷贝数据以移除 Vue 响应式代理：

```typescript
// 深拷贝 platformData 以避免 Vue 响应式代理导致的序列化错误
const sanitizedPlatformData = data.platformData 
  ? JSON.parse(JSON.stringify(data.platformData))
  : undefined;
```

### 3. 级联删除

删除实体时使用事务确保数据一致性：

```typescript
async deleteEntity(id: string): Promise<void> {
  await db.transaction(
    'rw',
    [db.characterEntities, db.platformAccounts, db.socialRelations],
    async () => {
      // 删除所有相关的社交关系
      // 删除所有平台账号
      // 删除实体本身
    }
  );
}
```

### 4. 事件自动监听

AccountStore 在初始化时自动设置事件监听，响应会话切换：

```typescript
function setupEventListeners(): void {
  const adapter = getBridgeAdapter();
  if (!adapter) return;
  
  const unsubChatChanged = adapter.on('chat_changed', async () => {
    const newContext = getSessionContextFromBridge();
    await switchSession(newContext);
  });
  eventUnsubscribers.value.push(unsubChatChanged);
}
```
