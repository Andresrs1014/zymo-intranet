// Página de detalle de un reporte. Carga el reporte por id desde
// /api/reportes-desarrollo/:id y lo muestra con la vista de documento.
// Si el usuario es admin/gerente o el autor, le ofrece Editar/Eliminar.

import { useNavigate, useParams } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft } from "lucide-react"
import { PageLayout } from "@/components/layout/PageLayout"
import { useAuthStore } from "@/store/authStore"
import {
  canSeeReportesDesarrollo,
  canWriteReportesDesarrollo,
} from "@/lib/permissions"
import { reportesApi } from "@/lib/reportesApi"
import type { Reporte } from "@/lib/reportesShared"
import { ReporteDetailView } from "@/components/reportes/ReporteDetailView"

export function ReporteDetallePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)

  const reporteId = Number(id)

  // ── Query ─────────────────────────────────────────────────────────────────
  const { data: reporte, isLoading } = useQuery<Reporte>({
    queryKey: ["reportes-desarrollo", reporteId],
    queryFn: () =>
      reportesApi.get<Reporte>(`/api/reportes-desarrollo/${reporteId}`).then((r) => r.data),
    enabled: Number.isFinite(reporteId),
  })

  // ── Mutación: eliminar ────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: () => reportesApi.delete(`/api/reportes-desarrollo/${reporteId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reportes-desarrollo"] })
      navigate("/reportes-desarrollo")
    },
  })

  // ── Guards ────────────────────────────────────────────────────────────────
  if (!user || !canSeeReportesDesarrollo(user.role, user.app_permissions)) {
    return (
      <PageLayout title="Reporte">
        <NoAccess />
      </PageLayout>
    )
  }

  if (isLoading) {
    return (
      <PageLayout title="Reporte">
        <div className="max-w-4xl mx-auto py-20 text-center text-zinc-500 text-[12px] font-mono">
          Cargando…
        </div>
      </PageLayout>
    )
  }

  if (!reporte) {
    return (
      <PageLayout title="Reporte no encontrado">
        <NotFound onBack={() => navigate("/reportes-desarrollo")} />
      </PageLayout>
    )
  }

  // Permiso fino: editar/borrar requiere escritura + ser autor o admin/gerente.
  const isAdminOrGerente = user.role === "admin" || user.role === "gerente"
  const canEdit =
    canWriteReportesDesarrollo(user.role, user.app_permissions) &&
    (user.id === reporte.autorId || isAdminOrGerente)
  const canDelete = canEdit

  return (
    <PageLayout title={reporte.titulo}>
      <div className="max-w-6xl mx-auto">
        <BackButton onClick={() => navigate("/reportes-desarrollo")}>
          Volver a reportes
        </BackButton>

        <ReporteDetailView
          reporte={reporte}
          canEdit={canEdit}
          canDelete={canDelete}
          onEdit={() => navigate(`/reportes-desarrollo/${reporte.id}/editar`)}
          onDelete={() => {
            // Confirmación explícita antes de una acción destructiva.
            if (confirm("¿Eliminar este reporte? Esta acción no se puede deshacer.")) {
              deleteMutation.mutate()
            }
          }}
        />
      </div>
    </PageLayout>
  )
}

// ── Subcomponentes internos (también reutilizables) ───────────────────────────

/** Botón "volver" con flecha — usado por las pages de detalle y editor. */
function BackButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-[12px] text-zinc-500 hover:text-zinc-800 mb-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-700 rounded"
    >
      <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
      {children}
    </button>
  )
}

function NoAccess() {
  return (
    <div className="max-w-2xl mx-auto py-20 text-center">
      <p className="font-mono text-[13px] text-zinc-600">
        No tenés permiso para ver reportes de desarrollo.
      </p>
    </div>
  )
}

function NotFound({ onBack }: { onBack: () => void }) {
  return (
    <div className="max-w-2xl mx-auto py-20 text-center">
      <p className="font-mono text-[13px] text-zinc-600 mb-4">
        El reporte que buscás no existe o fue eliminado.
      </p>
      <button
        type="button"
        onClick={onBack}
        className="text-[12px] text-zinc-700 underline underline-offset-2 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-700 rounded"
      >
        Volver al listado
      </button>
    </div>
  )
}
