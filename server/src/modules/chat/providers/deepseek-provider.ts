import { env } from '../../../config/env.js'
import { BaseProviderAdapter } from './base-provider.js'

export class DeepSeekAdapter extends BaseProviderAdapter {
  constructor() {
    super({
      apiKey: env.deepSeekApiKey,
      baseUrl: env.deepSeekBaseUrl,
      providerName: 'DeepSeek'
    })
  }
}
