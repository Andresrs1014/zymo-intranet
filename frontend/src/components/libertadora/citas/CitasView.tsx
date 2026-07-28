import { useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { useLibCitas, useCreateLibCita, useUpdateLibCita, useDeleteLibCita } from "@/hooks/useLibertadora"
import { CitasCalendarGrid } from "./CitasCalendarGrid"
import { CitaFormDialog } from "./CitaFormDialog"
import type { LibCita, LibCitaInput } from "@/types/libertadora"

export function CitasView() {
  const { data: citas, isLoading, isError } = useLibCitas()
  const createMut = useCreateLibCita()
  const updateMut = useUpdateLibCita()
  const deleteMut = useDeleteLibCita()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<LibCita | null>(null)
  const [prefill, setPrefill] = useState<{ fecha: string; hora: string } | null>(null)

  if (isLoading) return <Skeleton className="h-96 rounded-lg" />
  if (isError || !citas) {
    return <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">No se pudieron cargar las citas.</p>
  }

  async function handleSubmit(data: LibCitaInput) {
    if (editing) {
      await updateMut.mutateAsync({ id: editing.id, data })
    } else {
      await createMut.mutateAsync(data)
    }
    setDialogOpen(false)
  }

  async function handleDelete() {
    if (!editing) return
    if (!confirm(`¿Eliminar la cita con "${editing.cliente}"?`)) return
    await deleteMut.mutateAsync(editing.id)
    setDialogOpen(false)
  }

  return (
    <>
      <CitasCalendarGrid
        citas={citas}
        onNew={(fecha, hora) => { setEditing(null); setPrefill({ fecha, hora }); setDialogOpen(true) }}
        onEdit={(c) => { setEditing(c); setPrefill(null); setDialogOpen(true) }}
      />
      <CitaFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        cita={editing}
        prefill={prefill}
        onSubmit={handleSubmit}
        onDelete={editing ? handleDelete : undefined}
        submitting={createMut.isPending || updateMut.isPending}
      />
    </>
  )
}
