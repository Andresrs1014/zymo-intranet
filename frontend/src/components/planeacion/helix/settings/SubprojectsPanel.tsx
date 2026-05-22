import { useState, type CSSProperties } from "react"
import { Plus, Pencil, Trash2, ChevronDown, ChevronUp } from "lucide-react"
import { useHelixSubproyectos } from "@/hooks/useHelixSubproyectos"
import type { HelixSubproyecto, HelixSubproyectoForm } from "@/types/helix"

// ─── Styles ──────────────────────────────────────────────────────────────────

const panelStyle: CSSProperties = {
  padding: "24px",
}

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: "20px",
}

const titleStyle: CSSProperties = {
  fontSize: "1rem",
  fontWeight: 700,
  color: "var(--helix-ink)",
  margin: 0,
}

const btnPrimaryStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  padding: "7px 14px",
  borderRadius: "var(--helix-r-regular)",
  background: "var(--helix-accent)",
  color: "#fff",
  border: "none",
  fontSize: "var(--helix-text-body-sm)",
  fontWeight: 600,
  cursor: "pointer",
  transition: "opacity var(--helix-transition)",
}

const cardStyle: CSSProperties = {
  background: "var(--helix-surface)",
  border: "var(--helix-border-default)",
  borderRadius: "var(--helix-r-large)",
  boxShadow: "var(--helix-shadow-card)",
  marginBottom: "10px",
  overflow: "hidden",
}

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  padding: "12px 16px",
}

const fieldLabelStyle: CSSProperties = {
  fontSize: "var(--helix-text-caption)",
  color: "var(--helix-muted)",
  fontWeight: 600,
  marginBottom: "3px",
  display: "block",
}

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "7px 10px",
  border: "1px solid var(--helix-line)",
  borderRadius: "var(--helix-r-soft)",
  fontSize: "var(--helix-text-body)",
  color: "var(--helix-ink)",
  background: "var(--helix-bg)",
  outline: "none",
  boxSizing: "border-box",
}

const formGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "12px",
}

const formActionsStyle: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "8px",
  marginTop: "16px",
}

const btnSaveStyle: CSSProperties = {
  padding: "7px 16px",
  borderRadius: "var(--helix-r-regular)",
  background: "var(--helix-accent)",
  color: "#fff",
  border: "none",
  fontSize: "var(--helix-text-body-sm)",
  fontWeight: 600,
  cursor: "pointer",
}

const btnCancelStyle: CSSProperties = {
  padding: "7px 16px",
  borderRadius: "var(--helix-r-regular)",
  background: "transparent",
  color: "var(--helix-muted)",
  border: "1px solid var(--helix-line)",
  fontSize: "var(--helix-text-body-sm)",
  fontWeight: 500,
  cursor: "pointer",
}

const iconBtnStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "30px",
  height: "30px",
  borderRadius: "var(--helix-r-soft)",
  background: "transparent",
  border: "1px solid var(--helix-line)",
  cursor: "pointer",
  color: "var(--helix-muted)",
  flexShrink: 0,
}

const badgeActiveStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "2px 8px",
  borderRadius: "var(--helix-r-full)",
  fontSize: "var(--helix-text-tiny)",
  fontWeight: 600,
  background: "var(--helix-ok-bg)",
  color: "var(--helix-ok-text)",
  flexShrink: 0,
}

const badgeInactiveStyle: CSSProperties = {
  ...badgeActiveStyle,
  background: "var(--helix-danger-bg)",
  color: "var(--helix-danger-text)",
}

// ─── Empty form ───────────────────────────────────────────────────────────────

const EMPTY_FORM: HelixSubproyectoForm = {
  nombre: "",
  objetivo: "",
  cliente: "",
  inversionEst: 0,
  retornoEsp: 0,
}

// ─── SubprojectForm ───────────────────────────────────────────────────────────

interface SubprojectFormProps {
  initial: HelixSubproyectoForm
  onSave: (data: HelixSubproyectoForm) => Promise<void>
  onCancel: () => void
}

