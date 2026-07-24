import { useNavigate } from "react-router-dom"
import { PageLayout } from "@/components/layout/PageLayout"
import { useAuthStore } from "@/store/authStore"
import { canUseEvaluacionesDesempeno } from "@/lib/permissions"
import { FileText, ClipboardList, ArrowUpRight } from "lucide-react"

export function TyCFormatosPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const puedeEvaluar = user ? canUseEvaluacionesDesempeno(user.role, user.app_permissions) : false

  const formatos = [
    {
      id: "ausentismo",
      icon: <FileText className="w-4 h-4" />,
      titulo: "Formato de Ausentismo",
      descripcion: "Permisos, licencia remunerada y licencia no remunerada.",
      ruta: "/tc/formatos/ausentismo",
    },
    ...(puedeEvaluar ? [{
      id: "evaluacion-desempeno",
      icon: <ClipboardList className="w-4 h-4" />,
      titulo: "Evaluación de desempeño",
      descripcion: "Rúbrica semestral para tu equipo — Líderes u Operativo, según a quién evalúes.",
      ruta: "/tc/evaluaciones",
    }] : []),
  ]

  return (
    <PageLayout title="Formatos digitales" mainClassName="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-8 py-10">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-teal-500 mb-1">T&C · Gestión Humana</p>
        <h1 className="text-2xl font-bold">Formatos digitales</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Formatos de Gestión Humana digitalizados — permisos, días remotos y demás trámites.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-8">
          {formatos.map((f) => (
            <button
              key={f.id}
              onClick={() => navigate(f.ruta)}
              className="group text-left rounded-2xl border border-border bg-muted/5 hover:bg-muted/10 hover:border-rose-500/30 hover:shadow-lg hover:-translate-y-px transition-all p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400">
                  {f.icon}
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground/20 group-hover:text-muted-foreground/60 transition-colors shrink-0 mt-0.5" />
              </div>
              <p className="font-semibold text-sm mt-3">{f.titulo}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{f.descripcion}</p>
            </button>
          ))}
        </div>
      </div>
    </PageLayout>
  )
}
