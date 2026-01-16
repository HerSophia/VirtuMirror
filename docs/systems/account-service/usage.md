# 使用示例

## 初始化

### 应用启动时初始化（自动获取上下文）

```typescript
// src/main.ts 或 src/App.vue
import { useAccountStore } from '@/stores/accountStore';

onMounted(async () => {
  const accountStore = useAccountStore();
  
  // 初始化账号系统
  // 会话上下文会自动从 Bridge Adapter 获取
  // 如果没有连接到酒馆，会回退到 'standalone-session'
  await accountStore.initialize('玩家名');
});
```

### 显式传入会话上下文（向后兼容）

```typescript
import { useAccountStore } from '@/stores/accountStore';

onMounted(async () => {
  const accountStore = useAccountStore();
  
  // 显式传入会话上下文
  await accountStore.initialize('玩家名', {
    sessionId: 'session_xxx',
    characterCardId: 'card_xxx',
  });
});
```

### 会话切换自动响应

AccountStore 会自动监听 Bridge Adapter 的事件，在会话切换时自动更新上下文：

```typescript
// 内部实现（无需手动调用）
function setupEventListeners(): void {
  const adapter = getBridgeAdapter();
  if (!adapter) return;
  
  // 监听会话切换
  adapter.on('chat_changed', async () => {
    const newContext = getSessionContextFromBridge();
    await switchSession(newContext);
  });
  
  // 监听完整同步
  adapter.on('bridge:full_sync', async () => {
    // 自动检测是否需要切换会话
  });
}
```

### 手动切换会话（如需要）

```typescript
import { useAccountStore } from '@/stores/accountStore';

const accountStore = useAccountStore();

// 手动切换会话
await accountStore.switchSession({
  sessionId: 'new_session_id',
  characterCardId: 'new_card_id',
});
```

---

## 实体管理

### 创建 NPC 实体

```typescript
import { accountService } from '@/services/account';

// 创建会话级 NPC（只在当前会话可见）
const npcEntity = await accountService.createEntity({
  type: 'npc',
  displayName: '咖啡店店员',
  avatar: 'https://example.com/avatar.jpg',
  bio: '热爱咖啡的年轻人',
  gender: 'female',
  source: 'social',
  // scope 不指定，自动推断为 'session'
});

// 创建角色卡级 NPC（该角色卡的所有会话共享）
const storyNpc = await accountService.createEntity({
  type: 'npc',
  displayName: '主角的妹妹',
  source: 'character_card',
  scope: 'character',
  scopeCharacterCardId: 'card_romance_001',
  linkedCharacterCardId: 'card_romance_001',
  metadata: { role: 'sister', importance: 'main' },
});
```

### 获取/查询实体

```typescript
// 获取单个实体
const entity = await accountService.getEntity('entity_id');

// 获取玩家实体
const player = await accountService.getPlayerEntity();

// 获取或创建玩家实体
const playerEntity = await accountService.getOrCreatePlayerEntity('玩家名');

// 获取当前会话可见的所有实体
const visibleEntities = await accountService.getVisibleEntities();

// 获取所有实体（不考虑作用域，管理用）
const allEntities = await accountService.getAllEntities();

// 按类型获取实体
const npcs = await accountService.getEntitiesByType('npc');

// 搜索实体
const results = await accountService.searchEntities('咖啡', {
  fields: ['displayName', 'bio'],
  limit: 10,
});
```

### 更新/删除实体

```typescript
// 更新实体
const updated = await accountService.updateEntity('entity_id', {
  displayName: '新名字',
  avatar: 'new_avatar_url',
});

// 删除实体（级联删除账号和关系）
await accountService.deleteEntity('entity_id');
```

---

## 平台账号管理

### 创建平台账号

```typescript
import { accountService } from '@/services/account';

// 为实体创建微博账号
const weiboAccount = await accountService.createPlatformAccount(
  'entity_id',     // 关联的实体 ID
  'weibo',         // 平台 ID
  {
    handle: 'coffee_lover',
    nickname: '咖啡爱好者',
    bioOverride: '每天一杯咖啡，快乐似神仙',
    scope: 'session',  // 必填，会验证是否合法
    platformData: {
      followers: 100,
      following: 50,
      verified: false,
    },
  }
);
```

### 为玩家创建账号

