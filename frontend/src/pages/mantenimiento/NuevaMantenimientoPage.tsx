import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Combobox } from "@/components/ui/Combobox"
import { useCrearMantenimiento, useTiposMantenimiento } from "@/hooks/useMantenimiento"
import { FotoEvidenciaField } from "@/components/mantenimiento/FotoEvidenciaField"
import { MntSegmentedControl } from "@/components/mantenimiento/MntSegmentedControl"
import { mntField, mntFieldMono } from "@/components/mantenimiento/mntFormClasses"
import { useAuthStore } from "@/store/authStore"
import type { ClasificacionMantenimiento, ModalidadMantenimiento, PrioridadMantenimiento } from "@/types/mantenimiento"
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
  const [prioridad, setPrioridad]                 = useState<PrioridadMantenimiento>("media")
  const [montoEstimado, setMontoEstimado]         = useState("")
  const [fechaProxima, setFechaProxima]           = useState("")
  const [evidenciaAntes, setEvidenciaAntes]       = useState<string | null>(null)
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
    if (modalidad === "externo" && !evidenciaAntes) {
      return setError("El mantenimiento externo requiere foto de evidencia inicial (antes del servicio).")
    }

    try {
      const monto = montoEstimado.trim()
        ? Number(montoEstimado.replace(/\./g, "").replace(",", "."))
        : null
      const sol = await mutateAsync({
        titulo:                      titulo.trim(),
        descripcion:                 descripcion.trim(),
        tipo_mantenimiento:          tipoMantenimiento,
        clasificacion,
        modalidad,
        fecha_proxima_mantenimiento: clasificacion === "preventivo" ? fechaProxima : null,
        prioridad,
        monto_estimado:              monto,
        evidencia_antes_url:         modalidad === "externo" ? evidenciaAntes : null,
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
            <label htmlFor="mnt-titulo" className="block text-sm font-medium text-foreground mb-1">Título *</label>
            <input
              id="mnt-titulo"
              name="titulo"
              type="text"
              autoComplete="off"
              className={mntField}
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ej: Falla en panel eléctrico galpón 2"
            />
          </div>

          <div>
            <label htmlFor="mnt-descripcion" className="block text-sm font-medium text-foreground mb-1">Descripción *</label>
            <textarea
              id="mnt-descripcion"
              name="descripcion"
              rows={4}
              className={`${mntField} resize-none`}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Describe el problema o el mantenimiento requerido con el mayor detalle posible…"
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

          <div>
            <span className="block text-sm font-medium text-foreground mb-2" id="mnt-clasificacion-label">
              Clasificación *
            </span>
            <MntSegmentedControl
              name="Clasificación"
              value={clasificacion}
              onChange={(c) => {
                setClasificacion(c)
                if (c === "correctivo") setFechaProxima("")
              }}
              options={[
                { value: "correctivo", label: "Correctivo", activeClass: "border-red-500 bg-red-50 text-red-700" },
                { value: "preventivo", label: "Preventivo", activeClass: "border-emerald-500 bg-emerald-50 text-emerald-700" },
              ]}
            />
          </div>

          {/* Fecha próxima — solo visible si preventivo */}
          <div
            className={`overflow-hidden transition-[max-height,opacity] duration-200 motion-reduce:transition-none ${
              clasificacion === "preventivo" ? "max-h-24 opacity-100" : "max-h-0 opacity-0"
            }`}
          >
            <label htmlFor="mnt-fecha-proxima" className="block text-sm font-medium text-foreground mb-1">
              Fecha próximo mantenimiento preventivo *
            </label>
            <input
              id="mnt-fecha-proxima"
              name="fecha_proxima"
              type="date"
              className={`${mntField} max-w-xs`}
              value={fechaProxima}
              onChange={(e) => setFechaProxima(e.target.value)}
              min={format(new Date(), "yyyy-MM-dd")}
            />
          </div>

          <div>
            <span className="block text-sm font-medium text-foreground mb-2" id="mnt-modalidad-label">
              Modalidad *
            </span>
            <MntSegmentedControl
              name="Modalidad"
              value={modalidad}
              onChange={setModalidad}
              options={[
                { value: "interno", label: "Interno" },
                { value: "externo", label: "Externo", activeClass: "border-amber-500 bg-amber-500/10 text-amber-700" },
              ]}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="mnt-prioridad" className="block text-sm font-medium text-foreground mb-1">
                Prioridad
              </label>
              <select
                id="mnt-prioridad"
                name="prioridad"
                value={prioridad}
                onChange={(e) => setPrioridad(e.target.value as PrioridadMantenimiento)}
                className={mntField}
              >
                <option value="baja">Baja</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>
            <div>
              <label htmlFor="mnt-monto" className="block text-sm font-medium text-foreground mb-1">
                Monto estimado (COP)
              </label>
              <input
                id="mnt-monto"
                name="monto_estimado"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={montoEstimado}
                onChange={(e) => setMontoEstimado(e.target.value)}
                placeholder="Opcional"
                className={mntFieldMono}
              />
            </div>
          </div>

          {modalidad === "externo" && (
            <FotoEvidenciaField
              label="Foto evidencia inicial (antes del servicio)"
              hint="Requerida para mantenimiento externo — estado previo al proveedor."
              required
              valuePreview={evidenciaAntes}
              onChange={setEvidenciaAntes}
            />
          )}
        </section>

        {error && (
          <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2" role="alert">
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
