import { type ReactNode, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { PageLayout } from "@/components/layout/PageLayout"
import { api } from "@/lib/api"
import {
  encabezadoDesdeItems,
  recalcLineFromCantVu,
  recalcUnitarioFromCantVt,
  roundCOP,
  subtotalFromItems,
} from "@/lib/ocValoresCalculo"
import { formatFechaHora, formatFechaRelativa } from "@/lib/dates"
import {
  useSolicitud,
  useAsignarAuxiliar,
  useCotizaciones,
  useAprobarCotizacion,
  useRechazarCotizacion,
  useOrden,
  useGenerarOC,
  useActualizarGestion,
  useCambiarPrioridad,
  useUsuario,
  useMarcarEnviada,
  useMarcarEnPlataforma,
  useMarcarEntregada,
  useCerrarSolicitud,
  useUsuariosCompras,
  useHistorialEstados,
  usePlataformas,
  useCancelarSolicitud,
  useCorreccionSolicitud,
  useCancelarCotizacion,
  useCorreccionCotizacion,
  useEditarCorreccion,
  useEditarCotizacionDirector,
  useCorregirDirectivo,
  useSubirFotoSolicitud,
  useEliminarFotoSolicitud,
  useArchivarSolicitud,
  useEliminarSolicitud,
  useActualizarProforma,
  useSubirProforma,
  type EditarCotizacionPayload,
  type CorregirDirectivoPayload,
  type PlataformaOption,
} from "@/hooks/useOC"
import { useAuthStore } from "@/store/authStore"
import { getApiError } from "@/hooks/useUsers"
import { canApproveOC, canConfigureOC, canSeeOC } from "@/lib/permissions"
import { FormFieldCOP } from "@/components/forms/FormFieldCOP"
import {
  puedeGestionarProformaDesdeOc,
  solicitudOcProformaSoloFinanciero,
} from "@/lib/ocProforma"
import { EstadoBadge } from "./SolicitudesPage"
import { ImageModal } from "@/components/ui/ImageModal"
import { absoluteApiUrl } from "@/lib/api"
import type { CotizacionProveedor, HistorialEntrada, ItemCotizacion, OrdenCompra } from "@/types/oc"

/** Descarga el PDF/xlsx de una cotización usando el header Authorization (no expone token en URL). */
async function abrirCotizacionPdf(cotizacionId: string): Promise<void> {
  const { api: apiClient } = await import("@/lib/api")
  const res = await apiClient.get(`/api/oc/cotizaciones/${cotizacionId}/pdf`, { responseType: "blob" })
  const blob = res.data as Blob
  const url = URL.createObjectURL(blob)
  const win = window.open(url, "_blank")
  // Revocar el blob URL una vez que la ventana haya cargado el archivo
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
  if (!win) {
    // Fallback si el browser bloqueó el popup: descarga directa
    const a = document.createElement("a")
    a.href = url
    a.download = `cotizacion_${cotizacionId}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }
}

export function SolicitudDetallePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const token = useAuthStore((s) => s.token)

  const { data: solicitud, isLoading } = useSolicitud(id)
  const { data: cotizaciones = [], isLoading: cotizacionesLoading } = useCotizaciones(id)
  const { data: orden } = useOrden(id)
  const { data: auxiliar } = useUsuario(solicitud?.auxiliar_id)
  const { data: usuariosCompras = [] } = useUsuariosCompras()
  const { data: historial = [] } = useHistorialEstados(id)
  const asignar = useAsignarAuxiliar()
  const aprobar = useAprobarCotizacion()
  const rechazar = useRechazarCotizacion()
  const editarCotizacion = useEditarCotizacionDirector()
  const generarOC = useGenerarOC()
  const actualizarGestion = useActualizarGestion()
  const marcarEnviada = useMarcarEnviada()
  const marcarEnPlataforma = useMarcarEnPlataforma()
  const marcarEntregada = useMarcarEntregada()
  const cerrarSolicitud = useCerrarSolicitud()
  const cambiarPrioridad = useCambiarPrioridad()
  const cancelarSolicitud = useCancelarSolicitud()
  const actualizarProforma = useActualizarProforma(id ?? "")
  const subirProforma = useSubirProforma(id ?? "")
  const correccionSolicitud = useCorreccionSolicitud()
  const cancelarCotizacion = useCancelarCotizacion()
  const correccionCotizacion = useCorreccionCotizacion()
  const editarCorreccion = useEditarCorreccion()
  const corregirDirectivo = useCorregirDirectivo()
  const subirFoto = useSubirFotoSolicitud()
  const eliminarFoto = useEliminarFotoSolicitud()
  const archivarSolicitud = useArchivarSolicitud()
  const eliminarSolicitud = useEliminarSolicitud()
  const [mostrarModalArchivar, setMostrarModalArchivar] = useState(false)
  const [errorArchivar, setErrorArchivar] = useState<string | null>(null)
  const [mostrarModalEliminar, setMostrarModalEliminar] = useState(false)
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null)
  const fotoInputRef = useRef<HTMLInputElement>(null)
  const [fotoDragOver, setFotoDragOver] = useState(false)
  const evidenciaInputRef = useRef<HTMLInputElement>(null)
  const [evidenciaDragOver, setEvidenciaDragOver] = useState(false)
  const [errorOC, setErrorOC] = useState<string | null>(null)
  const [proformaMutationError, setProformaMutationError] = useState<string | null>(null)
  const [modalImage, setModalImage] = useState<{ url: string; filename: string } | null>(null)

  // Modal de rechazo de solicitud (auxiliar): "cancelar" | "correccion" | null
  type ModoRechazoSol = "cancelar" | "correccion" | null
  const [modoRechazoSol, setModoRechazoSol] = useState<ModoRechazoSol>(null)
  const [textoRechazoSol, setTextoRechazoSol] = useState("")

  // Modal de corrección directiva
  const [mostrarCorreccionDirectivo, setMostrarCorreccionDirectivo] = useState(false)
  const [corrDirProveedorNombre, setCorrDirProveedorNombre] = useState("")
  const [corrDirProveedorNit, setCorrDirProveedorNit] = useState("")
  const [corrDirProveedorEmail, setCorrDirProveedorEmail] = useState("")
  const [corrDirNumeroCot, setCorrDirNumeroCot] = useState("")
  const [corrDirValorAntesIva, setCorrDirValorAntesIva] = useState("")
  const [corrDirValorIva, setCorrDirValorIva] = useState("")
  const [corrDirValorTotal, setCorrDirValorTotal] = useState("")
  const [corrDirValorAprobado, setCorrDirValorAprobado] = useState("")
  const [corrDirFormaPago, setCorrDirFormaPago] = useState("")
  const [corrDirPlazoEntrega, setCorrDirPlazoEntrega] = useState("")
  /** Observaciones de la cotización (campo proveedor). */
  const [corrDirObsCotizacion, setCorrDirObsCotizacion] = useState("")
  /** Motivo obligatorio de la corrección (observacion_correccion). */
  const [corrDirNotaDirectivo, setCorrDirNotaDirectivo] = useState("")
  const [corrDirMotivoCierre, setCorrDirMotivoCierre] = useState("")
  const [corrDirItems, setCorrDirItems] = useState<ItemCotizacion[]>([])
  const [corrDirError, setCorrDirError] = useState<string | null>(null)

  const [mostrarCancelarDirectivo, setMostrarCancelarDirectivo] = useState(false)
  const [textoCancelarDirectivo, setTextoCancelarDirectivo] = useState("")

  // Formulario de corrección (solicitante)
  const [corrDesc, setCorrDesc] = useState("")
  const [corrCantidad, setCorrCantidad] = useState("")
  const [corrObs, setCorrObs] = useState("")

  const puedeEditarPrioridad =
    user?.role === "admin" ||
    (user ? canConfigureOC(user.role, user.app_permissions) : false)

  function handleAsignarme() {
    if (!id || !user) return
    asignar.mutate({ id, auxiliar_id: user.id })
  }

  if (isLoading) {
    return (
      <PageLayout title="OC Automatizaciones" mainClassName="flex-1 flex items-center justify-center overflow-hidden text-muted-foreground text-sm">
        Cargando...
      </PageLayout>
    )
  }

  if (!solicitud) {
    return (
      <PageLayout title="OC Automatizaciones" mainClassName="flex-1 flex items-center justify-center overflow-hidden text-muted-foreground text-sm">
        Solicitud no encontrada.
      </PageLayout>
    )
  }

  const esAuxiliarAsignado = solicitud.auxiliar_id && user?.id ? Number(solicitud.auxiliar_id) === Number(user.id) : false
  const esSolicitante = user?.email === solicitud.solicitante_email
  const perms = user?.app_permissions ?? []
  const tieneAccesoCompras = !!user && (user.role === "admin" || user.role === "compras" || perms.includes("mod_oc_ver"))
  const puedeAsignarse =
    !solicitud.auxiliar_id &&
    !!user &&
    (user.role === "admin" ||
      user.role === "compras" ||
      user.area === "Compras" ||
      (perms.includes("mod_oc_ver") && !perms.includes("mod_oc_aprobar")))
  const esAprobador = user ? canApproveOC(user.role, user.app_permissions) : false
  const esAdmin = user ? user.role === "admin" || canApproveOC(user.role, user.app_permissions) : false
  const puedeAsignarOtro = esAdmin
  const puedeGenerarOC = user ? canSeeOC(user.role, user.area, user.app_permissions) : false
  const cotizacionPendiente = cotizaciones.find((c) => c.aprobada === null)
  const cotizacionAprobada = cotizaciones.find((c) => c.aprobada === true)

  const estadoPermiteCorreccionDirectiva = [
    "aprobada", "oc_enviada", "oc_en_plataforma", "entregada", "cerrada",
  ].includes(solicitud.estado)
  const muestraAccionesDirectorCotizada =
    esAprobador && !!cotizacionAprobada && estadoPermiteCorreccionDirectiva

  const solicitudYaEnCorreccion = solicitud.estado === "en_correccion"

  // Mientras cotizaciones carga (isLoading), evitar ocultar la sección por count=0
  // si el estado no es "en_cotizacion". Una vez cargado, la lógica normal aplica.
  // Solo usuarios de compras/admin pueden gestionar proforma (el backend también lo exige).
  const esUsuarioCompras = user ? canSeeOC(user.role, user.area, perms) : false
  const puedeGestionarProforma = esUsuarioCompras && (
    cotizacionesLoading
      ? !solicitudOcProformaSoloFinanciero(solicitud.estado)
      : puedeGestionarProformaDesdeOc(cotizaciones.length, solicitud.estado)
  )
  const muestraAyudaProformaPrevCotizacion =
    !!user &&
    canSeeOC(user.role, user.area, perms) &&
    !cotizacionesLoading &&
    cotizaciones.length === 0 &&
    solicitud.estado !== "en_cotizacion" &&
    !solicitudOcProformaSoloFinanciero(solicitud.estado)
  const muestraAvisoProformaSoloFinanciero =
    !!user &&
    canSeeOC(user.role, user.area, perms) &&
    solicitudOcProformaSoloFinanciero(solicitud.estado) &&
    solicitud.tiene_proforma

  const buildFotoUrl = (filename: string) => {
    const t = token ? encodeURIComponent(token) : ""
    const qp = t ? `?token=${t}` : ""
    return absoluteApiUrl(`/api/oc/solicitudes/${solicitud.id}/fotos/${filename}${qp}`)
  }


  function handleGenerarOC(forzar = false) {
    if (!id) return
    generarOC.mutate(
      { solicitudId: id, forzar },
      {
        onError: () => setErrorOC("Error al generar la OC. Verifica que la cotización esté aprobada y vuelve a intentarlo."),
        onSuccess: () => setErrorOC(null),
      }
    )
  }

  // Guarda la plataforma primero y luego genera — evita race condition
  function handleGuardarYGenerar(plataforma: string) {
    if (!id) return
    actualizarGestion.mutate(
      { id, payload: { plataforma } },
      { onSuccess: () => handleGenerarOC(false) }
    )
  }

  function handleRechazarSolicitud() {
    if (!id || !textoRechazoSol.trim()) return
    if (modoRechazoSol === "cancelar") {
      cancelarSolicitud.mutate(
        { id, justificacion: textoRechazoSol },
        {
          onSuccess: () => {
            setModoRechazoSol(null)
            setTextoRechazoSol("")
            setErrorOC(null)
          },
          onError: (err: unknown) => setErrorOC(getApiError(err) || "No se pudo cancelar la solicitud."),
        },
      )
    } else if (modoRechazoSol === "correccion") {
      correccionSolicitud.mutate(
        { id, que_corregir: textoRechazoSol },
        {
          onSuccess: () => {
            setModoRechazoSol(null)
            setTextoRechazoSol("")
            setErrorOC(null)
          },
          onError: (err: unknown) => setErrorOC(getApiError(err) || "No se pudo mandar la solicitud a corrección."),
        },
      )
    }
  }

  function handleEditarCorreccion() {
    if (!id) return
    const payload: { descripcion?: string; cantidad?: number; observaciones_solicitante?: string } = {}
    if (corrDesc.trim()) payload.descripcion = corrDesc.trim()
    if (corrCantidad.trim() && !isNaN(Number(corrCantidad))) payload.cantidad = Number(corrCantidad)
    if (corrObs.trim()) payload.observaciones_solicitante = corrObs.trim()
    editarCorreccion.mutate(
      { id, payload },
      { onSuccess: () => { setCorrDesc(""); setCorrCantidad(""); setCorrObs("") } }
    )
  }

  async function handleDescargar() {
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
      setErrorOC("Error al descargar el documento.")
    }
  }

  function parseCopNumber(raw: string): number | undefined {
    const t = raw.trim().replace(/,/g, "")
    if (!t) return undefined
    const n = Number(t)
    return Number.isFinite(n) ? n : undefined
  }

  function syncCorrDirHeaderFromItems(items: ItemCotizacion[]) {
    const h = encabezadoDesdeItems(items)
    setCorrDirValorAntesIva(String(h.subtotal))
    setCorrDirValorIva(String(h.iva))
    setCorrDirValorTotal(String(h.total))
  }

  /** Actualiza fila según qué celda editó el usuario; sincroniza encabezado desde ítems. */
  function patchCorrDirItem(
    idx: number,
    source: "cantidad" | "valor_unitario" | "valor_total" | "meta",
    mut: (row: ItemCotizacion) => ItemCotizacion,
  ) {
    setCorrDirItems((rows) => {
      const row = rows[idx]
      if (!row) return rows
      let updated = mut(row)
      if (source === "cantidad" || source === "valor_unitario") {
        const p = recalcLineFromCantVu(updated.cantidad, updated.valor_unitario)
        if (p != null) updated = { ...updated, valor_total: p }
      } else if (source === "valor_total") {
        const p = recalcUnitarioFromCantVt(updated.cantidad, updated.valor_total)
        if (p != null) updated = { ...updated, valor_unitario: p }
      }
      const next = rows.map((r, i) => (i === idx ? updated : r))
      queueMicrotask(() => syncCorrDirHeaderFromItems(next))
      return next
    })
  }

  function abrirModalCorreccionDirectiva() {
    const c = cotizacionAprobada
    const sol = solicitud
    if (!c || !sol) return
    setCorrDirProveedorNombre(c.proveedor_nombre ?? "")
    setCorrDirProveedorNit(c.proveedor_nit ?? "")
    setCorrDirProveedorEmail(c.proveedor_email ?? "")
    setCorrDirNumeroCot(c.numero_cotizacion_proveedor ?? "")
    setCorrDirValorAntesIva(c.valor_antes_iva != null ? String(c.valor_antes_iva) : "")
    setCorrDirValorIva(c.valor_iva != null ? String(c.valor_iva) : "")
    setCorrDirValorTotal(c.valor_total != null ? String(c.valor_total) : "")
    setCorrDirValorAprobado(
      String(c.valor_aprobado ?? c.valor_total ?? ""),
    )
    setCorrDirFormaPago(c.forma_pago ?? "")
    setCorrDirPlazoEntrega(c.plazo_entrega ?? "")
    setCorrDirObsCotizacion(c.observaciones ?? "")
    setCorrDirNotaDirectivo("")
    setCorrDirMotivoCierre("")
    const filasItems: ItemCotizacion[] =
      c.items && c.items.length > 0
        ? c.items.map((it, i) => ({ ...it, num: it.num ?? i + 1 }))
        : [
            {
              num: 1,
              descripcion: sol.descripcion || "",
              referencia: sol.placa_ficha || "",
              cantidad: sol.cantidad ?? 1,
              valor_unitario: c.valor_unitario ?? undefined,
              valor_total: c.valor_total ?? undefined,
            },
          ]
    setCorrDirItems(filasItems)
    setCorrDirError(null)
    setMostrarCorreccionDirectivo(true)
  }

  function handleGuardarCorreccionDirectiva() {
    const c = cotizacionAprobada
    if (!c || !id) return
    if (corrDirNotaDirectivo.trim().length < 5) {
      setCorrDirError("La observación del director debe tener al menos 5 caracteres.")
      return
    }
    const esProcesoCerrado = ["cerrada", "entregada"].includes(solicitud?.estado ?? "")
    if (esProcesoCerrado && corrDirMotivoCierre.trim().length < 3) {
      setCorrDirError("Debes justificar por qué realizas una corrección después de cerrado el proceso.")
      return
    }
    if (!corrDirProveedorNombre.trim()) {
      setCorrDirError("El nombre del proveedor es obligatorio.")
      return
    }
    const vt = parseCopNumber(corrDirValorTotal)
    if (vt == null || vt <= 0) {
      setCorrDirError("Indica un total válido mayor a cero.")
      return
    }
    const vaIva = parseCopNumber(corrDirValorIva)
    const vSub = parseCopNumber(corrDirValorAntesIva)
    // Solo validar coherencia si los tres campos están llenos
    if (vSub != null && vaIva != null && Math.abs(vSub + vaIva - vt) > 2) {
      setCorrDirError("Subtotal sin IVA + IVA no coincide con el total (tolerancia 1–2 pesos por redondeo).")
      return
    }
    const itemsPayload = corrDirItems
      .filter((it) => it.descripcion?.trim())
      .map((it, i) => ({
        num: it.num ?? i + 1,
        descripcion: it.descripcion.trim(),
        referencia: it.referencia?.trim() || undefined,
        cantidad: it.cantidad,
        valor_unitario: it.valor_unitario,
        valor_total: it.valor_total,
      }))
    if (itemsPayload.length === 0) {
      setCorrDirError("Agrega al menos un ítem con descripción.")
      return
    }
    // Validación items vs subtotal removida — subtotal e IVA son opcionales
    const valorAprobadoNum = parseCopNumber(corrDirValorAprobado)
    const payload: CorregirDirectivoPayload = {
      proveedor_nombre: corrDirProveedorNombre.trim(),
      proveedor_nit: corrDirProveedorNit.trim() || undefined,
      proveedor_email: corrDirProveedorEmail.trim() || undefined,
      numero_cotizacion_proveedor: corrDirNumeroCot.trim() || undefined,
      valor_antes_iva: parseCopNumber(corrDirValorAntesIva),
      valor_iva: parseCopNumber(corrDirValorIva),
      valor_total: vt,
      forma_pago: corrDirFormaPago.trim() || undefined,
      plazo_entrega: corrDirPlazoEntrega.trim() || undefined,
      observaciones: corrDirObsCotizacion.trim() || undefined,
      items: itemsPayload,
      valor_aprobado: valorAprobadoNum,
      observacion_correccion: corrDirNotaDirectivo.trim(),
      motivo_post_cierre: corrDirMotivoCierre.trim() || undefined,
    }
    setCorrDirError(null)
    corregirDirectivo.mutate(
      { solicitudId: id, cotizacionId: c.id, payload },
      {
        onSuccess: () => {
          setMostrarCorreccionDirectivo(false)
          setCorrDirNotaDirectivo("")
          setCorrDirMotivoCierre("")
        },
        onError: (err: unknown) => setCorrDirError(getApiError(err) || "No se pudo guardar la corrección."),
      },
    )
  }

  function handleConfirmarCancelarDirectivo() {
    if (!id || textoCancelarDirectivo.trim().length < 3) return
    cancelarSolicitud.mutate(
      { id, justificacion: textoCancelarDirectivo.trim() },
      {
        onSuccess: () => {
          setMostrarCancelarDirectivo(false)
          setTextoCancelarDirectivo("")
        },
      },
    )
  }

  return (
    <>
      <PageLayout
        title="OC Automatizaciones"
        afterMain={
          <>
          {modoRechazoSol ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
              <div className="bg-card rounded-xl shadow-xl p-6 w-full max-w-md mx-4 space-y-4">
                <h3 className="text-base font-semibold text-foreground">
                  {solicitudYaEnCorreccion ? "Cancelar solicitud" : "Rechazar solicitud"}
                </h3>

                {!solicitudYaEnCorreccion ? (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => { setModoRechazoSol("cancelar"); setTextoRechazoSol("") }}
                      className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                        modoRechazoSol === "cancelar"
                          ? "border-red-400 bg-red-50 text-red-700"
                          : "border-border text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      Cancelar solicitud
                    </button>
                    <button
                      type="button"
                      onClick={() => { setModoRechazoSol("correccion"); setTextoRechazoSol("") }}
                      className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                        modoRechazoSol === "correccion"
                          ? "border-amber-400 bg-amber-50 text-amber-700"
                          : "border-border text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      Mandar a corrección
                    </button>
                  </div>
                ) : (
                  <p className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    Esta solicitud <strong>ya está en corrección</strong>: quien pidió debe ajustarla y volver a
                    enviarla desde la intranet. Desde aquí solo puedes <strong>cancelarla</strong> si la compra ya no
                    aplica.
                  </p>
                )}

                <p className="text-sm text-muted-foreground">
                  {solicitudYaEnCorreccion || modoRechazoSol === "cancelar"
                    ? `La solicitud quedará cancelada definitivamente. Se notificará a ${solicitud.solicitante_email} por correo.`
                    : `La solicitud regresará al solicitante para que la corrija desde la intranet.`}
                </p>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    {modoRechazoSol === "cancelar" ? "Motivo de cancelación *" : "¿Qué debe corregir? *"}
                  </label>
                  <textarea
                    rows={3}
                    value={textoRechazoSol}
                    onChange={(e) => setTextoRechazoSol(e.target.value)}
                    className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none resize-none transition-colors ${
                      modoRechazoSol === "cancelar"
                        ? "border-border focus:ring-2 focus:ring-red-400"
                        : "border-border focus:ring-2 focus:ring-amber-400"
                    }`}
                    placeholder={
                      modoRechazoSol === "cancelar"
                        ? "Ej. El equipo ya tiene este ítem en almacén..."
                        : "Ej. La descripción es muy genérica, especificar marca y referencia..."
                    }
                    autoFocus
                  />
                </div>

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={handleRechazarSolicitud}
                    disabled={
                      !textoRechazoSol.trim() ||
                      cancelarSolicitud.isPending ||
                      correccionSolicitud.isPending
                    }
                    className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 transition-colors ${
                      modoRechazoSol === "cancelar"
                        ? "bg-red-600 hover:bg-red-700"
                        : "bg-amber-500 hover:bg-amber-600"
                    }`}
                  >
                    {cancelarSolicitud.isPending || correccionSolicitud.isPending
                      ? "Procesando..."
                      : modoRechazoSol === "cancelar"
                        ? "Confirmar cancelación"
                        : "Confirmar corrección"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setModoRechazoSol(null)
                      setTextoRechazoSol("")
                      setErrorOC(null)
                    }}
                    className="rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          ) : null}
            {mostrarCancelarDirectivo ? (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                <div className="bg-card rounded-xl shadow-xl p-6 w-full max-w-md space-y-4">
                  <h3 className="text-base font-semibold text-foreground">Cancelar solicitud (directivo)</h3>
                  <p className="text-sm text-muted-foreground">
                    La solicitud quedará cancelada. Se notificará al solicitante por correo. Esta acción está
                    disponible hasta que el pedido esté marcado en plataforma.
                  </p>
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5">Motivo *</label>
                    <textarea
                      rows={4}
                      value={textoCancelarDirectivo}
                      onChange={(e) => setTextoCancelarDirectivo(e.target.value)}
                      className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
                      placeholder="Justificación de la cancelación..."
                      autoFocus
                    />
                  </div>
                  <div className="flex gap-3 pt-1">
                    <button
                      type="button"
                      onClick={handleConfirmarCancelarDirectivo}
                      disabled={textoCancelarDirectivo.trim().length < 3 || cancelarSolicitud.isPending}
                      className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {cancelarSolicitud.isPending ? "Procesando..." : "Confirmar cancelación"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMostrarCancelarDirectivo(false)
                        setTextoCancelarDirectivo("")
                      }}
                      className="rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-muted"
                    >
                      Cerrar
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Modal de archivado — solo admin */}
            {mostrarModalArchivar && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                <div className="bg-card rounded-xl shadow-xl p-6 w-full max-w-md space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
                      <svg className="h-5 w-5 text-amber-600" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M2 3a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H2Z" />
                        <path fillRule="evenodd" d="M2 7.5h16l-1.577 8.239A2 2 0 0 1 14.438 17H5.562a2 2 0 0 1-1.985-1.76L2 7.5ZM7.5 11a.75.75 0 0 1 .75-.75h3.5a.75.75 0 0 1 0 1.5h-3.5A.75.75 0 0 1 7.5 11Z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-foreground">
                        {solicitud.archivada ? "Desarchivar solicitud" : "Archivar solicitud"}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {solicitud.archivada ? "La solicitud volverá a aparecer en listas y KPIs" : "La solicitud se ocultará de listas y KPIs"}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                    <p className="font-semibold">{solicitud.consecutivo_os}</p>
                    <p className="text-xs mt-0.5 text-amber-700">{solicitud.descripcion}</p>
                  </div>

                  {!solicitud.archivada && (
                    <p className="text-sm text-foreground">
                      Los datos se conservan intactos. La solicitud no aparecerá en los KPIs ni en el listado de compras.
                      Puedes desarchivarla en cualquier momento.
                    </p>
                  )}

                  {errorArchivar && (
                    <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                      {errorArchivar}
                    </p>
                  )}

                  <div className="flex gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setErrorArchivar(null)
                        archivarSolicitud.mutate(solicitud.id, {
                          onSuccess: () => {
                            setMostrarModalArchivar(false)
                            if (!solicitud.archivada) navigate("/oc/solicitudes")
                          },
                          onError: (err: unknown) => {
                            const e = err as { response?: { data?: { detail?: string } } }
                            setErrorArchivar(e?.response?.data?.detail ?? "Error al archivar la solicitud.")
                          },
                        })
                      }}
                      disabled={archivarSolicitud.isPending}
                      className="flex-1 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50 transition-colors"
                    >
                      {archivarSolicitud.isPending
                        ? "Procesando..."
                        : solicitud.archivada
                          ? "Sí, desarchivar"
                          : "Sí, archivar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setMostrarModalArchivar(false); setErrorArchivar(null) }}
                      disabled={archivarSolicitud.isPending}
                      className="rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-muted disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Modal de eliminación permanente — solo admin */}
            {mostrarModalEliminar && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                <div className="bg-card rounded-xl shadow-xl p-6 w-full max-w-md space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
                      <svg className="h-5 w-5 text-red-600" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-foreground">Eliminar solicitud</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">Esta acción es permanente e irreversible</p>
                    </div>
                  </div>

                  <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
                    <p className="font-semibold">{solicitud.consecutivo_os}</p>
                    <p className="text-xs mt-0.5 text-red-700">{solicitud.descripcion}</p>
                  </div>

                  <p className="text-sm text-foreground">
                    Se eliminarán permanentemente la solicitud, sus cotizaciones, historial, órdenes de compra
                    y todos los archivos asociados (PDFs, fotos, proforma).
                    <strong className="text-foreground"> Los KPIs se actualizarán automáticamente.</strong>
                  </p>

                  {errorEliminar && (
                    <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                      {errorEliminar}
                    </p>
                  )}

                  <div className="flex gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setErrorEliminar(null)
                        eliminarSolicitud.mutate(solicitud.id, {
                          onSuccess: () => navigate("/oc/solicitudes"),
                          onError: (err: unknown) => {
                            const e = err as { response?: { data?: { detail?: string } } }
                            setErrorEliminar(e?.response?.data?.detail ?? "Error al eliminar la solicitud.")
                          },
                        })
                      }}
                      disabled={eliminarSolicitud.isPending}
                      className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      {eliminarSolicitud.isPending ? "Eliminando..." : "Sí, eliminar definitivamente"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setMostrarModalEliminar(false); setErrorEliminar(null) }}
                      disabled={eliminarSolicitud.isPending}
                      className="rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-muted disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {mostrarCorreccionDirectivo && cotizacionAprobada ? (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                <div
                  className="bg-card rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col"
                  role="dialog"
                  aria-labelledby="corr-dir-title"
                >
                  <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4 shrink-0">
                    <div>
                      <h3 id="corr-dir-title" className="text-base font-semibold text-foreground">
                        Corrección directiva de la cotización
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        El estado del flujo no cambia. Si la OC ya fue enviada al proveedor, se regenera el PDF y se reenvía
                        automáticamente cuando aplique.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setMostrarCorreccionDirectivo(false); setCorrDirError(null) }}
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label="Cerrar"
                    >
                      ×
                    </button>
                  </div>
                  <div className="overflow-y-auto px-5 py-4 space-y-5">
                    {corrDirError ? (
                      <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-700">
                        {corrDirError}
                      </div>
                    ) : null}
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Proveedor</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="sm:col-span-2">
                          <label className="block text-xs text-muted-foreground mb-1">Nombre *</label>
                          <input
                            type="text"
                            value={corrDirProveedorNombre}
                            onChange={(e) => setCorrDirProveedorNombre(e.target.value)}
                            className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">NIT</label>
                          <input
                            type="text"
                            value={corrDirProveedorNit}
                            onChange={(e) => setCorrDirProveedorNit(e.target.value)}
                            className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">Email</label>
                          <input
                            type="email"
                            value={corrDirProveedorEmail}
                            onChange={(e) => setCorrDirProveedorEmail(e.target.value)}
                            className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-xs text-muted-foreground mb-1">N° cotización proveedor</label>
                          <input
                            type="text"
                            value={corrDirNumeroCot}
                            onChange={(e) => setCorrDirNumeroCot(e.target.value)}
                            className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                          />
                        </div>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Valores</p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <FormFieldCOP
                          label="Subtotal sin IVA"
                          value={parseCopNumber(corrDirValorAntesIva)}
                          onChange={(v) => {
                            setCorrDirValorAntesIva(v != null ? String(roundCOP(v)) : "")
                          }}
                          inputClassName="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                        <FormFieldCOP
                          label="IVA (si aplica)"
                          value={parseCopNumber(corrDirValorIva)}
                          onChange={(v) => {
                            setCorrDirValorIva(v != null ? String(roundCOP(v)) : "")
                          }}
                          inputClassName="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                        <FormFieldCOP
                          label="Total *"
                          value={parseCopNumber(corrDirValorTotal)}
                          onChange={(v) => {
                            setCorrDirValorTotal(v != null ? String(roundCOP(v)) : "")
                          }}
                          inputClassName="w-full rounded-lg border border-border px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      </div>
                      <div className="mt-2 max-w-xs">
                        <FormFieldCOP
                          label="Valor aprobado"
                          value={parseCopNumber(corrDirValorAprobado)}
                          onChange={(v) => setCorrDirValorAprobado(v != null ? String(v) : "")}
                          inputClassName="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Condiciones</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">Forma de pago</label>
                          <input
                            type="text"
                            value={corrDirFormaPago}
                            onChange={(e) => setCorrDirFormaPago(e.target.value)}
                            className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">Plazo de entrega</label>
                          <input
                            type="text"
                            value={corrDirPlazoEntrega}
                            onChange={(e) => setCorrDirPlazoEntrega(e.target.value)}
                            className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-xs text-muted-foreground mb-1">Observaciones (cotización)</label>
                          <textarea
                            rows={2}
                            value={corrDirObsCotizacion}
                            onChange={(e) => setCorrDirObsCotizacion(e.target.value)}
                            className="w-full rounded-lg border border-border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                          />
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ítems</p>
                        <button
                          type="button"
                          onClick={() =>
                            setCorrDirItems((rows) => [
                              ...rows,
                              { num: rows.length + 1, descripcion: "", cantidad: 1 },
                            ])
                          }
                          className="text-xs font-medium text-primary hover:underline"
                        >
                          + Agregar ítem
                        </button>
                      </div>
                      <div className="overflow-x-auto rounded-lg border border-border">
                        <table className="min-w-full text-xs">
                          <thead className="bg-muted">
                            <tr>
                              <th className="px-2 py-2 text-left font-medium text-muted-foreground">#</th>
                              <th className="px-2 py-2 text-left font-medium text-muted-foreground">Descripción *</th>
                              <th className="px-2 py-2 text-left font-medium text-muted-foreground">Ref.</th>
                              <th className="px-2 py-2 text-right font-medium text-muted-foreground">Cant.</th>
                              <th className="px-2 py-2 text-right font-medium text-muted-foreground">V. unit.</th>
                              <th className="px-2 py-2 text-right font-medium text-muted-foreground">V. total</th>
                              <th className="px-1 py-2" />
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {corrDirItems.map((row, idx) => (
                              <tr key={idx} className="bg-background">
                                <td className="px-2 py-1.5 text-muted-foreground font-mono w-8">{idx + 1}</td>
                                <td className="px-2 py-1.5">
                                  <input
                                    type="text"
                                    value={row.descripcion}
                                    onChange={(e) => {
                                      const v = e.target.value
                                      patchCorrDirItem(idx, "meta", (r) => ({ ...r, descripcion: v }))
                                    }}
                                    className="w-full min-w-[140px] rounded border border-border px-2 py-1"
                                  />
                                </td>
                                <td className="px-2 py-1.5">
                                  <input
                                    type="text"
                                    value={row.referencia ?? ""}
                                    onChange={(e) => {
                                      const v = e.target.value
                                      patchCorrDirItem(idx, "meta", (r) => ({ ...r, referencia: v }))
                                    }}
                                    className="w-20 rounded border border-border px-2 py-1"
                                  />
                                </td>
                                <td className="px-2 py-1.5 text-right">
                                  <input
                                    type="number"
                                    value={row.cantidad ?? ""}
                                    onChange={(e) => {
                                      const n = e.target.value === "" ? undefined : Number(e.target.value)
                                      patchCorrDirItem(idx, "cantidad", (r) => ({ ...r, cantidad: n }))
                                    }}
                                    className="w-16 rounded border border-border px-2 py-1 text-right"
                                  />
                                </td>
                                <td className="px-2 py-1.5 text-right">
                                  <input
                                    type="number"
                                    value={row.valor_unitario ?? ""}
                                    onChange={(e) => {
                                      const n = e.target.value === "" ? undefined : Number(e.target.value)
                                      patchCorrDirItem(idx, "valor_unitario", (r) => ({
                                        ...r,
                                        valor_unitario: n,
                                      }))
                                    }}
                                    className="w-24 rounded border border-border px-2 py-1 text-right"
                                  />
                                </td>
                                <td className="px-2 py-1.5 text-right">
                                  <input
                                    type="number"
                                    value={row.valor_total ?? ""}
                                    onChange={(e) => {
                                      const n = e.target.value === "" ? undefined : Number(e.target.value)
                                      patchCorrDirItem(idx, "valor_total", (r) => ({ ...r, valor_total: n }))
                                    }}
                                    className="w-24 rounded border border-border px-2 py-1 text-right"
                                  />
                                </td>
                                <td className="px-1 py-1.5">
                                  <button
                                    type="button"
                                    disabled={corrDirItems.length <= 1}
                                    onClick={() => {
                                      setCorrDirItems((rows) => {
                                        const next = rows.filter((_, i) => i !== idx)
                                        queueMicrotask(() => syncCorrDirHeaderFromItems(next))
                                        return next
                                      })
                                    }}
                                    className="text-red-500 hover:text-red-700 disabled:opacity-30 text-lg leading-none"
                                    aria-label="Eliminar ítem"
                                  >
                                    ×
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    {["cerrada", "entregada"].includes(solicitud.estado) && (
                      <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-2">
                        <p className="text-xs font-semibold text-red-700 uppercase tracking-wide">
                          ⚠ Corrección sobre proceso cerrado
                        </p>
                        <p className="text-xs text-red-600">
                          Esta solicitud ya está <strong>{solicitud.estado}</strong>. Esta acción es excepcional,
                          quedará registrada y se te enviará una notificación de alerta.
                        </p>
                        <label className="block text-xs font-medium text-red-700 mt-1">
                          Justificación de la corrección (obligatoria) *
                        </label>
                        <textarea
                          rows={3}
                          value={corrDirMotivoCierre}
                          onChange={(e) => setCorrDirMotivoCierre(e.target.value)}
                          className="w-full rounded-lg border border-red-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-400/40 bg-background"
                          placeholder="Ej. Error en el NIT detectado en auditoría del 15/05/2026, requiere corrección para cierre contable..."
                        />
                      </div>
                    )}
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">
                        Motivo de la corrección (visible en historial y correos) — mín. 5 caracteres *
                      </label>
                      <textarea
                        rows={3}
                        value={corrDirNotaDirectivo}
                        onChange={(e) => setCorrDirNotaDirectivo(e.target.value)}
                        className="w-full rounded-lg border border-border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                        placeholder="Ej. Se corrigió el NIT y el valor acordado con el proveedor..."
                      />
                    </div>
                  </div>
                  <div className="flex gap-3 border-t border-border px-5 py-4 shrink-0 bg-muted/80 rounded-b-xl">
                    <button
                      type="button"
                      onClick={handleGuardarCorreccionDirectiva}
                      disabled={corregirDirectivo.isPending}
                      className="flex-1 rounded-lg bg-brand-blue px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
                    >
                      {corregirDirectivo.isPending ? "Guardando..." : "Guardar corrección"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setMostrarCorreccionDirectivo(false); setCorrDirError(null) }}
                      className="rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground hover:bg-muted"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        }
      >
          {/* Breadcrumb */}
          <button
            onClick={() => navigate("/oc/solicitudes")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
          >
            ← Volver
          </button>

          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <span className="font-mono text-sm font-bold text-primary">
                  {solicitud.consecutivo_os}
                </span>
                <EstadoBadge estado={solicitud.estado} />
                {solicitud.archivada && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                    Archivada
                  </span>
                )}
                {solicitud.tipo_solicitud === "mantenimiento" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                    Mantenimiento
                  </span>
                )}
              </div>
              <h1 className="text-xl font-bold text-foreground">{solicitud.descripcion}</h1>
            </div>

            <div className="flex gap-2 shrink-0 flex-wrap justify-end">
              {muestraAccionesDirectorCotizada ? (
                <>
                  <button
                    type="button"
                    onClick={() => setMostrarCancelarDirectivo(true)}
                    className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100 transition-colors"
                  >
                    Cancelar solicitud
                  </button>
                  <button
                    type="button"
                    onClick={abrirModalCorreccionDirectiva}
                    className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
                  >
                    Corregir cotización directivo
                  </button>
                </>
              ) : null}
              {(esAuxiliarAsignado || puedeAsignarOtro || puedeAsignarse) &&
                (["nueva", "en_cotizacion", "pendiente_aprobacion", "en_correccion"] as string[]).includes(
                  solicitud.estado,
                ) && (
                  <button
                    onClick={() => {
                      setErrorOC(null)
                      setModoRechazoSol("cancelar")
                      setTextoRechazoSol("")
                    }}
                    className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100 transition-colors"
                  >
                    {solicitudYaEnCorreccion ? "Cancelar solicitud" : "Rechazar solicitud"}
                  </button>
                )}
              {puedeAsignarse &&
                (["nueva", "en_cotizacion", "en_correccion"] as string[]).includes(solicitud.estado) && (
                <button
                  onClick={handleAsignarme}
                  disabled={asignar.isPending}
                  className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {asignar.isPending ? "Asignando..." : "Asignarme esta solicitud"}
                </button>
              )}
              {/* Archivar / Desarchivar — solo admin */}
              {user?.role === "admin" && (
                <button
                  type="button"
                  onClick={() => { setMostrarModalArchivar(true); setErrorArchivar(null) }}
                  title={solicitud.archivada ? "Desarchivar solicitud (solo admin)" : "Archivar solicitud — oculta de KPIs (solo admin)"}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    solicitud.archivada
                      ? "border-amber-400 bg-amber-50 text-amber-700 hover:bg-amber-100"
                      : "border-amber-300 bg-card text-amber-500 hover:bg-amber-50 hover:border-amber-400"
                  }`}
                >
                  <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M2 3a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H2Z" />
                    <path fillRule="evenodd" d="M2 7.5h16l-1.577 8.239A2 2 0 0 1 14.438 17H5.562a2 2 0 0 1-1.985-1.76L2 7.5ZM7.5 11a.75.75 0 0 1 .75-.75h3.5a.75.75 0 0 1 0 1.5h-3.5A.75.75 0 0 1 7.5 11Z" clipRule="evenodd" />
                  </svg>
                </button>
              )}
              {/* Eliminar solicitud — solo admin, para limpiar duplicados/errores */}
              {user?.role === "admin" && (
                <button
                  type="button"
                  onClick={() => { setMostrarModalEliminar(true); setErrorEliminar(null) }}
                  title="Eliminar solicitud permanentemente (solo admin)"
                  className="rounded-lg border border-red-300 bg-card px-3 py-2 text-sm font-medium text-red-500 hover:bg-red-50 hover:border-red-400 transition-colors"
                >
                  <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clipRule="evenodd" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Columna principal */}
            <div className="lg:col-span-2 space-y-4">

              {/* Panel de aprobación — visible solo para directivo/admin cuando hay cotización pendiente */}
              {esAprobador &&
                solicitud.estado === "pendiente_aprobacion" &&
                cotizacionPendiente && (
                  <PanelAprobacion
                    cotizacion={cotizacionPendiente}
                    onAprobar={(cotizacionId, valor, obs) =>
                      aprobar.mutate({
                        cotizacionId,
                        valor_aprobado: valor,
                        observaciones_aprobacion: obs,
                      })
                    }
                    onRechazar={(cotizacionId, obs) =>
                      rechazar.mutate({ cotizacionId, observaciones_aprobacion: obs })
                    }
                    onCancelar={(cotizacionId, justificacion) =>
                      cancelarCotizacion.mutate({ cotizacionId, justificacion })
                    }
                    onCorreccion={(cotizacionId, que_corregir, destino) =>
                      correccionCotizacion.mutate({ cotizacionId, que_corregir, destino })
                    }
                    onEditar={(cotizacionId, payload) =>
                      editarCotizacion.mutate({ cotizacionId, payload })
                    }
                    isLoading={aprobar.isPending || rechazar.isPending || cancelarCotizacion.isPending || correccionCotizacion.isPending || editarCotizacion.isPending}
                  />
                )}

              {/* Panel Orden de Compra — visible desde aprobada en adelante */}
              {(solicitud.estado === "aprobada" ||
                solicitud.estado === "oc_enviada" ||
                solicitud.estado === "oc_en_plataforma" ||
                solicitud.estado === "entregada" ||
                solicitud.estado === "cerrada") && (
                <PanelOrdenCompra
                  key={solicitud.estado}
                  estado={solicitud.estado}
                  orden={orden ?? null}
                  plataforma={solicitud.plataforma ?? ""}
                  puedeGenerar={puedeGenerarOC}
                  emailProveedorInicial={cotizacionAprobada?.proveedor_email ?? orden?.email_proveedor ?? ""}
                  isGenerating={generarOC.isPending}
                  isActualizando={actualizarGestion.isPending}
                  isMarkingEnviada={marcarEnviada.isPending}
                  isMarkingEnPlataforma={marcarEnPlataforma.isPending}
                  isMarkingEntregada={marcarEntregada.isPending}
                  isClosing={cerrarSolicitud.isPending}
                  onGenerar={handleGuardarYGenerar}
                  onRegenerar={(p) => {
                    actualizarGestion.mutate(
                      { id: solicitud.id, payload: { plataforma: p } },
                      { onSuccess: () => handleGenerarOC(true) }
                    )
                  }}
                  onDescargar={handleDescargar}
                  onMarcarEnviada={(email) => marcarEnviada.mutate({ id: solicitud.id, email_proveedor: email })}
                  onMarcarEnPlataforma={() => marcarEnPlataforma.mutate(solicitud.id)}
                  onMarcarEntregada={() => marcarEntregada.mutate(solicitud.id)}
                  onCerrar={() => cerrarSolicitud.mutate(solicitud.id)}
                />
              )}

              {errorOC && (
                <div className="mt-2 rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
                  {errorOC}
                </div>
              )}

              {/* Tabla comparativa — solo cuando hay más de 1 cotización */}
              {cotizaciones.length > 1 && (
                <Section title="Comparativa de cotizaciones">
                  <TablaCotizacionesComparativa cotizaciones={cotizaciones} />
                </Section>
              )}

              {/* Cotizaciones cargadas */}
              {cotizaciones.length > 0 && (
                <Section title={`Cotizaciones (${cotizaciones.length})`}>
                  {/* Indicador de cuántas cotizaciones se han subido */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                      cotizaciones.length === 1 ? "bg-muted text-foreground" : "bg-blue-50 text-blue-700"
                    }`}>
                      {cotizaciones.length === 1 ? "1 cotización presentada" : `${cotizaciones.length} cotizaciones presentadas`}
                    </span>
                    {cotizaciones.length === 1 && (
                      <span className="text-xs text-muted-foreground">El proceso recomienda 3 cotizaciones</span>
                    )}
                  </div>
                  <div className="space-y-3">
                    {cotizaciones.map((c) => (
                      <CotizacionCard key={c.id} cotizacion={c} />
                    ))}
                  </div>
                </Section>
              )}

              {muestraAyudaProformaPrevCotizacion && (
                <div className="rounded-xl border border-border bg-muted px-4 py-3 text-sm text-foreground">
                  <span className="font-medium text-foreground">Anticipo / proforma: </span>
                  podrá gestionarse después de usar <strong className="text-foreground">Cargar cotización</strong> por
                  primera vez en esta solicitud.
                </div>
              )}

              {muestraAvisoProformaSoloFinanciero && (
                <div className="rounded-xl border border-yellow-200 bg-yellow-50/80 px-4 py-3 text-sm text-yellow-900">
                  Esta solicitud tiene anticipo/proforma marcado. Una vez enviada la OC al proveedor, el archivo solo
                  puede consultarse desde el módulo <strong className="text-yellow-950">Financiero</strong>
                  (lista o detalle de facturas por solicitud).
                </div>
              )}

              {puedeGestionarProforma && (
              <div className={`rounded-xl border px-4 py-3 space-y-3 ${
                solicitud.tiene_proforma
                  ? "border-yellow-300 bg-yellow-50"
                  : "border-border bg-card"
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <svg className={`w-4 h-4 ${solicitud.tiene_proforma ? "text-yellow-600" : "text-muted-foreground"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
                    </svg>
                    <span className={`text-sm font-semibold ${solicitud.tiene_proforma ? "text-yellow-800" : "text-muted-foreground"}`}>
                      {solicitud.tiene_proforma ? "Tiene anticipo / proforma" : "Sin anticipo / proforma"}
                    </span>
                    {solicitud.tiene_proforma && (
                      <span className="rounded-full bg-yellow-200 px-2 py-0.5 text-[10px] font-bold text-yellow-800 uppercase tracking-wide">
                        Activo
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setProformaMutationError(null)
                      actualizarProforma.mutate(!solicitud.tiene_proforma, {
                        onSuccess: () => setProformaMutationError(null),
                        onError: (err) => setProformaMutationError(getApiError(err)),
                      })
                    }}
                    disabled={actualizarProforma.isPending}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
                      solicitud.tiene_proforma
                        ? "border-yellow-300 bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                        : "border-border bg-card text-foreground hover:bg-muted"
                    }`}
                  >
                    {actualizarProforma.isPending
                      ? "Guardando..."
                      : solicitud.tiene_proforma
                      ? "Desactivar"
                      : "Activar proforma"}
                  </button>
                </div>

                {/* Upload y visualización de archivo de proforma */}
                {solicitud.tiene_proforma && (
                  <div className="flex flex-col gap-2 pt-1 border-t border-yellow-200">
                    <div className="flex items-center gap-3 flex-wrap">
                      {solicitud.proforma_path ? (
                        <button
                          type="button"
                          onClick={async () => {
                            setProformaMutationError(null)
                            try {
                              const resp = await api.get(
                                `/api/oc/solicitudes/${solicitud.id}/proforma/descargar`,
                                { responseType: "blob" }
                              )
                              const url = URL.createObjectURL(resp.data as Blob)
                              window.open(url, "_blank")
                            } catch (err) {
                              setProformaMutationError(getApiError(err))
                            }
                          }}
                          className="flex items-center gap-1.5 text-xs font-medium text-yellow-700 underline hover:text-yellow-900"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          Ver proforma subida
                        </button>
                      ) : (
                        <span className="text-xs text-yellow-600 italic">Sin archivo de proforma aún</span>
                      )}
                      <label className="flex items-center gap-1.5 cursor-pointer rounded-lg border border-yellow-300 bg-card px-3 py-1.5 text-xs font-semibold text-yellow-700 hover:bg-yellow-50 transition-colors disabled:opacity-50">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        {subirProforma.isPending ? "Subiendo..." : solicitud.proforma_path ? "Reemplazar" : "Subir proforma"}
                        <input
                          type="file"
                          className="hidden"
                          accept=".pdf,.xlsx,.xls,.docx,.jpg,.jpeg,.png,.msg"
                          disabled={subirProforma.isPending}
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (!file) return
                            if (file.size > 20 * 1024 * 1024) { setProformaMutationError("El archivo supera el límite de 20 MB."); e.target.value = ""; return }
                            setProformaMutationError(null)
                            subirProforma.mutate(file, {
                              onSuccess: () => setProformaMutationError(null),
                              onError: (err) => setProformaMutationError(getApiError(err)),
                            })
                            e.target.value = ""
                          }}
                        />
                      </label>
                    </div>
                    {proformaMutationError && (
                      <p className="text-xs text-red-600" role="alert">
                        {proformaMutationError}
                      </p>
                    )}
                  </div>
                )}
              </div>
              )}

              {/* Fotos de evidencia (cotización) — visible solo cuando el auxiliar está cotizando */}
              {solicitud.estado === "en_cotizacion" && (
                <Section title="Fotos de evidencia (cotización)">
                  <p className="text-xs text-muted-foreground mb-3">
                    Sube fotos de lo que cotizaste: capturas de pantalla, fotos de productos, referencias visuales, etc.
                  </p>
                  <div
                    onDragOver={(e) => { e.preventDefault(); setEvidenciaDragOver(true) }}
                    onDragLeave={() => setEvidenciaDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault()
                      setEvidenciaDragOver(false)
                      const existentes = (solicitud.fotos_producto ?? []).length
                      const disponibles = Math.max(0, 5 - existentes)
                      const files = Array.from(e.dataTransfer.files).slice(0, disponibles)
                      for (const f of files) {
                        if (f.size > 20 * 1024 * 1024) { alert(`"${f.name}" supera el límite de 20 MB.`); continue }
                        if (id) subirFoto.mutate({ solicitudId: id, file: f })
                      }
                    }}
                    onClick={() => evidenciaInputRef.current?.click()}
                    className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 cursor-pointer transition-colors ${
                      evidenciaDragOver
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40 hover:bg-muted"
                    }`}
                  >
                    <svg className="w-8 h-8 text-muted-foreground/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                    </svg>
                    <p className="text-sm font-medium text-foreground">
                      {subirFoto.isPending ? "Subiendo..." : evidenciaDragOver ? "Suelta aquí" : "Arrastra o haz clic para subir"}
                    </p>
                    <p className="text-xs text-muted-foreground">JPG, PNG, PDF, Excel, Word, MSG — hasta 5 archivos, máx 20 MB c/u</p>
                  </div>
                  <input
                    ref={evidenciaInputRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.xlsx,.docx,.msg"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const existentes = (solicitud.fotos_producto ?? []).length
                      const disponibles = Math.max(0, 5 - existentes)
                      const files = Array.from(e.target.files ?? []).slice(0, disponibles)
                      for (const f of files) {
                        if (f.size > 20 * 1024 * 1024) { alert(`"${f.name}" supera el límite de 20 MB.`); continue }
                        if (id) subirFoto.mutate({ solicitudId: id, file: f })
                      }
                      e.target.value = ""
                    }}
                  />
                  {(solicitud.fotos_producto ?? []).length > 0 && (
                    <div className="mt-4 grid grid-cols-3 gap-3">
                      {(solicitud.fotos_producto ?? []).map((filename) => (
                        <div key={filename} className="relative group rounded-lg overflow-hidden border border-border bg-muted">
                          {/\.(jpg|jpeg|png|gif|webp)$/i.test(filename) ? (
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
                              className="flex flex-col items-center justify-center h-24 gap-1 text-muted-foreground hover:text-primary transition-colors"
                            >
                              <svg className="w-7 h-7" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M4 4a2 2 0 0 1 2-2h4.586A2 2 0 0 1 12 2.586L15.414 6A2 2 0 0 1 16 7.414V16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4Z" clipRule="evenodd" />
                              </svg>
                              <span className="text-xs px-1 truncate max-w-full">{filename.split(".").pop()?.toUpperCase()}</span>
                            </a>
                          )}
                          <button
                            onClick={() => id && eliminarFoto.mutate({ solicitudId: id, filename })}
                            disabled={eliminarFoto.isPending}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </Section>
              )}

              {/* Datos del pedido */}
              <Section title="Detalle del Pedido">
                <InfoGrid>
                  <InfoItem label="Descripción" value={solicitud.descripcion} />
                  <InfoItem label="Cantidad" value={String(solicitud.cantidad)} />
                  <InfoItem label="Categoría" value={solicitud.categoria} />
                  <InfoItem label="Grupo de artículos" value={solicitud.grupo_articulos} />
                  {puedeEditarPrioridad ? (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Prioridad</p>
                      <select
                        value={solicitud.nivel_prioridad}
                        disabled={cambiarPrioridad.isPending}
                        onChange={(e) =>
                          cambiarPrioridad.mutate({ id: solicitud.id, nivel_prioridad: e.target.value })
                        }
                        className="rounded-md border border-border px-2 py-1 text-sm font-medium text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                      >
                        <option value="Alta">Alta</option>
                        <option value="Media">Media</option>
                        <option value="Baja">Baja</option>
                      </select>
                    </div>
                  ) : (
                    <InfoItem label="Prioridad" value={solicitud.nivel_prioridad} />
                  )}
                  <InfoItem label="Cliente" value={solicitud.cliente} />
                  <InfoItem label="Condición" value={solicitud.condicion} />
                  <InfoItem label="Placa / Ficha técnica" value={solicitud.placa_ficha} />
                  {solicitud.tipo_solicitud === "mantenimiento" && solicitud.tipo_mantenimiento && (
                    <InfoItem
                      label="Tipo mantenimiento"
                      value={solicitud.tipo_mantenimiento.charAt(0).toUpperCase() + solicitud.tipo_mantenimiento.slice(1)}
                    />
                  )}
                  {solicitud.fecha_proximo_mantenimiento && (
                    <InfoItem
                      label="Próximo mantenimiento"
                      value={solicitud.fecha_proximo_mantenimiento}
                    />
                  )}
                </InfoGrid>
                {solicitud.observaciones_solicitante && (
                  <div className="mt-3 pt-3 border-t border-border/30">
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      Observaciones del solicitante
                    </p>
                    <p className="text-sm text-foreground">{solicitud.observaciones_solicitante}</p>
                  </div>
                )}
              </Section>

              {/* Datos del solicitante */}
              <Section title="Solicitante">
                <InfoGrid>
                  <InfoItem label="Nombre" value={solicitud.solicitante_nombre} />
                  <InfoItem label="Email" value={solicitud.solicitante_email} />
                  <InfoItem label="Área" value={solicitud.area_solicitante} />
                  <InfoItem label="Plataforma" value={solicitud.plataforma} />
                </InfoGrid>
                {solicitud.evidencia_url && (
                  <div className="mt-3 pt-3 border-t border-border/30">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Evidencia adjunta</p>
                    <a
                      href={solicitud.evidencia_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                    >
                      📎 Ver evidencia
                    </a>
                  </div>
                )}
              </Section>
            </div>

            {/* Columna lateral */}
            <div className="space-y-4">
              <Section title="Estado del Proceso">
                <div className="space-y-2">
                  <TimelineItem label="Solicitud recibida" date={solicitud.fecha_solicitud} done />
                  <TimelineItem
                    label="Asignada a compras"
                    date={solicitud.fecha_asignacion}
                    done={!!solicitud.fecha_asignacion}
                  />
                  <TimelineItem
                    label="Cotización lista"
                    date={solicitud.fecha_cotizacion}
                    done={!!solicitud.fecha_cotizacion}
                  />
                  <TimelineItem
                    label="Aprobación"
                    date={solicitud.fecha_aprobacion}
                    done={!!solicitud.fecha_aprobacion}
                  />
                  <TimelineItem
                    label="OC enviada"
                    date={solicitud.fecha_envio_oc}
                    done={!!solicitud.fecha_envio_oc}
                  />
                  <TimelineItem
                    label="En plataforma"
                    date={solicitud.fecha_en_plataforma}
                    done={!!solicitud.fecha_en_plataforma}
                  />
                  <TimelineItem
                    label="Recibido por líder"
                    date={solicitud.fecha_recibido}
                    done={!!solicitud.fecha_recibido}
                  />
                </div>
              </Section>

              {/* Historial dinámico de cambios de estado */}
              {historial.length > 0 && (
                <Section title="Historial de cambios">
                  <HistorialTimeline entradas={historial} />
                </Section>
              )}

              {/* Solicitud rechazada (legacy) */}
              {solicitud.estado === "rechazada" && cotizaciones.length === 0 && (
                <Section title="Estado: Rechazada">
                  <div className="rounded-lg bg-red-50 border border-red-100 p-4 space-y-2">
                    <p className="text-sm font-semibold text-red-800">Solicitud rechazada por el equipo de compras</p>
                    {(() => {
                      const entradaRechazo = historial.find((h) => h.estado_nuevo === "rechazada")
                      return entradaRechazo?.notas ? (
                        <div className="mt-1 rounded bg-red-100 border border-red-200 px-3 py-2">
                          <p className="text-xs font-medium text-red-700 mb-0.5">Motivo del rechazo</p>
                          <p className="text-xs text-red-800">{entradaRechazo.notas}</p>
                          {entradaRechazo.usuario_nombre && (
                            <p className="text-xs text-red-500 mt-1">— {entradaRechazo.usuario_nombre}</p>
                          )}
                        </div>
                      ) : null
                    })()}
                    <p className="text-xs text-red-600">
                      Se le ha notificado al solicitante por correo. No requiere más gestión de tu parte.
                    </p>
                  </div>
                </Section>
              )}

              {/* Solicitud cancelada definitivamente */}
              {solicitud.estado === "cancelada" && (
                <Section title="Estado: Cancelada">
                  <div className="rounded-lg bg-red-50 border border-red-200 p-4 space-y-2">
                    <p className="text-sm font-semibold text-red-800">Solicitud cancelada definitivamente</p>
                    {(() => {
                      const entrada = historial.find((h) => h.estado_nuevo === "cancelada")
                      return entrada?.notas ? (
                        <div className="mt-1 rounded bg-red-100 border border-red-200 px-3 py-2">
                          <p className="text-xs font-medium text-red-700 mb-0.5">Motivo</p>
                          <p className="text-xs text-red-800">{entrada.notas}</p>
                          {entrada.usuario_nombre && (
                            <p className="text-xs text-red-500 mt-1">— {entrada.usuario_nombre}</p>
                          )}
                        </div>
                      ) : null
                    })()}
                    <p className="text-xs text-red-600">No requiere más gestión.</p>
                  </div>
                </Section>
              )}

              {/* Solicitud en corrección — panel para el solicitante */}
              {solicitud.estado === "en_correccion" && esSolicitante && (
                <Section title="Corrección requerida">
                  <div className="space-y-3">
                    {/* Nota de corrección del equipo de compras */}
                    {solicitud.observaciones_compras ? (
                      <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                        <p className="text-xs font-semibold text-amber-800 mb-1">Qué debes corregir:</p>
                        <p className="text-xs text-amber-900">{solicitud.observaciones_compras}</p>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">El equipo de compras requiere que corrijas tu solicitud.</p>
                    )}

                    {/* Formulario de edición */}
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-foreground">Edita los campos que necesitas corregir:</p>
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">Descripción</label>
                        <input
                          type="text"
                          value={corrDesc}
                          onChange={(e) => setCorrDesc(e.target.value)}
                          placeholder={solicitud.descripcion}
                          className="w-full rounded-lg border border-border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">Cantidad</label>
                        <input
                          type="number"
                          value={corrCantidad}
                          onChange={(e) => setCorrCantidad(e.target.value)}
                          placeholder={String(solicitud.cantidad)}
                          min="1"
                          className="w-full rounded-lg border border-border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">Observaciones</label>
                        <textarea
                          value={corrObs}
                          onChange={(e) => setCorrObs(e.target.value)}
                          placeholder={solicitud.observaciones_solicitante ?? "Añade observaciones..."}
                          rows={3}
                          className="w-full rounded-lg border border-border px-3 py-1.5 text-sm focus:outline-none resize-none focus:ring-2 focus:ring-amber-400"
                        />
                      </div>
                      {editarCorreccion.isError && (
                        <p className="text-xs text-red-500">
                          Error al guardar. Verifica los campos e intenta de nuevo.
                        </p>
                      )}
                      <button
                        onClick={handleEditarCorreccion}
                        disabled={editarCorreccion.isPending || (!corrDesc.trim() && !corrCantidad.trim() && !corrObs.trim())}
                        className="w-full rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50 transition-colors"
                      >
                        {editarCorreccion.isPending ? "Enviando..." : "Enviar corrección"}
                      </button>
                    </div>
                  </div>
                </Section>
              )}

              {/* Solicitud en corrección — vista informativa para equipo de compras */}
              {solicitud.estado === "en_correccion" && !esSolicitante && (
                <Section title="En corrección">
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 space-y-2">
                    <p className="text-sm font-semibold text-amber-800">Esperando corrección del solicitante</p>
                    {solicitud.observaciones_compras && (
                      <div className="rounded bg-amber-100 border border-amber-200 px-3 py-2">
                        <p className="text-xs font-medium text-amber-700 mb-0.5">Instrucción enviada:</p>
                        <p className="text-xs text-amber-900">{solicitud.observaciones_compras}</p>
                      </div>
                    )}
                    <p className="text-xs text-amber-700">
                      Se notificó a <span className="font-medium">{solicitud.solicitante_nombre}</span>. La solicitud
                      volverá a en gestión cuando el solicitante envíe la corrección.
                    </p>
                  </div>
                </Section>
              )}

              {/* Acción auxiliar: cargar cotización */}
              {(esAuxiliarAsignado || tieneAccesoCompras) &&
                (solicitud.estado === "en_cotizacion" || (solicitud.estado === "rechazada" && cotizaciones.length > 0)) && (
                  <Section title="Gestión">
                    <p className="text-xs text-muted-foreground mb-3">
                      {solicitud.estado === "rechazada"
                        ? "La cotización fue rechazada. Carga una nueva."
                        : "Carga la cotización del proveedor para enviar a aprobación."}
                    </p>
                    <button
                      onClick={() => navigate(`/oc/solicitudes/${solicitud.id}/cotizar`)}
                      className="w-full rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
                    >
                      {solicitud.estado === "rechazada"
                        ? "Cargar nueva cotización"
                        : "Cargar cotización"}
                    </button>
                  </Section>
                )}

              {(solicitud.auxiliar_id || puedeAsignarOtro) && (
                <Section title="Auxiliar asignado">
                  {solicitud.auxiliar_id && (
                    <div className="mb-3">
                      <p className="text-sm font-semibold text-foreground">
                        {auxiliar?.full_name ?? `Usuario #${solicitud.auxiliar_id}`}
                      </p>
                      {auxiliar?.email && (
                        <p className="text-xs text-muted-foreground mt-0.5">{auxiliar.email}</p>
                      )}
                    </div>
                  )}
                  {puedeAsignarOtro && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">
                        {solicitud.auxiliar_id ? "Reasignar:" : "Asignar auxiliar:"}
                      </p>
                      <select
                        defaultValue=""
                        disabled={asignar.isPending || usuariosCompras.length === 0}
                        onChange={(e) => {
                          const val = Number(e.target.value)
                          if (!val || !id) return
                          asignar.mutate({ id, auxiliar_id: val })
                        }}
                        className="w-full rounded-lg border border-border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-background disabled:opacity-50"
                      >
                        <option value="" disabled>— Seleccionar —</option>
                        {usuariosCompras.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.full_name}
                          </option>
                        ))}
                      </select>
                      {asignar.isPending && (
                        <p className="text-xs text-primary">Asignando...</p>
                      )}
                    </div>
                  )}
                </Section>
              )}

              {/* Fotos / archivos de referencia del producto */}
              <Section title="Fotos del producto">
                <p className="text-xs text-muted-foreground mb-3">
                  Sube imágenes o archivos que ayuden a identificar el producto exacto.
                </p>
                <div
                  onDragOver={(e) => { e.preventDefault(); setFotoDragOver(true) }}
                  onDragLeave={() => setFotoDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setFotoDragOver(false)
                    const existentes = (solicitud.fotos_producto ?? []).length
                    const disponibles = Math.max(0, 5 - existentes)
                    const files = Array.from(e.dataTransfer.files).slice(0, disponibles)
                    for (const f of files) {
                      if (f.size > 20 * 1024 * 1024) { alert(`"${f.name}" supera el límite de 20 MB.`); continue }
                      if (id) subirFoto.mutate({ solicitudId: id, file: f })
                    }
                  }}
                  onClick={() => fotoInputRef.current?.click()}
                  className={`flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed py-4 cursor-pointer transition-colors text-xs ${
                    fotoDragOver
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/30 hover:bg-muted"
                  }`}
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                  </svg>
                  <span>{subirFoto.isPending ? "Subiendo..." : fotoDragOver ? "Suelta aquí" : "Arrastra o haz clic"}</span>
                </div>
                <input
                  ref={fotoInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.xlsx,.docx,.msg"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const existentes = (solicitud.fotos_producto ?? []).length
                    const disponibles = Math.max(0, 5 - existentes)
                    const files = Array.from(e.target.files ?? []).slice(0, disponibles)
                    for (const f of files) {
                      if (f.size > 20 * 1024 * 1024) { alert(`"${f.name}" supera el límite de 20 MB.`); continue }
                      if (id) subirFoto.mutate({ solicitudId: id, file: f })
                    }
                    e.target.value = ""
                  }}
                />
                {(solicitud.fotos_producto ?? []).length > 0 && (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {(solicitud.fotos_producto ?? []).map((filename) => (
                      <div key={filename} className="relative group rounded-lg overflow-hidden border border-border bg-muted">
                        {/\.(jpg|jpeg|png|gif|webp)$/i.test(filename) ? (
                          <img
                            src={buildFotoUrl(filename)}
                            alt={filename}
                            className="w-full h-16 object-cover cursor-pointer"
                            onClick={() => setModalImage({ url: buildFotoUrl(filename), filename })}
                          />
                        ) : (
                          <a
                            href={buildFotoUrl(filename)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex flex-col items-center justify-center h-16 gap-1 text-muted-foreground hover:text-primary transition-colors"
                          >
                            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M4 4a2 2 0 0 1 2-2h4.586A2 2 0 0 1 12 2.586L15.414 6A2 2 0 0 1 16 7.414V16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4Z" clipRule="evenodd" />
                            </svg>
                            <span className="text-xs">{filename.split(".").pop()?.toUpperCase()}</span>
                          </a>
                        )}
                        <button
                          onClick={() => id && eliminarFoto.mutate({ solicitudId: id, filename })}
                          disabled={eliminarFoto.isPending}
                          className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              {/* Panel gestión de compras — PENDIENTE: se moverá a vista de Gestión Financiera (contabilidad) */}
            </div>
          </div>
    </PageLayout>

      <ImageModal
        isOpen={!!modalImage}
        imageUrl={modalImage?.url || ""}
        filename={modalImage?.filename || ""}
        onClose={() => setModalImage(null)}
      />
    </>
  )
}

// ── Panel de aprobación ────────────────────────────────────────────────────────

function PanelAprobacion({
  cotizacion,
  onAprobar,
  onRechazar,
  onCancelar,
  onCorreccion,
  onEditar,
  isLoading,
}: {
  cotizacion: CotizacionProveedor
  onAprobar: (id: string, valor: number, obs?: string) => void
  onRechazar: (id: string, obs: string) => void
  onCancelar: (id: string, justificacion: string) => void
  onCorreccion: (id: string, que_corregir: string, destino: "auxiliar" | "solicitante") => void
  onEditar: (id: string, payload: EditarCotizacionPayload) => void
  isLoading: boolean
}) {
  const [modo, setModo] = useState<"idle" | "aprobar" | "rechazar" | "cancelar" | "correccion" | "editar">("idle")
  const [valorAprobado, setValorAprobado] = useState(cotizacion.valor_total)
  const [observaciones, setObservaciones] = useState("")
  const [motivoRechazo, setMotivoRechazo] = useState("")
  const [justificacionCancelar, setJustificacionCancelar] = useState("")
  const [queCorregir, setQueCorregir] = useState("")
  const [destinoCorreccion, setDestinoCorreccion] = useState<"auxiliar" | "solicitante">("auxiliar")

  // Estado del formulario de edición
  const [editForm, setEditForm] = useState<EditarCotizacionPayload>({
    proveedor_nombre: cotizacion.proveedor_nombre,
    proveedor_nit: cotizacion.proveedor_nit ?? "",
    proveedor_email: cotizacion.proveedor_email ?? "",
    numero_cotizacion_proveedor: cotizacion.numero_cotizacion_proveedor ?? "",
    valor_antes_iva: cotizacion.valor_antes_iva,
    valor_iva: cotizacion.valor_iva,
    valor_total: cotizacion.valor_total,
    forma_pago: cotizacion.forma_pago ?? "",
    plazo_entrega: cotizacion.plazo_entrega ?? "",
    observaciones: cotizacion.observaciones ?? "",
  })

  function handleEditar() {
    const payload: EditarCotizacionPayload = {}
    if (editForm.proveedor_nombre?.trim()) payload.proveedor_nombre = editForm.proveedor_nombre.trim()
    if (editForm.proveedor_nit !== undefined) payload.proveedor_nit = editForm.proveedor_nit || ""
    if (editForm.proveedor_email !== undefined) payload.proveedor_email = editForm.proveedor_email || ""
    if (editForm.numero_cotizacion_proveedor !== undefined) payload.numero_cotizacion_proveedor = editForm.numero_cotizacion_proveedor || ""
    if (editForm.valor_antes_iva !== undefined) payload.valor_antes_iva = editForm.valor_antes_iva
    if (editForm.valor_iva !== undefined) payload.valor_iva = editForm.valor_iva
    if (editForm.valor_total !== undefined) payload.valor_total = editForm.valor_total
    if (editForm.forma_pago !== undefined) payload.forma_pago = editForm.forma_pago || ""
    if (editForm.plazo_entrega !== undefined) payload.plazo_entrega = editForm.plazo_entrega || ""
    if (editForm.observaciones !== undefined) payload.observaciones = editForm.observaciones || ""
    onEditar(cotizacion.id, payload)
    setModo("idle")
  }

  function handleAprobar() {
    onAprobar(cotizacion.id, valorAprobado, observaciones || undefined)
    setModo("idle")
  }

  function handleRechazar() {
    if (!motivoRechazo.trim()) return
    onRechazar(cotizacion.id, motivoRechazo)
    setModo("idle")
  }

  function handleCancelar() {
    if (!justificacionCancelar.trim()) return
    onCancelar(cotizacion.id, justificacionCancelar)
    setModo("idle")
  }

  function handleCorreccion() {
    if (!queCorregir.trim()) return
    onCorreccion(cotizacion.id, queCorregir, destinoCorreccion)
    setModo("idle")
  }

  return (
    <div className="bg-orange-50 border border-orange-200 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-orange-500 text-lg">⏳</span>
        <h2 className="text-sm font-semibold text-orange-800">
          Cotización pendiente de tu aprobación
        </h2>
      </div>

      {/* Resumen de la cotización */}
      <div className="bg-card rounded-lg border border-orange-100 p-4 mb-4 space-y-3">
        {/* Botón para ver el archivo adjunto — usa blob para evitar problemas de token en URL */}
        {cotizacion.pdf_path && (
          <button
            type="button"
            onClick={() => abrirCotizacionPdf(cotizacion.id)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-medium text-orange-700 hover:bg-orange-100 transition-colors"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 4a2 2 0 0 1 2-2h4.586A2 2 0 0 1 12 2.586L15.414 6A2 2 0 0 1 16 7.414V16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4Z" clipRule="evenodd" />
            </svg>
            Ver cotización del proveedor
          </button>
        )}
        {/* Proveedor + N° cotización */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Proveedor</p>
            <p className="text-sm font-semibold text-foreground">{cotizacion.proveedor_nombre}</p>
            {cotizacion.proveedor_nit && (
              <p className="text-xs text-muted-foreground">NIT: {cotizacion.proveedor_nit}</p>
            )}
            {cotizacion.proveedor_email && (
              <p className="text-xs text-muted-foreground">{cotizacion.proveedor_email}</p>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">N° cotización</p>
            <p className="text-sm font-medium text-foreground">
              {cotizacion.numero_cotizacion_proveedor ?? "—"}
            </p>
            {cotizacion.fecha_estimada_entrega && (
              <>
                <p className="text-xs text-muted-foreground mt-1">Fecha estimada de entrega</p>
                <p className="text-xs text-foreground">{cotizacion.fecha_estimada_entrega}</p>
              </>
            )}
          </div>
        </div>

        {/* Tabla de ítems — solo si tiene ítems */}
        {cotizacion.items && cotizacion.items.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">
              Ítems ({cotizacion.items.length})
            </p>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="min-w-full text-xs">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">#</th>
                    <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Descripción</th>
                    <th className="px-2 py-1.5 text-right font-medium text-muted-foreground">Cant.</th>
                    <th className="px-2 py-1.5 text-right font-medium text-muted-foreground">V. Unit.</th>
                    <th className="px-2 py-1.5 text-right font-medium text-muted-foreground">V. Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {cotizacion.items.map((item, i) => (
                    <tr key={i} className="bg-background">
                      <td className="px-2 py-1.5 text-muted-foreground font-mono">{item.num ?? i + 1}</td>
                      <td className="px-2 py-1.5 text-foreground">
                        {item.descripcion}
                        {item.referencia && (
                          <span className="ml-1 text-muted-foreground">({item.referencia})</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-right text-foreground">
                        {item.cantidad ?? "—"}
                      </td>
                      <td className="px-2 py-1.5 text-right text-foreground font-mono">
                        {item.valor_unitario != null
                          ? formatCurrency(item.valor_unitario)
                          : "—"}
                      </td>
                      <td className="px-2 py-1.5 text-right text-foreground font-mono font-medium">
                        {item.valor_total != null
                          ? formatCurrency(item.valor_total)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Desglose de valores */}
        <div className="border-t border-orange-100 pt-3 space-y-1.5">
          {cotizacion.valor_antes_iva != null && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Subtotal (sin IVA)</span>
              <span className="font-medium text-foreground">
                {formatCurrency(cotizacion.valor_antes_iva)}
              </span>
            </div>
          )}
          {cotizacion.valor_iva != null && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">IVA</span>
              <span className="font-medium text-orange-600">
                + {formatCurrency(cotizacion.valor_iva)}
              </span>
            </div>
          )}
          {/* Total con IVA — siempre prominente */}
          <div className="flex justify-between items-center bg-orange-50 rounded-lg px-3 py-2 mt-1">
            <span className="text-sm font-semibold text-orange-900">
              {cotizacion.valor_iva != null ? "Total con IVA" : "Valor total"}
            </span>
            <span className="text-xl font-bold text-orange-900">
              {formatCurrency(cotizacion.valor_total)}
            </span>
          </div>
        </div>

        {/* Condiciones */}
        {(cotizacion.forma_pago || cotizacion.plazo_entrega || cotizacion.observaciones) && (
          <div className="grid grid-cols-2 gap-2 border-t border-orange-100 pt-3">
            {cotizacion.forma_pago && (
              <div>
                <p className="text-xs text-muted-foreground">Forma de pago</p>
                <p className="text-xs text-foreground">{cotizacion.forma_pago}</p>
              </div>
            )}
            {cotizacion.plazo_entrega && (
              <div>
                <p className="text-xs text-muted-foreground">Plazo entrega</p>
                <p className="text-xs text-foreground">{cotizacion.plazo_entrega}</p>
              </div>
            )}
            {cotizacion.observaciones && (
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground">Observaciones</p>
                <p className="text-xs text-foreground">{cotizacion.observaciones}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Formulario de edición de la cotización */}
      {modo === "editar" && (
        <div className="bg-card rounded-lg border border-blue-200 p-4 mb-3 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-blue-600 text-base">✎</span>
            <p className="text-sm font-semibold text-blue-800">Corregir datos de la cotización</p>
          </div>

          {/* Proveedor */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Proveedor</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Nombre *</label>
                <input
                  type="text"
                  value={editForm.proveedor_nombre ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, proveedor_nombre: e.target.value }))}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">NIT</label>
                <input
                  type="text"
                  value={editForm.proveedor_nit ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, proveedor_nit: e.target.value }))}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Email</label>
                <input
                  type="email"
                  value={editForm.proveedor_email ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, proveedor_email: e.target.value }))}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">N° cotización proveedor</label>
                <input
                  type="text"
                  value={editForm.numero_cotizacion_proveedor ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, numero_cotizacion_proveedor: e.target.value }))}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
            </div>
          </div>

          {/* Valores */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Valores</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <FormFieldCOP
                label="Subtotal sin IVA"
                value={editForm.valor_antes_iva ?? undefined}
                onChange={(v) => setEditForm((f) => ({ ...f, valor_antes_iva: v ?? null }))}
                inputClassName="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              <FormFieldCOP
                label="IVA"
                value={editForm.valor_iva ?? undefined}
                onChange={(v) => setEditForm((f) => ({ ...f, valor_iva: v ?? null }))}
                inputClassName="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              <FormFieldCOP
                label="Total con IVA *"
                value={editForm.valor_total ?? undefined}
                onChange={(v) => setEditForm((f) => ({ ...f, valor_total: v ?? 0 }))}
                inputClassName="w-full rounded-lg border border-border px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
          </div>

          {/* Condiciones */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Condiciones</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Forma de pago</label>
                <input
                  type="text"
                  value={editForm.forma_pago ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, forma_pago: e.target.value }))}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Plazo de entrega</label>
                <input
                  type="text"
                  value={editForm.plazo_entrega ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, plazo_entrega: e.target.value }))}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-muted-foreground mb-1">Observaciones</label>
                <textarea
                  rows={2}
                  value={editForm.observaciones ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, observaciones: e.target.value }))}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleEditar}
              disabled={isLoading || !editForm.proveedor_nombre?.trim() || !editForm.valor_total}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isLoading ? "Guardando..." : "Guardar cambios"}
            </button>
            <button
              onClick={() => setModo("idle")}
              className="rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Formulario de aprobación */}
      {modo === "aprobar" && (
        <div className="bg-card rounded-lg border border-green-200 p-4 mb-3 space-y-3">
          <p className="text-sm font-medium text-green-800">Confirmar aprobación</p>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">
              Valor aprobado — total con IVA (puedes ajustarlo)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={valorAprobado}
              onChange={(e) => setValorAprobado(Number(e.target.value))}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">
              Observaciones (opcional)
            </label>
            <textarea
              rows={2}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Condiciones, restricciones, etc."
              className="w-full rounded-lg border border-border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-300"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAprobar}
              disabled={isLoading}
              className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {isLoading ? "Procesando..." : "Confirmar aprobación"}
            </button>
            <button
              onClick={() => setModo("idle")}
              className="rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Formulario de rechazo */}
      {modo === "rechazar" && (
        <div className="bg-card rounded-lg border border-red-200 p-4 mb-3 space-y-3">
          <p className="text-sm font-medium text-red-800">Motivo del rechazo</p>
          <textarea
            rows={3}
            value={motivoRechazo}
            onChange={(e) => setMotivoRechazo(e.target.value)}
            placeholder="Explica el motivo para que el auxiliar busque otra cotización..."
            className="w-full rounded-lg border border-border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-300"
          />
          <div className="flex gap-2">
            <button
              onClick={handleRechazar}
              disabled={isLoading || !motivoRechazo.trim()}
              className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {isLoading ? "Procesando..." : "Confirmar rechazo"}
            </button>
            <button
              onClick={() => setModo("idle")}
              className="rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Formulario cancelar solicitud */}
      {modo === "cancelar" && (
        <div className="bg-card rounded-lg border border-red-200 p-4 mb-3 space-y-3">
          <p className="text-sm font-medium text-red-800">Cancelar solicitud definitivamente</p>
          <p className="text-xs text-muted-foreground">
            La solicitud quedará cancelada y se notificará al solicitante por correo.
          </p>
          <textarea
            rows={3}
            value={justificacionCancelar}
            onChange={(e) => setJustificacionCancelar(e.target.value)}
            placeholder="Motivo de la cancelación..."
            className="w-full rounded-lg border border-border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-300"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={handleCancelar}
              disabled={isLoading || !justificacionCancelar.trim()}
              className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {isLoading ? "Procesando..." : "Confirmar cancelación"}
            </button>
            <button onClick={() => setModo("idle")} className="rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors">
              Volver
            </button>
          </div>
        </div>
      )}

      {/* Formulario mandar a corrección */}
      {modo === "correccion" && (
        <div className="bg-card rounded-lg border border-amber-200 p-4 mb-3 space-y-3">
          <p className="text-sm font-medium text-amber-800">Mandar a corrección</p>

          {/* Selector destino */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">¿Quién debe corregir?</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setDestinoCorreccion("auxiliar")}
                className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                  destinoCorreccion === "auxiliar"
                    ? "border-amber-400 bg-amber-50 text-amber-700"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                Auxiliar de compras
              </button>
              <button
                onClick={() => setDestinoCorreccion("solicitante")}
                className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                  destinoCorreccion === "solicitante"
                    ? "border-amber-400 bg-amber-50 text-amber-700"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                Solicitante
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              {destinoCorreccion === "auxiliar"
                ? "El auxiliar buscará una nueva cotización."
                : "El solicitante deberá editar su solicitud desde la intranet."}
            </p>
          </div>

          <textarea
            rows={3}
            value={queCorregir}
            onChange={(e) => setQueCorregir(e.target.value)}
            placeholder="¿Qué debe corregir?..."
            className="w-full rounded-lg border border-border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-300"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={handleCorreccion}
              disabled={isLoading || !queCorregir.trim()}
              className="flex-1 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50 transition-colors"
            >
              {isLoading ? "Procesando..." : "Confirmar corrección"}
            </button>
            <button onClick={() => setModo("idle")} className="rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors">
              Volver
            </button>
          </div>
        </div>
      )}

      {/* Aviso POR IMPLEMENTAR: aprobación por gerencia */}
      {cotizacion.valor_total > 2_500_000 && (
        <div className="mb-3 rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-2.5 flex items-start gap-2">
          <span className="text-yellow-500 shrink-0 mt-0.5">⚠️</span>
          <p className="text-xs text-yellow-800">
            <span className="font-semibold">POR IMPLEMENTAR —</span> Compras mayores a $2.500.000
            requerirán aprobación de Gerencia con notificación por correo. Por ahora el flujo de
            aprobación sigue siendo del Directivo.
          </p>
        </div>
      )}

      {/* Botones principales */}
      {modo === "idle" && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <button
              onClick={() => setModo("aprobar")}
              className="flex-1 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 transition-colors"
            >
              ✓ Aprobar cotización
            </button>
            <button
              onClick={() => setModo("editar")}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              ✎ Corregir datos
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setModo("rechazar")}
              className="flex-1 rounded-lg bg-muted px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted/80 transition-colors"
            >
              ↺ Buscar nueva cotización
            </button>
            <button
              onClick={() => setModo("correccion")}
              className="flex-1 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-600 transition-colors"
            >
              Mandar a corrección
            </button>
            <button
              onClick={() => setModo("cancelar")}
              className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 transition-colors"
            >
              ✕ Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Panel Orden de Compra ─────────────────────────────────────────────────────

type RegenerarOCTone = "green" | "blue" | "violet"

const REGENERAR_OC_PANEL: Record<
  RegenerarOCTone,
  { divider: string; label: string; select: string; btnGo: string; btnCancel: string }
> = {
  green: {
    divider: "border-green-200",
    label: "text-green-700",
    select: "border-green-300 focus:ring-green-400",
    btnGo: "bg-green-700 hover:bg-green-800",
    btnCancel: "border-green-300 text-green-700 hover:bg-green-100",
  },
  blue: {
    divider: "border-blue-200",
    label: "text-blue-700",
    select: "border-blue-300 focus:ring-blue-400",
    btnGo: "bg-blue-700 hover:bg-blue-800",
    btnCancel: "border-blue-300 text-blue-700 hover:bg-blue-100",
  },
  violet: {
    divider: "border-violet-200",
    label: "text-violet-700",
    select: "border-violet-300 focus:ring-violet-400",
    btnGo: "bg-violet-700 hover:bg-violet-800",
    btnCancel: "border-violet-300 text-violet-700 hover:bg-violet-100",
  },
}

function RegenerarOCExpand({
  tone,
  plataformaRegen,
  setPlataformaRegen,
  plataformasDisponibles,
  onConfirm,
  onCancel,
  isGenerating,
  isBusy,
}: {
  tone: RegenerarOCTone
  plataformaRegen: string
  setPlataformaRegen: (slug: string) => void
  plataformasDisponibles: PlataformaOption[]
  onConfirm: () => void
  onCancel: () => void
  isGenerating: boolean
  isBusy?: boolean
}) {
  const t = REGENERAR_OC_PANEL[tone]
  const busy = !!(isBusy || isGenerating)
  return (
    <div className={`border-t ${t.divider} pt-3 space-y-2`}>
      <p className={`text-xs font-medium ${t.label}`}>Selecciona el nuevo formato de plataforma:</p>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={plataformaRegen}
          onChange={(e) => setPlataformaRegen(e.target.value)}
          className={`min-w-[160px] flex-1 rounded-lg border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 ${t.select}`}
        >
          <option value="">— Seleccionar —</option>
          {plataformasDisponibles.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.nombre}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy || !plataformaRegen}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-colors disabled:opacity-50 ${t.btnGo}`}
        >
          {isGenerating ? "Generando..." : "Regenerar"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className={`rounded-lg border px-3 py-1.5 text-xs transition-colors disabled:opacity-50 ${t.btnCancel}`}
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}

function PanelOrdenCompra({
  estado,
  orden,
  plataforma: plataformaInicial,
  puedeGenerar,
  emailProveedorInicial,
  isGenerating,
  isMarkingEnviada,
  isMarkingEnPlataforma,
  isMarkingEntregada,
  isClosing,
  onGenerar,
  onRegenerar,
  onDescargar,
  isActualizando = false,
  onMarcarEnviada,
  onMarcarEnPlataforma,
  onMarcarEntregada,
  onCerrar,
}: {
  estado: string
  orden: OrdenCompra | null
  plataforma: string
  puedeGenerar: boolean
  emailProveedorInicial: string
  isGenerating: boolean
  isMarkingEnviada: boolean
  isMarkingEnPlataforma: boolean
  isMarkingEntregada: boolean
  isClosing: boolean
  onGenerar: (plataforma: string) => void
  onRegenerar: (plataforma: string) => void
  onDescargar: () => void
  isActualizando?: boolean
  onMarcarEnviada: (email: string) => void
  onMarcarEnPlataforma: () => void
  onMarcarEntregada: () => void
  onCerrar: () => void
}) {
  const { data: plataformasDisponibles = [] } = usePlataformas()
  const [plataforma, setPlataforma] = useState(plataformaInicial)
  const [showModal, setShowModal] = useState(false)
  const [showRegenerar, setShowRegenerar] = useState(false)
  const [plataformaRegen, setPlataformaRegen] = useState(plataformaInicial)
  const [emailInput, setEmailInput] = useState(emailProveedorInicial)

  function handleConfirmarEnvio() {
    if (!emailInput.trim()) return
    onMarcarEnviada(emailInput.trim())
    setShowModal(false)
  }

  // Estado cerrada — solo informativo
  if (estado === "cerrada") {
    return (
      <div className="bg-muted border border-border rounded-xl p-5">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-lg">✔</span>
          <div>
            <p className="text-sm font-semibold text-foreground">Solicitud cerrada</p>
            {orden && <p className="text-xs text-muted-foreground font-mono">{orden.numero_oc}</p>}
          </div>
          {orden && (
            <button
              onClick={onDescargar}
              className="ml-auto rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
            >
              ↓ Descargar OC
            </button>
        )}
      </div>
    </div>
  )
}

  // Estado entregada — botón para cerrar
  if (estado === "entregada") {
    return (
      <div className="bg-teal-50 border border-teal-200 rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-teal-600 text-lg">📦</span>
            <div>
              <p className="text-sm font-semibold text-teal-800">Producto entregado</p>
              {orden && <p className="text-xs text-teal-600 font-mono">{orden.numero_oc}</p>}
            </div>
          </div>
          <div className="flex gap-2">
            {orden && (
              <button
                onClick={onDescargar}
                className="rounded-lg border border-teal-300 px-3 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-100 transition-colors"
              >
                ↓ Descargar OC
              </button>
            )}
            <button
              onClick={onCerrar}
              disabled={isClosing}
              className="rounded-lg bg-gray-700 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              {isClosing ? "Cerrando..." : "Cerrar solicitud"}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Estado oc_enviada — auxiliar confirma que ingresó el pedido en la plataforma
  if (estado === "oc_enviada") {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-blue-600 text-lg">📤</span>
            <div>
              <p className="text-sm font-semibold text-blue-800">OC enviada al proveedor</p>
              {orden && <p className="text-xs text-blue-600 font-mono">{orden.numero_oc}</p>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {orden && (
              <button
                onClick={onDescargar}
                className="rounded-lg border border-blue-300 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors"
              >
                ↓ Descargar OC
              </button>
            )}
            {puedeGenerar && orden && !showRegenerar && (
              <button
                type="button"
                onClick={() => setShowRegenerar(true)}
                className="rounded-lg border border-blue-300 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors"
              >
                ↺ Otro formato
              </button>
            )}
            <button
              onClick={onMarcarEnPlataforma}
              disabled={isMarkingEnPlataforma}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {isMarkingEnPlataforma ? "Guardando..." : "El pedido ya está en la plataforma"}
            </button>
          </div>
        </div>
        {showRegenerar && puedeGenerar && orden && (
          <RegenerarOCExpand
            tone="blue"
            plataformaRegen={plataformaRegen}
            setPlataformaRegen={setPlataformaRegen}
            plataformasDisponibles={plataformasDisponibles}
            isGenerating={isGenerating}
            isBusy={isActualizando}
            onConfirm={() => {
              onRegenerar(plataformaRegen)
              setShowRegenerar(false)
            }}
            onCancel={() => setShowRegenerar(false)}
          />
        )}
      </div>
    )
  }

  // Estado oc_en_plataforma — líder confirma que recibió físicamente el pedido
  if (estado === "oc_en_plataforma") {
    return (
      <div className="bg-violet-50 border border-violet-200 rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-violet-600 text-lg">🏭</span>
            <div>
              <p className="text-sm font-semibold text-violet-800">Pedido en plataforma</p>
              {orden && <p className="text-xs text-violet-600 font-mono">{orden.numero_oc}</p>}
              <p className="text-xs text-violet-500 mt-0.5">Esperando confirmación del solicitante — al confirmar se cierra la solicitud</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {orden && (
              <button
                onClick={onDescargar}
                className="rounded-lg border border-violet-300 px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-100 transition-colors"
              >
                ↓ Descargar OC
              </button>
            )}
            {puedeGenerar && orden && !showRegenerar && (
              <button
                type="button"
                onClick={() => setShowRegenerar(true)}
                className="rounded-lg border border-violet-300 px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-100 transition-colors"
              >
                ↺ Otro formato
              </button>
            )}
            <button
              onClick={onMarcarEntregada}
              disabled={isMarkingEntregada}
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50 transition-colors"
            >
              {isMarkingEntregada ? "Cerrando..." : "Confirmar recepción y cerrar"}
            </button>
          </div>
        </div>
        {showRegenerar && puedeGenerar && orden && (
          <RegenerarOCExpand
            tone="violet"
            plataformaRegen={plataformaRegen}
            setPlataformaRegen={setPlataformaRegen}
            plataformasDisponibles={plataformasDisponibles}
            isGenerating={isGenerating}
            isBusy={isActualizando}
            onConfirm={() => {
              onRegenerar(plataformaRegen)
              setShowRegenerar(false)
            }}
            onCancel={() => setShowRegenerar(false)}
          />
        )}
      </div>
    )
  }

  // Estado aprobada con OC ya generada — botón para marcar enviada
  if (orden) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-green-600 text-lg">📄</span>
            <div>
              <p className="text-sm font-semibold text-green-800">Orden de Compra generada</p>
              <p className="text-xs text-green-600 font-mono">{orden.numero_oc}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onDescargar}
              className="rounded-lg border border-green-300 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 transition-colors"
            >
              ↓ Descargar OC
            </button>
            {puedeGenerar && !showRegenerar && (
              <button
                type="button"
                onClick={() => setShowRegenerar(true)}
                className="rounded-lg border border-green-300 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 transition-colors"
              >
                ↺ Otro formato
              </button>
            )}
            {puedeGenerar && (
              <button
                type="button"
                onClick={() => {
                  setEmailInput(emailProveedorInicial)
                  setShowModal(true)
                }}
                disabled={isMarkingEnviada}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isMarkingEnviada ? "Enviando..." : "Enviar OC al proveedor"}
              </button>
            )}
          </div>
        </div>

        {showRegenerar && puedeGenerar && (
          <RegenerarOCExpand
            tone="green"
            plataformaRegen={plataformaRegen}
            setPlataformaRegen={setPlataformaRegen}
            plataformasDisponibles={plataformasDisponibles}
            isGenerating={isGenerating}
            isBusy={isActualizando}
            onConfirm={() => {
              onRegenerar(plataformaRegen)
              setShowRegenerar(false)
            }}
            onCancel={() => setShowRegenerar(false)}
          />
        )}

        {/* Modal confirmación email proveedor */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-card rounded-xl shadow-xl p-6 w-full max-w-md mx-4 space-y-4">
              <h3 className="text-base font-semibold text-foreground">Enviar OC al proveedor</h3>
              <p className="text-sm text-muted-foreground">
                Confirma o edita el correo del proveedor. La OC se enviará como adjunto.
              </p>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Correo del proveedor
                </label>
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="proveedor@empresa.com"
                  autoFocus
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  onClick={handleConfirmarEnvio}
                  disabled={!emailInput.trim() || isMarkingEnviada}
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {isMarkingEnviada ? "Enviando..." : "Confirmar y enviar"}
                </button>
                <button
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (!puedeGenerar) return null

  // OC no generada aún — selector de plataforma + botón para generarla
  return (
    <div className="bg-blue-50 border border-primary/20 rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <svg className="w-5 h-5 text-primary shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
        </svg>
        <div>
          <p className="text-sm font-semibold text-primary">Generar Orden de Compra</p>
          <p className="text-xs text-primary/60">
            La cotización fue aprobada. Selecciona la plataforma y genera el documento oficial.
          </p>
        </div>
      </div>
      <div className="space-y-1">
        <label className="block text-xs font-medium text-primary/70">Plataforma</label>
        <select
          value={plataforma}
          onChange={(e) => setPlataforma(e.target.value)}
          className="w-full rounded-lg border border-primary/30 px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">— Sin asignar —</option>
          {plataformasDisponibles.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.nombre}
            </option>
          ))}
        </select>
      </div>
      <div className="flex justify-end">
        <button
          onClick={() => onGenerar(plataforma)}
          disabled={isGenerating || isActualizando || !plataforma}
          className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {isActualizando ? "Guardando..." : isGenerating ? "Generando..." : "Generar OC"}
        </button>
      </div>
    </div>
  )
}

// ── Cotización Card (historial) ────────────────────────────────────────────────

function CotizacionCard({ cotizacion: c }: { cotizacion: CotizacionProveedor }) {
  const estadoColor =
    c.aprobada === true
      ? "border-green-100 bg-green-50"
      : c.aprobada === false
      ? "border-red-100 bg-red-50"
      : "border-border bg-card"

  const estadoLabel =
    c.aprobada === true ? "Aprobada" : c.aprobada === false ? "Rechazada" : "En revisión"

  const estadoTextColor =
    c.aprobada === true
      ? "text-green-700"
      : c.aprobada === false
      ? "text-red-700"
      : "text-orange-700"

  return (
    <div className={`rounded-lg border p-4 ${estadoColor}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="font-semibold text-foreground text-sm">{c.proveedor_nombre}</p>
        <span className={`text-xs font-medium ${estadoTextColor}`}>{estadoLabel}</span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        <div>
          <span className="text-muted-foreground">
            {c.valor_iva != null ? "Total con IVA: " : "Valor total: "}
          </span>
          <span className="font-semibold text-foreground">{formatCurrency(c.valor_total)}</span>
        </div>
        {c.valor_aprobado != null && (
          <div>
            <span className="text-muted-foreground">Valor aprobado: </span>
            <span className="font-medium text-green-700">{formatCurrency(c.valor_aprobado)}</span>
          </div>
        )}
        {c.numero_cotizacion_proveedor && (
          <div>
            <span className="text-muted-foreground">N° cotización: </span>
            <span className="font-medium text-foreground">{c.numero_cotizacion_proveedor}</span>
          </div>
        )}
        {c.fecha_estimada_entrega && (
          <div>
            <span className="text-muted-foreground">Entrega estimada: </span>
            <span className="font-medium text-foreground">{c.fecha_estimada_entrega}</span>
          </div>
        )}
      </div>
      {c.observaciones_aprobacion && (
        <p className="mt-2 text-xs text-muted-foreground italic">
          "{c.observaciones_aprobacion}"
        </p>
      )}
    </div>
  )
}

// ── Helpers visuales ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-xl border border-border shadow-sm p-5">
      <h2 className="text-sm font-semibold text-foreground mb-4">{title}</h2>
      {children}
    </div>
  )
}

function InfoGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-4 gap-y-3">{children}</div>
}

