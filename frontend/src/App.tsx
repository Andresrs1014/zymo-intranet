import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { useEffect } from "react"
import { useAuthStore } from "@/store/authStore"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import {
  canSeeOC,
  canSeeSGC,
  canSeeOperativo,
  canSeeFinanciero,
  canSeeGerencial,
  canUseAgentePanel,
  canSeeExtraccionIA,
  canSeeHelix,
  canManageDevTasks,
  canSubmitDevTasks,
} from "@/lib/permissions"
import { useAgentPanelStore } from "@/store/agentPanelStore"
import { useMinWidth } from "@/hooks/useMinWidth"
import { useMe } from "@/hooks/useAuth"
import { LoginPage } from "@/pages/LoginPage"
import { DashboardPage } from "@/pages/DashboardPage"
import { AdminPage } from "@/pages/AdminPage"
import { RolesPage } from "@/pages/RolesPage"
import { AreasPage } from "@/pages/AreasPage"
import { AdministrativoPage } from "@/pages/AdministrativoPage"
import { SolicitudesPage } from "@/pages/oc/SolicitudesPage"
import { SolicitudDetallePage } from "@/pages/oc/SolicitudDetallePage"
import { CotizacionFormPage } from "@/pages/oc/CotizacionFormPage"
import { AprobacionPage } from "@/pages/oc/AprobacionPage"
import { KPIPage } from "@/pages/oc/KPIPage"
import { OcConfigPage } from "@/pages/oc/OcConfigPage"
import { SGCPage } from "@/pages/sgc/SGCPage"
import { ProveedoresPage } from "@/pages/sgc/ProveedoresPage"
import { OperativoPage } from "@/pages/operativo/OperativoPage"
import { MisSolicitudesPage } from "@/pages/operativo/MisSolicitudesPage"
import { MiSolicitudDetallePage } from "@/pages/operativo/MiSolicitudDetallePage"
import { NuevaSolicitudPage } from "@/pages/operativo/NuevaSolicitudPage"
import { PaquetesPage } from "@/pages/operativo/PaquetesPage"
import { FinancieroPage } from "@/pages/financiero/FinancieroPage"
import { FacturasPage } from "@/pages/financiero/FacturasPage"
import { FacturaDetallePage } from "@/pages/financiero/FacturaDetallePage"
import { FinancieroConfigPage } from "@/pages/financiero/FinancieroConfigPage"
import { PrintFacturacionPage } from "@/pages/financiero/PrintFacturacionPage"
import { AgentFloatingWindow } from "@/components/agent/AgentFloatingWindow"
import { GerencialPage } from "@/pages/gerencial/GerencialPage"
import { ExtraccionIAPage } from "@/pages/admin/ExtraccionIAPage"
import { GestionTareasPage } from "@/pages/herramientas/tareas/GestionTareasPage"
import { HelixPage } from "@/pages/planeacion/helix/HelixPage"
import { TaskPage } from "@/pages/tareas/TaskPage"

// Decodifica el claim `exp` del JWT sin verificar firma (solo para chequeo local de expiración)
function isTokenExpired(token: string): boolean {
  try {
    const [, payload] = token.split(".")
    const { exp } = JSON.parse(atob(payload)) as { exp?: number }
    return typeof exp === "number" && exp * 1000 < Date.now()
  } catch {
    return true // token malformado → tratar como expirado
  }
}

/**
 * Limpia la sesión si el token JWT ya expiró.
 * Se ejecuta al montar la app, al recuperar el foco y al volver a la pestaña,
 * cubriendo el caso de cierre/reapertura del navegador y tabs dejadas abiertas.
 */
function useTokenGuard() {
  useEffect(() => {
    function check() {
      const { token, clearAuth } = useAuthStore.getState()
      if (token && isTokenExpired(token)) {
        clearAuth()
      }
    }
    check()
    document.addEventListener("visibilitychange", check)
    window.addEventListener("focus", check)
    return () => {
      document.removeEventListener("visibilitychange", check)
      window.removeEventListener("focus", check)
    }
  }, [])
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  if (isAuthenticated) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== "admin") return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function OCRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  if (!user) return <Navigate to="/login" replace />
  if (!canSeeOC(user.role, user.area, user.app_permissions)) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function SGCRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  if (!user) return <Navigate to="/login" replace />
  if (!canSeeSGC(user.role, user.area, user.app_permissions)) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function OperativoRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  if (!user) return <Navigate to="/login" replace />
  if (!canSeeOperativo(user.role, user.area, user.app_permissions)) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function FinancieroRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  if (!user) return <Navigate to="/login" replace />
  if (!canSeeFinanciero(user.role, user.area, user.app_permissions)) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function GerencialRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  if (!user) return <Navigate to="/login" replace />
  if (!canSeeGerencial(user.role, user.app_permissions)) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function ExtraccionIARoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  if (!user) return <Navigate to="/login" replace />
  if (!canSeeExtraccionIA(user.role, user.app_permissions)) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function HelixRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  if (!user) return <Navigate to="/login" replace />
  if (!canSeeHelix(user.role, user.app_permissions)) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function HerramientasTareasRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  if (!user) return <Navigate to="/login" replace />
  const hasTool = canSubmitDevTasks(user.user_tools ?? []) || canManageDevTasks(user.user_tools ?? [])
  if (!hasTool) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function AgentLayer() {
  const user = useAuthStore((s) => s.user)
  const docked = useAgentPanelStore((s) => s.docked)
  const lg = useMinWidth(1024)

  if (!user) return null
  if (!canUseAgentePanel(user.role, user.area, user.app_permissions)) return null

  const agente = canSeeGerencial(user.role, user.app_permissions) ? "zymo" : "administrativo"

  if (docked && lg) return null

  return (
    <AgentFloatingWindow
      agente={agente}
      usuarioNombre={user.full_name ?? user.email}
    />
  )
}

