import { useState } from "react"
import { Link } from "react-router-dom"
import { ArrowRight, Link2, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  useAsignarParExterno,
  useAuxiliaresMantenimiento,
  useParExterno,
} from "@/hooks/useMantenimiento"
import { useAuthStore } from "@/store/authStore"
import { canSeeOC } from "@/lib/permissions"
import type { SolicitudMantenimiento } from "@/types/mantenimiento"

interface Props {
  sol: SolicitudMantenimiento
}

export function ParExternoPanel({ sol }: Props) {
  const user = useAuthStore((s) => s.user)
  const esCompras = user ? canSeeOC(user.role, user.area, user.app_permissions) : false
  const { data: par, isLoading } = useParExterno(sol.modalidad === "externo" ? sol.id : null)
  const { data: auxiliares = [] } = useAuxiliaresMantenimiento()
  const asignarPar = useAsignarParExterno()
  const [auxMntId, setAuxMntId] = useState("")
  const [msg, setMsg] = useState<string | null>(null)

  if (sol.modalidad !== "externo") return null
  if (isLoading) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-muted-foreground">
        Cargando par externo…
      </div>
    )
  }

  const pendiente = !par?.coordinador_compras_id
  const oc = par?.oc

  async function handleTomarPar() {
    if (!user) return
    setMsg(null)
    await asignarPar.mutateAsync({
      mantenimientoId: sol.id,
      payload: { coordinador_compras_id: user.id },
    })
    setMsg("Par tomado — coordinación asignada a ti.")
  }

  async function handleAsignarAuxiliar() {
    setMsg(null)
    await asignarPar.mutateAsync({
      mantenimientoId: sol.id,
      payload: {
        asignado_mantenimiento_id: auxMntId ? Number(auxMntId) : undefined,
      },
    })
    setMsg("Auxiliar de mantenimiento asignado.")
  }

  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-4 space-y-3">
      <div className="flex items-start gap-3">
        <Link2 className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" aria-hidden />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Par externo MNT ↔ OC</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Mantenimiento externo gestionado por compras. La asignación en OC y MNT queda acoplada.
          </p>
        </div>
      </div>

      {oc ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-mono text-xs bg-background/80 border border-border px-2 py-1 rounded">
            {oc.consecutivo_os}
          </span>
          <span className="text-xs text-muted-foreground capitalize">{oc.estado.replace(/_/g, " ")}</span>
          <Link
            to={`/oc/solicitudes/${oc.id}`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 hover:text-amber-500 transition-colors"
          >
            Ver solicitud OC
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">OC servicio pendiente de creación.</p>
      )}

      {par?.coordinador_compras_id && sol.coordinador_compras_nombre && (
        <p className="text-xs text-muted-foreground">
          Coordinador compras: <span className="text-foreground font-medium">{sol.coordinador_compras_nombre}</span>
        </p>
      )}

      {esCompras && pendiente && (
        <Button
          size="sm"
          className="gap-1.5 bg-amber-600 hover:bg-amber-500 text-white"
          onClick={handleTomarPar}
          disabled={asignarPar.isPending}
        >
          <UserPlus className="w-4 h-4" aria-hidden />
          Tomar par (asignarme como coordinador)
        </Button>
      )}

      {esCompras && !pendiente && (
        <div className="flex flex-wrap items-end gap-2 pt-1">
          <div>
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground block mb-1">
              Auxiliar mantenimiento
            </label>
            <select
              value={auxMntId || (sol.asignado_id != null ? String(sol.asignado_id) : "")}
              onChange={(e) => setAuxMntId(e.target.value)}
              aria-label="Auxiliar de mantenimiento"
              className="text-xs border border-border rounded-md px-2 py-1.5 bg-background min-w-[180px] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
            >
              <option value="">Sin asignar</option>
              {auxiliares.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.full_name}
                </option>
              ))}
            </select>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleAsignarAuxiliar}
            disabled={asignarPar.isPending}
          >
            Asignar auxiliar
          </Button>
        </div>
      )}

      {msg && <p className="text-xs text-emerald-600" aria-live="polite">{msg}</p>}
    </div>
  )
}