```typescript
// 方式 1：使用 ensurePlayerAccount（推荐）
const accountStore = useAccountStore();
const result = await accountStore.ensurePlayerAccount('weibo');

if ('platformId' in result) {
  // 需要创建账号，返回 MissingAccountInfo
  // 显示创建弹窗
  showCreateAccountDialog(result);
} else {
  // 已有账号，返回 PlatformAccount
  console.log('已有微博账号:', result.handle);
}

// 方式 2：直接创建（已知没有账号时）
const playerEntity = await accountService.getPlayerEntity();
const context = accountService.getSessionContext();

const playerWeiboAccount = await accountService.createPlatformAccount(
  playerEntity!.id,
  'weibo',
  {
    handle: 'my_handle',
    nickname: '我的昵称',
    scope: 'character',  // 推荐角色卡级，每个世界不同身份
    scopeCharacterCardId: context?.characterCardId,
  }
);
```

### 查询平台账号

```typescript
// 获取单个账号
const account = await accountService.getPlatformAccount('account_id');

// 通过 handle 查找
const accountByHandle = await accountService.findAccountByHandle('weibo', 'coffee_lover');

// 获取当前会话可见的所有微博账号
const weiboAccounts = await accountService.getVisibleAccounts('weibo');

// 查找玩家在当前上下文的微博账号
const playerWeiboAccount = await accountService.findPlayerAccountForContext('weibo');

// 获取玩家的所有平台账号（跨所有世界）
const allPlayerAccounts = await accountService.getPlayerAllAccounts();

// 获取实体的所有账号
const entityAccounts = await accountService.getAccountsByEntity('entity_id');

// 随机获取一个账号（用于内容生成）
const randomAccount = await accountService.getRandomAccountForPlatform('weibo');
```

### 检查缺失账号

```typescript
// 检查当前上下文是否缺少玩家的微博账号
const missingInfo = await accountService.checkMissingPlayerAccount('weibo');

if (missingInfo) {
  // 缺少账号，显示创建弹窗
  console.log('需要创建账号:', missingInfo.platformName);
  console.log('建议作用域:', missingInfo.suggestedScope);  // 'character'
  console.log('当前上下文:', missingInfo.context);
}
```

### 更新/删除账号

```typescript
// 更新账号
const updated = await accountService.updatePlatformAccount('account_id', {
  nickname: '新昵称',
  platformData: { followers: 200 },
});

// 删除账号（级联删除关系）
await accountService.deletePlatformAccount('account_id');
```

---

## 社交关系管理

### 关注操作

```typescript
import { accountService } from '@/services/account';

// 关注某人
await accountService.followAccount(myAccountId, targetAccountId);

// 取消关注
await accountService.unfollowAccount(myAccountId, targetAccountId);

// 检查是否已关注
const isFollowing = await accountService.hasAccountRelation(
  myAccountId, 
  targetAccountId, 
  'follow'
);
```

### 好友操作

```typescript
// 添加好友（双向关系，自动创建两条记录）
await accountService.addFriendAccounts(accountIdA, accountIdB);

// 删除好友（同时删除双向记录）
await accountService.removeFriendAccounts(accountIdA, accountIdB);
```

### 查询关系

```typescript
// 获取关注列表
const following = await accountService.getFollowingAccounts(myAccountId);

// 获取粉丝列表
const followers = await accountService.getFollowerAccounts(myAccountId);

// 获取好友列表
const friends = await accountService.getFriendAccounts(myAccountId);
```

---

## 便捷方法

### 获取完整档案

```typescript
// 获取合并了实体和账号信息的完整档案
const profile = await accountService.getFullProfile('account_id');

if (profile) {
  console.log('显示名:', profile.displayName);  // 优先账号昵称
  console.log('头像:', profile.avatar);          // 优先账号头像
  console.log('简介:', profile.bio);             // 优先账号简介
  console.log('实体:', profile.entity);
  console.log('账号:', profile.account);
}

// 通过实体 ID 和平台 ID 获取
const profile2 = await accountService.getFullProfileByEntityAndPlatform(
  'entity_id',
  'weibo'
);
```

### 随机获取/创建用户

