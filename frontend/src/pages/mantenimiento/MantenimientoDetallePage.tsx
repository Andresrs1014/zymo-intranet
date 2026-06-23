import { useState, useEffect } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, Plus, Check, ArrowRight, Circle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageLayout } from "@/components/layout/PageLayout"
import {
  EstadoMantenimientoBadge,
  ClasificacionBadge,
  ModalidadBadge,
} from "@/components/mantenimiento/EstadoMantenimientoBadge"
import { CrearOCVinculadaModal } from "@/components/mantenimiento/CrearOCVinculadaModal"
import { ParExternoPanel } from "@/components/mantenimiento/ParExternoPanel"
import { ExternoEvidenciasPanel } from "@/components/mantenimiento/ExternoEvidenciasPanel"
import { FotoEvidenciaField } from "@/components/mantenimiento/FotoEvidenciaField"
import { mntFieldAmber, mntFieldMono, mntImgPreview } from "@/components/mantenimiento/mntFormClasses"
import { AccesoMovilPanel } from "@/components/mantenimiento/AccesoMovilPanel"
import { MantenimientoCampoAcciones } from "@/components/mantenimiento/MantenimientoCampoAcciones"
import { MantenimientoMobileLayout } from "@/components/mantenimiento/MantenimientoMobileLayout"
import { useMantenimientoPortal } from "@/context/MantenimientoPortalContext"
import { EscalarExternoModal } from "@/components/mantenimiento/EscalarExternoModal"
import {
  useSolicitudMantenimiento,
  useHistorialMantenimiento,
  useOCsVinculadas,
  useCambiarEstadoMantenimiento,
  useSubirEvidencia,
  useAprobaciones,
  useProgramarMantenimiento,
  useRegistrarAprobacion,
  useEscalarExterno,
} from "@/hooks/useMantenimiento"
import { useAuthStore } from "@/store/authStore"
import { canManageMantenimiento, canOperateMantenimientoCampo, canSeeAllMantenimientos, canSeeOC } from "@/lib/permissions"
import type { AprobacionPayload, EstadoMantenimiento } from "@/types/mantenimiento"
import { format } from "date-fns"
import { es } from "date-fns/locale"

// Mapa de transiciones para mostrar botones de acción
const SIGUIENTE_ESTADO: Record<string, { label: string; estado: EstadoMantenimiento }> = {
  solicitud:  { label: "Marcar como programado", estado: "programado" },
  programado: { label: "Iniciar ejecución",      estado: "ejecucion"  },
  ejecucion:  { label: "Marcar como completado", estado: "completado" },
}

const TABS = ["Info", "Timeline", "Compras"] as const
type Tab = (typeof TABS)[number]

const ROLES_APROBACION = [
  { id: "dir_administrativa", label: "Dir. Administrativa" },
  { id: "gerencia_operaciones", label: "Gerencia Operaciones" },
  { id: "gerencia_general", label: "Gerencia General" },
] as const

