<script setup lang="ts">
/**
 * 微博创建账号弹窗
 * 
 * 使用公共的 CreateAccountDialog 组件，传入微博特定的配置
 */
import { CreateAccountDialog } from '@/components/common';
import type { MissingAccountInfo, PlatformAccount } from '@/types/account';

const props = defineProps<{
  visible: boolean;
  missingInfo?: MissingAccountInfo | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'created'): void;
}>();

// 微博主题色
const WEIBO_THEME_COLOR = '#E6162D';

function handleCreated(account: PlatformAccount) {
  emit('created');
}

function handleClose() {
  emit('close');
}
</script>

<template>
  <CreateAccountDialog
    :visible="visible"
    platform-id="weibo"
    platform-name="微博"
    :theme-color="WEIBO_THEME_COLOR"
    :missing-info="missingInfo"
    :show-scope-selector="false"
    default-scope="character"
    @close="handleClose"
    @created="handleCreated"
  />
</template>
