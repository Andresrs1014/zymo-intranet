import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { useEffect } from "react"
import { useAuthStore } from "@/store/authStore"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import {
  canAccessMantenimiento,
  canSeeOC,
  canSeeSGC,
  canSeeOperativo,
  canSeeFinanciero,
  canSeeGerencial,
  canSeeSIG,
  canUseAgentePanel,
  canSeeExtraccionIA,
  canSeeHelix,
  canSeeTyC,
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
import ParesExternosPage from "@/pages/oc/ParesExternosPage"
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
import { HelixPage } from "@/pages/planeacion/helix/HelixPage"
import { TaskPage } from "@/pages/tareas/TaskPage"
import { SigPage } from "@/pages/sig/SigPage"
import MantenimientoPage from "@/pages/mantenimiento/MantenimientoPage"
import NuevaMantenimientoPage from "@/pages/mantenimiento/NuevaMantenimientoPage"
import MantenimientoDetallePage from "@/pages/mantenimiento/MantenimientoDetallePage"
import MantenimientoPortalShell from "@/pages/mantenimiento/MantenimientoPortalShell"
import MantenimientoLegacyRedirect from "@/pages/mantenimiento/MantenimientoLegacyRedirect"
import MantenimientoDashboard from "@/pages/mantenimiento/MantenimientoDashboard"
import { TyCPage } from "@/pages/tc/TyCPage"
import { TyCDirectorioPage } from "@/pages/tc/TyCDirectorioPage"
import { TyCPersonaPage } from "@/pages/tc/TyCPersonaPage"
import { TyCOrganigramaPage } from "@/pages/tc/TyCOrganigramaPage"
import { TyCImportPage } from "@/pages/tc/TyCImportPage"
import { TyCManualesPage } from "@/pages/tc/TyCManualesPage"
import { TyCOrganigramaCanvasPage } from "@/pages/tc/TyCOrganigramaCanvasPage"

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

function SigRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  if (!user) return <Navigate to="/login" replace />
  if (!canSeeSIG(user.role, user.app_permissions)) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function HelixRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  if (!user) return <Navigate to="/login" replace />
  if (!canSeeHelix(user.role, user.app_permissions)) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function MantenimientoRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  if (!user) return <Navigate to="/login" replace />
  if (!canAccessMantenimiento(user.role, user.area, user.app_permissions)) {
    return <Navigate to="/dashboard" replace />
  }
  return <>{children}</>
}

function TyCRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  if (!user) return <Navigate to="/login" replace />
  if (!canSeeTyC(user.role, user.app_permissions)) return <Navigate to="/dashboard" replace />
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
        {/* Portal móvil permanente — auxiliar sin login */}
        <Route path="/m/portal/:portalToken" element={<MantenimientoPortalShell />}>
          <Route index element={<MantenimientoPage />} />
          <Route path=":id" element={<MantenimientoDetallePage />} />
        </Route>
        <Route path="/m/q/:accessToken" element={<MantenimientoLegacyRedirect mode="stable" />} />
        <Route path="/m/:token" element={<MantenimientoLegacyRedirect mode="jwt" />} />
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
          path="/oc/externos-mantenimiento"
          element={
            <OCRoute>
              <ParesExternosPage />
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

        {/* Gestión de Tareas V2 */}
        <Route
          path="/tareas-v2"
          element={
            <PrivateRoute>
              <TaskPage />
            </PrivateRoute>
          }
        />

        {/* SIG — Sistema Integrado de Gestión */}
        <Route
          path="/sig/*"
          element={
            <SigRoute>
              <SigPage />
            </SigRoute>
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

        {/* Módulo de Mantenimiento */}
        <Route
          path="/mantenimiento"
          element={
            <MantenimientoRoute>
              <MantenimientoPage />
            </MantenimientoRoute>
          }
        />
        <Route
          path="/mantenimiento/nueva"
          element={
            <MantenimientoRoute>
              <NuevaMantenimientoPage />
            </MantenimientoRoute>
          }
        />
        <Route
          path="/mantenimiento/tablero"
          element={
            <MantenimientoRoute>
              <MantenimientoDashboard />
            </MantenimientoRoute>
          }
        />
        <Route
          path="/mantenimiento/:id"
          element={
            <MantenimientoRoute>
              <MantenimientoDetallePage />
            </MantenimientoRoute>
          }
        />

        {/* Módulo T&C — Talento y Cultura */}
        <Route
          path="/tc"
          element={
            <TyCRoute>
              <TyCPage />
            </TyCRoute>
          }
        />
        <Route
          path="/tc/directorio"
          element={
            <TyCRoute>
              <TyCDirectorioPage />
            </TyCRoute>
          }
        />
        <Route
          path="/tc/persona/:id"
          element={
            <TyCRoute>
              <TyCPersonaPage />
            </TyCRoute>
          }
        />
        <Route
          path="/tc/organigrama"
          element={
            <TyCRoute>
              <TyCOrganigramaPage />
            </TyCRoute>
          }
        />
        <Route
          path="/tc/import"
          element={
            <TyCRoute>
              <TyCImportPage />
            </TyCRoute>
          }
        />
        <Route
          path="/tc/manuales"
          element={
            <TyCRoute>
              <TyCManualesPage />
            </TyCRoute>
          }
        />
        <Route
          path="/tc/organigrama/canvas"
          element={
            <TyCRoute>
              <TyCOrganigramaCanvasPage />
            </TyCRoute>
          }
        />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
    </ErrorBoundary>
  )
}