export default function App() {
  useTokenGuard()
  useMe()

  return (
    <ErrorBoundary>
    <BrowserRouter>
      <AgentLayer />
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <DashboardPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/admin/usuarios"
          element={<Navigate to="/admin/configuracion/usuarios" replace />}
        />
        <Route
          path="/admin/configuracion/usuarios"
          element={
            <AdminRoute>
              <AdminPage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/configuracion/roles"
          element={
            <AdminRoute>
              <RolesPage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/configuracion/areas"
          element={
            <AdminRoute>
              <AreasPage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/extraccion-ia"
          element={
            <ExtraccionIARoute>
              <ExtraccionIAPage />
            </ExtraccionIARoute>
          }
        />
        {/* Administrativo */}
        <Route
          path="/administrativo"
          element={
            <OCRoute>
              <AdministrativoPage />
            </OCRoute>
          }
        />
        {/* OC Automatizaciones */}
        <Route
          path="/oc/solicitudes"
          element={
            <OCRoute>
              <SolicitudesPage />
            </OCRoute>
          }
        />
        <Route
          path="/oc/solicitudes/:id"
          element={
            <OCRoute>
              <SolicitudDetallePage />
            </OCRoute>
          }
        />

        <Route
          path="/oc/solicitudes/:id/cotizar"
          element={
            <OCRoute>
              <CotizacionFormPage />
            </OCRoute>
          }
        />
        <Route
          path="/oc/aprobacion"
          element={
            <OCRoute>
              <AprobacionPage />
            </OCRoute>
          }
        />
        <Route
          path="/oc/kpis"
          element={
            <OCRoute>
              <KPIPage />
            </OCRoute>
          }
        />

        <Route
          path="/oc/configuracion"
          element={
            <AdminRoute>
              <OcConfigPage />
            </AdminRoute>
          }
        />

        {/* Operativo */}
        <Route
          path="/operativo"
          element={
            <OperativoRoute>
              <OperativoPage />
            </OperativoRoute>
          }
        />
        <Route
          path="/operativo/mis-solicitudes"
          element={
            <OperativoRoute>
              <MisSolicitudesPage />
            </OperativoRoute>
          }
        />
        <Route
          path="/operativo/mis-solicitudes/:id"
          element={
            <PrivateRoute>
              <MiSolicitudDetallePage />
            </PrivateRoute>
          }
        />
        <Route
          path="/operativo/nueva-solicitud"
          element={
            <PrivateRoute>
              <NuevaSolicitudPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/operativo/paquetes"
          element={
            <PrivateRoute>
              <PaquetesPage />
            </PrivateRoute>
          }
        />

        {/* SGC — Sistema de Gestión de Calidad */}
        <Route
          path="/sgc"
          element={
            <SGCRoute>
              <SGCPage />
            </SGCRoute>
          }
        />
        <Route
          path="/sgc/proveedores"
          element={
            <SGCRoute>
              <ProveedoresPage />
            </SGCRoute>
          }
        />

        {/* Financiero */}
        <Route
          path="/financiero"
          element={
            <FinancieroRoute>
              <FinancieroPage />
            </FinancieroRoute>
          }
        />
        <Route
          path="/financiero/facturas"
          element={
            <FinancieroRoute>
              <FacturasPage />
            </FinancieroRoute>
          }
        />
        <Route
          path="/financiero/facturas/:solicitudId"
          element={
            <FinancieroRoute>
              <FacturaDetallePage />
            </FinancieroRoute>
          }
        />
        <Route
          path="/financiero/facturas/:solicitudId/print"
          element={
            <FinancieroRoute>
              <PrintFacturacionPage />
            </FinancieroRoute>
          }
        />
        <Route
          path="/financiero/configuracion"
          element={
            <AdminRoute>
              <FinancieroConfigPage />
            </AdminRoute>
          }
        />

        {/* Módulo Gerencial */}
        <Route
          path="/gerencial"
          element={
            <GerencialRoute>
              <GerencialPage />
            </GerencialRoute>
          }
        />

        {/* Herramientas */}
        <Route
          path="/herramientas/tareas"
          element={
            <HerramientasTareasRoute>
              <GestionTareasPage />
            </HerramientasTareasRoute>
          }
        />

        {/* Gestión de Tareas V2 */}
        <Route
          path="/tareas-v2"
          element={
            <PrivateRoute>
              <TaskPage />
            </PrivateRoute>
          }
        />

        {/* Planeación — Helix Zymo */}
        <Route
          path="/planeacion/helix"
          element={
            <HelixRoute>
              <HelixPage />
            </HelixRoute>
          }
        />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
    </ErrorBoundary>
  )
}
