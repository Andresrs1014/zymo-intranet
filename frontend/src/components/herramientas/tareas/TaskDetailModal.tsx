import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useTaskActivity } from "@/hooks/useWorkTasks"
import { FileUploadZone } from "./FileUploadZone"
import { AttachmentList } from "./AttachmentList"
import { FilePreviewModal } from "./FilePreviewModal"
import { useTaskAttachments } from "@/hooks/useTaskAttachments"
import type { WorkTask, TaskActivityEntry, TaskAttachment } from "@/types/workTask"

const ESTADO_VARIANT: Record<string, "success" | "destructive" | "warning" | "secondary"> = {
  completada:  "success",
  bloqueada:   "destructive",
  en_progreso: "warning",
}

interface Props {
  task: WorkTask | null
  open: boolean
  onClose: () => void
  onEdit?: (task: WorkTask) => void
}

export function TaskDetailModal({ task, open, onClose, onEdit }: Props) {
  const { data: activity = [], isLoading: loadingActivity } = useTaskActivity(
    open && task ? task.id : null
  )

  const [previewAttachment, setPreviewAttachment] = useState<TaskAttachment | null>(null)
  const { data: liveAdjuntos } = useTaskAttachments(open && task ? task.id : null)
  const adjuntos = liveAdjuntos ?? task?.adjuntos ?? []

  if (!task) return null

  const fechaHora = [task.fecha, task.hora_inicio].filter(Boolean).join(" — ")

  return (
    <>
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge variant={ESTADO_VARIANT[task.estado] ?? "secondary"}>
              {task.estado.replace(/_/g, " ")}
            </Badge>
            {task.etiqueta && <Badge variant="outline">{task.etiqueta}</Badge>}
            {task.plataforma && (
              <Badge variant="outline" className="text-muted-foreground">
                {task.plataforma}
              </Badge>
            )}
          </div>
          <DialogTitle>{task.titulo}</DialogTitle>
          {fechaHora && (
            <p className="text-sm text-muted-foreground">{fechaHora}</p>
          )}
          {task.subido_por_nombre && (
            <p className="text-xs text-muted-foreground">
              Registrado por: {task.subido_por_nombre}
            </p>
          )}
          {task.asignado_a_nombre && (
            <p className="text-xs text-muted-foreground">
              Asignado a: <strong>{task.asignado_a_nombre}</strong>
            </p>
          )}
        </DialogHeader>

        <Tabs defaultValue="descripcion">
          <TabsList className="w-full">
            <TabsTrigger value="descripcion" className="flex-1">Descripción</TabsTrigger>
            <TabsTrigger value="actividad" className="flex-1">Actividad</TabsTrigger>
          </TabsList>

          <TabsContent value="descripcion">
            <div className="rounded-lg bg-muted/50 p-4 text-sm leading-relaxed text-foreground min-h-[120px]">
              {task.descripcion_tecnica ? (
                <p className="whitespace-pre-wrap">{task.descripcion_tecnica}</p>
              ) : (
                <span className="text-muted-foreground italic">Sin descripción.</span>
              )}
            </div>
            {task.tiempo_total_minutos != null && task.tiempo_total_minutos > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                Tiempo registrado:{" "}
                <strong>
                  {Math.floor(task.tiempo_total_minutos / 60)}h{" "}
                  {task.tiempo_total_minutos % 60}m
                </strong>
              </p>
            )}
          </TabsContent>

          <TabsContent value="actividad">
            {loadingActivity ? (
              <p className="text-sm text-muted-foreground p-4">Cargando historial...</p>
            ) : activity.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4 italic">
                Sin historial de actividad.
              </p>
            ) : (
              <ol className="relative border-l border-border ml-3 space-y-4 py-2">
                {activity.map((entry: TaskActivityEntry) => (
                  <li key={entry.id} className="ml-4">
                    <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border border-background bg-primary" />
                    <p className="text-xs text-muted-foreground">
                      {entry.fecha} · {entry.user_nombre}
                    </p>
                    <p className="text-sm font-medium capitalize">
                      {entry.accion.replace(/_/g, " ")}
                    </p>
                    {entry.detalle && (
                      <p className="text-sm text-muted-foreground">{entry.detalle}</p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </TabsContent>
        </Tabs>

        <div className="border-t border-border pt-3 mt-2">
          <FileUploadZone taskId={task.id} />
          <AttachmentList
            taskId={task.id}
            attachments={adjuntos}
            onPreview={setPreviewAttachment}
          />
        </div>

        {onEdit && (
          <div className="flex gap-2 pt-2 border-t border-border">
            <Button className="flex-1" onClick={() => onEdit(task)}>
              Editar tarea
            </Button>
          </div>
        )}
      </DialogContent>

    </Dialog>
    <FilePreviewModal
      attachment={previewAttachment}
      open={!!previewAttachment}
      onClose={() => setPreviewAttachment(null)}
    />
    </>
  )
}
