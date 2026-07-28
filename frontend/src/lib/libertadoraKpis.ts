import type { LibKpis, LibProspecto } from "@/types/libertadora"

// Ported 1:1 de kpis() en app.js del prototipo original / de
// libertadora-backend/src/services/prospectos.ts. Se usa en el lado del
// socio externo para no tener que exponer un endpoint público nuevo de
// dashboard — los mismos prospectos que ya ve (/public/prospectos) alcanzan
// para calcular las mismas 8 métricas que ve el staff.
export function computeKpisFromProspectos(prospectos: LibProspecto[]): LibKpis {
  const tot = prospectos.length
  const cerrados = prospectos.filter((p) => p.estado === "CERRADO")
  const ci = cerrados.length
  const ii = prospectos.filter((p) => p.estado === "INTERESADO").length
  const ep = prospectos.filter((p) => p.estado === "EN_PROCESO").length
  const ni = prospectos.filter((p) => p.estado === "NO_INTERESADO" || p.estado === "CERRADO_NEG").length
  const mo = cerrados.reduce((sum, p) => sum + p.monto, 0)
  const po = prospectos.filter((p) => p.estado === "INTERESADO").reduce((sum, p) => sum + p.monto, 0)
  const conv = tot > 0 ? Number(((ci / tot) * 100).toFixed(1)) : 0
  return { tot, ci, ii, ep, ni, mo, po, conv }
}
