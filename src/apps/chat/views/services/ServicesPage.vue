<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useWalletStore } from '@/stores/walletStore'
import { ChatHeader } from '../../components'

const router = useRouter()
const walletStore = useWalletStore()

// 钱包余额
const walletBalance = computed(() => walletStore.formatAmount(walletStore.balance))

// 金融理财服务列表
const financeServices = [
  { icon: 'fa-credit-card', label: '信用卡还款', color: 'text-green-500' },
  { icon: 'fa-fire', label: '理财通', color: 'text-blue-500' },
  { icon: 'fa-shield-halved', label: '保险服务', color: 'text-orange-500' }
]

// 生活服务列表
const lifeServices = [
  { icon: 'fa-mobile-screen', label: '手机充值', color: 'text-green-500' },
  { icon: 'fa-file-invoice-dollar', label: '生活缴费', color: 'text-green-500' },
  { icon: 'fa-q', label: 'Q币充值', color: 'text-blue-400' },
  { icon: 'fa-city', label: '城市服务', color: 'text-green-600' },
  { icon: 'fa-heart', label: '腾讯公益', color: 'text-red-400' },
  { icon: 'fa-kit-medical', label: '医疗健康', color: 'text-orange-400' }
]

// 交通出行列表
const travelServices = [
  { icon: 'fa-plane-departure', label: '出行服务', color: 'text-blue-500' },
  { icon: 'fa-train', label: '火车票机票', color: 'text-green-500' },
  { icon: 'fa-car', label: '滴滴出行', color: 'text-orange-500' },
  { icon: 'fa-hotel', label: '酒店民宿', color: 'text-green-600' }
]

// 购物消费列表
const shoppingServices = [
  { icon: 'fa-shopping-bag', label: '京东购物', color: 'text-red-500' },
  { icon: 'fa-gift', label: '拼多多', color: 'text-red-400' },
  { icon: 'fa-ticket', label: '电影演出', color: 'text-orange-500' },
  { icon: 'fa-utensils', label: '美团外卖', color: 'text-yellow-500' }
]
</script>

<template>
  <div class="services-page">
    <ChatHeader 
      title="服务"
      :show-back="true"
      :show-more="true"
      bg-color="#f5f5f5"
    />

    <!-- 内容区域 -->
    <div class="services-content">
      <!-- 顶部支付区域 -->
      <div class="payment-section">
        <div class="payment-item">
          <div class="payment-icon">
            <i class="fas fa-qrcode" />
          </div>
          <span class="payment-label">收付款</span>
        </div>
        <div class="payment-item" @click="router.push('/chat/wallet')">
          <div class="payment-icon">
            <i class="fas fa-wallet" />
          </div>
          <span class="payment-label">钱包</span>
          <span class="wallet-balance">¥{{ walletBalance }}</span>
        </div>
      </div>

      <!-- 金融理财 -->
      <div class="service-section">
        <div class="section-title">金融理财</div>
        <div class="service-grid cols-3">
          <div
            v-for="service in financeServices"
            :key="service.label"
            class="service-item"
          >
            <div class="service-icon" :class="service.color">
              <i class="fas" :class="service.icon" />
            </div>
            <span class="service-label">{{ service.label }}</span>
          </div>
        </div>
      </div>

      <!-- 生活服务 -->
      <div class="service-section">
        <div class="section-title">生活服务</div>
        <div class="service-grid cols-4">
          <div
            v-for="service in lifeServices"
            :key="service.label"
            class="service-item"
          >
            <div class="service-icon" :class="service.color">
              <i class="fas" :class="service.icon" />
            </div>
            <span class="service-label">{{ service.label }}</span>
          </div>
        </div>
      </div>

      <!-- 交通出行 -->
      <div class="service-section">
        <div class="section-title">交通出行</div>
        <div class="service-grid cols-4">
          <div
            v-for="service in travelServices"
            :key="service.label"
            class="service-item"
          >
            <div class="service-icon" :class="service.color">
              <i class="fas" :class="service.icon" />
            </div>
            <span class="service-label">{{ service.label }}</span>
          </div>
        </div>
      </div>

      <!-- 购物消费 -->
      <div class="service-section">
        <div class="section-title">购物消费</div>
        <div class="service-grid cols-4">
          <div
            v-for="service in shoppingServices"
            :key="service.label"
            class="service-item"
          >
            <div class="service-icon" :class="service.color">
              <i class="fas" :class="service.icon" />
            </div>
            <span class="service-label">{{ service.label }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.services-page {
  @apply h-full flex flex-col;
  background-color: #f5f5f5;
}

.services-content {
  @apply flex-1 overflow-y-auto px-3 pb-6;
}

/* 顶部支付区域 */
.payment-section {
  @apply flex rounded-xl p-6 mb-3 mt-2;
  background: linear-gradient(135deg, #07c160 0%, #06ad56 100%);
}

.payment-item {
  @apply flex-1 flex flex-col items-center justify-center cursor-pointer;
}

.payment-icon {
  @apply w-12 h-12 flex items-center justify-center text-white text-2xl mb-2;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 8px;
}

.payment-label {
  @apply text-white text-sm font-medium;
}

.wallet-balance {
  @apply text-white/70 text-xs mt-1;
}

/* 服务区块 */
.service-section {
  @apply bg-white rounded-xl p-4 mb-3;
}

.section-title {
  @apply text-sm text-gray-500 mb-4 px-1;
}

.service-grid {
  @apply grid gap-4;
}

.service-grid.cols-3 {
  grid-template-columns: repeat(3, 1fr);
}

.service-grid.cols-4 {
  grid-template-columns: repeat(4, 1fr);
}

.service-item {
  @apply flex flex-col items-center cursor-pointer;
}

.service-icon {
  @apply w-11 h-11 flex items-center justify-center text-xl mb-2 rounded-lg;
  background-color: #f8f8f8;
}

.service-label {
  @apply text-xs text-gray-700 text-center;
}
</style>