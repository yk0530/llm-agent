import { env } from '../../../config/env.js'
import { BaseProviderAdapter } from './base-provider.js'

export class OpenAIAdapter extends BaseProviderAdapter {
  constructor() {
    super({
      apiKey: env.openAiApiKey,
      baseUrl: env.openAiBaseUrl,
      providerName: 'OpenAI'
    })
  }
}
