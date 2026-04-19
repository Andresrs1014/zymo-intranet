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
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
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

  // Colombiano: 1.500.000,50 (punto miles, coma decimal)
  if (/\d{1,3}(\.\d{3})+,\d{1,2}$/.test(cleaned))
    return parseFloat(cleaned.replace(/\./g, "").replace(",", "."))

  // Colombiano solo miles: 1.500.000
  if (/^\d{1,3}(\.\d{3})+$/.test(cleaned))
    return parseFloat(cleaned.replace(/\./g, ""))

  // Anglosajón: 1,500,000.50 (coma miles, punto decimal)
  if (/,/.test(cleaned) && /\./.test(cleaned))
    return parseFloat(cleaned.replace(/,/g, ""))

  // Solo coma → coma decimal: 1500,50
  if (/,/.test(cleaned))
    return parseFloat(cleaned.replace(",", "."))

  const n = parseFloat(cleaned)
  return isNaN(n) ? undefined : n
}
