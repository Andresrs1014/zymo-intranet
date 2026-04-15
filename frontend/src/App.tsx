import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { useAuthStore } from "@/store/authStore"
import { canSeeOC, canSeeSGC } from "@/lib/permissions"
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
  if (!canSeeOC(user.role, user.area)) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function SGCRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  if (!user) return <Navigate to="/login" replace />
  if (!canSeeSGC(user.role, user.area)) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
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

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
