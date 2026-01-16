<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useContactStore } from '@/stores/contactStore'
import { ChatHeader, ListItem } from '../../components'

const router = useRouter()
const contactStore = useContactStore()

const searchQuery = ref('')
const selectedContacts = ref<string[]>([])

function goBack() {
  router.back()
}

function toggleContact(contactId: string) {
  const index = selectedContacts.value.indexOf(contactId)
  if (index === -1) {
    selectedContacts.value.push(contactId)
  } else {
    selectedContacts.value.splice(index, 1)
  }
}

function createGroup() {
  if (selectedContacts.value.length === 0) return
  // TODO: 实现创建群聊逻辑
  router.back()
}
</script>

<template>
  <div class="group-creation">
    <ChatHeader :show-back="false" bg-color="#ededed">
      <template #left>
        <button class="text-black text-base font-medium" @click="goBack">取消</button>
      </template>
      <template #center>
        <span class="header-title">发起群聊</span>
      </template>
      <template #right>
        <button 
          class="complete-btn"
          :class="{ 'disabled': selectedContacts.length === 0 }"
          @click="createGroup"
        >
          完成
        </button>
      </template>
    </ChatHeader>

    <div class="search-bar">
      <div class="search-input-wrapper">
        <i class="fas fa-search text-gray-400 mr-2"></i>
        <input 
          v-model="searchQuery"
          type="text" 
          placeholder="搜索" 
          class="search-input" 
        />
      </div>
    </div>

    <div class="content">
      <ListItem
        title="面对面建群"
        :show-arrow="true"
      />
      <ListItem
        title="选择一个群"
        :show-arrow="true"
      />

      <div class="section-title">联系人</div>
      
      <template v-if="contactStore.sortedContacts.length > 0">
        <div
          v-for="contact in contactStore.sortedContacts"
          :key="contact.id"
          class="contact-item"
          @click="toggleContact(contact.id)"
        >
          <div class="checkbox" :class="{ 'checked': selectedContacts.includes(contact.id) }">
            <i v-if="selectedContacts.includes(contact.id)" class="fas fa-check" />
          </div>
          <img
            :src="contactStore.getContactAvatar(contact.id)"
            :alt="contact.name"
            class="contact-avatar"
          />
          <span class="contact-name">{{ contactStore.getContactName(contact.id) }}</span>
        </div>
      </template>
      <div v-else class="empty-tip">暂无更多联系人</div>
    </div>
  </div>
</template>

<style scoped>
.group-creation {
  @apply h-full flex flex-col;
  background-color: #ededed;
}

.header-title {
  @apply text-lg font-medium;
  color: #111;
}

.complete-btn {
  @apply text-white text-sm px-3 py-1 rounded-md;
  background-color: #07c160;
}

.complete-btn.disabled {
  @apply opacity-50;
}

.search-bar {
  @apply p-2 bg-[#ededed];
}

.search-input-wrapper {
  @apply bg-white rounded-md flex items-center px-2 py-1.5;
}

.search-input {
  @apply flex-1 text-sm outline-none;
}

.content {
  @apply flex-1 overflow-y-auto bg-white;
}

.section-title {
  @apply px-4 py-2 text-xs text-gray-500 bg-[#ededed];
}

.contact-item {
  @apply flex items-center gap-3 px-4 py-3 border-b border-gray-100 cursor-pointer active:bg-gray-50;
}

.checkbox {
  @apply w-5 h-5 rounded-full border-2 border-gray-300 flex items-center justify-center;
}

.checkbox.checked {
  @apply bg-green-500 border-green-500 text-white text-xs;
}

.contact-avatar {
  @apply w-10 h-10 rounded-md;
}

.contact-name {
  @apply text-base text-black;
}

.empty-tip {
  @apply p-4 text-center text-gray-400 text-sm;
}
</style>