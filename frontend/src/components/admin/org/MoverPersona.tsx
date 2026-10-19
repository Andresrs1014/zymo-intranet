import { useState } from "react"
import { X } from "lucide-react"
import { INTERNAL_MODULES } from "@/lib/roles"
import { getApiError } from "@/hooks/useRoles"
import { useAreas } from "@/hooks/useAreas"
import { useMoverUsuario, type MovidoResultado } from "@/hooks/useAreaAcceso"

const APP: Record<string, string> = Object.fromEntries(INTERNAL_MODULES.map((m) => [m.id, m.name]))

/** Pasar a una persona a otra área. Dice al final qué cambió y qué debe saber el admin. */
export function MoverPersona({ userId, nombre, areaActual, onCerrar }: {
  userId: number; nombre: string; areaActual: string | null | undefined; onCerrar: () => void
}) {
  const { data: areas = [] } = useAreas()
  const mover = useMoverUsuario()
  const [destino, setDestino] = useState("")
  const [error, setError] = useState<string>()
  const [hecho, setHecho] = useState<MovidoResultado>()
  const opciones = areas.filter((a) => a.name.trim().toLowerCase() !== (areaActual ?? "").trim().toLowerCase())

  async function confirmar(e: React.FormEvent) {
    e.preventDefault()
    if (!destino) return
    setError(undefined)
    try { setHecho(await mover.mutateAsync({ userId, areaId: Number(destino) })) } catch (err) { setError(getApiError(err)) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-org-tinta/50 p-4" role="dialog" aria-modal="true" aria-label={`Mover a ${nombre}`}>
      <form onSubmit={confirmar} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl [animation:org-in_.3s_ease_both]" style={{ fontFamily: '"Ubuntu", system-ui, sans-serif' }}>
        <div className="mb-4 flex items-start justify-between">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-org-vivo">{areaActual ? "Mover de área" : "Asignar área"}</p>
            <h2 className="truncate text-lg font-medium text-org-tinta">{nombre}</h2>
            <p className="mt-0.5 text-[12px] text-org-tinta/55">Ahora en: <strong className="font-medium">{areaActual || "Sin área"}</strong></p>
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="rounded-lg p-1 text-org-tinta/40 hover:bg-org-tinte hover:text-org-rojo"><X className="h-4 w-4" /></button>
        </div>

        {!hecho ? (
          <>
            <label className="block text-[12px] text-org-tinta/70">
              Nueva área
              <select
                autoFocus value={destino} onChange={(e) => setDestino(e.target.value)} required
                className="mt-1 h-9 w-full rounded-lg border border-org-linea bg-white px-3 text-[13px] text-org-tinta focus:border-org-vivo focus:outline-none focus-visible:ring-2 focus-visible:ring-org-vivo/30"
              >
                <option value="">Elige el área…</option>
                {opciones.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </label>
            <p className="mt-3 text-[11px] leading-snug text-org-tinta/55">
              Cambia el área de su cuenta y, si tiene una sola ficha en el directorio, también la ficha. Los accesos que dependen del área (por ejemplo Compras)
              cambian con ella, y deberá volver a iniciar sesión.
            </p>
            {error && <p role="alert" className="mt-3 text-[12px] text-org-rojo">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={onCerrar} className="h-9 rounded-full px-4 text-[13px] text-org-tinta/70 hover:bg-org-tinte">Cancelar</button>
              <button type="submit" disabled={!destino || mover.isPending} className="h-9 rounded-full bg-org-rojo px-4 text-[13px] font-medium text-white hover:bg-org-oscuro disabled:opacity-60">Mover</button>
            </div>
          </>
        ) : (
          <>
            <p className="text-[13px] text-org-tinta">Listo: <strong>{nombre}</strong> {hecho.area ? <>ahora está en <strong>{hecho.area}</strong></> : <>quedó <strong>sin área</strong></>}.</p>
            <ul className="mt-3 space-y-1.5 text-[12px] text-org-tinta/70">
              <li>Debe cerrar sesión y volver a entrar para ver el cambio.</li>
              {hecho.ficha === "movida" && <li>Su ficha del directorio también pasó a esta área.</li>}
              {hecho.ficha === "sin_ficha" && <li>No tiene ficha en el directorio: solo cambió su cuenta.</li>}
              {hecho.ficha === "varias" && <li className="text-org-rojo">Tiene varias fichas vinculadas: no las toqué. Corrige el vínculo en T&amp;C.</li>}
              {hecho.permisos_inactivos.length > 0 && (
                <li className="text-org-rojo">
                  Dejan de aplicarle (son exclusivos de otras áreas): {hecho.permisos_inactivos.map((p) => APP[p] ?? p).join(", ")}. No se borraron.
                </li>
              )}
            </ul>
            <div className="mt-5 flex justify-end">
              <button type="button" onClick={onCerrar} className="h-9 rounded-full bg-org-rojo px-4 text-[13px] font-medium text-white hover:bg-org-oscuro">Cerrar</button>
            </div>
          </>
        )}
      </form>
    </div>
  )
}
