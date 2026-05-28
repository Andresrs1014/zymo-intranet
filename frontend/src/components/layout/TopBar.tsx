import { useNavigate } from "react-router-dom"
import { useAuthStore } from "@/store/authStore"
import { useLogout } from "@/hooks/useAuth"
import { getRoleLabel } from "@/lib/roles"
import { useAgentPanelStore } from "@/store/agentPanelStore"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface TopBarProps {
  title?: string
  /** Muestra el control para anclar el panel del agente a la derecha (escritorio). */
  showAgentDockToggle?: boolean
}

export function TopBar({ title = "Dashboard", showAgentDockToggle = false }: TopBarProps) {
  const user = useAuthStore((s) => s.user)
  const logout = useLogout()
  const navigate = useNavigate()
  const docked = useAgentPanelStore((s) => s.docked)
  const toggleDocked = useAgentPanelStore((s) => s.toggleDocked)

  if (!user) return (
    <header className="flex items-center justify-between h-14 border-b border-border bg-background px-6">
      <h1 className="text-sm font-semibold text-foreground">{title}</h1>
    </header>
  )

  const displayName = user.full_name ?? user.email
  const nameParts = displayName.trim().split(/\s+/)
  const initials = nameParts.length >= 2
    ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
    : displayName.charAt(0).toUpperCase()

  return (
    <header className="flex items-center justify-between h-14 border-b border-border bg-background px-6 gap-3">
      <h1 className="text-sm font-semibold text-foreground truncate min-w-0">{title}</h1>

      <div className="flex items-center gap-2 shrink-0">
        {showAgentDockToggle && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={toggleDocked}
            className={`hidden lg:inline-flex text-xs ${
              docked ? "border-blue-300 bg-blue-50 text-blue-600" : ""
            }`}
            title={docked ? "Desanclar asistente (vista flotante)" : "Anclar asistente a la derecha"}
          >
            {docked ? "Asistente anclado" : "Anclar IA"}
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex items-center gap-2 px-2 py-1.5 h-auto"
            >
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-foreground leading-none">
                  {displayName}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {getRoleLabel(user.role)}
                </p>
              </div>
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-medium truncate">{displayName}</span>
                <span className="text-xs text-muted-foreground font-normal truncate">
                  {getRoleLabel(user.role)}
                </span>
              </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator />

            <DropdownMenuItem disabled className="text-muted-foreground cursor-not-allowed">
              Perfil
              <span className="ml-1 text-[10px] text-muted-foreground/60">(próximamente)</span>
            </DropdownMenuItem>

            {user.role === "admin" && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/admin/configuracion/usuarios")}>
                  Usuarios
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/admin/configuracion/roles")}>
                  Roles
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/admin/configuracion/areas")}>
                  Áreas y Sedes
                </DropdownMenuItem>
              </>
            )}

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={() => logout()}
              className="text-destructive focus:text-destructive focus:bg-destructive/10"
            >
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
