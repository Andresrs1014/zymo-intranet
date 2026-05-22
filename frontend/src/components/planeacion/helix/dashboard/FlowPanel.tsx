import { useState, useEffect, useRef } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { helixApi } from "@/lib/helixApi"
import type { HelixFlujoSubproyecto } from "@/types/helix"

const ESTADO_COLORS: Record<string, string> = {
  Backlog: "#6b7280",
  Planificado: "#3b82f6",
  "En curso": "#f59e0b",
  Revision: "#8b5cf6",
  Terminado: "#1f9d6a",
}

interface FlowPanelProps {
  subproyectoId?: number
}

interface FlujoResponse {
  subproyectos: HelixFlujoSubproyecto[]
}

export function FlowPanel({ subproyectoId }: FlowPanelProps) {
  const [subproyectos, setSubproyectos] = useState<HelixFlujoSubproyecto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError(null)

    const params: Record<string, string | number> = {}
    if (subproyectoId !== undefined) params.subproyectoId = subproyectoId

    helixApi
      .get<FlujoResponse>("/api/dashboard/flujo", { params, signal: controller.signal })
      .then((res) => {
        setSubproyectos(res.data.subproyectos)
        // Auto-expand first subproyecto
        if (res.data.subproyectos.length > 0) {
          setExpanded(new Set([res.data.subproyectos[0].id]))
        }
        setLoading(false)
      })
      .catch((err: unknown) => {
        const isAbort = err instanceof Error && err.name === "AbortError"
        const axiosAbort =
          typeof err === "object" &&
          err !== null &&
          "code" in err &&
          (err as { code?: string }).code === "ERR_CANCELED"
        if (!isAbort && !axiosAbort) {
          setError(err instanceof Error ? err.message : "Error al cargar flujo")
          setLoading(false)
        }
      })

    return () => controller.abort()
  }, [subproyectoId])

  function toggleExpand(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div
      style={{
        background: "var(--helix-card-bg)",
        boxShadow: "var(--helix-shadow-card)",
        borderRadius: 10,
        padding: 16,
      }}
    >
      <h4
        style={{
          margin: "0 0 12px",
          fontSize: "var(--helix-text-body-def)",
          fontWeight: 700,
          color: "var(--helix-ink)",
        }}
      >
        Flujo por subproyecto
      </h4>

      {loading && (
        <p style={{ fontSize: "var(--helix-text-small)", color: "var(--helix-muted)" }}>
          Cargando...
        </p>
      )}

      {error && (
        <p style={{ fontSize: "var(--helix-text-small)", color: "var(--helix-danger)" }}>
          {error}
        </p>
      )}

      {!loading && !error && subproyectos.length === 0 && (
        <p style={{ fontSize: "var(--helix-text-small)", color: "var(--helix-muted)" }}>
          Sin subproyectos
        </p>
      )}

      {!loading && !error && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {subproyectos.map((sp) => {
            const isOpen = expanded.has(sp.id)
            return (
              <div
                key={sp.id}
                style={{
                  borderRadius: 8,
                  border: "1px solid var(--helix-line)",
                  overflow: "hidden",
                }}
              >
                {/* Header */}
                <button
                  type="button"
                  onClick={() => toggleExpand(sp.id)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "9px 12px",
                    background: isOpen ? "var(--helix-surface-2)" : "var(--helix-surface)",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  {isOpen ? (
                    <ChevronDown size={14} color="var(--helix-muted)" />
                  ) : (
                    <ChevronRight size={14} color="var(--helix-muted)" />
                  )}
                  <span
                    style={{
                      fontSize: "var(--helix-text-body-sm)",
                      fontWeight: 700,
                      color: "var(--helix-ink)",
                      flex: 1,
                    }}
                  >
                    {sp.nombre}
                  </span>
                  <span
                    style={{
                      fontSize: "var(--helix-text-tiny)",
                      color: "var(--helix-muted)",
                    }}
                  >
                    {sp.actividades.length} actividades
                  </span>
                </button>

                {/* Activities list */}
                {isOpen && (
                  <div
                    style={{
                      padding: "4px 0",
                      borderTop: "1px solid var(--helix-line)",
                    }}
                  >
                    {sp.actividades.length === 0 ? (
                      <p
                        style={{
                          margin: 0,
                          padding: "8px 12px",
                          fontSize: "var(--helix-text-tiny)",
                          color: "var(--helix-muted)",
                        }}
                      >
                        Sin actividades
                      </p>
                    ) : (
                      sp.actividades.map((act) => (
                        <div
                          key={act.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "7px 12px",
                          }}
                        >
                          {/* Estado chip */}
                          <span
                            style={{
                              display: "inline-block",
                              padding: "2px 7px",
                              borderRadius: "var(--helix-r-full)",
                              background: ESTADO_COLORS[act.estado] ?? "#6b7280",
                              color: "#fff",
                              fontSize: "var(--helix-text-micro)",
                              fontWeight: 700,
                              flexShrink: 0,
                            }}
                          >
                            {act.estado}
                          </span>

                          {/* Name */}
                          <span
                            style={{
                              flex: 1,
                              fontSize: "var(--helix-text-body-sm)",
                              color: "var(--helix-ink)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {act.nombre}
                          </span>

                          {/* Responsable */}
                          <span
                            style={{
                              fontSize: "var(--helix-text-tiny)",
                              color: "var(--helix-muted)",
                              flexShrink: 0,
                            }}
                          >
                            {act.responsableNombre}
                          </span>

                          {/* Avance bar */}
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                              flexShrink: 0,
                              minWidth: 70,
                            }}
                          >
                            <div
                              style={{
                                width: 50,
                                height: 5,
                                borderRadius: 3,
                                background: "var(--helix-bar-track)",
                                overflow: "hidden",
                              }}
                            >
                              <div
                                style={{
                                  height: "100%",
                                  width: `${act.avance}%`,
                                  background:
                                    act.estado === "Terminado"
                                      ? "var(--helix-done)"
                                      : "var(--helix-accent)",
                                  borderRadius: 3,
                                }}
                              />
                            </div>
                            <span
                              style={{
                                fontSize: "var(--helix-text-micro)",
                                color: "var(--helix-muted)",
                              }}
                            >
                              {act.avance}%
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
