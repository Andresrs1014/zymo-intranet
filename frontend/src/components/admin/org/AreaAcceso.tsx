import { useMemo, useState } from "react"
import { ChevronDown, Lock } from "lucide-react"
import { cn } from "@/lib/utils"
import { INTERNAL_MODULE_GROUPS } from "@/lib/roles"
import { getApiError } from "@/hooks/useRoles"
import { useExclusivos, useFijarExclusivo, useFijarPermisos, useUsuariosArea, type UsuarioArea } from "@/hooks/useAreaAcceso"

/** Vista por aplicación: quién del área la tiene, y marcar o quitar a varias personas de una vez. La edición por persona está en «Editar permisos». */
export function AreaAcceso({ areaId, nombresAreas }: { areaId: number; nombresAreas: Record<number, string> }) {
  const { data: usuarios = [] } = useUsuariosArea(areaId)
  const { data: exclusivos = [] } = useExclusivos()
  const fijarExclusivo = useFijarExclusivo()
  const [error, setError] = useState<string>()

  const exclusivo = useMemo(() => new Map(exclusivos.map((e) => [e.permiso, e.areas])), [exclusivos])
  const ajena = (p: string) => { const a = exclusivo.get(p); return a != null && !a.includes(areaId) }

  async function exclusividad(ids: string[], yaEsAqui: boolean) {
    if (!yaEsAqui && !window.confirm("Será exclusiva de esta área: las personas de otras áreas dejarán de poder recibirla. ¿Continuar?")) return
    setError(undefined)
    try { await fijarExclusivo.mutateAsync({ permisos: ids, areas: yaEsAqui ? [] : [areaId] }) } catch (err) { setError(getApiError(err)) }
  }

  return (
    <div>
      <p className="mb-5 max-w-2xl text-[13px] leading-relaxed text-org-tinta/60">
        Quién tiene cada aplicación. Los permisos se dan a la persona; esta vista sirve para ver una aplicación de un vistazo o dársela a varias personas.
        Solo decide quién la ve: no cambia cómo funciona.
      </p>
      {error && <p role="alert" className="mb-4 rounded-lg border border-org-linea bg-org-tinte px-3 py-2 text-[12px] text-org-rojo">{error}</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        {INTERNAL_MODULE_GROUPS.map((g, i) => {
          const ids = g.modules.map((m) => m.id)
          const aqui = ids.every((p) => exclusivo.get(p)?.includes(areaId))
          const otras = ids.some(ajena)
          const duenas = [...new Set(ids.flatMap((p) => exclusivo.get(p) ?? []))].filter((a) => a !== areaId).map((a) => nombresAreas[a] ?? `#${a}`)
          return (
            <section key={g.title} style={{ animation: `org-in .4s ease ${i * 40}ms both` }} className="self-start rounded-2xl border border-org-linea bg-white">
              <header className="border-b border-org-linea/70 px-4 pb-2.5 pt-3.5">
                <h3 className="text-[14px] font-medium text-org-tinta">{g.title}</h3>
                <p className="mt-0.5 text-[11px] text-org-tinta/50">{g.subtitle}</p>
              </header>
              <ul className="divide-y divide-org-linea/60">
                {g.modules.map((m) => <Aplicacion key={m.id} areaId={areaId} permiso={m.id} nombre={m.name} bloqueada={ajena(m.id)} usuarios={usuarios} />)}
              </ul>
              <footer className="flex items-center gap-2 border-t border-org-linea/70 px-4 py-2 text-[11px]">
                {otras ? (
                  <span className="inline-flex items-center gap-1 text-org-tinta/50"><Lock className="h-3 w-3" aria-hidden /> Exclusiva de {duenas.join(", ")}</span>
                ) : (
                  <>
                    <span className={cn("font-mono", aqui ? "text-org-rojo" : "text-org-tinta/45")}>{aqui ? "Exclusiva de esta área" : "Compartida con todas las áreas"}</span>
                    <button type="button" disabled={fijarExclusivo.isPending} onClick={() => exclusividad(ids, aqui)} className="ml-auto text-org-rojo underline underline-offset-2 hover:text-org-oscuro">
                      {aqui ? "Compartir con todas" : "Hacer exclusiva de esta área"}
                    </button>
                  </>
                )}
              </footer>
            </section>
          )
        })}
      </div>
    </div>
  )
}

function Aplicacion({ areaId, permiso, nombre, bloqueada, usuarios }: {
  areaId: number; permiso: string; nombre: string; bloqueada: boolean; usuarios: UsuarioArea[]
}) {
  const fijar = useFijarPermisos(areaId)
  const [abierta, setAbierta] = useState(false)
  const [q, setQ] = useState("")
  const [error, setError] = useState<string>()
  const conAcceso = usuarios.filter((u) => u.permisos.includes(permiso))

  async function alternar(u: UsuarioArea) {
    setError(undefined)
    const permisos = u.permisos.includes(permiso) ? u.permisos.filter((p) => p !== permiso) : [...u.permisos, permiso]
    try { await fijar.mutateAsync({ userId: u.id, permisos }) } catch (err) { setError(getApiError(err)) }
  }

  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase()
    return t ? usuarios.filter((u) => `${u.full_name ?? ""} ${u.email}`.toLowerCase().includes(t)) : usuarios
  }, [usuarios, q])

  return (
    <li>
      <button
        type="button" onClick={() => !bloqueada && setAbierta(!abierta)} aria-expanded={abierta} disabled={bloqueada}
        className={cn("flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors", bloqueada ? "cursor-not-allowed opacity-45" : "hover:bg-org-tinte/60")}
      >
        <span className="min-w-0 flex-1 truncate text-[13px] text-org-tinta">{nombre}</span>
        <span className={cn("shrink-0 rounded-full px-2 py-0.5 font-mono text-[11px] tabular-nums", conAcceso.length ? "bg-org-rojo text-white" : "bg-org-tinte text-org-tinta/45")}>
          {conAcceso.length ? `${conAcceso.length} con acceso` : "nadie"}
        </span>
        {bloqueada ? <Lock className="h-3.5 w-3.5 shrink-0 text-org-tinta/40" aria-hidden />
          : <ChevronDown className={cn("h-4 w-4 shrink-0 text-org-tinta/35 transition-transform duration-300", abierta && "rotate-180 text-org-rojo")} aria-hidden />}
      </button>

      <div className={cn("grid transition-[grid-template-rows] duration-300 ease-out", abierta ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
        <div className="overflow-hidden">
          {abierta && (
            <div className="space-y-2 px-4 pb-4 pt-1">
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar persona…" aria-label="Buscar persona"
                className="h-8 w-full rounded-lg border border-org-linea bg-white px-3 text-[12px] text-org-tinta focus:border-org-vivo focus:outline-none focus-visible:ring-2 focus-visible:ring-org-vivo/30" />
              <ul className="grid max-h-48 gap-0.5 overflow-y-auto sm:grid-cols-2">
                {visibles.map((u) => (
                  <li key={u.id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-[12px] text-org-tinta hover:bg-org-tinte">
                      <input type="checkbox" checked={u.permisos.includes(permiso)} disabled={fijar.isPending} onChange={() => alternar(u)} className="h-4 w-4 accent-org-vivo" />
                      <span className="truncate">{u.full_name ?? u.email}</span>
                    </label>
                  </li>
                ))}
                {visibles.length === 0 && <li className="px-2 py-1 text-[12px] italic text-org-tinta/40">Sin resultados.</li>}
              </ul>
              {error && <p role="alert" className="text-[12px] text-org-rojo">{error}</p>}
            </div>
          )}
        </div>
      </div>
    </li>
  )
}
