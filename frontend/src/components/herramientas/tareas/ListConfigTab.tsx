import { useState } from "react"
import { Plus, Pencil, Trash2, Check, X, Flag, Ban, Inbox } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  useTaskLists,
  useCreateTaskListItem,
  useUpdateTaskListItem,
  useDeleteTaskListItem,
  useMarkEstadoEspecial,
} from "@/hooks/useWorkTasks"
import type { TaskListConfigItem } from "@/hooks/useWorkTasks"

interface ListSectionProps {
  title: string
  type: "estado" | "etiqueta" | "plataforma" | "prioridad_agenda"
  items: TaskListConfigItem[]
  onAdd: (value: string, label: string) => void
  onUpdate: (value: string, label: string) => void
  onDelete: (value: string) => void
  onMarkEspecial?: (value: string, tipo: "final" | "cancelado" | "inicial" | null) => void
  isLoading: boolean
}

function ListSection({
  title,
  type: _type,
  items,
  onAdd,
  onUpdate,
  onDelete,
  onMarkEspecial,
  isLoading,
}: ListSectionProps) {
  const [adding, setAdding] = useState(false)
  const [newValue, setNewValue] = useState("")
  const [newLabel, setNewLabel] = useState("")
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState("")

  const handleAdd = () => {
    if (!newValue.trim() || !newLabel.trim()) return
    onAdd(newValue.trim().toLowerCase().replace(/\s+/g, "_"), newLabel.trim())
    setNewValue("")
    setNewLabel("")
    setAdding(false)
  }

  const startEdit = (item: TaskListConfigItem) => {
    setEditingKey(item.value)
    setEditLabel(item.label)
  }

  const handleEdit = () => {
    if (!editLabel.trim()) return
    onUpdate(editingKey!, editLabel.trim())
    setEditingKey(null)
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Cargando...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm">{title}</CardTitle>
            {onMarkEspecial && (
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Marca un estado como <span className="text-green-700 font-medium">Final</span> (cierra el tiempo),{" "}
                <span className="text-red-600 font-medium">Cancelado</span>, o{" "}
                <span className="text-blue-600 font-medium">Asignación inicial</span> (estado por defecto al asignar una tarea)
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAdding(true)}
            className="h-7 px-2 text-xs"
          >
            <Plus className="w-3 h-3 mr-1" />
            Agregar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {adding && (
          <div className="flex gap-2 items-end">
            <div className="flex-1 space-y-1">
              <Input
                placeholder="key (ej: en_progreso)"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="flex-1 space-y-1">
              <Input
                placeholder="Label (ej: En progreso)"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <Button size="sm" variant="ghost" onClick={handleAdd} className="h-8 w-8 p-0">
              <Check className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setAdding(false); setNewValue(""); setNewLabel("") }}
              className="h-8 w-8 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}

        {items.length === 0 && !adding ? (
          <p className="text-xs text-muted-foreground italic">Sin elementos. Agrega el primero.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {items.map((item) => (
              <div
                key={item.value}
                className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm border ${
                  item.is_final
                    ? "bg-green-50 border-green-300 text-green-800"
                    : item.is_canceled
                    ? "bg-red-50 border-red-300 text-red-800"
                    : item.is_initial_assignment
                    ? "bg-blue-50 border-blue-300 text-blue-800"
                    : "bg-gray-100 text-gray-700 border-gray-200"
                }`}
              >
                {editingKey === item.value ? (
                  <>
                    <Input
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      className="h-6 w-32 text-xs py-0"
                      autoFocus
                      onKeyDown={(e) => e.key === "Enter" && handleEdit()}
                    />
                    <Button size="sm" variant="ghost" onClick={handleEdit} className="h-6 w-6 p-0">
                      <Check className="w-3 h-3" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingKey(null)} className="h-6 w-6 p-0">
                      <X className="w-3 h-3" />
                    </Button>
                  </>
                ) : (
                  <>
                    {item.is_final && <Flag className="w-3 h-3 text-green-600" />}
                    {item.is_canceled && <Ban className="w-3 h-3 text-red-600" />}
                    {item.is_initial_assignment && <Inbox className="w-3 h-3 text-blue-600" />}
                    <span>{item.label}</span>
                    {onMarkEspecial && (
                      <>
                        <button
                          type="button"
                          title={item.is_final ? "Quitar como estado final" : "Marcar como estado final"}
                          onClick={() => onMarkEspecial(item.value, item.is_final ? null : "final")}
                          className={`ml-1 transition-colors ${
                            item.is_final ? "text-green-600" : "text-gray-300 hover:text-green-500"
                          }`}
                        >
                          <Flag className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          title={item.is_canceled ? "Quitar como cancelado" : "Marcar como cancelado"}
                          onClick={() => onMarkEspecial(item.value, item.is_canceled ? null : "cancelado")}
                          className={`ml-0.5 transition-colors ${
                            item.is_canceled ? "text-red-600" : "text-gray-300 hover:text-red-500"
                          }`}
                        >
                          <Ban className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          title={item.is_initial_assignment ? "Quitar como estado inicial de asignación" : "Marcar como estado inicial de asignación"}
                          onClick={() => onMarkEspecial(item.value, item.is_initial_assignment ? null : "inicial")}
                          className={`ml-0.5 transition-colors ${
                            item.is_initial_assignment ? "text-blue-600" : "text-gray-300 hover:text-blue-500"
                          }`}
                        >
                          <Inbox className="w-3 h-3" />
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => startEdit(item)}
                      className="ml-1 text-gray-400 hover:text-gray-600"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(item.value)}
                      className="ml-1 text-gray-400 hover:text-red-500"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function ListConfigTab() {
  const { data: lists, isLoading } = useTaskLists()
  const createItem = useCreateTaskListItem()
  const updateItem = useUpdateTaskListItem()
  const deleteItem = useDeleteTaskListItem()
  const markEspecial = useMarkEstadoEspecial()

  const handleAdd = (type: "estado" | "etiqueta" | "plataforma" | "prioridad_agenda") => (value: string, label: string) => {
    createItem.mutate({ list_type: type, value, label })
  }

  const handleUpdate = (type: "estado" | "etiqueta" | "plataforma" | "prioridad_agenda") => (value: string, label: string) => {
    updateItem.mutate({ list_type: type, value, payload: { label } })
  }

  const handleDelete = (type: "estado" | "etiqueta" | "plataforma" | "prioridad_agenda") => (value: string) => {
    deleteItem.mutate({ list_type: type, value })
  }

  const handleMarkEspecial = (value: string, tipo: "final" | "cancelado" | "inicial" | null) => {
    markEspecial.mutate({ value, tipo })
  }

  const sectionProps = {
    isLoading: isLoading || createItem.isPending || updateItem.isPending || deleteItem.isPending || markEspecial.isPending,
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Configuración de listas</h2>
        <p className="text-xs text-muted-foreground">Configura los valores disponibles en los formularios</p>
      </div>

      <ListSection
        title="Estados"
        type="estado"
        items={lists?.estado ?? []}
        onAdd={handleAdd("estado")}
        onUpdate={handleUpdate("estado")}
        onDelete={handleDelete("estado")}
        onMarkEspecial={handleMarkEspecial}
        {...sectionProps}
      />

      <ListSection
        title="Etiquetas"
        type="etiqueta"
        items={lists?.etiqueta ?? []}
        onAdd={handleAdd("etiqueta")}
        onUpdate={handleUpdate("etiqueta")}
        onDelete={handleDelete("etiqueta")}
        {...sectionProps}
      />

      <ListSection
        title="Plataformas"
        type="plataforma"
        items={lists?.plataforma ?? []}
        onAdd={handleAdd("plataforma")}
        onUpdate={handleUpdate("plataforma")}
        onDelete={handleDelete("plataforma")}
        {...sectionProps}
      />

      <ListSection
        title="Prioridades de agenda"
        type="prioridad_agenda"
        items={lists?.prioridad_agenda ?? []}
        onAdd={handleAdd("prioridad_agenda")}
        onUpdate={handleUpdate("prioridad_agenda")}
        onDelete={handleDelete("prioridad_agenda")}
        {...sectionProps}
      />
    </div>
  )
}
