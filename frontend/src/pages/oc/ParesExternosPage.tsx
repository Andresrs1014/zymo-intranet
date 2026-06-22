import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { ArrowRight, Link2, RefreshCw } from "lucide-react"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { EstadoMantenimientoBadge } from "@/components/mantenimiento/EstadoMantenimientoBadge"
import {
  useAsignarParExterno,
  useMisParesExternos,
  useParesExternos,
} from "@/hooks/useMantenimiento"
import { useAuthStore } from "@/store/authStore"
import type { EstadoMantenimiento, ParExterno } from "@/types/mantenimiento"

type Tab = "pendientes" | "mios"

export default function ParesExternosPage() {
  const [tab, setTab] = useState<Tab>("pendientes")
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const asignarPar = useAsignarParExterno()

  const { data: pendientes = [], isLoading: loadingP, refetch: refetchP } = useParesExternos(true)
  const { data: mios = [], isLoading: loadingM, refetch: refetchM } = useMisParesExternos()

  const items = tab === "pendientes" ? pendientes : mios
  const loading = tab === "pendientes" ? loadingP : loadingM

  async function tomarPar(par: ParExterno) {
    if (!user) return
    await asignarPar.mutateAsync({
      mantenimientoId: par.mantenimiento_id,
      payload: { coordinador_compras_id: user.id },
    })
    setTab("mios")
    refetchP()
    refetchM()
  }

  return (
    <PageLayout title="Externos de mantenimiento">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="h-6 w-1 rounded-full bg-amber-500" />
            <h2 className="text-xl font-bold text-foreground">Pares externos MNT ↔ OC</h2>
          </div>
          <p className="pl-4 text-sm text-muted-foreground">
            Bandeja para auxiliar de compras: toma pares pendientes y coordina mantenimiento externo con su OC servicio vinculada.
          </p>
        </div>

        <div className="flex gap-2 mb-4">
          {(["pendientes", "mios"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                tab === t
                  ? "bg-amber-500/15 text-amber-600 border border-amber-500/40"
                  : "text-muted-foreground hover:text-foreground border border-transparent"
              }`}
            >
              {t === "pendientes" ? `Pendientes (${pendientes.length})` : `Mis pares (${mios.length})`}
            </button>
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto gap-1.5"
            onClick={() => { refetchP(); refetchM() }}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Actualizar
          </Button>
        </div>

        {loading && (
          <p className="text-sm text-muted-foreground py-8 text-center">Cargando…</p>
        )}

        {!loading && items.length === 0 && (
          <div className="rounded-xl border border-dashed border-border py-16 text-center">
            <Link2 className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {tab === "pendientes"
                ? "No hay pares externos pendientes de coordinación."
                : "Aún no tienes pares externos asignados."}
            </p>
          </div>
        )}

        <div className="space-y-3">
          {items.map((par) => (
            <article
              key={par.mantenimiento_id}
              className="rounded-xl border border-border bg-card p-4 hover:border-amber-500/30 transition-colors"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-mono text-xs text-muted-foreground">{par.consecutivo_mnt}</span>
                    <EstadoMantenimientoBadge estado={par.estado_mnt as EstadoMantenimiento} />
                    <span className="text-[10px] uppercase tracking-wide text-amber-600/80 font-semibold">
                      externo
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-foreground truncate">{par.titulo}</h3>
                  {par.oc && (
                    <p className="text-xs text-muted-foreground mt-1">
                      OC vinculada:{" "}
                      <Link
                        to={`/oc/solicitudes/${par.oc.id}`}
                        className="font-mono text-amber-600 hover:underline"
                      >
                        {par.oc.consecutivo_os}
                      </Link>
                      {" · "}
                      <span className="capitalize">{par.oc.estado.replace(/_/g, " ")}</span>
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 shrink-0">
                  {tab === "pendientes" && (
                    <Button
                      size="sm"
                      className="bg-amber-600 hover:bg-amber-500 text-white"
                      onClick={() => tomarPar(par)}
                      disabled={asignarPar.isPending}
                    >
                      Tomar par
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    onClick={() => navigate(`/mantenimiento/${par.mantenimiento_id}`)}
                  >
                    MNT
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                  {par.oc && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() => navigate(`/oc/solicitudes/${par.oc!.id}`)}
                    >
                      OC
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </PageLayout>
  )
}
