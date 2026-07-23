import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from "@/components/ui/sheet"
import { ShimmerButton } from "@/components/ui/shimmer-button"
import { Loader2, Upload, Trash2, Building2 } from "lucide-react"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  sedeId: number
  sedeNombre: string
  nombreActual: string
  logoActual: string
  configurada: boolean
  onSaved: () => void
}

export function PlataformaConfigSheet({
  open, onOpenChange, sedeId, sedeNombre, nombreActual, logoActual, configurada, onSaved,
}: Props) {
  const [nombre, setNombre] = useState("")
  const [logoPreview, setLogoPreview] = useState("")
  const [archivo, setArchivo] = useState<File | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [confirmarQuitar, setConfirmarQuitar] = useState(false)

  useEffect(() => {
    if (!open) return
    setNombre(configurada ? nombreActual : sedeNombre)
    setLogoPreview(logoActual)
    setArchivo(null)
    setError("")
    setConfirmarQuitar(false)
  }, [open, sedeId, configurada, nombreActual, logoActual, sedeNombre])

  function elegirArchivo(file: File) {
    setArchivo(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  async function guardar() {
    if (!nombre.trim()) { setError("El nombre es obligatorio."); return }
    setPending(true)
    setError("")
    try {
      await api.put(`/tc/plataformas/${sedeId}`, { nombre: nombre.trim() })
      if (archivo) {
        const fd = new FormData()
        fd.append("file", archivo)
        await api.post(`/tc/plataformas/${sedeId}/logo`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        })
      }
      onOpenChange(false)
      onSaved()
    } catch {
      setError("No se pudo guardar el perfil de la plataforma.")
    } finally {
      setPending(false)
    }
  }

  async function quitar() {
    setPending(true)
    setError("")
    try {
      await api.delete(`/tc/plataformas/${sedeId}`)
      onOpenChange(false)
      onSaved()
    } catch {
      setError("No se pudo quitar la plataforma.")
    } finally {
      setPending(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="border-border bg-card w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle>{configurada ? "Editar plataforma" : "Configurar plataforma"}</SheetTitle>
          <SheetDescription>
            Sede: {sedeNombre}. El logo y el nombre son solo de presentación — la sede en sí ya existe
            en Admin → Áreas y Sedes.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-5 space-y-5">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">
              Logo
            </label>
            <div className="flex items-center gap-3">
              <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-white">
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo" className="h-[82%] w-[82%] object-contain" />
                ) : (
                  <Building2 className="w-6 h-6 text-muted-foreground/40" />
                )}
              </span>
              <label className="flex items-center gap-1.5 h-9 px-3 text-xs rounded-lg border border-dashed border-border text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
                <Upload className="w-3.5 h-3.5" />
                Subir logo
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && elegirArchivo(e.target.files[0])}
                />
              </label>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">
              Nombre de la plataforma
            </label>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. ZYMOLOGI"
              className="w-full h-10 px-3 rounded-lg border border-border bg-background/60 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {error && <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>}
        </div>

        <SheetFooter className="border-t border-border pt-4 gap-2 sm:justify-between">
          {configurada && (
            confirmarQuitar ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">¿Quitar esta plataforma?</span>
                <button onClick={quitar} disabled={pending} className="text-xs font-semibold text-rose-400 hover:text-rose-300">Sí, quitar</button>
                <button onClick={() => setConfirmarQuitar(false)} className="text-xs text-muted-foreground hover:text-foreground">Cancelar</button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmarQuitar(true)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-rose-400 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Quitar plataforma
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
