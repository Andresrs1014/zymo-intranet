import { BrowserRouter, Routes, Route, Navigate, useLocation, useSearchParams } from "react-router-dom"
import { lazy, Suspense, useEffect } from "react"
import { useAuthStore } from "@/store/authStore"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { CargandoPagina } from "@/components/layout/CargandoPagina"
import {
  canAccessMantenimiento,
  canSeeOC,
  canSeeSGC,
  canSeeOperativo,
  canSeeFinanciero,
  canSeeGerencial,
  canSeeSIG,
  canSeeSigLider,
  canSeeTyC,
  canUseAgenda,
  canUseEvaluacionesDesempeno,
  canUseAprobaciones,
  canSeeOperClientes,
  canSeeGestionTickets,
  canSeeTickets,
  canSeeSAC,
  canSeeReportesDesarrollo,
  canSeeLibertadora,
} from "@/lib/permissions"
import { useIsMobile } from "@/hooks/use-mobile"
import { useMe } from "@/hooks/useAuth"
import { LoginPage } from "@/pages/LoginPage"
import { DashboardPage } from "@/pages/DashboardPage"


// Cada pantalla se descarga solo cuando se entra a ella (el paquete inicial pasó de ~2,7 MB a lo mínimo para abrir la sesión).
const AdminPage = lazy(() => import("@/pages/AdminPage").then((m) => ({ default: m.AdminPage })))
const ConfiguracionIntranetPage = lazy(() => import("@/pages/admin/ConfiguracionIntranetPage").then((m) => ({ default: m.ConfiguracionIntranetPage })))
const RolesPage = lazy(() => import("@/pages/RolesPage").then((m) => ({ default: m.RolesPage })))
const OrganizacionPage = lazy(() => import("@/pages/OrganizacionPage").then((m) => ({ default: m.OrganizacionPage })))
const AreasPage = lazy(() => import("@/pages/AreasPage").then((m) => ({ default: m.AreasPage })))
const SmtpConfigPage = lazy(() => import("@/pages/admin/SmtpConfigPage").then((m) => ({ default: m.SmtpConfigPage })))
const WhatsappConfigPage = lazy(() => import("@/pages/admin/WhatsappConfigPage").then((m) => ({ default: m.WhatsappConfigPage })))
const UsuariosExternosPage = lazy(() => import("@/pages/admin/UsuariosExternosPage").then((m) => ({ default: m.UsuariosExternosPage })))
const AdministrativoPage = lazy(() => import("@/pages/AdministrativoPage").then((m) => ({ default: m.AdministrativoPage })))
const SolicitudesPage = lazy(() => import("@/pages/oc/SolicitudesPage").then((m) => ({ default: m.SolicitudesPage })))
const SolicitudDetallePage = lazy(() => import("@/pages/oc/SolicitudDetallePage").then((m) => ({ default: m.SolicitudDetallePage })))
const ParesExternosPage = lazy(() => import("@/pages/oc/ParesExternosPage"))
const CotizacionFormPage = lazy(() => import("@/pages/oc/CotizacionFormPage").then((m) => ({ default: m.CotizacionFormPage })))
const AprobacionPage = lazy(() => import("@/pages/oc/AprobacionPage").then((m) => ({ default: m.AprobacionPage })))
const KPIPage = lazy(() => import("@/pages/oc/KPIPage").then((m) => ({ default: m.KPIPage })))
const OcConfigPage = lazy(() => import("@/pages/oc/OcConfigPage").then((m) => ({ default: m.OcConfigPage })))
const SGCPage = lazy(() => import("@/pages/sgc/SGCPage").then((m) => ({ default: m.SGCPage })))
const ProveedoresPage = lazy(() => import("@/pages/sgc/ProveedoresPage").then((m) => ({ default: m.ProveedoresPage })))
const OperativoPage = lazy(() => import("@/pages/operativo/OperativoPage").then((m) => ({ default: m.OperativoPage })))
const MisSolicitudesPage = lazy(() => import("@/pages/operativo/MisSolicitudesPage").then((m) => ({ default: m.MisSolicitudesPage })))
const MiSolicitudDetallePage = lazy(() => import("@/pages/operativo/MiSolicitudDetallePage").then((m) => ({ default: m.MiSolicitudDetallePage })))
const NuevaSolicitudPage = lazy(() => import("@/pages/operativo/NuevaSolicitudPage").then((m) => ({ default: m.NuevaSolicitudPage })))
const PaquetesPage = lazy(() => import("@/pages/operativo/PaquetesPage").then((m) => ({ default: m.PaquetesPage })))
const OperClientesPage = lazy(() => import("@/pages/operativo/OperClientesPage").then((m) => ({ default: m.OperClientesPage })))
const GestionarTicketsPage = lazy(() => import("@/pages/operativo/GestionarTicketsPage").then((m) => ({ default: m.GestionarTicketsPage })))
const FinancieroPage = lazy(() => import("@/pages/financiero/FinancieroPage").then((m) => ({ default: m.FinancieroPage })))
const FacturasPage = lazy(() => import("@/pages/financiero/FacturasPage").then((m) => ({ default: m.FacturasPage })))
const FacturaDetallePage = lazy(() => import("@/pages/financiero/FacturaDetallePage").then((m) => ({ default: m.FacturaDetallePage })))
const FinancieroConfigPage = lazy(() => import("@/pages/financiero/FinancieroConfigPage").then((m) => ({ default: m.FinancieroConfigPage })))
const PrintFacturacionPage = lazy(() => import("@/pages/financiero/PrintFacturacionPage").then((m) => ({ default: m.PrintFacturacionPage })))
const GerencialPage = lazy(() => import("@/pages/gerencial/GerencialPage").then((m) => ({ default: m.GerencialPage })))
const LibertadoraPage = lazy(() => import("@/pages/libertadora/LibertadoraPage").then((m) => ({ default: m.LibertadoraPage })))
const LibertadoraPartnerPage = lazy(() => import("@/pages/libertadora/partner/LibertadoraPartnerPage").then((m) => ({ default: m.LibertadoraPartnerPage })))
const TicketsPage = lazy(() => import("@/pages/tickets/TicketsPage").then((m) => ({ default: m.TicketsPage })))
const SacPage = lazy(() => import("@/pages/sac/SacPage").then((m) => ({ default: m.SacPage })))
const SurveyPage = lazy(() => import("@/pages/survey/SurveyPage").then((m) => ({ default: m.SurveyPage })))
const TaskPage = lazy(() => import("@/pages/tareas/TaskPage").then((m) => ({ default: m.TaskPage })))
const SigPage = lazy(() => import("@/pages/sig/SigPage").then((m) => ({ default: m.SigPage })))
const MantenimientoPage = lazy(() => import("@/pages/mantenimiento/MantenimientoPage"))
const NuevaMantenimientoPage = lazy(() => import("@/pages/mantenimiento/NuevaMantenimientoPage"))
const MantenimientoDetallePage = lazy(() => import("@/pages/mantenimiento/MantenimientoDetallePage"))
const MantenimientoPortalShell = lazy(() => import("@/pages/mantenimiento/MantenimientoPortalShell"))
const MantenimientoMobilePage = lazy(() => import("@/pages/mantenimiento/MantenimientoMobilePage"))
const MantenimientoDashboard = lazy(() => import("@/pages/mantenimiento/MantenimientoDashboard"))
const TyCPage = lazy(() => import("@/pages/tc/TyCPage").then((m) => ({ default: m.TyCPage })))
const TyCDirectorioPage = lazy(() => import("@/pages/tc/TyCDirectorioPage").then((m) => ({ default: m.TyCDirectorioPage })))
const TyCPersonaPage = lazy(() => import("@/pages/tc/TyCPersonaPage").then((m) => ({ default: m.TyCPersonaPage })))
const TyCOrganigramaPage = lazy(() => import("@/pages/tc/TyCOrganigramaPage").then((m) => ({ default: m.TyCOrganigramaPage })))
const TyCImportPage = lazy(() => import("@/pages/tc/TyCImportPage").then((m) => ({ default: m.TyCImportPage })))
const TyCManualesPage = lazy(() => import("@/pages/tc/TyCManualesPage").then((m) => ({ default: m.TyCManualesPage })))
const TyCFormatosPage = lazy(() => import("@/pages/tc/TyCFormatosPage").then((m) => ({ default: m.TyCFormatosPage })))
const TyCFormatoAusentismoPage = lazy(() => import("@/pages/tc/TyCFormatoAusentismoPage").then((m) => ({ default: m.TyCFormatoAusentismoPage })))
const TyCEvaluacionDesempenoPage = lazy(() => import("@/pages/tc/TyCEvaluacionDesempenoPage").then((m) => ({ default: m.TyCEvaluacionDesempenoPage })))
const TyCAprobacionesPage = lazy(() => import("@/pages/tc/TyCAprobacionesPage").then((m) => ({ default: m.TyCAprobacionesPage })))
const TyCIndicadoresPage = lazy(() => import("@/pages/tc/TyCIndicadoresPage").then((m) => ({ default: m.TyCIndicadoresPage })))
const TyCAgendaCalendarioPage = lazy(() => import("@/pages/tc/TyCAgendaCalendarioPage").then((m) => ({ default: m.TyCAgendaCalendarioPage })))
const TyCAgendaEventoPage = lazy(() => import("@/pages/tc/TyCAgendaEventoPage").then((m) => ({ default: m.TyCAgendaEventoPage })))
const TyCConfigPage = lazy(() => import("@/pages/tc/TyCConfigPage").then((m) => ({ default: m.TyCConfigPage })))
const TyCRotacionPage = lazy(() => import("@/pages/tc/TyCRotacionPage").then((m) => ({ default: m.TyCRotacionPage })))
const TyCClientesPage = lazy(() => import("@/pages/tc/TyCClientesPage").then((m) => ({ default: m.TyCClientesPage })))
const TyCEmpresaPage = lazy(() => import("@/pages/tc/TyCEmpresaPage").then((m) => ({ default: m.TyCEmpresaPage })))
const TyCNuevoPersonalCalendarioPage = lazy(() => import("@/pages/tc/TyCNuevoPersonalCalendarioPage").then((m) => ({ default: m.TyCNuevoPersonalCalendarioPage })))
const TyCNuevoPersonalNuevoPage = lazy(() => import("@/pages/tc/TyCNuevoPersonalNuevoPage").then((m) => ({ default: m.TyCNuevoPersonalNuevoPage })))
const TyCNuevoPersonalDiaPage = lazy(() => import("@/pages/tc/TyCNuevoPersonalDiaPage").then((m) => ({ default: m.TyCNuevoPersonalDiaPage })))
const ReportesDesarrolloPage = lazy(() => import("@/pages/reportes/ReportesDesarrolloPage").then((m) => ({ default: m.ReportesDesarrolloPage })))
const ReporteDetallePage = lazy(() => import("@/pages/reportes/ReporteDetallePage").then((m) => ({ default: m.ReporteDetallePage })))
const ReporteEditorPageNew = lazy(() => import("@/pages/reportes/ReporteEditorPage").then((m) => ({ default: m.ReporteEditorPageNew })))
const ReporteEditorPageEdit = lazy(() => import("@/pages/reportes/ReporteEditorPage").then((m) => ({ default: m.ReporteEditorPageEdit })))

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
  const [searchParams] = useSearchParams()
  // An already-authenticated user hitting /login?app=X is here for the SSO handoff, not
  // to re-login — let LoginPage itself handle that redirect instead of bouncing to /dashboard.
  if (isAuthenticated && !searchParams.get("app")) return <Navigate to="/dashboard" replace />
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

function OperClientesRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  if (!user) return <Navigate to="/login" replace />
  if (!canSeeOperClientes(user.role, user.app_permissions)) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

// Permiso propio (mod_operativo_tickets), independiente de mod_operativo — el
// link del correo de recepción (emailService.ts) entra directo acá, sin pasar
// por el hub de Operativo.
function GestionTicketsRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  if (!user) return <Navigate to="/login" replace />
  if (!canSeeGestionTickets(user.role, user.app_permissions)) return <Navigate to="/dashboard" replace />
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

// Líder de área: la misma página del SIG, limitada a las carpetas de su área (la página detecta el modo por el permiso).
function SigLiderRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  if (!user) return <Navigate to="/login" replace />
  if (!canSeeSigLider(user.role, user.app_permissions)) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function SigRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  const location = useLocation()
  const isMobile = useIsMobile()
  if (!user) {
    // El "volver a /sig tras loguearse" es a propósito solo para celular (link
    // directo al SIG mobile) — en PC el login sigue mandando al dashboard normal.
    return <Navigate to="/login" state={isMobile ? { from: location } : undefined} replace />
  }
  if (!canSeeSIG(user.role, user.app_permissions)) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function TicketsRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  if (!user) return <Navigate to="/login" replace />
  if (!canSeeTickets(user.role, user.app_permissions)) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function LibertadoraRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  if (!user) return <Navigate to="/login" replace />
  if (!canSeeLibertadora(user.role, user.app_permissions)) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function SacRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  if (!user) return <Navigate to="/login" replace />
  if (!canSeeSAC(user.role, user.app_permissions)) return <Navigate to="/dashboard" replace />
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

