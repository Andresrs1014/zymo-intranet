import { useQuery } from "@tanstack/react-query"
import { ListTodo, UserX } from "lucide-react"

import { taskApi } from "@/lib/taskApi"
import { canManageDevTasks } from "@/lib/permissions"
import { useAuthStore } from "@/store/authStore"
import type { Task } from "@/types/task"
import { CHIP_PRIORIDAD, CuadroVistaPrevia, hace, type FilaPrevia } from "./CuadroVistaPrevia"

const ORDEN = ["alta", "media", "baja"]
const CERRADAS = new Set(["completada", "cancelada"])

/** Trae hasta 50 tareas con ese filtro; el backend ya limita a los equipos de la persona. */
function useTareas(clave: string, params: string) {
  return useQuery({
    queryKey: ["tasks", "vista-previa", clave, params],
    queryFn: async () => {
      const { data } = await taskApi.get<Task[]>(`/api/tasks?limit=50&${params}`)
      return data.filter((t) => !CERRADAS.has(t.estado))
    },
    refetchInterval: 60_000,
  })
}

function Cuadro({ titulo, icon, clave, params, aparte, vacio, amplio }: {
  titulo: string; icon: React.ReactNode; clave: string; params: string; aparte: (t: Task) => string; vacio: string; amplio: boolean
}) {
  const { data = [], isLoading, isError } = useTareas(clave, params)
  const filas = [...data]
    .sort((a, b) => ORDEN.indexOf(a.prioridad.toLowerCase()) - ORDEN.indexOf(b.prioridad.toLowerCase()))
    .map((t): FilaPrevia => ({
      key: String(t.id),
      chip: { texto: t.prioridad, clase: CHIP_PRIORIDAD[t.prioridad.toLowerCase()] ?? CHIP_PRIORIDAD.baja },
      texto: t.titulo,
      datos: [["Subió", t.subidoPorNombre], ["Responsable", t.asignadoANombre ?? "Sin asignar"], ["Plataforma", t.plataforma], ["Creada", hace(t.createdAt)]],
      aparte: aparte(t),
      to: "/tareas-v2",
    }))
  return <CuadroVistaPrevia titulo={titulo} icon={icon} total={isLoading ? undefined : data.length} filas={filas} cargando={isLoading} error={isError} vacio={vacio} amplio={amplio} verTodo="/tareas-v2" />
}

/** Vista previa de Gestión de Tareas: lo asignado a mí y, para quien gestiona, lo que falta por asignar. */
export function TareasVistaPrevia({ amplio = false }: { amplio?: boolean }) {
  const user = useAuthStore((s) => s.user)
  if (!user) return null
  const gestiona = canManageDevTasks(user.user_tools ?? [])
  return (
    <div className={amplio ? "grid gap-3 md:grid-cols-2" : "grid grid-cols-[minmax(0,1fr)] gap-3"}>
      <Cuadro titulo="Mis tareas" icon={<ListTodo className="size-4" aria-hidden="true" />} clave="mias" params={`responsableId=${user.id}`} aparte={(t) => t.subidoPorNombre} vacio="No tienes tareas abiertas." amplio={amplio} />
      {gestiona && (
        <Cuadro titulo="Sin asignar" icon={<UserX className="size-4" aria-hidden="true" />} clave="sin-asignar" params="soloSinAsignar=true" aparte={(t) => t.subidoPorNombre} vacio="Todas las tareas tienen responsable." amplio={amplio} />
      )}
    </div>
  )
}
