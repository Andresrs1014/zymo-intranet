/**
 * Format a number as Colombian Peso (COP) currency string.
 */
export function formatMoney(value: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Format a date string as day/month in es-CO locale.
 */
export function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "numeric",
  }).format(new Date(dateString));
}

/**
 * Calculate the number of days between two date strings.
 */
export function daysBetween(start: string, end: string): number {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const diffMs = endDate.getTime() - startDate.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}
