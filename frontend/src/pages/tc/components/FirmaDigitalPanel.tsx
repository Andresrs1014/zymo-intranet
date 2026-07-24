import { useRef, useState } from "react"
import { api } from "@/lib/api"
import { PenLine, Trash2, RotateCcw, Check, X } from "lucide-react"

interface Props {
  personaId: number
  firmaUrl: string
  puedeEditar: boolean
  onSaved: (firmaUrl: string) => void
}

export function FirmaDigitalPanel({ personaId, firmaUrl, puedeEditar, onSaved }: Props) {
  const [dibujando, setDibujando] = useState(false)
  const [hasTrazo, setHasTrazo] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState("")
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const trazando = useRef(false)

  function fondoBlanco(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = "#111827"
    ctx.lineWidth = 2.5
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
  }

  function abrirPad() {
    setDibujando(true)
    setHasTrazo(false)
    setError("")
    requestAnimationFrame(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext("2d")
      if (ctx) fondoBlanco(ctx, canvas)
    })
  }

  function coordsDe(e: React.PointerEvent<HTMLCanvasElement>, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    }
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    trazando.current = true
    const { x, y } = coordsDe(e, canvas)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!trazando.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const { x, y } = coordsDe(e, canvas)
    ctx.lineTo(x, y)
    ctx.stroke()
    setHasTrazo(true)
  }

  function onPointerUp() { trazando.current = false }

  function limpiar() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (ctx) fondoBlanco(ctx, canvas)
    setHasTrazo(false)
  }

  async function guardar() {
    const canvas = canvasRef.current
    if (!canvas || !hasTrazo) return
    setGuardando(true)
    setError("")
    canvas.toBlob(async (blob) => {
      if (!blob) { setGuardando(false); return }
      const fd = new FormData()
      fd.append("file", blob, "firma.png")
      try {
        await api.post(`/tc/personas/${personaId}/firma`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        })
        onSaved(`/tc-fotos/firma-${personaId}.png?t=${Date.now()}`)
        setDibujando(false)
      } catch (err) {
        const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        setError(detail || "No se pudo guardar la firma.")
      } finally {
        setGuardando(false)
      }
    }, "image/png")
  }

  async function eliminar() {
    if (!confirm("¿Eliminar la firma digital?")) return
    try {
      await api.delete(`/tc/personas/${personaId}/firma`)
      onSaved("")
    } catch { setError("No se pudo eliminar la firma.") }
  }

  if (dibujando) {
    return (
      <div className="space-y-2">
        <canvas
          ref={canvasRef}
          width={480}
          height={160}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          className="w-full max-w-md rounded-lg border border-border touch-none cursor-crosshair"
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex items-center gap-2">
          <button onClick={limpiar} className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-input rounded-md hover:bg-accent transition-colors">
            <RotateCcw className="w-3.5 h-3.5" /> Limpiar
          </button>
          <button onClick={() => setDibujando(false)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-input rounded-md hover:bg-accent transition-colors">
            <X className="w-3.5 h-3.5" /> Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={!hasTrazo || guardando}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-teal-500/15 text-teal-400 rounded-md hover:bg-teal-500/25 transition-colors disabled:opacity-40"
          >
            <Check className="w-3.5 h-3.5" /> {guardando ? "Guardando…" : "Guardar firma"}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {firmaUrl ? (
        <div className="inline-flex flex-col gap-2">
          <img src={firmaUrl} alt="Firma digital" className="h-20 rounded-lg border border-border bg-white px-3" />
          {puedeEditar && (
            <div className="flex items-center gap-2">
              <button onClick={abrirPad} className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-input rounded-md hover:bg-accent transition-colors">
                <PenLine className="w-3.5 h-3.5" /> Volver a firmar
              </button>
              <button onClick={eliminar} className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-input rounded-md hover:bg-destructive/10 hover:text-destructive transition-colors">
                <Trash2 className="w-3.5 h-3.5" /> Eliminar
              </button>
            </div>
          )}
        </div>
      ) : puedeEditar ? (
        <button onClick={abrirPad} className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-dashed border-input rounded-md hover:bg-accent transition-colors text-muted-foreground">
          <PenLine className="w-3.5 h-3.5" /> Dibujar firma
        </button>
      ) : (
        <p className="text-sm text-muted-foreground">Sin firma registrada.</p>
      )}
    </div>
  )
}
