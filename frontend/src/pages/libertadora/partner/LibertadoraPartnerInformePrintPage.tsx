import { useEffect } from "react"
import { usePartnerProspectos } from "@/hooks/useLibertadoraPartner"
import { useLibertadoraPartnerStore } from "@/store/libertadoraPartnerStore"
import { computeKpisFromProspectos } from "@/lib/libertadoraKpis"
import { InformeContent } from "@/components/libertadora/informe/InformeContent"
import "@/styles/libertadora.css"

const PRINT_TITLE = "Informe_SKANDIA_CREA-Libertadora_Seguros"

// Vista limpia de solo el informe para el socio externo (Skandia) -- misma
// idea que LibertadoraInformePrintPage, pero autenticada con el token del
// socio (localStorage, compartido entre pestañas del mismo navegador) en
// vez del JWT de la intranet. Ruta pública, igual que /libertadora/socio.
export function LibertadoraPartnerInformePrintPage() {
  const token = useLibertadoraPartnerStore((s) => s.token)
  const { data: prospectos, isLoading, isError } = usePartnerProspectos()
  const ready = Boolean(token) && Boolean(prospectos)

  useEffect(() => {
    const previous = document.title
    document.title = PRINT_TITLE
    return () => { document.title = previous }
  }, [])

  // Auto-imprime apenas los datos están listos -- un solo clic para el socio
  // en vez de dos. El botón sigue visible por si el navegador bloquea el
  // diálogo automático o cierra sin imprimir.
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
        {!token ? (
          <p className="text-sm text-zinc-500">Esta vista requiere haber iniciado sesión en el panel del socio.</p>
        ) : isLoading ? (
          <p className="text-sm text-zinc-400">Preparando informe…</p>
        ) : isError || !prospectos ? (
          <p className="text-sm text-red-600">No se pudo cargar el informe.</p>
        ) : (
          <InformeContent kpis={computeKpisFromProspectos(prospectos)} prospectos={prospectos} />
        )}
      </div>
    </div>
  )
}