// /operativo/nueva-solicitud sirve 2 flujos (compra + mantenimiento) — exige acceso a cualquiera de los dos módulos
function NuevaSolicitudRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  if (!user) return <Navigate to="/login" replace />
  const tieneAcceso =
    canSeeOperativo(user.role, user.area, user.app_permissions) ||
    canAccessMantenimiento(user.role, user.area, user.app_permissions)
  if (!tieneAcceso) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function TyCRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  if (!user) return <Navigate to="/login" replace />
  if (!canSeeTyC(user.role, user.app_permissions)) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function ReportesDesarrolloRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  if (!user) return <Navigate to="/login" replace />
  if (!canSeeReportesDesarrollo(user.role, user.app_permissions)) {
    return <Navigate to="/dashboard" replace />
  }
  return <>{children}</>
}

// Independiente de TyCRoute — un líder de área puede agendar sin tener acceso al resto de T&C.
function AgendaRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  if (!user) return <Navigate to="/login" replace />
  if (!canUseAgenda(user.role, user.app_permissions)) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

// Independiente de TyCRoute — mismo patrón que AgendaRoute.
function EvaluacionesDesempenoRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  if (!user) return <Navigate to="/login" replace />
  if (!canUseEvaluacionesDesempeno(user.role, user.app_permissions)) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