export default function MantenimientoDetallePage() {
  const { id } = useParams<{ id: string }>()
  const solicitudId = id ? parseInt(id) : null
  const navigate    = useNavigate()

  const [activeTab, setActiveTab]   = useState<Tab>("Info")
  const [showCrearOC, setShowCrearOC] = useState(false)
  const [showEscalar, setShowEscalar] = useState(false)
  const [gestionMsg, setGestionMsg] = useState<string | null>(null)
  const [monto, setMonto]           = useState("")
  const [fechaProg, setFechaProg]   = useState("")
  const [notas, setNotas]           = useState("")

  const { data: sol, isLoading } = useSolicitudMantenimiento(solicitudId)
  const { data: historial = [] } = useHistorialMantenimiento(activeTab === "Timeline" ? solicitudId : null)
  const { data: ocs = [] }       = useOCsVinculadas(activeTab === "Compras" ? solicitudId : null)
  const necesitaAprobaciones = (sol?.monto_estimado ?? 0) > 2_000_000 || sol?.requiere_aprobacion
  const { data: aprobaciones = [] } = useAprobaciones(
    necesitaAprobaciones ? solicitudId : null
  )
  const { mutateAsync: cambiarEstado, isPending: cambiandoEstado } = useCambiarEstadoMantenimiento()
  const { mutateAsync: subirEvidencia, isPending: subiendoEvidencia } = useSubirEvidencia()
  const { mutateAsync: programar, isPending: programando } = useProgramarMantenimiento()
  const { mutateAsync: registrarAprobacion, isPending: aprobando } = useRegistrarAprobacion()
  const { mutateAsync: escalarExterno, isPending: escalando } = useEscalarExterno()

  const portal = useMantenimientoPortal()
  const authUser = useAuthStore((s) => s.user)
  const role = portal?.session.role ?? authUser?.role ?? ""
  const appPerms = portal?.session.app_permissions ?? authUser?.app_permissions

  const puedeGestionar = portal
    ? portal.session.can_manage
    : canManageMantenimiento(role, appPerms)
  const puedeOperarCampo = portal
    ? portal.session.can_operate
    : canOperateMantenimientoCampo(role, appPerms)
  const puedeAprobar = portal
    ? portal.session.can_approve
    : authUser
      ? canSeeAllMantenimientos(authUser.role)
      : false
  const esCompras = authUser ? canSeeOC(authUser.role, authUser.area, appPerms) : false
  const puedeSubirEvidenciaExterna =
    puedeOperarCampo || puedeGestionar || esCompras
  const guardandoGestion = programando

  useEffect(() => {
    if (!sol) return
    setMonto(sol.monto_estimado != null ? String(sol.monto_estimado) : "")
    setFechaProg(
      sol.fecha_programada
        ? format(new Date(sol.fecha_programada), "yyyy-MM-dd'T'HH:mm")
        : ""
    )
    setNotas(sol.notas_evaluacion ?? "")
  }, [sol])

  if (isLoading) {
    const loading = (
      <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
        Cargando…
      </div>
    )
    if (portal) {
      return (
        <MantenimientoMobileLayout title="Detalle" showBack backTo={portal.listaPath}>
          {loading}
        </MantenimientoMobileLayout>
      )
    }
    return <PageLayout title="Mantenimiento">{loading}</PageLayout>
  }

  if (!sol) {
    const missing = (
      <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
        Solicitud no encontrada.
      </div>
    )
    if (portal) {
      return (
        <MantenimientoMobileLayout title="Detalle" showBack backTo={portal.listaPath}>
          {missing}
        </MantenimientoMobileLayout>
      )
    }
    return <PageLayout title="Mantenimiento">{missing}</PageLayout>
  }

  const siguienteAccion = SIGUIENTE_ESTADO[sol.estado]

  async function handleAvanzarEstado() {
    if (!siguienteAccion || !solicitudId) return
    await cambiarEstado({ id: solicitudId, payload: { estado_nuevo: siguienteAccion.estado } })
  }

  async function handleCancelar() {
    if (!solicitudId) return
    await cambiarEstado({
      id: solicitudId,
      payload: { estado_nuevo: "cancelado", nota: "Cancelado manualmente." },
    })
  }

  async function handleSubirEvidenciaDataUrl(evidencia_url: string) {
    if (!solicitudId) return
    await subirEvidencia({ id: solicitudId, payload: { evidencia_url } })
  }

  async function handleGuardarGestion() {
    if (!solicitudId) return
    setGestionMsg(null)
    const montoNum = monto.trim() ? Number(monto.replace(/\./g, "").replace(",", ".")) : null
    await programar({
      id: solicitudId,
      fecha_programada: fechaProg || null,
      notas_evaluacion: notas.trim() || null,
      monto_estimado: montoNum,
    })
    setGestionMsg("Datos guardados")
    setTimeout(() => setGestionMsg(null), 3000)
  }

  async function handleAprobar(rol: AprobacionPayload["rol_aprobador"]) {
    if (!solicitudId) return
    await registrarAprobacion({ id: solicitudId, payload: { rol_aprobador: rol } })
  }

  const faltaEvidencia =
    sol.estado === "ejecucion" &&
    (sol.modalidad === "externo"
      ? !sol.evidencia_despues_url
      : !sol.evidencia_url)
  const puedeCompletar = !faltaEvidencia
  const bloqueadoPorAprobaciones =
    sol.estado === "solicitud" &&
    (sol.monto_estimado ?? 0) > 2_000_000 &&
    sol.aprobaciones_count < 3
  const showGestion =
    puedeGestionar &&
    ["solicitud", "programado"].includes(sol.estado) &&
    sol.modalidad !== "externo"

  const PASOS: EstadoMantenimiento[] = [
    "solicitud", "programado", "ejecucion", "completado",
  ]
  const estadoBarra = (["evaluacion", "cerrado"] as string[]).includes(sol.estado)
    ? (sol.estado === "evaluacion" ? "programado" : "completado")
    : sol.estado
  const pasoActualIdx = PASOS.indexOf(estadoBarra as EstadoMantenimiento)

  const detalleInner = (
    <>
      {/* Top bar con breadcrumb */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => navigate(portal ? portal.listaPath : "/mantenimiento")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Mantenimientos
        </button>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm font-semibold text-foreground font-mono">{sol.consecutivo}</span>
        <EstadoMantenimientoBadge estado={sol.estado as EstadoMantenimiento} />
      </div>

      {sol.modalidad === "externo" && !portal && (
        <div className="mb-4">
          <ParExternoPanel sol={sol} />
        </div>
      )}

      {sol.modalidad === "externo" && !portal && (
        <ExternoEvidenciasPanel sol={sol} puedeSubir={puedeSubirEvidenciaExterna} />
      )}

      {/* Layout principal: sidebar + contenido */}
      <div className="flex gap-0 rounded-xl border border-border bg-card overflow-hidden min-h-[500px]">

        {/* SIDEBAR IZQUIERDO */}
        <div className="w-56 shrink-0 border-r border-border bg-background flex flex-col">
          {/* Tabs */}
          <div className="flex border-b border-border">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2.5 text-xs font-semibold transition-colors relative ${
                  activeTab === tab
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab === "Compras" && ocs.length > 0 && (
                  <span className="absolute top-1.5 right-1 w-3.5 h-3.5 bg-primary text-primary-foreground rounded-full text-[9px] flex items-center justify-center">
                    {ocs.length}
                  </span>
                )}
                {tab}
                {activeTab === tab && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
                )}
              </button>
            ))}
          </div>

          {/* Contenido del tab */}
          <div className="p-4 overflow-y-auto flex-1">
            {activeTab === "Info" && (
              <div className="space-y-4 text-sm">
                <Field label="Tipo" value={sol.tipo_mantenimiento} />
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Clasificación</p>
                  <ClasificacionBadge clasificacion={sol.clasificacion} />
                </div>
                {sol.clasificacion === "preventivo" && sol.fecha_proxima_mantenimiento && (
                  <Field
                    label="Próximo mantenimiento"
                    value={format(new Date(sol.fecha_proxima_mantenimiento + "T00:00:00"), "dd/MM/yyyy")}
                  />
                )}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Modalidad</p>
                  <ModalidadBadge modalidad={sol.modalidad} />
                </div>
                <Field label="Solicitado por" value={sol.solicitante_nombre ?? "—"} />
                <Field
                  label="Fecha solicitud"
                  value={format(new Date(sol.created_at), "dd/MM/yyyy", { locale: es })}
                />
                {sol.asignado_nombre && (
                  <Field label="Asignado a" value={sol.asignado_nombre} />
                )}
                {sol.fecha_programada && (
                  <Field
                    label="Programado para"
                    value={format(new Date(sol.fecha_programada), "dd/MM/yyyy HH:mm", { locale: es })}
                  />
                )}
                {sol.prioridad && (
                  <Field label="Prioridad" value={sol.prioridad} />
                )}
                {sol.monto_estimado != null && (
                  <Field
                    label="Monto estimado"
                    value={`$${sol.monto_estimado.toLocaleString("es-CO")}`}
                  />
                )}
                {sol.monto_real != null && (
                  <Field
                    label="Monto real"
                    value={`$${sol.monto_real.toLocaleString("es-CO")}`}
                  />
                )}
              </div>
            )}

            {activeTab === "Timeline" && (
              <div className="space-y-3">
                {historial.length === 0 && (
                  <p className="text-xs text-muted-foreground">Sin actividad registrada.</p>
                )}
                {historial.map((h) => (
                  <div key={h.id} className="text-xs">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                      <span className="font-medium text-foreground">{h.usuario_nombre}</span>
                    </div>
                    <p className="text-muted-foreground pl-3">
                      {h.estado_anterior
                        ? `${h.estado_anterior} · ${h.estado_nuevo}`
                        : `Creó la solicitud (${h.estado_nuevo})`}
                    </p>
                    {h.nota && (
                      <p className="text-muted-foreground pl-3 italic">{h.nota}</p>
                    )}
                    <p className="text-muted-foreground/60 pl-3 text-[10px] mt-0.5">
                      {format(new Date(h.fecha), "dd/MM/yyyy HH:mm", { locale: es })}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "Compras" && (
              <div className="space-y-3">
                {sol.modalidad === "externo" && sol.oc_par_id && sol.oc_par_consecutivo && (
                  <a
                    href={`/oc/solicitudes/${sol.oc_par_id}`}
                    className="block rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-xs hover:border-amber-500/50 transition-colors"
                  >
                    <p className="font-semibold text-foreground">OC servicio (par externo)</p>
                    <p className="font-mono text-muted-foreground mt-0.5">{sol.oc_par_consecutivo}</p>
                  </a>
                )}
                {puedeGestionar && sol.modalidad !== "externo" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full gap-1.5 text-xs"
                    onClick={() => setShowCrearOC(true)}
                  >
                    <Plus className="w-3 h-3" />
                    Nueva solicitud de compra
                  </Button>
                )}
                {ocs.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    No hay compras vinculadas a este mantenimiento.
                  </p>
                )}
                {ocs.map((oc) => (
                  <div
                    key={oc.id}
                    className="rounded-lg border border-border bg-muted/40 p-3 text-xs"
                  >
                    <p className="font-mono font-semibold text-foreground">{oc.consecutivo_os}</p>
                    <p className="text-muted-foreground mt-0.5 truncate">{oc.descripcion}</p>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="inline-block bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 text-[10px] font-medium">
                        {oc.estado}
                      </span>
                      <span className="text-muted-foreground/60">{oc.nivel_prioridad}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* CONTENIDO PRINCIPAL */}
        <div className="flex-1 p-6 overflow-y-auto">
          {/* Descripción */}
          <div className="mb-6">
            <h2 className="text-base font-bold text-foreground mb-1">{sol.titulo}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{sol.descripcion}</p>
          </div>

          {/* Barra de progreso */}
          {sol.estado !== "cancelado" && (
            <div className="mb-8">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                Progreso
              </p>
              <div className="flex items-center gap-0">
                {PASOS.map((paso, idx) => {
                  const isPast    = idx < pasoActualIdx
                  const isCurrent = idx === pasoActualIdx
                  return (
                    <div key={paso} className="flex items-center flex-1 last:flex-none">
                      <div className="flex flex-col items-center gap-1">
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                            isPast
                              ? "bg-green-500 text-white"
                              : isCurrent
                              ? "bg-orange-400 text-white"
                              : "bg-muted border border-border text-muted-foreground"
                          }`}
                        >
                          {isPast ? (
                            <Check className="w-3.5 h-3.5" aria-hidden />
                          ) : isCurrent ? (
                            <ArrowRight className="w-3.5 h-3.5" aria-hidden />
                          ) : (
                            idx + 1
                          )}
                        </div>
                        <span
                          className={`text-[9px] font-medium capitalize ${
                            isPast ? "text-green-600" : isCurrent ? "text-orange-500" : "text-muted-foreground"
                          }`}
                        >
                          {paso}
                        </span>
                      </div>
                      {idx < PASOS.length - 1 && (
                        <div
                          className={`flex-1 h-0.5 mx-1 mb-4 ${
                            isPast ? "bg-green-400" : "bg-muted"
                          }`}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {sol.estado === "cancelado" && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-sm font-semibold text-red-800">Solicitud cancelada</p>
            </div>
          )}

          {/* Programación */}
          {showGestion && (
            <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-4 space-y-4">
              <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide">
                Programación
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">
                    Monto estimado (COP)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={monto}
                    onChange={(e) => setMonto(e.target.value)}
                    placeholder="0"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-amber-500/50 transition-shadow"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">
                    Fecha programada
                  </label>
                  <input
                    type="datetime-local"
                    value={fechaProg}
                    onChange={(e) => setFechaProg(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500/50 transition-shadow"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs text-muted-foreground mb-1">
                    Notas de evaluación
                  </label>
                  <textarea
                    rows={2}
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                    placeholder="Observaciones técnicas, materiales necesarios..."
                  />
                </div>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void handleGuardarGestion()}
                  disabled={guardandoGestion}
                  className="bg-amber-500 hover:bg-amber-600 text-white"
                >
                  {guardandoGestion ? "Guardando…" : "Guardar programación"}
                </Button>
                {gestionMsg && (
                  <span className="text-xs text-emerald-600">{gestionMsg}</span>
                )}
              </div>
            </div>
          )}

          {puedeOperarCampo && solicitudId && (
            <MantenimientoCampoAcciones
              solicitudId={solicitudId}
              estado={sol.estado as EstadoMantenimiento}
              modalidad={sol.modalidad}
              onCrearOC={() => setShowCrearOC(true)}
              onEscalarExterno={
                sol.modalidad === "interno" ? () => setShowEscalar(true) : undefined
              }
              onDone={() => {
                /* queries se invalidan en el hook */
              }}
            />
          )}

          <EscalarExternoModal
            open={showEscalar}
            onClose={() => setShowEscalar(false)}
            loading={escalando}
            onConfirm={async (payload) => {
              if (!solicitudId) return
              await escalarExterno({ id: solicitudId, payload })
            }}
          />

          {puedeGestionar && !portal && solicitudId && (
            <AccesoMovilPanel
              solicitudId={solicitudId}
              consecutivo={sol.consecutivo}
              estado={sol.estado as EstadoMantenimiento}
            />
          )}

          {/* Notas de evaluación (solo lectura si ya guardadas) */}
          {sol.notas_evaluacion && !showGestion && (
            <div className="mb-6 bg-muted rounded-lg px-4 py-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                Notas de evaluación
              </p>
              <p className="text-sm text-foreground">{sol.notas_evaluacion}</p>
            </div>
          )}

          {(necesitaAprobaciones || (sol.monto_estimado ?? 0) > 2_000_000) && puedeAprobar && (
            <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-xs font-medium text-amber-800 uppercase tracking-wide mb-2">
                Aprobaciones requeridas ({sol.aprobaciones_count}/3)
              </p>
              <ul className="space-y-1 text-sm text-amber-900 mb-3">
                {ROLES_APROBACION.map(({ id, label }) => {
                  const ok = aprobaciones.some((a) => a.rol_aprobador === id)
                  return (
                    <li key={id} className="flex items-center gap-2">
                      <span className="inline-flex shrink-0">
                        {ok ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" aria-hidden />
                        ) : (
                          <Circle className="w-3 h-3 text-muted-foreground" aria-hidden />
                        )}
                      </span>
                      <span>{label}</span>
                    </li>
                  )
                })}
              </ul>
              {puedeAprobar && (
                <div className="flex flex-wrap gap-2">
                  {ROLES_APROBACION.filter(
                    ({ id }) => !aprobaciones.some((a) => a.rol_aprobador === id)
                  ).map(({ id, label }) => (
                    <Button
                      key={id}
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={aprobando}
                      className="text-xs border-amber-300 text-amber-900 hover:bg-amber-100"
                      onClick={() => void handleAprobar(id)}
                    >
                      Aprobar — {label}
                    </Button>
                  ))}
                </div>
              )}
              {bloqueadoPorAprobaciones && (
                <p className="text-xs text-amber-800 mt-2">
                  Se requieren 3 aprobaciones antes de marcar como programado.
                </p>
              )}
            </div>
          )}

          {sol.evidencia_url && (
            <div className="mb-6">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Evidencia
              </p>
              <img
                src={sol.evidencia_url}
                alt="Evidencia del trabajo"
                className="max-h-48 rounded-lg border border-border object-cover"
              />
            </div>
          )}

          {puedeGestionar && !sol.evidencia_url && sol.estado === "ejecucion" && (
            <div className="mb-6">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Subir evidencia
              </p>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                disabled={subiendoEvidencia}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void handleSubirEvidencia(file)
                }}
                className="text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-amber-500 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
              />
            </div>
          )}

          {/* Acciones */}
          {puedeGestionar && (
            <div className="flex gap-3 flex-wrap items-center">
              {siguienteAccion && sol.estado !== "cancelado" && (
                <Button
                  onClick={handleAvanzarEstado}
                  disabled={
                    cambiandoEstado ||
                    (siguienteAccion.estado === "completado" && !puedeCompletar) ||
                    (siguienteAccion.estado === "programado" && bloqueadoPorAprobaciones)
                  }
                >
                  {cambiandoEstado ? "Guardando…" : siguienteAccion.label}
                </Button>
              )}
              {bloqueadoPorAprobaciones && (
                <p className="text-xs text-amber-700 w-full">
                  Completa las 3 aprobaciones para avanzar a programado.
                </p>
              )}
              {faltaEvidencia && (
                <p className="text-xs text-amber-700 w-full">
                  {sol.modalidad === "externo"
                    ? "Sube la foto después del servicio del proveedor antes de completar."
                    : "Sube una foto de evidencia antes de marcar como completado."}
                </p>
              )}
              {["solicitud", "programado"].includes(sol.estado) && (
                <Button
                  variant="outline"
                  onClick={handleCancelar}
                  disabled={cambiandoEstado}
                  className="text-destructive border-destructive/30 hover:bg-destructive/10"
                >
                  Cancelar solicitud
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal OC vinculada */}
      {showCrearOC && (
        <CrearOCVinculadaModal
          open={showCrearOC}
          onClose={() => setShowCrearOC(false)}
          mantenimiento={sol}
        />
      )}
    </>
  )

  if (portal) {
    return (
      <MantenimientoMobileLayout
        title={sol.consecutivo}
        showBack
        backTo={portal.listaPath}
      >
        {detalleInner}
      </MantenimientoMobileLayout>
    )
  }

  return (
    <PageLayout title={sol.consecutivo}>
      {detalleInner}
    </PageLayout>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className="text-foreground font-medium">{value}</p>
    </div>
  )
}
