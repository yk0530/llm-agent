<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import MessageBubble from '@/components/MessageBubble.vue'
import SettingsPanel from '@/components/SettingsPanel.vue'
import SidebarSessions from '@/components/SidebarSessions.vue'
import { useChatApp } from '@/composables/useChatApp'

const {
  activeSession,
  createNewSession,
  deleteSession,
  draft,
  errorMessage,
  isStreaming,
  selectSession,
  sendMessage,
  sessions,
  settings,
  stopStream,
  updateSettings
} = useChatApp()

const messageListRef = ref<HTMLElement | null>(null)

const scrollToBottom = async () => {
  await nextTick()
  if (messageListRef.value) {
    messageListRef.value.scrollTop = messageListRef.value.scrollHeight
  }
}

watch(activeSession, scrollToBottom, { deep: true })
watch(isStreaming, scrollToBottom)
onMounted(scrollToBottom)

const onSend = async () => {
  await sendMessage()
  await scrollToBottom()
}
</script>

<template>
  <div class="app-shell">
    <SidebarSessions
      :sessions="sessions"
      :active-session-id="activeSession?.id ?? null"
      @create="createNewSession"
      @select="selectSession"
      @delete="deleteSession"
    />

    <main class="chat-layout">
      <header class="chat-layout__header">
        <div class="chat-layout__title-group">
          <p class="eyebrow">AI Workspace</p>
          <h1>{{ activeSession?.title || '开始一段新的对话' }}</h1>
          <p class="chat-layout__subtitle">
            一个更安静、更聚焦的 AI 对话工作台，支持 OpenAI 与 DeepSeek 的流式回复。
          </p>
        </div>

        <div class="chat-layout__header-meta">
          <span>{{ settings.provider }}</span>
          <span>{{ settings.model }}</span>
          <span>{{ sessions.length }} 个会话</span>
        </div>
      </header>

      <section ref="messageListRef" class="message-list">
        <div class="message-list__inner">
          <div v-if="!activeSession || activeSession.messages.length === 0" class="empty-state">
            <p class="eyebrow">Ready</p>
            <h2>把这里当成你的 AI 工作台</h2>
            <p>
              发送问题、粘贴代码、整理思路。回复会流式出现，会话保存在本地，随时可以继续。
            </p>
            <ul class="empty-state__tips">
              <li>支持 Markdown 渲染与多轮上下文</li>
              <li>底部悬浮输入区保持专注，不打断阅读</li>
              <li>右侧可快速切换 Provider、模型和系统提示词</li>
            </ul>
          </div>

          <MessageBubble
            v-for="message in activeSession?.messages || []"
            :key="message.id"
            :message="message"
          />
        </div>
      </section>

      <p v-if="errorMessage" class="error-banner">{{ errorMessage }}</p>

      <footer class="composer">
        <div class="composer__surface">
          <textarea
            v-model="draft"
            rows="3"
            placeholder="输入你的问题、需求或代码片段..."
            @keydown.enter.exact.prevent="onSend"
          />

          <div class="composer__footer">
            <p class="composer__hint">Enter 发送，Shift + Enter 换行</p>

            <div class="composer__actions">
              <button class="ghost-button" :disabled="!isStreaming" @click="stopStream">
                停止生成
              </button>
              <button class="primary-button" :disabled="isStreaming || !draft.trim()" @click="onSend">
                {{ isStreaming ? '生成中...' : '发送消息' }}
              </button>
            </div>
          </div>
        </div>
      </footer>
    </main>

    <SettingsPanel :settings="settings" @update="updateSettings" />
  </div>
</template>
