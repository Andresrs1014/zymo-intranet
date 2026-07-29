import { useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { useLibProspectos, useCreateLibProspecto, useUpdateLibProspecto, useDeleteLibProspecto } from "@/hooks/useLibertadora"
import { ProspectosTable } from "./ProspectosTable"
import { ProspectoFormDialog } from "./ProspectoFormDialog"
import type { LibProspecto, LibProspectoInput } from "@/types/libertadora"

// Ported 1:1 de exportCSV() del prototipo original — mismo orden de columnas y BOM UTF-8.
function exportProspectosCsv(rows: LibProspecto[]) {
  const headers = ["#", "Empresa", "Producto", "Gestión", "Estado", "Monto COP/mes", "Prioridad", "Próxima acción", "Fecha", "Trimestre", "Tipo"]
  const csvRows = rows.map((p, i) => [
    i + 1, p.empresa, p.producto, (p.gestion ?? "").replace(/,/g, ";"), p.estado,
    p.monto, p.prioridad, (p.accion ?? "").replace(/,/g, ";"), p.fecha ?? "", p.trimestre ?? "", p.tipo ?? "",
  ])
  const csv = [headers, ...csvRows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n")
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" })
  const link = document.createElement("a")
  link.href = URL.createObjectURL(blob)
  link.download = "GestionComercial_SKANDIA_CREA_2026.csv"
  link.click()
  URL.revokeObjectURL(link.href)
}

export function ProspectosView() {
  const { data: prospectos, isLoading, isError } = useLibProspectos()
  const createMut = useCreateLibProspecto()
  const updateMut = useUpdateLibProspecto()
  const deleteMut = useDeleteLibProspecto()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<LibProspecto | null>(null)

  if (isLoading) return <Skeleton className="h-96 rounded-lg" />
  if (isError || !prospectos) {
    return <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">No se pudieron cargar los prospectos.</p>
  }

  async function handleSubmit(data: LibProspectoInput) {
    if (editing) {
      await updateMut.mutateAsync({ id: editing.id, data })
    } else {
      await createMut.mutateAsync(data)
    }
    setDialogOpen(false)
  }

  async function handleDelete() {
    if (!editing) return
    if (!confirm(`¿Eliminar el prospecto "${editing.empresa}"?`)) return
    await deleteMut.mutateAsync(editing.id)
    setDialogOpen(false)
  }

  return (
    <>
      <ProspectosTable
        prospectos={prospectos}
        onNew={() => { setEditing(null); setDialogOpen(true) }}
        onEdit={(p) => { setEditing(p); setDialogOpen(true) }}
        onExportCsv={exportProspectosCsv}
      />
      <ProspectoFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        prospecto={editing}
        onSubmit={handleSubmit}
        onDelete={editing ? handleDelete : undefined}
        submitting={createMut.isPending || updateMut.isPending}
      />
    </>
  )
}
