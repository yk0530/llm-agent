import type { ModelProvider } from '../../../../shared/types.js'
import type { ChatProviderAdapter } from './chat.types.js'
import { DeepSeekAdapter } from './providers/deepseek-provider.js'
import { OpenAIAdapter } from './providers/openai-provider.js'

export const createProviderRegistry = (): Record<ModelProvider, ChatProviderAdapter> => ({
  openai: new OpenAIAdapter(),
  deepseek: new DeepSeekAdapter()
})
