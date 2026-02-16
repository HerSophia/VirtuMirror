# 作用域机制

## 概述

账号系统采用**双层作用域**设计，分别控制实体（CharacterEntity）和账号（PlatformAccount）的可见性。这种设计支持复杂的跨世界身份管理场景。

---

## 双层作用域模型

```text
┌─────────────────────────────────────────────────────────────────────┐
│                        CharacterEntity                               │
│                     scope: EntityScope                               │
│                                                                      │
│  决定：这个"人"在哪些会话可见                                         │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                │ 约束
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        PlatformAccount                               │
│                     scope: AccountScope                              │
│                                                                      │
│  决定：这个"账号"在哪些会话可见                                       │
│  规则：账号作用域不能比实体作用域"更全局"                              │
└─────────────────────────────────────────────────────────────────────┘
```

### 作用域层级

```text
作用域范围从小到大:

    session  <  character  <  global
      ↑            ↑           ↑
   会话级       角色卡级      全局级
   最小范围                   最大范围
   level=1      level=2      level=3
```

---

## 三种作用域详解

### 1. 会话级 (session)

| 属性 | 说明 |
| -------- | ---------------------------------------- |
| 标识 | `scope: 'session'` |
| 可见范围 | 仅在创建它的会话中可见 |
| 必填字段 | `scopeSessionId` |
| 适用场景 | 普通 NPC、路人账号、临时角色、一次性互动 |

```typescript
// 会话级实体示例：路人 NPC
const passerbyEntity: CharacterEntity = {
  id: 'entity_001',
  type: 'npc',
  displayName: '路人甲',
  scope: 'session',
  scopeSessionId: 'session_abc123',  // 绑定到特定会话
  source: 'social',
  createdAt: Date.now(),
  updatedAt: Date.now(),
};
```

### 2. 角色卡级 (character)

| 属性 | 说明 |
| -------- | ------------------------------------------ |
| 标识 | `scope: 'character'` |
| 可见范围 | 使用相同角色卡的所有会话共享 |
| 必填字段 | `scopeCharacterCardId` |
| 适用场景 | 玩家的世界专属身份、主角关联 NPC、剧情角色 |

```typescript
// 角色卡级账号示例：玩家在"霸道总裁"世界的微博账号
const playerWeiboAccount: PlatformAccount = {
  id: 'account_001',
  entityId: 'player_entity',  // 关联全局玩家实体
  platformId: 'weibo',
  handle: 'city_worker_wang',
  nickname: '都市白领小王',
  scope: 'character',
  scopeCharacterCardId: 'card_ceo_romance',  // 绑定到角色卡
  createdAt: Date.now(),
  updatedAt: Date.now(),
};
```

### 3. 全局级 (global)

| 属性 | 说明 |
| -------- | ---------------------------------- |
| 标识 | `scope: 'global'` |
| 可见范围 | 所有会话共享 |
| 必填字段 | 无 |
| 适用场景 | 玩家实体、系统角色、跨世界 NPC |

```typescript
// 全局实体示例：玩家
const playerEntity: CharacterEntity = {
  id: 'player_entity',
  type: 'player',
  displayName: '玩家',
  scope: 'global',  // 玩家实体必须是全局的
  source: 'system',
  createdAt: Date.now(),
  updatedAt: Date.now(),
};
```

---

## 作用域约束规则

### 核心规则

**账号作用域不能比实体作用域"更全局"**

```text
┌─────────────────┬─────────────────────────────────────┐
│ Entity Scope    │ 允许的 Account Scope                 │
├─────────────────┼─────────────────────────────────────┤
│ global          │ global, character, session          │
│ character       │ character, session                  │
│ session         │ session                             │
└─────────────────┴─────────────────────────────────────┘
```

### 验证逻辑（实际代码）

```typescript
// src/services/account/accountService.ts

/**
 * 验证账号作用域是否合法（不能比实体作用域更全局）
 */
validateAccountScope(entityScope: EntityScope, accountScope: AccountScope): boolean {
  const scopeLevel: Record<EntityScope | AccountScope, number> = {
    session: 1,
    character: 2,
    global: 3,
  };
  return scopeLevel[accountScope] <= scopeLevel[entityScope];
}

// 示例
validateAccountScope('global', 'character');   // ✅ true (3 >= 2)
validateAccountScope('character', 'global');   // ❌ false (2 < 3)
validateAccountScope('session', 'character');  // ❌ false (1 < 2)
validateAccountScope('session', 'session');    // ✅ true (1 >= 1)
```

