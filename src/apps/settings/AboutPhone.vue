<script setup lang="ts">
/**
 * 关于手机页面
 * 支持 iOS 和 Android 两种风格显示
 * 支持用户自定义设备信息
 */
import { computed, ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useTheme } from '@/composables/useTheme'
import { useDeviceStore } from '@/stores/deviceStore'

const router = useRouter()
const { currentTheme } = useTheme()
const deviceStore = useDeviceStore()

// 本地存储键
const DEVICE_INFO_STORAGE_KEY = 'phone-sim-device-info'

// 彩蛋相关状态
const versionClickCount = ref(0)
const showEasterEgg = ref(false)
const easterEggTriggered = ref(false)
let clickTimeout: ReturnType<typeof setTimeout> | null = null

// Android 彩蛋交互状态
const androidRotation = ref(0)
const androidScale = ref(1)
const androidBgColor = ref('var(--color-primary)')

function handleAndroidEasterClick() {
  androidRotation.value += 180
  androidScale.value = 0.8
  setTimeout(() => {
    androidScale.value = 1
  }, 300)
  
  // 随机颜色
  const hue = Math.floor(Math.random() * 360)
  androidBgColor.value = `hsl(${hue}, 70%, 60%)`
}

// 编辑弹窗相关
const showEditDialog = ref(false)
const editingField = ref<{ key: string; label: string; value: string } | null>(null)
const editInputValue = ref('')

// 判断当前是否是 iOS 风格（根据主题 ID 或 notchStyle）
const isIOSStyle = computed(() => {
  const themeId = currentTheme.value.id
  // iOS 主题或带有 dynamic-island/notch 的主题视为 iOS 风格
  if (themeId === 'ios' || themeId === 'dark') return true
  if (themeId === 'android') return false
  // 默认根据 notchStyle 判断
  return currentTheme.value.device.notchStyle === 'dynamic-island' ||
         currentTheme.value.device.notchStyle === 'notch'
})

// 默认设备信息
const defaultDeviceInfo = {
  // iOS 风格信息
  ios: {
    name: '小手机',
    systemVersion: 'iOS 17.2.1',
    modelName: 'iPhone 15 Pro',
    modelNumber: 'A3101',
    serialNumber: 'XSMP12345678',
    capacity: '256 GB',
    available: '128.5 GB',
    wifiAddress: '00:11:22:33:44:55',
    bluetoothAddress: 'AA:BB:CC:DD:EE:FF',
    imei: '123456789012345',
    modemFirmware: '2.50.01',
    legalAndRegulatory: '查看法律与监管信息',
  },
  // Android 风格信息
  android: {
    deviceName: '小手机',
    phoneNumber: '+86 138****8888',
    model: 'Pixel 8 Pro',
    androidVersion: 'Android 14',
    oneUIVersion: null as string | null, // 原生 Android 没有 OneUI
    basebandVersion: 'g5300g-231208-231212-B-11842438',
    kernelVersion: '6.1.23-android14-5-00001',
    buildNumber: 'AP2A.240805.005',
    seAndroidStatus: '强制执行模式',
    knoxVersion: null as string | null, // 原生 Android 没有 Knox
    serviceProviderSW: 'OPEN/OPEN/OPEN',
    securitySoftware: '2024年12月1日',
    imei: '123456789012345',
    imeiSV: '01',
    eid: '89...0123',
    cpuInfo: 'Google Tensor G3',
    ramInfo: '12 GB',
    storageTotal: '256 GB',
    storageUsed: '127.5 GB',
    batteryStatus: '良好',
    batteryCapacity: '5050 mAh',
  },
}

// 可编辑字段配置
const editableFields = {
  ios: [
    { key: 'name', label: '设备名称' },
    { key: 'systemVersion', label: '系统版本' },
    { key: 'modelName', label: '机型名称' },
    { key: 'modelNumber', label: '型号号码' },
    { key: 'serialNumber', label: '序列号' },
    { key: 'capacity', label: '总容量' },
    { key: 'available', label: '可用容量' },
    { key: 'imei', label: 'IMEI' },
  ],
  android: [
    { key: 'deviceName', label: '设备名称' },
    { key: 'model', label: '型号' },
    { key: 'androidVersion', label: 'Android 版本' },
    { key: 'cpuInfo', label: '处理器' },
    { key: 'ramInfo', label: '内存' },
    { key: 'storageTotal', label: '总容量' },
    { key: 'storageUsed', label: '已用容量' },
    { key: 'buildNumber', label: '版本号' },
    { key: 'imei', label: 'IMEI' },
  ],
}

// 从本地存储加载设备信息
function loadDeviceInfo(): typeof defaultDeviceInfo {
  try {
    const saved = localStorage.getItem(DEVICE_INFO_STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      return {
        ios: { ...defaultDeviceInfo.ios, ...parsed.ios },
        android: { ...defaultDeviceInfo.android, ...parsed.android },
      }
    }
  } catch (error) {
    console.warn('[小手机] 加载设备信息失败:', error)
  }
  return { ...defaultDeviceInfo }
}

