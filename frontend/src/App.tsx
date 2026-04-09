import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { useAuthStore } from "@/store/authStore"
import { LoginPage } from "@/pages/LoginPage"
import { DashboardPage } from "@/pages/DashboardPage"
import { AdminPage } from "@/pages/AdminPage"
import { RolesPage } from "@/pages/RolesPage"
import { AreasPage } from "@/pages/AreasPage"
import { SolicitudesPage } from "@/pages/oc/SolicitudesPage"
import { SolicitudDetallePage } from "@/pages/oc/SolicitudDetallePage"
import { CotizacionFormPage } from "@/pages/oc/CotizacionFormPage"
import { AprobacionPage } from "@/pages/oc/AprobacionPage"
import { KPIPage } from "@/pages/oc/KPIPage"

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

const OC_ALLOWED_ROLES = new Set(["admin", "administrativo", "directivo", "compras"])

function OCRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  if (!user) return <Navigate to="/login" replace />
  const canAccess = OC_ALLOWED_ROLES.has(user.role) || user.area === "Compras"
  if (!canAccess) return <Navigate to="/dashboard" replace />
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

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