### 为什么需要这个约束？

防止逻辑矛盾：

```text
❌ 错误场景：
   - 实体是 session 级（只在会话 A 可见）
   - 账号是 global 级（所有会话可见）
   
   问题：在会话 B 中能看到账号，但找不到对应的实体！

✅ 正确场景：
   - 实体是 global 级（所有会话可见）
   - 账号是 character 级（只在特定角色卡可见）
   
   正确：账号可见时，实体一定可见
```

---

## 可见性判断

### 判断流程

```text
查询可见账号
      │
      ▼
┌─────────────────────────────────────────────────────────┐
│ Step 1: 检查实体可见性                                   │
│         isEntityVisible(entity, context)                │
└────────────────────────────┬────────────────────────────┘
                             │
           ┌─────────────────┼─────────────────┐
           │                 │                 │
           ▼                 ▼                 ▼
      global?          character?          session?
         │                  │                  │
         │                  ▼                  ▼
         │         cardId 匹配?        sessionId 匹配?
         │              │                      │
         ▼              ▼                      ▼
      可见 ✓         是→可见            是→可见
                     否→不可见          否→不可见
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│ Step 2: 检查账号可见性（仅当实体可见时）                  │
│         isAccountVisible(account, entity, context)      │
└────────────────────────────┬────────────────────────────┘
                             │
           ┌─────────────────┼─────────────────┐
           │                 │                 │
           ▼                 ▼                 ▼
      global?          character?          session?
         │                  │                  │
         │                  ▼                  ▼
         │         cardId 匹配?        sessionId 匹配?
         │              │                      │
         ▼              ▼                      ▼
      可见 ✓         是→可见            是→可见
                     否→不可见          否→不可见
```

### 实现代码（实际代码）

```typescript
// src/services/account/accountService.ts

/**
 * 判断实体是否在当前上下文可见
 */
isEntityVisible(entity: CharacterEntity, context?: SessionContext): boolean {
  const ctx = context || this.currentContext;
  if (!ctx) return false;

  switch (entity.scope) {
    case 'global':
      return true;
    case 'character':
      return entity.scopeCharacterCardId === ctx.characterCardId;
    case 'session':
      return entity.scopeSessionId === ctx.sessionId;
    default:
      return false;
  }
}

/**
 * 判断平台账号是否在当前上下文可见
 */
isAccountVisible(
  account: PlatformAccount,
  entity: CharacterEntity,
  context?: SessionContext
): boolean {
  const ctx = context || this.currentContext;
  if (!ctx) return false;

  // 1. 先检查实体可见性
  if (!this.isEntityVisible(entity, ctx)) {
    return false;
  }

  // 2. 再检查账号作用域
  switch (account.scope) {
    case 'global':
      return true;
    case 'character':
      return account.scopeCharacterCardId === ctx.characterCardId;
    case 'session':
      return account.scopeSessionId === ctx.sessionId;
    default:
      return false;
  }
}
```

---

## 作用域自动推断

创建实体/账号时，系统会根据来源和上下文自动设置作用域。

### 实体作用域推断（实际代码）

| 条件 | 默认作用域 | 说明 |
| -------------------------- | ----------- | -------------------------- |
| `type: 'player'` | `global` | **强制** - 玩家必须全局 |
| `source: 'system'` | `global` | 系统预置角色 |
| `source: 'character_card'` | `character` | 从角色卡导入的角色 |
| 其他 (chat, social, manual) | `session` | 默认会话级 |

