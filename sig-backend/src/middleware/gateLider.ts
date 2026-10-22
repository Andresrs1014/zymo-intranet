import { Request, Response, NextFunction } from "express"
import prisma from "../config/prisma"
import { carpetasDeArea } from "../services/areasIntranet"

/**
 * Puerta de las rutas del SIG para quien tiene mod_sig_lider SIN el SIG completo.
 * El líder usa la misma página y las mismas rutas que el SIG, pero solo de las carpetas de su área:
 *  - LEE procedimientos, versiones, archivos, formatos, instructivos y anexos de su área (nunca análisis, indicadores ni la cola de aprobación);
 *  - SUBE versiones (siempre quedan pendientes de que el SIG las verifique), formatos, instructivos y anexos de su área;
 *  - no borra, no edita, no aprueba ni crea carpetas o procedimientos.
 * Admin, gerente y mod_sig pasan sin tocar nada. Quien no tiene ningún permiso de SIG no puede leer su contenido
 * (antes bastaba con tener sesión); los reportes de desarrollo no son contenido del SIG y siguen con su propia regla.
 */

/** Lo único de /api que no es contenido del SIG y se rige por su propia regla (reportes de desarrollo). Todo lo demás se cierra por defecto. */
const LIBRES = new Set(["reportes-desarrollo"])

type Familia = "procedimientos" | "commits" | "instructivos" | "formatos" | "doc-anexos" | "protocolos" | "archivos-area"

/** Subrutas de lectura permitidas por familia. "" = el recurso en sí. */
const SUBRUTAS: Record<Familia, string[]> = {
  procedimientos: ["", "cargos"],
  commits: ["", "archivo", "archivo/pdf", "flujograma-imagen"],
  instructivos: ["", "archivo", "archivo/pdf"],
  formatos: ["", "archivo", "archivo/pdf"],
  "doc-anexos": ["", "archivo", "archivo/pdf"],
  protocolos: ["", "archivo"],
  "archivos-area": ["", "archivo", "archivo/pdf"],
}

/** Las únicas escrituras de un líder: subir archivos. Cada manejador comprueba después que el procedimiento sea de su área. */
const SUBIDAS = new Set(["commits/upload", "formatos/upload", "doc-anexos/upload", "instructivos/upload", "archivos-area/upload"])

async function areaDe(familia: Familia, id: number): Promise<number | null> {
  const sel = { procedimiento: { select: { areaId: true } } } as const
  switch (familia) {
    case "procedimientos": return (await prisma.sigProcedimiento.findUnique({ where: { id }, select: { areaId: true } }))?.areaId ?? null
    case "commits": return (await prisma.sigCommit.findUnique({ where: { id }, select: sel }))?.procedimiento.areaId ?? null
    case "instructivos": return (await prisma.sigInstructivo.findUnique({ where: { id }, select: sel }))?.procedimiento.areaId ?? null
    case "formatos": return (await prisma.sigFormato.findUnique({ where: { id }, select: sel }))?.procedimiento.areaId ?? null
    case "doc-anexos": return (await prisma.sigDocAnexo.findUnique({ where: { id }, select: sel }))?.procedimiento.areaId ?? null
    case "archivos-area": return (await prisma.sigArchivoArea.findUnique({ where: { id }, select: { areaId: true } }))?.areaId ?? null
    case "protocolos": return (await prisma.sigProtocolo.findUnique({ where: { id }, select: sel }))?.procedimiento.areaId ?? null
  }
}

/** True si quien llama es un líder y ese procedimiento NO es de su área (los usuarios con el SIG completo nunca quedan fuera). */
export const fueraDeArea = (req: Request, areaId: number): boolean => !!req.sigAreaIds && !req.sigAreaIds.includes(areaId)

const prohibido = (res: Response, msg = "Sin acceso a este recurso del SIG") => { res.status(403).json({ error: msg }) }

