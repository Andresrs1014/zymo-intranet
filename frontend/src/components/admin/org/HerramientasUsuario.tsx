import { useEffect, useState } from "react"
import { ChevronDown, Trash2, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useUserTools, useAssignUserTool, useRevokeUserTool } from "@/hooks/useUserTools"
import {
  useAllTeams, useUserTeams, useAdminAssignOwner, useAdminAssignMember, useAdminRemoveMember, useDeleteTeam,
} from "@/hooks/useTaskTeams"
import { useTasks, useDeleteTask } from "@/hooks/useTasks"
import type { Team } from "@/types/task"

const TOOLS = [
  { key: "tool_task_submit_dev", label: "Gestión de Tareas — Colaborador", desc: "Acceso a registro de tareas propias" },
  { key: "tool_task_manage_dev", label: "Gestión de Tareas — Gestor", desc: "Gestión completa del equipo de tareas" },
]

const Etiqueta = ({ children }: { children: React.ReactNode }) => (
  <h4 className="font-mono text-[10px] uppercase tracking-[0.18em] text-org-vivo">{children}</h4>
)

const campo = "h-9 w-full rounded-lg border border-org-linea bg-white px-3 text-[13px] text-org-tinta focus:border-org-vivo focus:outline-none focus-visible:ring-2 focus-visible:ring-org-vivo/30 disabled:opacity-60"
const botonRojo = "h-9 rounded-full bg-org-rojo px-4 text-[13px] font-medium text-white transition-colors hover:bg-org-oscuro disabled:opacity-50"

const mensaje = (err: unknown, defecto: string) => {
  const r = (err as { response?: { data?: { error?: string; detail?: string } } })?.response?.data
  return r?.error ?? r?.detail ?? defecto
}

