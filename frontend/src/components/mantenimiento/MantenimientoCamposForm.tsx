import { format } from "date-fns"
import { Combobox } from "@/components/ui/Combobox"
import { MntSegmentedControl } from "@/components/mantenimiento/MntSegmentedControl"
import { FotoEvidenciaField } from "@/components/mantenimiento/FotoEvidenciaField"
import { mntField, mntFieldMono } from "@/components/mantenimiento/mntFormClasses"
import type { ClasificacionMantenimiento, ModalidadMantenimiento, PrioridadMantenimiento } from "@/types/mantenimiento"

type Option = { value: string; label: string }

interface MantenimientoCamposFormProps {
  tiposOptions: Option[]
  tipoMantenimiento: string
  onTipoMantenimientoChange: (v: string) => void
  clasificacion: ClasificacionMantenimiento
  onClasificacionChange: (v: ClasificacionMantenimiento) => void
  modalidad: ModalidadMantenimiento
  onModalidadChange: (v: ModalidadMantenimiento) => void
  fechaProxima: string
  onFechaProximaChange: (v: string) => void
  prioridad: PrioridadMantenimiento
  onPrioridadChange: (v: PrioridadMantenimiento) => void
  montoEstimado: string
  onMontoEstimadoChange: (v: string) => void
  evidenciaAntes: string | null
  onEvidenciaAntesChange: (v: string | null) => void
}

/**
 * Campos compartidos entre NuevaMantenimientoPage (Administrativo) y
 * NuevaSolicitudPage (Operativo) — antes duplicados con estilos distintos,
 * lo que dejó prioridad/monto_estimado ausentes en el formulario de Operativo.
 */
export function MantenimientoCamposForm({
  tiposOptions,
  tipoMantenimiento,
  onTipoMantenimientoChange,
  clasificacion,
  onClasificacionChange,
  modalidad,
  onModalidadChange,
  fechaProxima,
  onFechaProximaChange,
  prioridad,
  onPrioridadChange,
  montoEstimado,
  onMontoEstimadoChange,
  evidenciaAntes,
  onEvidenciaAntesChange,
}: MantenimientoCamposFormProps) {
  return (
    <>
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          Tipo de mantenimiento *
        </label>
        <Combobox
          options={tiposOptions}
          value={tipoMantenimiento || null}
          onChange={(v) => onTipoMantenimientoChange(v != null ? String(v) : "")}
          placeholder="Seleccionar tipo…"
        />
      </div>

      <div>
        <span className="block text-sm font-medium text-foreground mb-2">Clasificación *</span>
        <MntSegmentedControl
          name="Clasificación"
          value={clasificacion}
          onChange={(c) => {
            onClasificacionChange(c)
            if (c === "correctivo") onFechaProximaChange("")
          }}
          options={[
            { value: "correctivo", label: "Correctivo", activeClass: "border-red-500 bg-red-50 text-red-700" },
            { value: "preventivo", label: "Preventivo", activeClass: "border-emerald-500 bg-emerald-50 text-emerald-700" },
          ]}
        />
      </div>

      <div
        className={`overflow-hidden transition-[max-height,opacity] duration-200 motion-reduce:transition-none ${
          clasificacion === "preventivo" ? "max-h-24 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <label className="block text-sm font-medium text-foreground mb-1">
          Fecha próximo mantenimiento preventivo *
        </label>
        <input
          type="date"
          className={`${mntField} max-w-xs`}
          value={fechaProxima}
          onChange={(e) => onFechaProximaChange(e.target.value)}
          min={format(new Date(), "yyyy-MM-dd")}
        />
      </div>

      <div>
        <span className="block text-sm font-medium text-foreground mb-2">Modalidad *</span>
        <MntSegmentedControl
          name="Modalidad"
          value={modalidad}
          onChange={onModalidadChange}
          options={[
            { value: "interno", label: "Interno" },
            { value: "externo", label: "Externo", activeClass: "border-amber-500 bg-amber-500/10 text-amber-700" },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Prioridad</label>
          <select
            value={prioridad}
            onChange={(e) => onPrioridadChange(e.target.value as PrioridadMantenimiento)}
            className={mntField}
          >
            <option value="baja">Baja</option>
            <option value="media">Media</option>
            <option value="alta">Alta</option>
            <option value="urgente">Urgente</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Monto estimado (COP)</label>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={montoEstimado}
            onChange={(e) => onMontoEstimadoChange(e.target.value)}
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
          onChange={onEvidenciaAntesChange}
        />
      )}
    </>
  )
}
