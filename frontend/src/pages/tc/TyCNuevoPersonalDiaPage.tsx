import { useEffect, useState, useCallback } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { api, openAuthenticatedApiBlob } from "@/lib/api"
import { PageLayout } from "@/components/layout/PageLayout"
import {
  ArrowLeft, Clock, Users, Camera, Download, Upload, Flag, Lock,
  CheckCircle2, ChevronDown, ChevronUp, Loader2, Trash2,
} from "lucide-react"

interface BloquePersona { id: number; nombre: string; cargo_nombre: string; incluido: boolean; asistio: boolean | null }
type EstadoBloque = "Agendado" | "En curso" | "Finalizado"
interface Bloque {
  id: number
  lider_persona_id: number
  lider_nombre: string
  hora_inicio: string
  hora_fin: string
  estado: EstadoBloque
  foto_evidencia_url: string
  acta_firmada_url: string
  personas: BloquePersona[]
  total_incluidos: number
}
interface Dia {
  id: number
  fecha: string
  titulo: string
  descripcion: string
  bloques: Bloque[]
  total_personas: number
}

const ESTADO_ESTILO: Record<EstadoBloque, string> = {
  "Agendado":   "bg-teal-500/10 text-teal-400",
  "En curso":   "bg-amber-500/10 text-amber-400",
  "Finalizado": "bg-emerald-500/10 text-emerald-400",
}

export function TyCNuevoPersonalDiaPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [dia, setDia] = useState<Dia | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(() => {
    if (!id) return
    setLoading(true)
    api.get(`/tc/cap-coordinador/dias/${id}`)
      .then((r) => setDia(r.data))
      .catch(() => setError("No se pudo cargar la capacitación."))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => { load() }, [load])

  async function eliminarDia() {
    if (!dia) return
    if (!window.confirm(`¿Eliminar "${dia.titulo}"? Esto borra el día completo y todos sus bloques, no se puede deshacer.`)) return
    try {
      await api.delete(`/tc/cap-coordinador/dias/${dia.id}`)
      navigate("/tc/nuevo-personal")
    } catch {
      setError("No se pudo eliminar.")
    }
  }

  return (
    <PageLayout title={dia ? dia.titulo : "Capacitación nuevo personal"} mainClassName="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate("/tc/nuevo-personal")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Calendario
          </button>
          {dia && (
            <button
              onClick={eliminarDia}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-rose-400 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Eliminar día
            </button>
          )}
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Cargando…</span>
          </div>
        )}

        {error && <p className="text-sm text-destructive bg-destructive/10 rounded-xl px-4 py-3">{error}</p>}

        {!loading && dia && (
          <>
            <header className="rounded-2xl border border-border bg-muted/5 p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-teal-500 mb-1">
                {new Date(dia.fecha + "T00:00:00").toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" })}
              </p>
              <h1 className="text-xl font-bold">{dia.titulo}</h1>
              {dia.descripcion && <p className="text-sm text-muted-foreground mt-1">{dia.descripcion}</p>}
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2">
                <Users className="w-3.5 h-3.5" />
                {dia.total_personas} persona{dia.total_personas !== 1 ? "s" : ""} · {dia.bloques.length} bloque{dia.bloques.length !== 1 ? "s" : ""}
              </p>
            </header>

            <div className="space-y-3">
              {dia.bloques.map((b) => (
                <BloqueCard key={b.id} bloque={b} onChange={load} />
              ))}
            </div>
          </>
        )}
      </div>
    </PageLayout>
  )
}

// ── Card por bloque (líder + horario) ────────────────────────────────────────

