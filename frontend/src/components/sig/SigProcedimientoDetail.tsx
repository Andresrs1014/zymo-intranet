import { useParams, useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { sigApi } from "@/lib/sigApi"
import { cn } from "@/lib/utils"

interface Commit {
  id: number
  mensaje: string
  autorNombre: string
  estado: "PENDIENTE_REVISION" | "APROBADO" | "RECHAZADO"
  sinCambios: boolean
  versionDoc: string | null
  createdAt: string
}

interface Procedimiento {
  id: number
  codigo: string
  titulo: string
  descripcion: string | null
  estado: "BORRADOR" | "VIGENTE" | "OBSOLETO"
  area: { nombre: string; color: string }
  commits: Commit[]
}

const ESTADO_COMMIT: Record<string, { label: string; cls: string }> = {
  PENDIENTE_REVISION: { label: "Pendiente", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  APROBADO:          { label: "Aprobado",  cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  RECHAZADO:         { label: "Rechazado", cls: "bg-red-500/15 text-red-400 border-red-500/30" },
}

const ESTADO_PROC: Record<string, string> = {
  BORRADOR: "bg-zinc-700/40 text-zinc-400 border-zinc-600/40",
  VIGENTE:  "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  OBSOLETO: "bg-zinc-600/20 text-zinc-500 border-zinc-600/30",
}

export function SigProcedimientoDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: proc, isLoading } = useQuery<Procedimiento>({
    queryKey: ["sig", "procedimiento", id],
    queryFn: async () => (await sigApi.get(`/api/procedimientos/${id}`)).data,
    enabled: !!id,
  })

  if (isLoading) {
    return <div className="p-8 text-zinc-600 text-sm">Cargando...</div>
  }
  if (!proc) {
    return <div className="p-8 text-zinc-600 text-sm">Procedimiento no encontrado</div>
  }

  return (
    <div className="p-8 max-w-3xl">
      {/* Header */}
      <div className="flex items-start gap-4 mb-8">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ backgroundColor: proc.area.color }}
            />
            <span className="text-xs text-zinc-500">{proc.area.nombre}</span>
            <span
              className={cn(
                "text-[10px] px-1.5 py-0.5 rounded border ml-1",
                ESTADO_PROC[proc.estado]
              )}
            >
              {proc.estado}
            </span>
          </div>
          <h1 className="text-lg font-bold text-zinc-100 font-mono">{proc.codigo}</h1>
          <p className="text-sm text-zinc-400 mt-0.5">{proc.titulo}</p>
          {proc.descripcion && (
            <p className="text-xs text-zinc-600 mt-2">{proc.descripcion}</p>
          )}
        </div>
      </div>

      {/* Historial de commits */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 mb-3">
          Historial de commits
        </p>

        {proc.commits.length === 0 && (
          <div className="py-10 text-center text-zinc-700 text-sm">
            Sin commits. Usa NetVault para enviar el primer análisis.
          </div>
        )}

        <div className="relative">
          {/* Línea vertical */}
          {proc.commits.length > 1 && (
            <div className="absolute left-3.5 top-4 bottom-4 w-px bg-zinc-800" />
          )}

          <div className="space-y-0">
            {proc.commits.map((commit) => {
              const estadoInfo = ESTADO_COMMIT[commit.estado]
              return (
                <div key={commit.id} className="flex gap-4 relative">
                  {/* Node */}
                  <div className="relative z-10 mt-3.5 shrink-0">
                    <div className={cn(
                      "h-3 w-3 rounded-full border-2 border-zinc-950",
                      commit.estado === "APROBADO" ? "bg-emerald-500" :
                      commit.estado === "RECHAZADO" ? "bg-red-500" :
                      "bg-amber-500 animate-pulse"
                    )} />
                  </div>

                  {/* Card */}
                  <button
                    onClick={() => navigate(`/sig/commits/${commit.id}`)}
                    className="flex-1 mb-2 text-left rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3 hover:border-zinc-700 hover:bg-zinc-900/80 transition-all group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-zinc-300 group-hover:text-zinc-100 transition-colors font-medium truncate">
                          {commit.mensaje}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-zinc-600 font-mono">
                            #{String(commit.id).padStart(4, "0")}
                          </span>
                          {commit.versionDoc && (
                            <span className="text-[10px] text-zinc-600 font-mono">
                              doc v{commit.versionDoc}
                            </span>
                          )}
                          <span className="text-[10px] text-zinc-600">
                            por {commit.autorNombre}
                          </span>
                          {commit.sinCambios && (
                            <span className="text-[10px] text-zinc-500 italic">sin cambios de IA</span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded border",
                          estadoInfo.cls
                        )}>
                          {estadoInfo.label}
                        </span>
                        <span className="text-[10px] text-zinc-700">
                          {new Date(commit.createdAt).toLocaleDateString("es-CO", {
                            day: "2-digit", month: "short", year: "numeric"
                          })}
                        </span>
                      </div>
                    </div>
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
