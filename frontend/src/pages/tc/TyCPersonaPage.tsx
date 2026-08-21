import { useEffect, useState, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { api } from "@/lib/api"
import { useAuthStore } from "@/store/authStore"
import { canEditTyC, canSeeTyCSensible } from "@/lib/permissions"
import { PageLayout } from "@/components/layout/PageLayout"
import {
  ArrowLeft, Camera, Pencil, X, Check, Plus, Trash2, Loader2,
  BookOpen, ClipboardList, ShieldAlert, FileText, Award, Link2,
} from "lucide-react"
import {
  TC_ESTADOS, TC_GENEROS, TC_CONTRATOS, TC_SALIDAS,
  TC_CAP_ESTADOS, TC_SANCION_TIPOS, TC_NOVEDAD_TIPOS, TC_NOVEDAD_ESTADOS,
} from "@/lib/tc-constants"
import { FirmaDigitalPanel } from "./components/FirmaDigitalPanel"

// ── Interfaces ────────────────────────────────────────────────────────────────

interface Empresa { id: number; nombre: string; codigo: string }
interface Area    { id: number; name: string }
interface Cargo   { id: number; area_id: number | null; nombre: string; sede_ids: number[] }

interface Persona {
  id: number
  nombre: string
  initials: string
  documento: string
  empresa_id: number
  empresa_nombre: string
  empresa_codigo: string
  area_id: number | null
  area_nombre: string
  cargo_id: number | null
  cargo_nombre: string
  jefe_directo_id: number | null
  jefe_directo_nombre: string
  genero: string
  rh: string
  tarjeta: string
  tarjeta_fecha_asignacion: string | null
  email: string
  email_corporativo: string
  telefono: string
  telefono_corporativo: string
  foto_url: string
  firma_url: string
  tipo_contrato: string
  fecha_ingreso: string | null
  antiguedad_label: string
  estado: string
  tipo_salida: string
  fecha_salida: string | null
  idp_active: boolean
  idp_eligible: boolean
  score: number
  user_id: number | null
  user_nombre: string
  fecha_nacimiento?: string | null
  edad?: number | null
  /** true si además de mod_tc_sensible, el usuario actual es el jefe (directo o
   * en la cadena hacia arriba) de esta persona — ver _puede_ver_sensible en personal.py. */
  puede_ver_sensible?: boolean
}

interface Novedad {
  id: number; tipo: string; descripcion: string
  fecha_inicio: string | null; fecha_fin: string | null; estado: string; origen: string
}

interface Capacitacion {
  id: number; titulo: string; fecha: string | null; horas: number | null
  estado: string; diploma_url: string; observaciones: string
  documentos?: { nombre: string; url: string }[]
}
interface Evaluacion {
  id: number; titulo: string; puntaje: number | null
  cumple_meta: boolean; fecha: string | null; observaciones: string; origen: string
}
interface Sancion {
  id: number; tipo: string; descripcion: string; fecha: string | null; origen: string
}

type Tab = "info" | "capacitaciones" | "evaluaciones" | "sanciones" | "novedades"

// ── Componente principal ──────────────────────────────────────────────────────

export function TyCPersonaPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const puedeEditar   = user ? canEditTyC(user.role, user.app_permissions) : false
  const puedeSensible = user ? canSeeTyCSensible(user.role, user.app_permissions) : false
  const esAdmin        = user?.role === "admin"

  const [tab, setTab] = useState<Tab>("info")
  const [persona, setPersona] = useState<Persona | null>(null)
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [areas, setAreas]       = useState<Area[]>([])
  const [cargos, setCargos]     = useState<Cargo[]>([])
  const [personasLista, setPersonasLista] = useState<{ id: number; nombre: string }[]>([])
  const [usuariosIntranet, setUsuariosIntranet] = useState<{ id: number; full_name: string | null; email: string }[]>([])
  const [loading, setLoading]   = useState(true)
  const [editando, setEditando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError]       = useState("")
  const [form, setForm]         = useState<Partial<Persona>>({})

  useEffect(() => {
    Promise.all([api.get(`/tc/personas/${id}`), api.get("/tc/empresas")])
      .then(([pRes, eRes]) => {
        setPersona(pRes.data)
        setEmpresas(eRes.data)
      })
      .catch(() => setError("No se pudo cargar la información del colaborador."))
      .finally(() => setLoading(false))
    api.get("/areas").then((r) => setAreas(Array.isArray(r.data) ? r.data : []))
    // Cargos son globales — un mismo cargo puede existir en varias sedes
    // (transversal). No se filtran por empresa: la empresa (nómina) se
    // restringe según las sedes del cargo elegido, no al revés.
    api.get("/tc/cargos").then((r) => setCargos(Array.isArray(r.data) ? r.data : []))
    api.get("/tc/personas", { params: { estado: "Activo", limit: 500 } })
      .then((r) => setPersonasLista(Array.isArray(r.data?.items) ? r.data.items : []))
      .catch(() => {})
    api.get("/api/tasks-v2/users")
      .then((r) => setUsuariosIntranet(Array.isArray(r.data) ? r.data : []))
      .catch(() => {})
  }, [id])

  function iniciarEdicion() {
    if (!persona) return
    setForm({ ...persona })
    setEditando(true)
    setError("")
  }

  function cancelarEdicion() { setEditando(false); setForm({}); setError("") }

  async function eliminarPersona() {
    if (!persona) return
    if (!window.confirm(
      `¿Eliminar definitivamente a ${persona.nombre}? Se borra su registro y su historial ` +
      `(capacitaciones, evaluaciones, sanciones, novedades). Esta acción no se puede deshacer.`
    )) return
    setError("")
    try {
      await api.delete(`/tc/personas/${persona.id}`)
      navigate("/tc/directorio")
    } catch {
      setError("No se pudo eliminar el colaborador.")
    }
  }

  async function guardar() {
    if (!persona) return
    setGuardando(true); setError("")
    try {
      const { data } = await api.put(`/tc/personas/${persona.id}`, form)
      setPersona(data); setEditando(false); setForm({})
    } catch { setError("No se pudo guardar los cambios.") }
    finally { setGuardando(false) }
  }

  async function handleFotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !persona) return
    const fd = new FormData()
    fd.append("file", file)
    setError("")
    try {
      const { data } = await api.post(`/tc/personas/${persona.id}/foto`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      setPersona(data)
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(detail || "No se pudo subir la foto.")
    }
    e.target.value = ""
  }

  function setField(key: keyof Persona, value: string | number | boolean | null) {
    setForm((prev) => {
      const next = { ...prev, [key]: value }
      // Si el cargo elegido no existe en la sede (nómina) actual, saltar a la
      // primera sede válida de ese cargo — un cargo transversal puede existir
      // en varias sedes, la nómina no puede quedar en una donde el cargo no está.
      if (key === "cargo_id") {
        const cargo = cargos.find((c) => c.id === value)
        const empresaActual = next.empresa_id ?? persona?.empresa_id
        if (cargo && cargo.sede_ids.length > 0 && !cargo.sede_ids.includes(empresaActual as number)) {
          next.empresa_id = cargo.sede_ids[0]
        }
      }
      return next
    })
  }

  if (loading) return (
    <PageLayout title="T&C — Colaborador">
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">Cargando…</div>
    </PageLayout>
  )

  if (!persona) return (
    <PageLayout title="T&C — Colaborador">
      <div className="m-4 p-3 text-sm text-destructive bg-destructive/10 rounded-md">
        {error || "Colaborador no encontrado."}
      </div>
    </PageLayout>
  )

  const datos = editando ? { ...persona, ...form } : persona
  // Además de mod_tc_sensible (T&C/admin, puede gestionar todo), el jefe en la
  // cadena de esta persona puede ver y agregar — no editar/borrar (ver
  // _puede_ver_sensible en personal.py, feedback del usuario 2026-07-29).
  const puedeVerSensible = puedeSensible || !!datos.puede_ver_sensible

  const TABS: { key: Tab; label: string; icon?: React.ReactNode; sensible?: boolean }[] = [
    { key: "info", label: "Información" },
    { key: "capacitaciones", label: "Capacitaciones", icon: <BookOpen className="w-3.5 h-3.5" /> },
    ...(puedeVerSensible ? [
      { key: "evaluaciones" as Tab, label: "Evaluaciones", icon: <ClipboardList className="w-3.5 h-3.5" />, sensible: true },
      { key: "sanciones"   as Tab, label: "Sanciones",    icon: <ShieldAlert className="w-3.5 h-3.5" />, sensible: true },
      { key: "novedades"   as Tab, label: "Novedades",    icon: <FileText className="w-3.5 h-3.5" />, sensible: true },
    ] : []),
  ]

  return (
    <PageLayout title="T&C — Talento y Cultura">
      <div className="max-w-5xl mx-auto px-8 pt-6 pb-10 space-y-5">

        {/* Breadcrumb */}
        <button
          onClick={() => navigate("/tc/directorio")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Directorio
        </button>

        {/* Hero */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative group/avatar shrink-0 h-14 w-14">
              <div className="w-full h-full rounded-full bg-teal-500/10 text-teal-500 text-xl font-semibold overflow-hidden flex items-center justify-center">
                {persona.foto_url
                  ? <img src={persona.foto_url} alt={persona.nombre} className="w-full h-full object-cover" />
                  : (persona.initials || persona.nombre.slice(0, 2).toUpperCase())
                }
              </div>
              {puedeEditar && (
                <label className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity cursor-pointer">
                  <Camera className="w-4 h-4 text-white" />
                  <input type="file" accept="image/*" className="hidden" onChange={handleFotoUpload} />
                </label>
              )}
            </div>
            <div>
              <h2 className="text-xl font-semibold leading-tight">{persona.nombre}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {persona.cargo_nombre || "Sin cargo"} · {persona.empresa_codigo}
              </p>
              <span className={`inline-flex mt-1 items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                persona.estado === TC_ESTADOS[0]
                  ? "bg-emerald-500/10 text-emerald-500"
                  : "bg-muted text-muted-foreground"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${persona.estado === TC_ESTADOS[0] ? "bg-emerald-500" : "bg-muted-foreground"}`} />
                {persona.estado}
              </span>
              {persona.score > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="w-24 h-1.5 bg-muted/40 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        persona.score >= 75 ? "bg-emerald-500" : persona.score >= 55 ? "bg-amber-500" : "bg-rose-500"
                      }`}
                      style={{ width: `${persona.score}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-muted-foreground tabular-nums">{persona.score}/100</span>
                </div>
              )}
            </div>
          </div>

          {tab === "info" && (
            <div className="flex items-center gap-2">
              {puedeEditar && !editando && (
                <button onClick={iniciarEdicion}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-input rounded-md hover:bg-accent transition-colors">
                  <Pencil className="w-3.5 h-3.5" /> Editar
                </button>
              )}
              {esAdmin && !editando && (
                <button onClick={eliminarPersona}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-destructive/40 text-destructive rounded-md hover:bg-destructive/10 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" /> Eliminar
                </button>
              )}
              {editando && (
                <>
                  <button onClick={cancelarEdicion}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-input rounded-md hover:bg-accent transition-colors">
                    <X className="w-3.5 h-3.5" /> Cancelar
                  </button>
                  <button onClick={guardar} disabled={guardando}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50">
                    <Check className="w-3.5 h-3.5" />
                    {guardando ? "Guardando…" : "Guardar"}
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {error && <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">{error}</div>}

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); if (editando) cancelarEdicion() }}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
                tab === t.key
                  ? "border-teal-500 text-teal-500"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Contenido por tab */}
        {tab === "info" && (
          <div className="space-y-6">
            <Section title="Organización">
              <FieldRow label="Cargo">
                {editando ? (
                  <Select value={String(datos.cargo_id ?? "")} onChange={(v) => setField("cargo_id", v ? Number(v) : null)}>
                    <option value="">Sin cargo</option>
                    {cargos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </Select>
                ) : (datos.cargo_nombre || "—")}
              </FieldRow>
              <FieldRow label="Empresa (nómina)">
                {editando ? (
                  (() => {
                    const cargoActual = cargos.find((c) => c.id === datos.cargo_id)
                    const esTransversal = (cargoActual?.sede_ids.length ?? 0) > 1
                    const opciones = cargoActual && cargoActual.sede_ids.length > 0
                      ? empresas.filter((e) => cargoActual.sede_ids.includes(e.id))
                      : empresas
                    return (
                      <div>
                        <Select value={String(datos.empresa_id)} onChange={(v) => setField("empresa_id", Number(v))}>
                          {opciones.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                        </Select>
                        {esTransversal && (
                          <p className="text-[11px] text-muted-foreground mt-1">
                            Cargo transversal — elige en cuál de las {opciones.length} empresas está en nómina.
                          </p>
                        )}
                      </div>
                    )
                  })()
                ) : (
                  (() => {
                    const cargoActual = cargos.find((c) => c.id === datos.cargo_id)
                    const otrasEmpresas = cargoActual
                      ? empresas.filter((e) => cargoActual.sede_ids.includes(e.id) && e.id !== datos.empresa_id)
                      : []
                    return (
                      <div>
                        <span>{datos.empresa_nombre}</span>
                        {otrasEmpresas.length > 0 && (
                          <p className="text-[11px] text-muted-foreground mt-1">
                            Cargo transversal — también puede estar en: {otrasEmpresas.map((e) => e.nombre).join(", ")}.
                          </p>
                        )}
                      </div>
                    )
                  })()
                )}
              </FieldRow>
              <FieldRow label="Área">
                {editando ? (
                  <Select value={String(datos.area_id ?? "")} onChange={(v) => setField("area_id", v ? Number(v) : null)}>
                    <option value="">Sin área</option>
                    {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </Select>
                ) : (datos.area_nombre || "—")}
              </FieldRow>
              <FieldRow label="Jefe directo">
                {editando ? (
                  <Select
                    value={String(datos.jefe_directo_id ?? "")}
                    onChange={(v) => setField("jefe_directo_id", v ? Number(v) : null)}
                  >
                    <option value="">Sin jefe directo</option>
                    {personasLista.filter((p) => p.id !== persona?.id).map((p) => (
                      <option key={p.id} value={p.id}>{p.nombre}</option>
                    ))}
                  </Select>
                ) : (datos.jefe_directo_nombre || "—")}
              </FieldRow>
              <FieldRow label="Usuario vinculado">
                {editando ? (
                  <Select
                    value={String(datos.user_id ?? "")}
                    onChange={(v) => setField("user_id", v ? Number(v) : null)}
                  >
                    <option value="">Sin cuenta vinculada</option>
                    {usuariosIntranet.map((u) => (
                      <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                    ))}
                  </Select>
                ) : (datos.user_nombre || "—")}
              </FieldRow>
            </Section>

            <Section title="Datos personales">
              <FieldRow label="Documento">
                {editando ? <TextInput value={datos.documento} onChange={(v) => setField("documento", v)} /> : (datos.documento || "—")}
              </FieldRow>
              <FieldRow label="Género">
                {editando ? (
                  <Select value={datos.genero} onChange={(v) => setField("genero", v)}>
                    <option value="">Sin especificar</option>
                    {TC_GENEROS.map((g) => <option key={g} value={g}>{g}</option>)}
                  </Select>
                ) : (datos.genero || "—")}
              </FieldRow>
              <FieldRow label="RH">
                {editando ? <TextInput value={datos.rh} onChange={(v) => setField("rh", v)} placeholder="O+" /> : (datos.rh || "—")}
              </FieldRow>
              <FieldRow label="Tarjeta (carné de acceso)">
                {editando ? (
                  <TextInput value={datos.tarjeta} onChange={(v) => setField("tarjeta", v)} placeholder="Ej. 0007480710 114, 09606" />
                ) : (datos.tarjeta || "—")}
              </FieldRow>
              <FieldRow label="Fecha de asignación de tarjeta">
                {editando ? (
                  <TextInput value={datos.tarjeta_fecha_asignacion ?? ""} onChange={(v) => setField("tarjeta_fecha_asignacion", v || null)} type="date" />
                ) : (datos.tarjeta_fecha_asignacion || "—")}
              </FieldRow>
              <FieldRow label="Fecha de nacimiento">
                {editando ? (
                  <TextInput value={datos.fecha_nacimiento ?? ""} onChange={(v) => setField("fecha_nacimiento", v || null)} type="date" />
                ) : (datos.fecha_nacimiento || "—")}
              </FieldRow>
              <FieldRow label="Edad">
                {editando ? (
                  <TextInput value={datos.edad != null ? String(datos.edad) : ""} onChange={(v) => setField("edad", v ? parseInt(v) : null)} type="number" placeholder="0" />
                ) : (datos.edad != null ? `${datos.edad} años` : "—")}
              </FieldRow>
              <FieldRow label="Correo personal">
                {editando ? <TextInput value={datos.email} onChange={(v) => setField("email", v)} type="email" /> : (datos.email || "—")}
              </FieldRow>
              <FieldRow label="Correo corporativo">
                {editando ? <TextInput value={datos.email_corporativo} onChange={(v) => setField("email_corporativo", v)} type="email" /> : (datos.email_corporativo || "—")}
              </FieldRow>
              <FieldRow label="Teléfono personal">
                {editando ? <TextInput value={datos.telefono} onChange={(v) => setField("telefono", v)} /> : (datos.telefono || "—")}
              </FieldRow>
              <FieldRow label="Teléfono corporativo">
                {editando ? <TextInput value={datos.telefono_corporativo} onChange={(v) => setField("telefono_corporativo", v)} /> : (datos.telefono_corporativo || "—")}
              </FieldRow>
            </Section>

            <Section title="Contrato">
              <FieldRow label="Tipo de contrato">
                {editando ? (
                  <Select value={datos.tipo_contrato} onChange={(v) => setField("tipo_contrato", v)}>
                    {TC_CONTRATOS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </Select>
                ) : (datos.tipo_contrato || "—")}
              </FieldRow>
              <FieldRow label="Fecha de ingreso">
                {editando ? (
                  <TextInput value={datos.fecha_ingreso ?? ""} onChange={(v) => setField("fecha_ingreso", v || null)} type="date" />
                ) : (datos.fecha_ingreso || "—")}
              </FieldRow>
              <FieldRow label="Estado">
                {editando ? (
                  <Select value={datos.estado} onChange={(v) => setField("estado", v)}>
                    {TC_ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
                  </Select>
                ) : datos.estado}
              </FieldRow>
              {(datos.estado === "Inactivo" || editando) && (
                <FieldRow label="Tipo de salida">
                  {editando ? (
                    <Select value={datos.tipo_salida} onChange={(v) => setField("tipo_salida", v)}>
                      <option value="">Sin especificar</option>
                      {TC_SALIDAS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </Select>
                  ) : (datos.tipo_salida || "—")}
                </FieldRow>
              )}
            </Section>

            <Section title="Firma digital">
              <FirmaDigitalPanel
                personaId={persona.id}
                firmaUrl={persona.firma_url}
                puedeEditar={puedeEditar}
                onSaved={(url) => setPersona((prev) => prev ? { ...prev, firma_url: url } : prev)}
              />
            </Section>
          </div>
        )}

        {tab === "capacitaciones" && (
          <CapacitacionesTab personaId={persona.id} puedeEditar={puedeEditar} />
        )}

        {tab === "evaluaciones" && puedeVerSensible && (
          <EvaluacionesTab personaId={persona.id} puedeGestionar={puedeSensible} />
        )}

        {tab === "sanciones" && puedeVerSensible && (
          <SancionesTab personaId={persona.id} puedeGestionar={puedeSensible} />
        )}

        {tab === "novedades" && puedeVerSensible && (
          <NovedadesTab personaId={persona.id} puedeGestionar={puedeSensible} />
        )}

      </div>
    </PageLayout>
  )
}

// ── Tab Capacitaciones ────────────────────────────────────────────────────────

function CapacitacionesTab({ personaId, puedeEditar }: { personaId: number; puedeEditar: boolean }) {
  const [items, setItems]   = useState<Capacitacion[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding]   = useState(false)
  const [saving, setSaving]   = useState(false)
  const [form, setForm]       = useState({ titulo: "", fecha: "", horas: "", estado: TC_CAP_ESTADOS[0] as string, diploma_url: "", observaciones: "" })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get(`/tc/personas/${personaId}/capacitaciones`)
      setItems(Array.isArray(data) ? data : [])
    } finally { setLoading(false) }
  }, [personaId])

  useEffect(() => { load() }, [load])

  async function guardar() {
    if (!form.titulo.trim()) return
    setSaving(true)
    try {
      await api.post(`/tc/personas/${personaId}/capacitaciones`, {
        titulo: form.titulo,
        fecha: form.fecha || null,
        horas: form.horas ? parseFloat(form.horas) : null,
        estado: form.estado,
        diploma_url: form.diploma_url.trim(),
        observaciones: form.observaciones,
      })
      setForm({ titulo: "", fecha: "", horas: "", estado: TC_CAP_ESTADOS[0], diploma_url: "", observaciones: "" })
      setAdding(false)
      load()
    } finally { setSaving(false) }
  }

  async function eliminar(capId: number) {
    if (!confirm("¿Eliminar esta capacitación?")) return
    await api.delete(`/tc/capacitaciones/${capId}`)
    load()
  }

  const ESTADO_COLOR: Record<string, string> = {
    "Completado": "bg-emerald-500/10 text-emerald-500",
    "Pendiente":  "bg-amber-500/10 text-amber-500",
    "No asistió": "bg-rose-500/10 text-rose-500",
    "Cancelado":  "bg-muted text-muted-foreground",
  }

  return (
    <TabShell
      icon={<BookOpen className="w-4 h-4 text-indigo-500" />}
      title="Capacitaciones"
      count={items.length}
      onAdd={puedeEditar ? () => setAdding(true) : undefined}
    >
      {loading ? <TabLoading /> : items.length === 0 && !adding ? (
        <TabEmpty label="Sin capacitaciones registradas." />
      ) : (
        <div className="space-y-2">
          {items.map((c) => (
            <div key={c.id} className="flex items-start gap-3 p-3 rounded-lg border border-border/60 hover:border-border transition-colors group">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-tight">{c.titulo}</p>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  {c.fecha && <span className="text-xs text-muted-foreground">{c.fecha}</span>}
                  {c.horas != null && <span className="text-xs text-muted-foreground">{c.horas}h</span>}
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${ESTADO_COLOR[c.estado] ?? "bg-muted text-muted-foreground"}`}>
                    {c.estado}
                  </span>
                </div>
                {c.observaciones && <p className="text-xs text-muted-foreground mt-1 italic">{c.observaciones}</p>}
                {c.diploma_url && (
                  <a href={c.diploma_url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-medium text-teal-500 hover:text-teal-400 transition-colors">
                    <Award className="w-3 h-3" />
                    Ver diploma
                  </a>
                )}
                {(c.documentos?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap gap-2 mt-1.5">
                    {c.documentos!.map((d, i) => (
                      <a key={i} href={d.url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] font-medium text-sky-400 hover:text-sky-300 transition-colors">
                        <Link2 className="w-3 h-3" />
                        {d.nombre || "Documento"}
                      </a>
                    ))}
                  </div>
                )}
              </div>
              {puedeEditar && (
                <button onClick={() => eliminar(c.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:text-destructive transition-all">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {adding && (
        <AddForm onCancel={() => setAdding(false)} onSave={guardar} saving={saving}>
          <InputField label="Título *" value={form.titulo} onChange={(v) => setForm((p) => ({ ...p, titulo: v }))} />
          <div className="grid grid-cols-2 gap-3">
            <InputField label="Fecha" type="date" value={form.fecha} onChange={(v) => setForm((p) => ({ ...p, fecha: v }))} />
            <InputField label="Horas" type="number" value={form.horas} onChange={(v) => setForm((p) => ({ ...p, horas: v }))} placeholder="Ej: 8" />
          </div>
          <SelectField label="Estado" value={form.estado} onChange={(v) => setForm((p) => ({ ...p, estado: v }))}>
            {TC_CAP_ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
          </SelectField>
          <InputField label="URL Diploma (opcional)" value={form.diploma_url} onChange={(v) => setForm((p) => ({ ...p, diploma_url: v }))} placeholder="https://..." />
          <InputField label="Observaciones" value={form.observaciones} onChange={(v) => setForm((p) => ({ ...p, observaciones: v }))} />
        </AddForm>
      )}
    </TabShell>
  )
}

// ── Tab Evaluaciones ──────────────────────────────────────────────────────────

function EvaluacionesTab({ personaId, puedeGestionar }: { personaId: number; puedeGestionar: boolean }) {
  const [items, setItems]     = useState<Evaluacion[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding]   = useState(false)
  const [saving, setSaving]   = useState(false)
  const [form, setForm]       = useState({ titulo: "", puntaje: "", cumple_meta: false, fecha: "", observaciones: "" })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get(`/tc/personas/${personaId}/evaluaciones`)
      setItems(Array.isArray(data) ? data : [])
    } finally { setLoading(false) }
  }, [personaId])

  useEffect(() => { load() }, [load])

  async function guardar() {
    if (!form.titulo.trim()) return
    setSaving(true)
    try {
      await api.post(`/tc/personas/${personaId}/evaluaciones`, {
        titulo: form.titulo,
        puntaje: form.puntaje ? parseFloat(form.puntaje) : null,
        cumple_meta: form.cumple_meta,
        fecha: form.fecha || null,
        observaciones: form.observaciones,
      })
      setForm({ titulo: "", puntaje: "", cumple_meta: false, fecha: "", observaciones: "" })
      setAdding(false)
      load()
    } finally { setSaving(false) }
  }

  async function eliminar(evId: number) {
    if (!confirm("¿Eliminar esta evaluación?")) return
    await api.delete(`/tc/evaluaciones/${evId}`)
    load()
  }

  function estrellas(n: number | null) {
    if (n == null) return null
    return Array.from({ length: 5 }).map((_, i) => (
      <span key={i} className={i < Math.round(n) ? "text-amber-400" : "text-muted/30"}>★</span>
    ))
  }

  return (
    <TabShell
      icon={<ClipboardList className="w-4 h-4 text-orange-500" />}
      title="Evaluaciones de desempeño"
      count={items.length}
      onAdd={() => setAdding(true)}
    >
      {loading ? <TabLoading /> : items.length === 0 && !adding ? (
        <TabEmpty label="Sin evaluaciones registradas." />
      ) : (
        <div className="space-y-2">
          {items.map((ev) => (
            <div key={ev.id} className="flex items-start gap-3 p-3 rounded-lg border border-border/60 hover:border-border transition-colors group">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-tight">{ev.titulo}</p>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  {ev.fecha && <span className="text-xs text-muted-foreground">{ev.fecha}</span>}
                  {ev.puntaje != null && (
                    <span className="text-sm leading-none">{estrellas(ev.puntaje)}</span>
                  )}
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                    ev.cumple_meta ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground"
                  }`}>
                    {ev.cumple_meta ? "Meta cumplida" : "Meta no cumplida"}
                  </span>
                  <OrigenBadge origen={ev.origen} />
                </div>
                {ev.observaciones && <p className="text-xs text-muted-foreground mt-1 italic">{ev.observaciones}</p>}
              </div>
              {puedeGestionar && (
                <button onClick={() => eliminar(ev.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:text-destructive transition-all">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {adding && (
        <AddForm onCancel={() => setAdding(false)} onSave={guardar} saving={saving}>
          <InputField label="Título *" value={form.titulo} onChange={(v) => setForm((p) => ({ ...p, titulo: v }))} />
          <div className="grid grid-cols-2 gap-3">
            <InputField label="Puntaje (0-5)" type="number" value={form.puntaje} onChange={(v) => setForm((p) => ({ ...p, puntaje: v }))} placeholder="Ej: 4.5" />
            <InputField label="Fecha" type="date" value={form.fecha} onChange={(v) => setForm((p) => ({ ...p, fecha: v }))} />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.cumple_meta}
              onChange={(e) => setForm((p) => ({ ...p, cumple_meta: e.target.checked }))}
              className="rounded" />
            Cumple meta
          </label>
          <InputField label="Observaciones" value={form.observaciones} onChange={(v) => setForm((p) => ({ ...p, observaciones: v }))} />
        </AddForm>
      )}
    </TabShell>
  )
}

// ── Tab Sanciones ─────────────────────────────────────────────────────────────

function SancionesTab({ personaId, puedeGestionar }: { personaId: number; puedeGestionar: boolean }) {
  const [items, setItems]     = useState<Sancion[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding]   = useState(false)
  const [saving, setSaving]   = useState(false)
  const [form, setForm]       = useState({ tipo: TC_SANCION_TIPOS[0] as string, descripcion: "", fecha: "" })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get(`/tc/personas/${personaId}/sanciones`)
      setItems(Array.isArray(data) ? data : [])
    } finally { setLoading(false) }
  }, [personaId])

  useEffect(() => { load() }, [load])

  async function guardar() {
    setSaving(true)
    try {
      await api.post(`/tc/personas/${personaId}/sanciones`, {
        tipo: form.tipo,
        descripcion: form.descripcion,
        fecha: form.fecha || null,
      })
      setForm({ tipo: TC_SANCION_TIPOS[0], descripcion: "", fecha: "" })
      setAdding(false)
      load()
    } finally { setSaving(false) }
  }

  async function eliminar(sanId: number) {
    if (!confirm("¿Eliminar este registro?")) return
    await api.delete(`/tc/sanciones/${sanId}`)
    load()
  }

  const TIPO_COLOR: Record<string, string> = {
    [TC_SANCION_TIPOS[0]]: "bg-amber-500/10 text-amber-500",
    [TC_SANCION_TIPOS[1]]: "bg-orange-500/10 text-orange-500",
    [TC_SANCION_TIPOS[2]]: "bg-orange-600/10 text-orange-600",
    [TC_SANCION_TIPOS[3]]: "bg-red-500/10 text-red-500",
  }

  return (
    <TabShell
      icon={<ShieldAlert className="w-4 h-4 text-red-500" />}
      title="Sanciones y novedades"
      count={items.length}
      onAdd={() => setAdding(true)}
    >
      {loading ? <TabLoading /> : items.length === 0 && !adding ? (
        <TabEmpty label="Sin sanciones registradas." />
      ) : (
        <div className="space-y-2">
          {items.map((s) => (
            <div key={s.id} className="flex items-start gap-3 p-3 rounded-lg border border-border/60 hover:border-border transition-colors group">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${TIPO_COLOR[s.tipo] ?? "bg-muted text-muted-foreground"}`}>
                    {s.tipo}
                  </span>
                  {s.fecha && <span className="text-xs text-muted-foreground">{s.fecha}</span>}
                  <OrigenBadge origen={s.origen} />
                </div>
                {s.descripcion && <p className="text-sm mt-1.5 leading-snug">{s.descripcion}</p>}
              </div>
              {puedeGestionar && (
                <button onClick={() => eliminar(s.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:text-destructive transition-all">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {adding && (
        <AddForm onCancel={() => setAdding(false)} onSave={guardar} saving={saving}>
          <SelectField label="Tipo" value={form.tipo} onChange={(v) => setForm((p) => ({ ...p, tipo: v }))}>
            {TC_SANCION_TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
          </SelectField>
          <InputField label="Fecha" type="date" value={form.fecha} onChange={(v) => setForm((p) => ({ ...p, fecha: v }))} />
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Descripción</label>
            <textarea
              value={form.descripcion}
              onChange={(e) => setForm((p) => ({ ...p, descripcion: e.target.value }))}
              rows={3}
              className="w-full px-2.5 py-1.5 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
          </div>
        </AddForm>
      )}
    </TabShell>
  )
}

// ── Tab Novedades ─────────────────────────────────────────────────────────────

function NovedadesTab({ personaId, puedeGestionar }: { personaId: number; puedeGestionar: boolean }) {
  const [items, setItems]     = useState<Novedad[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding]   = useState(false)
  const [saving, setSaving]   = useState(false)
  const [form, setForm]       = useState({
    tipo: TC_NOVEDAD_TIPOS[0] as string,
    descripcion: "",
    fecha_inicio: "",
    fecha_fin: "",
    estado: TC_NOVEDAD_ESTADOS[0] as string,
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get(`/tc/personas/${personaId}/novedades`)
      setItems(Array.isArray(data) ? data : [])
    } finally { setLoading(false) }
  }, [personaId])

  useEffect(() => { load() }, [load])

  async function guardar() {
    setSaving(true)
    try {
      await api.post(`/tc/personas/${personaId}/novedades`, {
        tipo: form.tipo,
        descripcion: form.descripcion,
        fecha_inicio: form.fecha_inicio || null,
        fecha_fin: form.fecha_fin || null,
        estado: form.estado,
      })
      setForm({ tipo: TC_NOVEDAD_TIPOS[0], descripcion: "", fecha_inicio: "", fecha_fin: "", estado: TC_NOVEDAD_ESTADOS[0] })
      setAdding(false)
      load()
    } finally { setSaving(false) }
  }

  async function eliminar(novId: number) {
    if (!confirm("¿Eliminar esta novedad?")) return
    await api.delete(`/tc/novedades/${novId}`)
    load()
  }

  const ESTADO_COLOR: Record<string, string> = {
    "Pendiente":  "bg-amber-500/10 text-amber-500",
    "Aprobado":   "bg-emerald-500/10 text-emerald-500",
    "Rechazado":  "bg-red-500/10 text-red-500",
  }

  return (
    <TabShell
      icon={<FileText className="w-4 h-4 text-violet-500" />}
      title="Novedades y permisos"
      count={items.length}
      onAdd={() => setAdding(true)}
    >
      {loading ? <TabLoading /> : items.length === 0 && !adding ? (
        <TabEmpty label="Sin novedades registradas." />
      ) : (
        <div className="space-y-2">
          {items.map((n) => (
            <div key={n.id} className="flex items-start gap-3 p-3 rounded-lg border border-border/60 hover:border-border transition-colors group">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{n.tipo}</span>
                  {/* Aprobar/rechazar vive solo en /tc/aprobaciones (jefe directo) —
                      aquí es de solo lectura para no tener dos caminos que mutan el mismo estado. */}
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${ESTADO_COLOR[n.estado] ?? "bg-muted text-muted-foreground"}`}>
                    {n.estado}
                  </span>
                  <OrigenBadge origen={n.origen} />
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {n.fecha_inicio && <span className="text-xs text-muted-foreground">Desde: {n.fecha_inicio}</span>}
                  {n.fecha_fin && <span className="text-xs text-muted-foreground">Hasta: {n.fecha_fin}</span>}
                </div>
                {n.descripcion && <p className="text-xs text-muted-foreground mt-1 italic">{n.descripcion}</p>}
              </div>
              {puedeGestionar && (
                <button onClick={() => eliminar(n.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:text-destructive transition-all">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {adding && (
        <AddForm onCancel={() => setAdding(false)} onSave={guardar} saving={saving}>
          <SelectField label="Tipo" value={form.tipo} onChange={(v) => setForm((p) => ({ ...p, tipo: v }))}>
            {TC_NOVEDAD_TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
          </SelectField>
          <div className="grid grid-cols-2 gap-3">
            <InputField label="Fecha inicio" type="date" value={form.fecha_inicio} onChange={(v) => setForm((p) => ({ ...p, fecha_inicio: v }))} />
            <InputField label="Fecha fin" type="date" value={form.fecha_fin} onChange={(v) => setForm((p) => ({ ...p, fecha_fin: v }))} />
          </div>
          <SelectField label="Estado" value={form.estado} onChange={(v) => setForm((p) => ({ ...p, estado: v }))}>
            {TC_NOVEDAD_ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
          </SelectField>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Descripción</label>
            <textarea
              value={form.descripcion}
              onChange={(e) => setForm((p) => ({ ...p, descripcion: e.target.value }))}
              rows={2}
              className="w-full px-2.5 py-1.5 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
          </div>
        </AddForm>
      )}
    </TabShell>
  )
}

// ── Shared primitives ─────────────────────────────────────────────────────────

function TabShell({
  icon, title, count, onAdd, children,
}: {
  icon: React.ReactNode; title: string; count: number
  onAdd?: () => void; children: React.ReactNode
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium">{title}</span>
          {count > 0 && (
            <span className="text-[10px] font-semibold bg-muted px-1.5 py-0.5 rounded tabular-nums">
              {count}
            </span>
          )}
        </div>
        {onAdd && (
          <button onClick={onAdd}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-muted/40 hover:bg-muted/80 rounded-md transition-colors">
            <Plus className="w-3 h-3" /> Registrar
          </button>
        )}
      </div>
      {children}
    </div>
  )
}

function AddForm({ onCancel, onSave, saving, children }: {
  onCancel: () => void; onSave: () => void; saving: boolean; children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-teal-500/20 bg-teal-500/5 p-4 space-y-3">
      {children}
      <div className="flex items-center justify-end gap-2 pt-1">
        <button onClick={onCancel}
          className="px-3 py-1.5 text-xs border border-input rounded-md hover:bg-accent transition-colors">
          Cancelar
        </button>
        <button onClick={onSave} disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-teal-500 text-white rounded-md hover:bg-teal-600 transition-colors disabled:opacity-50">
          {saving ? <><Loader2 className="w-3 h-3 animate-spin" /> Guardando…</> : "Guardar"}
        </button>
      </div>
    </div>
  )
}

function TabLoading() {
  return <div className="py-8 text-center text-sm text-muted-foreground">Cargando…</div>
}

function TabEmpty({ label }: { label: string }) {
  return <div className="py-8 text-center text-sm text-muted-foreground">{label}</div>
}

function OrigenBadge({ origen }: { origen: string }) {
  if (!origen || origen === "manual") return null
  const label = origen.startsWith("formato:") ? `Formato: ${origen.slice("formato:".length)}` : origen
  return (
    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 uppercase tracking-wide">
      {label}
    </span>
  )
}

function InputField({ label, value, onChange, type = "text", placeholder = "" }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-2.5 py-1.5 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring" />
    </div>
  )
}

function SelectField({ label, value, onChange, children }: {
  label: string; value: string; onChange: (v: string) => void; children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full px-2.5 py-1.5 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring">
        {children}
      </select>
    </div>
  )
}

// ── Legacy section components (Info tab) ──────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{title}</h3>
      <div className="border border-border rounded-lg divide-y divide-border">{children}</div>
    </div>
  )
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <span className="w-40 shrink-0 text-sm text-muted-foreground">{label}</span>
      <span className="text-sm flex-1">{children}</span>
    </div>
  )
}

function TextInput({ value, onChange, type = "text", placeholder = "" }: {
  value: string; onChange: (v: string) => void; type?: string; placeholder?: string
}) {
  return (
    <input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-2 py-1 text-sm bg-background border border-input rounded focus:outline-none focus:ring-1 focus:ring-ring" />
  )
}

function Select({ value, onChange, children }: {
  value: string; onChange: (v: string) => void; children: React.ReactNode
}) {
  return (
    <select value={value ?? ""} onChange={(e) => onChange(e.target.value)}
      className="w-full px-2 py-1 text-sm bg-background border border-input rounded focus:outline-none focus:ring-1 focus:ring-ring">
      {children}
    </select>
  )
}
