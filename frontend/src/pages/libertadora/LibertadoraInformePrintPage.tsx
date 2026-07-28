import { useEffect } from "react"
import { useLibKpis, useLibProspectos } from "@/hooks/useLibertadora"
import { InformeContent } from "@/components/libertadora/informe/InformeContent"
import "@/styles/libertadora.css"

const PRINT_TITLE = "Informe_SKANDIA_CREA-Libertadora_Seguros"

// Vista limpia de solo el informe, sin sidebar/topbar/pestañas de la
// intranet alrededor -- mismo patrón que PrintFacturacionPage.tsx
// (Financiero). Se abre en pestaña nueva desde el botón "Imprimir /
// exportar PDF" del Informe normal.
export function LibertadoraInformePrintPage() {
  const kpisQuery = useLibKpis()
  const prospectosQuery = useLibProspectos()
  const ready = Boolean(kpisQuery.data) && Boolean(prospectosQuery.data)

  useEffect(() => {
    const previous = document.title
    document.title = PRINT_TITLE
    return () => { document.title = previous }
  }, [])

  // Auto-imprime apenas los datos están listos -- evita que el usuario tenga
  // que hacer un segundo clic en esta vista además del que ya hizo para
  // llegar acá. El botón "Imprimir / exportar PDF" sigue visible por si el
  // navegador bloquea el diálogo automático o el usuario cierra sin imprimir.
  useEffect(() => {
    if (!ready) return
    const timer = setTimeout(() => window.print(), 600)
    return () => clearTimeout(timer)
  }, [ready])

  return (
    <div className="libertadora-scope min-h-screen bg-zinc-50 px-6 py-8 print:bg-white print:px-0 print:py-0">
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 14mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
      <div className="mx-auto max-w-3xl">
        {kpisQuery.isLoading || prospectosQuery.isLoading ? (
          <p className="text-sm text-zinc-400">Preparando informe…</p>
        ) : kpisQuery.isError || prospectosQuery.isError || !kpisQuery.data ? (
          <p className="text-sm text-red-600">No se pudo cargar el informe.</p>
        ) : (
          <InformeContent kpis={kpisQuery.data} prospectos={prospectosQuery.data ?? []} />
        )}
      </div>
    </div>
  )
}
