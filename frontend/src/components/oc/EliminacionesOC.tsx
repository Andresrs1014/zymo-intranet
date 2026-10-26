import { useEliminacionesOC } from "@/hooks/useOC"

/** Bitácora de solicitudes eliminadas: quién, cuándo y por qué. Solo la ven los administradores. */
export function EliminacionesOC() {
  const { data = [], isLoading, isError } = useEliminacionesOC(true)

  return (
    <section className="mt-8 rounded-xl border border-border bg-card p-5">
      <h2 className="text-base font-semibold text-foreground">Solicitudes eliminadas</h2>
      <p className="mt-0.5 mb-4 text-xs text-muted-foreground">
        Registro de eliminaciones permanentes con su motivo. Solo visible para administradores.
      </p>

      {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
      {isError && <p role="alert" className="text-sm text-red-600">No se pudo cargar el registro.</p>}
      {!isLoading && !isError && data.length === 0 && (
        <p className="text-sm text-muted-foreground">Aún no se ha eliminado ninguna solicitud.</p>
      )}

      {data.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Fecha</th>
                <th className="py-2 pr-3 font-medium">Solicitud</th>
                <th className="py-2 pr-3 font-medium">Estado</th>
                <th className="py-2 pr-3 font-medium">Eliminó</th>
                <th className="py-2 pr-3 font-medium">Motivo</th>
                <th className="py-2 font-medium">Número</th>
              </tr>
            </thead>
            <tbody>
              {data.map((e) => (
                <tr key={e.id} className="border-b border-border/60 align-top">
                  <td className="py-2 pr-3 whitespace-nowrap font-mono text-xs">
                    {new Date(e.fecha).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" })}
                  </td>
                  <td className="py-2 pr-3">
                    <p className="font-mono text-xs font-semibold">{e.consecutivo_os}</p>
                    {e.numeros_oc && <p className="font-mono text-xs text-muted-foreground">{e.numeros_oc}</p>}
                    <p className="text-xs text-muted-foreground">{e.descripcion}</p>
                  </td>
                  <td className="py-2 pr-3 text-xs">{e.estado_al_eliminar}</td>
                  <td className="py-2 pr-3 text-xs">{e.eliminado_por_nombre}</td>
                  <td className="py-2 pr-3 text-xs">{e.motivo}</td>
                  <td className="py-2 text-xs whitespace-nowrap">{e.numero_liberado ? "Liberado" : "Consumido"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
