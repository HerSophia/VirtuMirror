<script setup lang="ts">
/**
 * 账号管理 - 创建账号弹窗
 * 
 * 使用公共的 CreateAccountDialog 组件，支持选择任意平台
 */
import { CreateAccountDialog } from '@/components/common';
import type { PlatformAccount } from '@/types/account';

const props = defineProps<{
  visible: boolean;
  platformId: string;
  platformName: string;
  platformColor?: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'created', account: PlatformAccount): void;
}>();

function handleCreated(account: PlatformAccount) {
  emit('created', account);
}

function handleClose() {
  emit('close');
}
</script>

<template>
  <CreateAccountDialog
    :visible="visible"
    :platform-id="platformId"
    :platform-name="platformName"
    :theme-color="platformColor || '#3B82F6'"
    :show-scope-selector="true"
    default-scope="character"
    @close="handleClose"
    @created="handleCreated"
  />
</template>