function BloqueCard({ bloque: b, onChange }: { bloque: Bloque; onChange: () => void }) {
  const [abierto, setAbierto] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  async function toggleIncluido(personaId: number, incluido: boolean) {
    const nuevos = b.personas.filter((p) => (p.id === personaId ? incluido : p.incluido)).map((p) => p.id)
    setBusy(true)
    try {
      await api.put(`/tc/cap-coordinador/bloques/${b.id}/personas`, nuevos)
      onChange()
    } catch {
      setError("No se pudo actualizar el roster.")
    } finally { setBusy(false) }
  }

  async function finalizar() {
    if (!window.confirm(`¿Finalizar el bloque de ${b.lider_nombre}? Ya no se podrá editar el roster — solo confirmar asistencia y subir evidencia.`)) return
    setBusy(true)
    try {
      await api.post(`/tc/cap-coordinador/bloques/${b.id}/finalizar`)
      onChange()
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "No se pudo finalizar el bloque.")
    } finally { setBusy(false) }
  }

  async function marcarTodos() {
    setBusy(true)
    try {
      await api.post(`/tc/cap-coordinador/bloques/${b.id}/asistencia/marcar-todos`)
      onChange()
    } catch {
      setError("No se pudo marcar la asistencia.")
    } finally { setBusy(false) }
  }

  async function setAsistio(personaId: number, asistio: boolean) {
    await api.patch(`/tc/cap-coordinador/bloques/${b.id}/asistencia`, { persona_id: personaId, asistio })
    onChange()
  }

  async function subirFoto(file: File) {
    setBusy(true)
    const fd = new FormData()
    fd.append("file", file)
    try {
      await api.post(`/tc/cap-coordinador/bloques/${b.id}/foto-evidencia`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      onChange()
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "No se pudo subir la foto.")
    } finally { setBusy(false) }
  }

  async function subirActa(file: File) {
    setBusy(true)
    const fd = new FormData()
    fd.append("file", file)
    try {
      await api.post(`/tc/cap-coordinador/bloques/${b.id}/acta-firmada`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      onChange()
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "No se pudo subir el acta firmada.")
    } finally { setBusy(false) }
  }

  const incluidos = b.personas.filter((p) => p.incluido)
  const asistieron = incluidos.filter((p) => p.asistio === true).length

  return (
    <div className="rounded-2xl border border-border bg-muted/5 overflow-hidden">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/10 transition-colors"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-500/10 text-teal-400 text-xs font-bold">
          {b.hora_inicio.slice(0, 2)}h
        </span>
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-2">
            <span className="font-semibold text-sm">{b.lider_nombre}</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${ESTADO_ESTILO[b.estado]}`}>{b.estado}</span>
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
            <Clock className="w-3 h-3" />{b.hora_inicio} – {b.hora_fin}
            <span className="mx-1">·</span>
            <Users className="w-3 h-3" />{b.total_incluidos} incluida{b.total_incluidos !== 1 ? "s" : ""}
            {b.estado === "Finalizado" && <span className="ml-1">({asistieron} asistió{asistieron !== 1 ? "eron" : ""})</span>}
          </span>
        </span>
        {abierto ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
      </button>

      {abierto && (
        <div className="border-t border-border px-4 py-4 space-y-4">
          {error && <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>}

          {/* Roster — editable mientras Agendado/En curso */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Personas en este bloque</p>
              {b.estado === "En curso" && (
                <button
                  onClick={finalizar}
                  disabled={busy}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[11px] font-semibold transition-colors disabled:opacity-50"
                >
                  <Flag className="w-3 h-3" />
                  Finalizar bloque
                </button>
              )}
            </div>
            {b.estado !== "Finalizado" ? (
              <div className="space-y-1">
                {b.personas.map((p) => (
                  <label key={p.id} className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-muted/10 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={p.incluido}
                      disabled={busy}
                      onChange={(e) => toggleIncluido(p.id, e.target.checked)}
                      className="w-3.5 h-3.5 accent-teal-500"
                    />
                    <span className={`text-xs ${p.incluido ? "" : "text-muted-foreground line-through"}`}>{p.nombre}</span>
                    {p.cargo_nombre && <span className="text-[10px] text-muted-foreground">{p.cargo_nombre}</span>}
                  </label>
                ))}
              </div>
            ) : (
              <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Lock className="w-3 h-3" /> Ya finalizado — la lista de este bloque quedó cerrada.
              </p>
            )}
          </div>

          {/* Asistencia — solo si Finalizado */}
          {b.estado === "Finalizado" && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Asistencia</p>
                <button
                  onClick={marcarTodos}
                  disabled={busy}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border text-muted-foreground hover:text-foreground text-[11px] transition-colors disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3 h-3" />
                  Marcar todos
                </button>
              </div>
              <div className="space-y-1">
                {incluidos.map((p) => (
                  <label key={p.id} className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-muted/10 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={p.asistio === true}
                      onChange={(e) => setAsistio(p.id, e.target.checked)}
                      className="w-3.5 h-3.5 accent-emerald-500"
                    />
                    <span className="flex-1 text-xs">{p.nombre}</span>
                    <span className={`text-[10px] font-semibold ${p.asistio === null ? "text-muted-foreground" : p.asistio ? "text-emerald-400" : "text-rose-400"}`}>
                      {p.asistio === null ? "Pendiente" : p.asistio ? "Asistió" : "No asistió"}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Evidencia — solo si Finalizado */}
          {b.estado === "Finalizado" && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Evidencia</p>
              {b.foto_evidencia_url ? (
                <img src={b.foto_evidencia_url} alt="Evidencia" className="rounded-lg max-h-48 border border-border" />
              ) : (
                <label className="flex items-center gap-1.5 h-8 px-3 text-xs rounded-lg border border-dashed border-border text-muted-foreground hover:text-foreground cursor-pointer w-fit transition-colors">
                  <Camera className="w-3.5 h-3.5" />
                  Subir foto de evidencia
                  <input type="file" accept="image/*" className="hidden"
                    onChange={(e) => e.target.files?.[0] && subirFoto(e.target.files[0])} />
                </label>
              )}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openAuthenticatedApiBlob(`/tc/cap-coordinador/bloques/${b.id}/acta.pdf`)}
                  className="flex items-center gap-1.5 h-8 px-3 text-xs rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Descargar acta
                </button>
                {!b.foto_evidencia_url && (
                  <label className="flex items-center gap-1.5 h-8 px-3 text-xs rounded-lg border border-border text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                    {b.acta_firmada_url ? "Reemplazar acta firmada" : "Subir acta firmada"}
                    <input type="file" accept=".pdf,image/*" className="hidden"
                      onChange={(e) => e.target.files?.[0] && subirActa(e.target.files[0])} />
                  </label>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
