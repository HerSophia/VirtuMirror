# 档案服务 - 账号绑定

> **版本**: 1.0  
> **最后更新**: 2026-01-16

## 1. 概述

账号绑定功能允许将档案与社交账号关联，为社交媒体内容生成提供角色背景。当账号发布内容时，绑定的档案会自动注入到生成提示词中，确保内容与角色设定保持一致。

### 1.1 使用场景

```text
角色档案「艾琳」 ──绑定──▶ 微博账号 @archmage_eileen
                            │
                            ▼
                    发布微博时自动注入：
                    - 角色性格特点
                    - 说话风格
                    - 已知事实
                    - 近期行为
```

### 1.2 设计目标

1. **双向关联**：档案和账号都记录绑定关系，便于双向查询
2. **多对多关系**：一个档案可绑定多个账号，一个账号可绑定多个档案
3. **级联清理**：删除档案或账号时自动清理绑定关系
4. **灵活配置**：账号可配置是否启用档案注入及 Token 预算

---

## 2. 数据模型

### 2.1 档案侧扩展

```typescript
// ArchiveBase 中的绑定字段
interface ArchiveBase {
  // ... 其他字段 ...
  
  // 账号绑定
  boundAccountIds?: string[];     // 绑定的社交账号 ID 列表
}
```

### 2.2 账号侧扩展

```typescript
// 扩展 SocialAccount 类型
interface SocialAccount {
  // ... 现有字段 ...
  
  // 档案绑定（新增）
  boundArchiveIds?: string[];     // 绑定的档案 ID 列表
  
  // 档案注入配置（新增）
  archiveInjection?: {
    enabled: boolean;             // 是否启用档案注入
    maxTokens: number;            // 最大注入 token 数
    includeRelated: boolean;      // 是否包含关联档案
  };
}
```

### 2.3 绑定关系表（可选）

如果绑定关系复杂，可使用独立的关联表：

```typescript
interface ArchiveAccountBinding {
  id: string;
  archiveId: string;
  accountId: string;
  createdAt: number;
  priority?: number;              // 同账号多档案时的优先级
}
```

---

## 3. 绑定操作

### 3.1 绑定档案到账号

```typescript
/**
 * 将档案绑定到账号
 * @param archiveId 档案 ID
 * @param accountId 账号 ID
 */
async function bindArchiveToAccount(
  archiveId: string, 
  accountId: string
): Promise<void> {
  // 1. 更新档案的 boundAccountIds
  const archive = await archiveService.get(archiveId);
  if (!archive) {
    throw new Error(`Archive not found: ${archiveId}`);
  }
  
  archive.boundAccountIds = archive.boundAccountIds ?? [];
  if (!archive.boundAccountIds.includes(accountId)) {
    archive.boundAccountIds.push(accountId);
  }
  await archiveService.save(archive);
  
  // 2. 更新账号的 boundArchiveIds
  const account = await accountService.get(accountId);
  if (!account) {
    throw new Error(`Account not found: ${accountId}`);
  }
  
  account.boundArchiveIds = account.boundArchiveIds ?? [];
  if (!account.boundArchiveIds.includes(archiveId)) {
    account.boundArchiveIds.push(archiveId);
  }
  await accountService.save(account);
}
```

### 3.2 解绑档案

```typescript
/**
 * 解除档案与账号的绑定
 * @param archiveId 档案 ID
 * @param accountId 账号 ID
 */
async function unbindArchiveFromAccount(
  archiveId: string, 
  accountId: string
): Promise<void> {
  // 1. 从档案中移除账号引用
  const archive = await archiveService.get(archiveId);
  if (archive) {
    archive.boundAccountIds = archive.boundAccountIds?.filter(
      id => id !== accountId
    );
    await archiveService.save(archive);
  }
  
  // 2. 从账号中移除档案引用
  const account = await accountService.get(accountId);
  if (account) {
    account.boundArchiveIds = account.boundArchiveIds?.filter(
      id => id !== archiveId
    );
    await accountService.save(account);
  }
}
```

### 3.3 批量绑定