```typescript
// src/services/account/accountService.ts

private inferEntityScope(data: CreateEntityInput): {
  scope: EntityScope;
  scopeSessionId?: string;
  scopeCharacterCardId?: string;
} {
  // 玩家实体必须是全局的
  if (data.type === 'player') {
    return { scope: 'global' };
  }

  // 如果明确指定了作用域，使用指定的
  if (data.scope) {
    return {
      scope: data.scope,
      scopeSessionId: data.scopeSessionId,
      scopeCharacterCardId: data.scopeCharacterCardId,
    };
  }

  // 根据来源推断
  switch (data.source) {
    case 'system':
      return { scope: 'global' };
    case 'character_card':
      return {
        scope: 'character',
        scopeCharacterCardId: data.linkedCharacterCardId || this.currentContext?.characterCardId,
      };
    default:
      // chat, social, manual 默认为 session
      return {
        scope: 'session',
        scopeSessionId: this.currentContext?.sessionId,
      };
  }
}
```

### 账号作用域推断（实际代码）

| 条件 | 默认作用域 | 说明 |
| ---------------------------- | ----------- | ---------------------------- |
| 实体是 `session` | `session` | **强制** - 只能是这个 |
| 实体是 `global` + 玩家 | `character` | 推荐每个世界独立身份 |
| 其他情况 | 继承实体 | 跟随实体作用域 |

```typescript
// src/services/account/accountService.ts

private inferAccountScope(
  entity: CharacterEntity,
  data: CreatePlatformAccountInput
): {
  scope: AccountScope;
  scopeSessionId?: string;
  scopeCharacterCardId?: string;
} {
  // 如果实体是 session 级别，账号只能是 session
  if (entity.scope === 'session') {
    return {
      scope: 'session',
      scopeSessionId: entity.scopeSessionId,
    };
  }

  // 使用传入的作用域
  if (data.scope) {
    // 验证作用域合法性
    if (!this.validateAccountScope(entity.scope, data.scope)) {
      throw new Error(
        `Account scope '${data.scope}' cannot be more global than entity scope '${entity.scope}'`
      );
    }
    return {
      scope: data.scope,
      scopeSessionId: data.scopeSessionId,
      scopeCharacterCardId: data.scopeCharacterCardId,
    };
  }

  // 默认：玩家实体推荐 character 级别（每个世界一个身份）
  if (entity.type === 'player') {
    return {
      scope: 'character',
      scopeCharacterCardId: this.currentContext?.characterCardId,
    };
  }

  // 其他情况跟随实体作用域
  return {
    scope: entity.scope,
    scopeSessionId: entity.scopeSessionId,
    scopeCharacterCardId: entity.scopeCharacterCardId,
  };
}
```

---

## 玩家多重身份示例

### 场景描述

玩家在不同角色卡（世界）中有不同的社交身份：

```text
┌─────────────────────────────────────────────────────────────────────┐
│                    玩家实体 (global)                                 │
│                    displayName: "玩家"                               │
│                    type: 'player'                                    │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
          ┌─────────────────────┼─────────────────────┐
          │                     │                     │
          ▼                     ▼                     ▼
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│ 微博 @都市小王   │   │ 微博 @剑仙无名   │   │ 微博 @测试号     │
│                 │   │                 │   │                 │
│ scope: character│   │ scope: character│   │ scope: global   │
│ cardId: 霸道总裁│   │ cardId: 剑仙传  │   │ (调试用)        │
│                 │   │                 │   │                 │
│ 粉丝: 白领群体  │   │ 粉丝: 修仙者    │   │ 粉丝: -         │
└─────────────────┘   └─────────────────┘   └─────────────────┘
```

### 数据示例

```typescript
// 玩家实体（全局唯一）
const playerEntity: CharacterEntity = {
  id: 'player_001',
  type: 'player',
  displayName: '玩家',
  scope: 'global',  // 玩家实体必须全局
  source: 'system',
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

// 在"霸道总裁"世界的微博账号
const weiboAccountA: PlatformAccount = {
  id: 'account_001',
  entityId: 'player_001',
  platformId: 'weibo',
  handle: 'city_worker_wang',
  nickname: '都市白领小王',
  scope: 'character',
  scopeCharacterCardId: 'card_ceo_romance',
  platformData: { followers: 150 },
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

// 在"剑仙传"世界的微博账号
const weiboAccountB: PlatformAccount = {
  id: 'account_002',
  entityId: 'player_001',
  platformId: 'weibo',
  handle: 'sword_immortal',
  nickname: '剑仙无名',
  scope: 'character',
  scopeCharacterCardId: 'card_xianxia',
  platformData: { followers: 500 },
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

// 调试用全局账号
const weiboAccountGlobal: PlatformAccount = {
  id: 'account_003',
  entityId: 'player_001',
  platformId: 'weibo',
  handle: 'test_account',
  nickname: '测试号',
  scope: 'global',  // 全局可见
  createdAt: Date.now(),
  updatedAt: Date.now(),
};
```

