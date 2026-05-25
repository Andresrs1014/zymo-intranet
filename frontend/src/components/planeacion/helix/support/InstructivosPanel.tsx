import { useState, useRef } from "react"
import { useHelixToast } from "../HelixToast"

interface UploadedFile {
  name: string
  date: string
  size: number
}

const STORAGE_KEY = "helix_instructivos_uploaded"

function loadUploaded(): UploadedFile[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]")
  } catch {
    return []
  }
}

function saveUploaded(items: UploadedFile[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

const BASE_INSTRUCTIVOS = [
  {
    name: "Instructivo de usuario Helix Zymo",
    href: "/instructivo_usuario_helix_zymo.md",
    detail: "Guía práctica para registrar tareas, evidencias, costos y alertas.",
  },
  {
    name: "Instructivo gerencial Helix Zymo",
    href: "/instructivo_gerencial_helix_zymo.md",
    detail: "Guía ejecutiva para interpretar estado, ROI, riesgos y decisiones.",
  },
]

export function InstructivosPanel() {
  const [uploaded, setUploaded] = useState<UploadedFile[]>(loadUploaded)
  const inputRef = useRef<HTMLInputElement>(null)
  const { showToast } = useHelixToast()

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return

    const newItems: UploadedFile[] = files.map((f) => ({
      name: f.name,
      date: new Date().toISOString(),
      size: f.size,
    }))
    const updated = [...uploaded, ...newItems]
    saveUploaded(updated)
    setUploaded(updated)
    showToast(`${files.length} instructivo(s) registrado(s)`, "success")
    if (inputRef.current) inputRef.current.value = ""
  }

  function handleClear() {
    localStorage.removeItem(STORAGE_KEY)
    setUploaded([])
    showToast("Instructivos limpiados", "info")
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })
  }

  const ghostBtn: React.CSSProperties = {
    padding: "7px 14px",
    borderRadius: 7,
    border: "1px solid var(--helix-border)",
    background: "var(--helix-surface)",
    color: "var(--helix-ink)",
    fontSize: "0.82rem",
    fontWeight: 600,
    cursor: "pointer",
    textDecoration: "none",
    display: "inline-block",
    whiteSpace: "nowrap",
  }

  return (
    <section
      style={{
        background: "var(--helix-surface)",
        border: "1px solid var(--helix-border)",
        borderRadius: 10,
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--helix-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "var(--helix-ink)" }}>
            Instructivos de uso
          </h3>
          <span style={{ fontSize: "0.75rem", color: "var(--helix-muted)" }}>
            {BASE_INSTRUCTIVOS.length + uploaded.length} disponibles
          </span>
        </div>
      </div>

      <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Download buttons */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {BASE_INSTRUCTIVOS.map((item) => (
            <a key={item.href} href={item.href} download style={ghostBtn}>
              ↓ {item.name.replace("Instructivo ", "").replace(" Helix Zymo", "")}
            </a>
          ))}
        </div>

        {/* Upload zone */}
        <label
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            padding: "20px",
            border: "2px dashed var(--helix-border)",
            borderRadius: 8,
            cursor: "pointer",
            color: "var(--helix-muted)",
            fontSize: "0.85rem",
            transition: "border-color 150ms",
          }}
        >
          <span style={{ fontSize: "1.4rem" }}>📎</span>
          <span>Cargar instructivos propios</span>
          <span style={{ fontSize: "0.75rem" }}>.pdf · .doc · .docx · .txt · .md</span>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.doc,.docx,.txt,.md"
            multiple
            style={{ display: "none" }}
            onChange={handleUpload}
          />
        </label>

        {/* Base instructivos list */}
        {BASE_INSTRUCTIVOS.map((item) => (
          <div
            key={item.href}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 12px",
              borderRadius: 7,
              background: "var(--helix-bg, #f8fafc)",
              border: "1px solid var(--helix-border)",
            }}
          >
            <span style={{ fontSize: "1.1rem" }}>📄</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: 600, color: "var(--helix-ink)" }}>
                {item.name}
              </p>
              <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "var(--helix-muted)" }}>
                {item.detail}
              </p>
            </div>
            <a href={item.href} download style={{ ...ghostBtn, fontSize: "0.75rem", padding: "4px 10px" }}>
              Descargar
            </a>
          </div>
        ))}

        {/* Uploaded files */}
        {uploaded.map((item) => (
          <div
            key={item.name + item.date}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 12px",
              borderRadius: 7,
              background: "var(--helix-bg, #f8fafc)",
              border: "1px solid var(--helix-border)",
            }}
          >
            <span style={{ fontSize: "1.1rem" }}>📁</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: 600, color: "var(--helix-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {item.name}
              </p>
              <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "var(--helix-muted)" }}>
                Cargado el {formatDate(item.date)} · {Math.round(item.size / 1024)} KB
              </p>
            </div>
          </div>
        ))}

        {/* Clear button */}
        {uploaded.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            style={{ ...ghostBtn, alignSelf: "flex-start", color: "var(--helix-muted)" }}
          >
            Limpiar instructivos cargados
          </button>
        )}
      </div>
    </section>
  )
}
