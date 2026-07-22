import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { api } from "@/lib/api"
import { PageLayout } from "@/components/layout/PageLayout"
import { ArrowLeft, GitBranch, ExternalLink } from "lucide-react"

/** Nivel 3 (goCompanyOrg) — placeholder hasta árbol operativo dedicado. */
export function TyCEmpresaMapaPage() {
  const { sedeId } = useParams<{ sedeId: string }>()
  const navigate = useNavigate()
  const [nombre, setNombre] = useState("")

  useEffect(() => {
    if (!sedeId) return
    api.get("/tc/empresas")
      .then((r) => {
        const list = Array.isArray(r.data) ? r.data : []
        const emp = list.find((e: { id: number }) => String(e.id) === sedeId)
        if (emp) setNombre(emp.nombre)
      })
      .catch(() => {})
  }, [sedeId])

  return (
    <PageLayout title={nombre ? `Mapa — ${nombre}` : "Mapa jerárquico"} mainClassName="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-10 space-y-6">
        <button
          onClick={() => navigate(`/tc/empresa/${sedeId}`)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {nombre || "Empresa"}
        </button>

        <div className="rounded-2xl border border-border bg-muted/5 p-8 text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ef3340]/10 text-[#ef3340]">
            <GitBranch className="w-7 h-7" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-teal-500 mb-2">
              {nombre} · Mapa jerárquico
            </p>
            <h1 className="text-xl font-semibold">Árbol operativo — próxima iteración</h1>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              La vista fullscreen drag-scroll del prototipo original (goCompanyOrg) aún no está portada.
              Mientras tanto, el canvas de organigrama en T&C muestra los cargos de esta sede en la tab correspondiente.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/tc/organigrama")}
            className="inline-flex items-center gap-2 h-9 px-4 text-sm font-medium rounded-xl bg-[#ef3340] text-white hover:bg-[#d62d39] transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Abrir organigrama T&C
          </button>
          <p className="text-[11px] text-muted-foreground">
            Selecciona la tab de {nombre || "esta empresa"} en el organigrama.
          </p>
        </div>
      </div>
    </PageLayout>
  )
}