function InfoItem({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground font-medium">{value ?? "—"}</p>
    </div>
  )
}

function TimelineItem({
  label,
  date,
  done,
}: {
  label: string
  date: string | null | undefined
  done: boolean
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`h-2.5 w-2.5 rounded-full shrink-0 ${
          done ? "bg-green-500" : "bg-muted-foreground/30"
        }`}
      />
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${done ? "text-foreground" : "text-muted-foreground"}`}>{label}</p>
        {date && (
          <p className="text-xs text-muted-foreground">
            {formatFechaHora(date)}
          </p>
        )}
      </div>
    </div>
  )
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(value)
}

// ── Mapa de etiquetas de estado ───────────────────────────────────────────────

const ESTADO_LABEL: Record<string, string> = {
  nueva: "Nueva",
  en_cotizacion: "En cotización",
  pendiente_aprobacion: "Pend. aprobación",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
  cancelada: "Cancelada",
  en_correccion: "En corrección",
  oc_enviada: "OC Enviada",
  oc_en_plataforma: "En plataforma",
  entregada: "Entregada",
  cerrada: "Cerrada",
}

function estadoDisplayLabel(estado: string): string {
  return ESTADO_LABEL[estado] ?? estado
}

// ── Tabla comparativa de cotizaciones ─────────────────────────────────────────

function TablaCotizacionesComparativa({ cotizaciones }: { cotizaciones: CotizacionProveedor[] }) {
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="min-w-full text-sm border-separate border-spacing-0">
        <thead>
          <tr>
            <th className="sticky left-0 bg-card text-left text-xs font-semibold text-muted-foreground py-2 pr-4 w-36 min-w-36">
              Campo
            </th>
            {cotizaciones.map((c, i) => (
              <th
                key={c.id}
                className={`text-left text-xs font-semibold py-2 px-3 min-w-44 ${
                  c.aprobada === true
                    ? "text-green-700 border-l-2 border-green-400"
                    : "text-foreground border-l border-border"
                }`}
              >
                Cotización {i + 1}
                {c.aprobada === true && (
                  <span className="ml-1.5 text-green-600">✓</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* Proveedor */}
          <ComparativaFila label="Proveedor">
            {cotizaciones.map((c) => (
              <td key={c.id} className={comparativaCellClass(c)}>
                <span className="font-medium text-foreground">{c.proveedor_nombre}</span>
              </td>
            ))}
          </ComparativaFila>

          {/* N° cotización */}
          <ComparativaFila label="N° cotización">
            {cotizaciones.map((c) => (
              <td key={c.id} className={comparativaCellClass(c)}>
                {c.numero_cotizacion_proveedor ?? <span className="text-muted-foreground/50">—</span>}
              </td>
            ))}
          </ComparativaFila>

          {/* Subtotal sin IVA */}
          <ComparativaFila label="Subtotal (sin IVA)">
            {cotizaciones.map((c) => (
              <td key={c.id} className={comparativaCellClass(c)}>
                {c.valor_antes_iva != null
                  ? formatCurrency(c.valor_antes_iva)
                  : <span className="text-muted-foreground/50">—</span>}
              </td>
            ))}
          </ComparativaFila>

          {/* IVA */}
          <ComparativaFila label="IVA">
            {cotizaciones.map((c) => (
              <td key={c.id} className={comparativaCellClass(c)}>
                {c.valor_iva != null
                  ? formatCurrency(c.valor_iva)
                  : <span className="text-muted-foreground/50">—</span>}
              </td>
            ))}
          </ComparativaFila>

          {/* TOTAL CON IVA — fila destacada */}
          <tr className="bg-muted">
            <td className="sticky left-0 bg-muted text-xs font-bold text-foreground py-2.5 pr-4">
              TOTAL CON IVA
            </td>
            {cotizaciones.map((c) => (
              <td
                key={c.id}
                className={`text-sm font-bold py-2.5 px-3 ${
                  c.aprobada === true
                    ? "text-green-700 border-l-2 border-green-400"
                    : "text-foreground border-l border-border"
                }`}
              >
                {formatCurrency(c.valor_total)}
              </td>
            ))}
          </tr>

          {/* Forma de pago */}
          <ComparativaFila label="Forma de pago">
            {cotizaciones.map((c) => (
              <td key={c.id} className={comparativaCellClass(c)}>
                {c.forma_pago ?? <span className="text-muted-foreground/50">—</span>}
              </td>
            ))}
          </ComparativaFila>

          {/* Plazo entrega */}
          <ComparativaFila label="Plazo entrega">
            {cotizaciones.map((c) => (
              <td key={c.id} className={comparativaCellClass(c)}>
                {c.plazo_entrega ?? <span className="text-muted-foreground/50">—</span>}
              </td>
            ))}
          </ComparativaFila>

          {/* Estado */}
          <ComparativaFila label="Estado">
            {cotizaciones.map((c) => {
              const label =
                c.aprobada === true ? "Aprobada" : c.aprobada === false ? "Rechazada" : "En revisión"
              const color =
                c.aprobada === true
                  ? "text-green-700"
                  : c.aprobada === false
                  ? "text-red-600"
                  : "text-orange-600"
              return (
                <td key={c.id} className={comparativaCellClass(c)}>
                  <span className={`font-medium ${color}`}>{label}</span>
                </td>
              )
            })}
          </ComparativaFila>
        </tbody>
      </table>
    </div>
  )
}

function comparativaCellClass(c: CotizacionProveedor): string {
  return `text-sm text-foreground py-2 px-3 ${
    c.aprobada === true
      ? "border-l-2 border-green-400 bg-green-50/40"
      : "border-l border-border"
  }`
}

function ComparativaFila({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <tr className="border-t border-border/30 hover:bg-muted/50 transition-colors">
      <td className="sticky left-0 bg-card text-xs text-muted-foreground font-medium py-2 pr-4">
        {label}
      </td>
      {children}
    </tr>
  )
}

// ── Historial de cambios de estado ────────────────────────────────────────────

const OC_HISTORIAL_TIPO_ACCION: Record<string, string> = {
  correccion_directivo: "Corrección directiva (datos cotización / OC actualizados, sin cambiar etapa)",
  correccion_solicitud: "Solicitud devuelta para corrección",
  correccion_cotizacion_a_auxiliar: "Cotización devuelta al auxiliar",
  correccion_cotizacion_a_solicitante: "Cotización devuelta al solicitante",
  cancelacion_solicitud: "Cancelación de solicitud",
  cancelacion_cotizacion: "Cancelación de cotización",
  cancelacion_directivo: "Cancelación por directivo (post-aprobación)",
}

function historialTipoAccionDescripcion(tipo: string | null | undefined): string | null {
  if (!tipo || !tipo.trim()) return null
  return OC_HISTORIAL_TIPO_ACCION[tipo] ?? tipo.replace(/_/g, " ")
}

function HistorialTimeline({ entradas }: { entradas: HistorialEntrada[] }) {
  return (
    <div className="space-y-3">
      {entradas.map((e, idx) => {
        const isLast = idx === entradas.length - 1
        const esCorrDir = e.tipo_accion === "correccion_directivo"
        const accionLabel = historialTipoAccionDescripcion(e.tipo_accion)

        const dotClass = esCorrDir
          ? "bg-amber-500"
          : isLast
            ? "bg-brand-blue"
            : "bg-muted-foreground/30"

        return (
          <div key={e.id} className="flex gap-3">
            <div className="flex flex-col items-center shrink-0">
              <div className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${dotClass}`} />
              {!isLast && <div className="mt-1 flex-1 w-px bg-muted" />}
            </div>

            <div
              className={`min-w-0 flex-1 pb-3 ${esCorrDir ? "rounded-lg border-l-4 border-amber-400 bg-amber-50/50 pl-3 -ml-1" : ""}`}
            >
              {esCorrDir ? (
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-block rounded-full bg-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-900">
                      Corrección directiva
                    </span>
                    <span className="text-xs font-medium text-foreground">
                      Etapa conservada · {estadoDisplayLabel(e.estado_nuevo)}
                    </span>
                  </div>
                  <p className="text-[11px] leading-snug text-amber-800/90">
                    Se actualizaron datos de la cotización u orden sin retroceder el flujo.
                    {(e.estado_nuevo === "oc_enviada" || e.estado_nuevo === "oc_en_plataforma") && (
                      <span className="font-medium"> Si la OC ya estaba enviada, puede haberse regenerado y reenviado al proveedor.</span>
                    )}
                  </p>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  {e.estado_anterior ? (
                    <>
                      <span className="text-xs text-muted-foreground">
                        {estadoDisplayLabel(e.estado_anterior)}
                      </span>
                      <span className="text-xs text-muted-foreground/50">→</span>
                    </>
                  ) : null}
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${estadoBadgeClass(e.estado_nuevo)}`}
                  >
                    {estadoDisplayLabel(e.estado_nuevo)}
                  </span>
                  {accionLabel && (
                    <span className="inline-block max-w-full rounded-md border border-border bg-muted px-2 py-0.5 text-[11px] font-medium leading-snug text-foreground">
                      {accionLabel}
                    </span>
                  )}
                </div>
              )}

              <div className="mt-0.5 flex flex-wrap items-center gap-2">
                {e.usuario_nombre ? (
                  <span className="text-xs text-muted-foreground">{e.usuario_nombre}</span>
                ) : null}
                <span className="text-xs text-muted-foreground">{formatFechaRelativa(e.fecha)}</span>
                {!esCorrDir && e.es_reproceso ? (
                  <span className="text-[11px] font-medium text-amber-700">· Reproceso</span>
                ) : null}
              </div>
              {notasParagraph(e.notas)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function notasParagraph(notas: string | null): ReactNode {
  if (!notas?.trim()) return null
  return <p className="mt-1 text-xs italic text-foreground">&quot;{notas}&quot;</p>
}

function estadoBadgeClass(estado: string): string {
  const map: Record<string, string> = {
    nueva: "bg-blue-100 text-blue-700",
    en_cotizacion: "bg-yellow-100 text-yellow-700",
    pendiente_aprobacion: "bg-orange-100 text-orange-700",
    aprobada: "bg-green-100 text-green-700",
    rechazada: "bg-red-100 text-red-700",
    cancelada: "bg-red-200 text-red-800",
    en_correccion: "bg-amber-100 text-amber-700",
    oc_enviada: "bg-indigo-100 text-indigo-700",
    oc_en_plataforma: "bg-violet-100 text-violet-700",
    entregada: "bg-teal-100 text-teal-700",
    cerrada: "bg-muted text-foreground",
  }
  return map[estado] ?? "bg-muted text-foreground"
}
