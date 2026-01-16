<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useContactStore } from '@/stores/contactStore'
import { ListItem } from '../components'
import type { Contact } from '@/types'

const router = useRouter()
const contactStore = useContactStore()

function openConversation(contact: Contact) {
  router.push({ name: 'ChatConversation', params: { contactId: contact.id } })
}

function openGroupCreation() {
  router.push({ name: 'GroupCreation' })
}
</script>

<template>
  <div class="contacts-list">
    <!-- 功能入口 -->
    <div class="function-group">
      <ListItem
        icon-class="fas fa-user-plus"
        icon-bg-color="#f97316"
        icon-color="#fff"
        title="新的朋友"
      />
      <ListItem
        icon-class="fas fa-users"
        icon-bg-color="#22c55e"
        icon-color="#fff"
        title="群聊"
        @click="openGroupCreation"
      />
      <ListItem
        icon-class="fas fa-tag"
        icon-bg-color="#3b82f6"
        icon-color="#fff"
        title="标签"
      />
      <ListItem
        icon-class="fas fa-user-tie"
        icon-bg-color="#2563eb"
        icon-color="#fff"
        title="公众号"
      />
    </div>

    <div class="section-title">联系人</div>
    
    <ListItem
      v-for="contact in contactStore.sortedContacts"
      :key="contact.id"
      :avatar="contactStore.getContactAvatar(contact.id)"
      :avatar-alt="contact.name"
      :title="contactStore.getContactName(contact.id)"
      @click="openConversation(contact)"
    />
  </div>
</template>

<style scoped>
.contacts-list {
  background-color: #ededed;
}

.function-group {
  @apply mb-0 bg-white;
}

.section-title {
  @apply px-4 py-2 text-xs text-gray-500 bg-[#ededed];
}
</style>