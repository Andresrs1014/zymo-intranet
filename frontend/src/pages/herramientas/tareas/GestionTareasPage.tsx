import { useState, useEffect } from "react"
import { Navigate } from "react-router-dom"
import { Plus, PanelRightClose, PanelRightOpen, ChevronDown, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { useAuthStore } from "@/store/authStore"
import { canManageDevTasks, canSubmitDevTasks, isCoGestor } from "@/lib/permissions"
import { PageLayout } from "@/components/layout/PageLayout"
import { CalendarSidebar } from "@/components/herramientas/tareas/CalendarSidebar"
import { ScheduleSheet } from "@/components/herramientas/tareas/ScheduleSheet"
import { TaskManagerView } from "@/components/herramientas/tareas/TaskManagerView"
import { TaskSubmitView } from "@/components/herramientas/tareas/TaskSubmitView"
import { TaskChartsTab } from "@/components/herramientas/tareas/TaskChartsTab"
import { TeamConfigTab } from "@/components/herramientas/tareas/TeamConfigTab"
import { ListConfigTab } from "@/components/herramientas/tareas/ListConfigTab"
import { TaskLeftRail } from "@/components/herramientas/tareas/TaskLeftRail"
import { TaskLeftPanel } from "@/components/herramientas/tareas/TaskLeftPanel"
import { EventDetailSheet } from "@/components/herramientas/tareas/EventDetailSheet"
import { useTeamPersonSummaries, useTeamMembers, useManagedTeams, useMyTeams } from "@/hooks/useWorkTasks"
import type { TaskFilters, TaskEvent } from "@/types/workTask"

const LEFT_PANEL_KEY = "task-left-panel-open"

export function GestionTareasPage() {
  const user = useAuthStore((s) => s.user)
  const userTools: string[] = user?.user_tools ?? []
  // Only fetch team members for users who could be co-gestors (have TOOL_SUBMIT).
  // Submit-only users get a 403 from the backend; the query returns [] safely.
  const { data: teamMembers = [] } = useTeamMembers(canSubmitDevTasks(userTools))
  const isUserCoGestor = isCoGestor(
    teamMembers.map((m) => ({ user_id: m.user_id, role: m.role })),
    user?.id ?? -1
  )
  const canManage = canManageDevTasks(userTools) || isUserCoGestor
  const canSubmit = canSubmitDevTasks(userTools)

  const { data: managedTeams = [] } = useManagedTeams()
  const { data: memberTeams = [] } = useMyTeams()

  const allWorkspaces = canManage ? managedTeams : memberTeams
  const [selectedTeamId, setSelectedTeamId] = useState<number | undefined>(undefined)
  const activeTeamId = selectedTeamId ?? allWorkspaces[0]?.team_id

  const [filters, setFilters] = useState<TaskFilters>({})
  const effectiveFilters = { ...filters, team_id: activeTeamId }

  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(
    () => localStorage.getItem(LEFT_PANEL_KEY) === "true"
  )
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [scheduleDate, setScheduleDate] = useState<Date | null>(null)
  const [isScheduleOpen, setIsScheduleOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<TaskEvent | null>(null)

  const { data: persons = [] } = useTeamPersonSummaries(effectiveFilters)

  useEffect(() => {
    localStorage.setItem(LEFT_PANEL_KEY, String(isLeftPanelOpen))
  }, [isLeftPanelOpen])

  if (!canManage && !canSubmit) {
    return <Navigate to="/dashboard" replace />
  }

  const activeWorkspace = allWorkspaces.find((t) => t.team_id === activeTeamId)
  const pageTitle = activeWorkspace?.team_name ?? (canManage ? "Gestión de Tareas" : "Registro de Tareas")

  const hasActiveFilters = !!(
    filters.fecha_desde ||
    filters.fecha_hasta ||
    filters.estado ||
    filters.etiqueta ||
    filters.plataforma ||
    filters.q ||
    filters.sin_registro_hoy
  )

  return (
    <PageLayout
      title={pageTitle}
      mainClassName="flex flex-1 min-h-0 overflow-hidden p-0"
    >
      <div className="flex flex-1 min-h-0 overflow-hidden w-full">

        <TaskLeftRail
          isPanelOpen={isLeftPanelOpen}
          onToggle={() => setIsLeftPanelOpen((v) => !v)}
          hasActiveFilters={hasActiveFilters}
          hasSelectedPerson={!!filters.responsable_id}
          showTeam={canManage}
        />

        <TaskLeftPanel
          isOpen={isLeftPanelOpen}
          filters={filters}
          onFiltersChange={setFilters}
          persons={canManage ? persons : []}
          onClose={() => setIsLeftPanelOpen(false)}
          activeTeamId={activeTeamId}
        />

        <main className="flex-1 overflow-y-auto min-w-0">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-background shrink-0">
            <div className="flex items-center gap-3">
              <div className="h-6 w-1.5 bg-primary rounded-full" />
              {allWorkspaces.length > 1 ? (
                <div className="relative group">
                  <button
                    type="button"
                    className="flex items-center gap-1.5 text-base font-semibold hover:text-primary transition-colors focus:outline-none"
                    title="Cambiar equipo / workspace"
                  >
                    <span>{pageTitle}</span>
                    <ChevronDown className="h-4 w-4 text-gray-400 group-hover:text-primary transition-colors" />
                  </button>
                  <div className="absolute left-0 top-full mt-1.5 z-50 hidden group-focus-within:block group-hover:block bg-background border border-border rounded-xl shadow-xl py-1.5 min-w-[220px] backdrop-blur-md bg-opacity-95">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-3 py-1 border-b border-border mb-1">
                      Mis Equipos / Workspaces
                    </p>
                    {allWorkspaces.map((ws) => (
                      <button
                        key={ws.team_id}
                        type="button"
                        onClick={() => setSelectedTeamId(ws.team_id)}
                        className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-muted transition-colors ${
                          ws.team_id === activeTeamId
                            ? "font-semibold text-primary"
                            : "text-foreground"
                        }`}
                      >
                        <span>{ws.team_name}</span>
                        {ws.team_id === activeTeamId && (
                          <Check className="h-3.5 w-3.5 text-primary" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <span className="text-base font-semibold">{pageTitle}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => setIsScheduleOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Agendar
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setIsSidebarOpen((v) => !v)}
                className={isSidebarOpen ? "bg-muted" : ""}
                title={isSidebarOpen ? "Ocultar agenda" : "Mostrar agenda"}
              >
                {isSidebarOpen ? (
                  <PanelRightClose className="h-4 w-4" />
                ) : (
                  <PanelRightOpen className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="px-6 py-4">
            <Tabs defaultValue="tareas" className="space-y-4">
              <TabsList>
                <TabsTrigger value="tareas">
                  {canManage ? "Tareas del equipo" : "Mis tareas"}
                </TabsTrigger>
                <TabsTrigger value="graficas">Gráficas</TabsTrigger>
                {canManage && (
                  <TabsTrigger value="configuracion">Configuración</TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="tareas">
                {canManage ? (
                  <TaskManagerView
                    canSubmitOwn={true}
                    filters={effectiveFilters}
                    activeTeamId={activeTeamId}
                  />
                ) : (
                  <TaskSubmitView filters={effectiveFilters} activeTeamId={activeTeamId} />
                )}
              </TabsContent>

              <TabsContent value="graficas">
                <TaskChartsTab isManager={canManage} />
              </TabsContent>

              {canManage && (
                <TabsContent value="configuracion" className="space-y-6">
                  <TeamConfigTab canPromoteDemote={canManageDevTasks(userTools)} />
                  <ListConfigTab />
                </TabsContent>
              )}
            </Tabs>
          </div>
        </main>

        <CalendarSidebar
          isOpen={isSidebarOpen}
          onDateSelect={(date) => {
            setScheduleDate(date)
            setIsScheduleOpen(true)
          }}
          onEventClick={(event) => setSelectedEvent(event)}
          onNewEvent={(date) => {
            setScheduleDate(date)
            setIsScheduleOpen(true)
          }}
        />
      </div>

      <ScheduleSheet
        isOpen={isScheduleOpen}
        onClose={() => setIsScheduleOpen(false)}
        preselectedDate={scheduleDate}
      />

      <EventDetailSheet
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        isManager={canManage}
      />
    </PageLayout>
  )
}
