import { useState } from "react"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { mntField } from "@/components/mantenimiento/mntFormClasses"
import { useCrearOCVinculada } from "@/hooks/useMantenimiento"
import type { SolicitudMantenimiento } from "@/types/mantenimiento"

interface Props {
  open:          boolean
  onClose:       () => void
  mantenimiento: SolicitudMantenimiento
}

export function CrearOCVinculadaModal({ open, onClose, mantenimiento }: Props) {
  const [descripcion, setDescripcion] = useState(
    `Mantenimiento ${mantenimiento.consecutivo} — ${mantenimiento.titulo}`
  )
  const [categoria, setCategoria] = useState("")
  const [prioridad, setPrioridad] = useState("Media")
  const [obs, setObs]             = useState("")
  const [error, setError]         = useState<string | null>(null)

  const { mutateAsync, isPending } = useCrearOCVinculada()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!descripcion.trim()) {
      setError("La descripción es requerida.")
      return
    }
    try {
      await mutateAsync({
        mantenimientoId: mantenimiento.id,
        payload: {
          descripcion: descripcion.trim(),
          categoria: categoria.trim() || undefined,
          nivel_prioridad: prioridad,
          observaciones_solicitante: obs.trim() || undefined,
        },
      })
      onClose()
    } catch {
      setError("Error al crear la solicitud de compra. Intenta de nuevo.")
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-full max-w-lg overscroll-contain">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            Nueva solicitud de compra
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Vinculada a {mantenimiento.consecutivo}
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-1">
          <div>
            <label htmlFor="oc-vinc-desc" className="block text-sm font-medium text-foreground mb-1">
              Descripción *
            </label>
            <textarea
              id="oc-vinc-desc"
              name="descripcion"
              rows={3}
              className={`${mntField} resize-none`}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="oc-vinc-categoria" className="block text-sm font-medium text-foreground mb-1">
                Categoría
              </label>
              <input
                id="oc-vinc-categoria"
                name="categoria"
                type="text"
                autoComplete="off"
                className={mntField}
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                placeholder="Ej: Repuestos"
              />
            </div>

            <div>
              <label htmlFor="oc-vinc-prioridad" className="block text-sm font-medium text-foreground mb-1">
                Prioridad
              </label>
              <select
                id="oc-vinc-prioridad"
                name="prioridad"
                className={mntField}
                value={prioridad}
                onChange={(e) => setPrioridad(e.target.value)}
              >
                <option value="Alta">Alta</option>
                <option value="Media">Media</option>
                <option value="Baja">Baja</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="oc-vinc-obs" className="block text-sm font-medium text-foreground mb-1">
              Observaciones
            </label>
            <textarea
              id="oc-vinc-obs"
              name="observaciones"
              rows={2}
              className={`${mntField} resize-none`}
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Contexto adicional para el área de compras…"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2" role="alert">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creando…" : "Crear solicitud de compra"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