// 保存设备信息到本地存储
function saveDeviceInfo() {
  try {
    localStorage.setItem(DEVICE_INFO_STORAGE_KEY, JSON.stringify(deviceInfo.value))
  } catch (error) {
    console.warn('[小手机] 保存设备信息失败:', error)
  }
}

// 设备信息
const deviceInfo = ref(loadDeviceInfo())

// 监听变化自动保存
watch(deviceInfo, () => {
  saveDeviceInfo()
}, { deep: true })

// 解析存储容量字符串为数字（GB）
function parseStorageValue(value: string): number {
  const match = value.match(/^([\d.]+)\s*(GB|TB|MB)?$/i)
  if (!match) return 0
  
  let num = parseFloat(match[1])
  const unit = (match[2] || 'GB').toUpperCase()
  
  if (unit === 'TB') num *= 1024
  if (unit === 'MB') num /= 1024
  
  return num
}

// 格式化存储容量
function formatStorage(gb: number): string {
  if (gb >= 1024) {
    return `${(gb / 1024).toFixed(1)} TB`
  }
  if (gb < 1) {
    return `${(gb * 1024).toFixed(0)} MB`
  }
  return `${gb % 1 === 0 ? gb : gb.toFixed(1)} GB`
}

// 存储使用百分比（动态计算）
const storageUsagePercent = computed(() => {
  if (isIOSStyle.value) {
    const total = parseStorageValue(deviceInfo.value.ios.capacity)
    const available = parseStorageValue(deviceInfo.value.ios.available)
    if (total <= 0) return 0
    const used = total - available
    return Math.max(0, Math.min(100, Math.round((used / total) * 100)))
  } else {
    const total = parseStorageValue(deviceInfo.value.android.storageTotal)
    const used = parseStorageValue(deviceInfo.value.android.storageUsed)
    if (total <= 0) return 0
    return Math.max(0, Math.min(100, Math.round((used / total) * 100)))
  }
})

// 格式化存储显示（动态计算）
const storageDisplay = computed(() => {
  if (isIOSStyle.value) {
    const total = parseStorageValue(deviceInfo.value.ios.capacity)
    const available = parseStorageValue(deviceInfo.value.ios.available)
    const used = Math.max(0, total - available)
    return {
      used: formatStorage(used),
      total: deviceInfo.value.ios.capacity,
      available: deviceInfo.value.ios.available,
    }
  } else {
    return {
      used: deviceInfo.value.android.storageUsed,
      total: deviceInfo.value.android.storageTotal,
      available: formatStorage(
        parseStorageValue(deviceInfo.value.android.storageTotal) -
        parseStorageValue(deviceInfo.value.android.storageUsed)
      ),
    }
  }
})

function goBack() {
  router.back()
}

// 复制到剪贴板
function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(() => {
    // 可以添加 toast 提示
    console.log('已复制:', text)
  }).catch(err => {
    console.error('复制失败:', err)
  })
}

// 版本号点击处理（彩蛋 + 编辑）
function handleVersionClick() {
  // 清除之前的超时
  if (clickTimeout) {
    clearTimeout(clickTimeout)
  }
  
  versionClickCount.value++
  
  // 3秒内没有继续点击则重置计数
  clickTimeout = setTimeout(() => {
    if (versionClickCount.value < 5) {
      versionClickCount.value = 0
    }
  }, 3000)
  
  if (versionClickCount.value >= 5 && !easterEggTriggered.value) {
    easterEggTriggered.value = true
    showEasterEgg.value = true
  }
}

// 版本号点击（带编辑功能）
function handleVersionClickWithEdit(platform: 'ios' | 'android') {
  handleVersionClick()
  
  // 如果已经触发彩蛋，则不弹出编辑框
  if (versionClickCount.value >= 5) {
    return
  }
  
  // 第一次点击时弹出编辑框
  if (versionClickCount.value === 1) {
    const key = platform === 'ios' ? 'systemVersion' : 'androidVersion'
    const label = platform === 'ios' ? '系统版本' : 'Android 版本'
    openEditDialog(platform, key, label)
  }
}

// 关闭彩蛋
function closeEasterEgg() {
  showEasterEgg.value = false
}

// 获取点击提示文字
function getClickHint(): string {
  const remaining = 5 - versionClickCount.value
  if (remaining > 0 && versionClickCount.value > 0) {
    return `再点击 ${remaining} 次即可开启彩蛋`
  }
  return ''
}

// 打开编辑弹窗
function openEditDialog(platform: 'ios' | 'android', key: string, label: string) {
  const info = platform === 'ios' ? deviceInfo.value.ios : deviceInfo.value.android
  const value = (info as any)[key]
  editingField.value = { key, label, value: value || '' }
  editInputValue.value = value || ''
  showEditDialog.value = true
}

