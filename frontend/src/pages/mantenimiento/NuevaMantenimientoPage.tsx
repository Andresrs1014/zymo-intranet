import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { useCrearMantenimiento, useTiposMantenimiento } from "@/hooks/useMantenimiento"
import { MantenimientoCamposForm } from "@/components/mantenimiento/MantenimientoCamposForm"
import { mntField } from "@/components/mantenimiento/mntFormClasses"
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

          <MantenimientoCamposForm
            tiposOptions={tiposOptions}
            tipoMantenimiento={tipoMantenimiento}
            onTipoMantenimientoChange={setTipoMantenimiento}
            clasificacion={clasificacion}
            onClasificacionChange={setClasificacion}
            modalidad={modalidad}
            onModalidadChange={setModalidad}
            fechaProxima={fechaProxima}
            onFechaProximaChange={setFechaProxima}
            prioridad={prioridad}
            onPrioridadChange={setPrioridad}
            montoEstimado={montoEstimado}
            onMontoEstimadoChange={setMontoEstimado}
            evidenciaAntes={evidenciaAntes}
            onEvidenciaAntesChange={setEvidenciaAntes}
          />
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
