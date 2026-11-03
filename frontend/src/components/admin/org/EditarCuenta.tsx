import { useState } from "react"
import { X } from "lucide-react"
import { useRoles, getApiError } from "@/hooks/useRoles"
import { useSedes } from "@/hooks/useSedes"
import { useUpdateUser } from "@/hooks/useUsers"
import type { UsuarioArea } from "@/hooks/useAreaAcceso"

const campo = "mt-1 h-9 w-full rounded-lg border border-org-linea bg-white px-3 text-[13px] text-org-tinta focus:border-org-vivo focus:outline-none focus-visible:ring-2 focus-visible:ring-org-vivo/30"

/** Datos de la cuenta: correo, nombre, rol, sede y contraseña. El área y el cargo se cambian desde la lista (Mover / Cargo). */
export function EditarCuenta({ usuario, onCerrar }: { usuario: UsuarioArea; onCerrar: () => void }) {
  const { data: roles = [] } = useRoles()
  const { data: sedes = [] } = useSedes()
  const actualizar = useUpdateUser()
  const [f, setF] = useState({ email: usuario.email, full_name: usuario.full_name ?? "", role: usuario.role, sede: usuario.sede ?? "", password: "" })
  const [error, setError] = useState<string>()
  const [hecho, setHecho] = useState<string[]>()
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value })

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setError(undefined)
    const pw = f.password.trim()
    if (pw && pw.length < 8) { setError("La contraseña debe tener al menos 8 caracteres."); return }
    const correo = f.email.trim()
    const cambios: string[] = []
    if (correo !== usuario.email) cambios.push("correo")
    if (f.role !== usuario.role) cambios.push("rol")
    if (f.sede !== (usuario.sede ?? "")) cambios.push("sede")
    if (f.full_name.trim() !== (usuario.full_name ?? "")) cambios.push("nombre")
    if (pw) cambios.push("contraseña")
    if (cambios.length === 0) { setError("No hay cambios para guardar."); return }
    try {
      await actualizar.mutateAsync({
        id: usuario.id,
        email: correo !== usuario.email ? correo : undefined,
        full_name: f.full_name.trim(),
        role: f.role,
        sede: f.sede,
        new_password: pw || undefined,
      })
      setHecho(cambios)
    } catch (err) {
      setError(getApiError(err))
    }
  }

  const nombre = usuario.full_name ?? usuario.email
  const cambioSesion = hecho?.some((c) => c === "correo" || c === "rol" || c === "sede" || c === "contraseña")

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-org-tinta/50 p-4" role="dialog" aria-modal="true" aria-label={`Editar cuenta de ${nombre}`}>
      <form onSubmit={guardar} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl [animation:org-in_.3s_ease_both]" style={{ fontFamily: '"Ubuntu", system-ui, sans-serif' }}>
        <div className="mb-4 flex items-start justify-between">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-org-vivo">Editar cuenta</p>
            <h2 className="truncate text-lg font-medium text-org-tinta">{nombre}</h2>
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="rounded-lg p-1 text-org-tinta/40 hover:bg-org-tinte hover:text-org-rojo"><X className="h-4 w-4" /></button>
        </div>

        {!hecho ? (
          <>
            <div className="grid gap-3">
              <label className="block text-[12px] text-org-tinta/70">Nombre completo
                <input required value={f.full_name} onChange={set("full_name")} className={campo} />
              </label>
              <label className="block text-[12px] text-org-tinta/70">Correo (con el que inicia sesión)
                <input required type="email" autoComplete="off" value={f.email} onChange={set("email")} className={campo} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-[12px] text-org-tinta/70">Rol
                  <select value={f.role} onChange={set("role")} className={campo}>
                    {!roles.some((r) => r.name === f.role) && <option value={f.role}>{f.role}</option>}
                    {roles.map((r) => <option key={r.id} value={r.name}>{r.label}</option>)}
                  </select>
                </label>
                <label className="block text-[12px] text-org-tinta/70">Sede
                  <select value={f.sede} onChange={set("sede")} className={campo}>
                    <option value="">Sin sede</option>
                    {sedes.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                </label>
              </div>
              <label className="block text-[12px] text-org-tinta/70">Nueva contraseña (opcional)
                <input type="password" autoComplete="new-password" minLength={8} value={f.password} onChange={set("password")} placeholder="Vacío = no cambiarla · mínimo 8" className={campo} />
              </label>
            </div>
            <p className="mt-3 text-[11px] leading-snug text-org-tinta/55">
              El área y el cargo se cambian desde la lista de personas. Si cambias el correo, la persona entra con el nuevo y su sesión actual se cierra.
            </p>
            {error && <p role="alert" className="mt-3 text-[12px] text-org-rojo">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={onCerrar} className="h-9 rounded-full px-4 text-[13px] text-org-tinta/70 hover:bg-org-tinte">Cancelar</button>
              <button type="submit" disabled={actualizar.isPending} className="h-9 rounded-full bg-org-rojo px-5 text-[13px] font-medium text-white hover:bg-org-oscuro disabled:opacity-60">
                {actualizar.isPending ? "Guardando…" : "Guardar cambios"}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-[13px] text-org-tinta">Listo: se actualizó {hecho.join(", ")}.</p>
            {cambioSesion && <p className="mt-2 text-[12px] text-org-tinta/70">La persona debe cerrar sesión y volver a entrar para ver el cambio{hecho.includes("correo") ? " (con el correo nuevo)" : ""}.</p>}
            <div className="mt-5 flex justify-end">
              <button type="button" onClick={onCerrar} className="h-9 rounded-full bg-org-rojo px-4 text-[13px] font-medium text-white hover:bg-org-oscuro">Cerrar</button>
            </div>
          </>
        )}
      </form>
    </div>
  )
}
