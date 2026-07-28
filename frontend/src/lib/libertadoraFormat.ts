// Ported 1:1 de COP()/pShort() en app.js del prototipo original — mismo
// formato de moneda y mismas abreviaturas de producto en toda la vista.

export function formatCOP(value: number): string {
  if (!value || value <= 0) return "—"
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(value)
}

export function productShortLabel(producto: string): string {
  return producto
    .replace("CREA PATRIMONIO PJ", "CP PJ")
    .replace("CREA PATRIMONIO PN", "CP PN")
    .replace("PORTAFOLIO", "PORTAF.")
    .replace("CREA AHORRO", "C.AHORRO")
}

export const TRIMESTRE_LABEL: Record<string, string> = {
  Q1: "Ene – Mar",
  Q2: "Abr – Jun",
  Q3: "Jul – Sep",
  Q4: "Oct – Dic",
}
