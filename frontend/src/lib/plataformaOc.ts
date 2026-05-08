/** Nombre de plataforma guardado en solicitud = nombre canónico de sede (catálogo /api/sedes?para_solicitudes_oc=true). */
export function defaultPlataformaDesdeSedes(
  sedes: { name: string }[],
  userSede: string | null | undefined,
): string {
  const order = sedes.map((s) => s.name)
  const set = new Set(order)
  const u = userSede?.trim()
  if (u && set.has(u)) return u
  return order[0] ?? ""
}
