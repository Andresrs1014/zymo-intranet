import { useState, useRef, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAuthStore } from "@/store/authStore"
import { useLogout } from "@/hooks/useAuth"
import { getRoleLabel } from "@/lib/roles"

interface TopBarProps {
  title?: string
}

export function TopBar({ title = "Dashboard" }: TopBarProps) {
  const user = useAuthStore((s) => s.user)
  const logout = useLogout()
  const navigate = useNavigate()
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
    <header className="flex items-center justify-between border-b border-gray-100 bg-white px-6 py-4">
      <h1 className="text-lg font-semibold text-gray-900">{title}</h1>

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
    </header>
  )
}