// 保存编辑
function saveEdit() {
  if (!editingField.value) return
  
  const { key } = editingField.value
  if (isIOSStyle.value) {
    (deviceInfo.value.ios as any)[key] = editInputValue.value
  } else {
    (deviceInfo.value.android as any)[key] = editInputValue.value
  }
  
  closeEditDialog()
}

// 关闭编辑弹窗
function closeEditDialog() {
  showEditDialog.value = false
  editingField.value = null
  editInputValue.value = ''
}

// 判断字段是否可编辑
function isFieldEditable(key: string): boolean {
  const fields = isIOSStyle.value ? editableFields.ios : editableFields.android
  return fields.some(f => f.key === key)
}

// 获取字段标签
function getFieldLabel(key: string): string {
  const fields = isIOSStyle.value ? editableFields.ios : editableFields.android
  const field = fields.find(f => f.key === key)
  return field?.label || key
}

// 重置为默认值
function resetToDefault() {
  if (confirm('确定要重置所有设备信息为默认值吗？')) {
    deviceInfo.value = JSON.parse(JSON.stringify(defaultDeviceInfo))
    saveDeviceInfo()
  }
}
</script>

<template>
  <div class="about-phone">
    <!-- 头部 -->
    <div class="app-header">
      <button class="app-back-btn" @click="goBack">
        <i class="fas fa-chevron-left"></i>
      </button>
      <h3>{{ isIOSStyle ? '关于本机' : '关于手机' }}</h3>
      <div class="w-8"></div>
    </div>

    <!-- iOS 风格内容 -->
    <div v-if="isIOSStyle" class="about-content ios-style">
      <!-- 设备图标和名称 -->
      <div class="ios-device-header">
        <div class="ios-device-icon">
          <i class="fas fa-mobile-alt"></i>
        </div>
        <div class="ios-device-name">{{ deviceInfo.ios.name }}</div>
      </div>

      <!-- 信息列表 -->
      <div class="ios-info-section">
        <div class="ios-info-group">
          <div class="ios-info-item editable" @click="openEditDialog('ios', 'name', '设备名称')">
            <span class="label">名称</span>
            <div class="value-with-edit">
              <span class="value">{{ deviceInfo.ios.name }}</span>
              <i class="fas fa-pen edit-icon"></i>
            </div>
          </div>
        </div>

        <div class="ios-info-group">
          <div class="ios-info-item editable" @click="handleVersionClickWithEdit('ios')">
            <span class="label">系统版本</span>
            <div class="value-container">
              <div class="value-with-edit">
                <span class="value">{{ deviceInfo.ios.systemVersion }}</span>
                <i class="fas fa-pen edit-icon"></i>
              </div>
              <span v-if="getClickHint()" class="click-hint">{{ getClickHint() }}</span>
            </div>
          </div>
          <div class="ios-info-item editable" @click="openEditDialog('ios', 'modelName', '机型名称')">
            <span class="label">机型名称</span>
            <div class="value-with-edit">
              <span class="value">{{ deviceInfo.ios.modelName }}</span>
              <i class="fas fa-pen edit-icon"></i>
            </div>
          </div>
          <div class="ios-info-item editable" @click="openEditDialog('ios', 'modelNumber', '型号号码')">
            <span class="label">型号号码</span>
            <div class="value-with-edit">
              <span class="value">{{ deviceInfo.ios.modelNumber }}</span>
              <i class="fas fa-pen edit-icon"></i>
            </div>
          </div>
          <div class="ios-info-item editable" @click="openEditDialog('ios', 'serialNumber', '序列号')">
            <span class="label">序列号</span>
            <div class="value-with-edit">
              <span class="value">{{ deviceInfo.ios.serialNumber }}</span>
              <i class="fas fa-pen edit-icon"></i>
            </div>
          </div>
        </div>

        <!-- 存储空间 -->
        <div class="ios-info-group">
          <div class="ios-storage-header">
            <i class="fas fa-apple-alt text-2xl mb-2" style="color: var(--color-primary)"></i>
            <div class="ios-storage-title">{{ deviceInfo.ios.modelName }}</div>
          </div>
          <div class="ios-storage-bar-container">
            <div class="ios-storage-bar">
              <div
                class="ios-storage-used"
                :style="{ width: storageUsagePercent + '%' }"
              ></div>
            </div>
            <div class="ios-storage-labels">
              <span>{{ storageDisplay.used }} 已使用</span>
              <span>{{ storageDisplay.available }} 可用</span>
            </div>
          </div>
          <div class="ios-info-item editable" @click="openEditDialog('ios', 'capacity', '总容量')">
            <span class="label">总容量</span>
            <div class="value-with-edit">
              <span class="value">{{ deviceInfo.ios.capacity }}</span>
              <i class="fas fa-pen edit-icon"></i>
            </div>
          </div>
          <div class="ios-info-item editable" @click="openEditDialog('ios', 'available', '可用容量')">
            <span class="label">可用容量</span>
            <div class="value-with-edit">
              <span class="value">{{ deviceInfo.ios.available }}</span>
              <i class="fas fa-pen edit-icon"></i>
            </div>
          </div>
        </div>

        <!-- 网络信息 -->
        <div class="ios-info-group">
          <div class="ios-info-item">
            <span class="label">无线局域网地址</span>
            <span class="value mono">{{ deviceInfo.ios.wifiAddress }}</span>
          </div>
          <div class="ios-info-item">
            <span class="label">蓝牙</span>
            <span class="value mono">{{ deviceInfo.ios.bluetoothAddress }}</span>
          </div>
          <div class="ios-info-item">
            <span class="label">调制解调器固件</span>
            <span class="value">{{ deviceInfo.ios.modemFirmware }}</span>
          </div>
          <div class="ios-info-item editable" @click="openEditDialog('ios', 'imei', 'IMEI')">
            <span class="label">IMEI</span>
            <div class="value-with-edit">
              <span class="value mono">{{ deviceInfo.ios.imei }}</span>
              <i class="fas fa-pen edit-icon"></i>
            </div>
          </div>
        </div>

        <!-- 法律与监管 -->
        <div class="ios-info-group">
          <div class="ios-info-item clickable">
            <span class="label">法律与监管</span>
            <i class="fas fa-chevron-right"></i>
          </div>
        </div>

        <!-- 重置按钮 -->
        <div class="ios-info-group">
          <div class="ios-info-item clickable danger" @click="resetToDefault">
            <span class="label">重置设备信息</span>
            <i class="fas fa-chevron-right"></i>
          </div>
        </div>

        <!-- 版权信息 -->
        <div class="ios-copyright">
          <p>此手机模拟器由 Vue3 + TypeScript 构建</p>
          <p class="mt-1">版本 1.0.0</p>
          <p class="mt-1 text-xs opacity-60">点击带有 <i class="fas fa-pen text-xs"></i> 的项可编辑</p>
        </div>
      </div>
    </div>

    <!-- Android 风格内容 -->
    <div v-else class="about-content android-style">
      <!-- 设备图标和名称 -->
      <div class="android-device-header">
        <div class="android-device-icon">
          <i class="fab fa-android"></i>
        </div>
        <div class="android-device-info">
          <div class="android-device-name">{{ deviceInfo.android.deviceName }}</div>
          <div class="android-device-model">{{ deviceInfo.android.model }}</div>
        </div>
      </div>

      <!-- 状态卡片 -->
      <div class="android-status-cards">
        <div class="android-status-card clickable" @click="openEditDialog('android', 'storageTotal', '总容量')">
          <div class="android-status-icon storage">
            <i class="fas fa-database"></i>
          </div>
          <div class="android-status-info">
            <div class="android-status-label">内部存储 <i class="fas fa-pen edit-icon-small"></i></div>
            <div class="android-status-value">{{ storageDisplay.used }} / {{ storageDisplay.total }}</div>
            <div class="about-storage-bar">
              <div
                class="about-storage-bar-fill"
                :style="{ width: storageUsagePercent + '%' }"
              ></div>
            </div>
          </div>
        </div>
        <div class="android-status-card">
          <div class="android-status-icon battery">
            <i class="fas fa-battery-full"></i>
          </div>
          <div class="android-status-info">
            <div class="android-status-label">电池状态</div>
            <div class="android-status-value">{{ deviceInfo.android.batteryStatus }}</div>
            <div class="android-status-detail">{{ deviceInfo.android.batteryCapacity }}</div>
          </div>
        </div>
      </div>

      <!-- 信息列表 -->
      <div class="android-info-section">
        <h4 class="android-section-title">设备信息</h4>
        <div class="android-info-group">
          <div class="android-info-item editable" @click="openEditDialog('android', 'deviceName', '设备名称')">
            <span class="label">设备名称</span>
            <div class="value-with-edit">
              <span class="value">{{ deviceInfo.android.deviceName }}</span>
              <i class="fas fa-pen edit-icon"></i>
            </div>
          </div>
          <div class="android-info-item editable" @click="openEditDialog('android', 'model', '型号')">
            <span class="label">型号</span>
            <div class="value-with-edit">
              <span class="value">{{ deviceInfo.android.model }}</span>
              <i class="fas fa-pen edit-icon"></i>
            </div>
          </div>
          <div class="android-info-item editable" @click="openEditDialog('android', 'cpuInfo', '处理器')">
            <span class="label">处理器</span>
            <div class="value-with-edit">
              <span class="value">{{ deviceInfo.android.cpuInfo }}</span>
              <i class="fas fa-pen edit-icon"></i>
            </div>
          </div>
          <div class="android-info-item editable" @click="openEditDialog('android', 'ramInfo', '内存')">
            <span class="label">内存</span>
            <div class="value-with-edit">
              <span class="value">{{ deviceInfo.android.ramInfo }}</span>
              <i class="fas fa-pen edit-icon"></i>
            </div>
          </div>
          <div class="android-info-item editable" @click="openEditDialog('android', 'storageTotal', '总容量')">
            <span class="label">总容量</span>
            <div class="value-with-edit">
              <span class="value">{{ deviceInfo.android.storageTotal }}</span>
              <i class="fas fa-pen edit-icon"></i>
            </div>
          </div>
          <div class="android-info-item editable" @click="openEditDialog('android', 'storageUsed', '已用容量')">
            <span class="label">已用容量</span>
            <div class="value-with-edit">
              <span class="value">{{ deviceInfo.android.storageUsed }}</span>
              <i class="fas fa-pen edit-icon"></i>
            </div>
          </div>
        </div>

        <h4 class="android-section-title">软件信息</h4>
        <div class="android-info-group">
          <div class="android-info-item editable" @click="handleVersionClickWithEdit('android')">
            <span class="label">Android 版本</span>
            <div class="value-container">
              <div class="value-with-edit">
                <span class="value">{{ deviceInfo.android.androidVersion }}</span>
                <i class="fas fa-pen edit-icon"></i>
              </div>
              <span v-if="getClickHint()" class="click-hint">{{ getClickHint() }}</span>
            </div>
          </div>
          <div class="android-info-item">
            <span class="label">基带版本</span>
            <span class="value small">{{ deviceInfo.android.basebandVersion }}</span>
          </div>
          <div class="android-info-item">
            <span class="label">内核版本</span>
            <span class="value small">{{ deviceInfo.android.kernelVersion }}</span>
          </div>
          <div class="android-info-item editable" @click="openEditDialog('android', 'buildNumber', '版本号')">
            <span class="label">版本号</span>
            <div class="value-with-edit">
              <span class="value">{{ deviceInfo.android.buildNumber }}</span>
              <i class="fas fa-pen edit-icon"></i>
            </div>
          </div>
          <div class="android-info-item">
            <span class="label">SE Android 状态</span>
            <span class="value">{{ deviceInfo.android.seAndroidStatus }}</span>
          </div>
          <div class="android-info-item">
            <span class="label">安全软件版本</span>
            <span class="value">{{ deviceInfo.android.securitySoftware }}</span>
          </div>
        </div>

        <h4 class="android-section-title">设备标识</h4>
        <div class="android-info-group">
          <div class="android-info-item editable" @click="openEditDialog('android', 'imei', 'IMEI')">
            <span class="label">IMEI</span>
            <div class="value-with-edit">
              <span class="value mono">{{ deviceInfo.android.imei }}</span>
              <i class="fas fa-pen edit-icon"></i>
            </div>
          </div>
          <div class="android-info-item">
            <span class="label">IMEI SV</span>
            <span class="value">{{ deviceInfo.android.imeiSV }}</span>
          </div>
          <div class="android-info-item">
            <span class="label">EID</span>
            <span class="value mono">{{ deviceInfo.android.eid }}</span>
          </div>
        </div>

        <!-- 法律信息 -->
        <div class="android-info-group">
          <div class="android-info-item clickable">
            <div class="item-with-icon">
              <i class="fas fa-gavel"></i>
              <span class="label">法律信息</span>
            </div>
            <i class="fas fa-chevron-right"></i>
          </div>
          <div class="android-info-item clickable">
            <div class="item-with-icon">
              <i class="fas fa-certificate"></i>
              <span class="label">认证</span>
            </div>
            <i class="fas fa-chevron-right"></i>
          </div>
        </div>

        <!-- 重置按钮 -->
        <div class="android-info-group">
          <div class="android-info-item clickable danger" @click="resetToDefault">
            <div class="item-with-icon">
              <i class="fas fa-undo"></i>
              <span class="label">重置设备信息</span>
            </div>
            <i class="fas fa-chevron-right"></i>
          </div>
        </div>

        <!-- 版权信息 -->
        <div class="android-copyright">
          <p>此手机模拟器由 Vue3 + TypeScript 构建</p>
          <p>版本 1.0.0</p>
          <p class="mt-1 text-xs opacity-60">点击带有 <i class="fas fa-pen text-xs"></i> 的项可编辑</p>
          <div class="android-logo-container">
            <i class="fab fa-android android-logo"></i>
          </div>
        </div>
      </div>
    </div>

    <!-- 编辑弹窗 -->
    <Transition name="modal">
      <div v-if="showEditDialog" class="edit-dialog-overlay" @click.self="closeEditDialog">
        <div class="edit-dialog-modal">
          <div class="edit-dialog-header">
            <h3>编辑{{ editingField?.label }}</h3>
            <button class="edit-dialog-close" @click="closeEditDialog">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="edit-dialog-body">
            <input
              v-model="editInputValue"
              type="text"
              class="edit-input"
              :placeholder="'请输入' + editingField?.label"
              @keyup.enter="saveEdit"
            />
          </div>
          <div class="edit-dialog-footer">
            <button class="btn-cancel" @click="closeEditDialog">取消</button>
            <button class="btn-save" @click="saveEdit">保存</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 彩蛋弹窗 -->
    <Transition name="easter-egg">
      <div v-if="showEasterEgg" class="easter-egg-overlay" @click.self="closeEasterEgg">
        
        <!-- iOS 风格: 极简磨砂质感 -->
        <div v-if="isIOSStyle" class="ios-easter-card">
          <div class="ios-blur-bg"></div>
          <div class="ios-card-content">
            <div class="ios-icon-anim">
              <i class="fas fa-code"></i>
              <div class="ripple"></div>
            </div>
            <h3>Developer Mode</h3>
            <p>You are now a developer.</p>
            <div class="ios-divider"></div>
            <button @click="closeEasterEgg">OK</button>
          </div>
        </div>

        <!-- Android 风格: 沉浸式互动 -->
        <div
          v-else
          class="android-easter-fullscreen"
          :style="{ backgroundColor: androidBgColor }"
          @click="handleAndroidEasterClick"
        >
          <div class="android-space-logo" :style="{ transform: `rotate(${androidRotation}deg) scale(${androidScale})` }">
            <div class="planet-ring"></div>
            <div class="android-head">
              <div class="eyes left"></div>
              <div class="eyes right"></div>
            </div>
            <div class="version-text">14</div>
          </div>
          <div class="android-hint">ANDROID 14</div>
          <button class="android-close-btn" @click.stop="closeEasterEgg">
            <i class="fas fa-times"></i>
          </button>
        </div>

      </div>
    </Transition>
  </div>
