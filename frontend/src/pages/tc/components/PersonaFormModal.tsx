import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import { X } from "lucide-react"

interface Empresa { id: number; nombre: string; codigo: string }
interface Area { id: number; empresa_id: number; nombre: string }
interface Cargo { id: number; empresa_id: number; area_id: number | null; nombre: string }

interface Props {
  empresas: Empresa[]
  onCreada: () => void
  onCerrar: () => void
}

export function PersonaFormModal({ empresas, onCreada, onCerrar }: Props) {
  const [areas, setAreas] = useState<Area[]>([])
  const [cargos, setCargos] = useState<Cargo[]>([])
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState("")

  const [form, setForm] = useState({
    nombre: "",
    documento: "",
    empresa_id: empresas[0]?.id ?? 0,
    area_id: "" as number | "",
    cargo_id: "" as number | "",
    genero: "",
    rh: "",
    email: "",
    telefono: "",
    tipo_contrato: "Término indefinido",
    fecha_ingreso: "",
    estado: "Activo",
  })

  useEffect(() => {
    if (!form.empresa_id) return
    api.get("/tc/areas", { params: { empresa_id: form.empresa_id } })
      .then((r) => setAreas(r.data))
    api.get("/tc/cargos", { params: { empresa_id: form.empresa_id } })
      .then((r) => setCargos(r.data))
  }, [form.empresa_id])

  function setField(key: string, value: string | number | null) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nombre.trim()) {
      setError("El nombre es requerido.")
      return
    }
    setGuardando(true)
    setError("")
    try {
      await api.post("/tc/personas", {
        ...form,
        area_id: form.area_id || null,
        cargo_id: form.cargo_id || null,
        fecha_ingreso: form.fecha_ingreso || null,
      })
      onCreada()
    } catch {
      setError("No se pudo crear la persona. Verifica los datos.")
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background border border-border rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold">Nueva persona</h2>
          <button onClick={onCerrar} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">{error}</div>
          )}

          <FormGroup label="Nombre completo *">
            <Input
              value={form.nombre}
              onChange={(v) => setField("nombre", v)}
              placeholder="JUAN PÉREZ GARCÍA"
              required
            />
          </FormGroup>

          <FormGroup label="Cédula / Documento">
            <Input value={form.documento} onChange={(v) => setField("documento", v)} placeholder="12345678" />
          </FormGroup>

          <FormGroup label="Empresa *">
            <select
              value={form.empresa_id}
              onChange={(e) => {
                setField("empresa_id", Number(e.target.value))
                setField("area_id", "")
                setField("cargo_id", "")
              }}
              className="form-select"
            >
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>{e.nombre}</option>
              ))}
            </select>
          </FormGroup>

          <div className="grid grid-cols-2 gap-3">
            <FormGroup label="Área">
              <select
                value={form.area_id}
                onChange={(e) => setField("area_id", e.target.value ? Number(e.target.value) : "")}
                className="form-select"
              >
                <option value="">Sin área</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>{a.nombre}</option>
                ))}
              </select>
            </FormGroup>

            <FormGroup label="Cargo">
              <select
                value={form.cargo_id}
                onChange={(e) => setField("cargo_id", e.target.value ? Number(e.target.value) : "")}
                className="form-select"
              >
                <option value="">Sin cargo</option>
                {cargos.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </FormGroup>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormGroup label="Género">
              <select value={form.genero} onChange={(e) => setField("genero", e.target.value)} className="form-select">
                <option value="">Sin especificar</option>
                <option value="Masculino">Masculino</option>
                <option value="Femenino">Femenino</option>
                <option value="Otro">Otro</option>
              </select>
            </FormGroup>

            <FormGroup label="RH">
              <Input value={form.rh} onChange={(v) => setField("rh", v)} placeholder="O+" />
            </FormGroup>
          </div>

          <FormGroup label="Correo personal">
            <Input value={form.email} onChange={(v) => setField("email", v)} type="email" placeholder="correo@gmail.com" />
          </FormGroup>

          <FormGroup label="Teléfono">
            <Input value={form.telefono} onChange={(v) => setField("telefono", v)} placeholder="300 000 0000" />
          </FormGroup>

          <div className="grid grid-cols-2 gap-3">
            <FormGroup label="Tipo de contrato">
              <select value={form.tipo_contrato} onChange={(e) => setField("tipo_contrato", e.target.value)} className="form-select">
                <option value="Término indefinido">Término indefinido</option>
                <option value="Término fijo">Término fijo</option>
                <option value="Obra o labor">Obra o labor</option>
                <option value="Aprendizaje SENA">Aprendizaje SENA</option>
                <option value="Prestación de servicios">Prestación de servicios</option>
              </select>
            </FormGroup>

            <FormGroup label="Fecha de ingreso">
              <Input value={form.fecha_ingreso} onChange={(v) => setField("fecha_ingreso", v)} type="date" />
            </FormGroup>
          </div>

          {/* Acciones */}
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={onCerrar}
              className="px-4 py-2 text-sm border border-input rounded-md hover:bg-accent transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {guardando ? "Creando…" : "Crear persona"}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        .form-select {
          width: 100%;
          padding: 0.375rem 0.5rem;
          font-size: 0.875rem;
          background: transparent;
          border: 1px solid hsl(var(--input));
          border-radius: 0.375rem;
          color: inherit;
        }
        .form-select:focus {
          outline: none;
          box-shadow: 0 0 0 1px hsl(var(--ring));
        }
      `}</style>
    </div>
  )
}

function FormGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  )
}

function Input({
  value,
  onChange,
  type = "text",
  placeholder = "",
  required = false,
}: {
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  required?: boolean
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      className="w-full px-2.5 py-1.5 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
    />
  )
}