```typescript
/**
 * 批量绑定多个档案到账号
 */
async function bindMultipleArchives(
  archiveIds: string[],
  accountId: string
): Promise<void> {
  for (const archiveId of archiveIds) {
    await bindArchiveToAccount(archiveId, accountId);
  }
}

/**
 * 替换账号的所有绑定档案
 */
async function replaceAccountArchives(
  accountId: string,
  newArchiveIds: string[]
): Promise<void> {
  const account = await accountService.get(accountId);
  if (!account) return;
  
  // 解绑现有的
  const existingIds = account.boundArchiveIds ?? [];
  for (const archiveId of existingIds) {
    if (!newArchiveIds.includes(archiveId)) {
      await unbindArchiveFromAccount(archiveId, accountId);
    }
  }
  
  // 绑定新的
  for (const archiveId of newArchiveIds) {
    if (!existingIds.includes(archiveId)) {
      await bindArchiveToAccount(archiveId, accountId);
    }
  }
}
```

---

## 4. 级联删除

### 4.1 删除档案时清理绑定

```typescript
/**
 * 删除档案（包含清理绑定关系）
 */
async function deleteArchive(archiveId: string): Promise<void> {
  const archive = await archiveService.get(archiveId);
  if (!archive) return;
  
  // 清理所有账号的引用
  if (archive.boundAccountIds?.length) {
    for (const accountId of archive.boundAccountIds) {
      const account = await accountService.get(accountId);
      if (account) {
        account.boundArchiveIds = account.boundArchiveIds?.filter(
          id => id !== archiveId
        );
        await accountService.save(account);
      }
    }
  }
  
  // 删除档案本身
  await archiveDB.archives.delete(archiveId);
}
```

### 4.2 删除账号时清理绑定

```typescript
/**
 * 删除账号（包含清理绑定关系）
 */
async function deleteAccount(accountId: string): Promise<void> {
  const account = await accountService.get(accountId);
  if (!account) return;
  
  // 清理所有档案的引用
  if (account.boundArchiveIds?.length) {
    for (const archiveId of account.boundArchiveIds) {
      const archive = await archiveService.get(archiveId);
      if (archive) {
        archive.boundAccountIds = archive.boundAccountIds?.filter(
          id => id !== accountId
        );
        await archiveService.save(archive);
      }
    }
  }
  
  // 删除账号本身
  await accountService.delete(accountId);
}
```

---

## 5. 查询操作

### 5.1 获取账号绑定的档案

```typescript
/**
 * 获取账号绑定的所有档案
 */
async function getAccountArchives(accountId: string): Promise<ArchiveBase[]> {
  const account = await accountService.get(accountId);
  if (!account?.boundArchiveIds?.length) {
    return [];
  }
  
  const archives = await Promise.all(
    account.boundArchiveIds.map(id => archiveService.get(id))
  );
  
  return archives.filter((a): a is ArchiveBase => a !== null);
}
```

### 5.2 获取档案绑定的账号

```typescript
/**
 * 获取档案绑定的所有账号
 */
async function getArchiveAccounts(archiveId: string): Promise<SocialAccount[]> {
  const archive = await archiveService.get(archiveId);
  if (!archive?.boundAccountIds?.length) {
    return [];
  }
  
  const accounts = await Promise.all(
    archive.boundAccountIds.map(id => accountService.get(id))
  );
  
  return accounts.filter((a): a is SocialAccount => a !== null);
}
```

### 5.3 检查绑定状态

```typescript
/**
 * 检查档案是否绑定到指定账号
 */
async function isArchiveBoundToAccount(
  archiveId: string,
  accountId: string
): Promise<boolean> {
  const archive = await archiveService.get(archiveId);
  return archive?.boundAccountIds?.includes(accountId) ?? false;
}
```

---

## 6. 注入集成

### 6.1 内容生成时注入

```typescript
// src/services/social/contentFactory.ts

async function generatePost(
  platformId: string, 
  topic: string, 
  account?: SocialAccount
): Promise<Post> {
  // 检查账号是否启用档案注入
  if (!account?.archiveInjection?.enabled) {
    return generateWithoutArchives(platformId, topic);
  }
  
  // 获取档案注入内容
  const injection = await archiveInjectionService.getInjection({
    sessionId: currentSessionId,
    scene: `social.post.generate.${platformId}`,
    accountId: account.id,
    keywords: extractKeywords(topic),
    maxTotalTokens: account.archiveInjection.maxTokens,
  });
  
  // 注入到提示词
  const prompt = await promptService.renderPrompt('social.post.generate', {
    platformName: platform.name,
    topic,
    // 注入账号上下文
    accountContext: injection.accountContext,
    coreKnowledge: injection.coreKnowledge,
    relevantArchives: injection.relevantArchives,
  });
  
  return generateWithLLM(prompt);
}
```

