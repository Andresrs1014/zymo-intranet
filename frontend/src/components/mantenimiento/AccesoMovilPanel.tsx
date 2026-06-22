import { useRef, useState } from "react"
import { QRCodeSVG } from "qrcode.react"
import { Button } from "@/components/ui/button"
import {
  useAccesoMovil,
  useRegenerarAccesoMovil,
} from "@/hooks/useMantenimiento"
import type { EstadoMantenimiento } from "@/types/mantenimiento"

const ESTADOS_ACCESO: EstadoMantenimiento[] = [
  "solicitud", "programado", "ejecucion",
]

interface Props {
  solicitudId: number
  consecutivo: string
  estado: EstadoMantenimiento
}

export function AccesoMovilPanel({ solicitudId, consecutivo, estado }: Props) {
  const qrRef = useRef<HTMLDivElement>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const visible = ESTADOS_ACCESO.includes(estado)

  const { data, isLoading, refetch } = useAccesoMovil(visible ? solicitudId : null)
  const { mutateAsync: regenerar, isPending: regenerando } = useRegenerarAccesoMovil()

  if (!visible) return null

  function flash(text: string) {
    setMsg(text)
    setTimeout(() => setMsg(null), 3500)
  }

  async function handleCopiar() {
    if (!data?.url_qr) return
    await navigator.clipboard.writeText(data.url_qr)
    flash("Link copiado")
  }

  function handleWhatsApp() {
    if (!data?.whatsapp_numero) {
      flash("Configura el número en OC → Configuración → Mantenimiento")
      return
    }
    const url = `https://wa.me/${data.whatsapp_numero}?text=${encodeURIComponent(data.mensaje_whatsapp)}`
    window.open(url, "_blank", "noopener,noreferrer")
  }

  async function handleRegenerar() {
    await regenerar(solicitudId)
    await refetch()
    flash("QR regenerado — el anterior ya no funciona")
  }

  function handleDescargar() {
    const svg = qrRef.current?.querySelector("svg")
    if (!svg || !data?.url_qr) return
    const xml = new XMLSerializer().serializeToString(svg)
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement("canvas")
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext("2d")
      if (!ctx) return
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0)
      const a = document.createElement("a")
      a.download = `${consecutivo}-qr.png`
      a.href = canvas.toDataURL("image/png")
      a.click()
    }
    img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(xml)))}`
  }

  return (
    <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-4">
      <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-3">
        Portal móvil del auxiliar — link permanente (no expira)
      </p>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Generando acceso…</p>
      )}

      {data && (
        <div className="flex flex-col sm:flex-row gap-4 items-start">
          <div
            ref={qrRef}
            className="rounded-lg bg-white p-3 shadow-sm shrink-0 transition-transform hover:scale-[1.02]"
          >
            <QRCodeSVG value={data.url_qr} size={160} level="M" />
          </div>

          <div className="flex-1 space-y-3 min-w-0">
            <p className="font-mono text-sm text-foreground">{consecutivo}</p>
            <p className="text-xs text-muted-foreground break-all">{data.url_qr}</p>
            {data.url_portal && (
              <p className="text-xs text-emerald-700">
                Portal personal del auxiliar — válido indefinidamente
              </p>
            )}
            {data.expira && (
              <p className="text-xs text-amber-700">
                Asigna un auxiliar para obtener portal permanente
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => void handleCopiar()}>
                Copiar link
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-[#25D366] hover:bg-[#1da851] text-white"
                onClick={handleWhatsApp}
                disabled={!data.whatsapp_numero}
              >
                Enviar WhatsApp
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={handleDescargar}>
                Descargar QR
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-muted-foreground"
                disabled={regenerando}
                onClick={() => void handleRegenerar()}
              >
                {regenerando ? "…" : "Regenerar link solicitud"}
              </Button>
            </div>

            {!data.whatsapp_numero && (
              <p className="text-xs text-amber-700">
                Sin número WhatsApp configurado — ve a OC Configuración → Mantenimiento.
              </p>
            )}
            {msg && <p className="text-xs text-emerald-600">{msg}</p>}
          </div>
        </div>
      )}
    </div>
  )
}
