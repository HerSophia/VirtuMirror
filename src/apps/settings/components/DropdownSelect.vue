<script setup lang="ts">
/**
 * 下拉选择组件
 * 用于从多个选项中选择一个
 */
import { ref, computed, nextTick, watch } from 'vue'
import { onClickOutside } from '@vueuse/core'

export interface DropdownOption {
  value: string
  label: string
  description?: string
  extra?: string // 额外信息，如尺寸
}

const props = withDefaults(defineProps<{
  /** 当前选中值 */
  modelValue: string
  /** 选项列表 */
  options: DropdownOption[]
  /** 是否禁用 */
  disabled?: boolean
  /** 对齐方式 */
  align?: 'left' | 'right' | 'auto'
}>(), {
  disabled: false,
  align: 'auto'
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const isOpen = ref(false)
const triggerRef = ref<HTMLElement | null>(null)
const menuRef = ref<HTMLElement | null>(null)
const menuStyle = ref({
  top: '0px',
  left: '0px',
  width: '0px',
  minWidth: '200px'
})

const selectedOption = computed(() => 
  props.options.find(o => o.value === props.modelValue)
)

const selectedLabel = computed(() => 
  selectedOption.value?.label || ''
)

function toggle() {
  if (!props.disabled) {
    isOpen.value = !isOpen.value
  }
}

function select(value: string) {
  emit('update:modelValue', value)
  isOpen.value = false
}

// Click outside handling
onClickOutside(triggerRef, () => {
  isOpen.value = false
}, { ignore: [menuRef] })

// Position calculation
function updatePosition() {
  if (triggerRef.value) {
    const rect = triggerRef.value.getBoundingClientRect()
    const menuWidth = Math.max(rect.width, 200)
    
    // Vertical positioning
    const spaceBelow = window.innerHeight - rect.bottom
    const menuHeight = Math.min(props.options.length * 50 + 20, 250) // Estimate height
    
    let top = rect.bottom + 4
    // If not enough space below, show above
    if (spaceBelow < menuHeight && rect.top > menuHeight) {
       // Ideally we would position bottom-up, but for simplicity we calculate top
       // Note: Since we don't know exact height before render, this is an estimate.
       // For exact positioning "above", we'd need to measure menuRef after render.
       // But usually there is space below on a phone simulator.
       // Let's stick to below unless critical.
    }
    
    // Horizontal positioning
    let alignRight = false
    
    if (props.align === 'right') {
      alignRight = true
    } else if (props.align === 'left') {
      alignRight = false
    } else {
      // Auto: prefer right align if on the right half of screen
      if (rect.left + (rect.width / 2) > window.innerWidth / 2) {
        alignRight = true
      }
      
      // Safety check: if right align pushes it off-screen left?
      if (alignRight && rect.right - menuWidth < 0) {
        alignRight = false
      }
      // Safety check: if left align pushes it off-screen right?
      else if (!alignRight && rect.left + menuWidth > window.innerWidth) {
        alignRight = true
      }
    }

    if (alignRight) {
      menuStyle.value = {
        top: `${top}px`,
        left: `${rect.right - menuWidth}px`,
        width: `${menuWidth}px`,
        minWidth: `${menuWidth}px`
      }
    } else {
      menuStyle.value = {
        top: `${top}px`,
        left: `${rect.left}px`,
        width: `${menuWidth}px`,
        minWidth: `${menuWidth}px`
      }
    }
  }
}

watch(isOpen, async (val) => {
  if (val) {
    await nextTick()
    updatePosition()
  }
})
</script>

<template>
  <div class="dropdown-select" :class="{ disabled }">
    <!-- 触发器 -->
    <div ref="triggerRef" class="dropdown-trigger" @click="toggle">
      <span class="dropdown-value">{{ selectedLabel }}</span>
      <i class="fas" :class="isOpen ? 'fa-chevron-up' : 'fa-chevron-down'" />
    </div>
    
    <!-- 下拉菜单 (Teleported to body) -->
    <Teleport to="body">
      <Transition name="dropdown">
        <div 
          v-if="isOpen" 
          ref="menuRef"
          class="dropdown-menu"
          :style="menuStyle"
        >
          <div
            v-for="option in options"
            :key="option.value"
            class="dropdown-option"
            :class="{ active: modelValue === option.value }"
            @click="select(option.value)"
          >
            <div class="option-info">
              <span class="option-label">{{ option.label }}</span>
              <span v-if="option.description" class="option-desc">{{ option.description }}</span>
            </div>
            <span v-if="option.extra" class="option-extra">{{ option.extra }}</span>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.dropdown-select {
  @apply relative;
}

.dropdown-select.disabled {
  @apply opacity-50 pointer-events-none;
}

.dropdown-trigger {
  @apply flex items-center justify-end gap-2 cursor-pointer select-none;
  color: var(--color-text-secondary);
  min-width: 100px; /* Ensure click area */
  height: 100%;
}

.dropdown-value {
  color: var(--color-text-secondary);
  @apply truncate max-w-[150px];
}

/* Menu styles for Fixed positioning */
.dropdown-menu {
  @apply fixed z-[9999];
  @apply max-h-[300px] overflow-y-auto;
  @apply rounded-lg;
  background-color: var(--color-surface-variant);
  border: 1px solid var(--color-border);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
  /* Width and Position are set via inline styles */
}

.dropdown-option {
  @apply flex items-center justify-between px-4 py-2.5;
  @apply last:border-b-0;
  @apply cursor-pointer transition-colors select-none;
  border-bottom: 1px solid var(--color-border);
}

.dropdown-option:hover {
  background-color: var(--color-surface);
}

.dropdown-option.active {
  background-color: color-mix(in srgb, var(--color-primary) 15%, transparent);
}

.dropdown-option.active .option-label {
  color: var(--color-primary);
  @apply font-medium;
}

.option-info {
  @apply flex flex-col gap-0.5 flex-1 min-w-0;
}

.option-label {
  @apply text-sm truncate;
  color: var(--color-text);
}

.option-desc {
  @apply text-xs truncate opacity-80;
  color: var(--color-text-secondary);
}

.option-extra {
  @apply text-xs font-mono ml-2;
  color: var(--color-text-secondary);
}

/* 下拉动画 */
.dropdown-enter-active,
.dropdown-leave-active {
  @apply transition-all duration-200 ease-out;
}

.dropdown-enter-from,
.dropdown-leave-to {
  @apply opacity-0;
  transform: translateY(-8px);
}

.dropdown-enter-to,
.dropdown-leave-from {
  @apply opacity-100;
  transform: translateY(0);
}
</style>
