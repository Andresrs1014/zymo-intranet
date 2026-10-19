import { Request, Response, NextFunction } from "express"
import jwt from "jsonwebtoken"
import { env } from "../config/env"

export interface AuthPayload {
  sub?: number | string
  id?: number | string
  email?: string
  full_name?: string
  role?: string
  area?: string
  app_permissions?: string[]
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload
      /** Áreas del SIG que puede ver el líder (las pone requireSigLider). */
      sigAreaIds?: number[]
      /** La puerta de líderes ya comprobó que este GET es de una carpeta de su área. */
      sigLiderOk?: boolean
      /** Quien sube sin ser del SIG completo (líder o mod_sig_subir): lo que sube queda pendiente de verificación. */
      sigSoloPendiente?: boolean
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

export function getUserId(user: AuthPayload): number {
  const raw = user.id ?? (
    typeof user.sub === "number" ||
    (typeof user.sub === "string" && !isNaN(Number(user.sub)))
      ? user.sub
      : undefined
  )
  const id = Number(raw)
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error("Token sin identificador de usuario válido")
  }
  return id
}

/** Solo Admin o Gerente puede hacer esta acción */
/** Admin, gerente o quien tenga mod_sig_aprobar: aprueba o rechaza lo que suben otros. No da análisis, edición ni borrado. */
export function requireAprobador(req: Request, res: Response, next: NextFunction): void {
  const role = req.user?.role
  if (role === "admin" || role === "gerente" || (req.user?.app_permissions ?? []).includes("mod_sig_aprobar")) { next(); return }
  res.status(403).json({ error: "Solo quien aprueba en el SIG puede realizar esta acción" })
}

export function requireGerente(req: Request, res: Response, next: NextFunction): void {
  const role = req.user?.role
  if (role !== "admin" && role !== "gerente") {
    res.status(403).json({ error: "Solo el gerente o admin puede realizar esta acción" })
    return
  }
  next()
}

/** Admin o usuarios con mod_sig o gerente */
export function requireSigAccess(req: Request, res: Response, next: NextFunction): void {
  if (req.sigLiderOk) { next(); return } // líder dentro de su área (ver gateLider)
  const role = req.user?.role
  const perms = req.user?.app_permissions ?? []
  if (role === "admin" || role === "gerente" || perms.includes("mod_sig")) {
    next()
    return
  }
  res.status(403).json({ error: "Sin acceso al módulo SIG" })
}
