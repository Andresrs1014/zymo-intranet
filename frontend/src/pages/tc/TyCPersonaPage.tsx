import { useEffect, useState, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { api } from "@/lib/api"
import { useAuthStore } from "@/store/authStore"
import { canEditTyC, canSeeTyCSensible } from "@/lib/permissions"
import { PageLayout } from "@/components/layout/PageLayout"
import {
  ArrowLeft, Pencil, X, Check, Plus, Trash2, Loader2,
  BookOpen, ClipboardList, ShieldAlert,
} from "lucide-react"

// ── Interfaces ────────────────────────────────────────────────────────────────

interface Empresa { id: number; nombre: string; codigo: string }
interface Area    { id: number; name: string }
interface Cargo   { id: number; empresa_id: number; area_id: number | null; nombre: string }

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
  genero: string
  rh: string
  email: string
  email_corporativo: string
  telefono: string
  telefono_corporativo: string
  tipo_contrato: string
  fecha_ingreso: string | null
  antiguedad_label: string
  estado: string
  tipo_salida: string
  fecha_salida: string | null
  idp_active: boolean
  idp_eligible: boolean
  user_id: number | null
}

interface Capacitacion {
  id: number; titulo: string; fecha: string | null; horas: number | null
  estado: string; diploma_url: string; observaciones: string
}
interface Evaluacion {
  id: number; titulo: string; puntaje: number | null
  cumple_meta: boolean; fecha: string | null; observaciones: string
}
interface Sancion {
  id: number; tipo: string; descripcion: string; fecha: string | null
}

type Tab = "info" | "capacitaciones" | "evaluaciones" | "sanciones"

// ── Componente principal ──────────────────────────────────────────────────────

export function TyCPersonaPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const puedeEditar   = user ? canEditTyC(user.role, user.app_permissions) : false
  const puedeSensible = user ? canSeeTyCSensible(user.role, user.app_permissions) : false

  const [tab, setTab] = useState<Tab>("info")
  const [persona, setPersona] = useState<Persona | null>(null)
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [areas, setAreas]       = useState<Area[]>([])
  const [cargos, setCargos]     = useState<Cargo[]>([])
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
        cargarAreasCargos(pRes.data.empresa_id)
      })
      .catch(() => setError("No se pudo cargar la información del colaborador."))
      .finally(() => setLoading(false))
  }, [id])

  function cargarAreasCargos(empresaId: number) {
    api.get("/areas").then((r) => setAreas(Array.isArray(r.data) ? r.data : []))
    api.get("/tc/cargos", { params: { empresa_id: empresaId } })
      .then((r) => setCargos(Array.isArray(r.data) ? r.data : []))
  }

  function iniciarEdicion() {
    if (!persona) return
    setForm({ ...persona })
    setEditando(true)
    setError("")
  }

  function cancelarEdicion() { setEditando(false); setForm({}); setError("") }

  async function guardar() {
    if (!persona) return
    setGuardando(true); setError("")
    try {
      const { data } = await api.put(`/tc/personas/${persona.id}`, form)
      setPersona(data); setEditando(false); setForm({})
    } catch { setError("No se pudo guardar los cambios.") }
    finally { setGuardando(false) }
  }

  function setField(key: keyof Persona, value: string | number | boolean | null) {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (key === "empresa_id" && typeof value === "number") {
      setForm((prev) => ({ ...prev, area_id: null, cargo_id: null }))
      cargarAreasCargos(value)
    }
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

  const TABS: { key: Tab; label: string; icon?: React.ReactNode; sensible?: boolean }[] = [
    { key: "info", label: "Información" },
    { key: "capacitaciones", label: "Capacitaciones", icon: <BookOpen className="w-3.5 h-3.5" /> },
    ...(puedeSensible ? [
      { key: "evaluaciones" as Tab, label: "Evaluaciones", icon: <ClipboardList className="w-3.5 h-3.5" />, sensible: true },
      { key: "sanciones"   as Tab, label: "Sanciones",    icon: <ShieldAlert className="w-3.5 h-3.5" />, sensible: true },
    ] : []),
  ]

  return (
    <PageLayout title="T&C — Talento y Cultura">
      <div className="max-w-3xl mx-auto px-4 pt-4 pb-10 space-y-5">

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
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-teal-500/10 text-teal-500 text-xl font-semibold">
              {persona.initials || persona.nombre.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-semibold leading-tight">{persona.nombre}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {persona.cargo_nombre || "Sin cargo"} · {persona.empresa_codigo}
              </p>
              <span className={`inline-flex mt-1 items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                persona.estado === "Activo"
                  ? "bg-emerald-500/10 text-emerald-500"
                  : "bg-muted text-muted-foreground"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${persona.estado === "Activo" ? "bg-emerald-500" : "bg-muted-foreground"}`} />
                {persona.estado}
              </span>
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
              <FieldRow label="Empresa">
                {editando ? (
                  <Select value={String(datos.empresa_id)} onChange={(v) => setField("empresa_id", Number(v))}>
                    {empresas.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                  </Select>
                ) : datos.empresa_nombre}
              </FieldRow>
              <FieldRow label="Área">
                {editando ? (
                  <Select value={String(datos.area_id ?? "")} onChange={(v) => setField("area_id", v ? Number(v) : null)}>
                    <option value="">Sin área</option>
                    {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </Select>
                ) : (datos.area_nombre || "—")}
              </FieldRow>
              <FieldRow label="Cargo">
                {editando ? (
                  <Select value={String(datos.cargo_id ?? "")} onChange={(v) => setField("cargo_id", v ? Number(v) : null)}>
                    <option value="">Sin cargo</option>
                    {cargos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </Select>
                ) : (datos.cargo_nombre || "—")}
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
                    <option value="Masculino">Masculino</option>
                    <option value="Femenino">Femenino</option>
                    <option value="Otro">Otro</option>
                  </Select>
                ) : (datos.genero || "—")}
              </FieldRow>
              <FieldRow label="RH">
                {editando ? <TextInput value={datos.rh} onChange={(v) => setField("rh", v)} placeholder="O+" /> : (datos.rh || "—")}
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
                    <option value="Término indefinido">Término indefinido</option>
                    <option value="Término fijo">Término fijo</option>
                    <option value="Obra o labor">Obra o labor</option>
                    <option value="Aprendizaje SENA">Aprendizaje SENA</option>
                    <option value="Prestación de servicios">Prestación de servicios</option>
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
                    <option value="Activo">Activo</option>
                    <option value="Inactivo">Inactivo</option>
                  </Select>
                ) : datos.estado}
              </FieldRow>
              {(datos.estado === "Inactivo" || editando) && (
                <FieldRow label="Tipo de salida">
                  {editando ? (
                    <Select value={datos.tipo_salida} onChange={(v) => setField("tipo_salida", v)}>
                      <option value="">Sin especificar</option>
                      <option value="Renuncia voluntaria">Renuncia voluntaria</option>
                      <option value="Terminación con justa causa">Terminación con justa causa</option>
                      <option value="Terminación sin justa causa">Terminación sin justa causa</option>
                      <option value="Vencimiento de contrato">Vencimiento de contrato</option>
                      <option value="Mutuo acuerdo">Mutuo acuerdo</option>
                    </Select>
                  ) : (datos.tipo_salida || "—")}
                </FieldRow>
              )}
            </Section>
          </div>
        )}

        {tab === "capacitaciones" && (
          <CapacitacionesTab personaId={persona.id} puedeEditar={puedeEditar} />
        )}

        {tab === "evaluaciones" && puedeSensible && (
          <EvaluacionesTab personaId={persona.id} />
        )}

        {tab === "sanciones" && puedeSensible && (
          <SancionesTab personaId={persona.id} />
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
  const [form, setForm]       = useState({ titulo: "", fecha: "", horas: "", estado: "Completado", observaciones: "" })

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
        observaciones: form.observaciones,
      })
      setForm({ titulo: "", fecha: "", horas: "", estado: "Completado", observaciones: "" })
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
            <option value="Completado">Completado</option>
            <option value="Pendiente">Pendiente</option>
            <option value="Cancelado">Cancelado</option>
          </SelectField>
          <InputField label="Observaciones" value={form.observaciones} onChange={(v) => setForm((p) => ({ ...p, observaciones: v }))} />
        </AddForm>
      )}
    </TabShell>
  )
}

