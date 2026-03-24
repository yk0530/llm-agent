export interface RequestContext {
  requestId: string
  clientId?: string
  sessionId?: string
}

declare global {
  namespace Express {
    interface Request {
      context: RequestContext
    }
  }
}

export {}
