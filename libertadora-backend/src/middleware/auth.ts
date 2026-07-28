import { Request, Response, NextFunction } from "express"
import jwt from "jsonwebtoken"
import { env } from "../config/env"
import { prisma } from "../config/prisma"

export interface AuthPayload {
  sub?: number | string
  id?: number | string
  email?: string
  full_name?: string
  role?: string
  app_permissions?: string[]
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload
      partnerUserId?: string
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
    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] }) as AuthPayload
    req.user = payload
    next()
  } catch {
    res.status(401).json({ error: "Token inválido o expirado" })
  }
}

export function getUserId(user: AuthPayload): number {
  const raw = user.id ?? (
    typeof user.sub === "number" || (typeof user.sub === "string" && !isNaN(Number(user.sub)))
      ? user.sub
      : undefined
  )
  const id = Number(raw)
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error("Token sin identificador de usuario válido")
  }
  return id
}

function hasAccess(user: AuthPayload | undefined, perm: string): boolean {
  const role = user?.role
  const perms = user?.app_permissions ?? []
  return role === "admin" || role === "gerente" || perms.includes(perm)
}

/** Acceso interno de staff al módulo Libertadora (dashboard, prospectos, citas) */
export function requireLibertadoraAccess(req: Request, res: Response, next: NextFunction): void {
  if (hasAccess(req.user, "mod_libertadora")) {
    next()
    return
  }
  res.status(403).json({ error: "Sin acceso al módulo Libertadora" })
}

/** Gestionar cuentas del socio externo (crear/desactivar/reset password) — solo admin o gerente */
export function requireGerente(req: Request, res: Response, next: NextFunction): void {
  const role = req.user?.role
  if (role !== "admin" && role !== "gerente") {
    res.status(403).json({ error: "Solo el gerente o admin puede realizar esta acción" })
    return
  }
  next()
}

interface PartnerSessionPayload {
  scope: "libertadora_partner"
  partnerUserId: string
}

/**
 * Valida la sesión del socio externo (Skandia) tras login con usuario y
 * contraseña (POST /public/login). El JWT tiene una expiración normal de
 * sesión (7 días) — a diferencia del link persistente descartado, acá revocar
 * el acceso de una persona puntual es desactivar su LibertadoraPartnerUser,
 * consultado en cada request, sin afectar a otras cuentas ni rotar el
 * JWT_SECRET compartido por toda la intranet.
 */
export async function requireLibertadoraPartnerScope(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "No autenticado" })
    return
  }
  try {
    const payload = jwt.verify(header.slice(7), env.JWT_SECRET, { algorithms: ["HS256"] }) as PartnerSessionPayload
    if (payload.scope !== "libertadora_partner" || !payload.partnerUserId) {
      res.status(403).json({ error: "Sesión no válida" })
      return
    }
    const partnerUser = await prisma.libertadoraPartnerUser.findUnique({ where: { id: payload.partnerUserId } })
    if (!partnerUser || !partnerUser.active) {
      res.status(403).json({ error: "Esta cuenta fue desactivada" })
      return
    }
    req.partnerUserId = partnerUser.id
    next()
  } catch {
    res.status(401).json({ error: "Sesión inválida o expirada" })
  }
}
