import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { sigApi } from "@/lib/sigApi"

interface PendingCommit {
  id: number
  mensaje: string
  autorNombre: string
  versionDoc: string | null
  sinCambios: boolean
  createdAt: string
  procedimiento: {
    id: number
    codigo: string
    titulo: string
    area: { nombre: string; color: string }
  }
}

export function SigReviewQueue() {
  const navigate = useNavigate()

  const { data: commits = [], isLoading } = useQuery<PendingCommit[]>({
    queryKey: ["sig", "commits", "pendientes"],
    queryFn: async () => (await sigApi.get("/api/commits/pendientes")).data,
    refetchInterval: 30_000,
  })

  if (isLoading) return <div className="p-8 text-zinc-600 text-sm">Cargando cola de revisión...</div>

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-lg font-bold text-zinc-100 tracking-tight">Cola de revisión</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Commits pendientes de aprobación — solo el Gerente puede aprobar
        </p>
      </div>

      {commits.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="text-4xl mb-4">✓</div>
          <p className="text-zinc-500 text-sm">No hay commits pendientes</p>
          <p className="text-zinc-700 text-xs mt-1">Todos los procedimientos están al día</p>
        </div>
      )}

      <div className="space-y-2">
        {commits.map((commit) => (
          <button
            key={commit.id}
            onClick={() => navigate(`/sig/commits/${commit.id}`)}
            className="w-full text-left rounded-xl border border-zinc-800 bg-zinc-900/40 px-5 py-4 hover:border-amber-500/30 hover:bg-zinc-900/80 transition-all group"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: commit.procedimiento.area.color }}
                  />
                  <span className="text-xs text-zinc-500">{commit.procedimiento.area.nombre}</span>
                  <span className="text-xs text-zinc-600 font-mono">
                    {commit.procedimiento.codigo}
                  </span>
                </div>
                <p className="text-sm text-zinc-300 group-hover:text-zinc-100 font-medium transition-colors">
                  {commit.mensaje}
                </p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-zinc-600">por {commit.autorNombre}</span>
                  {commit.versionDoc && (
                    <span className="text-xs text-zinc-600 font-mono">doc v{commit.versionDoc}</span>
                  )}
                  {commit.sinCambios && (
                    <span className="text-xs text-zinc-600 italic">sin cambios de IA</span>
                  )}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <span className="block text-xs text-zinc-600">
                  {new Date(commit.createdAt).toLocaleDateString("es-CO", {
                    day: "2-digit", month: "short"
                  })}
                </span>
                <span className="text-[10px] text-amber-400 mt-1 block">Ver diff →</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