</template>

<style scoped>
.about-phone {
  @apply flex flex-col;
  background-color: var(--color-background);
  transition: background-color 0.3s ease;
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.about-content {
  @apply flex-1 overflow-y-auto;
}

/* ==================== iOS 风格 ==================== */
.ios-style {
  @apply p-4;
}

.ios-device-header {
  @apply flex flex-col items-center py-6;
}

.ios-device-icon {
  @apply w-24 h-24 rounded-3xl flex items-center justify-center mb-3;
  background: linear-gradient(145deg, var(--color-surface), var(--color-surface-variant));
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
}

.ios-device-icon i {
  @apply text-4xl;
  color: var(--color-primary);
}

.ios-device-name {
  @apply text-xl font-semibold;
  color: var(--color-text);
}

.ios-info-section {
  @apply space-y-4;
}

.ios-info-group {
  @apply rounded-xl overflow-hidden;
  background-color: var(--color-surface);
}

.ios-info-item {
  @apply flex items-center justify-between px-4 py-3;
  border-bottom: 0.5px solid var(--color-border);
}

.ios-info-item:last-child {
  border-bottom: none;
}

.ios-info-item.clickable {
  @apply cursor-pointer active:bg-opacity-80;
}

.ios-info-item .label {
  @apply text-sm;
  color: var(--color-text);
}

.ios-info-item .value {
  @apply text-sm;
  color: var(--color-text-secondary);
}

.ios-info-item .value.mono {
  font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
  @apply text-xs;
}

.ios-info-item i.fa-chevron-right {
  @apply text-xs ml-2;
  color: var(--color-text-secondary);
  opacity: 0.5;
}

.ios-info-item.danger .label {
  color: var(--color-error);
}

/* 可编辑项样式 */
.ios-info-item.editable,
.android-info-item.editable {
  @apply cursor-pointer;
}

.ios-info-item.editable:active,
.android-info-item.editable:active {
  background-color: var(--color-surface-variant);
}

.value-with-edit {
  @apply flex items-center gap-2;
}

.edit-icon {
  @apply text-xs;
  color: var(--color-primary);
  opacity: 0.6;
}

.edit-icon-small {
  @apply text-xs;
  color: var(--color-primary);
  opacity: 0.5;
  margin-left: 2px;
}

.ios-info-item.editable:hover .edit-icon,
.android-info-item.editable:hover .edit-icon,
.android-status-card.clickable:hover .edit-icon-small {
  opacity: 1;
}

.android-status-card.clickable {
  @apply cursor-pointer transition-all;
}

.android-status-card.clickable:active {
  transform: scale(0.98);
}

/* iOS 存储显示 */
.ios-storage-header {
  @apply flex flex-col items-center py-4;
}

.ios-storage-title {
  @apply text-base font-medium;
  color: var(--color-text);
}

.ios-storage-bar-container {
  @apply px-4 pb-4;
}

.ios-storage-bar {
  @apply h-2 rounded-full overflow-hidden;
  background-color: var(--color-surface-variant);
}

.ios-storage-used {
  @apply h-full rounded-full;
  background: linear-gradient(90deg, var(--color-primary), var(--color-secondary));
  transition: width 0.5s ease;
}

.ios-storage-labels {
  @apply flex justify-between mt-2 text-xs;
  color: var(--color-text-secondary);
}

.ios-copyright {
  @apply text-center py-6 text-xs;
  color: var(--color-text-secondary);
}

/* ==================== Android 风格 ==================== */
.android-style {
  @apply pb-8;
}

.android-device-header {
  @apply flex items-center gap-4 p-6;
  background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
}

.android-device-icon {
  @apply w-20 h-20 rounded-full flex items-center justify-center;
  background-color: rgba(255, 255, 255, 0.2);
}

.android-device-icon i {
  @apply text-4xl text-white;
}

.android-device-info {
  @apply flex-1;
}

.android-device-name {
  @apply text-xl font-semibold text-white;
}

.android-device-model {
  @apply text-sm text-white/80 mt-1;
}

/* Android 状态卡片 */
.android-status-cards {
  @apply grid grid-cols-2 gap-3 p-4 -mt-4;
}

.android-status-card {
  @apply p-3 rounded-2xl flex items-start gap-3;
  background-color: var(--color-surface);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.android-status-icon {
  @apply w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0;
}

.android-status-icon.storage {
  background-color: rgba(103, 80, 164, 0.1);
  color: var(--color-primary);
}

.android-status-icon.battery {
  background-color: rgba(76, 175, 80, 0.1);
  color: var(--color-success);
}

.android-status-info {
  @apply flex-1 min-w-0;
}

.android-status-label {
  @apply text-xs;
  color: var(--color-text-secondary);
}

.android-status-value {
  @apply text-sm font-medium mt-0.5;
  color: var(--color-text);
}

.android-status-detail {
  @apply text-xs mt-0.5;
  color: var(--color-text-secondary);
}

.about-storage-bar {
  @apply h-1.5 rounded-full mt-2 overflow-hidden;
  background-color: var(--color-surface-variant);
}

.about-storage-bar-fill {
  @apply h-full rounded-full;
  background-color: var(--color-primary);
  transition: width 0.5s ease;
}

/* Android 信息列表 */
.android-info-section {
  @apply px-4;
}

.android-section-title {
  @apply text-xs font-medium uppercase tracking-wider py-3 px-2;
  color: var(--color-primary);
}

.android-info-group {
  @apply rounded-2xl overflow-hidden mb-4;
  background-color: var(--color-surface);
}

.android-info-item {
  @apply flex items-center justify-between px-4 py-3.5;
  border-bottom: 1px solid var(--color-border);
}

.android-info-item:last-child {
  border-bottom: none;
}

.android-info-item.clickable {
  @apply cursor-pointer;
}

.android-info-item.clickable:active {
  background-color: var(--color-surface-variant);
}

.android-info-item .label {
  @apply text-sm;
  color: var(--color-text);
}

.android-info-item .value {
  @apply text-sm text-right;
  color: var(--color-text-secondary);
}

.android-info-item .value.small {
  @apply text-xs max-w-[50%] truncate;
}

.android-info-item .value.mono {
  font-family: 'Roboto Mono', 'Monaco', 'Consolas', monospace;
  @apply text-xs;
}

.android-info-item .value-container,
.ios-info-item .value-container {
  @apply flex flex-col items-end;
}

.click-hint {
  @apply text-xs mt-0.5;
  color: var(--color-primary);
  animation: pulse 1s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.android-info-item i.fa-chevron-right {
  @apply text-xs ml-2;
  color: var(--color-text-secondary);
  opacity: 0.5;
}

.android-info-item.danger .label,
.android-info-item.danger .item-with-icon i {
  color: var(--color-error);
}

.item-with-icon {
  @apply flex items-center gap-3;
}

.item-with-icon i {
  @apply text-lg;
  color: var(--color-primary);
}

.android-copyright {
  @apply text-center py-6 text-xs;
  color: var(--color-text-secondary);
}

.android-logo-container {
  @apply mt-4;
}

.android-logo {
  @apply text-5xl;
  color: var(--color-success);
  animation: androidBounce 2s ease-in-out infinite;
}

@keyframes androidBounce {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-5px);
  }
}

/* ==================== 彩蛋样式 ==================== */
.easter-egg-overlay {
  position: absolute;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* iOS 风格彩蛋 */
.ios-easter-card {
  position: relative;
  width: 280px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(20px);
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  animation: iosPopIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.dark .ios-easter-card {
  background: rgba(30, 30, 30, 0.85);
}

.ios-card-content {
  @apply flex flex-col items-center p-6 text-center;
}

.ios-icon-anim {
  @apply w-16 h-16 rounded-full flex items-center justify-center mb-4 relative;
  background: var(--color-primary);
  color: white;
  font-size: 1.5rem;
}

.ios-icon-anim .ripple {
  position: absolute;
  inset: -4px;
  border: 2px solid var(--color-primary);
  border-radius: 50%;
  opacity: 0;
  animation: ripple 2s infinite;
}

.ios-card-content h3 {
  @apply text-lg font-bold mb-1;
  color: var(--color-text);
}

.ios-card-content p {
  @apply text-sm;
  color: var(--color-text-secondary);
}

.ios-divider {
  @apply w-full h-px my-4;
  background: var(--color-border);
}

.ios-card-content button {
  @apply w-full py-2 text-base font-semibold;
  color: var(--color-primary);
}

.ios-card-content button:active {
  opacity: 0.6;
}

@keyframes iosPopIn {
  0% { transform: scale(0.8); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

@keyframes ripple {
  0% { transform: scale(1); opacity: 0.6; }
  100% { transform: scale(1.5); opacity: 0; }
}

/* Android 风格彩蛋 */
.android-easter-fullscreen {
  position: absolute;
  inset: 0;
  display: flex;
  flex-col: column;
  align-items: center;
  justify-content: center;
  transition: background-color 0.5s ease;
  overflow: hidden;
  animation: fadeIn 0.3s ease;
}

.android-space-logo {
  position: relative;
  width: 200px;
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.planet-ring {
  position: absolute;
  width: 100%;
  height: 100%;
  border: 15px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  transform: rotate(-45deg);
}

.android-head {
  width: 120px;
  height: 100px;
  background: #3DDC84;
  border-radius: 60px 60px 0 0;
  position: relative;
  z-index: 2;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 20px;
  padding-bottom: 20px;
}

.android-head .eyes {
  width: 10px;
  height: 10px;
  background: white;
  border-radius: 50%;
}

.version-text {
  position: absolute;
  font-size: 120px;
  font-weight: 900;
  color: rgba(255, 255, 255, 0.2);
  z-index: 1;
}

.android-hint {
  margin-top: 40px;
  font-size: 14px;
  letter-spacing: 4px;
  color: rgba(255, 255, 255, 0.6);
  font-weight: bold;
}

.android-close-btn {
  position: absolute;
  bottom: 40px;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.2);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(4px);
  transition: all 0.2s;
}

.android-close-btn:active {
  transform: scale(0.9);
  background: rgba(0, 0, 0, 0.4);
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* ==================== 编辑弹窗样式 ==================== */
.edit-dialog-overlay {
  position: absolute;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.edit-dialog-modal {
  background-color: var(--color-surface);
  border-radius: 1rem;
  width: 90%;
  max-width: 300px;
  overflow: hidden;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}

.edit-dialog-header {
  @apply flex items-center justify-between px-4 py-3;
  border-bottom: 1px solid var(--color-border);
}

.edit-dialog-header h3 {
  @apply text-base font-semibold;
  color: var(--color-text);
}

.edit-dialog-close {
  @apply w-8 h-8 flex items-center justify-center rounded-full;
  color: var(--color-text-secondary);
}

.edit-dialog-close:hover {
  background-color: var(--color-surface-variant);
}

.edit-dialog-body {
  @apply p-4;
}

.edit-input {
  @apply w-full px-4 py-3 rounded-xl text-base;
  background-color: var(--color-surface-variant);
  border: 1px solid var(--color-border);
  color: var(--color-text);
  outline: none;
  transition: border-color 0.2s;
}

.edit-input:focus {
  border-color: var(--color-primary);
}

.edit-input::placeholder {
  color: var(--color-text-secondary);
}

.edit-dialog-footer {
  @apply flex gap-3 p-4;
  border-top: 1px solid var(--color-border);
}

.btn-cancel,
.btn-save {
  @apply flex-1 py-2.5 rounded-xl font-medium text-sm;
  transition: all 0.2s;
}

.btn-cancel {
  background-color: var(--color-surface-variant);
  color: var(--color-text);
}

.btn-cancel:hover {
  background-color: var(--color-border);
}

.btn-save {
  background-color: var(--color-primary);
  color: white;
}

.btn-save:hover {
  opacity: 0.9;
}

/* 弹窗动画 */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-active .edit-dialog-modal,
.modal-leave-active .edit-dialog-modal {
  transition: transform 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .edit-dialog-modal {
  transform: scale(0.9);
}

.modal-leave-to .edit-dialog-modal {
  transform: scale(0.9);
}

/* 头部样式 */
.app-header {
  @apply flex items-center justify-between px-4 py-3;
  background-color: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  position: sticky;
  top: 0;
  z-index: 10;
}

.app-header h3 {
  @apply text-lg font-semibold;
  color: var(--color-text);
}

.app-back-btn {
  @apply w-8 h-8 flex items-center justify-center rounded-full;
  color: var(--color-primary);
  transition: background-color 0.2s;
}

.app-back-btn:hover {
  background-color: var(--color-surface-variant);
}
</style>