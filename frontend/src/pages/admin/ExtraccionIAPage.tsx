// frontend/src/pages/admin/ExtraccionIAPage.tsx
import { useState } from "react"
import { PageLayout } from "@/components/layout/PageLayout"
import { useAuthStore } from "@/store/authStore"
import { canSeeExtraccionIA } from "@/lib/permissions"
import {
  useColaCandidatos, useAprobarCandidato, useRechazarCandidato,
  useSinonimosAprendidos, useEliminarSinonimo, useMetricasExtraccion,
} from "@/hooks/useExtraccionIA"

type Tab = "cola" | "sinonimos" | "metricas"

export function ExtraccionIAPage() {
  const user = useAuthStore((s) => s.user)
  const [tab, setTab] = useState<Tab>("cola")
  const [campoSeleccionado, setCampoSeleccionado] = useState<Record<number, string>>({})

  const { data: cola = [], isLoading: loadingCola } = useColaCandidatos("pendiente")
  const { data: sinonimos = [] } = useSinonimosAprendidos()
  const { data: metricas } = useMetricasExtraccion()
  const aprobar = useAprobarCandidato()
  const rechazar = useRechazarCandidato()
  const eliminar = useEliminarSinonimo()

  if (!user || !canSeeExtraccionIA(user.role, user.app_permissions)) {
    return (
      <PageLayout title="Admin" mainClassName="flex-1 flex items-center justify-center text-gray-500 text-sm">
        Acceso restringido — solo administradores.
      </PageLayout>
    )
  }

  return (
    <PageLayout title="Admin — Motor de Extracción IA">
          <div className="mb-6">
            <h1 className="text-xl font-bold text-gray-900">Motor de Extracción IA</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Revisa candidatos, aprueba sinónimos y monitorea el aprendizaje del motor.
            </p>
          </div>

          {/* Métricas rápidas */}
          {metricas && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {[
                { label: "Pendientes de revisión", value: metricas.pendientes, color: "text-amber-600" },
                { label: "Aprobados", value: metricas.aprobados, color: "text-green-600" },
                { label: "Rechazados", value: metricas.rechazados, color: "text-red-500" },
                { label: "Sinónimos aprendidos", value: metricas.total_sinonimos_aprendidos, color: "text-brand-blue" },
              ].map((m) => (
                <div key={m.label} className="bg-white rounded-xl border border-gray-100 p-4">
                  <p className={`text-2xl font-bold ${m.color}`}>{m.value}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{m.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 border-b border-gray-200 mb-6">
            {(["cola", "sinonimos", "metricas"] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  tab === t ? "border-brand-blue text-brand-blue" : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {t === "cola"
                  ? `Cola de revisión${metricas?.pendientes ? ` (${metricas.pendientes})` : ""}`
                  : t === "sinonimos"
                  ? "Sinónimos aprendidos"
                  : "Campos canónicos"}
              </button>
            ))}
          </div>

          {/* Tab: Cola de revisión */}
          {tab === "cola" && (
            <div className="space-y-3">
              {loadingCola && <p className="text-sm text-gray-400">Cargando…</p>}
              {!loadingCola && cola.length === 0 && (
                <div className="flex flex-col items-center py-16 text-gray-400">
                  <p className="text-sm">No hay candidatos pendientes de revisión.</p>
                  <p className="text-xs mt-1">Cuando Gemini encuentre etiquetas desconocidas en cotizaciones, aparecerán aquí.</p>
                </div>
              )}
              {cola.map((item) => (
                <div key={item.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-sm font-bold text-gray-900">"{item.label_raw}"</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          item.confianza_ia === "alta" ? "bg-green-100 text-green-700" :
                          item.confianza_ia === "media" ? "bg-yellow-100 text-yellow-700" :
                          "bg-red-100 text-red-600"
                        }`}>
                          {item.confianza_ia}
                        </span>
                      </div>
                      {item.fragmento_texto && (
                        <p className="text-xs text-gray-400 italic truncate max-w-lg">
                          Contexto: "{item.fragmento_texto}"
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        Solicitud: {item.contexto_id ?? "—"} · {new Date(item.creado_en).toLocaleDateString("es-CO")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      <select
                        value={campoSeleccionado[item.id] ?? ""}
                        onChange={(e) => setCampoSeleccionado((prev) => ({ ...prev, [item.id]: e.target.value }))}
                        className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
                      >
                        <option value="">Seleccionar campo…</option>
                        {metricas?.campos_canonicos_disponibles.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={!campoSeleccionado[item.id] || aprobar.isPending}
                        onClick={() => aprobar.mutate({ id: item.id, canonical_field: campoSeleccionado[item.id] })}
                        className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                      >
                        Aprobar
                      </button>
                      <button
                        type="button"
                        disabled={rechazar.isPending}
                        onClick={() => rechazar.mutate(item.id)}
                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        Descartar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tab: Sinónimos aprendidos */}
          {tab === "sinonimos" && (
            <div>
              {sinonimos.length === 0 ? (
                <p className="text-sm text-gray-400 py-8 text-center">Aún no hay sinónimos aprendidos.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-100">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs font-medium text-gray-500 uppercase border-b border-gray-100 bg-gray-50 text-left">
                        <th className="px-4 py-2">Etiqueta aprendida</th>
                        <th className="px-4 py-2">Campo canónico</th>
                        <th className="px-4 py-2">Veces usada</th>
                        <th className="px-4 py-2">Aprobado por</th>
                        <th className="px-4 py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {sinonimos.map((s) => (
                        <tr key={s.id} className="text-gray-700">
                          <td className="px-4 py-2.5 font-mono text-xs">"{s.label}"</td>
                          <td className="px-4 py-2.5 text-brand-blue font-medium text-xs">{s.canonical_field}</td>
                          <td className="px-4 py-2.5 text-gray-500">{s.veces_visto}×</td>
                          <td className="px-4 py-2.5 text-gray-400 text-xs">{s.aprobado_por_email}</td>
                          <td className="px-4 py-2.5">
                            <button
                              type="button"
                              onClick={() => eliminar.mutate(s.id)}
                              className="text-xs text-red-500 hover:text-red-700 transition-colors"
                            >
                              Eliminar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tab: Campos canónicos disponibles */}
          {tab === "metricas" && metricas && (
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h2 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">Campos canónicos del motor</h2>
              <div className="flex flex-wrap gap-2">
                {metricas.campos_canonicos_disponibles.map((c) => (
                  <span key={c} className="rounded-full bg-gray-100 px-3 py-1 text-xs font-mono text-gray-600">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}
    </PageLayout>
  )
}
