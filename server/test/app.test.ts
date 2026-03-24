import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { resetChatRepositoryForTests } from '../src/modules/chat/chat.repository.js'

describe('app', () => {
  beforeEach(() => {
    process.env.CHAT_DB_PATH = ':memory:'
    resetChatRepositoryForTests()
  })

  afterEach(() => {
    resetChatRepositoryForTests()
    delete process.env.CHAT_DB_PATH
  })

  it('returns health status', async () => {
    const app = createApp()
    const response = await request(app).get('/api/health')

    expect(response.status).toBe(200)
    expect(response.body.ok).toBe(true)
  })

  it('creates and lists sessions from the database', async () => {
    const app = createApp()

    const createResponse = await request(app)
      .post('/api/chat/sessions')
      .set('x-client-id', 'test-client')
      .send({
        provider: 'openai',
        model: 'gpt-4o-mini',
        systemPrompt: '你是一个测试助手'
      })

    expect(createResponse.status).toBe(201)
    expect(createResponse.body.messages).toEqual([])

    const listResponse = await request(app).get('/api/chat/sessions').set('x-client-id', 'test-client')

    expect(listResponse.status).toBe(200)
    expect(listResponse.body.sessions).toHaveLength(1)
    expect(listResponse.body.sessions[0].systemPrompt).toBe('你是一个测试助手')
  })

  it('returns validation error for invalid chat payload', async () => {
    const app = createApp()
    const response = await request(app)
      .post('/api/chat/stream')
      .set('x-client-id', 'test-client')
      .send({
        provider: 'openai',
        model: '',
        message: ''
      })

    expect(response.status).toBe(400)
    expect(response.body.message).toBe('请求参数不合法')
  })
})
