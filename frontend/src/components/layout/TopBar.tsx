import { useState, useRef, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAuthStore } from "@/store/authStore"
import { useLogout } from "@/hooks/useAuth"
import { getRoleLabel } from "@/lib/roles"
import { useAgentPanelStore } from "@/store/agentPanelStore"

interface TopBarProps {
  title?: string
  /** Muestra el control para anclar el panel del agente a la derecha (escritorio). */
  showAgentDockToggle?: boolean
}

function IconAgent() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path d="M13 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM18 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM14 15a4 4 0 0 0-8 0v3h8v-3ZM6 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM16 15a4 4 0 0 0-4-4v3h4v-3ZM4 15a4 4 0 0 0-4 4v1h4v-1a3 3 0 0 1 0-.012V15Z" />
    </svg>
  )
}

function IconPinned() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path fillRule="evenodd" d="M10 1a.75.75 0 0 1 .75.75v1.5h1.5a3.25 3.25 0 0 1 2.78 4.924l-.936 1.638a.25.25 0 0 0 .036.307l1.6 1.6A.75.75 0 0 1 15.72 13H11v5.25a.75.75 0 0 1-1.5 0V13H4.28a.75.75 0 0 1-.53-1.28l1.6-1.6a.25.25 0 0 0 .036-.308L4.45 8.174A3.25 3.25 0 0 1 7.25 3.25h1.5V1.75A.75.75 0 0 1 10 1Z" clipRule="evenodd" />
    </svg>
  )
}

export function TopBar({ title = "Dashboard", showAgentDockToggle = false }: TopBarProps) {
  const user = useAuthStore((s) => s.user)
  const logout = useLogout()
  const navigate = useNavigate()
  const docked = useAgentPanelStore((s) => s.docked)
  const toggleDocked = useAgentPanelStore((s) => s.toggleDocked)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  if (!user) return (
    <header className="flex items-center justify-between border-b border-gray-100 bg-white px-6 py-4">
      <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
    </header>
  )

  const initials = (user.full_name ?? user.email).charAt(0).toUpperCase()

  return (
    <header className="flex items-center justify-between border-b border-gray-100 bg-white px-6 py-4 gap-3">
      <h1 className="text-lg font-semibold text-gray-900 truncate min-w-0">{title}</h1>

      <div className="flex items-center gap-2 shrink-0">
        {showAgentDockToggle && (
          <button
            type="button"
            onClick={toggleDocked}
            className={`hidden lg:inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
              docked
                ? "border-brand-blue bg-blue-50 text-brand-blue"
                : "border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
            title={docked ? "Desanclar asistente (vista flotante)" : "Anclar asistente a la derecha"}
          >
            {docked ? <IconPinned /> : <IconAgent />}
            {docked ? "Asistente anclado" : "Anclar IA"}
          </button>
        )}

        <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-gray-50"
        >
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-gray-900 leading-none">
              {user.full_name ?? user.email}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {getRoleLabel(user.role)}
            </p>
          </div>
          <div className="h-9 w-9 rounded-full bg-brand-blue flex items-center justify-center shrink-0">
            <span className="text-white font-semibold text-sm">{initials}</span>
          </div>
        </button>

        {open && (
          <div className="absolute right-0 mt-2 w-52 rounded-xl border border-gray-100 bg-white shadow-lg z-50 py-1">
            {/* Mi perfil */}
            <button
              disabled
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-400 cursor-not-allowed"
            >
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span>
                Mi perfil
                <span className="ml-1 text-[10px] text-gray-300">(próximamente)</span>
              </span>
            </button>

            {/* Configuración — solo admins */}
            {user.role === "admin" && (
              <>
                <div className="my-1 border-t border-gray-100" />
                <p className="px-4 pt-1.5 pb-0.5 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                  Configuración
                </p>
                <button
                  onClick={() => { navigate("/admin/configuracion/usuarios"); setOpen(false) }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <span>👥</span> Usuarios
                </button>
                <button
                  onClick={() => { navigate("/admin/configuracion/roles"); setOpen(false) }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <span>🎭</span> Roles
                </button>
                <button
                  onClick={() => { navigate("/admin/configuracion/areas"); setOpen(false) }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <span>🏢</span> Áreas y Sedes
                </button>
              </>
            )}

            <div className="my-1 border-t border-gray-100" />

            {/* Cerrar sesión */}
            <button
              onClick={() => { logout(); setOpen(false) }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
            >
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Cerrar sesión
            </button>
          </div>
        )}
        </div>
      </div>
    </header>
  )
}
