<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useWalletStore } from '@/stores/walletStore'
import { ChatHeader, ListItem } from '../../components'

const router = useRouter()
const walletStore = useWalletStore()

// 编辑模式状态
const editMode = ref<'balance' | 'fund' | null>(null)
const editValue = ref('')

// 当前显示的收益率（每次进入页面随机波动）
const displayRate = ref(1.06)

onMounted(() => {
  // 生成随机收益率波动
  const fluctuation = (Math.random() - 0.5) * 0.2
  displayRate.value = Math.max(0.5, walletStore.baseFundRate + fluctuation)
})

// 格式化金额
const formattedBalance = computed(() => walletStore.formatAmount(walletStore.balance))
const formattedFundBalance = computed(() => walletStore.formatAmount(walletStore.fundBalance))
const formattedRate = computed(() => displayRate.value.toFixed(2) + '%')

function openBalanceEdit() {
  editMode.value = 'balance'
  editValue.value = walletStore.balance.toString()
}

function openFundEdit() {
  editMode.value = 'fund'
  editValue.value = walletStore.fundBalance.toString()
}

function closeEdit() {
  editMode.value = null
  editValue.value = ''
}

function saveEdit() {
  const value = parseFloat(editValue.value)
  if (!isNaN(value) && value >= 0) {
    if (editMode.value === 'balance') {
      walletStore.setBalance(value)
    } else if (editMode.value === 'fund') {
      walletStore.setFundBalance(value)
    }
  }
  closeEdit()
}
</script>

<template>
  <div class="wallet-page">
    <ChatHeader 
      title="钱包"
      :show-back="true"
      bg-color="#fff"
    >
      <template #right>
        <span class="header-link">账单</span>
      </template>
    </ChatHeader>

    <!-- 内容区域 -->
    <div class="wallet-content">
      <!-- 资金管理区块 -->
      <div class="wallet-section">
        <!-- 零钱 -->
        <ListItem @click="openBalanceEdit">
          <template #left>
            <div class="item-icon text-orange-400">
              <i class="fas fa-yen-sign" />
            </div>
          </template>
          <template #content>
            <span class="item-label">零钱</span>
          </template>
          <template #right>
            <span class="item-amount">¥{{ formattedBalance }}</span>
            <i class="fas fa-chevron-right arrow-icon" />
          </template>
        </ListItem>

        <!-- 零钱通 -->
        <ListItem @click="openFundEdit">
          <template #left>
            <div class="item-icon text-orange-400">
              <i class="fas fa-gem" />
            </div>
          </template>
          <template #content>
            <div class="flex items-center gap-3">
              <span class="item-label">零钱通</span>
              <span class="item-rate">收益率{{ formattedRate }}</span>
            </div>
          </template>
          <template #right>
            <span class="item-amount">¥{{ formattedFundBalance }}</span>
            <i class="fas fa-chevron-right arrow-icon" />
          </template>
        </ListItem>
      </div>

      <!-- 银行卡相关 -->
      <div class="wallet-section">
        <ListItem :show-arrow="true">
          <template #left>
            <div class="item-icon text-blue-500">
              <i class="fas fa-credit-card" />
            </div>
          </template>
          <template #content>
            <span class="item-label">银行卡</span>
          </template>
        </ListItem>

        <ListItem :show-arrow="true">
          <template #left>
            <div class="item-icon text-orange-300">
              <i class="fas fa-heart" />
            </div>
          </template>
          <template #content>
            <span class="item-label">亲属卡</span>
          </template>
        </ListItem>
      </div>

      <!-- 其他服务 -->
      <div class="wallet-section">
        <ListItem :show-arrow="true">
          <template #left>
            <div class="item-icon text-green-500">
              <i class="fas fa-star" />
            </div>
          </template>
          <template #content>
            <span class="item-label">支付分</span>
          </template>
        </ListItem>

        <ListItem :show-arrow="true">
          <template #left>
            <div class="item-icon text-green-500">
              <i class="fas fa-headset" />
            </div>
          </template>
          <template #content>
            <span class="item-label">客服中心</span>
          </template>
        </ListItem>
      </div>
    </div>

    <!-- 底部链接 -->
    <div class="wallet-footer">
      <span class="footer-link">身份信息</span>
      <span class="footer-divider">|</span>
      <span class="footer-link">支付设置</span>
    </div>

    <!-- 编辑弹窗 -->
    <div v-if="editMode" class="edit-modal" @click.self="closeEdit">
      <div class="edit-dialog">
        <div class="edit-header">
          <span>{{ editMode === 'balance' ? '修改零钱' : '修改零钱通' }}</span>
          <button class="close-btn" @click="closeEdit">
            <i class="fas fa-times" />
          </button>
        </div>
        <div class="edit-body">
          <div class="input-group">
            <span class="input-prefix">¥</span>
            <input
              v-model="editValue"
              type="number"
              step="0.01"
              min="0"
              class="amount-input"
              placeholder="请输入金额"
            />
          </div>
        </div>
        <div class="edit-footer">
          <button class="cancel-btn" @click="closeEdit">取消</button>
          <button class="confirm-btn" @click="saveEdit">确认</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wallet-page {
  @apply h-full flex flex-col;
  background-color: #f5f5f5;
}

.header-link {
  @apply text-sm text-gray-600;
}

.wallet-content {
  @apply flex-1 overflow-y-auto;
}

.wallet-section {
  @apply bg-white mb-2;
}

.item-icon {
  @apply w-8 h-8 flex items-center justify-center text-xl mr-3;
}

.item-label {
  @apply text-base text-gray-900;
}

.item-rate {
  @apply text-sm text-orange-500;
}

.item-amount {
  @apply text-base text-gray-600 mr-2;
}

.arrow-icon {
  @apply text-gray-300 text-xs;
}

.wallet-footer {
  @apply flex items-center justify-center gap-2 py-4 bg-transparent;
  position: absolute;
  bottom: 20px;
  left: 0;
  right: 0;
}

.footer-link {
  @apply text-sm text-blue-500;
}

.footer-divider {
  @apply text-gray-300;
}

/* 编辑弹窗样式 */
.edit-modal {
  @apply fixed inset-0 flex items-center justify-center z-50;
  background-color: rgba(0, 0, 0, 0.5);
}

.edit-dialog {
  @apply bg-white rounded-xl w-80 overflow-hidden;
}

.edit-header {
  @apply flex items-center justify-between px-4 py-3 border-b border-gray-100;
}

.edit-header span {
  @apply text-base font-medium;
}

.close-btn {
  @apply w-8 h-8 flex items-center justify-center text-gray-400;
}

.edit-body {
  @apply px-4 py-6;
}

.input-group {
  @apply flex items-center border border-gray-200 rounded-lg px-3 py-2;
}

.input-prefix {
  @apply text-xl text-gray-600 mr-2;
}

.amount-input {
  @apply flex-1 text-xl outline-none;
}

.amount-input::-webkit-inner-spin-button,
.amount-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.edit-footer {
  @apply flex border-t border-gray-100;
}

.cancel-btn, .confirm-btn {
  @apply flex-1 py-3 text-center text-base;
}

.cancel-btn {
  @apply text-gray-600 border-r border-gray-100;
}

.confirm-btn {
  @apply text-green-500 font-medium;
}
</style>