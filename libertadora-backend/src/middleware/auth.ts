import { Request, Response, NextFunction } from "express"
import jwt from "jsonwebtoken"
import { env } from "../config/env"
import { prisma } from "../config/prisma"

export interface AppUser {
  id: string
  email: string
  nombre: string | null
  isAdmin: boolean
}

declare global {
  namespace Express {
    interface Request {
      appUser?: AppUser
    }
  }
}

interface SessionPayload {
  scope: "libertadora_session"
  userId: string
}

/**
 * Única forma de entrar a esta app — staff y socio externo (Skandia) usan el
 * mismo tipo de cuenta (LibertadoraUser), sin ninguna dependencia del JWT de
 * la intranet (app 100% separada, decisión del usuario 2026-07-28). El JWT
 * de sesión solo lleva el id; `active`/`isAdmin` se consultan en la BD en
 * cada request, así que desactivar una cuenta corta el acceso al instante
 * aunque ya tenga una sesión emitida.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "No autenticado" })
    return
  }
  try {
    const payload = jwt.verify(header.slice(7), env.JWT_SECRET, { algorithms: ["HS256"] }) as SessionPayload
    if (payload.scope !== "libertadora_session" || !payload.userId) {
      res.status(403).json({ error: "Sesión no válida" })
      return
    }
    const user = await prisma.libertadoraUser.findUnique({ where: { id: payload.userId } })
    if (!user || !user.active) {
      res.status(403).json({ error: "Esta cuenta fue desactivada" })
      return
    }
    req.appUser = { id: user.id, email: user.email, nombre: user.nombre, isAdmin: user.isAdmin }
    next()
  } catch {
    res.status(401).json({ error: "Sesión inválida o expirada" })
  }
}

/** Gestionar cuentas (crear/desactivar/reset password) — solo administradores. */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.appUser?.isAdmin) {
    res.status(403).json({ error: "Solo un administrador puede realizar esta acción" })
    return
  }
  next()
}
