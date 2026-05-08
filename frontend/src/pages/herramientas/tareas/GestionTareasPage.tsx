import { useState } from "react"
import { Navigate } from "react-router-dom"
import { Plus, PanelRightClose, PanelRightOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { useAuthStore } from "@/store/authStore"
import { canManageDevTasks, canSubmitDevTasks } from "@/lib/permissions"
import { PageLayout } from "@/components/layout/PageLayout"
import { CalendarSidebar } from "@/components/herramientas/tareas/CalendarSidebar"
import { ScheduleSheet } from "@/components/herramientas/tareas/ScheduleSheet"
import { TaskManagerView } from "@/components/herramientas/tareas/TaskManagerView"
import { TaskSubmitView } from "@/components/herramientas/tareas/TaskSubmitView"
import { TaskChartsTab } from "@/components/herramientas/tareas/TaskChartsTab"
import { TeamConfigTab } from "@/components/herramientas/tareas/TeamConfigTab"
import type { TaskEvent } from "@/types/workTask"

export function GestionTareasPage() {
  const user = useAuthStore((s) => s.user)
  const userTools: string[] = user?.user_tools ?? []
  const canManage = canManageDevTasks(userTools, user?.role)
  const canSubmit = canSubmitDevTasks(userTools, user?.is_team_member)

  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [scheduleDate, setScheduleDate] = useState<Date | null>(null)
  const [isScheduleOpen, setIsScheduleOpen] = useState(false)

  if (!canManage && !canSubmit) {
    return <Navigate to="/dashboard" replace />
  }

  const pageTitle = canManage ? "Gestión de Tareas" : "Registro de Tareas"

  return (
    <PageLayout
      title={pageTitle}
      mainClassName="flex flex-1 min-h-0 overflow-hidden p-0"
    >
      {/* Inner layout: main content + resizable calendar sidebar */}
      <div className="flex flex-1 min-h-0 overflow-hidden w-full">
        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          {/* Sub-header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-background shrink-0">
            <div className="flex items-center gap-3">
              <div className="h-6 w-1.5 bg-primary rounded-full" />
              <span className="text-base font-semibold">
                {canManage ? "Equipo de Desarrollo e Innovación" : "Mis tareas"}
              </span>
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

          {/* Tabs */}
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
                  <TaskManagerView canSubmitOwn={true} />
                ) : (
                  <TaskSubmitView />
                )}
              </TabsContent>

              <TabsContent value="graficas">
                <TaskChartsTab isManager={canManage} />
              </TabsContent>

              {canManage && (
                <TabsContent value="configuracion">
                  <TeamConfigTab />
                </TabsContent>
              )}
            </Tabs>
          </div>
        </main>

        {/* Resizable calendar sidebar */}
        <CalendarSidebar
          isOpen={isSidebarOpen}
          onToggle={() => setIsSidebarOpen((v) => !v)}
          onDateSelect={(date) => {
            setScheduleDate(date)
            setIsScheduleOpen(true)
          }}
          onEventClick={(ev: TaskEvent) => {
            // Future: open event detail modal
            void ev
          }}
          onNewEvent={(date) => {
            setScheduleDate(date)
            setIsScheduleOpen(true)
          }}
        />
      </div>

      {/* Schedule sheet (portal-style, outside the flex layout) */}
      <ScheduleSheet
        isOpen={isScheduleOpen}
        onClose={() => setIsScheduleOpen(false)}
        preselectedDate={scheduleDate}
        canSelectOthers={canManage}
      />
    </PageLayout>
  )
}
