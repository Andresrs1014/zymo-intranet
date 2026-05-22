import type { CSSProperties } from "react"
import type { HelixFilters } from "@/hooks/useHelixFilters"
import type { HelixUsuario, HelixSubproyecto, HelixPrioridad } from "@/types/helix"

interface BoardToolbarProps {
  filters: HelixFilters
  setters: {
    setSearch: (v: string) => void
    setResponsableId: (v: number | "all") => void
    setSubproyectoId: (v: number | "all") => void
    setSoloBlockeadas: (v: boolean) => void
    setPrioridad: (v: HelixPrioridad | "all") => void
  }
  usuarios: HelixUsuario[]
  subproyectos: HelixSubproyecto[]
}

const PRIORIDADES: Array<HelixPrioridad | "all"> = ["all", "Alta", "Media", "Baja"]

const PRIORIDAD_LABELS: Record<string, string> = {
  all: "Todo",
  Alta: "Alta",
  Media: "Media",
  Baja: "Baja",
}

const chipBase: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "4px 12px",
  borderRadius: "999px",
  fontSize: "12px",
  fontWeight: 600,
  cursor: "pointer",
  border: "1px solid #e5e7eb",
  transition: "all 120ms",
  background: "#fff",
  color: "#6b7280",
}

const chipActive: CSSProperties = {
  ...chipBase,
  background: "#111827",
  color: "#fff",
  border: "1px solid #111827",
}

const labelStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "3px",
  fontSize: "11px",
  color: "#6b7280",
  fontWeight: 500,
}

const inputStyle: CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: "6px",
  padding: "5px 10px",
  fontSize: "13px",
  color: "#111827",
  background: "#fff",
  outline: "none",
  minWidth: "160px",
}

const selectStyle: CSSProperties = {
  ...inputStyle,
  cursor: "pointer",
  minWidth: "140px",
}

export function BoardToolbar({
  filters,
  setters,
  usuarios,
  subproyectos,
}: BoardToolbarProps) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "flex-end",
        gap: "12px",
        marginBottom: "16px",
        padding: "12px 16px",
        background: "#fff",
        borderRadius: "8px",
        border: "1px solid #e5e7eb",
      }}
    >
      {/* Search */}
      <label style={labelStyle}>
        Buscar
        <input
          type="text"
          placeholder="Nombre o responsable"
          value={filters.search}
          onChange={(e) => setters.setSearch(e.target.value)}
          style={inputStyle}
        />
      </label>

      {/* Responsable */}
      <label style={labelStyle}>
        Responsable
        <select
          value={filters.responsableId}
          onChange={(e) => {
            const v = e.target.value
            setters.setResponsableId(v === "all" ? "all" : Number(v))
          }}
          style={selectStyle}
        >
          <option value="all">Todos</option>
          {usuarios.map((u) => (
            <option key={u.id} value={u.id}>
              {u.full_name}
            </option>
          ))}
        </select>
      </label>

      {/* Subproyecto */}
      <label style={labelStyle}>
        Subproyecto
        <select
          value={filters.subproyectoId}
          onChange={(e) => {
            const v = e.target.value
            setters.setSubproyectoId(v === "all" ? "all" : Number(v))
          }}
          style={selectStyle}
        >
          <option value="all">Todos</option>
          {subproyectos.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nombre}
            </option>
          ))}
        </select>
      </label>

      {/* Solo bloqueadas */}
      <label
        style={{
          ...labelStyle,
          flexDirection: "row",
          alignItems: "center",
          gap: "6px",
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={filters.soloBlockeadas}
          onChange={(e) => setters.setSoloBlockeadas(e.target.checked)}
          style={{ width: "14px", height: "14px", cursor: "pointer" }}
        />
        <span style={{ fontSize: "12px", fontWeight: 600, color: "#374151" }}>
          Solo bloqueadas
        </span>
      </label>

      {/* Prioridad chips */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          flexWrap: "wrap",
        }}
      >
        {PRIORIDADES.map((p) => (
          <button
            key={p}
            type="button"
            style={filters.prioridad === p ? chipActive : chipBase}
            onClick={() => setters.setPrioridad(p)}
          >
            {PRIORIDAD_LABELS[p]}
          </button>
        ))}
      </div>
    </div>
  )
}
