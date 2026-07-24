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
  canUseAgenda,
  canUseEvaluacionesDesempeno,
  canSeeOperClientes,
  canSeeGestionTickets,
  canSeeTickets,
  canSeeSAC,
  canSeeReportesDesarrollo,
} from "@/lib/permissions"
import { useAgentPanelStore } from "@/store/agentPanelStore"
import { useMinWidth } from "@/hooks/useMinWidth"
import { useMe } from "@/hooks/useAuth"
import { LoginPage } from "@/pages/LoginPage"
import { DashboardPage } from "@/pages/DashboardPage"
import { AdminPage } from "@/pages/AdminPage"
import { ConfiguracionIntranetPage } from "@/pages/admin/ConfiguracionIntranetPage"
import { RolesPage } from "@/pages/RolesPage"
import { AreasPage } from "@/pages/AreasPage"
import { SmtpConfigPage } from "@/pages/admin/SmtpConfigPage"
import { WhatsappConfigPage } from "@/pages/admin/WhatsappConfigPage"
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
import { OperClientesPage } from "@/pages/operativo/OperClientesPage"
import { GestionarTicketsPage } from "@/pages/operativo/GestionarTicketsPage"
import { FinancieroPage } from "@/pages/financiero/FinancieroPage"
import { FacturasPage } from "@/pages/financiero/FacturasPage"
import { FacturaDetallePage } from "@/pages/financiero/FacturaDetallePage"
import { FinancieroConfigPage } from "@/pages/financiero/FinancieroConfigPage"
import { PrintFacturacionPage } from "@/pages/financiero/PrintFacturacionPage"
import { AgentFloatingWindow } from "@/components/agent/AgentFloatingWindow"
import { GerencialPage } from "@/pages/gerencial/GerencialPage"
import { ExtraccionIAPage } from "@/pages/admin/ExtraccionIAPage"
import { HelixPage } from "@/pages/planeacion/helix/HelixPage"
import { TicketsPage } from "@/pages/tickets/TicketsPage"
import { SacPage } from "@/pages/sac/SacPage"
import { SurveyPage } from "@/pages/survey/SurveyPage"
import { TaskPage } from "@/pages/tareas/TaskPage"
import { SigPage } from "@/pages/sig/SigPage"
import MantenimientoPage from "@/pages/mantenimiento/MantenimientoPage"
import NuevaMantenimientoPage from "@/pages/mantenimiento/NuevaMantenimientoPage"
import MantenimientoDetallePage from "@/pages/mantenimiento/MantenimientoDetallePage"
import MantenimientoPortalShell from "@/pages/mantenimiento/MantenimientoPortalShell"
import MantenimientoMobilePage from "@/pages/mantenimiento/MantenimientoMobilePage"
import MantenimientoDashboard from "@/pages/mantenimiento/MantenimientoDashboard"
import { TyCPage } from "@/pages/tc/TyCPage"
import { TyCDirectorioPage } from "@/pages/tc/TyCDirectorioPage"
import { TyCPersonaPage } from "@/pages/tc/TyCPersonaPage"
import { TyCOrganigramaPage } from "@/pages/tc/TyCOrganigramaPage"
import { TyCImportPage } from "@/pages/tc/TyCImportPage"
import { TyCManualesPage } from "@/pages/tc/TyCManualesPage"
import { TyCFormatosPage } from "@/pages/tc/TyCFormatosPage"
import { TyCFormatoAusentismoPage } from "@/pages/tc/TyCFormatoAusentismoPage"
import { TyCEvaluacionDesempenoPage } from "@/pages/tc/TyCEvaluacionDesempenoPage"
import { TyCIndicadoresPage } from "@/pages/tc/TyCIndicadoresPage"
import { TyCAgendaCalendarioPage } from "@/pages/tc/TyCAgendaCalendarioPage"
import { TyCAgendaEventoPage } from "@/pages/tc/TyCAgendaEventoPage"
import { TyCCapacitacionesPage } from "@/pages/tc/TyCCapacitacionesPage"
import { TyCConfigPage } from "@/pages/tc/TyCConfigPage"
import { TyCRotacionPage } from "@/pages/tc/TyCRotacionPage"
import { TyCClientesPage } from "@/pages/tc/TyCClientesPage"
import { TyCEmpresaPage } from "@/pages/tc/TyCEmpresaPage"
import { TyCNuevoPersonalCalendarioPage } from "@/pages/tc/TyCNuevoPersonalCalendarioPage"
import { TyCNuevoPersonalNuevoPage } from "@/pages/tc/TyCNuevoPersonalNuevoPage"
import { TyCNuevoPersonalDiaPage } from "@/pages/tc/TyCNuevoPersonalDiaPage"
import { ReportesDesarrolloPage } from "@/pages/reportes/ReportesDesarrolloPage"
import { ReporteDetallePage } from "@/pages/reportes/ReporteDetallePage"
import { ReporteEditorPageNew, ReporteEditorPageEdit } from "@/pages/reportes/ReporteEditorPage"

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

function TicketsRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  if (!user) return <Navigate to="/login" replace />
  if (!canSeeTickets(user.role, user.app_permissions)) return <Navigate to="/dashboard" replace />
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
        <Route path="/m/q/:accessToken" element={<MantenimientoMobilePage mode="stable" />} />
        <Route path="/m/:token" element={<MantenimientoMobilePage mode="jwt" />} />
        {/* Encuesta pública ZymoAlly SAC — sin login, mismo patrón que /m/:token */}
        <Route path="/e/:surveyType" element={<SurveyPage />} />
        {/* Formato de Ausentismo — público sin login, mismo patrón que /m/:token */}
        <Route path="/tc/formatos/ausentismo" element={<TyCFormatoAusentismoPage />} />
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

        {/* Planeación — Helix Zymo */}
        <Route
          path="/planeacion/helix"
          element={
            <HelixRoute>
              <HelixPage />
            </HelixRoute>
          }
        />

        {/* Zymo Ally — Tickets (dominio sin relación con Helix, solo comparte posición en el sidebar) */}
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
          element={<TyCRoute><TyCCapacitacionesPage /></TyCRoute>}
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
    </BrowserRouter>
    </ErrorBoundary>
  )
}
