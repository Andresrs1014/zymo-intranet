import { useEffect, useState, useCallback, useMemo } from "react"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"
import { api } from "@/lib/api"
import { PageLayout } from "@/components/layout/PageLayout"
import {
  ArrowLeft, Plus, X, Users, FileText, CheckCircle2, ClipboardList,
  Camera, Download, Upload, ImageOff, Pencil, Save, Flag, Lock,
} from "lucide-react"

interface PersonaMini {
  id: number; nombre: string
  cargo_id: number | null; cargo_nombre: string
  area_id: number | null; area_nombre: string
  empresa_id: number | null; empresa_nombre: string
}

interface EventoPersona { persona_id: number; nombre: string; cargo_nombre: string; asistio: boolean | null }

type EstadoEvento = "Agendada" | "En curso" | "Finalizada"

interface Evento {
  id: number
  titulo: string
  fecha: string
  hora_inicio: string
  hora_fin: string
  descripcion: string
  area_nombre: string
  estado: EstadoEvento
  foto_evidencia_url: string
  acta_firmada_url: string
  total_personas: number
  personas: EventoPersona[]
}

type Tab = "info" | "personas" | "asistencia" | "acta"

const ESTADO_ESTILO: Record<EstadoEvento, string> = {
  "Agendada":  "bg-teal-500/10 text-teal-400",
  "En curso":  "bg-amber-500/10 text-amber-400",
  "Finalizada": "bg-emerald-500/10 text-emerald-400",
}

