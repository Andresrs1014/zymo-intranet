import { Request, Response, NextFunction } from "express"
import jwt from "jsonwebtoken"
import { env } from "../config/env"

export interface AuthPayload {
  sub?: number | string
  id?: number | string
  email?: string
  full_name?: string
  role?: string
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload
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
    const payload = jwt.verify(token, env.JWT_SECRET, {
      algorithms: ["HS256"],
    }) as AuthPayload
    req.user = payload
    next()
  } catch {
    res.status(401).json({ error: "Token inválido o expirado" })
  }
}

/** Extracts numeric user ID from sub or id claim */
export function getUserId(user: AuthPayload): number {
  const raw = user.id ?? (typeof user.sub === "number" || (typeof user.sub === "string" && !isNaN(Number(user.sub))) ? user.sub : undefined)
  const id = Number(raw)
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error("Token is missing a valid user identifier")
  }
  return id
}

export function isAdmin(user: AuthPayload): boolean {
  return user.role === "admin"
}
