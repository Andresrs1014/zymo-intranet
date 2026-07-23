import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from "@/components/ui/sheet"
import { ShimmerButton } from "@/components/ui/shimmer-button"
import { Loader2 } from "lucide-react"

interface AreaSedeRow { area_id: number; area_nombre: string; sede_ids: number[] }
interface PlataformaOpt { sede_id: number; nombre: string }

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

/**
 * Matriz área × plataforma — deja marcar en qué plataforma(s) existe cada
 * área del catálogo de una sola vez (ej. las 3 a la vez), sin tener que
 * entrar al Hub de cada empresa por separado.
 */
export function GestionarAreasSheet({ open, onOpenChange, onSaved }: Props) {
  const [filas, setFilas] = useState<AreaSedeRow[]>([])
  const [plataformas, setPlataformas] = useState<PlataformaOpt[]>([])
  const [cargando, setCargando] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    setCargando(true)
    setError("")
    Promise.all([api.get("/tc/areas-sedes"), api.get("/tc/plataformas")])
      .then(([areasRes, plataformasRes]) => {
        setFilas(areasRes.data ?? [])
        setPlataformas(
          (plataformasRes.data ?? [])
            .filter((p: { configurada: boolean }) => p.configurada)
            .map((p: { sede_id: number; nombre: string }) => ({ sede_id: p.sede_id, nombre: p.nombre })),
        )
      })
      .catch(() => setError("No se pudieron cargar las áreas."))
      .finally(() => setCargando(false))
  }, [open])

  function toggle(areaId: number, sedeId: number) {
    setFilas((prev) => prev.map((f) => {
      if (f.area_id !== areaId) return f
      const activo = f.sede_ids.includes(sedeId)
      return { ...f, sede_ids: activo ? f.sede_ids.filter((id) => id !== sedeId) : [...f.sede_ids, sedeId] }
    }))
  }

  async function guardar() {
    setPending(true)
    setError("")
    try {
      await Promise.all(filas.map((f) => api.put(`/tc/areas/${f.area_id}/sedes`, f.sede_ids)))
      onOpenChange(false)
      onSaved()
    } catch {
      setError("No se pudieron guardar los cambios.")
    } finally {
      setPending(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="border-border bg-card w-full sm:max-w-xl flex flex-col">
        <SheetHeader>
          <SheetTitle>Gestionar áreas</SheetTitle>
          <SheetDescription>
            Marca en qué plataforma(s) existe cada área — puedes activarla en las 3 de una vez,
            aunque todavía no tenga cargos cargados ahí.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-4">
          {cargando ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Cargando…</span>
            </div>
          ) : plataformas.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Configura al menos una plataforma (logo + nombre) antes de poder asignarle áreas.
            </p>
          ) : (
            <div className="space-y-1">
              <div className="flex items-center gap-2 px-3 pb-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                <span className="flex-1">Área</span>
                {plataformas.map((p) => (
                  <span key={p.sede_id} className="w-20 shrink-0 text-center truncate">{p.nombre}</span>
                ))}
              </div>
              {filas.map((f) => (
                <div key={f.area_id} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted/10 transition-colors">
                  <span className="flex-1 text-sm truncate">{f.area_nombre}</span>
                  {plataformas.map((p) => (
                    <span key={p.sede_id} className="w-20 shrink-0 flex justify-center">
                      <input
                        type="checkbox"
                        checked={f.sede_ids.includes(p.sede_id)}
                        onChange={() => toggle(f.area_id, p.sede_id)}
                        className="w-4 h-4 accent-teal-500"
                      />
                    </span>
                  ))}
                </div>
              ))}
            </div>
          )}
          {error && <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2 mt-3">{error}</p>}
        </div>

        <SheetFooter className="border-t border-border pt-4">
          <ShimmerButton onClick={guardar} disabled={pending || cargando} className="h-9 px-5 text-xs">
            {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            {pending ? "Guardando…" : "Guardar"}
          </ShimmerButton>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
