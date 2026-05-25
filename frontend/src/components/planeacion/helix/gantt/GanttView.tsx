import { useState, useRef, type CSSProperties } from "react"
import { useHelixActividades } from "@/hooks/useHelixActividades"
import { useHelixSubproyectos } from "@/hooks/useHelixSubproyectos"
import type { HelixActividad, HelixSubproyecto } from "@/types/helix"
import { GanttScale } from "./GanttScale"
import { GanttChart } from "./GanttChart"
import { TaskDialog } from "../dialogs/TaskDialog"

const DAY_WIDTH = 32
const LEFT_OFFSET = 200

function buildDaysArray(start: Date, end: Date): Date[] {
  const days: Date[] = []
  const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const endNorm = new Date(end.getFullYear(), end.getMonth(), end.getDate())
  while (cur.getTime() <= endNorm.getTime()) {
    days.push(new Date(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return days
}

function getDefaultRangeStart(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

function getDefaultRangeEnd(): Date {
  const now = new Date()
  // Last day of current month + 2 months ahead
  return new Date(now.getFullYear(), now.getMonth() + 3, 0)
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function GanttView() {
  const { actividades, loading: loadingAct, error: errorAct, refetch, updateActividad, createActividad } =
    useHelixActividades()
  const { subproyectos, loading: loadingSub, error: errorSub } =
    useHelixSubproyectos()

  const [rangeStart] = useState<Date>(getDefaultRangeStart)
  const [rangeEnd] = useState<Date>(getDefaultRangeEnd)
  const [selectedSubproyectoId, setSelectedSubproyectoId] = useState<
    number | null
  >(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingActividad, setEditingActividad] = useState<
    HelixActividad | undefined
  >(undefined)

  const scrollRef = useRef<HTMLDivElement>(null)

  const days = buildDaysArray(rangeStart, rangeEnd)

  const today = new Date()
  const todayDayIdx = days.findIndex((d) => isSameDay(d, today))

  function scrollToToday() {
    if (!scrollRef.current) return
    const offset = LEFT_OFFSET + todayDayIdx * DAY_WIDTH - scrollRef.current.clientWidth / 2
    scrollRef.current.scrollLeft = Math.max(0, offset)
  }

  const filteredActividades: HelixActividad[] =
    selectedSubproyectoId === null
      ? actividades
      : actividades.filter((a) => a.subproyectoId === selectedSubproyectoId)

  const filteredSubproyectos: HelixSubproyecto[] =
    selectedSubproyectoId === null
      ? subproyectos
      : subproyectos.filter((s) => s.id === selectedSubproyectoId)

  const loading = loadingAct || loadingSub
  const error = errorAct ?? errorSub

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "60px",
          color: "var(--helix-muted)",
          fontSize: "14px",
        }}
      >
        Cargando...
      </div>
    )
  }

  if (error) {
    return (
      <div
        style={{
          padding: "24px",
          borderRadius: "var(--helix-r-regular, 8px)",
          background: "var(--helix-danger-bg)",
          color: "var(--helix-danger-text)",
          fontSize: "13px",
          border: "1px solid rgba(239,51,64,0.2)",
        }}
      >
        Error: {error}
      </div>
    )
  }

  const headerStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    flexWrap: "wrap",
    gap: 12,
  }

  const titleStyle: CSSProperties = {
    fontSize: "18px",
    fontWeight: 700,
    color: "var(--helix-ink)",
    margin: 0,
  }

  const subtitleStyle: CSSProperties = {
    fontSize: "12px",
    color: "var(--helix-muted)",
    margin: "2px 0 0",
  }

  const btnBaseStyle: CSSProperties = {
    padding: "6px 14px",
    borderRadius: "var(--helix-r-soft, 6px)",
    fontSize: "13px",
    fontWeight: 700,
    cursor: "pointer",
    border: "1px solid var(--helix-line)",
  }

  const todayBtnStyle: CSSProperties = {
    ...btnBaseStyle,
    background: "var(--helix-accent)",
    color: "#fff",
    border: "none",
    boxShadow: "var(--helix-shadow-btn)",
  }

  const selectStyle: CSSProperties = {
    padding: "6px 10px",
    borderRadius: "var(--helix-r-soft, 6px)",
    border: "1px solid var(--helix-line)",
    background: "var(--helix-surface)",
    color: "var(--helix-ink)",
    fontSize: "13px",
    cursor: "pointer",
  }

  const ganttContainerStyle: CSSProperties = {
    position: "relative",
    border: "1px solid var(--helix-line)",
    borderRadius: "var(--helix-r-regular, 8px)",
    overflow: "hidden",
    background: "var(--helix-surface)",
  }

  const scrollContainerStyle: CSSProperties = {
    overflowX: "auto",
    overflowY: "auto",
    maxHeight: "calc(100vh - 180px)",
  }

  return (
    <div>
      {/* Header */}
      <div style={headerStyle}>
        <div>
          <h2 style={titleStyle}>Diagrama Gantt</h2>
          <p style={subtitleStyle}>
            Cronograma de actividades por subproyecto.
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* Subproject filter */}
          <select
            style={selectStyle}
            value={selectedSubproyectoId ?? ""}
            onChange={(e) => {
              const val = e.target.value
              setSelectedSubproyectoId(val === "" ? null : Number(val))
            }}
          >
            <option value="">Todos los subproyectos</option>
            {subproyectos.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>

          {/* Hoy button */}
          <button type="button" style={todayBtnStyle} onClick={scrollToToday}>
            Hoy
          </button>
        </div>
      </div>

      {/* Gantt chart area */}
      <div style={ganttContainerStyle}>
        <div style={scrollContainerStyle} ref={scrollRef}>
          <div style={{ minWidth: LEFT_OFFSET + days.length * DAY_WIDTH }}>
            <GanttScale
              days={days}
              dayWidth={DAY_WIDTH}
              leftOffset={LEFT_OFFSET}
            />
            <GanttChart
              actividades={filteredActividades}
              subproyectos={filteredSubproyectos}
              days={days}
              dayWidth={DAY_WIDTH}
              leftOffset={LEFT_OFFSET}
              rangeStart={rangeStart}
              onEditActividad={(act) => {
                setEditingActividad(act)
                setDialogOpen(true)
              }}
            />
          </div>
        </div>
      </div>

      <TaskDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false)
          setEditingActividad(undefined)
        }}
        actividad={editingActividad}
        onSaved={refetch}
        createActividad={createActividad}
        updateActividad={updateActividad}
      />
    </div>
  )
}
