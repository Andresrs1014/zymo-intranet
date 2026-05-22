import { Request, Response, NextFunction } from "express"
import jwt from "jsonwebtoken"
import { env } from "../config/env"

export interface AuthPayload {
  sub?: number | string   // FastAPI uses "sub" for user id
  id?: number | string    // fallback
  email?: string
  full_name?: string
  role?: string
}

declare global {
  namespace Express {
    interface Request {
      user: AuthPayload
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "No autenticado" })
    return
  }
  const token = header.slice(7)
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AuthPayload
    req.user = payload
    next()
  } catch {
    res.status(401).json({ error: "Token inválido o expirado" })
  }
}

/** Extracts the numeric user ID from either sub or id claim */
export function getUserId(user: AuthPayload): number {
  const raw = user.sub ?? user.id
  return Number(raw)
}
