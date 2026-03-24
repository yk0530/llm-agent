import { config } from 'dotenv'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(currentDir, '../../.env')

config({ path: envPath })

const toPort = (value: string | undefined, fallback: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export const env = {
  port: toPort(process.env.PORT, 3000),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  openAiApiKey: process.env.OPENAI_API_KEY || '',
  openAiBaseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  deepSeekApiKey: process.env.DEEPSEEK_API_KEY || '',
  deepSeekBaseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1'
}
