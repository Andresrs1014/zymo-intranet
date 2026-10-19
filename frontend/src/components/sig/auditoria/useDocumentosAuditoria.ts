import { useQuery } from "@tanstack/react-query"
import { sigApi } from "@/lib/sigApi"
import type { DocAuditoria, EstadoRevision } from "./tipos"

type EstadoApi = "PENDIENTE_REVISION" | "APROBADO" | "RECHAZADO"
interface ProcMin { id: number; codigo: string; titulo: string; commits: { id: number; estado: string; createdAt: string }[] }
interface CommitMin { id: number; contenidoAgente: string; archivoOriginal: string | null; nombreArchivo: string | null; tipoMime: string | null }
interface InstMin { id: number; codigo: string; titulo: string; contenido: string; archivoOriginal: string | null; nombreArchivo: string | null; tipoMime: string | null; estado?: EstadoApi }
interface AnexoMin { id: number; nombre: string; nombreArchivo: string; tipoMime: string | null; estado?: EstadoApi }

const lista = <T,>(url: string) => sigApi.get<T[]>(url).then((r) => r.data)
const sinAprobar = (estado?: string): EstadoRevision | undefined => (estado === "PENDIENTE_REVISION" || estado === "RECHAZADO" ? estado : undefined)

/** Todo lo que cuelga de un procedimiento, ya normalizado para leerlo. Comparte caché con la pantalla del SIG. */
export function useDocumentosAuditoria(procedimientoId: number) {
  const proc = useQuery<ProcMin>({
    queryKey: ["sig", "procedimiento", procedimientoId],
    queryFn: async () => (await sigApi.get(`/api/procedimientos/${procedimientoId}`)).data,
  })
  // Mismo criterio que la pantalla: la última versión aprobada; si no hay, la pendiente más reciente.
  const ordenados = [...(proc.data?.commits ?? [])].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
  const vigente = ordenados.find((c) => c.estado === "APROBADO") ?? ordenados.find((c) => c.estado === "PENDIENTE_REVISION")
  const commit = useQuery<CommitMin>({
    queryKey: ["sig", "commit", vigente?.id],
    queryFn: async () => (await sigApi.get(`/api/commits/${vigente!.id}`)).data,
    enabled: !!vigente,
  })
  const inst = useQuery({ queryKey: ["sig", "aud", "instructivos", procedimientoId], queryFn: () => lista<InstMin>(`/api/instructivos?procedimientoId=${procedimientoId}&activo=true`) })
  const formatos = useQuery({ queryKey: ["sig", "aud", "formatos", procedimientoId], queryFn: () => lista<AnexoMin>(`/api/formatos?procedimientoId=${procedimientoId}`) })
  const anexos = useQuery({ queryKey: ["sig", "aud", "anexos", procedimientoId], queryFn: () => lista<AnexoMin>(`/api/doc-anexos?procedimientoId=${procedimientoId}`) })

  const c = commit.data
  const procedimiento: DocAuditoria | null = proc.data && vigente && c
    ? {
        clave: "proc", tipo: "procedimiento", codigo: proc.data.codigo, titulo: proc.data.titulo,
        base: c.archivoOriginal ? `/api/commits/${c.id}` : null,
        nombreArchivo: c.nombreArchivo, mime: c.tipoMime, texto: c.contenidoAgente || null,
        estado: sinAprobar(vigente.estado),
      }
    : null

  const instructivos: DocAuditoria[] = (inst.data ?? []).map((i) => ({
    clave: `i${i.id}`, tipo: "instructivo", codigo: i.codigo, titulo: i.titulo,
    base: i.archivoOriginal ? `/api/instructivos/${i.id}` : null,
    nombreArchivo: i.nombreArchivo, mime: i.tipoMime, texto: i.contenido || null, estado: sinAprobar(i.estado),
  }))
  const aAnexo = (tipo: "formato" | "anexo", ruta: string) => (a: AnexoMin): DocAuditoria => ({
    clave: `${tipo[0]}${a.id}`, tipo, titulo: a.nombre, base: `/api/${ruta}/${a.id}`,
    nombreArchivo: a.nombreArchivo, mime: a.tipoMime, texto: null, estado: sinAprobar(a.estado),
  })

  const consultas = [proc, commit, inst, formatos, anexos]
  return {
    cargando: consultas.some((q) => q.isLoading),
    /** Si algo falla se avisa: una lista que no cargó NO es una lista vacía. */
    error: consultas.some((q) => q.isError),
    reintentar: () => consultas.forEach((q) => { if (q.isError) void q.refetch() }),
    procedimiento,
    instructivos,
    formatos: (formatos.data ?? []).map(aAnexo("formato", "formatos")),
    anexos: (anexos.data ?? []).map(aAnexo("anexo", "doc-anexos")),
  }
}
