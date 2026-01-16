<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useContactStore } from '@/stores/contactStore'
import { ChatHeader, ListItem } from '../../components'

const props = defineProps<{
  contactId: string
}>()

const router = useRouter()
const contactStore = useContactStore()

// 群设置状态
const muteNotifications = ref(false)
const pinChat = ref(false)
const saveToContacts = ref(false)

// 获取群信息
const group = contactStore.getContact(props.contactId)

function goBack() {
  router.back()
}

function inviteMembers() {
  router.push({ name: 'GroupInvite', params: { contactId: props.contactId } })
}

function deleteAndExit() {
  // TODO: 实现删除并退出群聊
  router.push('/chat')
}
</script>

<template>
  <div class="group-members">
    <ChatHeader 
      :title="`聊天信息 (${group?.memberCount || 0})`"
      :show-back="true"
      bg-color="#ededed"
    />
    
    <div class="content">
      <!-- 成员网格 -->
      <div class="member-grid">
        <div class="member-item" @click="inviteMembers">
          <div class="member-avatar add-btn">
            <i class="fas fa-plus text-gray-400"></i>
          </div>
          <div class="member-name text-gray-400">邀请</div>
        </div>
      </div>

      <!-- 群设置 -->
      <div class="group-section">
        <ListItem title="群聊名称" :show-arrow="true">
          <template #right>
            <span class="extra-text">{{ group?.name || '未命名' }}</span>
          </template>
        </ListItem>
        <ListItem title="群二维码" :show-arrow="true">
          <template #right>
            <i class="fas fa-qrcode text-gray-400 mr-2"></i>
          </template>
        </ListItem>
        <ListItem title="群公告" :show-arrow="true" />
      </div>

      <div class="group-section">
        <ListItem title="查找聊天记录" :show-arrow="true" />
      </div>

      <div class="group-section">
        <ListItem title="消息免打扰" :clickable="false">
          <template #right>
            <div 
              class="switch"
              :class="{ 'active': muteNotifications }"
              @click="muteNotifications = !muteNotifications"
            />
          </template>
        </ListItem>
        <ListItem title="置顶聊天" :clickable="false">
          <template #right>
            <div 
              class="switch"
              :class="{ 'active': pinChat }"
              @click="pinChat = !pinChat"
            />
          </template>
        </ListItem>
        <ListItem title="保存到通讯录" :clickable="false">
          <template #right>
            <div 
              class="switch"
              :class="{ 'active': saveToContacts }"
              @click="saveToContacts = !saveToContacts"
            />
          </template>
        </ListItem>
      </div>

      <div class="group-section">
        <div class="danger-btn" @click="deleteAndExit">
          删除并退出
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.group-members {
  @apply h-full flex flex-col;
  background-color: #ededed;
}

.content {
  @apply flex-1 overflow-y-auto pb-6;
}

.member-grid {
  @apply p-4 bg-white flex flex-wrap gap-4;
}

.member-item {
  @apply flex flex-col items-center gap-1 w-[60px] cursor-pointer;
}

.member-avatar {
  @apply w-12 h-12 rounded-md bg-gray-100 flex items-center justify-center;
}

.member-avatar.add-btn {
  @apply border border-dashed border-gray-300;
}

.member-name {
  @apply text-xs text-gray-500 truncate w-full text-center;
}

.group-section {
  @apply mt-2 bg-white;
}

.extra-text {
  @apply text-sm text-gray-500;
}

.switch {
  @apply w-10 h-6 bg-gray-200 rounded-full relative transition-colors duration-200 cursor-pointer;
}

.switch::after {
  content: '';
  @apply absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200;
}

.switch.active {
  @apply bg-green-500;
}

.switch.active::after {
  transform: translateX(16px);
}

.danger-btn {
  @apply w-full py-3 text-center text-red-500 font-medium cursor-pointer active:bg-gray-50;
}
</style>