```typescript
import { useAccountStore } from '@/stores/accountStore';
import { userPool } from '@/services/account';

const accountStore = useAccountStore();

// 方式 1：通过 Store 获取或创建随机用户
// 会自动创建实体和账号，返回完整档案
const randomProfile = await accountStore.getOrCreateRandomUser('weibo');
console.log('随机用户:', randomProfile.displayName);

// 方式 2：仅生成用户数据（不存储）
const generatedData = userPool.generateRandomProfile({ platform: 'weibo' });
console.log('生成的数据:', generatedData.displayName, generatedData.handle);

// 方式 3：生成带完整画像的用户
const richProfile = userPool.generateRichProfile({ topic: 'tech' });
console.log('画像:', richProfile.profile?.interests);
console.log('性格:', richProfile.profile?.personality);
console.log('标语:', richProfile.tagline);
```

### 从角色卡同步

```typescript
// 从 SillyTavern 角色卡导入/同步实体
// 如果已有关联实体，会更新；否则创建新实体
const entity = await accountService.syncFromCharacterCard(
  'card_id',
  {
    name: '角色名',
    avatar: 'avatar_url',
    description: '角色描述',
  }
);
```

### 获取统计信息

```typescript
const stats = await accountService.getStats();
console.log('实体总数:', stats.totalEntities);
console.log('账号总数:', stats.totalAccounts);
console.log('关系总数:', stats.totalRelations);
console.log('按类型:', stats.entitiesByType);  // { npc: 10, player: 1 }
console.log('按作用域:', stats.entitiesByScope);  // { session: 8, character: 2, global: 1 }
console.log('按平台:', stats.accountsByPlatform);  // { weibo: 5, chat: 3 }
```

---

## 在 Vue 组件中使用

### 使用 AccountStore

```vue
<template>
  <div>
    <!-- 显示当前玩家 -->
    <div v-if="currentPlayer">
      <img :src="currentPlayer.avatar" />
      <span>{{ currentPlayer.displayName }}</span>
    </div>
    
    <!-- 显示加载状态 -->
    <div v-if="accountStore.isLoading">加载中...</div>
    
    <!-- 显示可见的微博用户 -->
    <div v-for="account in weiboAccounts" :key="account.id">
      <span>@{{ account.handle }}</span>
      <span>{{ account.nickname }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import { useAccountStore } from '@/stores/accountStore';

const accountStore = useAccountStore();

// 当前玩家实体（响应式）
const currentPlayer = computed(() => accountStore.currentPlayer);

// 当前会话可见的微博账号（响应式）
const weiboAccounts = computed(() => 
  accountStore.visibleAccountsByPlatform.get('weibo') || []
);

onMounted(async () => {
  // 确保已初始化（会自动获取会话上下文）
  if (!accountStore.isInitialized) {
    await accountStore.initialize('玩家');
  }
});

onUnmounted(() => {
  // 可选：清理事件监听器
  accountStore.cleanup();
});
</script>
```

### 使用账号创建弹窗组件

```vue
<template>
  <div>
    <!-- 触发按钮 -->
    <button @click="checkAndCreateAccount">打开微博</button>
    
    <!-- 账号创建弹窗 -->
    <CreateAccountDialog
      :visible="showDialog"
      platform-id="weibo"
      platform-name="微博"
      :theme-color="'#E6162D'"
      :show-scope-selector="false"
      @close="showDialog = false"
      @created="handleCreated"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useAccountStore } from '@/stores/accountStore';
import CreateAccountDialog from '@/components/common/CreateAccountDialog.vue';
import type { PlatformAccount } from '@/types/account';

const accountStore = useAccountStore();
const showDialog = ref(false);

async function checkAndCreateAccount() {
  const result = await accountStore.ensurePlayerAccount('weibo');
  
  if ('platformId' in result) {
    // 需要创建账号
    showDialog.value = true;
  } else {
    // 已有账号，直接进入
    navigateToWeibo();
  }
}

function handleCreated(account: PlatformAccount) {
  showDialog.value = false;
  navigateToWeibo();
}

function navigateToWeibo() {
  // 导航到微博
}
</script>
```

---

## 典型业务场景

### 场景 1：玩家进入新世界的微博

```typescript
async function initWeiboApp() {
  const accountStore = useAccountStore();
  
  // 1. 确保玩家有微博账号
  const result = await accountStore.ensurePlayerAccount('weibo');
  
  if ('platformId' in result) {
    // 2. 没有账号，显示创建弹窗
    const newAccount = await showAccountCreationDialog(result);
    if (!newAccount) {
      // 用户取消，显示游客模式或退出
      return;
    }
  }
  
  // 3. 加载时间线
  const playerAccount = await accountService.findPlayerAccountForContext('weibo');
  await loadTimeline(playerAccount!.id);
}
```

