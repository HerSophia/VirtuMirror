/**
 * 一次性账号会话绑定脚本
 * 
 * 用途：将当前玩家的微博账号绑定到当前的酒馆聊天会话
 * 
 * 使用方法：
 * 1. 在浏览器控制台中执行：
 *    ```
 *    window.__bindWeiboAccountToSession()
 *    ```
 * 
 * 2. 或者在设置页面点击「绑定账号到当前会话」按钮
 * 
 * 绑定效果：
 * - 账号的 scopeSessionId 会设置为当前会话 ID
 * - 账号数据仅在当前会话中可见
 * - 切换聊天或存档时会自动使用对应的账号
 * 
 * @see docs/dev/Security/account-session-binding.md
 */

import { bindWeiboAccountToCurrentSession, getAccountBindingStatus } from '../stores/dataMigration';

/**
 * 绑定微博账号到当前会话（控制台可调用）
 */
export async function bindAccountToSession(): Promise<void> {
  console.log('='.repeat(50));
  console.log('🔗 微博账号会话绑定工具');
  console.log('='.repeat(50));
  
  // 1. 检查当前状态
  console.log('\n📋 检查当前绑定状态...');
  const status = await getAccountBindingStatus();
  
  console.log('  - 账号存在:', status.hasAccount ? '✅' : '❌');
  console.log('  - 账号 ID:', status.accountId?.slice(0, 8) || '无');
  console.log('  - 当前会话:', status.currentSessionId?.slice(0, 16) || '无');
  console.log('  - 已绑定:', status.isBound ? '✅' : '❌');
  console.log('  - 绑定会话:', status.boundSessionId?.slice(0, 16) || '无');
  
  if (!status.hasAccount) {
    console.log('\n❌ 未找到微博账号，请先创建账号');
    return;
  }
  
  if (!status.currentSessionId) {
    console.log('\n❌ 无法获取当前会话，请确保已连接到酒馆');
    return;
  }
  
  if (status.isBound) {
    console.log('\n✅ 账号已绑定到当前会话，无需重复绑定');
    return;
  }
  
  // 2. 执行绑定
  console.log('\n🔄 正在绑定账号到当前会话...');
  const result = await bindWeiboAccountToCurrentSession();
  
  if (result.success) {
    console.log('\n✅ 绑定成功！');
    console.log('  - 账号 ID:', result.accountId?.slice(0, 8));
    console.log('  - 会话 ID:', result.sessionId?.slice(0, 16));
  } else {
    console.log('\n❌ 绑定失败:', result.message);
  }
  
  console.log('\n' + '='.repeat(50));
}

/**
 * 检查绑定状态（控制台可调用）
 */
export async function checkBindingStatus(): Promise<void> {
  console.log('📋 微博账号绑定状态');
  console.log('-'.repeat(30));
  
  const status = await getAccountBindingStatus();
  
  console.table({
    '账号存在': status.hasAccount ? '是' : '否',
    '账号 ID': status.accountId?.slice(0, 12) || '-',
    '当前会话': status.currentSessionId?.slice(0, 12) || '-',
    '已绑定': status.isBound ? '是' : '否',
    '绑定会话': status.boundSessionId?.slice(0, 12) || '-',
  });
}

// 注册到全局，方便控制台调用
if (typeof window !== 'undefined') {
  (window as any).__bindWeiboAccountToSession = bindAccountToSession;
  (window as any).__checkWeiboBindingStatus = checkBindingStatus;
  
  console.log('[WeiboBindScript] 已注册控制台命令:');
  console.log('  - window.__bindWeiboAccountToSession() - 绑定账号到当前会话');
  console.log('  - window.__checkWeiboBindingStatus() - 检查绑定状态');
}

export default bindAccountToSession;
