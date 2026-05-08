import type { ItemCotizacion } from "@/types/oc"

/** IVA estándar Colombia (ventas) — cotización OC. */
export const IVA_RATE_CO = 0.19

export function roundCOP(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.round(n)
}

/** Suma `valor_total` solo de ítems con descripción no vacía (alineado al guardado). */
export function subtotalFromItems(items: ItemCotizacion[]): number {
  return items.reduce((acc, it) => {
    if (!it.descripcion?.trim()) return acc
    const vt = it.valor_total
    if (vt == null || !Number.isFinite(vt)) return acc
    return acc + vt
  }, 0)
}

export function recalcLineFromCantVu(cantidad?: number, valorUnitario?: number): number | undefined {
  if (
    cantidad == null ||
    valorUnitario == null ||
    !Number.isFinite(cantidad) ||
    !Number.isFinite(valorUnitario)
  ) {
    return undefined
  }
  return roundCOP(cantidad * valorUnitario)
}

export function recalcUnitarioFromCantVt(cantidad?: number, valorTotal?: number): number | undefined {
  if (
    cantidad == null ||
    valorTotal == null ||
    cantidad === 0 ||
    !Number.isFinite(cantidad) ||
    !Number.isFinite(valorTotal)
  ) {
    return undefined
  }
  return roundCOP(valorTotal / cantidad)
}

export function ivaYTotalDesdeSubtotal(subtotal: number): { iva: number; total: number } {
  const s = roundCOP(subtotal)
  const iva = roundCOP(s * IVA_RATE_CO)
  const total = s + iva
  return { iva, total }
}

export function subtotalEIvaDesdeTotal(totalConIva: number): { subtotal: number; iva: number } {
  const t = roundCOP(totalConIva)
  const subtotal = roundCOP(t / (1 + IVA_RATE_CO))
  const iva = t - subtotal
  return { subtotal, iva }
}

export function encabezadoDesdeItems(items: ItemCotizacion[]): {
  subtotal: number
  iva: number
  total: number
} {
  const subtotal = roundCOP(subtotalFromItems(items))
  const { iva, total } = ivaYTotalDesdeSubtotal(subtotal)
  return { subtotal, iva, total }
}
