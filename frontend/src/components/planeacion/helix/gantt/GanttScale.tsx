import type { CSSProperties } from "react"

export interface GanttScaleProps {
  days: Date[]
  dayWidth: number
  leftOffset: number
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

interface MonthGroup {
  label: string
  count: number
}

function buildMonthGroups(days: Date[]): MonthGroup[] {
  const groups: MonthGroup[] = []
  for (const day of days) {
    const label = day.toLocaleDateString("es-ES", {
      month: "long",
      year: "numeric",
    })
    const capitalized = label.charAt(0).toUpperCase() + label.slice(1)
    if (groups.length === 0 || groups[groups.length - 1].label !== capitalized) {
      groups.push({ label: capitalized, count: 1 })
    } else {
      groups[groups.length - 1].count++
    }
  }
  return groups
}

export function GanttScale({ days, dayWidth, leftOffset }: GanttScaleProps) {
  const today = new Date()
  const monthGroups = buildMonthGroups(days)

  const outerStyle: CSSProperties = {
    position: "sticky",
    top: 0,
    zIndex: 10,
    background: "var(--helix-surface)",
    borderBottom: "1px solid var(--helix-line)",
    userSelect: "none",
  }

  const rowStyle: CSSProperties = {
    display: "flex",
    borderBottom: "1px solid var(--helix-line)",
  }

  const leftSpacerStyle: CSSProperties = {
    width: leftOffset,
    flexShrink: 0,
    borderRight: "1px solid var(--helix-line)",
    background: "var(--helix-surface)",
  }

  return (
    <div style={outerStyle}>
      {/* Row 1 — Month groups */}
      <div style={rowStyle}>
        <div style={leftSpacerStyle} />
        <div style={{ display: "flex", flexShrink: 0 }}>
          {monthGroups.map((group, idx) => (
            <div
              key={idx}
              style={{
                width: group.count * dayWidth,
                flexShrink: 0,
                padding: "4px 8px",
                fontSize: "var(--helix-text-caption, 0.78rem)",
                fontWeight: 700,
                color: "var(--helix-ink)",
                borderRight: "1px solid var(--helix-line)",
                overflow: "hidden",
                whiteSpace: "nowrap",
                background: "var(--helix-surface)",
              }}
            >
              {group.label}
            </div>
          ))}
        </div>
      </div>

      {/* Row 2 — Day numbers */}
      <div style={rowStyle}>
        <div style={leftSpacerStyle} />
        <div style={{ display: "flex", flexShrink: 0 }}>
          {days.map((day, idx) => {
            const isToday = isSameDay(day, today)
            return (
              <div
                key={idx}
                style={{
                  width: dayWidth,
                  flexShrink: 0,
                  height: 28,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "var(--helix-text-micro, 0.68rem)",
                  fontWeight: isToday ? 800 : 400,
                  color: isToday ? "#fff" : "var(--helix-muted)",
                  background: isToday
                    ? "var(--helix-accent)"
                    : "var(--helix-surface)",
                  borderRight: "1px solid var(--helix-line)",
                  borderRadius: isToday ? 4 : 0,
                  position: "relative",
                }}
              >
                {day.getDate()}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
