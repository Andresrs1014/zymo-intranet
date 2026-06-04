import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { sigApi } from "@/lib/sigApi"
import { useAuthStore } from "@/store/authStore"

interface SigArea {
  id: number
  nombre: string
  descripcion?: string
  color: string
  _count: { procedimientos: number }
}

const COLORS = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899","#06b6d4","#84cc16"]

export function SigAreaList({ onSelectProcedimiento }: { onSelectProcedimiento: (id: number) => void }) {
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === "admin"
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ nombre: "", descripcion: "", color: "#3b82f6" })
  const [error, setError] = useState<string | null>(null)

  const { data: areas = [], isLoading } = useQuery<SigArea[]>({
    queryKey: ["sig", "areas"],
    queryFn: async () => (await sigApi.get("/api/areas")).data,
  })

  const createArea = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await sigApi.post("/api/areas", data)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sig", "areas"] })
      setShowNew(false)
      setForm({ nombre: "", descripcion: "", color: "#3b82f6" })
      setError(null)
    },
    onError: (e: any) => setError(e?.response?.data?.error ?? "Error al crear el área"),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-600 text-sm">
        Cargando áreas...
      </div>
    )
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 tracking-tight">Procedimientos</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Inventario de procedimientos por área — Sistema Integrado de Gestión
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowNew(true)}
            className="text-xs px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 transition-colors"
          >
            + Nueva área
          </button>
        )}
      </div>

      {areas.length === 0 && !showNew && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="text-4xl mb-4">📂</div>
          <p className="text-zinc-500 text-sm mb-2">Sin áreas configuradas</p>
          {isAdmin && (
            <p className="text-zinc-600 text-xs">
              Crea un área antes de recibir procedimientos desde NetVault
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {areas.map((area) => (
          <button
            key={area.id}
            onClick={() => navigate(`/sig?areaId=${area.id}`)}
            className="group text-left rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 hover:border-zinc-700 hover:bg-zinc-900 transition-all"
          >
            <div className="flex items-start gap-3 mb-3">
              <span
                className="h-3 w-3 rounded-full mt-1 shrink-0"
                style={{ backgroundColor: area.color }}
              />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-zinc-200 text-sm group-hover:text-white transition-colors truncate">
                  {area.nombre}
                </p>
                {area.descripcion && (
                  <p className="text-xs text-zinc-600 mt-1 line-clamp-2">{area.descripcion}</p>
                )}
              </div>
            </div>
            <p className="text-[11px] text-zinc-600 font-mono">
              {area._count.procedimientos} procedimiento{area._count.procedimientos !== 1 ? "s" : ""}
            </p>
          </button>
        ))}
      </div>

      {/* Modal nueva área */}
      {showNew && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md bg-zinc-900 rounded-xl border border-zinc-800 p-6 shadow-2xl">
            <h2 className="text-sm font-semibold text-zinc-200 mb-4">Nueva área</h2>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-zinc-500 block mb-1">Nombre *</label>
                <input
                  autoFocus
                  value={form.nombre}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-600"
                  placeholder="ej. Tecnología e Innovación"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 block mb-1">Descripción</label>
                <input
                  value={form.descripcion}
                  onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-600"
                  placeholder="Opcional"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 block mb-1">Color identificador</label>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setForm((f) => ({ ...f, color: c }))}
                      className="h-6 w-6 rounded-full transition-transform hover:scale-110 ring-offset-zinc-900"
                      style={{
                        backgroundColor: c,
                        outline: form.color === c ? `2px solid ${c}` : "none",
                        outlineOffset: "2px",
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {error && <p className="text-xs text-red-400 mt-3">{error}</p>}

            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => { setShowNew(false); setError(null) }}
                className="text-xs px-3 py-2 rounded-lg text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Cancelar
              </button>
              <button
                disabled={!form.nombre.trim() || createArea.isPending}
                onClick={() => createArea.mutate(form)}
                className="text-xs px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-100 disabled:opacity-40 transition-colors"
              >
                {createArea.isPending ? "Creando..." : "Crear área"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
