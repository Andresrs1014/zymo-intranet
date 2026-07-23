import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from "@/components/ui/sheet"
import { ShimmerButton } from "@/components/ui/shimmer-button"
import { Loader2 } from "lucide-react"

interface AreaOpt { id: number; name: string }

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  sedeId: number
  areas: AreaOpt[]
  onSaved: () => void
}

export function GestionarAreasSheet({ open, onOpenChange, sedeId, areas, onSaved }: Props) {
  const [seleccionadas, setSeleccionadas] = useState<number[]>([])
  const [cargando, setCargando] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    setCargando(true)
    setError("")
    api.get(`/tc/empresa/${sedeId}/areas-activas`)
      .then((r) => setSeleccionadas(r.data.area_ids ?? []))
      .catch(() => setError("No se pudieron cargar las áreas activas."))
      .finally(() => setCargando(false))
  }, [open, sedeId])

  function toggle(id: number) {
    setSeleccionadas((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  async function guardar() {
    setPending(true)
    setError("")
    try {
      await api.put(`/tc/empresa/${sedeId}/areas`, seleccionadas)
      onOpenChange(false)
      onSaved()
    } catch {
      setError("No se pudieron guardar las áreas.")
    } finally {
      setPending(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="border-border bg-card w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle>Gestionar áreas</SheetTitle>
          <SheetDescription>
            Marca qué áreas del catálogo tiene esta plataforma. Puedes dejar un área activa aunque
            todavía no le hayas cargado ningún cargo.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-4">
          {cargando ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Cargando…</span>
            </div>
          ) : (
            <div className="space-y-1.5">
              {areas.map((a) => (
                <label
                  key={a.id}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                    seleccionadas.includes(a.id) ? "border-teal-500/40 bg-teal-500/5" : "border-border hover:bg-muted/10"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={seleccionadas.includes(a.id)}
                    onChange={() => toggle(a.id)}
                    className="w-4 h-4 accent-teal-500"
                  />
                  <span className="text-sm">{a.name}</span>
                </label>
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
