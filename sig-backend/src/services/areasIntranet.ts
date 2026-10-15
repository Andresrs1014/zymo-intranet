import prisma from "../config/prisma"
import { env } from "../config/env"

/** Las carpetas del SIG nacen de las áreas de la intranet (Organización). Aquí se sincronizan y se resuelve el área de una persona. */

export const norm = (s: string): string => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim()

interface AreaIntranet { id: number; name: string; cargos: string[] }

const REFRESCO_MS = 60_000
let ultima = 0
let enCurso: Promise<void> | null = null

async function traerCatalogo(): Promise<AreaIntranet[] | null> {
  try {
    const res = await fetch(`${env.INTRANET_API_URL}/acceso/catalogo-areas`, {
      headers: { "X-Internal-Key": env.INTERNAL_KEY },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const data = await res.json()
    return Array.isArray(data) ? (data as AreaIntranet[]) : null
  } catch {
    return null
  }
}

async function sincronizar(): Promise<void> {
  const catalogo = await traerCatalogo()
  if (!catalogo) return // sin conexión con la intranet se conserva lo que ya hay
  const libres = await prisma.sigArea.findMany({ where: { intranetAreaId: null } })
  const excluidas = new Set((await prisma.sigAreaExcluida.findMany()).map((e) => e.intranetAreaId))
  const usadas = new Set<number>()
  for (const a of catalogo) {
    if (excluidas.has(a.id)) continue // el admin eliminó su carpeta del SIG
    const cargos = a.cargos ?? []
    const enlazada = await prisma.sigArea.findUnique({ where: { intranetAreaId: a.id } })
    if (enlazada) {
      usadas.add(enlazada.id)
      await prisma.sigArea.update({ where: { id: enlazada.id }, data: { nombre: a.name, cargos } })
      continue
    }
    // carpeta anterior con el mismo nombre: se adopta en vez de duplicarla
    const igual = libres.find((l) => !usadas.has(l.id) && norm(l.nombre) === norm(a.name))
    if (igual) {
      usadas.add(igual.id)
      await prisma.sigArea.update({ where: { id: igual.id }, data: { intranetAreaId: a.id, nombre: a.name, cargos } })
    } else {
      await prisma.sigArea.create({ data: { nombre: a.name, intranetAreaId: a.id, cargos } })
    }
  }
  // un área que ya no existe en la intranet: su carpeta se va con ella; si ya tiene contenido, se conserva sin enlazar
  const huerfanas = await prisma.sigArea.findMany({
    where: { intranetAreaId: { not: null, notIn: catalogo.map((a) => a.id) } },
    include: { _count: { select: { procedimientos: true, indicadores: true } } },
  })
  for (const h of huerfanas) {
    if (h._count.procedimientos + h._count.indicadores === 0) await prisma.sigArea.delete({ where: { id: h.id } })
    else await prisma.sigArea.update({ where: { id: h.id }, data: { intranetAreaId: null } })
  }
}

/** Crea y actualiza las carpetas desde las áreas de la intranet. Con tope de una vez por minuto; nunca lanza. */
export function sincronizarAreas(forzar = false): Promise<void> {
  if (enCurso) return enCurso
  if (!forzar && Date.now() - ultima < REFRESCO_MS) return Promise.resolve()
  enCurso = sincronizar()
    .catch((err) => console.error("[sig] No se pudieron sincronizar las áreas de la intranet:", err))
    .finally(() => { ultima = Date.now(); enCurso = null })
  return enCurso
}

/** Carpeta(s) del SIG que corresponden al área de la persona (por el nombre del área en su sesión). */
export async function carpetasDeArea(nombreArea: string | undefined): Promise<{ id: number; nombre: string }[]> {
  if (!nombreArea?.trim()) return []
  await sincronizarAreas()
  const enlazadas = await prisma.sigArea.findMany({ where: { intranetAreaId: { not: null } }, select: { id: true, nombre: true } })
  return enlazadas.filter((a) => norm(a.nombre) === norm(nombreArea))
}
