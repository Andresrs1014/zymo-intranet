// Página que envuelve al `ReporteEditor`. Hay dos rutas:
//   - /reportes-desarrollo/nuevo       → crea un reporte
//   - /reportes-desarrollo/:id/editar  → edita uno existente
// Se exportan dos wrappers (`New` y `Edit`) porque App.tsx necesita
// componentes separados para las rutas (no se pueden pasar params directos).

import { useNavigate, useParams } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { ArrowLeft } from "lucide-react"
import { PageLayout } from "@/components/layout/PageLayout"
import { useAuthStore } from "@/store/authStore"
import { canWriteReportesDesarrollo } from "@/lib/permissions"
import { reportesApi } from "@/lib/reportesApi"
import type { Reporte } from "@/lib/reportesShared"
import { ReporteEditor, type FormPayload } from "@/components/reportes/ReporteEditor"

interface InnerProps {
  /** Si viene, es modo edición; si no, es modo creación. */
  reporteId?: number
}

export function ReporteEditorPage({ reporteId }: InnerProps) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const isEdit = Boolean(reporteId)

  // Lista de proyectos para el <select> — se reutiliza en el editor.
  const { data: proyectos = [] } = useQuery<string[]>({
    queryKey: ["reportes-desarrollo", "proyectos"],
    queryFn: () =>
      reportesApi.get<string[]>("/api/reportes-desarrollo/proyectos").then((r) => r.data),
  })

  // Carga el reporte a editar (solo en modo edición).
  const { data: reporte, isLoading: loadingReporte } = useQuery<Reporte>({
    queryKey: ["reportes-desarrollo", reporteId],
    queryFn: () =>
      reportesApi.get<Reporte>(`/api/reportes-desarrollo/${reporteId}`).then((r) => r.data),
    enabled: isEdit,
  })

  // ── Mutación: crear ──────────────────────────────────────────────────────
  const crearMutation = useMutation({
    mutationFn: (data: FormPayload) => {
      const form = toFormData(data)
      return reportesApi.post<Reporte>("/api/reportes-desarrollo", form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["reportes-desarrollo"] })
      navigate(`/reportes-desarrollo/${res.data.id}`)
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      setSubmitError(err?.response?.data?.error ?? "Error al crear el reporte")
    },
  })

  // ── Mutación: editar ─────────────────────────────────────────────────────
  const editarMutation = useMutation({
    mutationFn: (data: FormPayload) => {
      const form = toFormData(data)
      return reportesApi.patch<Reporte>(
        `/api/reportes-desarrollo/${reporteId}`,
        form,
        { headers: { "Content-Type": "multipart/form-data" } },
      )
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reportes-desarrollo"] })
      navigate(`/reportes-desarrollo/${reporteId}`)
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      setSubmitError(err?.response?.data?.error ?? "Error al guardar el reporte")
    },
  })

  // ── Guards ───────────────────────────────────────────────────────────────
  if (!user || !canWriteReportesDesarrollo(user.role, user.app_permissions)) {
    return (
      <PageLayout title={isEdit ? "Editar reporte" : "Nuevo reporte"}>
        <div className="max-w-2xl mx-auto py-20 text-center">
          <p className="font-mono text-[13px] text-zinc-600">
            No tenés permiso para escribir reportes de desarrollo.
          </p>
        </div>
      </PageLayout>
    )
  }

  if (isEdit && loadingReporte) {
    return (
      <PageLayout title="Editar reporte">
        <div className="max-w-4xl mx-auto py-20 text-center text-zinc-500 text-[12px] font-mono">
          Cargando…
        </div>
      </PageLayout>
    )
  }

  const handleSubmit = async (data: FormPayload) => {
    setSubmitError(null)
    if (isEdit) {
      await editarMutation.mutateAsync(data)
    } else {
      await crearMutation.mutateAsync(data)
    }
  }

  return (
    <PageLayout title={isEdit ? "Editar reporte" : "Nuevo reporte"}>
      <div className="max-w-4xl mx-auto">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-[12px] text-zinc-500 hover:text-zinc-800 mb-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-700 rounded"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          Volver
        </button>

        {submitError && (
          <div
            role="alert"
            aria-live="polite"
            className="mb-4 px-4 py-3 rounded-md border border-red-200 bg-red-50 text-[12px] text-red-700 font-mono"
          >
            {submitError}
          </div>
        )}

        <ReporteEditor
          initial={reporte}
          proyectosConocidos={proyectos}
          onSubmit={handleSubmit}
          onCancel={() => navigate(-1)}
          submitting={crearMutation.isPending || editarMutation.isPending}
        />
      </div>
    </PageLayout>
  )
}

// ── Wrappers para App.tsx ─────────────────────────────────────────────────────

/** Ruta `/reportes-desarrollo/nuevo` — crear reporte. */
export function ReporteEditorPageNew() {
  return <ReporteEditorPage />
}

/** Ruta `/reportes-desarrollo/:id/editar` — editar reporte existente. */
export function ReporteEditorPageEdit() {
  const { id } = useParams<{ id: string }>()
  return <ReporteEditorPage reporteId={Number(id)} />
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Convierte el `FormPayload` (limpio, en memoria) en un `FormData` nativo
 * para enviar al backend con `multipart/form-data`. Si hay archivo, va el
 * archivo; si no, va el `contenidoMd` como string.
 */
function toFormData(data: FormPayload): FormData {
  const form = new FormData()
  form.append("titulo", data.titulo)
  if (data.descripcion) form.append("descripcion", data.descripcion)
  form.append("proyecto", data.proyecto)
  form.append("porcentajeAvance", String(data.porcentajeAvance))
  if (data.tiempoEstimadoHoras != null) {
    form.append("tiempoEstimadoHoras", String(data.tiempoEstimadoHoras))
  }
  if (data.tiempoRealHoras != null) {
    form.append("tiempoRealHoras", String(data.tiempoRealHoras))
  }
  if (data.archivo) {
    form.append("archivo", data.archivo)
  } else if (data.contenidoMd) {
    form.append("contenidoMd", data.contenidoMd)
  }
  return form
}
