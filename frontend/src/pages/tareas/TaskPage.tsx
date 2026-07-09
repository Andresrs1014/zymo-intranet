import { useState, useEffect } from "react"
import { useTask } from "@/context/TaskContext"
import { TaskShell } from "@/components/tareas/TaskShell"
import { TaskDialog } from "@/components/tareas/TaskDialog"
import { MiTrabajoView } from "@/components/tareas/views/MiTrabajoView"
import { ListView } from "@/components/tareas/views/ListView"
import { BoardView } from "@/components/tareas/views/BoardView"
import { CalendarView } from "@/components/tareas/views/CalendarView"
import { DashboardView } from "@/components/tareas/views/DashboardView"
import { SettingsView } from "@/components/tareas/views/SettingsView"

function TaskContent() {
  const { activeView, activeTeamId, setOnNewTask } = useTask()
  const [dialogOpen, setDialogOpen] = useState(false)

  // Register the "new task" handler so TaskTopbar can trigger it
  useEffect(() => {
    setOnNewTask(() => setDialogOpen(true))
  }, [setOnNewTask])

  return (
    <>
      {activeView === "mywork" && <MiTrabajoView />}
      {activeView === "list" && <ListView />}
      {activeView === "board" && <BoardView />}
      {activeView === "calendar" && <CalendarView />}
      {activeView === "dashboard" && <DashboardView />}
      {activeView === "settings" && <SettingsView />}

      <TaskDialog
        open={dialogOpen}
        teamId={activeTeamId}
        onClose={() => setDialogOpen(false)}
      />
    </>
  )
}

export function TaskPage() {
  return (
    <TaskShell>
      <TaskContent />
    </TaskShell>
  )
}
