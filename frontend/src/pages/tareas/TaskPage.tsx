import { useState, useEffect } from "react"
import { useTask } from "@/context/TaskContext"
import { TaskShell } from "@/components/tareas/TaskShell"
import { TaskDialog } from "@/components/tareas/TaskDialog"
import { ListView } from "@/components/tareas/views/ListView"
import { BoardView } from "@/components/tareas/views/BoardView"
import { CalendarView } from "@/components/tareas/views/CalendarView"
import { DashboardView } from "@/components/tareas/views/DashboardView"
import { PeopleView } from "@/components/tareas/views/PeopleView"
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
      {activeView === "list" && <ListView />}
      {activeView === "board" && <BoardView />}
      {activeView === "calendar" && <CalendarView />}
      {activeView === "dashboard" && <DashboardView />}
      {activeView === "people" && <PeopleView />}
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
