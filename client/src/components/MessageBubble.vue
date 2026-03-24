<script setup lang="ts">
import { computed } from 'vue'
import type { ChatMessage } from '@shared/types'
import { renderMarkdown } from '@/utils/markdown'

const props = defineProps<{
  message: ChatMessage
}>()

const html = computed(() => renderMarkdown(props.message.content))
const speaker = computed(() => (props.message.role === 'user' ? '你' : 'AI 助手'))

const handleContentClick = async (event: MouseEvent) => {
  const target = event.target as HTMLElement | null
  const button = target?.closest<HTMLButtonElement>('[data-copy-code]')

  if (!button) {
    return
  }

  const encoded = button.dataset.copyCode
  if (!encoded) {
    return
  }

  try {
    await navigator.clipboard.writeText(decodeURIComponent(encoded))
    const previous = button.textContent
    button.textContent = '已复制'
    window.setTimeout(() => {
      button.textContent = previous ?? '复制'
    }, 1200)
  } catch {
    button.textContent = '复制失败'
  }
}
</script>

<template>
  <article class="message-bubble" :class="`message-bubble--${message.role}`">
    <header class="message-bubble__meta">
      <span>{{ speaker }}</span>
      <time>
        {{ new Date(message.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) }}
      </time>
    </header>
    <div class="message-bubble__content prose" v-html="html" @click="handleContentClick" />
  </article>
</template>
