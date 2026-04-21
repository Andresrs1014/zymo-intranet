import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { useAuthStore } from "@/store/authStore"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { canSeeOC, canSeeSGC, canSeeOperativo, canSeeFinanciero } from "@/lib/permissions"
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
import { NuevaSolicitudPage } from "@/pages/operativo/NuevaSolicitudPage"
import { PaquetesPage } from "@/pages/operativo/PaquetesPage"
import { FinancieroPage } from "@/pages/financiero/FinancieroPage"
import { FacturasPage } from "@/pages/financiero/FacturasPage"
import { FacturaDetallePage } from "@/pages/financiero/FacturaDetallePage"
import { AgentFloatingWindow } from "@/components/agent/AgentFloatingWindow"

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

// Roles con acceso al agente administrativo
const ROLES_AGENTE_ADMIN = new Set(["admin", "administrativo", "compras", "directivo"])

function AgentLayer() {
  const user = useAuthStore((s) => s.user)
  if (!user || !ROLES_AGENTE_ADMIN.has(user.role)) return null
  return (
    <AgentFloatingWindow
      agente="administrativo"
      usuarioNombre={user.full_name ?? user.email}
    />
  )
}

export default function App() {
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

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
    </ErrorBoundary>
  )
}
