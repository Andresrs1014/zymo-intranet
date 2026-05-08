import { Navigate } from "react-router-dom"
import { useAuthStore } from "@/store/authStore"
import { canManageDevTasks, canSubmitDevTasks } from "@/lib/permissions"
import { PageLayout } from "@/components/layout/PageLayout"
import { TaskManagerView } from "@/components/herramientas/tareas/TaskManagerView"
import { TaskSubmitView } from "@/components/herramientas/tareas/TaskSubmitView"

export function GestionTareasPage() {
  const user = useAuthStore((s) => s.user)
  const userTools: string[] = user?.user_tools ?? []
  const role = user?.role

  // Nueva lógica: canSubmit incluye membresía de equipo
  // is_team_member vendrá del backend en /auth/me (Task 1.11)
  const canManage = canManageDevTasks(userTools, role)
  const canSubmit = canSubmitDevTasks(userTools, user?.is_team_member)
  const hasAnyAccess = canManage || canSubmit

  if (!hasAnyAccess) {
    return <Navigate to="/dashboard" replace />
  }

  // Gestor ve TaskManagerView (que también permite registrar sus propias tareas)
  if (canManage) {
    return (
      <PageLayout title="Gestión de Tareas">
        <TaskManagerView canSubmitOwn={true} />
      </PageLayout>
    )
  }

  // Colaborador ve TaskSubmitView
  return (
    <PageLayout title="Registro de Tareas">
      <TaskSubmitView />
    </PageLayout>
  )
}