### 可见性查询结果

```typescript
// 在"霸道总裁"世界打开微博
const context: SessionContext = {
  sessionId: 'session_123',
  characterCardId: 'card_ceo_romance'
};

const visibleAccounts = await accountService.getVisibleAccounts('weibo', context);

// 结果：
// - weiboAccountA (character 级，cardId 匹配)
// - weiboAccountGlobal (global 级)
// - 不包含 weiboAccountB (character 级，cardId 不匹配)
```

---

## 查找玩家账号的逻辑

### findPlayerAccountForContext（实际代码）

```typescript
// src/services/account/accountService.ts

/**
 * 查找玩家在指定平台、指定上下文的账号
 */
async findPlayerAccountForContext(
  platformId: string,
  context?: SessionContext
): Promise<PlatformAccount | null> {
  const ctx = context || this.requireContext();
  const player = await this.getPlayerEntity();
  if (!player) return null;

  const accounts = await db.platformAccounts
    .where('[entityId+platformId]')
    .equals([player.id, platformId])
    .toArray();

  // 找到当前上下文可见的账号
  for (const account of accounts) {
    if (this.isAccountVisible(account, player, ctx)) {
      return account;
    }
  }

  return null;
}
```

### checkMissingPlayerAccount（实际代码）

```typescript
// src/services/account/accountService.ts

/**
 * 检查当前上下文是否缺少玩家账号
 */
async checkMissingPlayerAccount(platformId: string): Promise<MissingAccountInfo | null> {
  const ctx = this.requireContext();
  const account = await this.findPlayerAccountForContext(platformId, ctx);

  if (account) {
    return null; // 已有账号
  }

  const platformNames: Record<string, string> = {
    weibo: '微博',
    bilibili: 'B站',
    chat: '聊天',
  };

  return {
    platformId,
    platformName: platformNames[platformId] || platformId,
    context: ctx,
    suggestedScope: 'character',
  };
}
```

---

## 注意事项

### 1. 玩家实体唯一性

系统中只有一个玩家实体（`type: 'player'`），且其 `scope` **必须**为 `'global'`。

```typescript
// 创建实体时，玩家类型会强制设为全局
if (data.type === 'player') {
  return { scope: 'global' };
}
```

### 2. 删除级联

* 删除 Entity 时，级联删除所有 PlatformAccount 和相关 SocialRelation
* 删除 PlatformAccount 时，级联删除相关 SocialRelation
* 删除会话时，可选是否删除该会话的 session 级实体和账号

### 3. 作用域变更

一般不建议修改已创建实体/账号的作用域，因为可能导致：

* 关系数据不一致
* 引用数据丢失

如需变更，建议删除后重新创建。

### 4. 上下文传递

所有涉及可见性的 API 都需要 `SessionContext`，获取方式：

1. 显式传入参数
2. 从 `accountService.getSessionContext()` 读取（服务内部已设置）
3. 从 `accountStore.sessionContext` 读取（响应式）
4. 从 Bridge 适配器自动获取（AccountStore 初始化时）

### 5. 独立模式回退

当没有连接到 SillyTavern 时，会话 ID 会回退到 `'standalone-session'`：

```typescript
// src/stores/accountStore.ts
function getSessionContextFromBridge(): SessionContext {
  const adapter = getBridgeAdapter();
  
  if (adapter) {
    const status = adapter.getStatus();
    if (status.currentSessionId) {
      return {
        sessionId: status.currentSessionId,
        characterCardId: undefined,
      };
    }
  }
  
  // 独立模式回退
  return {
    sessionId: 'standalone-session',
    characterCardId: undefined,
  };
}
```