function SubprojectForm({ initial, onSave, onCancel }: SubprojectFormProps) {
  const [form, setForm] = useState<HelixSubproyectoForm>(initial)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  function handleChange(field: keyof HelixSubproyectoForm, value: string | number) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nombre.trim()) {
      setFormError("El nombre es requerido")
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      await onSave(form)
    } catch {
      setFormError("Error al guardar. Intente nuevamente.")
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ padding: "16px", borderTop: "1px solid var(--helix-line)", background: "var(--helix-surface-2)" }}
    >
      <div style={formGridStyle}>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={fieldLabelStyle}>Nombre *</label>
          <input
            style={inputStyle}
            type="text"
            value={form.nombre}
            onChange={(e) => handleChange("nombre", e.target.value)}
            placeholder="Nombre del subproyecto"
            required
          />
        </div>
        <div>
          <label style={fieldLabelStyle}>Objetivo</label>
          <input
            style={inputStyle}
            type="text"
            value={form.objetivo ?? ""}
            onChange={(e) => handleChange("objetivo", e.target.value)}
            placeholder="Objetivo principal"
          />
        </div>
        <div>
          <label style={fieldLabelStyle}>Cliente</label>
          <input
            style={inputStyle}
            type="text"
            value={form.cliente ?? ""}
            onChange={(e) => handleChange("cliente", e.target.value)}
            placeholder="Cliente o área"
          />
        </div>
        <div>
          <label style={fieldLabelStyle}>Inversión estimada ($)</label>
          <input
            style={inputStyle}
            type="number"
            min={0}
            value={form.inversionEst}
            onChange={(e) => handleChange("inversionEst", Number(e.target.value))}
          />
        </div>
        <div>
          <label style={fieldLabelStyle}>Retorno esperado ($)</label>
          <input
            style={inputStyle}
            type="number"
            min={0}
            value={form.retornoEsp}
            onChange={(e) => handleChange("retornoEsp", Number(e.target.value))}
          />
        </div>
      </div>
      {formError && (
        <p style={{ color: "var(--helix-danger)", fontSize: "var(--helix-text-caption)", marginTop: "8px" }}>
          {formError}
        </p>
      )}
      <div style={formActionsStyle}>
        <button type="button" style={btnCancelStyle} onClick={onCancel} disabled={saving}>
          Cancelar
        </button>
        <button type="submit" style={btnSaveStyle} disabled={saving}>
          {saving ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </form>
  )
}

// ─── SubprojectRow ────────────────────────────────────────────────────────────

interface SubprojectRowProps {
  subproyecto: HelixSubproyecto
  onEdit: () => void
  onDelete: () => void
  expanded: boolean
  onToggle: () => void
}