/** Herramientas de Tareas de una persona, su equipo y sus tareas. Se abre desde Organización y desde la gestión clásica de usuarios. */
export function UserToolsModal({ user, onClose }: { user: { id: number; full_name: string | null; email: string }; onClose: () => void }) {
  const { data: activeTools = [], isLoading, refetch: refetchActiveTools } = useUserTools(user.id)
  const assign = useAssignUserTool()
  const revoke = useRevokeUserTool()
  const { data: allTeams = [], refetch: refetchAllTeams } = useAllTeams()
  const { data: userTeams, refetch: refetchUserTeams } = useUserTeams(user.id)
  const assignOwner = useAdminAssignOwner()
  const assignMember = useAdminAssignMember()
  const removeMember = useAdminRemoveMember()

  const [aviso, setAviso] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null)
  const [newTeamName, setNewTeamName] = useState("")
  const [selectedTeamId, setSelectedTeamId] = useState<number | "">("")
  const [selectedColabTeamId, setSelectedColabTeamId] = useState<number | "">("")

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", esc)
    return () => window.removeEventListener("keydown", esc)
  }, [onClose])

  const ownedTeam = userTeams?.ownedTeams?.[0]
  const memberTeams = userTeams?.memberTeams ?? []
  const ocupado = assign.isPending || revoke.isPending || assignOwner.isPending || assignMember.isPending || removeMember.isPending
  const esGestor = activeTools.includes("tool_task_manage_dev")
  const esColaborador = activeTools.includes("tool_task_submit_dev")
  const refrescar = () => { refetchActiveTools(); refetchUserTeams() }

  function alternar(tool_key: string, activa: boolean) {
    setAviso(null)
    const opciones = {
      onError: (err: unknown) => setAviso({ tipo: "error", texto: mensaje(err, activa ? "No se pudo revocar la herramienta." : "No se pudo asignar la herramienta.") }),
      onSuccess: refrescar,
    }
    if (activa) revoke.mutate({ user_id: user.id, tool_key }, opciones)
    else assign.mutate({ user_id: user.id, tool_key }, opciones)
  }

  async function asignarGestor() {
    setAviso(null)
    try {
      if (newTeamName.trim()) {
        await assignOwner.mutateAsync({ userId: user.id, newTeamName: newTeamName.trim() })
        setNewTeamName("")
        setAviso({ tipo: "ok", texto: "Equipo creado y asignado como gestor." })
      } else if (selectedTeamId) {
        await assignOwner.mutateAsync({ userId: user.id, teamId: Number(selectedTeamId) })
        setAviso({ tipo: "ok", texto: "Gestor del equipo actualizado." })
      }
      refetchUserTeams()
      refetchAllTeams()
    } catch (err) {
      setAviso({ tipo: "error", texto: mensaje(err, "Error al asignar gestor de equipo") })
    }
  }

  async function agregarColaborador() {
    if (!selectedColabTeamId) return
    setAviso(null)
    try {
      await assignMember.mutateAsync({ userId: user.id, teamId: Number(selectedColabTeamId) })
      setSelectedColabTeamId("")
      refetchUserTeams()
      setAviso({ tipo: "ok", texto: "Agregado al equipo como colaborador." })
    } catch (err) {
      setAviso({ tipo: "error", texto: mensaje(err, "Error al agregar al equipo") })
    }
  }

  async function quitarDeEquipo(teamId: number) {
    if (!window.confirm("¿Desvincular a este usuario de este equipo?")) return
    setAviso(null)
    try {
      await removeMember.mutateAsync({ userId: user.id, teamId })
      refetchUserTeams()
      setAviso({ tipo: "ok", texto: "Removido del equipo." })
    } catch (err) {
      setAviso({ tipo: "error", texto: mensaje(err, "Error al remover del equipo") })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-org-tinta/50 p-4" role="dialog" aria-modal="true" aria-label="Herramientas de la persona" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl [animation:org-in_.3s_ease_both]" style={{ fontFamily: '"Ubuntu", system-ui, sans-serif' }}>
        <header className="flex items-start justify-between border-b border-org-linea px-6 pb-4 pt-5">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-org-vivo">Herramientas</p>
            <h2 className="truncate text-lg font-medium text-org-tinta">{user.full_name ?? user.email}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-lg p-1 text-org-tinta/40 transition-colors hover:bg-org-tinte hover:text-org-rojo"><X className="h-4 w-4" /></button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          {aviso && (
            <p role={aviso.tipo === "error" ? "alert" : "status"} className={cn("rounded-lg border px-3 py-2 text-[12px]", aviso.tipo === "error" ? "border-org-linea bg-org-tinte text-org-rojo" : "border-kpi-ok/30 bg-kpi-ok/5 text-kpi-ok")}>{aviso.texto}</p>
          )}

          <section className="space-y-2.5">
            <Etiqueta>Permisos de herramientas</Etiqueta>
            {isLoading ? <p className="py-3 text-center font-mono text-[12px] text-org-tinta/40">Cargando…</p> : TOOLS.map((tool) => {
              const activa = activeTools.includes(tool.key)
              return (
                <div key={tool.key} className="flex items-center justify-between gap-4 rounded-xl border border-org-linea px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-org-tinta">{tool.label}</p>
                    <p className="text-[12px] text-org-tinta/55">{tool.desc}</p>
                  </div>
                  <button
                    type="button" role="switch" aria-checked={activa} aria-label={tool.label} onClick={() => alternar(tool.key, activa)} disabled={ocupado}
                    className={cn("relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 disabled:opacity-50", activa ? "bg-org-rojo" : "bg-org-linea")}
                  >
                    <span className={cn("inline-block h-5 w-5 rounded-full bg-white shadow transition duration-200", activa ? "translate-x-5" : "translate-x-0")} />
                  </button>
                </div>
              )
            })}
          </section>

          {esGestor && !isLoading && (
            <section className="space-y-3 border-t border-org-linea pt-5">
              <Etiqueta>Equipo que gestiona</Etiqueta>
              {ownedTeam ? (
                <div className="rounded-xl bg-org-tinte px-4 py-3">
                  <p className="font-mono text-[10px] uppercase text-org-tinta/50">Equipo asignado</p>
                  <p className="text-[14px] font-medium text-org-rojo">{ownedTeam.name}</p>
                </div>
              ) : <p className="text-[12px] text-org-rojo">Este gestor todavía no tiene un equipo asignado.</p>}
              <label className="block">
                <span className="mb-1 block font-mono text-[10px] uppercase text-org-tinta/50">Vincular a un equipo existente</span>
                <select value={selectedTeamId} disabled={ocupado} className={campo}
                  onChange={(e) => { setSelectedTeamId(e.target.value ? Number(e.target.value) : ""); setNewTeamName("") }}>
                  <option value="">Seleccionar equipo…</option>
                  {allTeams.map((team) => <option key={team.id} value={team.id}>{team.name} (gestor #{team.ownerUserId})</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block font-mono text-[10px] uppercase text-org-tinta/50">O crear un equipo nuevo para este gestor</span>
                <input value={newTeamName} disabled={ocupado} placeholder="Nombre del nuevo equipo…" className={campo}
                  onChange={(e) => { setNewTeamName(e.target.value); setSelectedTeamId("") }} />
              </label>
              <button type="button" onClick={asignarGestor} disabled={ocupado || (!selectedTeamId && !newTeamName.trim())} className={cn(botonRojo, "w-full")}>
                {newTeamName.trim() ? "Crear y asignar equipo" : "Vincular a equipo"}
              </button>
            </section>
          )}

          {esColaborador && !isLoading && (
            <section className="space-y-3 border-t border-org-linea pt-5">
              <Etiqueta>Equipos en los que colabora</Etiqueta>
              {memberTeams.length > 0 ? (
                <ul className="space-y-1.5">
                  {memberTeams.map((team) => (
                    <li key={team.id} className="flex items-center justify-between rounded-xl bg-org-tinte px-3 py-2">
                      <span className="text-[13px] font-medium text-org-tinta">{team.name}</span>
                      <button type="button" onClick={() => quitarDeEquipo(team.id)} disabled={ocupado} className="text-[12px] font-medium text-org-rojo underline underline-offset-2 hover:text-org-oscuro">Remover</button>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-[12px] text-org-rojo">Este colaborador todavía no está en ningún equipo.</p>}
              <div className="flex gap-2">
                <select value={selectedColabTeamId} disabled={ocupado} aria-label="Agregar a un equipo" className={cn(campo, "flex-1")}
                  onChange={(e) => setSelectedColabTeamId(e.target.value ? Number(e.target.value) : "")}>
                  <option value="">Agregar a un equipo…</option>
                  {allTeams.filter((t) => !memberTeams.some((m) => m.id === t.id)).map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
                </select>
                <button type="button" onClick={agregarColaborador} disabled={ocupado || !selectedColabTeamId} className={botonRojo}>Agregar</button>
              </div>
            </section>
          )}

          <section className="space-y-3 border-t border-org-linea pt-5">
            <Etiqueta>Tareas registradas</Etiqueta>
            <TareasDe userId={user.id} allTeams={allTeams} />
            {(userTeams?.ownedTeams ?? []).map((t) => <EliminarEspacio key={t.id} teamId={t.id} teamName={t.name} onDeleted={refetchUserTeams} />)}
          </section>
        </div>

        <footer className="flex justify-end border-t border-org-linea px-6 py-3">
          <button type="button" onClick={onClose} className="h-9 rounded-full px-5 text-[13px] text-org-tinta/70 transition-colors hover:bg-org-tinte">Cerrar</button>
        </footer>
      </div>
    </div>
  )
}

function TareasDe({ userId, allTeams }: { userId: number; allTeams: Team[] }) {
  const { data: result, isLoading } = useTasks({ subidoPorId: userId, limit: 200 })
  const borrar = useDeleteTask()
  const [confirmId, setConfirmId] = useState<number | null>(null)
  const [abiertos, setAbiertos] = useState<Record<number, boolean>>({})
  const tareas = result?.tasks ?? []

  if (isLoading) return <p className="py-1 font-mono text-[12px] text-org-tinta/40">Cargando tareas…</p>
  if (tareas.length === 0) return <p className="text-[12px] italic text-org-tinta/45">Sin tareas registradas.</p>

  const porEquipo = tareas.reduce<Record<number, typeof tareas>>((acc, t) => { (acc[t.teamId] ??= []).push(t); return acc }, {})
  return (
    <div className="max-h-64 space-y-2 overflow-y-auto">
      {Object.entries(porEquipo).map(([id, lista]) => {
        const teamId = Number(id)
        const abierto = abiertos[teamId] ?? false
        return (
          <div key={teamId} className="overflow-hidden rounded-xl border border-org-linea">
            <button type="button" aria-expanded={abierto} onClick={() => setAbiertos({ ...abiertos, [teamId]: !abierto })}
              className="flex w-full items-center justify-between bg-org-tinte/60 px-3 py-2 text-left transition-colors hover:bg-org-tinte">
              <span className="text-[12px] font-medium text-org-tinta">{allTeams.find((t) => t.id === teamId)?.name ?? `Equipo #${teamId}`}</span>
              <span className="flex items-center gap-1.5 font-mono text-[11px] text-org-tinta/55">{lista.length} tarea{lista.length === 1 ? "" : "s"}<ChevronDown className={cn("h-3.5 w-3.5 transition-transform", abierto && "rotate-180")} aria-hidden /></span>
            </button>
            {abierto && (
              <ul className="divide-y divide-org-linea/60">
                {lista.map((tarea) => (
                  <li key={tarea.id} className="flex items-center justify-between gap-2 px-3 py-1.5 text-[12px]">
                    <div className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-org-tinta">{tarea.titulo}</span>
                      <span className="font-mono text-[11px] text-org-tinta/50">{tarea.fecha?.slice(0, 10)} · {tarea.estado}</span>
                    </div>
                    {confirmId === tarea.id ? (
                      <div className="flex shrink-0 gap-2">
                        <button type="button" onClick={() => { borrar.mutate(tarea.id); setConfirmId(null) }} className="font-medium text-org-rojo">Confirmar</button>
                        <button type="button" onClick={() => setConfirmId(null)} className="text-org-tinta/55">Cancelar</button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setConfirmId(tarea.id)} title="Borrar tarea" aria-label={`Borrar la tarea ${tarea.titulo}`} className="shrink-0 rounded p-1 text-org-tinta/30 transition-colors hover:text-org-rojo"><Trash2 className="h-3.5 w-3.5" aria-hidden /></button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}

function EliminarEspacio({ teamId, teamName, onDeleted }: { teamId: number; teamName: string; onDeleted: () => void }) {
  const eliminar = useDeleteTeam()
  const [confirmar, setConfirmar] = useState(false)
  return (
    <div className="space-y-2 rounded-xl border border-org-linea bg-org-tinte/50 p-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-org-rojo">Zona de peligro</p>
      {confirmar ? (
        <div className="space-y-2">
          <p className="text-[12px] text-org-tinta">¿Eliminar <strong>«{teamName}»</strong>? Desactiva el equipo de forma permanente.</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setConfirmar(false)} className="h-8 flex-1 rounded-full border border-org-linea text-[12px] text-org-tinta hover:bg-white">Cancelar</button>
            <button type="button" disabled={eliminar.isPending} className="h-8 flex-1 rounded-full bg-org-rojo text-[12px] font-medium text-white hover:bg-org-oscuro disabled:opacity-60"
              onClick={async () => { await eliminar.mutateAsync(teamId); setConfirmar(false); onDeleted() }}>
              {eliminar.isPending ? "Eliminando…" : "Sí, eliminar"}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[12px] text-org-tinta">{teamName}</span>
          <button type="button" onClick={() => setConfirmar(true)} className="shrink-0 rounded-full border border-org-rojo/40 px-3 py-1 text-[12px] text-org-rojo transition-colors hover:bg-white">Eliminar espacio</button>
        </div>
      )}
    </div>
  )
}
