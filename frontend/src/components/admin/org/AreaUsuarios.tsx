import { useEffect, useMemo, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { Archive, ArrowRightLeft, Plus, Search, ShieldCheck, Wrench, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { INTERNAL_MODULES } from "@/lib/roles"
import { getApiError } from "@/hooks/useRoles"
import { useDeactivateUser } from "@/hooks/useUsers"
import { useSedes } from "@/hooks/useSedes"
import { UserToolsModal } from "./HerramientasUsuario"
import { MoverPersona } from "./MoverPersona"
import { PermisosUsuario } from "./PermisosUsuario"
import { useCambiarCargo, useCargosArea, useCrearUsuario, useUsuariosArea, type CargoDir, type UsuarioArea } from "@/hooks/useAreaAcceso"

const APP: Record<string, string> = Object.fromEntries(INTERNAL_MODULES.map((m) => [m.id, m.name]))

const iniciales = (u: UsuarioArea) =>
  (u.full_name ?? u.email).split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("")

const boton = "rounded-lg p-1.5 text-org-tinta/35 transition-colors hover:bg-org-tinte hover:text-org-rojo"

export function AreaUsuarios({ areaId, areaNombre }: { areaId: number; areaNombre: string }) {
  const qc = useQueryClient()
  const { data: usuarios = [], isLoading } = useUsuariosArea(areaId)
  const { data: cargos = [] } = useCargosArea(areaId)
  const archivar = useDeactivateUser()
  const [q, setQ] = useState("")
  const [creando, setCreando] = useState(false)
  const [herramientas, setHerramientas] = useState<UsuarioArea | null>(null)
  const [permisosDe, setPermisosDe] = useState<UsuarioArea | null>(null)
  const [moverA, setMoverA] = useState<UsuarioArea | null>(null)
  const [abrirPermisosDe, setAbrirPermisosDe] = useState<number | null>(null) // recién creado: abrir «Editar permisos» al llegar a la lista
  const [error, setError] = useState<string>()

  useEffect(() => {
    if (abrirPermisosDe == null) return
    const u = usuarios.find((x) => x.id === abrirPermisosDe)
    if (u) { setPermisosDe(u); setAbrirPermisosDe(null) }
  }, [abrirPermisosDe, usuarios])

  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase()
    return t ? usuarios.filter((u) => `${u.full_name ?? ""} ${u.email} ${u.cargo ?? ""}`.toLowerCase().includes(t)) : usuarios
  }, [usuarios, q])

  async function quitar(u: UsuarioArea) {
    if (!window.confirm(`¿Archivar a ${u.full_name ?? u.email}? Deja de poder entrar; se puede reactivar.`)) return
    setError(undefined)
    try { await archivar.mutateAsync(u.id); qc.invalidateQueries({ queryKey: ["area-usuarios", areaId] }) } catch (err) { setError(getApiError(err)) }
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <label className="relative min-w-52 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-org-rojo/50" aria-hidden />
          <input
            value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, correo o cargo…" aria-label="Buscar usuarios"
            className="h-9 w-full rounded-full border border-org-linea bg-white pl-9 pr-3 text-[13px] text-org-tinta placeholder:text-org-tinta/40 focus:border-org-vivo focus:outline-none focus-visible:ring-2 focus-visible:ring-org-vivo/30"
          />
        </label>
        <button type="button" onClick={() => setCreando(true)} className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-full bg-org-rojo px-4 text-[13px] font-medium text-white transition-colors hover:bg-org-oscuro">
          <Plus className="h-3.5 w-3.5" aria-hidden /> Nueva persona
        </button>
      </div>

      {error && <p role="alert" className="mb-4 rounded-lg border border-org-linea bg-org-tinte px-3 py-2 text-[12px] text-org-rojo">{error}</p>}
      {isLoading && <p className="py-8 font-mono text-[12px] text-org-tinta/40">Cargando usuarios…</p>}
      {!isLoading && usuarios.length === 0 && (
        <p className="rounded-2xl border border-dashed border-org-linea py-14 text-center text-[13px] text-org-tinta/60">
          Esta área todavía no tiene personas. Crea una con «Nueva persona».
        </p>
      )}

      <ul className="space-y-2">
        {visibles.map((u, i) => (
          <li
            key={u.id} style={{ animation: `org-in .4s ease ${i * 35}ms both` }}
            className={cn("grid items-center gap-x-4 gap-y-2 rounded-2xl border border-org-linea bg-white px-4 py-3 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_13rem_8.5rem]", !u.is_active && "opacity-60")}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-org-tinte font-mono text-[12px] font-medium text-org-rojo" aria-hidden>{iniciales(u)}</span>
              <div className="min-w-0">
                <p className="truncate text-[14px] font-medium text-org-tinta">{u.full_name ?? u.email}</p>
                <p className="truncate font-mono text-[11px] text-org-tinta/50">{[u.email, u.sede].filter(Boolean).join(" · ")}</p>
              </div>
            </div>

            <button type="button" onClick={() => setPermisosDe(u)} aria-label={`Editar permisos de ${u.full_name ?? u.email}`} className="group flex min-w-0 flex-wrap items-center gap-1 rounded-lg text-left">
              {u.permisos.slice(0, 3).map((p) => <span key={p} className="rounded-full border border-org-vivo/40 bg-org-tinte px-2 py-0.5 text-[11px] font-medium text-org-rojo">{APP[p] ?? p}</span>)}
              {u.permisos.length > 3 && <span className="rounded-full bg-org-tinte px-2 py-0.5 font-mono text-[11px] text-org-rojo">+{u.permisos.length - 3}</span>}
              {u.permisos.length === 0 && <span className="text-[11px] italic text-org-tinta/40 group-hover:text-org-rojo">sin permisos asignados · editar</span>}
            </button>

            <CargoCampo areaId={areaId} u={u} cargos={cargos} />

            <div className="flex justify-self-end">
              <button type="button" onClick={() => setPermisosDe(u)} aria-label={`Editar permisos de ${u.full_name ?? u.email}`} title="Editar permisos" className={boton}><ShieldCheck className="h-4 w-4" aria-hidden /></button>
              <button type="button" onClick={() => setMoverA(u)} aria-label={`Mover a ${u.full_name ?? u.email} a otra área`} title="Mover a otra área" className={boton}><ArrowRightLeft className="h-4 w-4" aria-hidden /></button>
              <button type="button" onClick={() => setHerramientas(u)} aria-label={`Herramientas de ${u.full_name ?? u.email}`} title="Herramientas y equipos de Tareas" className={boton}><Wrench className="h-4 w-4" aria-hidden /></button>
              <button type="button" onClick={() => quitar(u)} aria-label={`Archivar a ${u.full_name ?? u.email}`} title="Archivar" className={boton}><Archive className="h-4 w-4" aria-hidden /></button>
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-6 text-[12px] text-org-tinta/50">
        Los usuarios archivados siguen en{" "}
        <Link to="/admin/configuracion/usuarios" className="text-org-rojo underline underline-offset-2">la gestión clásica de usuarios</Link>.
      </p>

      {permisosDe && <PermisosUsuario areaId={areaId} usuario={permisosDe} onCerrar={() => setPermisosDe(null)} />}
      {moverA && <MoverPersona userId={moverA.id} nombre={moverA.full_name ?? moverA.email} areaActual={areaNombre} onCerrar={() => setMoverA(null)} />}
      {herramientas && <UserToolsModal user={herramientas} onClose={() => setHerramientas(null)} />}
      {creando && <NuevaPersona areaId={areaId} areaNombre={areaNombre} cargos={cargos} onCerrar={() => setCreando(false)}
        onCreada={(id, conPermisos) => { setCreando(false); if (conPermisos) setAbrirPermisosDe(id) }} />}
    </div>
  )
}

/** Escribir o elegir el cargo: cambia en el directorio (si la persona no tiene ficha, se crea o se enlaza la de su correo). */
function CargoCampo({ areaId, u, cargos }: { areaId: number; u: UsuarioArea; cargos: CargoDir[] }) {
  const cambiar = useCambiarCargo(areaId)
  const [valor, setValor] = useState(u.cargo ?? "")
  const [error, setError] = useState<string>()
  useEffect(() => setValor(u.cargo ?? ""), [u.cargo])
  const bloqueado = u.fichas > 1
  const motivo = bloqueado ? `Está vinculado a ${u.fichas} fichas del directorio: corrige el vínculo en T&C.`
    : u.fichas === 0 ? "Sin ficha en el directorio: al poner el cargo se crea o se enlaza la que tenga su correo." : undefined

  async function confirmar() {
    const nombre = valor.trim()
    if (bloqueado || !nombre || nombre === (u.cargo ?? "")) { setValor(u.cargo ?? ""); return }
    const existente = cargos.find((c) => c.nombre.trim().toLowerCase() === nombre.toLowerCase())
    setError(undefined)
    try { await cambiar.mutateAsync(existente ? { userId: u.id, cargo_id: existente.id } : { userId: u.id, nombre }) } catch (err) { setError(getApiError(err)); setValor(u.cargo ?? "") }
  }

  return (
    <div title={motivo}>
      <label className="block">
        <span className="sr-only">Cargo de {u.full_name ?? u.email}</span>
        <input
          list={`cargos-${areaId}`} value={valor} disabled={bloqueado || cambiar.isPending} placeholder={bloqueado ? `${u.fichas} fichas` : "Escribe o elige el cargo…"}
          onChange={(e) => setValor(e.target.value)} onBlur={confirmar}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") { setValor(u.cargo ?? ""); e.currentTarget.blur() } }}
          className="h-8 w-full rounded-lg border border-org-linea bg-white px-2.5 text-[12px] text-org-tinta placeholder:text-org-tinta/35 focus:border-org-vivo focus:outline-none focus-visible:ring-2 focus-visible:ring-org-vivo/30 disabled:bg-org-tinte/50"
        />
      </label>
      {error && <p role="alert" className="mt-1 text-[11px] text-org-rojo">{error}</p>}
      <datalist id={`cargos-${areaId}`}>{cargos.map((c) => <option key={c.id} value={c.nombre} />)}</datalist>
    </div>
  )
}

/** Una sola pantalla, sin pasos: solo nombre, correo y contraseña son obligatorios. Cargo y permisos se pueden poner ya o después. */
function NuevaPersona({ areaId, areaNombre, cargos, onCerrar, onCreada }: {
  areaId: number; areaNombre: string; cargos: CargoDir[]; onCerrar: () => void; onCreada: (id: number, conPermisos: boolean) => void
}) {
  const { data: sedes = [] } = useSedes()
  const crear = useCrearUsuario(areaId)
  const [f, setF] = useState({ full_name: "", email: "", password: "", sede: "", cargo: "" })
  const conPermisos = useRef(false) // qué botón envió el formulario (un ref: el clic ocurre antes del submit y no debe esperar un re-render)
  const [error, setError] = useState<string>()
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value })
  const campo = "h-9 w-full rounded-lg border border-org-linea bg-white px-3 text-[13px] text-org-tinta focus:border-org-vivo focus:outline-none focus-visible:ring-2 focus-visible:ring-org-vivo/30"

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setError(undefined)
    try {
      const r = await crear.mutateAsync({ full_name: f.full_name, email: f.email, password: f.password, sede: f.sede || undefined, cargo: f.cargo.trim() || undefined })
      onCreada(r.id, conPermisos.current)
    } catch (err) {
      setError(getApiError(err))
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-org-tinta/50 p-4" role="dialog" aria-modal="true" aria-label="Nueva persona">
      <form onSubmit={enviar} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl [animation:org-in_.3s_ease_both]" style={{ fontFamily: '"Ubuntu", system-ui, sans-serif' }}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-org-vivo">{areaNombre}</p>
            <h2 className="text-lg font-medium text-org-tinta">Nueva persona</h2>
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="rounded-lg p-1 text-org-tinta/40 hover:bg-org-tinte hover:text-org-rojo"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid gap-3">
          <input required placeholder="Nombre completo" aria-label="Nombre completo" value={f.full_name} onChange={set("full_name")} className={campo} />
          <input required type="email" placeholder="Correo" aria-label="Correo" value={f.email} onChange={set("email")} className={campo} />
          <input required minLength={8} type="password" placeholder="Contraseña (mínimo 8)" aria-label="Contraseña" value={f.password} onChange={set("password")} className={campo} />
          <div className="grid grid-cols-2 gap-3">
            <select aria-label="Sede (opcional)" value={f.sede} onChange={set("sede")} className={campo}>
              <option value="">Sede (opcional)</option>
              {sedes.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
            <input list="cargos-nueva" placeholder="Cargo (opcional)" aria-label="Cargo (opcional)" value={f.cargo} onChange={set("cargo")} className={campo} />
            <datalist id="cargos-nueva">{cargos.map((c) => <option key={c.id} value={c.nombre} />)}</datalist>
          </div>
        </div>
        <p className="mt-3 text-[11px] text-org-tinta/50">El área es <strong>{areaNombre}</strong>. Cargo y permisos son opcionales: puedes ponerlos ahora o después, desde la lista.</p>
        {error && <p role="alert" className="mt-3 text-[12px] text-org-rojo">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCerrar} className="h-9 rounded-full px-4 text-[13px] text-org-tinta/70 hover:bg-org-tinte">Cancelar</button>
          <button type="submit" disabled={crear.isPending} onClick={() => { conPermisos.current = false }} className="h-9 rounded-full border border-org-rojo px-4 text-[13px] font-medium text-org-rojo hover:bg-org-tinte disabled:opacity-60">Crear</button>
          <button type="submit" disabled={crear.isPending} onClick={() => { conPermisos.current = true }} className="h-9 rounded-full bg-org-rojo px-4 text-[13px] font-medium text-white hover:bg-org-oscuro disabled:opacity-60">Crear y dar permisos</button>
        </div>
      </form>
    </div>
  )
}
