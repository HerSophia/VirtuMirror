/**
 * 全局对话框 Store
 * 用于在任何地方弹出对话框，不局限于特定 App
 */

import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import type { Component } from 'vue'

// ==================== 类型定义 ====================

/** 对话框类型 */
export type DialogType = 'confirm' | 'alert' | 'input' | 'custom'

/** 对话框按钮配置 */
export interface DialogButton {
  text: string
  type?: 'primary' | 'secondary' | 'danger'
  onClick?: () => void | Promise<void>
}

/** 确认对话框配置 */
export interface ConfirmDialogOptions {
  title: string
  message: string
  /** 详细说明（可选，显示在 message 下方） */
  detail?: string
  /** 确认按钮文本，默认 "确定" */
  confirmText?: string
  /** 取消按钮文本，默认 "取消" */
  cancelText?: string
  /** 确认按钮类型，默认 primary */
  confirmType?: 'primary' | 'danger'
  /** 图标类型 */
  icon?: 'warning' | 'danger' | 'info' | 'success' | 'question'
}

/** Alert 对话框配置 */
export interface AlertDialogOptions {
  title: string
  message: string
  /** 按钮文本，默认 "确定" */
  buttonText?: string
  /** 图标类型 */
  icon?: 'warning' | 'danger' | 'info' | 'success'
}

/** 输入对话框配置 */
export interface InputDialogOptions {
  title: string
  /** 输入框标签 */
  label?: string
  /** 输入框占位符 */
  placeholder?: string
  /** 初始值 */
  value?: string
  /** 输入类型 */
  type?: 'text' | 'password'
  /** 帮助文本 */
  helpText?: string
  /** 确认按钮文本 */
  confirmText?: string
  /** 取消按钮文本 */
  cancelText?: string
  /** 验证函数，返回错误信息或空字符串 */
  validate?: (value: string) => string | undefined
}

/** 自定义对话框配置 */
export interface CustomDialogOptions {
  /** 自定义组件 */
  component: Component
  /** 传递给组件的 props */
  props?: Record<string, unknown>
  /** 对话框宽度 */
  width?: string
}

/** 当前对话框状态 */
export interface DialogState {
  visible: boolean
  type: DialogType
  options: ConfirmDialogOptions | AlertDialogOptions | InputDialogOptions | CustomDialogOptions | null
  resolve: ((value: unknown) => void) | null
}

// ==================== Store 定义 ====================

export const useDialogStore = defineStore('dialog', () => {
  // ==================== 状态 ====================
  
  const visible = ref(false)
  const type = ref<DialogType>('confirm')
  const options = ref<DialogState['options']>(null)
  const resolveRef = shallowRef<((value: unknown) => void) | null>(null)
  
  // 对话框队列（支持多个对话框排队）
  const queue = ref<Array<{
    type: DialogType
    options: DialogState['options']
    resolve: (value: unknown) => void
  }>>([])
  
  // ==================== 私有方法 ====================
  
  function showNext() {
    if (queue.value.length === 0) {
      visible.value = false
      options.value = null
      resolveRef.value = null
      return
    }
    
    const next = queue.value.shift()!
    type.value = next.type
    options.value = next.options
    resolveRef.value = next.resolve
    visible.value = true
  }
  
  function closeDialog(result: unknown) {
    if (resolveRef.value) {
      resolveRef.value(result)
    }
    showNext()
  }
  
  // ==================== 公开方法 ====================
  
  /**
   * 显示确认对话框
   * @returns Promise<boolean> - 用户点击确认返回 true，取消返回 false
   */
  function confirm(opts: ConfirmDialogOptions): Promise<boolean> {
    return new Promise((resolve) => {
      queue.value.push({
        type: 'confirm',
        options: opts,
        resolve: resolve as (value: unknown) => void,
      })
      
      if (!visible.value) {
        showNext()
      }
    })
  }
  
  /**
   * 显示警告/提示对话框
   * @returns Promise<void> - 用户点击确认后 resolve
   */
  function alert(opts: AlertDialogOptions): Promise<void> {
    return new Promise((resolve) => {
      queue.value.push({
        type: 'alert',
        options: opts,
        resolve: resolve as (value: unknown) => void,
      })
      
      if (!visible.value) {
        showNext()
      }
    })
  }
  
  /**
   * 显示输入对话框
   * @returns Promise<string | null> - 用户输入的值，取消返回 null
   */
  function input(opts: InputDialogOptions): Promise<string | null> {
    return new Promise((resolve) => {
      queue.value.push({
        type: 'input',
        options: opts,
        resolve: resolve as (value: unknown) => void,
      })
      
      if (!visible.value) {
        showNext()
      }
    })
  }
  
  /**
   * 显示自定义对话框
   * @returns Promise<unknown> - 自定义组件返回的值
   */
  function custom<T = unknown>(opts: CustomDialogOptions): Promise<T> {
    return new Promise((resolve) => {
      queue.value.push({
        type: 'custom',
        options: opts,
        resolve: resolve as (value: unknown) => void,
      })
      
      if (!visible.value) {
        showNext()
      }
    })
  }
  
  /**
   * 关闭当前对话框（确认）
   */
  function handleConfirm(result?: unknown) {
    closeDialog(result ?? true)
  }
  
  /**
   * 关闭当前对话框（取消）
   */
  function handleCancel() {
    closeDialog(type.value === 'input' ? null : false)
  }
  
  /**
   * 清空对话框队列
   */
  function clearQueue() {
    queue.value.forEach(item => {
      item.resolve(item.type === 'input' ? null : false)
    })
    queue.value = []
    closeDialog(type.value === 'input' ? null : false)
  }
  
  // ==================== 返回 ====================
  
  return {
    // 状态
    visible,
    type,
    options,
    queueLength: () => queue.value.length,
    
    // 方法
    confirm,
    alert,
    input,
    custom,
    handleConfirm,
    handleCancel,
    clearQueue,
  }
})

// ==================== Composable 快捷方式 ====================

/**
 * 用于在组件外部使用对话框
 * 注意：需要确保 pinia 已初始化
 */
export function useDialog() {
  const store = useDialogStore()
  
  return {
    confirm: store.confirm,
    alert: store.alert,
    input: store.input,
    custom: store.custom,
  }
}
