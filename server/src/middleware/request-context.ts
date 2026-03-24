import type { NextFunction, Request, Response } from 'express'
import { randomUUID } from 'node:crypto'

export const attachRequestContext = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  const clientId = req.header('x-client-id')?.trim()

  req.context = {
    requestId: randomUUID(),
    clientId: clientId || undefined
  }

  next()
}