// ── Tab Evaluaciones ──────────────────────────────────────────────────────────

function EvaluacionesTab({ personaId }: { personaId: number }) {
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
                </div>
                {ev.observaciones && <p className="text-xs text-muted-foreground mt-1 italic">{ev.observaciones}</p>}
              </div>
              <button onClick={() => eliminar(ev.id)}
                className="opacity-0 group-hover:opacity-100 p-1 hover:text-destructive transition-all">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
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

function SancionesTab({ personaId }: { personaId: number }) {
  const [items, setItems]     = useState<Sancion[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding]   = useState(false)
  const [saving, setSaving]   = useState(false)
  const [form, setForm]       = useState({ tipo: "Llamado de atención", descripcion: "", fecha: "" })

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
      setForm({ tipo: "Llamado de atención", descripcion: "", fecha: "" })
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
    "Llamado de atención":      "bg-amber-500/10 text-amber-500",
    "Sanción disciplinaria":    "bg-orange-500/10 text-orange-500",
    "Suspensión":               "bg-red-500/10 text-red-500",
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
                </div>
                {s.descripcion && <p className="text-sm mt-1.5 leading-snug">{s.descripcion}</p>}
              </div>
              <button onClick={() => eliminar(s.id)}
                className="opacity-0 group-hover:opacity-100 p-1 hover:text-destructive transition-all">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <AddForm onCancel={() => setAdding(false)} onSave={guardar} saving={saving}>
          <SelectField label="Tipo" value={form.tipo} onChange={(v) => setForm((p) => ({ ...p, tipo: v }))}>
            <option value="Llamado de atención">Llamado de atención</option>
            <option value="Sanción disciplinaria">Sanción disciplinaria</option>
            <option value="Suspensión">Suspensión</option>
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