### 场景 2：生成路人评论

```typescript
async function generateRandomCommenter(): Promise<FullProfile> {
  const accountStore = useAccountStore();
  
  // getOrCreateRandomUser 会自动：
  // 1. 尝试获取已有的可见随机账号
  // 2. 如果没有，创建新的会话级 NPC 和账号
  return accountStore.getOrCreateRandomUser('weibo');
}

// 使用
const commenter = await generateRandomCommenter();
const comment = {
  authorId: commenter.account.id,
  authorName: commenter.displayName,
  authorAvatar: commenter.avatar,
  content: '写得真好！',
};
```

### 场景 3：从角色卡导入关联 NPC

```typescript
async function importCharacterNPC(
  cardId: string,
  npcData: { name: string; role: string }
) {
  // 1. 创建角色卡级实体
  const entity = await accountService.createEntity({
    type: 'npc',
    source: 'character_card',
    displayName: npcData.name,
    scope: 'character',
    scopeCharacterCardId: cardId,
    linkedCharacterCardId: cardId,
    metadata: { role: npcData.role },
  });
  
  // 2. 创建微博账号（也是角色卡级）
  const account = await accountService.createPlatformAccount(
    entity.id,
    'weibo',
    {
      handle: `${npcData.name.toLowerCase()}_official`,
      nickname: npcData.name,
      scope: 'character',
      scopeCharacterCardId: cardId,
    }
  );
  
  // 3. 建立与玩家的关系
  const playerAccount = await accountService.findPlayerAccountForContext('weibo');
  if (playerAccount) {
    // 互相关注
    await accountService.followAccount(playerAccount.id, account.id);
    await accountService.followAccount(account.id, playerAccount.id);
  }
  
  return { entity, account };
}
```

### 场景 4：使用 UserPool 生成丰富的用户画像

```typescript
import { userPool } from '@/services/account';

// 生成带完整画像的博主
const blogger = userPool.generateRichProfile({ topic: 'tech' });

console.log('基本信息:');
console.log('  名称:', blogger.displayName);
console.log('  标语:', blogger.tagline);  // 如："代码改变世界的程序员"

console.log('画像信息:');
console.log('  年龄段:', blogger.profile?.ageRange);  // 'young' | 'adult' | ...
console.log('  职业:', blogger.profile?.occupation);  // '程序员'
console.log('  地点:', blogger.profile?.location);    // '北京'
console.log('  兴趣:', blogger.profile?.interests);   // ['tech', 'gaming', ...]
console.log('  性格:', blogger.profile?.personality); // 'creator' | 'enthusiast' | ...
console.log('  活跃度:', blogger.profile?.activityLevel);  // 'high'
console.log('  影响力:', blogger.profile?.influenceLevel); // 'small_v'

// 根据影响力获取粉丝数
const followers = userPool.getFollowersByLevel(blogger.profile!.influenceLevel);
console.log('  预估粉丝:', followers);  // 10000 - 100000

// 生成特定角色的用户
const fan = userPool.generateByRole('fan', { topic: '明星' });
const kol = userPool.generateByRole('kol', { platform: 'weibo' });
```

---

## 错误处理

```typescript
import { accountService } from '@/services/account';

try {
  // 创建账号时可能的错误
  const account = await accountService.createPlatformAccount(
    entityId,
    'weibo',
    {
      handle: 'existing_handle',
      scope: 'character',
    }
  );
} catch (error) {
  const message = (error as Error).message;
  
  if (message.includes('Handle already exists')) {
    // Handle 已被占用
    console.error('该用户名已被使用');
  } else if (message.includes('Entity not found')) {
    // 实体不存在
    console.error('关联的实体不存在');
  } else if (message.includes('cannot be more global')) {
    // 作用域不合法
    console.error('作用域配置错误：账号作用域不能比实体作用域更全局');
  } else if (message.includes('Session context not set')) {
    // 没有设置会话上下文
    console.error('请先初始化账号系统');
  } else {
    // 其他错误
    console.error('操作失败:', error);
  }
}
```

---

## 清理和重置

```typescript
const accountStore = useAccountStore();

// 清理事件监听器（组件卸载时调用）
// 不会清除缓存数据
accountStore.cleanup();

// 完全重置 Store（用于登出或测试）
// 清除所有状态和监听器
accountStore.reset();

// 刷新缓存数据
await accountStore.refresh();
```
