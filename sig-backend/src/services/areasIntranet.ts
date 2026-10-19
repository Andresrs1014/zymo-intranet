import prisma from "../config/prisma"
import { env } from "../config/env"

/** Las carpetas del SIG se piden a mano desde Organización (POST /api/areas/desde-intranet). Aquí solo se mantienen al día y se resuelve el área de una persona. */

export const norm = (s: string): string => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim()

export interface AreaIntranet { id: number; name: string; cargos: string[] }

const REFRESCO_MS = 60_000
/** Nombre actual de cada área en la intranet (id → nombre): a una persona se le busca su carpeta por el área de su cuenta, no por el nombre de la carpeta. */
const nombresIntranet = new Map<number, string>()
let ultima = 0
let enCurso: Promise<void> | null = null

export async function traerCatalogo(): Promise<AreaIntranet[] | null> {
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
  nombresIntranet.clear()
  for (const a of catalogo) nombresIntranet.set(a.id, a.name)
  // Solo las carpetas que el admin ya enlazó: se refrescan sus cargos. Nunca se crea ni se enlaza nada solo.
  for (const a of catalogo) {
    const enlazada = await prisma.sigArea.findUnique({ where: { intranetAreaId: a.id } })
    if (enlazada) await prisma.sigArea.update({ where: { id: enlazada.id }, data: { cargos: a.cargos ?? [] } }) // el nombre lo cambia el admin en el SIG
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
  const enlazadas = await prisma.sigArea.findMany({ where: { intranetAreaId: { not: null } }, select: { id: true, nombre: true, intranetAreaId: true } })
  // por el nombre del área en la intranet; si aún no se pudo leer el catálogo, por el nombre de la carpeta
  return enlazadas.filter((a) => norm(nombresIntranet.get(a.intranetAreaId!) ?? a.nombre) === norm(nombreArea))
}
