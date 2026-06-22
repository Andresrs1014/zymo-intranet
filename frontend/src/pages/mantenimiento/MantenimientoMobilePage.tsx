import { useCallback, useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import type {
  CrearOCMobilePayload,
  MobileDetalleOut,
  MobileHubOut,
  MobileSolicitudResumen,
} from "@/types/mantenimiento"

const API = "/api/mantenimiento"

type Vista = "hub" | "detalle" | "oc" | "ok"
type Accion = "en_camino" | "completado" | "necesita_repuesto"

interface Props {
  mode: "jwt" | "stable"
}

const ESTADO_LABEL: Record<string, string> = {
  solicitud:  "Solicitud",
  programado: "Programado",
  ejecucion:  "En ejecución",
  completado: "Completado",
  cancelado:  "Cancelado",
}

const ESTADO_COLOR: Record<string, string> = {
  solicitud:  "#38bdf8",
  programado: "#818cf8",
  ejecucion:  "#fb923c",
  completado: "#22c55e",
  cancelado:  "#ef4444",
}

export default function MantenimientoMobilePage({ mode }: Props) {
  const { token, accessToken } = useParams<{ token?: string; accessToken?: string }>()
  const mobileToken = mode === "stable" ? accessToken : token

  const [vista, setVista] = useState<Vista>("hub")
  const [hub, setHub] = useState<MobileHubOut | null>(null)
  const [detalle, setDetalle] = useState<MobileDetalleOut | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [accionOk, setAccionOk] = useState<Accion | null>(null)
  const [msgOk, setMsgOk] = useState<string | null>(null)

  const [ocDesc, setOcDesc] = useState("")
  const [ocCat, setOcCat] = useState("")
  const [ocPrioridad, setOcPrioridad] = useState("Media")
  const [ocObs, setOcObs] = useState("")

  const cargarHub = useCallback(async () => {
    if (!mobileToken) return
    const res = await fetch(`${API}/m/${mobileToken}/hub`)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.detail || "Enlace inválido o expirado")
    }
    return res.json() as Promise<MobileHubOut>
  }, [mobileToken])

  const cargarDetalle = useCallback(async (id: number) => {
    if (!mobileToken) return
    const res = await fetch(`${API}/m/${mobileToken}/solicitudes/${id}`)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.detail || "No se pudo cargar la solicitud")
    }
    return res.json() as Promise<MobileDetalleOut>
  }, [mobileToken])

  useEffect(() => {
    if (!mobileToken) return
    cargarHub()
      .then((data) => {
        setHub(data ?? null)
        if (data && data.activas.length === 1) {
          setSelectedId(data.activas[0].solicitud_id)
        }
      })
      .catch((e: Error) => setError(e.message))
  }, [mobileToken, cargarHub])

  useEffect(() => {
    if (!selectedId || vista !== "detalle") return
    cargarDetalle(selectedId)
      .then(setDetalle)
      .catch((e: Error) => setError(e.message))
  }, [selectedId, vista, cargarDetalle])

  async function ejecutarAccion(acc: Accion, extra?: { evidencia_url?: string; monto_real?: number }) {
    if (!mobileToken || !selectedId) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`${API}/m/${mobileToken}/solicitudes/${selectedId}/accion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: acc, ...extra }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || "Error al registrar acción")
      setAccionOk(acc)
      setMsgOk(acc === "necesita_repuesto" ? "Notificación registrada" : "¡Listo!")
      setVista("ok")
      const nuevoHub = await cargarHub()
      setHub(nuevoHub ?? null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error inesperado")
    } finally {
      setBusy(false)
    }
  }

  function completarConFoto() {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "image/*"
    input.setAttribute("capture", "environment")
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        void ejecutarAccion("completado", { evidencia_url: reader.result as string })
      }
      reader.readAsDataURL(file)
    }
    input.click()
  }

  function abrirDetalle(item: MobileSolicitudResumen) {
    setSelectedId(item.solicitud_id)
    setDetalle(null)
    setError(null)
    setVista("detalle")
  }

  function abrirOC() {
    if (!detalle) return
    setOcDesc(`Mantenimiento ${detalle.consecutivo} — ${detalle.titulo}`)
    setOcCat("")
    setOcPrioridad("Media")
    setOcObs("")
    setVista("oc")
  }

  async function enviarOC(e: React.FormEvent) {
    e.preventDefault()
    if (!mobileToken || !selectedId || !ocDesc.trim()) return
    setBusy(true)
    setError(null)
    try {
      const payload: CrearOCMobilePayload = {
        descripcion: ocDesc.trim(),
        categoria: ocCat.trim() || undefined,
        nivel_prioridad: ocPrioridad,
        observaciones_solicitante: ocObs.trim() || undefined,
      }
      const res = await fetch(`${API}/m/${mobileToken}/solicitudes/${selectedId}/oc-vinculada`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || "Error al crear solicitud de compra")
      setAccionOk(null)
      setMsgOk(`OC ${data.consecutivo_os} creada`)
      setVista("ok")
      const nuevoHub = await cargarHub()
      setHub(nuevoHub ?? null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error inesperado")
    } finally {
      setBusy(false)
    }
  }

  function volverAlHub() {
    setVista("hub")
    setSelectedId(null)
    setDetalle(null)
    setAccionOk(null)
    setMsgOk(null)
    setError(null)
    void cargarHub().then((h) => setHub(h ?? null)).catch(() => {})
  }

  if (error && vista === "hub" && !hub) {
    return (
      <Shell>
        <CenterMsg color="#ef4444" title={`⚠ ${error}`} subtitle="Solicita un enlace nuevo al equipo administrativo." />
      </Shell>
    )
  }

  if (!hub) {
    return (
      <Shell>
        <CenterMsg title="Cargando…" />
      </Shell>
    )
  }

  if (vista === "ok") {
    const mensajes: Record<string, string> = {
      en_camino: "¡En camino registrado!",
      completado: "¡Trabajo completado!",
      necesita_repuesto: "¡Notificación enviada!",
    }
    return (
      <Shell>
        <CenterMsg
          emoji="✅"
          title={accionOk ? mensajes[accionOk] : msgOk ?? "¡Registrado!"}
          subtitle="El sistema actualizó la solicitud."
        />
        <button type="button" onClick={volverAlHub} style={btnOutline}>
          Volver a mis tareas
        </button>
      </Shell>
    )
  }

  if (vista === "oc" && detalle) {
    return (
      <Shell>
        <BackBtn onClick={() => setVista("detalle")} label="Volver al detalle" />
        <h1 style={h1}>Solicitud de compra</h1>
        <p style={sub}>{detalle.consecutivo}</p>

        <form onSubmit={(e) => void enviarOC(e)} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label="Descripción *">
            <textarea
              rows={3}
              value={ocDesc}
              onChange={(e) => setOcDesc(e.target.value)}
              required
              style={input}
            />
          </Field>
          <Field label="Categoría">
            <input type="text" value={ocCat} onChange={(e) => setOcCat(e.target.value)} style={input} />
          </Field>
          <Field label="Prioridad">
            <select value={ocPrioridad} onChange={(e) => setOcPrioridad(e.target.value)} style={input}>
              <option value="Alta">Alta</option>
              <option value="Media">Media</option>
              <option value="Baja">Baja</option>
            </select>
          </Field>
          <Field label="Observaciones">
            <textarea rows={2} value={ocObs} onChange={(e) => setOcObs(e.target.value)} style={input} />
          </Field>
          {error && <p style={{ color: "#ef4444", fontSize: 13, margin: 0 }}>{error}</p>}
          <button type="submit" disabled={busy} style={btnStyle("#d97706")}>
            {busy ? "Enviando…" : "Crear solicitud de compra"}
          </button>
        </form>
      </Shell>
    )
  }

  if (vista === "detalle") {
    if (!detalle) {
      return (
        <Shell>
          <BackBtn onClick={volverAlHub} label="Mis tareas" />
          <CenterMsg title="Cargando detalle…" />
        </Shell>
      )
    }

    const activa = !["completado", "cancelado", "cerrado"].includes(detalle.estado)
    const puedeEnCamino = activa && ["solicitud", "programado"].includes(detalle.estado)
    const puedeCompletar = activa && detalle.estado === "ejecucion"

    return (
      <Shell>
        <BackBtn onClick={volverAlHub} label="Mis tareas" />
        <TarjetaDetalle sol={detalle} />

        {detalle.ocs.length > 0 && (
          <section style={{ marginBottom: 20 }}>
            <p style={sectionTitle}>Compras vinculadas</p>
            {detalle.ocs.map((oc) => (
              <div key={oc.id} style={ocCard}>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "#94a3b8" }}>
                  {oc.consecutivo_os}
                </span>
                <p style={{ margin: "4px 0", fontSize: 14 }}>{oc.descripcion}</p>
                <span style={{ fontSize: 11, color: "#64748b" }}>{oc.estado} · {oc.nivel_prioridad}</span>
              </div>
            ))}
          </section>
        )}

        {error && <p style={{ color: "#ef4444", fontSize: 13, marginBottom: 12 }}>{error}</p>}

        {activa && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {puedeEnCamino && (
              <button type="button" disabled={busy} onClick={() => void ejecutarAccion("en_camino")} style={btnStyle("#2563eb")}>
                ▶ VOY EN CAMINO
              </button>
            )}
            {puedeCompletar && (
              <button type="button" disabled={busy} onClick={completarConFoto} style={btnStyle("#16a34a")}>
                ✓ TERMINÉ — SUBIR FOTO
              </button>
            )}
            <button type="button" disabled={busy} onClick={abrirOC} style={btnStyle("#d97706")}>
              🛒 SOLICITAR COMPRA / REPUESTO
            </button>
          </div>
        )}

        {!activa && (
          <p style={{ textAlign: "center", color: "#64748b", fontSize: 14 }}>
            Esta solicitud está finalizada.
          </p>
        )}
      </Shell>
    )
  }

  // Hub
  return (
    <Shell>
      <header style={{ marginBottom: 24 }}>
        <p style={{ color: "#64748b", fontSize: 12, margin: 0, textTransform: "uppercase", letterSpacing: 1 }}>
          Mantenimiento móvil
        </p>
        <h1 style={{ ...h1, marginTop: 4 }}>
          {hub.auxiliar_nombre ? `Hola, ${hub.auxiliar_nombre.split(" ")[0]}` : "Mis tareas"}
        </h1>
        <p style={sub}>{hub.activas.length} activa(s)</p>
      </header>

      {hub.activas.length === 0 ? (
        <CenterMsg
          emoji="📋"
          title="Sin tareas activas"
          subtitle="Cuando te asignen mantenimientos aparecerán aquí."
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {hub.activas.map((item) => (
            <button
              key={item.solicitud_id}
              type="button"
              onClick={() => abrirDetalle(item)}
              style={taskCard(item.solicitud_id === hub.ancla_id)}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#64748b" }}>
                  {item.consecutivo}
                </span>
                <EstadoPill estado={item.estado} />
              </div>
              <p style={{ margin: "6px 0 0", fontSize: 15, fontWeight: 600, textAlign: "left" }}>
                {item.titulo}
              </p>
              {item.fecha_programada && (
                <p style={{ margin: "4px 0 0", fontSize: 11, color: "#64748b", textAlign: "left" }}>
                  Programado: {new Date(item.fecha_programada).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" })}
                </p>
              )}
            </button>
          ))}
        </div>
      )}

      {hub.recientes.length > 0 && (
        <section style={{ marginTop: 28 }}>
          <p style={sectionTitle}>Recientes</p>
          {hub.recientes.map((item) => (
            <button
              key={item.solicitud_id}
              type="button"
              onClick={() => abrirDetalle(item)}
              style={{ ...taskCard(false), opacity: 0.7, marginBottom: 8 }}
            >
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#64748b" }}>
                {item.consecutivo}
              </span>
              <p style={{ margin: "4px 0 0", fontSize: 13, textAlign: "left" }}>{item.titulo}</p>
            </button>
          ))}
        </section>
      )}

      <p style={{ color: "#334155", fontSize: 11, textAlign: "center", marginTop: 32 }}>
        ZYMO Intranet — Mantenimiento
      </p>
    </Shell>
  )
}

function TarjetaDetalle({ sol }: { sol: MobileDetalleOut }) {
  return (
    <div style={{ ...card, marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "#64748b" }}>
          {sol.consecutivo}
        </span>
        <EstadoPill estado={sol.estado} />
      </div>
      <h2 style={{ fontSize: 18, margin: "0 0 8px", fontWeight: 700 }}>{sol.titulo}</h2>
      <p style={{ color: "#94a3b8", fontSize: 14, margin: 0 }}>{sol.descripcion}</p>
      <div style={{ marginTop: 12, fontSize: 12, color: "#64748b", display: "flex", flexDirection: "column", gap: 4 }}>
        {sol.solicitante_nombre && <span>Solicitó: {sol.solicitante_nombre}</span>}
        <span>Tipo: {sol.tipo_mantenimiento}</span>
        {sol.fecha_programada && (
          <span>Programado: {new Date(sol.fecha_programada).toLocaleString("es-CO")}</span>
        )}
        {sol.monto_estimado != null && (
          <span style={{ fontFamily: "'DM Mono', monospace" }}>
            Monto est.: ${sol.monto_estimado.toLocaleString("es-CO")}
          </span>
        )}
      </div>
    </div>
  )
}

function EstadoPill({ estado }: { estado: string }) {
  const color = ESTADO_COLOR[estado] ?? "#64748b"
  return (
    <span style={{
      background: `${color}22`,
      color,
      fontSize: 10,
      fontWeight: 700,
      padding: "2px 8px",
      borderRadius: 999,
      textTransform: "uppercase",
    }}>
      {ESTADO_LABEL[estado] ?? estado}
    </span>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: "'DM Sans', sans-serif",
      maxWidth: 480,
      margin: "0 auto",
      padding: 24,
      background: "#0f172a",
      minHeight: "100vh",
      color: "#f1f5f9",
      boxSizing: "border-box",
    }}>
      {children}
    </div>
  )
}

function CenterMsg({ emoji, title, subtitle, color }: { emoji?: string; title: string; subtitle?: string; color?: string }) {
  return (
    <div style={{ textAlign: "center", padding: "32px 0" }}>
      {emoji && <div style={{ fontSize: 56, marginBottom: 12 }}>{emoji}</div>}
      <p style={{ color: color ?? "#f1f5f9", fontSize: 18, fontWeight: 600, margin: "0 0 8px" }}>{title}</p>
      {subtitle && <p style={{ color: "#64748b", fontSize: 14, margin: 0 }}>{subtitle}</p>}
    </div>
  )
}

function BackBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} style={{
      background: "none", border: "none", color: "#94a3b8", fontSize: 13,
      padding: 0, marginBottom: 16, cursor: "pointer",
    }}>
      ← {label}
    </button>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  )
}

const h1: React.CSSProperties = { fontSize: 22, fontWeight: 700, margin: 0 }
const sub: React.CSSProperties = { color: "#64748b", fontSize: 13, margin: "4px 0 0" }
const sectionTitle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: "#64748b",
  textTransform: "uppercase", letterSpacing: 1, marginBottom: 10,
}
const card: React.CSSProperties = {
  background: "#1e293b", borderRadius: 12, padding: 20,
}
const ocCard: React.CSSProperties = {
  background: "#1e293b", borderRadius: 10, padding: 12, marginBottom: 8,
}
const input: React.CSSProperties = {
  width: "100%", borderRadius: 8, border: "1px solid #334155",
  background: "#0f172a", color: "#f1f5f9", padding: "10px 12px",
  fontSize: 14, fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box",
}

function taskCard(destacada: boolean): React.CSSProperties {
  return {
    background: destacada ? "#1e3a5f" : "#1e293b",
    border: destacada ? "1px solid #2563eb44" : "1px solid #334155",
    borderRadius: 12,
    padding: 16,
    cursor: "pointer",
    color: "#f1f5f9",
    textAlign: "left",
    width: "100%",
  }
}

function btnStyle(bg: string): React.CSSProperties {
  return {
    background: bg, color: "#fff", border: "none", borderRadius: 12,
    padding: "18px 20px", fontSize: 16, fontWeight: 700,
    fontFamily: "'DM Sans', sans-serif", cursor: "pointer", width: "100%",
  }
}

const btnOutline: React.CSSProperties = {
  ...btnStyle("transparent"),
  border: "1px solid #334155",
  color: "#94a3b8",
  marginTop: 16,
}
