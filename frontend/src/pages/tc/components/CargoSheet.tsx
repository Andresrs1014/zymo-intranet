import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from "@/components/ui/sheet"
import { ShimmerButton } from "@/components/ui/shimmer-button"
import { Trash2, Loader2, Building2 } from "lucide-react"

export interface CargoConfig {
  id: number
  nombre: string
  area_id: number | null
  sede_ids: number[]
}

interface AreaOpt { id: number; name: string }
interface SedeOpt { id: number; name: string }

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  sedeIdActual: number
  areas: AreaOpt[]
  sedes: SedeOpt[]
  /** null/undefined = crear cargo nuevo, ya viene con la sede actual pre-marcada. */
  cargo?: CargoConfig | null
  onSaved: () => void
}

export function CargoSheet({ open, onOpenChange, sedeIdActual, areas, sedes, cargo, onSaved }: Props) {
  const editando = !!cargo
  const [nombre, setNombre] = useState("")
  const [areaId, setAreaId] = useState<string>("")
  const [sedeIds, setSedeIds] = useState<number[]>([])
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [confirmarEliminar, setConfirmarEliminar] = useState(false)

  useEffect(() => {
    if (!open) return
    setNombre(cargo?.nombre ?? "")
    setAreaId(cargo?.area_id != null ? String(cargo.area_id) : "")
    setSedeIds(cargo?.sede_ids ?? [sedeIdActual])
    setError("")
    setConfirmarEliminar(false)
  }, [open, cargo, sedeIdActual])

  function toggleSede(id: number) {
    setSedeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const esTransversal = sedes.length > 1 && sedeIds.length === sedes.length

  async function guardar() {
    if (!nombre.trim()) { setError("El nombre es obligatorio."); return }
    if (sedeIds.length === 0) { setError("Selecciona al menos una sede."); return }
    setPending(true)
    setError("")
    const body = { nombre: nombre.trim(), area_id: areaId ? Number(areaId) : null, sede_ids: sedeIds }
    try {
      if (editando) {
        await api.put(`/tc/cargos/${cargo!.id}`, body)
      } else {
        await api.post("/tc/cargos", body)
      }
      onOpenChange(false)
      onSaved()
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "No se pudo guardar el cargo.")
    } finally {
      setPending(false)
    }
  }

  async function eliminar() {
    if (!cargo) return
    setPending(true)
    setError("")
    try {
      await api.delete(`/tc/cargos/${cargo.id}`)
      onOpenChange(false)
      onSaved()
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "No se pudo eliminar el cargo.")
      setConfirmarEliminar(false)
    } finally {
      setPending(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="border-border bg-card w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle>{editando ? "Editar cargo" : "Nuevo cargo"}</SheetTitle>
          <SheetDescription>
            El área es un catálogo compartido — lo que configuras acá es en qué sede(s) existe este cargo.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto space-y-5 py-5">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Nombre del cargo</label>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Coordinador de Operaciones"
              className="w-full h-10 px-3 rounded-lg border border-border bg-background/60 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Área</label>
            <select
              value={areaId}
              onChange={(e) => setAreaId(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-border bg-background/60 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Sin área</option>
              {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">¿En qué sede(s) existe?</label>
              {esTransversal && (
                <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-400">
                  <Building2 className="w-2.5 h-2.5" />
                  Transversal
                </span>
              )}
            </div>
            <div className="space-y-1.5">
              {sedes.map((s) => (
                <label
                  key={s.id}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                    sedeIds.includes(s.id) ? "border-teal-500/40 bg-teal-500/5" : "border-border hover:bg-muted/10"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={sedeIds.includes(s.id)}
                    onChange={() => toggleSede(s.id)}
                    className="w-4 h-4 accent-teal-500"
                  />
                  <span className="text-sm">{s.name}</span>
                  {s.id === sedeIdActual && (
                    <span className="text-[10px] text-muted-foreground ml-auto">esta empresa</span>
                  )}
                </label>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              {sedeIds.length <= 1
                ? "Marcado en una sola sede — exclusivo de esa empresa."
                : `Marcado en ${sedeIds.length} sedes.`}
            </p>
          </div>

          {error && <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>}
        </div>

        <SheetFooter className="border-t border-border pt-4 gap-2 sm:justify-between">
          {editando && (
            confirmarEliminar ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">¿Eliminar este cargo?</span>
                <button onClick={eliminar} disabled={pending} className="text-xs font-semibold text-rose-400 hover:text-rose-300">Sí, eliminar</button>
                <button onClick={() => setConfirmarEliminar(false)} className="text-xs text-muted-foreground hover:text-foreground">Cancelar</button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmarEliminar(true)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-rose-400 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Eliminar cargo
              </button>
            )
          )}
          <ShimmerButton onClick={guardar} disabled={pending} className="h-9 px-5 text-xs">
            {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            {pending ? "Guardando…" : "Guardar"}
          </ShimmerButton>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
