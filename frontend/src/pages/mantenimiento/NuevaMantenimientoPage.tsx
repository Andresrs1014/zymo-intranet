import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Combobox } from "@/components/ui/Combobox"
import { useCrearMantenimiento, useTiposMantenimiento } from "@/hooks/useMantenimiento"
import { useAuthStore } from "@/store/authStore"
import type { ClasificacionMantenimiento, ModalidadMantenimiento } from "@/types/mantenimiento"
import { format } from "date-fns"

export default function NuevaMantenimientoPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { data: tipos = [] } = useTiposMantenimiento()
  const { mutateAsync, isPending } = useCrearMantenimiento()

  const [titulo, setTitulo]                       = useState("")
  const [descripcion, setDescripcion]             = useState("")
  const [tipoMantenimiento, setTipoMantenimiento] = useState("")
  const [clasificacion, setClasificacion]         = useState<ClasificacionMantenimiento>("correctivo")
  const [modalidad, setModalidad]                 = useState<ModalidadMantenimiento>("interno")
  const [fechaProxima, setFechaProxima]           = useState("")
  const [error, setError]                         = useState<string | null>(null)

  const tiposOptions = tipos.map((t) => ({ value: t.nombre, label: t.nombre }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!titulo.trim())            return setError("El título es requerido.")
    if (!descripcion.trim())       return setError("La descripción es requerida.")
    if (!tipoMantenimiento.trim()) return setError("Selecciona el tipo de mantenimiento.")
    if (clasificacion === "preventivo" && !fechaProxima) {
      return setError("La fecha de próximo mantenimiento es requerida para mantenimiento preventivo.")
    }

    try {
      const sol = await mutateAsync({
        titulo:                      titulo.trim(),
        descripcion:                 descripcion.trim(),
        tipo_mantenimiento:          tipoMantenimiento,
        clasificacion,
        modalidad,
        fecha_proxima_mantenimiento: clasificacion === "preventivo" ? fechaProxima : null,
      })
      navigate(`/mantenimiento/${sol.id}`)
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Error al crear la solicitud.")
    }
  }

  return (
    <PageLayout title="Nueva solicitud de mantenimiento">
      <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">

        {/* Solicitante */}
        <section className="bg-card rounded-xl border border-border p-6 space-y-4">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
            Solicitante
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-lg bg-muted border border-border px-3 py-2.5">
              <p className="text-xs text-muted-foreground mb-0.5">Nombre</p>
              <p className="text-sm font-medium text-foreground">{user?.full_name}</p>
            </div>
            <div className="rounded-lg bg-muted border border-border px-3 py-2.5">
              <p className="text-xs text-muted-foreground mb-0.5">Área</p>
              <p className="text-sm font-medium text-foreground">{user?.area ?? "—"}</p>
            </div>
            <div className="rounded-lg bg-muted border border-border px-3 py-2.5">
              <p className="text-xs text-muted-foreground mb-0.5">Fecha</p>
              <p className="text-sm font-medium text-foreground">
                {format(new Date(), "dd/MM/yyyy")}
              </p>
            </div>
          </div>
        </section>

        {/* Datos del mantenimiento */}
        <section className="bg-card rounded-xl border border-border p-6 space-y-5">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
            Datos del mantenimiento
          </h2>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Título *</label>
            <input
              type="text"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ej: Falla en panel eléctrico galpón 2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Descripción *</label>
            <textarea
              rows={4}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Describe el problema o el mantenimiento requerido con el mayor detalle posible..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Tipo de mantenimiento *
            </label>
            <Combobox
              options={tiposOptions}
              value={tipoMantenimiento}
              onChange={(v) => setTipoMantenimiento(v != null ? String(v) : "")}
              placeholder="Seleccionar tipo..."
            />
          </div>

          {/* Preventivo / Correctivo */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Clasificación *
            </label>
            <div className="flex gap-3">
              {(["correctivo", "preventivo"] as ClasificacionMantenimiento[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    setClasificacion(c)
                    if (c === "correctivo") setFechaProxima("")
                  }}
                  className={`flex items-center gap-2 rounded-xl border-2 px-5 py-3 text-sm font-semibold transition-all ${
                    clasificacion === c
                      ? c === "correctivo"
                        ? "border-red-500 bg-red-50 text-red-700"
                        : "border-emerald-500 bg-emerald-50 text-emerald-700"
                      : "border-border bg-card text-muted-foreground hover:border-muted-foreground/40"
                  }`}
                >
                  {c === "correctivo" ? "🔴 Correctivo" : "🟢 Preventivo"}
                </button>
              ))}
            </div>
          </div>

          {/* Fecha próxima — solo visible si preventivo */}
          <div
            className={`overflow-hidden transition-all duration-200 ${
              clasificacion === "preventivo" ? "max-h-24 opacity-100" : "max-h-0 opacity-0"
            }`}
          >
            <label className="block text-sm font-medium text-foreground mb-1">
              Fecha próximo mantenimiento preventivo *
            </label>
            <input
              type="date"
              className="w-full max-w-xs rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              value={fechaProxima}
              onChange={(e) => setFechaProxima(e.target.value)}
              min={format(new Date(), "yyyy-MM-dd")}
            />
          </div>

          {/* Interno / Externo */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Modalidad *
            </label>
            <div className="flex gap-3">
              {(["interno", "externo"] as ModalidadMantenimiento[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setModalidad(m)}
                  className={`flex items-center gap-2 rounded-xl border-2 px-5 py-3 text-sm font-semibold transition-all ${
                    modalidad === m
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border bg-card text-muted-foreground hover:border-muted-foreground/40"
                  }`}
                >
                  {m === "interno" ? "🏭 Interno" : "🌐 Externo"}
                </button>
              ))}
            </div>
          </div>
        </section>

        {error && (
          <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex gap-3 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/mantenimiento")}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Enviando…" : "Crear solicitud"}
          </Button>
        </div>
      </form>
    </PageLayout>
  )
}
