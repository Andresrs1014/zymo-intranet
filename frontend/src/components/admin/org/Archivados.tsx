import { useMemo, useState } from "react"
import { RotateCcw, Search, Trash2, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { getApiError } from "@/hooks/useRoles"
import { useEliminarVarios, useReactivateUser, useUsuariosArchivados, type LoteResultado } from "@/hooks/useUsers"
import type { UserListItem } from "@/types/auth"

const nombre = (u: UserListItem) => u.full_name ?? u.email

/** Cuentas archivadas: se pueden reactivar o eliminar para siempre, de una en una o varias a la vez. */
export function Archivados() {
  const { data: archivados = [], isLoading } = useUsuariosArchivados()
  const reactivar = useReactivateUser()
  const [q, setQ] = useState("")
  const [marcados, setMarcados] = useState<Set<number>>(new Set())
  const [confirmando, setConfirmando] = useState(false)
  const [error, setError] = useState<string>()

  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase()
    return t ? archivados.filter((u) => `${u.full_name ?? ""} ${u.email} ${u.area ?? ""}`.toLowerCase().includes(t)) : archivados
  }, [archivados, q])
  const todosMarcados = visibles.length > 0 && visibles.every((u) => marcados.has(u.id))
  const alternar = (id: number) => setMarcados((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const seleccionados = visibles.filter((u) => marcados.has(u.id))

  async function volver(u: UserListItem) {
    setError(undefined)
    try { await reactivar.mutateAsync(u.id); setMarcados((s) => { const n = new Set(s); n.delete(u.id); return n }) } catch (err) { setError(getApiError(err)) }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 pb-16 pt-8 sm:px-10">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-org-vivo">Organización</p>
      <h2 className="mt-1 text-3xl font-semibold tracking-tight text-org-tinta">Archivados</h2>
      <p className="mt-2 font-mono text-[12px] text-org-tinta/55"><span className="text-org-rojo">{archivados.length}</span> cuentas archivadas · no pueden entrar; se pueden reactivar</p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <label className="relative min-w-52 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-org-rojo/50" aria-hidden />
          <input
            value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, correo o área…" aria-label="Buscar archivados"
            className="h-9 w-full rounded-full border border-org-linea bg-white pl-9 pr-3 text-[13px] text-org-tinta placeholder:text-org-tinta/40 focus:border-org-vivo focus:outline-none focus-visible:ring-2 focus-visible:ring-org-vivo/30"
          />
        </label>
        {visibles.length > 0 && (
          <label className="inline-flex cursor-pointer items-center gap-2 text-[12px] text-org-tinta/70">
            <input type="checkbox" checked={todosMarcados} className="h-4 w-4 accent-[#c8102e]"
              onChange={() => setMarcados(todosMarcados ? new Set() : new Set(visibles.map((u) => u.id)))} />
            Marcar {todosMarcados ? "ninguno" : "todos"}
          </label>
        )}
        <button
          type="button" disabled={seleccionados.length === 0} onClick={() => setConfirmando(true)}
          className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-full bg-org-rojo px-4 text-[13px] font-medium text-white transition-colors hover:bg-org-oscuro disabled:opacity-40"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden /> Eliminar para siempre{seleccionados.length > 0 ? ` (${seleccionados.length})` : ""}
        </button>
      </div>

      {error && <p role="alert" className="mt-4 rounded-lg border border-org-linea bg-org-tinte px-3 py-2 text-[12px] text-org-rojo">{error}</p>}
      {isLoading && <p className="py-8 font-mono text-[12px] text-org-tinta/40">Cargando archivados…</p>}
      {!isLoading && archivados.length === 0 && (
        <p className="mt-6 rounded-2xl border border-dashed border-org-linea py-14 text-center text-[13px] text-org-tinta/60">No hay cuentas archivadas.</p>
      )}

      <ul className="mt-5 space-y-2">
        {visibles.map((u) => (
          <li key={u.id} className={cn("flex items-center gap-3 rounded-2xl border bg-white px-4 py-3", marcados.has(u.id) ? "border-org-rojo/50" : "border-org-linea")}>
            <input type="checkbox" checked={marcados.has(u.id)} onChange={() => alternar(u.id)} aria-label={`Marcar a ${nombre(u)}`} className="h-4 w-4 shrink-0 accent-[#c8102e]" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-medium text-org-tinta">{nombre(u)}</p>
              <p className="truncate font-mono text-[11px] text-org-tinta/50">{[u.email, u.area, u.sede].filter(Boolean).join(" · ")}</p>
            </div>
            <button type="button" onClick={() => volver(u)} disabled={reactivar.isPending}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-org-linea px-3 py-1 text-[12px] text-org-tinta/80 transition-colors hover:bg-org-tinte hover:text-org-rojo disabled:opacity-50">
              <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Reactivar
            </button>
          </li>
        ))}
      </ul>

      {confirmando && <ConfirmarEliminar usuarios={seleccionados} onCerrar={() => { setConfirmando(false) }} onHecho={(ok) => setMarcados((s) => new Set([...s].filter((id) => !ok.includes(id))))} />}
    </div>
  )
}

/** Borrado definitivo: hay que escribir ELIMINAR. Al final dice cuántas se eliminaron y por qué alguna no. */
function ConfirmarEliminar({ usuarios, onCerrar, onHecho }: { usuarios: UserListItem[]; onCerrar: () => void; onHecho: (eliminados: number[]) => void }) {
  const eliminar = useEliminarVarios()
  const [texto, setTexto] = useState("")
  const [error, setError] = useState<string>()
  const [res, setRes] = useState<LoteResultado>()
  const porId = new Map(usuarios.map((u) => [u.id, u]))

  async function confirmar(e: React.FormEvent) {
    e.preventDefault()
    if (texto.trim() !== "ELIMINAR") return
    setError(undefined)
    try { const r = await eliminar.mutateAsync(usuarios.map((u) => u.id)); setRes(r); onHecho(r.eliminados ?? []) } catch (err) { setError(getApiError(err)) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-org-tinta/50 p-4" role="dialog" aria-modal="true" aria-label="Eliminar cuentas para siempre">
      <form onSubmit={confirmar} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl [animation:org-in_.3s_ease_both]" style={{ fontFamily: '"Ubuntu", system-ui, sans-serif' }}>
        <div className="mb-3 flex items-start justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-org-rojo">No se puede deshacer</p>
            <h2 className="text-lg font-medium text-org-tinta">{res ? "Resultado" : `Eliminar ${usuarios.length} cuenta${usuarios.length === 1 ? "" : "s"} para siempre`}</h2>
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="rounded-lg p-1 text-org-tinta/40 hover:bg-org-tinte hover:text-org-rojo"><X className="h-4 w-4" /></button>
        </div>

        {!res ? (
          <>
            <ul className="max-h-40 space-y-0.5 overflow-y-auto rounded-lg border border-org-linea bg-org-tinte/40 px-3 py-2 text-[12px] text-org-tinta/80">
              {usuarios.map((u) => <li key={u.id} className="truncate">{nombre(u)} <span className="text-org-tinta/45">· {u.email}</span></li>)}
            </ul>
            <p className="mt-3 text-[11px] leading-snug text-org-tinta/60">
              Se borran las cuentas y sus permisos propios. Las fichas del directorio quedan sin cuenta vinculada. Lo que hicieron en otros módulos
              (solicitudes, tareas…) se conserva, pero ya no se podrá abrir la cuenta. Si dudas, usa «Reactivar» en vez de eliminar.
            </p>
            <label className="mt-3 block text-[12px] text-org-tinta/70">
              Escribe <strong>ELIMINAR</strong> para confirmar
              <input autoFocus value={texto} onChange={(e) => setTexto(e.target.value)} autoComplete="off"
                className="mt-1 h-9 w-full rounded-lg border border-org-linea bg-white px-3 text-[13px] text-org-tinta focus:border-org-rojo focus:outline-none focus-visible:ring-2 focus-visible:ring-org-rojo/30" />
            </label>
            {error && <p role="alert" className="mt-3 text-[12px] text-org-rojo">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={onCerrar} className="h-9 rounded-full px-4 text-[13px] text-org-tinta/70 hover:bg-org-tinte">Cancelar</button>
              <button type="submit" disabled={texto.trim() !== "ELIMINAR" || eliminar.isPending} className="h-9 rounded-full bg-org-rojo px-4 text-[13px] font-medium text-white hover:bg-org-oscuro disabled:opacity-40">Eliminar para siempre</button>
            </div>
          </>
        ) : (
          <>
            <p className="text-[13px] text-org-tinta"><strong>{res.eliminados?.length ?? 0}</strong> eliminada{(res.eliminados?.length ?? 0) === 1 ? "" : "s"}{res.omitidos.length > 0 && <>, <strong>{res.omitidos.length}</strong> no</>}.</p>
            {res.omitidos.length > 0 && (
              <ul className="mt-2 space-y-1 text-[12px] text-org-rojo">
                {res.omitidos.map((o) => <li key={o.id}>{porId.has(o.id) ? nombre(porId.get(o.id)!) : `#${o.id}`}: {o.motivo}</li>)}
              </ul>
            )}
            <div className="mt-5 flex justify-end"><button type="button" onClick={onCerrar} className="h-9 rounded-full bg-org-rojo px-4 text-[13px] font-medium text-white hover:bg-org-oscuro">Cerrar</button></div>
          </>
        )}
      </form>
    </div>
  )
}
