import { useEffect, useState, useCallback, useMemo } from "react"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"
import { api } from "@/lib/api"
import { PageLayout } from "@/components/layout/PageLayout"
import {
  ArrowLeft, Plus, X, Users, FileText, CheckCircle2, ClipboardList,
  Video, Camera, Download, Upload, ImageOff,
} from "lucide-react"

interface PersonaMini {
  id: number; nombre: string
  cargo_id: number | null; cargo_nombre: string
  area_id: number | null; area_nombre: string
  empresa_id: number | null; empresa_nombre: string
}

interface EventoPersona { persona_id: number; nombre: string; cargo_nombre: string; asistio: boolean | null }

interface Evento {
  id: number
  titulo: string
  fecha: string
  hora_inicio: string
  hora_fin: string
  descripcion: string
  area_nombre: string
  teams_join_url: string
  foto_evidencia_url: string
  acta_firmada_url: string
  total_personas: number
  personas: EventoPersona[]
}

type Tab = "info" | "personas" | "asistencia" | "acta"

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

  const [creandoTeams, setCreandoTeams] = useState(false)
  const [subiendoFoto, setSubiendoFoto] = useState(false)
  const [subiendoActa, setSubiendoActa] = useState(false)

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

  async function crearReunionTeams() {
    if (!evento) return
    setCreandoTeams(true)
    try {
      const { data } = await api.post(`/tc/eventos/${evento.id}/teams-meeting`)
      setEvento(data)
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "No se pudo crear la reunión de Teams.")
    } finally { setCreandoTeams(false) }
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

  function FiltrosParticipantes({ onAgregarTodos }: { onAgregarTodos: () => void }) {
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
        {(empresaFiltro || areaFiltro || cargoFiltro) && filtradas.length > 0 && (
          <button
            onClick={onAgregarTodos}
            className="w-full mb-2 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Agregar los {filtradas.length} seleccionados por el filtro
          </button>
        )}
      </div>
    )
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
                <FiltrosParticipantes onAgregarTodos={agregarTodosFiltradosLocal} />
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

  return (
    <PageLayout title="Agenda — Inducción" mainClassName="flex-1 overflow-y-auto">
      <div className="border-b border-border px-8 pt-6 pb-4">
        <div className="max-w-3xl mx-auto">
          <button onClick={() => navigate("/tc/calendario")} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Volver a la agenda
          </button>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-teal-500 mb-1">{evento.area_nombre}</p>
              <h1 className="text-xl font-bold">{evento.titulo}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {new Date(evento.fecha + "T00:00:00").toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                {" · "}{evento.hora_inicio} – {evento.hora_fin}
              </p>
            </div>
            {evento.teams_join_url ? (
              <a
                href={evento.teams_join_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#6264A7]/10 hover:bg-[#6264A7]/20 text-[#8385D6] text-xs font-semibold transition-colors"
              >
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#8385D6] opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#8385D6]" />
                </span>
                <Video className="w-3.5 h-3.5" /> Unirse en Teams
              </a>
            ) : (
              <button
                onClick={crearReunionTeams}
                disabled={creandoTeams}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#6264A7]/10 hover:bg-[#6264A7]/20 text-[#8385D6] text-xs font-semibold transition-colors disabled:opacity-40"
              >
                <Video className="w-3.5 h-3.5" /> {creandoTeams ? "Creando…" : "Crear reunión Teams"}
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
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">{evento.descripcion || "Sin descripción."}</p>
          </div>
        )}

        {tab === "personas" && (
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Asignados · {evento.personas.length}</p>
              <div className="space-y-1.5">
                {evento.personas.map((ep) => (
                  <div key={ep.persona_id} className="flex items-center gap-2.5 p-2 rounded-lg bg-muted/5 border border-border">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{ep.nombre}</p>
                    </div>
                    <button
                      onClick={() => togglePersonaExistente(ep.persona_id, ep.nombre)}
                      aria-label={`Quitar a ${ep.nombre} de la inducción`}
                      className="text-rose-400/50 hover:text-rose-400"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                {evento.personas.length === 0 && <p className="text-xs text-muted-foreground py-4 text-center">Sin participantes</p>}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Agregar</p>
              <FiltrosParticipantes onAgregarTodos={agregarTodosFiltradosExistente} />
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
          </div>
        )}

        {tab === "asistencia" && (
          <div className="max-w-md space-y-2">
            {evento.personas.map((ep) => (
              <div key={ep.persona_id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/5">
                <p className="flex-1 text-xs font-medium">{ep.nombre}</p>
                <select
                  aria-label={`Asistencia de ${ep.nombre}`}
                  value={ep.asistio === null ? "" : ep.asistio ? "1" : "0"}
                  onChange={(e) => setAsistencia(ep.persona_id, e.target.value === "1")}
                  className="text-xs rounded-lg border border-border bg-transparent px-2 py-1"
                >
                  <option value="">— Asistencia —</option>
                  <option value="1">✓ Asistió</option>
                  <option value="0">✗ No asistió</option>
                </select>
              </div>
            ))}
            {evento.personas.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Sin participantes asignados</p>}
          </div>
        )}

        {tab === "acta" && (
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