export async function gateLider(req: Request, res: Response, next: NextFunction): Promise<void> {
  const role = req.user?.role
  const perms = req.user?.app_permissions ?? []
  if (role === "admin" || role === "gerente" || perms.includes("mod_sig")) { next(); return }

  // Express enruta sin distinguir mayúsculas y decodifica %XX: la puerta compara igual (/Indicadores, /%69ndicadores).
  const [familia, idRaw, ...resto] = req.path.split("/").filter(Boolean).map((seg) => {
    try { return decodeURIComponent(seg).toLowerCase() } catch { return seg.toLowerCase() }
  })

  // mod_sig_subir: sube y crea procedimientos en TODAS las áreas, siempre pendiente de verificación, sin análisis.
  if (perms.includes("mod_sig_subir")) { puertaSubir(req, res, next, familia, idRaw, resto); return }

  // Quien no tiene ningún permiso de SIG: todo lo de /api está cerrado salvo lo que tiene su propia regla.
  if (!perms.includes("mod_sig_lider")) {
    if (familia && !LIBRES.has(familia)) { prohibido(res, "Sin acceso al módulo SIG"); return }
    next(); return
  }

  const carpetas = await carpetasDeArea(req.user?.area)
  if (carpetas.length === 0) { res.status(409).json({ error: "Tu área todavía no tiene una carpeta en el SIG." }); return }
  const areas = carpetas.map((c) => c.id)
  req.sigAreaIds = areas // los listados de áreas y procedimientos filtran con esto; las subidas lo comprueban
  req.sigSoloPendiente = true

  if (req.method === "POST" && SUBIDAS.has(`${familia}/${idRaw}`) && resto.length === 0) { req.sigLiderOk = true; next(); return }
  if (req.method !== "GET") { prohibido(res, "Los líderes suben archivos y versiones nuevas; borrar, editar o aprobar es del SIG"); return }

  // Listados
  if (idRaw === undefined) {
    if (familia === "areas" || familia === "procedimientos" || familia === "buscar") { req.sigLiderOk = true; next(); return } // buscar se acota a su área en el manejador
    if (familia && familia in SUBRUTAS) {
      // el resto de listados solo se piden por procedimiento, y debe ser de su área
      const procId = parseInt(String(req.query.procedimientoId ?? ""))
      const areaQ = parseInt(String(req.query.areaId ?? ""))
      const area = familia === "archivos-area" ? (Number.isFinite(areaQ) ? areaQ : null)
        : Number.isFinite(procId) ? await areaDe("procedimientos", procId) : null
      if (area != null && areas.includes(area)) { req.sigLiderOk = true; next(); return }
    }
    prohibido(res); return
  }

  // Un recurso concreto
  const id = parseInt(idRaw)
  if (!Number.isFinite(id)) { prohibido(res); return } // p. ej. /commits/pendientes
  if (familia === "areas") {
    if (resto.length === 0 && areas.includes(id)) { req.sigLiderOk = true; next(); return }
    prohibido(res); return
  }
  if (!(familia in SUBRUTAS)) { prohibido(res); return }
  const fam = familia as Familia
  if (!SUBRUTAS[fam].includes(resto.join("/"))) { prohibido(res); return }
  const area = await areaDe(fam, id)
  if (area == null || !areas.includes(area)) { res.status(404).json({ error: "No encontrado en tu área" }); return }
  req.sigLiderOk = true
  next()
}

/** Lecturas de mod_sig_subir: contenido de cualquier área, nunca análisis (auditorías, hallazgos, indicadores, cargos, referencias) ni la cola de aprobación. */
function puertaSubir(req: Request, res: Response, next: NextFunction, familia: string | undefined, idRaw: string | undefined, resto: string[]): void {
  req.sigSoloPendiente = true
  const ok = () => { req.sigLiderOk = true; next() }
  const ruta = resto.join("/")
  const numerico = idRaw !== undefined && Number.isFinite(parseInt(idRaw))

  // mod_sig_aprobar (junto a mod_sig_subir): ve la cola de pendientes y aprueba o rechaza versiones y archivos. Nada más.
  if ((req.user?.app_permissions ?? []).includes("mod_sig_aprobar")) {
    const accion = resto[resto.length - 1]
    if (req.method === "GET" && idRaw === "pendientes" && resto.length === 0 && (familia === "commits" || familia === "revision")) { ok(); return }
    if (req.method === "POST" && (accion === "aprobar" || accion === "rechazar")
      && ((familia === "commits" && numerico && resto.length === 1) || (familia === "revision" && resto.length === 2 && Number.isFinite(parseInt(resto[0]))))) { ok(); return }
  }

  if (req.method === "POST") {
    if (SUBIDAS.has(`${familia}/${idRaw}`) && resto.length === 0) { ok(); return }
    if (familia === "procedimientos" && idRaw === undefined) { ok(); return } // crear procedimiento
    if (familia === "archivos-pendientes" && ((idRaw === "upload" && resto.length === 0) || (idRaw === "asignar-soporte" && resto.length === 0) || (numerico && ruta === "asignar-procedimiento"))) { ok(); return }
    prohibido(res, "Este permiso sube archivos y crea procedimientos; aprobar, editar o borrar es del SIG"); return
  }
  if (req.method === "DELETE") {
    if (familia === "archivos-pendientes" && numerico && resto.length === 0) { ok(); return } // descartar un archivo pendiente
    prohibido(res, "Este permiso sube archivos y crea procedimientos; aprobar, editar o borrar es del SIG"); return
  }
  if (req.method !== "GET") { prohibido(res); return }

  if (idRaw === undefined) {
    if (familia === "areas" || familia === "procedimientos" || familia === "buscar" || familia === "archivos-pendientes" || (familia && familia in SUBRUTAS)) { ok(); return }
    prohibido(res); return
  }
  if (familia === "areas" && numerico && resto.length === 0) { ok(); return }
  if (familia === "archivos-pendientes" && numerico && (ruta === "archivo" || ruta === "archivo/pdf")) { ok(); return } // ver un archivo de la bandeja
  // los cargos de un procedimiento alimentan el análisis de cargos: no se leen con este permiso
  if (familia && familia in SUBRUTAS && numerico && ruta !== "cargos" && SUBRUTAS[familia as Familia].includes(ruta)) { ok(); return }
  prohibido(res)
}
