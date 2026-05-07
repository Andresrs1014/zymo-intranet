import { useAuthStore } from "@/store/authStore"
import { canManageDevTasks, canSubmitDevTasks } from "@/lib/permissions"
import { PageLayout } from "@/components/layout/PageLayout"
import { TaskManagerView } from "@/components/herramientas/tareas/TaskManagerView"
import { TaskSubmitView } from "@/components/herramientas/tareas/TaskSubmitView"

export function GestionTareasPage() {
  const user = useAuthStore((s) => s.user)
  const canManage = canManageDevTasks(user?.user_tools)
  const canSubmit = canSubmitDevTasks(user?.user_tools)

  if (canManage) {
    return (
      <PageLayout title="Gestión de Tareas">
        <TaskManagerView />
      </PageLayout>
    )
  }

  if (canSubmit) {
    return (
      <PageLayout title="Registro de Tareas">
        <TaskSubmitView />
      </PageLayout>
    )
  }

  return (
    <PageLayout title="Gestión de Tareas">
      <div className="p-8 text-center text-gray-500">
        No tienes acceso a esta herramienta.
      </div>
    </PageLayout>
  )
}
