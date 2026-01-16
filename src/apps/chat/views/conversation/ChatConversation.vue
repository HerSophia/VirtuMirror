<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useContactStore } from '@/stores/contactStore'
import { useChatStore } from '@/stores/chatStore'
import { useStagedActionsStore } from '@/stores/stagedActionsStore'
import { ChatHeader } from '../../components'
import { getMessageContent } from '../../composables'
import type { Message, ContactId } from '@/types'
import { PLAYER_ID } from '@/types'

const props = defineProps<{
  contactId: string
}>()

const router = useRouter()
const contactStore = useContactStore()
const chatStore = useChatStore()
const stagedActionsStore = useStagedActionsStore()

const messageInput = ref('')
const messagesContainer = ref<HTMLElement | null>(null)

// 获取联系人信息
const contact = computed(() => contactStore.getContact(props.contactId))
const contactName = computed(() => contactStore.getContactName(props.contactId))

// 获取消息列表
const messages = computed(() => chatStore.getMessages(props.contactId))

// 返回上一页
function goBack() {
  router.push('/chat')
}

// 发送消息（暂存）
function sendMessage() {
  if (!messageInput.value.trim()) return
  
  stagedActionsStore.stageSendMessage(props.contactId, messageInput.value.trim())
  
  messageInput.value = ''
}

// 判断是否为自己发送的消息
function isOwnMessage(message: Message): boolean {
  return message.senderId === PLAYER_ID
}

// 获取消息发送者名称
function getSenderName(senderId: ContactId): string {
  if (senderId === PLAYER_ID) return '我'
  return contactStore.getContactName(senderId)
}

// 获取消息发送者头像
function getSenderAvatar(senderId: ContactId): string {
  if (senderId === PLAYER_ID) {
    return 'https://api.dicebear.com/7.x/avataaars/svg?seed=player'
  }
  return contactStore.getContactAvatar(senderId)
}

// 滚动到底部
function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

onMounted(() => {
  scrollToBottom()
  // 标记消息为已读
  contactStore.clearUnreadCount(props.contactId)
})
</script>

<template>
  <div class="chat-conversation">
    <!-- 头部 -->
    <ChatHeader 
      :title="contactName"
      :show-back="true"
      back-to="/chat"
      :show-more="true"
    />
    
    <!-- 消息列表 -->
    <div ref="messagesContainer" class="messages-container">
      <div
        v-for="message in messages"
        :key="message.uid"
        class="message-wrapper"
        :class="{ 'own': isOwnMessage(message), 'system': message.type === 'system' }"
      >
        <!-- 系统消息 -->
        <div v-if="message.type === 'system'" class="system-message-container">
          <span class="system-message">{{ getMessageContent(message) }}</span>
        </div>
        
        <!-- 普通消息 -->
        <template v-else>
          <img
            v-if="!isOwnMessage(message)"
            :src="getSenderAvatar(message.senderId)"
            class="message-avatar"
          />
          <div class="message-content">
            <div v-if="contact?.type === 'group' && !isOwnMessage(message)" class="message-sender">
              {{ getSenderName(message.senderId) }}
            </div>
            <div class="message-bubble" :class="{ 'own': isOwnMessage(message) }">
              <!-- 文本消息 -->
              <span v-if="message.type === 'text'">{{ message.content }}</span>
              
              <!-- 图片消息 -->
              <img v-else-if="message.type === 'image'" :src="message.url" class="message-image" />
              
              <!-- 其他类型消息 -->
              <span v-else>{{ getMessageContent(message) }}</span>
            </div>
          </div>
          <img
            v-if="isOwnMessage(message)"
            :src="getSenderAvatar(message.senderId)"
            class="message-avatar"
          />
        </template>
      </div>
    </div>
    
    <!-- 输入区域 -->
    <div class="input-area">
      <button class="input-btn">
        <i class="fas fa-microphone-alt" />
      </button>
      <input
        v-model="messageInput"
        type="text"
        class="message-input"
        placeholder="发消息..."
        @keyup.enter="sendMessage"
      />
      <button class="input-btn">
        <i class="far fa-smile" />
      </button>
      <button
        v-if="messageInput.trim()"
        class="send-btn"
        @click="sendMessage"
      >
        发送
      </button>
      <button v-else class="input-btn">
        <i class="fas fa-plus-circle" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.chat-conversation {
  @apply h-full flex flex-col;
  background-color: #ededed;
}

.messages-container {
  @apply flex-1 overflow-y-auto p-4 space-y-4;
}

.message-wrapper {
  @apply flex items-start gap-2.5;
}

.message-wrapper.own {
  @apply flex-row-reverse;
}

.system-message-container {
  @apply w-full flex justify-center my-2;
}

.system-message {
  @apply text-xs px-2 py-1 rounded bg-gray-200 text-gray-500;
}

.message-avatar {
  @apply w-10 h-10 rounded-md flex-shrink-0 shadow-sm;
}

.message-content {
  @apply flex flex-col max-w-[70%];
}

.message-sender {
  @apply text-xs mb-1 text-gray-500 ml-1;
}

.message-bubble {
  @apply px-3 py-2.5 rounded-md text-[15px] leading-relaxed break-words relative shadow-sm;
  background-color: #fff;
  color: #111;
}

/* Bubble arrow for received messages */
.message-bubble:not(.own)::before {
  content: '';
  position: absolute;
  left: -6px;
  top: 14px;
  width: 0;
  height: 0;
  border-top: 6px solid transparent;
  border-bottom: 6px solid transparent;
  border-right: 6px solid #fff;
}

.message-bubble.own {
  background-color: #95ec69; /* WeChat Green */
  color: #000;
}

/* Bubble arrow for sent messages */
.message-bubble.own::before {
  content: '';
  position: absolute;
  right: -6px;
  top: 14px;
  width: 0;
  height: 0;
  border-top: 6px solid transparent;
  border-bottom: 6px solid transparent;
  border-left: 6px solid #95ec69;
}

.message-image {
  @apply max-w-full rounded-md;
}

.input-area {
  @apply flex items-center gap-2 px-3 py-2;
  background-color: #f7f7f7;
  border-top: 1px solid #dcdcdc;
  min-height: 56px;
}

.input-btn {
  @apply w-8 h-8 flex items-center justify-center transition-colors text-2xl;
  color: #111;
}

.message-input {
  @apply flex-1 rounded-md px-3 py-2 text-base border-none outline-none mx-1;
  background-color: #fff;
  color: #111;
  min-height: 36px;
}

.send-btn {
  @apply px-3 py-1.5 text-white text-sm rounded-md transition-colors;
  background-color: #07c160; /* WeChat Green Button */
}

.send-btn:hover {
  background-color: #06ad56;
}
</style>