export function extractErrorMessage(err: unknown, fallback = "No se pudo guardar el cambio. Intenta de nuevo."): string {
  const message =
    err && typeof err === "object" && "response" in err
      ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
      : undefined
  return message ?? fallback
}
