<script setup lang="ts">
import type { ChatSession } from '@shared/types'

defineProps<{
  sessions: ChatSession[]
  activeSessionId: string | null
}>()

defineEmits<{
  create: []
  select: [sessionId: string]
  delete: [sessionId: string]
}>()
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar__brand">
      <p class="sidebar__eyebrow">AI Chat Platform</p>
      <h2>Conversations</h2>
      <p class="sidebar__summary">{{ sessions.length }} 个本地会话，专注于当前对话上下文。</p>
    </div>

    <button class="sidebar__new" @click="$emit('create')">+ 新建会话</button>

    <div class="sidebar__list">
      <button
        v-for="session in sessions"
        :key="session.id"
        class="sidebar__item"
        :class="{ 'sidebar__item--active': session.id === activeSessionId }"
        @click="$emit('select', session.id)"
      >
        <div class="sidebar__item-main">
          <strong>{{ session.title }}</strong>
          <span>{{ session.provider }} · {{ session.model }}</span>
        </div>
        <span class="sidebar__delete" @click.stop="$emit('delete', session.id)">删除</span>
      </button>

      <div v-if="sessions.length === 0" class="sidebar__empty">
        <p>还没有会话</p>
        <span>点击上方按钮开始第一段对话。</span>
      </div>
    </div>
  </aside>
</template>
