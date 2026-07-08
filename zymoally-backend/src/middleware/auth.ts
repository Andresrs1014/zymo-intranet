import { Request, Response, NextFunction } from "express"
import jwt from "jsonwebtoken"
import { env } from "../config/env"

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

/** Extracts the numeric user ID from either sub or id claim */
export function getUserId(user: AuthPayload): number {
  const raw = user.id ?? (typeof user.sub === "number" || (typeof user.sub === "string" && !isNaN(Number(user.sub))) ? user.sub : undefined)
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

/** Acceso al dominio Tickets (PQR) */
export function requireTicketsAccess(req: Request, res: Response, next: NextFunction): void {
  if (hasAccess(req.user, "mod_tickets")) {
    next()
    return
  }
  res.status(403).json({ error: "Sin acceso al módulo Tickets" })
}

/** Edición de maestros (Listas PQR) — más estricto que el acceso de lectura/escritura */
export function requireTicketsConfig(req: Request, res: Response, next: NextFunction): void {
  if (hasAccess(req.user, "mod_tickets_config")) {
    next()
    return
  }
  res.status(403).json({ error: "Sin acceso a la configuración de Tickets" })
}

/** Acceso al dominio SAC (Servicio al Cliente) */
export function requireSacAccess(req: Request, res: Response, next: NextFunction): void {
  if (hasAccess(req.user, "mod_sac")) {
    next()
    return
  }
  res.status(403).json({ error: "Sin acceso al módulo SAC" })
}

/** Edición de opciones de formularios SAC — más estricto que el acceso de lectura/escritura */
export function requireSacConfig(req: Request, res: Response, next: NextFunction): void {
  if (hasAccess(req.user, "mod_sac_config")) {
    next()
    return
  }
  res.status(403).json({ error: "Sin acceso a la configuración de SAC" })
}

export interface SurveyLinkPayload {
  scope: "survey_client"
  surveyType: "client" | "experience"
}

declare global {
  namespace Express {
    interface Request {
      surveyLink?: SurveyLinkPayload
    }
  }
}

/**
 * Valida el magic-link público de encuestas (patrón scope=mnt_mobile de Mantenimiento):
 * solo verifica scope + tipo de encuesta, no rol ni app_permissions — el cliente final
 * nunca tiene una cuenta en la intranet.
 */
export function requireSurveyScope(surveyType: SurveyLinkPayload["surveyType"]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const header = req.headers.authorization
    if (!header?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Enlace inválido o expirado" })
      return
    }
    try {
      const payload = jwt.verify(header.slice(7), env.JWT_SECRET, { algorithms: ["HS256"] }) as SurveyLinkPayload
      if (payload.scope !== "survey_client" || payload.surveyType !== surveyType) {
        res.status(403).json({ error: "Enlace no válido para esta encuesta" })
        return
      }
      req.surveyLink = payload
      next()
    } catch {
      res.status(401).json({ error: "Enlace inválido o expirado" })
    }
  }
}
