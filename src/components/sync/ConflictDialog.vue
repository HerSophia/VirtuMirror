<template>
  <div v-if="conflicts.length > 0" class="conflict-dialog">
    <div class="overlay" @click="onRetryLater" />
    <div class="dialog">
      <h3>⚠️ 检测到数据冲突</h3>

      <p>以下数据正在被其他设备修改:</p>

      <div class="conflict-list">
        <div
          v-for="c in conflicts"
          :key="`${c.table}:${String(c.key)}`"
          class="conflict-item"
        >
          <span class="table">{{ tableNames[c.table] || c.table }}</span>
          <span class="device">{{ c.conflictDevice }} 正在编辑</span>
        </div>
      </div>

      <p class="hint">你可以:</p>
      <ul>
        <li>等待对方完成后再操作</li>
        <li>强制覆盖（对方的修改会丢失）</li>
        <li>放弃你的修改，使用对方的版本</li>
      </ul>

      <div class="actions">
        <button class="secondary" @click="onRetryLater">稍后再试</button>
        <button class="secondary" @click="onDiscard">放弃我的</button>
        <button class="danger" @click="onForce">强制覆盖</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ConflictInfo } from '@/services/sync/types'

defineProps<{
  conflicts: ConflictInfo[]
}>()

const emit = defineEmits<{
  resolve: [decision: 'retry' | 'discard' | 'force']
}>()

const tableNames: Record<string, string> = {
  contacts: '📇 联系人',
  messages: '💬 消息',
  moments: '📷 动态',
  socialPosts: '📝 帖子',
  emails: '📧 邮件',
  calls: '📞 通话',
}

function onRetryLater() {
  emit('resolve', 'retry')
}
function onDiscard() {
  emit('resolve', 'discard')
}
function onForce() {
  emit('resolve', 'force')
}
</script>

<style scoped>
.conflict-dialog {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
}

.dialog {
  position: relative;
  background: white;
  border-radius: 12px;
  padding: 20px;
  max-width: 400px;
  width: 90%;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}

h3 {
  margin: 0 0 12px;
  font-size: 18px;
}

p {
  margin: 8px 0;
  color: #666;
  font-size: 14px;
}

.conflict-list {
  background: #f5f5f5;
  border-radius: 8px;
  padding: 12px;
  margin: 12px 0;
}

.conflict-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid #e0e0e0;
}

.conflict-item:last-child {
  border-bottom: none;
}

.table {
  font-weight: 500;
}

.device {
  color: #ff9800;
  font-size: 12px;
}

.hint {
  font-weight: 500;
  color: #333;
}

ul {
  margin: 8px 0;
  padding-left: 20px;
  font-size: 13px;
  color: #666;
}

li {
  margin: 4px 0;
}

.actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}

button {
  flex: 1;
  padding: 10px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
}

.secondary {
  background: #f0f0f0;
  color: #333;
}

.secondary:hover {
  background: #e0e0e0;
}

.danger {
  background: #f44336;
  color: white;
}

.danger:hover {
  background: #d32f2f;
}
</style>
