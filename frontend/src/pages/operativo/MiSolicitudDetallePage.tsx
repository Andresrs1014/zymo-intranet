import { useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { PageLayout } from "@/components/layout/PageLayout"
import { useSolicitud, useSubirFotoSolicitud, useEliminarFotoSolicitud, useCotizaciones, useOrden, useMarcarEntregada } from "@/hooks/useOC"
import { useAuthStore } from "@/store/authStore"
import { formatFechaHora } from "@/lib/dates"
import { formatCOP } from "@/lib/formatters"
import { EstadoBadge } from "@/pages/oc/SolicitudesPage"
import { ImageModal } from "@/components/ui/ImageModal"
import { api, absoluteApiUrl } from "@/lib/api"

const ESTADO_DESC: Record<string, string> = {
  nueva: "Tu solicitud fue recibida y está en cola.",
  en_cotizacion: "El equipo de compras está buscando cotización.",
  pendiente_aprobacion: "La cotización está siendo revisada por el director.",
  aprobada: "La compra fue aprobada. Generando orden de compra.",
  rechazada: "La solicitud fue rechazada. Revisa tu correo.",
  cancelada: "La solicitud fue cancelada definitivamente.",
  en_correccion: "El equipo de compras necesita que corrijas tu solicitud.",
  oc_enviada: "La orden de compra fue enviada al proveedor.",
  oc_en_plataforma: "El pedido fue ingresado en la plataforma.",
  entregada: "Confirmaste la recepción. La solicitud fue cerrada.",
  cerrada: "Confirmaste la recepción. La solicitud está cerrada.",
}

function isImage(filename: string) {
  return /\.(jpg|jpeg|png|gif|webp)$/i.test(filename)
}

export function MiSolicitudDetallePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const token = useAuthStore((s) => s.token)

  const { data: solicitud, isLoading } = useSolicitud(id)
  const { data: cotizaciones = [] } = useCotizaciones(id)
  const { data: orden } = useOrden(id)
  const subirFoto = useSubirFotoSolicitud()
  const eliminarFoto = useEliminarFotoSolicitud()
  const marcarEntregada = useMarcarEntregada()

  const cotizacionAprobada = cotizaciones.find((c) => c.aprobada === true)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false)
  const [modalImage, setModalImage] = useState<{ url: string; filename: string } | null>(null)

  function handleUpload(file: File) {
    if (!id) return
    subirFoto.mutate({ solicitudId: id, file })
  }

  function handleEliminar(filename: string) {
    if (!id) return
    eliminarFoto.mutate({ solicitudId: id, filename })
  }

  async function handleDescargarOC() {
    if (!orden) return
    try {
      const response = await api.get(`/api/oc/ordenes/${orden.id}/descargar`, {
        responseType: "blob",
      })
      const contentType: string = response.headers["content-type"] ?? ""
      const isPdf = contentType.includes("pdf")
      const ext = isPdf ? "pdf" : "xlsx"
      const mimeType = isPdf
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      const blobUrl = URL.createObjectURL(new Blob([response.data], { type: mimeType }))
      const a = document.createElement("a")
      a.href = blobUrl
      a.download = `${orden.numero_oc}.${ext}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(blobUrl)
    } catch {
      console.error("Error al descargar OC")
    }
  }

  if (isLoading) {
    return (
      <PageLayout title="Mis Solicitudes" mainClassName="flex-1 flex items-center justify-center overflow-hidden text-muted-foreground text-sm">
        Cargando...
      </PageLayout>
    )
  }

  if (!solicitud) {
    return (
      <PageLayout title="Mis Solicitudes" mainClassName="flex-1 flex items-center justify-center overflow-hidden text-muted-foreground text-sm">
        Solicitud no encontrada.
      </PageLayout>
    )
  }

  const esMia = user?.email === solicitud.solicitante_email
  const fotos = solicitud.fotos_producto ?? []

  const buildFotoUrl = (filename: string) => {
    const t = token ? encodeURIComponent(token) : ""
    const qp = t ? `?token=${t}` : ""
    return absoluteApiUrl(`/api/oc/solicitudes/${solicitud.id}/fotos/${filename}${qp}`)
  }

  return (
    <PageLayout
      title="Mis Solicitudes"
      afterMain={
        <ImageModal
          isOpen={!!modalImage}
          imageUrl={modalImage?.url || ""}
          filename={modalImage?.filename || ""}
          onClose={() => setModalImage(null)}
        />
      }
    >
          <button
            onClick={() => navigate("/operativo/mis-solicitudes")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
          >
            ← Volver
          </button>

          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-sm font-bold text-brand-blue">
                  {solicitud.consecutivo_os}
                </span>
                <EstadoBadge estado={solicitud.estado} />
                {solicitud.tipo_solicitud === "mantenimiento" && (
                  <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                    Mantenimiento
                  </span>
                )}
              </div>
              <h1 className="text-xl font-bold text-foreground">{solicitud.descripcion}</h1>
              {ESTADO_DESC[solicitud.estado] && (
                <p className="text-sm text-muted-foreground mt-1">{ESTADO_DESC[solicitud.estado]}</p>
              )}
            </div>
          </div>

          {/* Confirmar recibo — visible solo para el solicitante cuando el pedido está en plataforma */}
          {esMia && solicitud.estado === "oc_en_plataforma" && (
            <div className="max-w-2xl mb-4 bg-green-50 rounded-xl border border-green-200 shadow-sm p-5 flex flex-col gap-4">
              <div>
                <p className="text-sm font-semibold text-green-800 mb-0.5">¿Ya recibiste tu pedido?</p>
                <p className="text-sm text-green-700">
                  Tu pedido está listo para ser retirado. Confírmalo una vez que lo tengas en mano.
                </p>
              </div>

              {!mostrarConfirmacion ? (
                <button
                  onClick={() => setMostrarConfirmacion(true)}
                  className="self-start bg-green-600 hover:bg-green-700 text-white rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors"
                >
                  Confirmar recibo del pedido
                </button>
              ) : (
                <div className="bg-white rounded-lg border border-green-300 p-4 flex flex-col gap-3">
                  <p className="text-sm font-semibold text-foreground">¿Confirmas que recibiste el pedido?</p>
                  <p className="text-sm text-muted-foreground">
                    Al aceptar, confirmas la recepción del producto y la solicitud quedará <strong>cerrada definitivamente</strong>. Esta acción no se puede deshacer.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        marcarEntregada.mutate(id!)
                        setMostrarConfirmacion(false)
                      }}
                      disabled={marcarEntregada.isPending}
                      className="bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
                    >
                      {marcarEntregada.isPending ? "Confirmando..." : "Sí, recibí el pedido"}
                    </button>
                    <button
                      onClick={() => setMostrarConfirmacion(false)}
                      className="bg-background border border-border hover:bg-muted text-foreground rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="max-w-2xl space-y-4">
            {/* Datos del pedido */}
            <div className="bg-card rounded-xl border border-border shadow-sm p-5">
              <h2 className="text-sm font-semibold text-foreground mb-4">Detalle del Pedido</h2>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <InfoItem label="Cantidad" value={String(solicitud.cantidad)} />
                <InfoItem label="Prioridad" value={solicitud.nivel_prioridad} />
                {solicitud.categoria && <InfoItem label="Categoría" value={solicitud.categoria} />}
                {solicitud.plataforma && <InfoItem label="Plataforma" value={solicitud.plataforma} />}
                {solicitud.cliente && <InfoItem label="Cliente" value={solicitud.cliente} />}
                {solicitud.placa_ficha && <InfoItem label="Placa / Ficha técnica" value={solicitud.placa_ficha} />}
                {solicitud.tipo_solicitud === "mantenimiento" && solicitud.tipo_mantenimiento && (
                  <InfoItem
                    label="Tipo mantenimiento"
                    value={solicitud.tipo_mantenimiento.charAt(0).toUpperCase() + solicitud.tipo_mantenimiento.slice(1)}
                  />
                )}
                {solicitud.fecha_proximo_mantenimiento && (
                  <InfoItem label="Próximo mantenimiento" value={solicitud.fecha_proximo_mantenimiento} />
                )}
                <InfoItem label="Fecha solicitud" value={formatFechaHora(solicitud.fecha_solicitud)} />
              </div>
              {solicitud.observaciones_solicitante && (
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-1">Observaciones</p>
                  <p className="text-sm text-foreground">{solicitud.observaciones_solicitante}</p>
                </div>
              )}
              {solicitud.observaciones_compras && solicitud.estado === "en_correccion" && (
                <div className="mt-3 pt-3 border-t border-amber-100 bg-amber-50 rounded-lg px-3 py-2">
                  <p className="text-xs font-semibold text-amber-700 mb-1">Qué debes corregir:</p>
                  <p className="text-sm text-amber-900">{solicitud.observaciones_compras}</p>
                </div>
              )}
            </div>

            {/* Fotos del producto */}
            <div className="bg-card rounded-xl border border-border shadow-sm p-5">
              <h2 className="text-sm font-semibold text-foreground mb-3">
                Fotos / archivos de referencia del producto
              </h2>
              <p className="text-xs text-muted-foreground mb-4">
                Sube fotos o archivos para ayudar al equipo de compras a identificar el producto exacto.
              </p>

              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragOver(false)
                  const file = e.dataTransfer.files[0]
                  if (file) handleUpload(file)
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 cursor-pointer transition-colors ${
                  dragOver
                    ? "border-brand-blue bg-brand-blue/5"
                    : "border-border hover:border-brand-blue/40 hover:bg-muted"
                }`}
              >
                <svg className="w-8 h-8 text-muted-foreground/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                </svg>
                <p className="text-sm font-medium text-foreground">
                  {subirFoto.isPending ? "Subiendo..." : "Arrastra o haz clic para subir"}
                </p>
                <p className="text-xs text-muted-foreground">JPG, PNG, PDF, Excel, Word</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.xlsx,.docx"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleUpload(f)
                  e.target.value = ""
                }}
              />

              {/* Galería */}
              {fotos.length > 0 && (
                <div className="mt-4 grid grid-cols-3 gap-3">
                  {fotos.map((filename) => (
                    <div key={filename} className="relative group rounded-lg overflow-hidden border border-border bg-muted">
                      {isImage(filename) ? (
                        <img
                          src={buildFotoUrl(filename)}
                          alt={filename}
                          className="w-full h-24 object-cover cursor-pointer"
                          onClick={() => setModalImage({ url: buildFotoUrl(filename), filename })}
                        />
                      ) : (
                        <a
                          href={buildFotoUrl(filename)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex flex-col items-center justify-center h-24 gap-1 text-gray-400 hover:text-brand-blue transition-colors"
                        >
                          <svg className="w-7 h-7" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4 4a2 2 0 0 1 2-2h4.586A2 2 0 0 1 12 2.586L15.414 6A2 2 0 0 1 16 7.414V16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4Z" clipRule="evenodd" />
                          </svg>
                          <span className="text-xs px-1 truncate max-w-full">{filename.split(".").pop()?.toUpperCase()}</span>
                        </a>
                      )}
                      {esMia && (
                        <button
                          onClick={() => handleEliminar(filename)}
                          disabled={eliminarFoto.isPending}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Documentos de la Compra */}
            {(cotizacionAprobada || orden) && (
              <div className="bg-card rounded-xl border border-border shadow-sm p-5">
                <h2 className="text-sm font-semibold text-foreground mb-4">Documentos de la Compra</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {cotizacionAprobada && (
                    <div className="rounded-lg border border-border bg-muted p-4 flex flex-col justify-between">
                      <div>
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">Cotización Aprobada</p>
                        <div className="space-y-2 mb-4 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Proveedor:</span>
                            <span className="font-medium text-foreground truncate ml-2 max-w-[60%]" title={cotizacionAprobada.proveedor_nombre}>{cotizacionAprobada.proveedor_nombre}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Valor Total:</span>
                            <span className="font-medium text-foreground">{formatCOP(cotizacionAprobada.valor_total)}</span>
                          </div>
                        </div>
                      </div>
                      {cotizacionAprobada.pdf_path && (
                        <button
                          type="button"
                          onClick={async () => {
                            const res = await api.get(`/api/oc/cotizaciones/${cotizacionAprobada.id}/pdf`, { responseType: "blob" })
                            const url = URL.createObjectURL(res.data as Blob)
                            const win = window.open(url, "_blank")
                            setTimeout(() => URL.revokeObjectURL(url), 60_000)
                            if (!win) {
                              const a = document.createElement("a")
                              a.href = url; a.download = `cotizacion_${cotizacionAprobada.id}.pdf`
                              document.body.appendChild(a); a.click(); document.body.removeChild(a)
                            }
                          }}
                          className="flex items-center justify-center w-full gap-2 rounded-lg bg-card border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors shadow-sm"
                        >
                          <svg className="w-4 h-4 text-brand-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          Ver PDF Cotización
                        </button>
                      )}
                    </div>
                  )}

                  {orden && (
                    <div className="rounded-lg border border-border bg-muted p-4 flex flex-col justify-between">
                      <div>
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">Orden de Compra</p>
                        <div className="space-y-2 mb-4 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Número OC:</span>
                            <span className="font-mono font-bold text-brand-blue">{orden.numero_oc}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Plataforma:</span>
                            <span className="font-medium text-foreground">{solicitud.plataforma}</span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={handleDescargarOC}
                        className="flex items-center justify-center w-full gap-2 rounded-lg bg-brand-blue px-3 py-2 text-sm font-semibold text-white hover:brightness-105 transition-all shadow-sm"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Descargar OC
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
    </PageLayout>
  )
}

function InfoItem({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground font-medium">{value ?? "—"}</p>
    </div>
  )
}
