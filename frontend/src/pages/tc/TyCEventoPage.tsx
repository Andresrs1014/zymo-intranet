import { useEffect, useState, useCallback } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { api } from "@/lib/api"
import { useAuthStore } from "@/store/authStore"
import { canEditTyC } from "@/lib/permissions"
import { PageLayout } from "@/components/layout/PageLayout"
import {
  TC_EVENTO_TIPOS, TC_EVENTO_ESTADOS,
  type TcEventoTipo, type TcEventoEstado,
} from "@/lib/tc-constants"
import {
  ArrowLeft, Plus, Trash2, CheckCircle2,
  Users, FileText, ListOrdered, Bell, GripVertical,
  Upload, X, Link2,
} from "lucide-react"

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface OrdenDiaItem {
  id?: number
  orden: number
  titulo: string
  descripcion: string
  responsable_nombre: string
  area_id: number | null
  duracion_min: number
}

interface EventoPersona {
  persona_id: number
  asistio: boolean | null
  evaluacion_puntaje: number | null
}

interface Documento { id: number; nombre: string; url: string; tipo: string }

interface Evento {
  id: number
  titulo: string
  tipo: TcEventoTipo
  fecha: string
  hora_inicio: string
  hora_fin: string
  lugar: string
  descripcion: string
  estado: TcEventoEstado
  area_id: number | null
  area_nombre: string
  notificacion_enviada: boolean
  personas: EventoPersona[]
  orden_dia: OrdenDiaItem[]
  documentos: Documento[]
}

interface PersonaMini { id: number; nombre: string; cargo_nombre: string; empresa_nombre: string; foto_url?: string }
interface AreaMini { id: number; name: string }
interface PaqueteItem { titulo: string; horas: number | null; orden: number }
interface Paquete { id: number; nombre: string; items: PaqueteItem[] }

type Tab = "info" | "personas" | "agenda" | "documentos" | "asistencia"

const TIPO_LABEL: Record<TcEventoTipo, string> = {
  induccion: "Inducción",
  curso:     "Curso / Formación",
  reunion:   "Reunión T&C",
  otro:      "Otro",
}

// ── Componente ────────────────────────────────────────────────────────────────