function SubprojectRow({ subproyecto, onEdit, onDelete, expanded, onToggle }: SubprojectRowProps) {
  const { nombre, objetivo, cliente, inversionEst, retornoEsp, activo } = subproyecto

  return (
    <div>
      <div style={rowStyle}>
        {/* Toggle details */}
        <button
          type="button"
          style={{ ...iconBtnStyle, border: "none", background: "transparent", color: "var(--helix-muted)" }}
          onClick={onToggle}
          aria-label={expanded ? "Colapsar" : "Expandir"}
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {/* Name */}
        <span
          style={{
            flex: 1,
            fontSize: "var(--helix-text-body-def)",
            fontWeight: 600,
            color: "var(--helix-ink)",
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {nombre}
        </span>

        {/* Cliente */}
        {cliente && (
          <span
            style={{
              fontSize: "var(--helix-text-caption)",
              color: "var(--helix-muted)",
              flexShrink: 0,
            }}
          >
            {cliente}
          </span>
        )}

        {/* Active badge */}
        <span style={activo ? badgeActiveStyle : badgeInactiveStyle}>
          {activo ? "Activo" : "Inactivo"}
        </span>

        {/* Actions */}
        <button
          type="button"
          style={iconBtnStyle}
          onClick={onEdit}
          aria-label="Editar subproyecto"
        >
          <Pencil size={13} />
        </button>
        <button
          type="button"
          style={{ ...iconBtnStyle, color: "var(--helix-danger)" }}
          onClick={onDelete}
          aria-label="Eliminar subproyecto"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div
          style={{
            padding: "0 16px 14px 52px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
            gap: "10px",
          }}
        >
          {objetivo && (
            <div>
              <span style={fieldLabelStyle}>Objetivo</span>
              <span style={{ fontSize: "var(--helix-text-body)", color: "var(--helix-ink)" }}>{objetivo}</span>
            </div>
          )}
          <div>
            <span style={fieldLabelStyle}>Inversión est.</span>
            <span style={{ fontSize: "var(--helix-text-body)", color: "var(--helix-ink)", fontWeight: 600 }}>
              ${inversionEst.toLocaleString()}
            </span>
          </div>
          <div>
            <span style={fieldLabelStyle}>Retorno esp.</span>
            <span style={{ fontSize: "var(--helix-text-body)", color: "var(--helix-done)", fontWeight: 600 }}>
              ${retornoEsp.toLocaleString()}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── SubprojectsPanel ─────────────────────────────────────────────────────────

export function SubprojectsPanel() {
  const { subproyectos, loading, error, createSubproyecto, updateSubproyecto, deleteSubproyecto } =
    useHelixSubproyectos()

  const [editingId, setEditingId] = useState<number | "new" | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  function toggleExpand(id: number) {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  async function handleCreate(data: HelixSubproyectoForm) {
    await createSubproyecto(data)
    setEditingId(null)
  }

  async function handleUpdate(id: number, data: HelixSubproyectoForm) {
    await updateSubproyecto(id, data)
    setEditingId(null)
  }

  async function handleDelete(subproyecto: HelixSubproyecto) {
    const confirmed = window.confirm(
      `¿Eliminar el subproyecto "${subproyecto.nombre}"? Esta acción no se puede deshacer.`
    )
    if (!confirmed) return
    try {
      await deleteSubproyecto(subproyecto.id)
    } catch {
      // error already set by hook
    }
  }

  if (loading) {
    return (
      <div style={panelStyle}>
        <p style={{ color: "var(--helix-muted)", fontSize: "var(--helix-text-body)" }}>Cargando subproyectos...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={panelStyle}>
        <p style={{ color: "var(--helix-danger)", fontSize: "var(--helix-text-body)" }}>Error: {error}</p>
      </div>
    )
  }

  return (
    <div style={panelStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <h3 style={titleStyle}>Subproyectos ({subproyectos.length})</h3>
        {editingId !== "new" && (
          <button
            type="button"
            style={btnPrimaryStyle}
            onClick={() => setEditingId("new")}
          >
            <Plus size={14} />
            Nuevo subproyecto
          </button>
        )}
      </div>

      {/* New form */}
      {editingId === "new" && (
        <div style={{ ...cardStyle, marginBottom: "16px" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--helix-line)" }}>
            <span style={{ fontSize: "var(--helix-text-body-def)", fontWeight: 600, color: "var(--helix-ink)" }}>
              Nuevo subproyecto
            </span>
          </div>
          <SubprojectForm
            initial={EMPTY_FORM}
            onSave={handleCreate}
            onCancel={() => setEditingId(null)}
          />
        </div>
      )}

      {/* List */}
      {subproyectos.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "40px 24px",
            color: "var(--helix-muted)",
            fontSize: "var(--helix-text-body)",
          }}
        >
          No hay subproyectos. Crea el primero.
        </div>
      ) : (
        subproyectos.map((sub) => (
          <div key={sub.id} style={cardStyle}>
            {editingId === sub.id ? (
              <>
                <SubprojectRow
                  subproyecto={sub}
                  onEdit={() => setEditingId(null)}
                  onDelete={() => handleDelete(sub)}
                  expanded={expandedId === sub.id}
                  onToggle={() => toggleExpand(sub.id)}
                />
                <SubprojectForm
                  initial={{
                    nombre: sub.nombre,
                    objetivo: sub.objetivo ?? "",
                    cliente: sub.cliente ?? "",
                    inversionEst: sub.inversionEst,
                    retornoEsp: sub.retornoEsp,
                  }}
                  onSave={(data) => handleUpdate(sub.id, data)}
                  onCancel={() => setEditingId(null)}
                />
              </>
            ) : (
              <SubprojectRow
                subproyecto={sub}
                onEdit={() => setEditingId(sub.id)}
                onDelete={() => handleDelete(sub)}
                expanded={expandedId === sub.id}
                onToggle={() => toggleExpand(sub.id)}
              />
            )}
          </div>
        ))
      )}
    </div>
  )
}
