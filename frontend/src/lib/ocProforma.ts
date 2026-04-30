/**
 * Anticipo/proforma en OC: coherent con backend (`app/services/oc_proforma.py`).
 */

const ESTADOS_PROFORMA_SOLO_FINANCIERO = new Set([
  "oc_enviada",
  "oc_en_plataforma",
  "entregada",
  "cerrada",
  "cancelada",
])

/** Solicitud ya pasó a envío al proveedor o cierre → la proforma no se opera desde pantallas OC. */
export function solicitudOcProformaSoloFinanciero(estado: string): boolean {
  return ESTADOS_PROFORMA_SOLO_FINANCIERO.has(estado)
}

/** Toggle y carga de archivo de proforma permitidos en detalle OC o en «Cargar cotización». */
export function puedeGestionarProformaDesdeOc(cotizacionesCount: number, estadoSolicitud: string): boolean {
  if (solicitudOcProformaSoloFinanciero(estadoSolicitud)) return false
  if (cotizacionesCount > 0) return true
  // Primera cotización pendiente de cargar — mismo ciclo «Cargar cotización»
  return estadoSolicitud === "en_cotizacion"
}