### 6.2 账号上下文格式化

```typescript
/**
 * 格式化账号绑定档案为上下文文本
 */
function formatAccountContext(archives: ArchiveBase[]): string {
  if (!archives.length) return '';
  
  const parts: string[] = [];
  
  // 角色档案
  const characters = archives.filter(a => a.type === 'character') as CharacterProfile[];
  if (characters.length) {
    parts.push('【角色背景】');
    for (const char of characters) {
      parts.push(`${char.name}：${char.baseDescription ?? ''}`);
      if (char.traits.length) {
        parts.push(`性格特点：${char.traits.join('、')}`);
      }
      if (char.knownFacts.length) {
        parts.push('已知事实：');
        char.knownFacts.slice(0, 5).forEach(f => {
          parts.push(`- ${f.fact}`);
        });
      }
    }
  }
  
  // 世界设定
  const worldEntries = archives.filter(a => a.type === 'world') as WorldEntry[];
  if (worldEntries.length) {
    parts.push('');
    parts.push('【相关设定】');
    worldEntries.forEach(entry => {
      parts.push(`- ${entry.name}：${entry.description}`);
    });
  }
  
  return parts.join('\n');
}
```

---

## 7. UI 集成

### 7.1 档案详情页

在档案详情页显示绑定的账号：

```text
┌─────────────────────────────────────────┐
│  ← 角色档案                    [编辑]   │
├─────────────────────────────────────────┤
│                                         │
│  👤 艾琳                                │
│  ...                                    │
│                                         │
├─────────────────────────────────────────┤
│  ─────────── 绑定账号 ───────────       │
│                                         │
│  已绑定:                                │
│  ┌─────────────────────────────────┐   │
│  │ 🐦 @archmage_eileen (微博) [×]   │   │
│  │ 📱 @eileen_magic (B站)     [×]   │   │
│  └─────────────────────────────────┘   │
│                                         │
│  [+ 绑定账号]                           │
│                                         │
└─────────────────────────────────────────┘
```

### 7.2 账号编辑页

在账号编辑页添加档案绑定入口：

```text
┌─────────────────────────────────────────┐
│  编辑账号 - @archmage_eileen            │
├─────────────────────────────────────────┤
│  昵称: [大魔法师艾琳      ]              │
│  简介: [学院最强的存在... ]              │
│                                         │
│  ─────────── 档案绑定 ───────────       │
│                                         │
│  已绑定档案:                             │
│  ┌─────────────────────────────────┐   │
│  │ 👤 艾琳人设           [解绑]    │   │
│  │ 🌍 魔法学院设定       [解绑]    │   │
│  └─────────────────────────────────┘   │
│                                         │
│  [+ 绑定更多档案]                        │
│                                         │
│  ─────────── 注入设置 ───────────       │
│                                         │
│  ☑ 生成内容时注入绑定档案                │
│    最大 Token: [300      ]              │
│  ☐ 包含关联档案                          │
│                                         │
│            [取消]     [保存]            │
└─────────────────────────────────────────┘
```

---

## 8. 服务接口汇总

```typescript
// src/services/archiveBindingService.ts

interface ArchiveBindingService {
  // 绑定操作
  bind(archiveId: string, accountId: string): Promise<void>;
  unbind(archiveId: string, accountId: string): Promise<void>;
  bindMultiple(archiveIds: string[], accountId: string): Promise<void>;
  replaceAccountArchives(accountId: string, archiveIds: string[]): Promise<void>;
  
  // 查询操作
  getAccountArchives(accountId: string): Promise<ArchiveBase[]>;
  getArchiveAccounts(archiveId: string): Promise<SocialAccount[]>;
  isBound(archiveId: string, accountId: string): Promise<boolean>;
  
  // 格式化
  formatAccountContext(archives: ArchiveBase[]): string;
}
```

---

## 9. 最佳实践

### ✅ 推荐做法

1. **双向维护**：绑定和解绑时同时更新档案和账号两侧
2. **级联清理**：删除时清理关联数据，避免悬空引用
3. **合理配置 Token**：根据账号用途设置合适的注入 Token 预算
4. **按需绑定**：只绑定与账号角色相关的档案

### ❌ 避免做法

1. **单向绑定**：只更新一侧会导致数据不一致
2. **过度绑定**：绑定过多档案会导致 Token 浪费
3. **忽略配置**：不设置注入配置可能导致意外行为
