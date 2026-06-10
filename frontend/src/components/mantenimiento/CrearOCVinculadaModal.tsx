import { useState } from "react"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
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
      <DialogContent className="w-full max-w-lg">
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
            <label className="block text-sm font-medium text-foreground mb-1">
              Descripción *
            </label>
            <textarea
              rows={3}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Categoría
              </label>
              <input
                type="text"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                placeholder="Ej: Repuestos"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Prioridad
              </label>
              <select
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
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
            <label className="block text-sm font-medium text-foreground mb-1">
              Observaciones
            </label>
            <textarea
              rows={2}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Contexto adicional para el área de compras..."
            />
          </div>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
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
