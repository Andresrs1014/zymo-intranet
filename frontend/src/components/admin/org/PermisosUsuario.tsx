import { useEffect, useMemo, useState } from "react"
import { Lock, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { ORG_PERMISSION_GROUPS, PERMISOS_REQUERIDOS } from "@/lib/roles"
import { getApiError } from "@/hooks/useRoles"
import { useAreas } from "@/hooks/useAreas"
import { useExclusivos, useFijarAreasSig, useFijarPermisos, type UsuarioArea } from "@/hooks/useAreaAcceso"

const toggle = (set: Set<string>, v: string) => {
  const n = new Set(set)
  if (n.has(v)) n.delete(v)
  else { n.add(v); (PERMISOS_REQUERIDOS[v] ?? []).forEach((r) => n.add(r)) }
  return n
}

/** Editar permisos: se marca lo que esta persona necesita ver. Solo decide qué aplicaciones aparecen; no cambia cómo funcionan. */
export function PermisosUsuario({ areaId, usuario, onCerrar }: { areaId: number; usuario: UsuarioArea; onCerrar: () => void }) {
  const fijar = useFijarPermisos(areaId)
  const { data: exclusivos = [] } = useExclusivos()
  const [marcados, setMarcados] = useState(new Set(usuario.permisos))
  const fijarAreas = useFijarAreasSig()
  const { data: areas = [] } = useAreas()
  const [extra, setExtra] = useState(new Set(usuario.areas_extra ?? []))
  const [error, setError] = useState<string>()

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onCerrar() }
    window.addEventListener("keydown", esc)
    return () => window.removeEventListener("keydown", esc)
  }, [onCerrar])

  const exclusivo = useMemo(() => new Map(exclusivos.map((e) => [e.permiso, e.areas])), [exclusivos])
  const ajeno = (p: string) => { const a = exclusivo.get(p); return a != null && !a.includes(areaId) }
  const esLiderSig = marcados.has("mod_sig_lider")
  const otras = areas.filter((a) => a.name.trim().toLowerCase() !== (usuario.area ?? "").trim().toLowerCase())
  const extraInicial = usuario.areas_extra ?? []
  const cambiosAreas = extra.size !== extraInicial.length || extraInicial.some((i) => !extra.has(i))
  const cambios = marcados.size !== usuario.permisos.length || usuario.permisos.some((p) => !marcados.has(p)) || cambiosAreas

  async function guardar() {
    setError(undefined)
    try {
      await fijar.mutateAsync({ userId: usuario.id, permisos: [...marcados] })
      // sin el permiso de líder las áreas extra no sirven: se limpian
      if (cambiosAreas || (!esLiderSig && extraInicial.length > 0)) await fijarAreas.mutateAsync({ userId: usuario.id, areas: esLiderSig ? [...extra] : [] })
      onCerrar()
    } catch (err) {
      setError(getApiError(err))
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-org-tinta/50 p-4" role="dialog" aria-modal="true" aria-label="Editar permisos"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar() }}>
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl [animation:org-in_.3s_ease_both]" style={{ fontFamily: '"Ubuntu", system-ui, sans-serif' }}>
        <header className="flex items-start justify-between border-b border-org-linea px-6 pb-4 pt-5">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-org-vivo">Editar permisos</p>
            <h2 className="truncate text-lg font-medium text-org-tinta">{usuario.full_name ?? usuario.email}</h2>
            <p className="mt-0.5 text-[12px] text-org-tinta/55">Marca lo que esta persona necesita. Solo decide qué aplicaciones ve; no cambia cómo funcionan.</p>
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="rounded-lg p-1 text-org-tinta/40 transition-colors hover:bg-org-tinte hover:text-org-rojo"><X className="h-4 w-4" /></button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="grid gap-3 sm:grid-cols-2">
            {ORG_PERMISSION_GROUPS.map((g) => (
              <fieldset key={g.title} className="self-start rounded-2xl border border-org-linea p-4">
                <legend className="px-1 text-[13px] font-medium text-org-tinta">{g.title}</legend>
                <ul className="space-y-0.5">
                  {g.modules.map((m) => {
                    const bloqueado = ajeno(m.id)
                    return (
                      <li key={m.id}>
                        <label className={cn("flex items-start gap-2 rounded-lg px-1.5 py-1 text-[13px]", bloqueado ? "cursor-not-allowed text-org-tinta/35" : "cursor-pointer text-org-tinta hover:bg-org-tinte")}
                          title={bloqueado ? "Exclusiva de otras áreas" : m.description}>
                          <input type="checkbox" disabled={bloqueado} checked={marcados.has(m.id)} onChange={() => setMarcados(toggle(marcados, m.id))} className="mt-0.5 h-4 w-4 accent-org-vivo" />
                          <span className="flex-1">{m.name}</span>
                          {bloqueado && <Lock className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />}
                        </label>
                      </li>
                    )
                  })}
                </ul>
              </fieldset>
            ))}
          </div>

          {esLiderSig && (
            <fieldset className="mt-3 rounded-2xl border border-org-linea p-4">
              <legend className="px-1 text-[13px] font-medium text-org-tinta">SIG — Áreas adicionales</legend>
              <p className="mb-2 text-[12px] text-org-tinta/55">
                Ya ve las de su área{usuario.area ? <> (<strong>{usuario.area}</strong>)</> : null}. Marca las otras áreas de las que es líder. Debe volver a iniciar sesión para verlas.
              </p>
              <ul className="grid gap-0.5 sm:grid-cols-2">
                {otras.map((a) => (
                  <li key={a.id}>
                    <label className="flex cursor-pointer items-start gap-2 rounded-lg px-1.5 py-1 text-[13px] text-org-tinta hover:bg-org-tinte">
                      <input type="checkbox" checked={extra.has(a.id)} onChange={() => setExtra((s) => { const n = new Set(s); if (n.has(a.id)) n.delete(a.id); else n.add(a.id); return n })} className="mt-0.5 h-4 w-4 accent-org-vivo" />
                      <span className="flex-1">{a.name}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
          )}
        </div>

        <footer className="flex items-center gap-3 border-t border-org-linea px-6 py-3">
          {error && <p role="alert" className="min-w-0 flex-1 truncate text-[12px] text-org-rojo" title={error}>{error}</p>}
          <span className="ml-auto font-mono text-[11px] text-org-tinta/50">{marcados.size} marcado{marcados.size === 1 ? "" : "s"}</span>
          <button type="button" onClick={onCerrar} className="h-9 rounded-full px-4 text-[13px] text-org-tinta/70 transition-colors hover:bg-org-tinte">Cancelar</button>
          <button type="button" onClick={guardar} disabled={!cambios || fijar.isPending} className="h-9 rounded-full bg-org-rojo px-5 text-[13px] font-medium text-white transition-colors hover:bg-org-oscuro disabled:opacity-50">
            {fijar.isPending ? "Guardando…" : "Guardar permisos"}
          </button>
        </footer>
      </div>
    </div>
  )
}
