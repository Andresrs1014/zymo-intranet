import { useMemo, useState } from "react"
import { Archive, ArrowRightLeft, Search, ShieldCheck } from "lucide-react"
import { INTERNAL_MODULES } from "@/lib/roles"
import type { AreaItem } from "@/hooks/useAreas"
import { useTodosUsuarios, type UsuarioArea } from "@/hooks/useAreaAcceso"
import { useArchivarVarios } from "@/hooks/useUsers"
import { getApiError } from "@/hooks/useRoles"
import { useAuthStore } from "@/store/authStore"
import { MoverPersona } from "./MoverPersona"
import { PermisosUsuario } from "./PermisosUsuario"

const APP: Record<string, string> = Object.fromEntries(INTERNAL_MODULES.map((m) => [m.id, m.name]))
const nombre = (u: UsuarioArea) => u.full_name ?? u.email
const iniciales = (u: UsuarioArea) => nombre(u).split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("")

/** Vista principal: todas las cuentas activas, con buscador. El área sale del texto de la cuenta (la misma que usa el SIG). */
export function TodasPersonas({ areas, onVerArea }: { areas: AreaItem[]; onVerArea: (id: number) => void }) {
  const { data: usuarios = [], isLoading } = useTodosUsuarios()
  const [q, setQ] = useState("")
  const [moverA, setMoverA] = useState<UsuarioArea | null>(null)
  const yo = useAuthStore((s) => s.user?.id)
  const archivarVarios = useArchivarVarios()
  const [marcados, setMarcados] = useState<Set<number>>(new Set())
  const [aviso, setAviso] = useState<string>()
  const alternar = (id: number) => setMarcados((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })

  async function archivarMarcados() {
    const ids = [...marcados]
    if (!window.confirm(`¿Archivar ${ids.length} cuenta${ids.length === 1 ? "" : "s"}? Dejan de poder entrar; se pueden reactivar desde «Archivados».`)) return
    setAviso(undefined)
    try {
      const r = await archivarVarios.mutateAsync(ids)
      setMarcados(new Set())
      if (r.omitidos.length > 0) setAviso(`${r.archivados?.length ?? 0} archivadas; ${r.omitidos.length} no: ${r.omitidos.map((o) => o.motivo).join(", ")}.`)
    } catch (err) { setAviso(getApiError(err)) }
  }
  const [permisosDe, setPermisosDe] = useState<{ u: UsuarioArea; areaId: number } | null>(null)
  const areaDe = (u: UsuarioArea) => areas.find((a) => a.name.toLowerCase() === (u.area ?? "").trim().toLowerCase())

  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase()
    return t ? usuarios.filter((u) => `${u.full_name ?? ""} ${u.email} ${u.cargo ?? ""} ${u.area ?? ""}`.toLowerCase().includes(t)) : usuarios
  }, [usuarios, q])

  return (
    <div className="mx-auto max-w-5xl px-6 pb-16 pt-8 sm:px-10">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-org-vivo">Organización</p>
      <h2 className="mt-1 text-3xl font-semibold tracking-tight text-org-tinta">Todas las personas</h2>
      <p className="mt-2 font-mono text-[12px] text-org-tinta/55">
        <span className="text-org-rojo">{usuarios.length}</span> cuentas activas · <span className="text-org-rojo">{usuarios.filter((u) => !u.area).length}</span> sin área
      </p>

      <label className="relative mt-6 block sm:max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-org-rojo/50" aria-hidden />
        <input
          value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, correo, cargo o área…" aria-label="Buscar personas"
          className="h-9 w-full rounded-full border border-org-linea bg-white pl-9 pr-3 text-[13px] text-org-tinta placeholder:text-org-tinta/40 focus:border-org-vivo focus:outline-none focus-visible:ring-2 focus-visible:ring-org-vivo/30"
        />
      </label>

      {marcados.size > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-org-rojo/30 bg-org-tinte/60 px-4 py-2 text-[12px] text-org-tinta">
          <span><strong>{marcados.size}</strong> marcada{marcados.size === 1 ? "" : "s"}</span>
          <button type="button" onClick={archivarMarcados} disabled={archivarVarios.isPending}
            className="inline-flex items-center gap-1.5 rounded-full bg-org-rojo px-3 py-1 font-medium text-white hover:bg-org-oscuro disabled:opacity-50"><Archive className="h-3.5 w-3.5" aria-hidden /> Archivar seleccionadas</button>
          <button type="button" onClick={() => setMarcados(new Set())} className="text-org-tinta/60 underline-offset-2 hover:underline">Quitar selección</button>
        </div>
      )}
      {aviso && <p role="alert" className="mt-3 rounded-lg border border-org-linea bg-org-tinte px-3 py-2 text-[12px] text-org-rojo">{aviso}</p>}
      {isLoading && <p className="py-8 font-mono text-[12px] text-org-tinta/40">Cargando personas…</p>}
      {!isLoading && visibles.length === 0 && <p className="py-10 text-[13px] text-org-tinta/60">Nadie coincide con «{q}».</p>}

      <ul className="mt-5 space-y-2">
        {visibles.map((u) => {
          const area = areaDe(u)
          return (
            <li key={u.id} className="grid items-center gap-x-4 gap-y-2 rounded-2xl border border-org-linea bg-white px-4 py-3 md:grid-cols-[1.25rem_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_5.5rem]">
              <input type="checkbox" checked={marcados.has(u.id)} disabled={u.id === yo} onChange={() => alternar(u.id)}
                aria-label={`Marcar a ${nombre(u)}`} title={u.id === yo ? "No puedes archivarte a ti mismo" : undefined} className="h-4 w-4 accent-[#c8102e] disabled:opacity-30" />
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-org-tinte font-mono text-[12px] font-medium text-org-rojo" aria-hidden>{iniciales(u)}</span>
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-medium text-org-tinta">{nombre(u)}</p>
                  <p className="truncate font-mono text-[11px] text-org-tinta/50">{[u.email, u.sede].filter(Boolean).join(" · ")}</p>
                </div>
              </div>
              <div className="min-w-0 text-[12px]">
                {area ? (
                  <button type="button" onClick={() => onVerArea(area.id)} title="Abrir esta área" className="max-w-full truncate rounded-full border border-org-vivo/40 bg-org-tinte px-2.5 py-0.5 font-medium text-org-rojo hover:bg-white">{area.name}</button>
                ) : (
                  <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="rounded-full border border-dashed border-org-tinta/30 px-2.5 py-0.5 font-medium text-org-tinta/60">Sin área</span>
                    {u.area && <span className="italic text-org-tinta/45" title="El texto del área de su cuenta no coincide con ningún área creada">({u.area})</span>}
                    <button type="button" onClick={() => setMoverA(u)} className="font-medium text-org-rojo underline-offset-2 hover:underline">Asignar área</button>
                  </span>
                )}
                <p className="mt-1 truncate text-org-tinta/60">{u.cargo ?? (u.fichas > 1 ? `${u.fichas} fichas vinculadas` : u.fichas === 0 ? "sin ficha en el directorio" : "sin cargo")}</p>
              </div>
              <div className="flex min-w-0 flex-wrap items-center gap-1">
                {u.permisos.slice(0, 3).map((p) => <span key={p} className="rounded-full border border-org-vivo/40 bg-org-tinte px-2 py-0.5 text-[11px] font-medium text-org-rojo">{APP[p] ?? p}</span>)}
                {u.permisos.length > 3 && <span className="rounded-full bg-org-tinte px-2 py-0.5 font-mono text-[11px] text-org-rojo">+{u.permisos.length - 3}</span>}
                {u.permisos.length === 0 && <span className="text-[11px] italic text-org-tinta/40">sin permisos asignados</span>}
              </div>
              <div className="flex justify-self-end">
                <button
                  type="button" onClick={() => setMoverA(u)} aria-label={`${area ? "Mover" : "Asignar área a"} ${nombre(u)}`} title={area ? "Mover a otra área" : "Asignar área"}
                  className="rounded-lg p-1.5 text-org-tinta/35 transition-colors hover:bg-org-tinte hover:text-org-rojo"
                ><ArrowRightLeft className="h-4 w-4" aria-hidden /></button>
                <button
                  type="button" disabled={!area} onClick={() => area && setPermisosDe({ u, areaId: area.id })}
                  aria-label={`Editar permisos de ${nombre(u)}`} title={area ? "Editar permisos" : "Necesita un área para asignar permisos"}
                  className="rounded-lg p-1.5 text-org-tinta/35 transition-colors hover:bg-org-tinte hover:text-org-rojo disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-org-tinta/35"
                ><ShieldCheck className="h-4 w-4" aria-hidden /></button>
              </div>
            </li>
          )
        })}
      </ul>

      {moverA && <MoverPersona userId={moverA.id} nombre={nombre(moverA)} areaActual={areaDe(moverA)?.name ?? null} onCerrar={() => setMoverA(null)} />}
      {permisosDe && <PermisosUsuario areaId={permisosDe.areaId} usuario={permisosDe.u} onCerrar={() => setPermisosDe(null)} />}
    </div>
  )
}