export function TyCEventoPage() {
  const { id }     = useParams<{ id: string }>()
  const isNew      = id === "nuevo"
  const navigate   = useNavigate()
  const user       = useAuthStore((s) => s.user)
  const puedeEditar = user ? canEditTyC(user.role, user.app_permissions) : false

  const [tab, setTab] = useState<Tab>("info")
  const [evento, setEvento] = useState<Partial<Evento>>({
    titulo: "", tipo: "induccion", fecha: "", hora_inicio: "08:00",
    hora_fin: "09:00", lugar: "", descripcion: "", estado: "Programado",
    area_id: null, personas: [], orden_dia: [], documentos: [],
  })
  const [areas, setAreas]         = useState<AreaMini[]>([])
  const [busqueda, setBusqueda]   = useState("")
  const [allPersonas, setAllPersonas] = useState<PersonaMini[]>([])
  const [saving, setSaving]       = useState(false)
  const [sending, setSending]     = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [notifResult, setNotifResult] = useState<{ ok: boolean; mensaje: string } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [docLinks, setDocLinks]   = useState<{ nombre: string; url: string }[]>([])
  const [generando, setGenerando] = useState(false)
  const [genResult, setGenResult] = useState<{ creadas: number; ya: number } | null>(null)
  const [paquetes, setPaquetes]   = useState<Paquete[]>([])
  const [paqueteId, setPaqueteId] = useState<number | "">("")

  const load = useCallback(() => {
    if (isNew) return
    api.get(`/tc/eventos/${id}`).then((r) => {
      setEvento(r.data)
    }).catch(() => navigate("/tc/calendario"))
  }, [id, isNew, navigate])

  useEffect(() => {
    load()
    api.get("/tc/personas?limit=500").then((r) => setAllPersonas(r.data.items ?? r.data))
    api.get("/areas").then((r) => setAreas(r.data))
    api.get("/tc/paquetes").then((r) => setPaquetes(r.data))
  }, [load])

  // ── Guardar info básica ───────────────────────────────────────────────────

  async function guardar() {
    setSaving(true)
    try {
      if (isNew) {
        const r = await api.post("/tc/eventos", {
          titulo: evento.titulo, tipo: evento.tipo, fecha: evento.fecha,
          hora_inicio: evento.hora_inicio, hora_fin: evento.hora_fin,
          lugar: evento.lugar, descripcion: evento.descripcion,
          area_id: evento.area_id, persona_ids: [],
        })
        navigate(`/tc/eventos/${r.data.id}`, { replace: true })
      } else {
        await api.put(`/tc/eventos/${id}`, {
          titulo: evento.titulo, tipo: evento.tipo, fecha: evento.fecha,
          hora_inicio: evento.hora_inicio, hora_fin: evento.hora_fin,
          lugar: evento.lugar, descripcion: evento.descripcion,
          estado: evento.estado, area_id: evento.area_id,
        })
        load()
      }
    } catch { /* noop */ } finally { setSaving(false) }
  }

  // ── Personas ──────────────────────────────────────────────────────────────

  const asignadas = new Set(evento.personas?.map((p) => p.persona_id) ?? [])
  const filtradas = allPersonas.filter((p) =>
    p.nombre.toLowerCase().includes(busqueda.toLowerCase()) && !asignadas.has(p.id)
  )

  async function togglePersona(pid: number) {
    if (!evento.id) return
    const nuevos = asignadas.has(pid)
      ? [...asignadas].filter((x) => x !== pid)
      : [...asignadas, pid]
    await api.put(`/tc/eventos/${evento.id}/personas`, nuevos)
    load()
  }

  // ── Orden del día ─────────────────────────────────────────────────────────

  const [agendaLocal, setAgendaLocal] = useState<OrdenDiaItem[]>([])
  useEffect(() => { setAgendaLocal(evento.orden_dia ?? []) }, [evento.orden_dia])

  function addItem() {
    setAgendaLocal((prev) => [
      ...prev,
      { orden: prev.length + 1, titulo: "", descripcion: "", responsable_nombre: "", area_id: null, duracion_min: 30 },
    ])
  }

  async function saveAgenda() {
    if (!evento.id) return
    setSaving(true)
    try {
      await api.put(`/tc/eventos/${evento.id}/orden-dia`, agendaLocal)
      load()
    } finally { setSaving(false) }
  }

  // ── Documentos ────────────────────────────────────────────────────────────

  async function subirDoc(file: File) {
    if (!evento.id) return
    setUploading(true)
    const fd = new FormData()
    fd.append("file", file)
    try {
      await api.post(`/tc/eventos/${evento.id}/documentos`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      load()
    } finally { setUploading(false) }
  }

  async function eliminarDoc(docId: number) {
    if (!evento.id) return
    await api.delete(`/tc/eventos/${evento.id}/documentos/${docId}`)
    load()
  }

  // ── Asistencia ────────────────────────────────────────────────────────────

  async function setAsistencia(personaId: number, asistio: boolean) {
    if (!evento.id) return
    await api.patch(`/tc/eventos/${evento.id}/asistencia`, { persona_id: personaId, asistio })
    load()
  }

  async function setPuntaje(personaId: number, puntaje: number) {
    if (!evento.id) return
    await api.patch(`/tc/eventos/${evento.id}/asistencia`, { persona_id: personaId, evaluacion_puntaje: puntaje })
    load()
  }

  // ── Notificación WhatsApp ─────────────────────────────────────────────────

  async function enviarNotificacion() {
    if (!evento.id) return
    setSending(true)
    try {
      const r = await api.post(`/tc/eventos/${evento.id}/notificar`)
      setNotifResult({ ok: r.data.ok, mensaje: r.data.mensaje })
      load()
    } catch (e: any) {
      setNotifResult({ ok: false, mensaje: e?.response?.data?.detail ?? "Error al enviar" })
    } finally { setSending(false) }
  }

  // ── Aplicar paquete ──────────────────────────────────────────────────────

  function aplicarPaquete(id: number) {
    const pkg = paquetes.find((p) => p.id === id)
    if (!pkg) return
    setAgendaLocal(pkg.items.map((item, i) => ({
      orden: i + 1,
      titulo: item.titulo,
      descripcion: "",
      responsable_nombre: "",
      area_id: null,
      duracion_min: item.horas ? Math.round(item.horas * 60) : 60,
    })))
    setPaqueteId(id)
  }

  // ── Notificación Email ────────────────────────────────────────────────────

  async function enviarEmail() {
    if (!evento.id) return
    setSendingEmail(true)
    try {
      const r = await api.post(`/tc/eventos/${evento.id}/notificar-email`)
      setNotifResult({ ok: r.data.ok, mensaje: r.data.ok ? `Email enviado a ${r.data.to}` : "Error al enviar" })
    } catch (e: any) {
      setNotifResult({ ok: false, mensaje: e?.response?.data?.detail ?? "Error al enviar email" })
    } finally { setSendingEmail(false) }
  }

  // ── Generar capacitaciones ───────────────────────────────────────────────

  async function generarCapacitaciones() {
    if (!evento.id) return
    setGenerando(true)
    setGenResult(null)
    try {
      const r = await api.post(`/tc/eventos/${evento.id}/generar-capacitaciones`, {
        documentos: docLinks.filter((d) => d.url.trim()),
      })
      setGenResult({ creadas: r.data.capacitaciones_creadas, ya: r.data.personas_ya_registradas })
    } catch { /* noop */ } finally { setGenerando(false) }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const TABS: { id: Tab; label: string; icon: React.ReactNode; disabled?: boolean }[] = [
    { id: "info",       label: "Información",  icon: <FileText className="w-3.5 h-3.5" /> },
    { id: "personas",   label: "Participantes", icon: <Users className="w-3.5 h-3.5" />, disabled: isNew },
    { id: "agenda",     label: "Orden del día", icon: <ListOrdered className="w-3.5 h-3.5" />, disabled: isNew },
    { id: "documentos", label: "Documentos",    icon: <Upload className="w-3.5 h-3.5" />, disabled: isNew },
    { id: "asistencia", label: "Asistencia",    icon: <CheckCircle2 className="w-3.5 h-3.5" />, disabled: isNew },
  ]

  return (
    <PageLayout
      title={isNew ? "Nuevo evento" : (evento.titulo || "Evento")}
      mainClassName="flex-1 overflow-y-auto"
    >
      {/* ── Header ── */}
      <div className="border-b border-border px-8 pt-6 pb-4">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => navigate("/tc/calendario")}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Volver al calendario
          </button>

          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-teal-500 mb-1">
                {isNew ? "Nuevo evento" : TIPO_LABEL[evento.tipo as TcEventoTipo]}
              </p>
              <h1 className="text-xl font-bold">{isNew ? "Crear evento" : (evento.titulo || "—")}</h1>
              {!isNew && evento.fecha && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  {new Date(evento.fecha + "T00:00:00").toLocaleDateString("es-CO", {
                    weekday: "long", day: "numeric", month: "long", year: "numeric",
                  })}
                  {" · "}{evento.hora_inicio} – {evento.hora_fin}
                </p>
              )}
            </div>

            {/* Notificaciones */}
            {!isNew && puedeEditar && evento.area_id && (
              <div className="flex items-center gap-2">
                <button
                  onClick={enviarNotificacion}
                  disabled={sending}
                  title="Notificar por WhatsApp"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    evento.notificacion_enviada
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366]"
                  }`}
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.532 5.855L0 24l6.292-1.507A11.943 11.943 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.028-1.384l-.36-.214-3.735.895.942-3.638-.234-.374A9.818 9.818 0 1112 21.818z"/>
                  </svg>
                  {sending ? "..." : evento.notificacion_enviada ? "WA ✓" : "WA"}
                </button>
                <button
                  onClick={enviarEmail}
                  disabled={sendingEmail}
                  title="Notificar por email"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 transition-colors disabled:opacity-40"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M0 4a2 2 0 012-2h20a2 2 0 012 2v.535l-12 7.5L0 4.535V4zm0 2.732V20a2 2 0 002 2h20a2 2 0 002-2V6.732l-12 7.5-12-7.5z"/>
                  </svg>
                  {sendingEmail ? "..." : "Email"}
                </button>
              </div>
            )}
          </div>

          {/* Preview notificación */}
          {notifResult && (
            <div className={`mt-3 p-3 rounded-xl text-xs ${notifResult.ok ? "bg-emerald-500/10 text-emerald-300" : "bg-rose-500/10 text-rose-300"}`}>
              {notifResult.ok ? "✓ Mensaje enviado: " : "✗ Error: "}
              <span className="opacity-80">{notifResult.mensaje}</span>
              <button onClick={() => setNotifResult(null)} className="ml-2 opacity-50 hover:opacity-100">×</button>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-0 mt-4 border-b border-transparent -mb-px">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => !t.disabled && setTab(t.id)}
                disabled={t.disabled}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                  tab === t.id
                    ? "border-teal-500 text-teal-400"
                    : t.disabled
                    ? "border-transparent text-muted-foreground/30 cursor-not-allowed"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.icon}{t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Contenido del tab ── */}
      <div className="max-w-4xl mx-auto px-8 py-6">

        {/* INFO ── */}
        {tab === "info" && (
          <div className="space-y-4 max-w-2xl">
            <Field label="Título del evento">
              <input
                value={evento.titulo ?? ""}
                onChange={(e) => setEvento((p) => ({ ...p, titulo: e.target.value }))}
                placeholder="Ej. Inducción personal nuevo — Logística"
                className="input-base"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Tipo">
                <select
                  value={evento.tipo ?? "induccion"}
                  onChange={(e) => setEvento((p) => ({ ...p, tipo: e.target.value as TcEventoTipo }))}
                  className="input-base"
                >
                  {TC_EVENTO_TIPOS.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </Field>
              {!isNew && (
                <Field label="Estado">
                  <select
                    value={evento.estado ?? "Programado"}
                    onChange={(e) => setEvento((p) => ({ ...p, estado: e.target.value as TcEventoEstado }))}
                    className="input-base"
                  >
                    {TC_EVENTO_ESTADOS.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </Field>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Field label="Fecha">
                <input
                  type="date"
                  value={evento.fecha ?? ""}
                  onChange={(e) => setEvento((p) => ({ ...p, fecha: e.target.value }))}
                  className="input-base"
                />
              </Field>
              <Field label="Hora inicio">
                <input
                  type="time"
                  value={evento.hora_inicio ?? "08:00"}
                  onChange={(e) => setEvento((p) => ({ ...p, hora_inicio: e.target.value }))}
                  className="input-base"
                />
              </Field>
              <Field label="Hora fin">
                <input
                  type="time"
                  value={evento.hora_fin ?? "09:00"}
                  onChange={(e) => setEvento((p) => ({ ...p, hora_fin: e.target.value }))}
                  className="input-base"
                />
              </Field>
            </div>

            <Field label="Lugar / Sala">
              <input
                value={evento.lugar ?? ""}
                onChange={(e) => setEvento((p) => ({ ...p, lugar: e.target.value }))}
                placeholder="Ej. Sala de juntas piso 2, ZYMOLOGI Bogotá"
                className="input-base"
              />
            </Field>

            <Field label="Área responsable (para notificación WA)">
              <select
                value={evento.area_id ?? ""}
                onChange={(e) => setEvento((p) => ({ ...p, area_id: e.target.value ? parseInt(e.target.value) : null }))}
                className="input-base"
              >
                <option value="">— Sin área asignada —</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </Field>

            <Field label="Descripción / Objetivo">
              <textarea
                rows={3}
                value={evento.descripcion ?? ""}
                onChange={(e) => setEvento((p) => ({ ...p, descripcion: e.target.value }))}
                placeholder="Describe el propósito de este evento..."
                className="input-base resize-none"
              />
            </Field>

            {/* Paquete de capacitaciones — solo para curso/inducción */}
            {(evento.tipo === "induccion" || evento.tipo === "curso") && paquetes.length > 0 && (
              <Field label="Paquete de capacitaciones (pre-llena agenda)">
                <select
                  value={paqueteId}
                  onChange={(e) => e.target.value ? aplicarPaquete(parseInt(e.target.value)) : setPaqueteId("")}
                  className="input-base"
                >
                  <option value="">— Sin paquete —</option>
                  {paquetes.map((p) => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))}
                </select>
                {paqueteId !== "" && (
                  <p className="text-[10px] text-teal-500 mt-1">
                    ✓ Agenda pre-cargada con {paquetes.find((p) => p.id === paqueteId)?.items.length ?? 0} ítems — guarda para aplicar
                  </p>
                )}
              </Field>
            )}

            {puedeEditar && (
              <button
                onClick={guardar}
                disabled={saving || !evento.titulo || !evento.fecha}
                className="px-4 py-2 rounded-lg bg-teal-500/15 hover:bg-teal-500/25 text-teal-400 text-sm font-semibold transition-colors disabled:opacity-40"
              >
                {saving ? "Guardando..." : isNew ? "Crear evento" : "Guardar cambios"}
              </button>
            )}
          </div>
        )}

        {/* PERSONAS ── */}
        {tab === "personas" && !isNew && (
          <div className="grid grid-cols-2 gap-6">
            {/* Asignadas */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
                Asignados · {asignadas.size}
              </p>
              <div className="space-y-1.5">
                {evento.personas?.map((ep) => {
                  const p = allPersonas.find((x) => x.id === ep.persona_id)
                  return (
                    <div key={ep.persona_id} className="flex items-center gap-2.5 p-2 rounded-lg bg-muted/5 border border-border">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{p?.nombre ?? `Persona #${ep.persona_id}`}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{p?.cargo_nombre}</p>
                      </div>
                      {puedeEditar && (
                        <button
                          onClick={() => togglePersona(ep.persona_id)}
                          className="text-rose-400/50 hover:text-rose-400 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )
                })}
                {asignadas.size === 0 && (
                  <p className="text-xs text-muted-foreground py-4 text-center">Sin participantes asignados</p>
                )}
              </div>
            </div>

            {/* Agregar */}
            {puedeEditar && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
                  Agregar colaboradores
                </p>
                <input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar por nombre..."
                  className="input-base mb-2"
                />
                <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
                  {filtradas.slice(0, 20).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => togglePersona(p.id)}
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
            )}
          </div>
        )}

        {/* AGENDA ── */}
        {tab === "agenda" && !isNew && (
          <div className="space-y-3 max-w-2xl">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground">{agendaLocal.length} ítem{agendaLocal.length !== 1 ? "s" : ""} en el orden del día</p>
              {puedeEditar && (
                <div className="flex gap-2">
                  <button onClick={addItem} className="flex items-center gap-1 text-xs text-teal-400 hover:text-teal-300 transition-colors">
                    <Plus className="w-3.5 h-3.5" /> Agregar ítem
                  </button>
                  <button onClick={saveAgenda} disabled={saving} className="flex items-center gap-1 text-xs text-teal-400 hover:text-teal-300 transition-colors">
                    {saving ? "Guardando..." : "Guardar agenda"}
                  </button>
                </div>
              )}
            </div>

            {agendaLocal.map((item, idx) => (
              <div key={idx} className="flex gap-2 p-3 rounded-xl border border-border bg-muted/5">
                <div className="flex flex-col items-center gap-1 pt-0.5">
                  <GripVertical className="w-3.5 h-3.5 text-muted-foreground/30" />
                  <span className="text-[10px] font-bold tabular-nums text-muted-foreground">{idx + 1}</span>
                </div>
                <div className="flex-1 space-y-2">
                  <input
                    value={item.titulo}
                    onChange={(e) => {
                      const n = [...agendaLocal]; n[idx] = { ...n[idx], titulo: e.target.value }; setAgendaLocal(n)
                    }}
                    placeholder="Título del ítem (ej. Bienvenida, Recorrido planta)"
                    className="input-base text-sm"
                    readOnly={!puedeEditar}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={item.responsable_nombre}
                      onChange={(e) => {
                        const n = [...agendaLocal]; n[idx] = { ...n[idx], responsable_nombre: e.target.value }; setAgendaLocal(n)
                      }}
                      placeholder="Responsable"
                      className="input-base text-xs"
                      readOnly={!puedeEditar}
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={item.duracion_min}
                        onChange={(e) => {
                          const n = [...agendaLocal]; n[idx] = { ...n[idx], duracion_min: parseInt(e.target.value) || 30 }; setAgendaLocal(n)
                        }}
                        className="input-base text-xs w-20"
                        readOnly={!puedeEditar}
                      />
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">min</span>
                    </div>
                  </div>
                </div>
                {puedeEditar && (
                  <button
                    onClick={() => setAgendaLocal((prev) => prev.filter((_, i) => i !== idx))}
                    className="text-rose-400/40 hover:text-rose-400 transition-colors self-start"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}

            {agendaLocal.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-xs">
                <ListOrdered className="w-8 h-8 mx-auto mb-2 opacity-20" />
                Sin ítems en el orden del día
              </div>
            )}
          </div>
        )}

        {/* DOCUMENTOS ── */}
        {tab === "documentos" && !isNew && (
          <div className="max-w-2xl space-y-3">
            {puedeEditar && (
              <label className={`flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-border hover:border-teal-500/30 hover:bg-teal-500/5 cursor-pointer transition-all ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
                <Upload className="w-4 h-4 text-teal-400" />
                <span className="text-sm text-muted-foreground">
                  {uploading ? "Subiendo..." : "Clic o arrastra para subir documento"}
                </span>
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xlsx,.xls,.jpg,.jpeg,.png"
                  onChange={(e) => { if (e.target.files?.[0]) subirDoc(e.target.files[0]) }}
                />
              </label>
            )}

            {evento.documentos?.map((doc) => (
              <div key={doc.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/5">
                <FileText className="w-4 h-4 text-teal-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{doc.nombre}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">{doc.tipo}</p>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-teal-400 hover:underline"
                  >
                    Ver
                  </a>
                  {puedeEditar && (
                    <button onClick={() => eliminarDoc(doc.id)} className="text-rose-400/40 hover:text-rose-400 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}

            {(evento.documentos?.length ?? 0) === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">Sin documentos adjuntos</p>
            )}
          </div>
        )}

        {/* ASISTENCIA ── */}
        {tab === "asistencia" && !isNew && (
          <div className="max-w-2xl space-y-2">
            <p className="text-xs text-muted-foreground mb-3">
              Registra la asistencia y la evaluación post-evento de cada participante.
            </p>
            {evento.personas?.map((ep) => {
              const p = allPersonas.find((x) => x.id === ep.persona_id)
              return (
                <div key={ep.persona_id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/5">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium">{p?.nombre ?? `#${ep.persona_id}`}</p>
                    <p className="text-[10px] text-muted-foreground">{p?.cargo_nombre}</p>
                  </div>
                  {puedeEditar ? (
                    <>
                      <select
                        value={ep.asistio === null ? "" : ep.asistio ? "1" : "0"}
                        onChange={(e) => setAsistencia(ep.persona_id, e.target.value === "1")}
                        className="text-xs rounded-lg border border-border bg-transparent px-2 py-1"
                      >
                        <option value="">— Asistencia —</option>
                        <option value="1">✓ Asistió</option>
                        <option value="0">✗ No asistió</option>
                      </select>
                      <input
                        type="number"
                        min={0} max={5} step={0.1}
                        value={ep.evaluacion_puntaje ?? ""}
                        onChange={(e) => setPuntaje(ep.persona_id, parseFloat(e.target.value))}
                        placeholder="Nota 0-5"
                        className="w-20 text-xs rounded-lg border border-border bg-transparent px-2 py-1 text-center"
                      />
                    </>
                  ) : (
                    <>
                      <span className={`text-xs ${ep.asistio === null ? "text-muted-foreground" : ep.asistio ? "text-emerald-400" : "text-rose-400"}`}>
                        {ep.asistio === null ? "Pendiente" : ep.asistio ? "Asistió" : "No asistió"}
                      </span>
                      {ep.evaluacion_puntaje !== null && (
                        <span className="text-xs text-teal-400">{ep.evaluacion_puntaje}/5</span>
                      )}
                    </>
                  )}
                </div>
              )
            })}
            {(evento.personas?.length ?? 0) === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">Sin participantes asignados</p>
            )}

            {/* Generar capacitaciones — solo para curso/inducción */}
            {(evento.tipo === "induccion" || evento.tipo === "curso") && puedeEditar && (
              <div className="mt-6 pt-5 border-t border-border space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Generar registros de capacitación
                </p>
                <p className="text-xs text-muted-foreground">
                  Crea un registro en el historial de formación de cada asistente. Puedes adjuntar links (materiales, acta, diploma).
                </p>

                {/* Lista de links de documentos */}
                <div className="space-y-2">
                  {docLinks.map((d, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input
                        value={d.nombre}
                        onChange={(e) => setDocLinks((prev) => prev.map((x, j) => j === i ? { ...x, nombre: e.target.value } : x))}
                        placeholder="Nombre del documento"
                        className="input-base text-xs flex-[1]"
                      />
                      <input
                        value={d.url}
                        onChange={(e) => setDocLinks((prev) => prev.map((x, j) => j === i ? { ...x, url: e.target.value } : x))}
                        placeholder="https://..."
                        className="input-base text-xs flex-[2]"
                      />
                      <button
                        onClick={() => setDocLinks((prev) => prev.filter((_, j) => j !== i))}
                        className="text-rose-400/40 hover:text-rose-400 transition-colors shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => setDocLinks((prev) => [...prev, { nombre: "", url: "" }])}
                    className="flex items-center gap-1 text-xs text-teal-400 hover:text-teal-300 transition-colors"
                  >
                    <Link2 className="w-3.5 h-3.5" /> Agregar link
                  </button>
                </div>

                {genResult && (
                  <p className="text-xs text-emerald-400">
                    ✓ {genResult.creadas} registro{genResult.creadas !== 1 ? "s" : ""} creado{genResult.creadas !== 1 ? "s" : ""}
                    {genResult.ya > 0 ? ` · ${genResult.ya} ya existían` : ""}
                  </p>
                )}

                <button
                  onClick={generarCapacitaciones}
                  disabled={generando || (evento.personas?.length ?? 0) === 0}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-500/15 hover:bg-teal-500/25 text-teal-400 text-xs font-semibold transition-colors disabled:opacity-40"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {generando ? "Generando..." : "Generar capacitaciones"}
                </button>
              </div>
            )}
          </div>
        )}

      </div>
    </PageLayout>
  )
}

// ── Field helper ──────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{label}</label>
      {children}
    </div>
  )
}
