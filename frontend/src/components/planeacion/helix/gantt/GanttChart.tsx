import { useState, type CSSProperties } from "react"
import type { HelixActividad, HelixSubproyecto } from "@/types/helix"

export interface GanttChartProps {
  actividades: HelixActividad[]
  subproyectos: HelixSubproyecto[]
  days: Date[]
  dayWidth: number
  leftOffset: number
  rangeStart: Date
  onEditActividad?: (actividad: HelixActividad) => void
}

/** Number of days between two dates, inclusive */
function daysBetween(a: Date, b: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24
  const diffMs = b.getTime() - a.getTime()
  return Math.max(1, Math.round(diffMs / msPerDay) + 1)
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function parseLocalDate(dateStr: string): Date {
  // fechaInicio/fechaFin are ISO strings — strip time so we get midnight local
  const d = new Date(dateStr)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

interface TooltipData {
  actividad: HelixActividad
  x: number
  y: number
}

const ROW_HEIGHT = 36
const BAR_HEIGHT = 22
const BAR_TOP = (ROW_HEIGHT - BAR_HEIGHT) / 2

export function GanttChart({
  actividades,
  subproyectos,
  days,
  dayWidth,
  leftOffset,
  rangeStart,
  onEditActividad,
}: GanttChartProps) {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null)
  const today = new Date()

  const totalDaysWidth = days.length * dayWidth

  // Today column offset
  const todayDayIdx = days.findIndex((d) => isSameDay(d, today))

  // Group activities by subproject
  const rows: Array<
    | { type: "header"; subproyecto: HelixSubproyecto }
    | { type: "activity"; actividad: HelixActividad; rowIndex: number }
  > = []

  let rowIndex = 0
  for (const sub of subproyectos) {
    const subActividades = actividades.filter(
      (a) => a.subproyectoId === sub.id
    )
    if (subActividades.length === 0) continue

    rows.push({ type: "header", subproyecto: sub })
    rowIndex++
    for (const act of subActividades) {
      rows.push({ type: "activity", actividad: act, rowIndex })
      rowIndex++
    }
  }

  // Activities without a matching subproject
  const knownSubIds = new Set(subproyectos.map((s) => s.id))
  const orphans = actividades.filter((a) => !knownSubIds.has(a.subproyectoId))
  if (orphans.length > 0) {
    rows.push({
      type: "header",
      subproyecto: {
        id: -1,
        nombre: "Sin subproyecto",
        inversionEst: 0,
        retornoEsp: 0,
        activo: true,
        createdAt: "",
        updatedAt: "",
      },
    })
    rowIndex++
    for (const act of orphans) {
      rows.push({ type: "activity", actividad: act, rowIndex })
      rowIndex++
    }
  }

  const totalHeight = rows.length * ROW_HEIGHT

  function getBarStyle(actividad: HelixActividad, rowIdx: number): CSSProperties {
    const start = parseLocalDate(actividad.fechaInicio)
    const end = parseLocalDate(actividad.fechaFin)
    const rangeStartNorm = new Date(
      rangeStart.getFullYear(),
      rangeStart.getMonth(),
      rangeStart.getDate()
    )

    const startOffsetDays = Math.round(
      (start.getTime() - rangeStartNorm.getTime()) / (1000 * 60 * 60 * 24)
    )
    const barDays = daysBetween(start, end)

    const left = startOffsetDays * dayWidth
    const width = Math.max(dayWidth, barDays * dayWidth)
    const top = rowIdx * ROW_HEIGHT + BAR_TOP

    let background = "var(--helix-grad-gantt)"
    if (actividad.bloqueada) {
      background = "var(--helix-danger)"
    } else if (actividad.estado === "Terminado") {
      background = "var(--helix-done)"
    }

    return {
      position: "absolute",
      left,
      top,
      width,
      height: BAR_HEIGHT,
      background,
      borderRadius: "var(--helix-r-soft, 6px)",
      cursor: "pointer",
      overflow: "hidden",
    }
  }

  function getAvanceOverlayStyle(avance: number): CSSProperties {
    return {
      position: "absolute",
      left: 0,
      top: 0,
      height: "100%",
      width: `${avance}%`,
      background: "rgba(255,255,255,0.22)",
      borderRadius: "inherit",
      pointerEvents: "none",
    }
  }

  function handleBarMouseEnter(
    e: React.MouseEvent<HTMLDivElement>,
    actividad: HelixActividad
  ) {
    const rect = e.currentTarget.getBoundingClientRect()
    setTooltip({
      actividad,
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
    })
  }

  function handleBarMouseLeave() {
    setTooltip(null)
  }

  const containerStyle: CSSProperties = {
    position: "relative",
  }

  const leftColStyle: CSSProperties = {
    width: leftOffset,
    flexShrink: 0,
    borderRight: "1px solid var(--helix-line)",
    position: "relative",
  }

  const rightColStyle: CSSProperties = {
    position: "relative",
    width: totalDaysWidth,
    flexShrink: 0,
  }

  return (
    <div style={containerStyle}>
      <div style={{ display: "flex" }}>
        {/* Left labels column */}
        <div style={leftColStyle}>
          {rows.map((row, idx) => {
            if (row.type === "header") {
              return (
                <div
                  key={`header-${row.subproyecto.id}`}
                  style={{
                    height: ROW_HEIGHT,
                    display: "flex",
                    alignItems: "center",
                    padding: "0 12px",
                    background: "var(--helix-surface-2, #eef1f6)",
                    borderBottom: "1px solid var(--helix-line)",
                    fontSize: "var(--helix-text-small, 0.76rem)",
                    fontWeight: 700,
                    color: "var(--helix-ink)",
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                    textOverflow: "ellipsis",
                  }}
                >
                  {row.subproyecto.nombre}
                </div>
              )
            }

            const act = row.actividad
            const isEven = idx % 2 === 0

            return (
              <div
                key={`act-label-${act.id}`}
                style={{
                  height: ROW_HEIGHT,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "0 8px 0 16px",
                  background: isEven
                    ? "var(--helix-surface)"
                    : "var(--helix-bg)",
                  borderBottom: "1px solid var(--helix-line)",
                  cursor: "pointer",
                }}
                onClick={() => onEditActividad?.(act)}
              >
                {/* Responsable initials badge */}
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    background: act.responsableColor || "var(--helix-accent)",
                    color: "#fff",
                    fontSize: "var(--helix-text-micro, 0.68rem)",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {act.responsableInitials}
                </div>
                <span
                  style={{
                    fontSize: "var(--helix-text-body-sm, 0.82rem)",
                    color: "var(--helix-ink)",
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                    textOverflow: "ellipsis",
                  }}
                >
                  {act.nombre}
                </span>
              </div>
            )
          })}
        </div>

        {/* Right: grid + bars */}
        <div style={rightColStyle}>
          {/* Background zebra rows + vertical lines */}
          <div
            style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
          >
            {rows.map((row, idx) => {
              const isHeader = row.type === "header"
              const isEven = idx % 2 === 0
              return (
                <div
                  key={idx}
                  style={{
                    position: "absolute",
                    top: idx * ROW_HEIGHT,
                    left: 0,
                    width: totalDaysWidth,
                    height: ROW_HEIGHT,
                    background: isHeader
                      ? "var(--helix-surface-2, #eef1f6)"
                      : isEven
                      ? "var(--helix-surface)"
                      : "var(--helix-bg)",
                    borderBottom: "1px solid var(--helix-line)",
                  }}
                />
              )
            })}

            {/* Today vertical line */}
            {todayDayIdx >= 0 && (
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: todayDayIdx * dayWidth + dayWidth / 2,
                  width: 2,
                  height: totalHeight,
                  background: "var(--helix-accent)",
                  opacity: 0.35,
                  zIndex: 1,
                }}
              />
            )}

            {/* Day column separators */}
            {days.map((_, dIdx) => (
              <div
                key={dIdx}
                style={{
                  position: "absolute",
                  top: 0,
                  left: (dIdx + 1) * dayWidth - 1,
                  width: 1,
                  height: totalHeight,
                  background: "var(--helix-line)",
                  opacity: 0.5,
                }}
              />
            ))}
          </div>

          {/* Activity bars */}
          <div
            style={{
              position: "relative",
              height: totalHeight,
            }}
          >
            {rows.map((row, idx) => {
              if (row.type !== "activity") return null
              const act = row.actividad
              const barStyle = getBarStyle(act, idx)

              return (
                <div
                  key={`bar-${act.id}`}
                  style={barStyle}
                  onClick={() => onEditActividad?.(act)}
                  onMouseEnter={(e) => handleBarMouseEnter(e, act)}
                  onMouseLeave={handleBarMouseLeave}
                >
                  {/* Avance overlay */}
                  <div style={getAvanceOverlayStyle(act.avance)} />
                  {/* Bar label */}
                  <span
                    style={{
                      position: "absolute",
                      left: 6,
                      top: "50%",
                      transform: "translateY(-50%)",
                      fontSize: "var(--helix-text-micro, 0.68rem)",
                      color: "#fff",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      pointerEvents: "none",
                    }}
                  >
                    {act.avance}%
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip !== null && (
        <div
          style={{
            position: "fixed",
            left: tooltip.x,
            top: tooltip.y,
            transform: "translate(-50%, -100%)",
            background: "var(--helix-ink)",
            color: "#fff",
            borderRadius: "var(--helix-r-regular, 8px)",
            padding: "8px 12px",
            fontSize: "var(--helix-text-caption, 0.78rem)",
            pointerEvents: "none",
            zIndex: 9999,
            boxShadow: "var(--helix-shadow-default)",
            maxWidth: 260,
            lineHeight: "var(--helix-lh-normal, 1.35)",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 4 }}>
            {tooltip.actividad.nombre}
          </div>
          <div style={{ color: "rgba(255,255,255,0.8)" }}>
            {new Date(tooltip.actividad.fechaInicio).toLocaleDateString(
              "es-ES"
            )}{" "}
            →{" "}
            {new Date(tooltip.actividad.fechaFin).toLocaleDateString("es-ES")}
          </div>
          <div style={{ color: "rgba(255,255,255,0.8)" }}>
            Avance: {tooltip.actividad.avance}%
          </div>
          <div style={{ color: "rgba(255,255,255,0.7)" }}>
            {tooltip.actividad.responsableNombre}
          </div>
        </div>
      )}
    </div>
  )
}
