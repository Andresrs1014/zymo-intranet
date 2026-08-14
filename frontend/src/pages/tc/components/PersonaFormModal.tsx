import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import { X } from "lucide-react"
import { TC_GENEROS, TC_CONTRATOS } from "@/lib/tc-constants"

interface Empresa { id: number; nombre: string; codigo: string }
interface Area { id: number; name: string }
interface Cargo { id: number; area_id: number | null; nombre: string; sede_ids: number[] }

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
    tarjeta: "",
    email: "",
    telefono: "",
    tipo_contrato: TC_CONTRATOS[0],
    fecha_ingreso: "",
    fecha_nacimiento: "",
    edad: "",
    estado: "Activo",   // ponytail: valor inicial fijo, no hay selector en este modal
  })

  useEffect(() => {
    api.get("/areas")
      .then((r) => setAreas(Array.isArray(r.data) ? r.data : []))
  }, [])

  useEffect(() => {
    // Cargos son globales — no se filtran por empresa
    api.get("/tc/cargos")
      .then((r) => setCargos(Array.isArray(r.data) ? r.data : []))
  }, [])

  function setField(key: string, value: string | number | null) {
    setForm((prev) => {
      const next = { ...prev, [key]: value }
      if (key === "cargo_id") {
        const cargo = cargos.find((c) => c.id === value)
        if (cargo && cargo.sede_ids.length > 0 && !cargo.sede_ids.includes(next.empresa_id)) {
          next.empresa_id = cargo.sede_ids[0]
        }
      }
      return next
    })
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
        fecha_nacimiento: form.fecha_nacimiento || null,
        edad: form.edad ? parseInt(form.edad) : null,
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

          <FormGroup label="Tarjeta (carné de acceso)">
            <Input value={form.tarjeta} onChange={(v) => setField("tarjeta", v)} placeholder="Ej. 0007480710 114, 09606" />
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

          <div className="grid grid-cols-2 gap-3">
            <FormGroup label="Empresa (nómina) *">
              {(() => {
                const cargoActual = cargos.find((c) => c.id === form.cargo_id)
                const opciones = cargoActual && cargoActual.sede_ids.length > 0
                  ? empresas.filter((e) => cargoActual.sede_ids.includes(e.id))
                  : empresas
                return (
                  <select
                    value={form.empresa_id}
                    onChange={(e) => setField("empresa_id", Number(e.target.value))}
                    className="form-select"
                  >
                    {opciones.map((e) => (
                      <option key={e.id} value={e.id}>{e.nombre}</option>
                    ))}
                  </select>
                )
              })()}
            </FormGroup>

            <FormGroup label="Área">
              <select
                value={form.area_id}
                onChange={(e) => setField("area_id", e.target.value ? Number(e.target.value) : "")}
                className="form-select"
              >
                <option value="">Sin área</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </FormGroup>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormGroup label="Género">
              <select value={form.genero} onChange={(e) => setField("genero", e.target.value)} className="form-select">
                <option value="">Sin especificar</option>
                {TC_GENEROS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </FormGroup>

            <FormGroup label="RH">
              <Input value={form.rh} onChange={(v) => setField("rh", v)} placeholder="O+" />
            </FormGroup>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormGroup label="Fecha de nacimiento">
              <Input value={form.fecha_nacimiento} onChange={(v) => setField("fecha_nacimiento", v)} type="date" />
            </FormGroup>

            <FormGroup label="Edad">
              <Input value={form.edad} onChange={(v) => setField("edad", v)} type="number" placeholder="0" />
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
                {TC_CONTRATOS.map((c) => <option key={c} value={c}>{c}</option>)}
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
