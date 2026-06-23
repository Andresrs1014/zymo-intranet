import { useState } from "react"
import { Button } from "@/components/ui/button"
import { mntFieldAmber } from "@/components/mantenimiento/mntFormClasses"

interface Props {
  open: boolean
  onClose: () => void
  onConfirm: (payload: { motivo: string; evidencia_url?: string }) => Promise<void>
  loading?: boolean
}

export function EscalarExternoModal({ open, onClose, onConfirm, loading }: Props) {
  const [motivo, setMotivo] = useState("")
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!motivo.trim()) {
      setError("Describe el motivo del escalamiento.")
      return
    }
    setError(null)

    const input = document.createElement("input")
    input.type = "file"
    input.accept = "image/*"
    input.setAttribute("capture", "environment")

    input.onchange = async () => {
      const file = input.files?.[0]
      let evidencia_url: string | undefined
      if (file) {
        evidencia_url = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = () => reject(new Error("No se pudo leer la imagen"))
          reader.readAsDataURL(file)
        })
      }
      await onConfirm({ motivo: motivo.trim(), evidencia_url })
      setMotivo("")
      onClose()
    }

    if (confirm("¿Adjuntar foto del estado actual antes de escalar? (Cancelar = sin foto)")) {
      input.click()
    } else {
      await onConfirm({ motivo: motivo.trim() })
      setMotivo("")
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4 overscroll-contain">
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="w-full max-w-md rounded-xl bg-card border border-border shadow-xl p-5 space-y-4 overscroll-contain"
        role="dialog"
        aria-labelledby="escalar-externo-title"
      >
        <div>
          <h3 id="escalar-externo-title" className="text-base font-semibold text-foreground">Escalar a mantenimiento externo</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Se creará el par MNT ↔ OC servicio y compras tomará la coordinación.
          </p>
        </div>
        <div>
          <label htmlFor="escalar-motivo" className="text-xs text-muted-foreground block mb-1">Motivo *</label>
          <textarea
            id="escalar-motivo"
            name="motivo"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={4}
            className={`${mntFieldAmber} resize-none`}
            placeholder="Ej. Requiere proveedor especializado / repuesto no disponible en bodega…"
          />
        </div>
        {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
        <div className="flex gap-2">
          <Button type="submit" disabled={loading} className="flex-1 bg-amber-600 hover:bg-amber-500">
            {loading ? "Escalando…" : "Confirmar escalamiento"}
          </Button>
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  )
}