// Independiente de TyCRoute — mismo patrón que AgendaRoute.
function AprobacionesRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  if (!user) return <Navigate to="/login" replace />
  if (!canUseAprobaciones(user.role, user.app_permissions)) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}


export default function App() {
  useTokenGuard()
  useMe()

  return (
    <ErrorBoundary>
    <BrowserRouter>
      <Suspense fallback={<CargandoPagina />}>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        {/* Portal móvil permanente — auxiliar sin login */}
        <Route path="/m/portal/:portalToken" element={<MantenimientoPortalShell />}>
          <Route index element={<MantenimientoPage />} />
          <Route path=":id" element={<MantenimientoDetallePage />} />
        </Route>
        <Route path="/m/q/:accessToken" element={<MantenimientoMobilePage mode="stable" />} />
        <Route path="/m/:token" element={<MantenimientoMobilePage mode="jwt" />} />
        {/* Encuesta pública ZymoAlly SAC — sin login, mismo patrón que /m/:token */}
        <Route path="/e/:surveyType" element={<SurveyPage />} />
        {/* Formato de Ausentismo — público sin login, mismo patrón que /m/:token */}
        <Route path="/tc/formatos/ausentismo" element={<TyCFormatoAusentismoPage />} />
        {/* Panel del socio externo (Skandia) — login propio, sin cuenta en la intranet */}
        <Route path="/libertadora/socio" element={<LibertadoraPartnerPage />} />
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
          path="/admin/configuracion"
          element={
            <AdminRoute>
              <ConfiguracionIntranetPage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/configuracion/organizacion"
          element={
            <AdminRoute>
              <OrganizacionPage />
            </AdminRoute>
          }
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
          path="/admin/configuracion/smtp"
          element={
            <AdminRoute>
              <SmtpConfigPage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/configuracion/whatsapp"
          element={
            <AdminRoute>
              <WhatsappConfigPage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/configuracion/usuarios-externos"
          element={
            <AdminRoute>
              <UsuariosExternosPage />
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
            <NuevaSolicitudRoute>
              <NuevaSolicitudPage />
            </NuevaSolicitudRoute>
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
        <Route
          path="/operativo/clientes"
          element={
            <OperClientesRoute>
              <OperClientesPage />
            </OperClientesRoute>
          }
        />
        <Route
          path="/operativo/gestionar-tickets"
          element={
            <GestionTicketsRoute>
              <GestionarTicketsPage />
            </GestionTicketsRoute>
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
        {/* SIG de mi área — la misma página del SIG, limitada a la carpeta del líder */}
        <Route
          path="/sig-area/*"
          element={
            <SigLiderRoute>
              <SigPage />
            </SigLiderRoute>
          }
        />


        {/* Comercial — Libertadora Seguros (CRM Skandia CREA) */}
        <Route
          path="/libertadora"
          element={
            <LibertadoraRoute>
              <LibertadoraPage />
            </LibertadoraRoute>
          }
        />
        {/* Zymo Ally — Tickets */}
        <Route
          path="/zymoally/tickets"
          element={
            <TicketsRoute>
              <TicketsPage />
            </TicketsRoute>
          }
        />

        {/* Zymo Ally — SAC (dominio propio, sin relación con Tickets) */}
        <Route
          path="/zymoally/sac"
          element={
            <SacRoute>
              <SacPage />
            </SacRoute>
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
          path="/tc/empresa/:sedeId"
          element={
            <TyCRoute>
              <TyCEmpresaPage />
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
          path="/tc/indicadores"
          element={
            <TyCRoute>
              <TyCIndicadoresPage />
            </TyCRoute>
          }
        />
        <Route
          path="/tc/organigrama/canvas"
          element={<Navigate to="/tc/organigrama" replace />}
        />
        <Route
          path="/tc/calendario"
          element={<AgendaRoute><TyCAgendaCalendarioPage /></AgendaRoute>}
        />
        <Route
          path="/tc/eventos/:id"
          element={<AgendaRoute><TyCAgendaEventoPage /></AgendaRoute>}
        />
        <Route
          path="/tc/formacion"
          element={<Navigate to="/tc/calendario" replace />}
        />
        <Route
          path="/tc/ajustes"
          element={<TyCRoute><TyCConfigPage /></TyCRoute>}
        />
        <Route
          path="/tc/rotacion"
          element={<TyCRoute><TyCRotacionPage /></TyCRoute>}
        />
        <Route
          path="/tc/clientes"
          element={<TyCRoute><TyCClientesPage /></TyCRoute>}
        />
        <Route
          path="/tc/nuevo-personal"
          element={<TyCRoute><TyCNuevoPersonalCalendarioPage /></TyCRoute>}
        />
        <Route
          path="/tc/nuevo-personal/nuevo"
          element={<TyCRoute><TyCNuevoPersonalNuevoPage /></TyCRoute>}
        />
        <Route
          path="/tc/nuevo-personal/:id"
          element={<TyCRoute><TyCNuevoPersonalDiaPage /></TyCRoute>}
        />
        <Route
          path="/tc/formatos"
          element={<TyCRoute><TyCFormatosPage /></TyCRoute>}
        />
        <Route
          path="/tc/evaluaciones"
          element={<EvaluacionesDesempenoRoute><TyCEvaluacionDesempenoPage /></EvaluacionesDesempenoRoute>}
        />
        <Route
          path="/tc/aprobaciones"
          element={<AprobacionesRoute><TyCAprobacionesPage /></AprobacionesRoute>}
        />

        {/* Reportes de Desarrollo */}
        <Route
          path="/reportes-desarrollo"
          element={
            <ReportesDesarrolloRoute>
              <ReportesDesarrolloPage />
            </ReportesDesarrolloRoute>
          }
        />
        <Route
          path="/reportes-desarrollo/nuevo"
          element={
            <ReportesDesarrolloRoute>
              <ReporteEditorPageNew />
            </ReportesDesarrolloRoute>
          }
        />
        <Route
          path="/reportes-desarrollo/:id/editar"
          element={
            <ReportesDesarrolloRoute>
              <ReporteEditorPageEdit />
            </ReportesDesarrolloRoute>
          }
        />
        <Route
          path="/reportes-desarrollo/:id"
          element={
            <ReportesDesarrolloRoute>
              <ReporteDetallePage />
            </ReportesDesarrolloRoute>
          }
        />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
    </ErrorBoundary>
  )
}
