<script setup lang="ts">
import { PROVIDER_MODEL_OPTIONS } from '@shared/constants'
import type { ChatSettings, ModelProvider } from '@shared/types'

const props = defineProps<{
  settings: ChatSettings
}>()

const emit = defineEmits<{
  update: [patch: Partial<ChatSettings>]
}>()

const onProviderChange = (event: Event) => {
  emit('update', {
    provider: (event.target as HTMLSelectElement).value as ModelProvider
  })
}
</script>

<template>
  <section class="settings-panel">
    <div class="settings-panel__header">
      <p class="eyebrow">Inspector</p>
      <h2>运行设置</h2>
      <p>在这里切换模型、调整本地代理地址，或定义系统提示词。</p>
    </div>

    <div class="settings-panel__section">
      <label>
        <span>Provider</span>
        <select :value="props.settings.provider" @change="onProviderChange">
          <option value="openai">OpenAI</option>
          <option value="deepseek">DeepSeek</option>
        </select>
      </label>

      <label>
        <span>模型</span>
        <select
          :value="props.settings.model"
          @change="emit('update', { model: ($event.target as HTMLSelectElement).value })"
        >
          <option
            v-for="model in PROVIDER_MODEL_OPTIONS[props.settings.provider]"
            :key="model"
            :value="model"
          >
            {{ model }}
          </option>
        </select>
      </label>
    </div>

    <div class="settings-panel__section">
      <label>
        <span>API Base URL</span>
        <input
          :value="props.settings.apiBaseUrl"
          placeholder="http://localhost:3000"
          @input="emit('update', { apiBaseUrl: ($event.target as HTMLInputElement).value })"
        />
      </label>
    </div>

    <div class="settings-panel__section">
      <label>
        <span>System Prompt</span>
        <textarea
          rows="6"
          :value="props.settings.systemPrompt"
          placeholder="你是一个专业、清晰、注重结构化表达的 AI 助手。"
          @input="emit('update', { systemPrompt: ($event.target as HTMLTextAreaElement).value })"
        />
      </label>
    </div>
  </section>
</template>
