import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useAccionCampoMantenimiento } from "@/hooks/useMantenimiento"
import type { EstadoMantenimiento } from "@/types/mantenimiento"

interface Props {
  solicitudId: number
  estado: EstadoMantenimiento
  onCrearOC: () => void
  onDone?: () => void
}

export function MantenimientoCampoAcciones({
  solicitudId,
  estado,
  onCrearOC,
  onDone,
}: Props) {
  const [msg, setMsg] = useState<string | null>(null)
  const { mutateAsync: accion, isPending } = useAccionCampoMantenimiento()

  const activa = !["completado", "cancelado", "cerrado"].includes(estado)
  const puedeEnCamino = activa && ["solicitud", "programado"].includes(estado)
  const puedeCompletar = activa && estado === "ejecucion"

  if (!activa) return null

  async function run(acc: "en_camino" | "completado", extra?: { evidencia_url?: string }) {
    setMsg(null)
    await accion({ id: solicitudId, accion: acc, ...extra })
    setMsg(acc === "en_camino" ? "En camino registrado" : "Trabajo completado")
    onDone?.()
  }

  function completarConFoto() {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "image/*"
    input.setAttribute("capture", "environment")
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        void run("completado", { evidencia_url: reader.result as string })
      }
      reader.readAsDataURL(file)
    }
    input.click()
  }

  return (
    <div className="mb-6 rounded-xl border border-sky-500/30 bg-sky-500/5 px-4 py-4 space-y-3">
      <p className="text-xs font-semibold text-sky-600 uppercase tracking-wide">
        Acciones de campo
      </p>
      <div className="flex flex-col gap-2">
        {puedeEnCamino && (
          <Button
            type="button"
            disabled={isPending}
            className="w-full bg-blue-600 hover:bg-blue-700"
            onClick={() => void run("en_camino")}
          >
            Voy en camino
          </Button>
        )}
        {puedeCompletar && (
          <Button
            type="button"
            disabled={isPending}
            className="w-full bg-emerald-600 hover:bg-emerald-700"
            onClick={completarConFoto}
          >
            Terminé — subir foto
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          className="w-full border-amber-500/50 text-amber-700"
          onClick={onCrearOC}
        >
          Solicitar compra / repuesto
        </Button>
      </div>
      {msg && <p className="text-xs text-emerald-600">{msg}</p>}
    </div>
  )
}
