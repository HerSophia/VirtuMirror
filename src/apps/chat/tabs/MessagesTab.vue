<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useContactStore } from '@/stores/contactStore'
import { useChatStore } from '@/stores/chatStore'
import { ListItem } from '../components'
import { formatListTime } from '../composables'
import type { Contact } from '@/types'

const router = useRouter()
const contactStore = useContactStore()
const chatStore = useChatStore()

// 按最后消息时间排序的对话列表
const conversations = computed(() => {
  const contactIds = chatStore.getConversationsSortedByTime()
  return contactIds
    .map(id => contactStore.getContact(id))
    .filter(Boolean) as Contact[]
})

function openConversation(contact: Contact) {
  router.push({ name: 'ChatConversation', params: { contactId: contact.id } })
}
</script>

<template>
  <div class="messages-list">
    <div v-if="conversations.length === 0" class="empty-state">
      <i class="fas fa-comments text-4xl text-gray-300 mb-2" />
      <p class="text-gray-500">暂无消息</p>
    </div>
    
    <ListItem
      v-for="contact in conversations"
      :key="contact.id"
      :avatar="contactStore.getContactAvatar(contact.id)"
      :avatar-alt="contact.name"
      :title="contactStore.getContactName(contact.id)"
      :subtitle="chatStore.getLastMessagePreview(contact.id)"
      :time="formatListTime(contact.lastMessageTime)"
      :badge="contact.unreadCount"
      @click="openConversation(contact)"
    />
  </div>
</template>

<style scoped>
.messages-list {
  background-color: #fff;
}

.empty-state {
  @apply flex flex-col items-center justify-center py-20;
}
</style>