function EstadoBadge({ estado }: { estado: EstadoEvento }) {
  return (
    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${ESTADO_ESTILO[estado]}`}>
      {estado}
    </span>
  )
}

export function TyCAgendaEventoPage() {
  const { id }         = useParams<{ id: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const isNew          = id === "nuevo"
  const navigate        = useNavigate()

  const tab = (searchParams.get("tab") as Tab | null) ?? "info"
  function setTab(t: Tab) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set("tab", t)
      return next
    }, { replace: true })
  }
  const [evento, setEvento] = useState<Evento | null>(null)
  const [loading, setLoading] = useState(!isNew)
  const [error, setError] = useState("")

  // ── Form de creación ────────────────────────────────────────────────────
  const fechaInicial = searchParams.get("fecha") ?? ""
  const [titulo, setTitulo] = useState("")
  const [fecha, setFecha] = useState(fechaInicial)
  const [horaInicio, setHoraInicio] = useState("08:00")
  const [horaFin, setHoraFin] = useState("09:00")
  const [descripcion, setDescripcion] = useState("")
  const [seleccionados, setSeleccionados] = useState<Set<number>>(new Set())
  const [creando, setCreando] = useState(false)

  // ── Participantes (compartido creación + edición) ────────────────────────
  const [allPersonas, setAllPersonas] = useState<PersonaMini[]>([])
  const [busqueda, setBusqueda] = useState("")
  const [empresaFiltro, setEmpresaFiltro] = useState("")
  const [areaFiltro, setAreaFiltro] = useState("")
  const [cargoFiltro, setCargoFiltro] = useState("")

  const [subiendoFoto, setSubiendoFoto] = useState(false)
  const [subiendoActa, setSubiendoActa] = useState(false)
  const [finalizando, setFinalizando] = useState(false)
  const [marcandoTodos, setMarcandoTodos] = useState(false)

  // ── Edición de info (solo mientras Agendada) ─────────────────────────────
  const [editandoInfo, setEditandoInfo] = useState(false)
  const [editTitulo, setEditTitulo] = useState("")
  const [editFecha, setEditFecha] = useState("")
  const [editHoraInicio, setEditHoraInicio] = useState("")
  const [editHoraFin, setEditHoraFin] = useState("")
  const [editDescripcion, setEditDescripcion] = useState("")
  const [guardandoInfo, setGuardandoInfo] = useState(false)

  const load = useCallback(() => {
    if (isNew) return
    setLoading(true)
    api.get(`/tc/eventos/${id}`)
      .then((r) => setEvento(r.data))
      .catch(() => setError("No se pudo cargar el evento."))
      .finally(() => setLoading(false))
  }, [id, isNew])

  useEffect(() => {
    load()
    api.get("/tc/agenda/personas-lista").then((r) => setAllPersonas(r.data)).catch(() => setAllPersonas([]))
  }, [load])

  const empresasUnicas = useMemo(() => {
    const map = new Map<number, string>()
    allPersonas.forEach((p) => { if (p.empresa_id) map.set(p.empresa_id, p.empresa_nombre) })
    return [...map.entries()].map(([pid, nombre]) => ({ id: pid, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [allPersonas])

  const areasUnicas = useMemo(() => {
    const map = new Map<number, string>()
    allPersonas.forEach((p) => { if (p.area_id) map.set(p.area_id, p.area_nombre) })
    return [...map.entries()].map(([pid, nombre]) => ({ id: pid, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [allPersonas])

  const cargosUnicos = useMemo(() => {
    const map = new Map<number, string>()
    allPersonas.forEach((p) => { if (p.cargo_id) map.set(p.cargo_id, p.cargo_nombre) })
    return [...map.entries()].map(([pid, nombre]) => ({ id: pid, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [allPersonas])

  const asignadosIds = isNew ? seleccionados : new Set(evento?.personas.map((p) => p.persona_id) ?? [])

  const filtradas = allPersonas.filter((p) =>
    p.nombre.toLowerCase().includes(busqueda.toLowerCase()) &&
    !asignadosIds.has(p.id) &&
    (!empresaFiltro || String(p.empresa_id) === empresaFiltro) &&
    (!areaFiltro || String(p.area_id) === areaFiltro) &&
    (!cargoFiltro || String(p.cargo_id) === cargoFiltro)
  )

  function toggleSeleccion(pid: number) {
    setSeleccionados((prev) => {
      const next = new Set(prev)
      if (next.has(pid)) next.delete(pid); else next.add(pid)
      return next
    })
  }

  function agregarTodosFiltradosLocal() {
    setSeleccionados((prev) => new Set([...prev, ...filtradas.map((p) => p.id)]))
  }

  async function togglePersonaExistente(pid: number, nombre: string) {
    if (!evento) return
    const yaAsignado = asignadosIds.has(pid)
    if (yaAsignado && !window.confirm(`¿Quitar a ${nombre} de esta inducción? Si ya se envió invitación de Teams, no se cancela automáticamente.`)) {
      return
    }
    const ids = yaAsignado
      ? [...asignadosIds].filter((x) => x !== pid)
      : [...asignadosIds, pid]
    await api.put(`/tc/eventos/${evento.id}/personas`, ids)
    load()
  }

  async function agregarTodosFiltradosExistente() {
    if (!evento || filtradas.length === 0) return
    const ids = [...new Set([...asignadosIds, ...filtradas.map((p) => p.id)])]
    await api.put(`/tc/eventos/${evento.id}/personas`, ids)
    load()
  }

  async function crearEvento() {
    setError("")
    if (!titulo.trim() || !fecha) { setError("Título y fecha son obligatorios."); return }
    setCreando(true)
    try {
      const { data } = await api.post("/tc/eventos", {
        titulo, fecha, hora_inicio: horaInicio, hora_fin: horaFin,
        descripcion, persona_ids: [...seleccionados],
      })
      navigate(`/tc/eventos/${data.id}`, { replace: true })
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "No se pudo crear el evento.")
    } finally { setCreando(false) }
  }

  async function setAsistencia(personaId: number, asistio: boolean) {
    if (!evento) return
    await api.patch(`/tc/eventos/${evento.id}/asistencia`, { persona_id: personaId, asistio })
    load()
  }

  async function finalizarEvento() {
    if (!evento) return
    if (!window.confirm("¿Finalizar esta capacitación? Ya no se podrá editar ni agregar participantes — solo quedará confirmar asistencia y subir evidencia.")) return
    setFinalizando(true)
    try {
      const { data } = await api.post(`/tc/eventos/${evento.id}/finalizar`)
      setEvento(data)
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "No se pudo finalizar la capacitación.")
    } finally { setFinalizando(false) }
  }

  async function marcarTodosAsistieron() {
    if (!evento) return
    setMarcandoTodos(true)
    try {
      const { data } = await api.post(`/tc/eventos/${evento.id}/asistencia/marcar-todos`)
      setEvento(data)
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "No se pudo marcar la asistencia.")
    } finally { setMarcandoTodos(false) }
  }

  function iniciarEdicionInfo() {
    if (!evento) return
    setEditTitulo(evento.titulo)
    setEditFecha(evento.fecha)
    setEditHoraInicio(evento.hora_inicio)
    setEditHoraFin(evento.hora_fin)
    setEditDescripcion(evento.descripcion)
    setEditandoInfo(true)
  }

  async function guardarInfo() {
    if (!evento) return
    setGuardandoInfo(true)
    try {
      const { data } = await api.put(`/tc/eventos/${evento.id}`, {
        titulo: editTitulo, fecha: editFecha,
        hora_inicio: editHoraInicio, hora_fin: editHoraFin,
        descripcion: editDescripcion,
      })
      setEvento(data)
      setEditandoInfo(false)
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "No se pudo guardar la información.")
    } finally { setGuardandoInfo(false) }
  }

  async function subirFotoEvidencia(file: File) {
    if (!evento) return
    setSubiendoFoto(true)
    const fd = new FormData()
    fd.append("file", file)
    try {
      const { data } = await api.post(`/tc/eventos/${evento.id}/foto-evidencia`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      setEvento(data)
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "No se pudo subir la foto.")
    } finally { setSubiendoFoto(false) }
  }

  async function subirActaFirmada(file: File) {
    if (!evento) return
    setSubiendoActa(true)
    const fd = new FormData()
    fd.append("file", file)
    try {
      const { data } = await api.post(`/tc/eventos/${evento.id}/acta-firmada`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      setEvento(data)
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "No se pudo subir el acta firmada.")
    } finally { setSubiendoActa(false) }
  }

  // ── Vista: creación ───────────────────────────────────────────────────────

  if (isNew) {
    return (
      <PageLayout title="Agenda — Nueva inducción" mainClassName="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-8 py-6 space-y-5">
          <button onClick={() => navigate("/tc/calendario")} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Agenda
          </button>
          <h1 className="text-xl font-bold">Nueva inducción</h1>

          {error && <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-lg">{error}</div>}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">Título</label>
              <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className="input-base" placeholder="Ej. Inducción corporativa — julio" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">
                Fecha {fechaInicial && <span className="text-teal-400 normal-case font-normal">(tomada del calendario)</span>}
              </label>
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="input-base" />
            </div>
            <div />
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">Hora inicio</label>
              <input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} className="input-base" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">Hora fin</label>
              <input type="time" value={horaFin} onChange={(e) => setHoraFin(e.target.value)} className="input-base" />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">Descripción (opcional)</label>
              <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={3} className="input-base" />
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground -mb-2">
            El área se asigna automáticamente según tu perfil de líder — no hace falta elegirla.
          </p>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
              Asistentes · {seleccionados.size} seleccionados
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1 max-h-72 overflow-y-auto pr-1 border border-border rounded-xl p-2">
                {[...seleccionados].map((pid) => {
                  const p = allPersonas.find((x) => x.id === pid)
                  return (
                    <div key={pid} className="flex items-center gap-2.5 p-2 rounded-lg bg-muted/5">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{p?.nombre ?? `#${pid}`}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{p?.cargo_nombre}</p>
                      </div>
                      <button onClick={() => toggleSeleccion(pid)} aria-label={`Quitar a ${p?.nombre ?? "esta persona"} de la lista`} className="text-rose-400/50 hover:text-rose-400">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )
                })}
                {seleccionados.size === 0 && <p className="text-xs text-muted-foreground py-4 text-center">Sin asistentes aún</p>}
              </div>
              <div>
                <FiltrosParticipantes
                  empresaFiltro={empresaFiltro} setEmpresaFiltro={setEmpresaFiltro} empresasUnicas={empresasUnicas}
                  areaFiltro={areaFiltro} setAreaFiltro={setAreaFiltro} areasUnicas={areasUnicas}
                  cargoFiltro={cargoFiltro} setCargoFiltro={setCargoFiltro} cargosUnicos={cargosUnicos}
                  busqueda={busqueda} setBusqueda={setBusqueda}
                  totalFiltrados={filtradas.length} onAgregarTodos={agregarTodosFiltradosLocal}
                />
                <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
                  {filtradas.slice(0, 30).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => toggleSeleccion(p.id)}
                      className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted/10 border border-transparent hover:border-border text-left transition-all"
                    >
                      <Plus className="w-3 h-3 text-teal-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{p.nombre}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{p.cargo_nombre} · {p.empresa_nombre}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={crearEvento}
            disabled={creando}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-white text-sm font-semibold transition-colors disabled:opacity-40"
          >
            {creando ? "Agendando…" : "Agendar inducción"}
          </button>
        </div>
      </PageLayout>
    )
  }

  // ── Vista: detalle ────────────────────────────────────────────────────────

  if (loading) return <PageLayout title="Agenda"><div className="flex items-center justify-center h-64 text-muted-foreground text-sm">Cargando…</div></PageLayout>
  if (!evento) return <PageLayout title="Agenda"><div className="m-4 p-3 text-sm text-destructive bg-destructive/10 rounded-md">{error || "Evento no encontrado."}</div></PageLayout>

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "info", label: "Información", icon: <FileText className="w-3.5 h-3.5" /> },
    { id: "personas", label: "Participantes", icon: <Users className="w-3.5 h-3.5" /> },
    { id: "asistencia", label: "Asistencia", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
    { id: "acta", label: "Acta", icon: <ClipboardList className="w-3.5 h-3.5" /> },
  ]

  const puedeGestionarPersonas = evento.estado !== "Finalizada"
  const puedeGestionarAsistencia = evento.estado === "Finalizada"

  return (
    <PageLayout title="Agenda — Inducción" mainClassName="flex-1 overflow-y-auto">
      <div className="border-b border-border px-8 pt-6 pb-4">
        <div className="max-w-3xl mx-auto">
          <button onClick={() => navigate("/tc/calendario")} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Volver a la agenda
          </button>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-teal-500">{evento.area_nombre}</p>
                <EstadoBadge estado={evento.estado} />
              </div>
              <h1 className="text-xl font-bold">{evento.titulo}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {new Date(evento.fecha + "T00:00:00").toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                {" · "}{evento.hora_inicio} – {evento.hora_fin}
              </p>
            </div>
            {evento.estado === "En curso" && (
              <button
                onClick={finalizarEvento}
                disabled={finalizando}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-semibold transition-colors disabled:opacity-40"
              >
                <Flag className="w-3.5 h-3.5" /> {finalizando ? "Finalizando…" : "Finalizar capacitación"}
              </button>
            )}
          </div>
          {error && <div className="mt-3 p-3 text-sm text-destructive bg-destructive/10 rounded-lg">{error}</div>}

          <div className="flex gap-1 mt-4 -mb-px">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                  tab === t.id ? "border-teal-500 text-teal-400" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.icon}{t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-8 py-6">
        {tab === "info" && (
          <div className="max-w-md space-y-4 text-sm">
            {editandoInfo ? (
              <>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">Título</label>
                  <input value={editTitulo} onChange={(e) => setEditTitulo(e.target.value)} className="input-base" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">Fecha</label>
                    <input type="date" value={editFecha} onChange={(e) => setEditFecha(e.target.value)} className="input-base" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">Hora inicio</label>
                    <input type="time" value={editHoraInicio} onChange={(e) => setEditHoraInicio(e.target.value)} className="input-base" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">Hora fin</label>
                    <input type="time" value={editHoraFin} onChange={(e) => setEditHoraFin(e.target.value)} className="input-base" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">Descripción</label>
                  <textarea value={editDescripcion} onChange={(e) => setEditDescripcion(e.target.value)} rows={3} className="input-base" />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={guardarInfo}
                    disabled={guardandoInfo}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-white text-xs font-semibold transition-colors disabled:opacity-40"
                  >
                    <Save className="w-3.5 h-3.5" /> {guardandoInfo ? "Guardando…" : "Guardar cambios"}
                  </button>
                  <button
                    onClick={() => setEditandoInfo(false)}
                    className="px-3 py-2 rounded-lg border border-border hover:bg-muted/10 text-xs font-semibold transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-muted-foreground">{evento.descripcion || "Sin descripción."}</p>
                {evento.estado === "Agendada" ? (
                  <button
                    onClick={iniciarEdicionInfo}
                    className="flex items-center gap-1.5 text-xs font-semibold text-teal-400 hover:text-teal-300 transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Editar información
                  </button>
                ) : (
                  <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Lock className="w-3 h-3" /> Ya no se puede editar — la capacitación está {evento.estado.toLowerCase()}.
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {tab === "personas" && (
          <div className={puedeGestionarPersonas ? "grid grid-cols-2 gap-6" : "max-w-md"}>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Asignados · {evento.personas.length}</p>
              <div className="space-y-1.5">
                {evento.personas.map((ep) => (
                  <div key={ep.persona_id} className="flex items-center gap-2.5 p-2 rounded-lg bg-muted/5 border border-border">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{ep.nombre}</p>
                    </div>
                    {puedeGestionarPersonas && (
                      <button
                        onClick={() => togglePersonaExistente(ep.persona_id, ep.nombre)}
                        aria-label={`Quitar a ${ep.nombre} de la inducción`}
                        className="text-rose-400/50 hover:text-rose-400"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                {evento.personas.length === 0 && <p className="text-xs text-muted-foreground py-4 text-center">Sin participantes</p>}
              </div>
              {!puedeGestionarPersonas && (
                <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-3">
                  <Lock className="w-3 h-3" /> Ya finalizada — la lista de participantes quedó cerrada.
                </p>
              )}
            </div>
            {puedeGestionarPersonas && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Agregar</p>
                <FiltrosParticipantes
                  empresaFiltro={empresaFiltro} setEmpresaFiltro={setEmpresaFiltro} empresasUnicas={empresasUnicas}
                  areaFiltro={areaFiltro} setAreaFiltro={setAreaFiltro} areasUnicas={areasUnicas}
                  cargoFiltro={cargoFiltro} setCargoFiltro={setCargoFiltro} cargosUnicos={cargosUnicos}
                  busqueda={busqueda} setBusqueda={setBusqueda}
                  totalFiltrados={filtradas.length} onAgregarTodos={agregarTodosFiltradosExistente}
                />
                <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
                  {filtradas.slice(0, 30).map((p) => (
                    <button key={p.id} onClick={() => togglePersonaExistente(p.id, p.nombre)} className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted/10 border border-transparent hover:border-border text-left transition-all">
                      <Plus className="w-3 h-3 text-teal-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{p.nombre}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{p.cargo_nombre} · {p.empresa_nombre}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "asistencia" && (
          <div className="max-w-md space-y-3">
            {!puedeGestionarAsistencia ? (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground py-4">
                <Lock className="w-3.5 h-3.5" /> Disponible cuando finalices la capacitación.
              </p>
            ) : (
              <>
                <button
                  onClick={marcarTodosAsistieron}
                  disabled={marcandoTodos || evento.personas.length === 0}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-colors disabled:opacity-40"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {marcandoTodos ? "Marcando…" : "Marcar todos como asistieron"}
                </button>
                <p className="text-[11px] text-muted-foreground">Después desmarca puntualmente a quien no asistió.</p>
              </>
            )}
            <div className="space-y-2">
              {evento.personas.map((ep) => (
                <label key={ep.persona_id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/5 cursor-pointer has-[:disabled]:cursor-not-allowed">
                  <input
                    type="checkbox"
                    checked={ep.asistio === true}
                    disabled={!puedeGestionarAsistencia}
                    onChange={(e) => setAsistencia(ep.persona_id, e.target.checked)}
                    className="w-4 h-4 accent-emerald-500 disabled:opacity-40"
                  />
                  <p className="flex-1 text-xs font-medium">{ep.nombre}</p>
                  <span className={`text-[10px] font-semibold ${ep.asistio === null ? "text-muted-foreground" : ep.asistio ? "text-emerald-400" : "text-rose-400"}`}>
                    {ep.asistio === null ? "Pendiente" : ep.asistio ? "Asistió" : "No asistió"}
                  </span>
                </label>
              ))}
              {evento.personas.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Sin participantes asignados</p>}
            </div>
          </div>
        )}

        {tab === "acta" && !puedeGestionarAsistencia && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground py-4">
            <Lock className="w-3.5 h-3.5" /> Disponible cuando finalices la capacitación.
          </p>
        )}

        {tab === "acta" && puedeGestionarAsistencia && (
          <div className="max-w-md space-y-6">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Foto de evidencia (opcional)</p>
              {evento.foto_evidencia_url ? (
                <img
                  src={evento.foto_evidencia_url}
                  alt={`Evidencia fotográfica de la inducción ${evento.titulo}`}
                  width={800}
                  height={450}
                  className="w-full h-auto rounded-xl border border-border"
                />
              ) : (
                <label className="flex flex-col items-center justify-center gap-2 h-32 rounded-xl border border-dashed border-border text-muted-foreground text-xs cursor-pointer hover:border-teal-500/40 hover:text-teal-400 transition-colors">
                  <Camera className="w-5 h-5" />
                  {subiendoFoto ? "Subiendo…" : "Subir foto"}
                  <input type="file" accept="image/*" className="hidden" disabled={subiendoFoto}
                    onChange={(e) => e.target.files?.[0] && subirFotoEvidencia(e.target.files[0])} />
                </label>
              )}
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Acta de asistencia</p>
              <p className="text-xs text-muted-foreground mb-3">
                Foto y firma son evidencia intercambiable, no hace falta las dos: si subiste foto, el acta la incrusta y ya sirve como constancia. Si no hay foto, descárgala, hazla firmar por los asistentes y vuelve a subirla.
              </p>
              <div className="flex gap-2">
                <a
                  href={`/tc/eventos/${evento.id}/acta.pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border hover:bg-muted/10 text-xs font-semibold transition-colors"
                >
                  <Download className="w-3.5 h-3.5" /> Descargar acta
                </a>
                <label className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border hover:bg-muted/10 text-xs font-semibold cursor-pointer transition-colors">
                  <Upload className="w-3.5 h-3.5" /> {subiendoActa ? "Subiendo…" : "Subir acta firmada"}
                  <input type="file" className="hidden" disabled={subiendoActa}
                    onChange={(e) => e.target.files?.[0] && subirActaFirmada(e.target.files[0])} />
                </label>
              </div>
              {evento.acta_firmada_url && (
                <a href={evento.acta_firmada_url} target="_blank" rel="noopener noreferrer" className="mt-3 flex items-center gap-1.5 text-xs text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Acta firmada ya subida — ver archivo
                </a>
              )}
              {!evento.foto_evidencia_url && !evento.acta_firmada_url && (
                <p className="mt-3 flex items-center gap-1.5 text-[11px] text-amber-400">
                  <ImageOff className="w-3.5 h-3.5" /> Aún sin evidencia (ni foto ni acta firmada).
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  )
}

interface OpcionFiltro { id: number; nombre: string }

function FiltrosParticipantes({
  empresaFiltro, setEmpresaFiltro, empresasUnicas,
  areaFiltro, setAreaFiltro, areasUnicas,
  cargoFiltro, setCargoFiltro, cargosUnicos,
  busqueda, setBusqueda,
  totalFiltrados, onAgregarTodos,
}: {
  empresaFiltro: string; setEmpresaFiltro: (v: string) => void; empresasUnicas: OpcionFiltro[]
  areaFiltro: string; setAreaFiltro: (v: string) => void; areasUnicas: OpcionFiltro[]
  cargoFiltro: string; setCargoFiltro: (v: string) => void; cargosUnicos: OpcionFiltro[]
  busqueda: string; setBusqueda: (v: string) => void
  totalFiltrados: number
  onAgregarTodos: () => void
}) {
  return (
    <div>
      <div className="flex gap-1.5 mb-2">
        <select aria-label="Filtrar por empresa" value={empresaFiltro} onChange={(e) => setEmpresaFiltro(e.target.value)} className="input-base text-xs py-1.5 flex-1">
          <option value="">Toda empresa</option>
          {empresasUnicas.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
        </select>
        <select aria-label="Filtrar por área" value={areaFiltro} onChange={(e) => setAreaFiltro(e.target.value)} className="input-base text-xs py-1.5 flex-1">
          <option value="">Toda área</option>
          {areasUnicas.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
        </select>
        <select aria-label="Filtrar por cargo" value={cargoFiltro} onChange={(e) => setCargoFiltro(e.target.value)} className="input-base text-xs py-1.5 flex-1">
          <option value="">Todo cargo</option>
          {cargosUnicos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </div>
      <input
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar por nombre…"
        aria-label="Buscar colaborador por nombre"
        className="input-base mb-2"
      />
      {(empresaFiltro || areaFiltro || cargoFiltro) && totalFiltrados > 0 && (
        <button
          onClick={onAgregarTodos}
          className="w-full mb-2 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Agregar los {totalFiltrados} seleccionados por el filtro
        </button>
      )}
    </div>
  )
}
