import { Router } from 'express'
import { createSession, deleteSession, listSessions, streamChat } from './chat.controller.js'

export const chatRouter = Router()

chatRouter.get('/sessions', (req, res, next) => {
  try {
    listSessions(req, res)
  } catch (error) {
    next(error)
  }
})

chatRouter.post('/sessions', (req, res, next) => {
  try {
    createSession(req, res)
  } catch (error) {
    next(error)
  }
})

chatRouter.delete('/sessions/:sessionId', (req, res, next) => {
  try {
    deleteSession(req, res)
  } catch (error) {
    next(error)
  }
})

chatRouter.post('/stream', (req, res, next) => {
  void streamChat(req, res).catch(next)
})
