/**
 * Utilidades de formato de valores monetarios colombianos.
 * Punto de verdad único — importar desde aquí en todas las páginas.
 */

/**
 * Formatea un número como pesos colombianos.
 * Ej: 1500000 → "$1.500.000"
 */
export function formatCOP(value: number | null | undefined): string {
  if (value == null) return "—"
  const hasCents = Math.round((value % 1) * 100) !== 0
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  }).format(value)
}

/**
 * Parsea un string de valor monetario colombiano a number.
 *
 * Soporta:
 *   "1.500.000"      → 1500000
 *   "1.500.000,50"   → 1500000.50
 *   "1,500,000.50"   → 1500000.50
 *   "1500,50"        → 1500.50
 *   "$1.500.000"     → 1500000
 *
 * Retorna undefined si el string está vacío o no es parseable.
 */
export function parseCOP(raw: string): number | undefined {
  const cleaned = raw.replace(/\s/g, "").replace(/\$/g, "")
  if (!cleaned) return undefined

  // Pre-normalización DIAN UBL: "2.821.530.000" o "2.821.530.000,00"
  // → el ".000" final son centavos cero (no miles de millones).
  const dianMatch = /^(\d{1,3}\.\d{3}\.\d{3})\.000(?:,\d{1,2})?$/.exec(cleaned)
  if (dianMatch) return parseFloat(dianMatch[1].replace(/\./g, ""))

  // Colombiano: 1.500.000,50 (punto miles, coma decimal)
  if (/\d{1,3}(\.\d{3})+,\d{1,2}$/.test(cleaned))
    return parseFloat(cleaned.replace(/\./g, "").replace(",", "."))

  // Colombiano solo miles: 1.500.000
  // Excepción DIAN UBL: "2.821.530.000" → último ".000" son centavos cero → ignorar
  if (/^\d{1,3}(\.\d{3})+$/.test(cleaned)) {
    const partes = cleaned.split(".")
    if (partes.length === 4 && partes[partes.length - 1] === "000") {
      return parseFloat(partes.slice(0, -1).join(""))
    }
    return parseFloat(cleaned.replace(/\./g, ""))
  }

  // Anglosajón: 1,500,000.50 (coma miles, punto decimal)
  if (/,/.test(cleaned) && /\./.test(cleaned))
    return parseFloat(cleaned.replace(/,/g, ""))

  // Solo coma → coma decimal: 1500,50
  if (/,/.test(cleaned))
    return parseFloat(cleaned.replace(",", "."))

  // Un solo punto con 3 decimales exactos suele ser separador de miles en Colombia: 49.580 → 49580
  const parts = cleaned.split(".")
  if (parts.length === 2 && parts[1].length === 3) {
    return parseFloat(cleaned.replace(".", ""))
  }

  const n = parseFloat(cleaned)
  return isNaN(n) ? undefined : n
}
