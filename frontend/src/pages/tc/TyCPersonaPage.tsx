import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { api } from "@/lib/api"
import { useAuthStore } from "@/store/authStore"
import { canEditTyC } from "@/lib/permissions"
import { PageLayout } from "@/components/layout/PageLayout"
import { ArrowLeft, Pencil, X, Check } from "lucide-react"

interface Empresa { id: number; nombre: string; codigo: string }
interface Area { id: number; empresa_id: number; nombre: string }
interface Cargo { id: number; empresa_id: number; area_id: number | null; nombre: string }

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

export function TyCPersonaPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const puedeEditar = user ? canEditTyC(user.role, user.app_permissions) : false

  const [persona, setPersona] = useState<Persona | null>(null)
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [cargos, setCargos] = useState<Cargo[]>([])
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState("")
  const [form, setForm] = useState<Partial<Persona>>({})

  useEffect(() => {
    Promise.all([
      api.get(`/tc/personas/${id}`),
      api.get("/tc/empresas"),
    ]).then(([pRes, eRes]) => {
      setPersona(pRes.data)
      setEmpresas(eRes.data)
      setLoading(false)
      cargarAreasCargos(pRes.data.empresa_id)
    }).catch(() => {
      setError("No se pudo cargar la información del colaborador.")
      setLoading(false)
    })
  }, [id])

  function cargarAreasCargos(empresaId: number) {
    api.get("/tc/areas", { params: { empresa_id: empresaId } })
      .then((r) => setAreas(r.data))
    api.get("/tc/cargos", { params: { empresa_id: empresaId } })
      .then((r) => setCargos(r.data))
  }

  function iniciarEdicion() {
    if (!persona) return
    setForm({ ...persona })
    setEditando(true)
    setError("")
  }

  function cancelarEdicion() {
    setEditando(false)
    setForm({})
    setError("")
  }

  async function guardar() {
    if (!persona) return
    setGuardando(true)
    setError("")
    try {
      const { data } = await api.put(`/tc/personas/${persona.id}`, form)
      setPersona(data)
      setEditando(false)
      setForm({})
    } catch {
      setError("No se pudo guardar los cambios.")
    } finally {
      setGuardando(false)
    }
  }

  function setField(key: keyof Persona, value: string | number | boolean | null) {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (key === "empresa_id" && typeof value === "number") {
      setForm((prev) => ({ ...prev, area_id: null, cargo_id: null }))
      cargarAreasCargos(value)
    }
  }

  if (loading) {
    return (
      <PageLayout title="T&C — Colaborador">
        <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
          Cargando…
        </div>
      </PageLayout>
    )
  }

  if (!persona) {
    return (
      <PageLayout title="T&C — Colaborador">
        <div className="m-4 p-3 text-sm text-destructive bg-destructive/10 rounded-md">
          {error || "Colaborador no encontrado."}
        </div>
      </PageLayout>
    )
  }

  const datos = editando ? { ...persona, ...form } : persona

  return (
    <PageLayout title="T&C — Talento y Cultura">
      <div className="max-w-3xl mx-auto p-4 space-y-6">
        {/* Navegación */}
        <button
          onClick={() => navigate("/tc")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al directorio
        </button>

        {/* Header persona */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xl font-semibold">
              {persona.initials || persona.nombre.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-semibold">{persona.nombre}</h2>
              <p className="text-sm text-muted-foreground">
                {persona.cargo_nombre || "Sin cargo"} · {persona.empresa_codigo}
              </p>
              <span
                className={`inline-flex mt-1 items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  persona.estado === "Activo"
                    ? "bg-emerald-500/10 text-emerald-600"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {persona.estado}
              </span>
            </div>
          </div>

          {puedeEditar && !editando && (
            <button
              onClick={iniciarEdicion}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-input rounded-md hover:bg-accent transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              Editar
            </button>
          )}
          {editando && (
            <div className="flex items-center gap-2">
              <button
                onClick={cancelarEdicion}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-input rounded-md hover:bg-accent transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Cancelar
              </button>
              <button
                onClick={guardar}
                disabled={guardando}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
                {guardando ? "Guardando…" : "Guardar"}
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">{error}</div>
        )}

        {/* Secciones de datos */}
        <Section title="Organización">
          <FieldRow label="Empresa">
            {editando ? (
              <Select
                value={String(datos.empresa_id)}
                onChange={(v) => setField("empresa_id", Number(v))}
              >
                {empresas.map((e) => (
                  <option key={e.id} value={e.id}>{e.nombre}</option>
                ))}
              </Select>
            ) : datos.empresa_nombre}
          </FieldRow>
          <FieldRow label="Área">
            {editando ? (
              <Select
                value={String(datos.area_id ?? "")}
                onChange={(v) => setField("area_id", v ? Number(v) : null)}
              >
                <option value="">Sin área</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>{a.nombre}</option>
                ))}
              </Select>
            ) : (datos.area_nombre || "—")}
          </FieldRow>
          <FieldRow label="Cargo">
            {editando ? (
              <Select
                value={String(datos.cargo_id ?? "")}
                onChange={(v) => setField("cargo_id", v ? Number(v) : null)}
              >
                <option value="">Sin cargo</option>
                {cargos.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </Select>
            ) : (datos.cargo_nombre || "—")}
          </FieldRow>
        </Section>

        <Section title="Datos personales">
          <FieldRow label="Documento">
            {editando
              ? <TextInput value={datos.documento} onChange={(v) => setField("documento", v)} />
              : (datos.documento || "—")}
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
            {editando
              ? <TextInput value={datos.rh} onChange={(v) => setField("rh", v)} placeholder="O+" />
              : (datos.rh || "—")}
          </FieldRow>
          <FieldRow label="Correo personal">
            {editando
              ? <TextInput value={datos.email} onChange={(v) => setField("email", v)} type="email" />
              : (datos.email || "—")}
          </FieldRow>
          <FieldRow label="Correo corporativo">
            {editando
              ? <TextInput value={datos.email_corporativo} onChange={(v) => setField("email_corporativo", v)} type="email" />
              : (datos.email_corporativo || "—")}
          </FieldRow>
          <FieldRow label="Teléfono personal">
            {editando
              ? <TextInput value={datos.telefono} onChange={(v) => setField("telefono", v)} />
              : (datos.telefono || "—")}
          </FieldRow>
          <FieldRow label="Teléfono corporativo">
            {editando
              ? <TextInput value={datos.telefono_corporativo} onChange={(v) => setField("telefono_corporativo", v)} />
              : (datos.telefono_corporativo || "—")}
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
              <TextInput
                value={datos.fecha_ingreso ?? ""}
                onChange={(v) => setField("fecha_ingreso", v || null)}
                type="date"
              />
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
    </PageLayout>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        {title}
      </h3>
      <div className="border border-border rounded-lg divide-y divide-border">
        {children}
      </div>
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

function TextInput({
  value,
  onChange,
  type = "text",
  placeholder = "",
}: {
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
}) {
  return (
    <input
      type={type}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-2 py-1 text-sm bg-background border border-input rounded focus:outline-none focus:ring-1 focus:ring-ring"
    />
  )
}

function Select({
  value,
  onChange,
  children,
}: {
  value: string
  onChange: (v: string) => void
  children: React.ReactNode
}) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-2 py-1 text-sm bg-background border border-input rounded focus:outline-none focus:ring-1 focus:ring-ring"
    >
      {children}
    </select>
  )
}
