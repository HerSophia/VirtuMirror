/**
 * 钱包状态管理
 * 管理零钱、零钱通等金融数据
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useWalletStore = defineStore('wallet', () => {
  // 零钱余额
  const balance = ref(1437.87)
  
  // 零钱通余额
  const fundBalance = ref(0.00)
  
  // 零钱通收益率（基础值）
  const baseFundRate = ref(1.06)
  
  // 随机波动后的收益率
  const fundRate = computed(() => {
    // 在基础值上下浮动 0.1%
    const fluctuation = (Math.random() - 0.5) * 0.2
    return Math.max(0.5, baseFundRate.value + fluctuation)
  })
  
  // 格式化金额显示
  function formatAmount(amount: number): string {
    return amount.toFixed(2)
  }
  
  // 格式化收益率显示
  function formatRate(rate: number): string {
    return rate.toFixed(2) + '%'
  }
  
  // 更新零钱余额
  function setBalance(amount: number) {
    balance.value = Math.max(0, amount)
  }
  
  // 更新零钱通余额
  function setFundBalance(amount: number) {
    fundBalance.value = Math.max(0, amount)
  }
  
  // 转入零钱通（从零钱转到零钱通）
  function transferToFund(amount: number) {
    if (amount > 0 && amount <= balance.value) {
      balance.value -= amount
      fundBalance.value += amount
      return true
    }
    return false
  }
  
  // 转出零钱通（从零钱通转到零钱）
  function transferFromFund(amount: number) {
    if (amount > 0 && amount <= fundBalance.value) {
      fundBalance.value -= amount
      balance.value += amount
      return true
    }
    return false
  }
  
  // 总资产
  const totalAssets = computed(() => balance.value + fundBalance.value)
  
  return {
    balance,
    fundBalance,
    fundRate,
    baseFundRate,
    totalAssets,
    formatAmount,
    formatRate,
    setBalance,
    setFundBalance,
    transferToFund,
    transferFromFund
  }
}, {
  persist: true
})