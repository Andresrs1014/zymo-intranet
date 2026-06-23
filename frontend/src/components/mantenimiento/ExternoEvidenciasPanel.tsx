import { FotoEvidenciaField } from "@/components/mantenimiento/FotoEvidenciaField"
import { mntImgPreview } from "@/components/mantenimiento/mntFormClasses"
import { useSubirEvidenciaExterna } from "@/hooks/useMantenimiento"
import type { SolicitudMantenimiento } from "@/types/mantenimiento"

const FASE_LABELS: Record<string, string> = {
  sin_antes: "Falta foto inicial",
  en_proveedor: "En proveedor — pendiente foto final",
  evidencia_completa: "Evidencia completa",
}

interface Props {
  sol: SolicitudMantenimiento
  puedeSubir: boolean
}

export function ExternoEvidenciasPanel({ sol, puedeSubir }: Props) {
  const subir = useSubirEvidenciaExterna()
  const fase = sol.fase_externo ?? "sin_antes"

  if (sol.modalidad !== "externo") return null

  return (
    <div className="mb-6 rounded-xl border border-orange-500/30 bg-orange-500/5 px-4 py-4 space-y-4">
      <div>
        <p className="text-xs font-semibold text-orange-600 uppercase tracking-wide">
          Evidencia externo (antes / después)
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Estado: {FASE_LABELS[fase] ?? fase}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-medium text-foreground mb-2">Antes del servicio</p>
          {sol.evidencia_antes_url ? (
            <img
              src={sol.evidencia_antes_url}
              alt="Evidencia antes del servicio"
              width={320}
              height={144}
              loading="lazy"
              className={`${mntImgPreview} max-h-36 w-full`}
            />
          ) : (
            <p className="text-xs text-muted-foreground">Sin foto inicial</p>
          )}
          {puedeSubir && !sol.evidencia_antes_url && (
            <div className="mt-2">
              <FotoEvidenciaField
                label="Subir foto antes"
                onChange={(url) => {
                  if (!url) return
                  void subir.mutateAsync({
                    id: sol.id,
                    tipo: "antes",
                    evidencia_url: url,
                  })
                }}
              />
            </div>
          )}
        </div>

        <div>
          <p className="text-xs font-medium text-foreground mb-2">Después del servicio</p>
          {sol.evidencia_despues_url ? (
            <img
              src={sol.evidencia_despues_url}
              alt="Evidencia después del servicio"
              width={320}
              height={144}
              loading="lazy"
              className={`${mntImgPreview} max-h-36 w-full`}
            />
          ) : (
            <p className="text-xs text-muted-foreground">Pendiente — auxiliar o compras tras el proveedor</p>
          )}
          {puedeSubir && !sol.evidencia_despues_url && sol.evidencia_antes_url && (
            <div className="mt-2">
              <FotoEvidenciaField
                label="Subir foto después"
                hint="Requerida para marcar como completado"
                onChange={(url) => {
                  if (!url) return
                  void subir.mutateAsync({
                    id: sol.id,
                    tipo: "despues",
                    evidencia_url: url,
                  })
                }}
              />
            </div>
          )}
        </div>
      </div>

      {subir.isPending && (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          Subiendo evidencia…
        </p>
      )}
    </div>
  )
}
