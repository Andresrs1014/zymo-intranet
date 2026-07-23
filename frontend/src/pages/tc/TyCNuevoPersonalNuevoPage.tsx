import { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { api } from "@/lib/api"
import { useSedes } from "@/hooks/useSedes"
import { PageLayout } from "@/components/layout/PageLayout"
import {
  ArrowLeft, ArrowRight, Search, Plus, X, UserPlus, Clock, Loader2, Check,
} from "lucide-react"

interface PersonaOpt { id: number; nombre: string; cargo_nombre?: string; empresa_nombre?: string }
interface BloqueDraft { lider_id: number; lider_nombre: string; hora_inicio: string; hora_fin: string }

const PASOS = ["Personas a capacitar", "Líderes y horario", "Confirmar"]

export function TyCNuevoPersonalNuevoPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const fechaInicial = searchParams.get("fecha") || new Date().toISOString().slice(0, 10)

  const [paso, setPaso] = useState(0)
  const [fecha, setFecha] = useState(fechaInicial)
  const [titulo, setTitulo] = useState("Capacitación nuevo personal")
  const [descripcion, setDescripcion] = useState("")
  const [personas, setPersonas] = useState<PersonaOpt[]>([])
  const [bloques, setBloques] = useState<BloqueDraft[]>([])
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState("")

  function toggleBloqueLider(p: PersonaOpt) {
    setBloques((prev) => {
      const existe = prev.find((b) => b.lider_id === p.id)
      if (existe) return prev.filter((b) => b.lider_id !== p.id)
      return [...prev, { lider_id: p.id, lider_nombre: p.nombre, hora_inicio: "08:00", hora_fin: "09:00" }]
    })
  }

  async function enviar() {
    setEnviando(true)
    setError("")
    try {
      const r = await api.post("/tc/cap-coordinador/dias", {
        fecha,
        titulo,
        descripcion,
        persona_ids: personas.map((p) => p.id),
        bloques: bloques.map((b) => ({
          lider_persona_id: b.lider_id,
          hora_inicio: b.hora_inicio,
          hora_fin: b.hora_fin,
        })),
      })
      navigate(`/tc/nuevo-personal/${r.data.id}`)
    } catch {
      setError("No se pudo crear la capacitación. Revisa los datos e intenta de nuevo.")
      setEnviando(false)
    }
  }

  return (
    <PageLayout title="Nueva capacitación — Nuevo personal" mainClassName="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        <button
          onClick={() => navigate("/tc/nuevo-personal")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Calendario
        </button>

        {/* Pasos */}
        <div className="flex items-center gap-2">
          {PASOS.map((p, i) => (
            <div key={p} className="flex items-center gap-2 flex-1">
              <div className={`flex items-center gap-2 flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                i === paso ? "bg-teal-500/15 text-teal-400" : i < paso ? "text-emerald-400" : "text-muted-foreground"
              }`}>
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] ${
                  i === paso ? "bg-teal-500/25" : i < paso ? "bg-emerald-500/20" : "bg-muted/20"
                }`}>
                  {i < paso ? <Check className="w-3 h-3" /> : i + 1}
                </span>
                {p}
              </div>
              {i < PASOS.length - 1 && <div className="h-px flex-1 bg-border/60" />}
            </div>
          ))}
        </div>

        {error && <p className="text-sm text-destructive bg-destructive/10 rounded-xl px-4 py-3">{error}</p>}

        {paso === 0 && (
          <PasoPersonas
            fecha={fecha} setFecha={setFecha}
            titulo={titulo} setTitulo={setTitulo}
            descripcion={descripcion} setDescripcion={setDescripcion}
            personas={personas} setPersonas={setPersonas}
            onNext={() => setPaso(1)}
          />
        )}
        {paso === 1 && (
          <PasoLideres
            bloques={bloques} setBloques={setBloques}
            onToggleLider={toggleBloqueLider}
            onBack={() => setPaso(0)}
            onNext={() => setPaso(2)}
          />
        )}
        {paso === 2 && (
          <PasoConfirmar
            fecha={fecha} titulo={titulo} descripcion={descripcion}
            personas={personas} bloques={bloques}
            enviando={enviando}
            onBack={() => setPaso(1)}
            onConfirmar={enviar}
          />
        )}
      </div>
    </PageLayout>
  )
}

// ── Paso 1 — Personas a capacitar ────────────────────────────────────────────

function PasoPersonas({
  fecha, setFecha, titulo, setTitulo, descripcion, setDescripcion, personas, setPersonas, onNext,
}: {
  fecha: string; setFecha: (v: string) => void
  titulo: string; setTitulo: (v: string) => void
  descripcion: string; setDescripcion: (v: string) => void
  personas: PersonaOpt[]; setPersonas: (v: PersonaOpt[]) => void
  onNext: () => void
}) {
  const [q, setQ] = useState("")
  const [resultados, setResultados] = useState<PersonaOpt[]>([])
  const [buscando, setBuscando] = useState(false)
  const [crearAbierto, setCrearAbierto] = useState(false)

  useEffect(() => {
    if (q.trim().length < 2) { setResultados([]); return }
    setBuscando(true)
    const t = setTimeout(() => {
      api.get("/tc/personas", { params: { q, estado: "Activo", limit: 20 } })
        .then((r) => setResultados(r.data.items ?? []))
        .catch(() => setResultados([]))
        .finally(() => setBuscando(false))
    }, 300)
    return () => clearTimeout(t)
  }, [q])

  function agregar(p: PersonaOpt) {
    if (personas.some((x) => x.id === p.id)) return
    setPersonas([...personas, p])
    setQ("")
    setResultados([])
  }

  function quitar(id: number) {
    setPersonas(personas.filter((p) => p.id !== id))
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-muted/5 p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">Fecha</label>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="input-base" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">Título</label>
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className="input-base" />
          </div>
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">Descripción (opcional)</label>
          <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2} className="input-base" />
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-muted/5 p-5 space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Personas a capacitar</p>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar persona ya creada por nombre o documento…"
            className="input-base pl-8"
          />
          {buscando && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-muted-foreground" />}
        </div>

        {resultados.length > 0 && (
          <div className="space-y-1 max-h-48 overflow-y-auto border border-border rounded-lg p-1.5">
            {resultados.map((p) => (
              <button
                key={p.id}
                onClick={() => agregar(p)}
                className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-muted/10 text-left transition-colors"
              >
                <Plus className="w-3 h-3 text-teal-400 shrink-0" />
                <span className="text-xs font-medium">{p.nombre}</span>
                <span className="text-[10px] text-muted-foreground">{p.cargo_nombre} · {p.empresa_nombre}</span>
              </button>
            ))}
          </div>
        )}

        <button
          onClick={() => setCrearAbierto((v) => !v)}
          className="flex items-center gap-1.5 text-xs font-semibold text-teal-400 hover:text-teal-300 transition-colors"
        >
          <UserPlus className="w-3.5 h-3.5" />
          Crear persona nueva (ingreso)
        </button>
        {crearAbierto && (
          <CrearPersonaMini
            onCreada={(p) => { agregar(p); setCrearAbierto(false) }}
            onCancelar={() => setCrearAbierto(false)}
          />
        )}

        {personas.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border">
            {personas.map((p) => (
              <span key={p.id} className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-teal-500/30 bg-teal-500/10 text-teal-400">
                {p.nombre}
                <button onClick={() => quitar(p.id)} aria-label={`Quitar a ${p.nombre}`}>
                  <X className="w-3 h-3 hover:text-rose-400" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <button
          onClick={onNext}
          disabled={personas.length === 0 || !fecha || !titulo}
          className="flex items-center gap-1.5 h-9 px-4 text-sm font-medium rounded-xl bg-teal-500/15 hover:bg-teal-500/25 text-teal-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Siguiente: Líderes
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <style>{`
        .input-base {
          width: 100%; height: 2.25rem; padding: 0 0.75rem; border-radius: 0.5rem;
          border: 1px solid hsl(var(--border)); background: hsl(var(--background) / 0.6); font-size: 0.8125rem;
        }
        textarea.input-base { height: auto; padding: 0.5rem 0.75rem; }
        .input-base:focus { outline: none; box-shadow: 0 0 0 1px hsl(var(--ring)); }
      `}</style>
    </div>
  )
}

function CrearPersonaMini({ onCreada, onCancelar }: { onCreada: (p: PersonaOpt) => void; onCancelar: () => void }) {
  const { data: sedes = [] } = useSedes()
  const [nombre, setNombre] = useState("")
  const [documento, setDocumento] = useState("")
  const [empresaId, setEmpresaId] = useState<string>("")
  const [creando, setCreando] = useState(false)
  const [error, setError] = useState("")

  async function crear() {
    if (!nombre.trim() || !empresaId) { setError("Nombre y empresa son obligatorios."); return }
    setCreando(true)
    setError("")
    try {
      const r = await api.post("/tc/personas", { nombre: nombre.trim(), documento, empresa_id: Number(empresaId) })
      onCreada({ id: r.data.id, nombre: r.data.nombre })
    } catch {
      setError("No se pudo crear la persona.")
    } finally {
      setCreando(false)
    }
  }

  return (
    <div className="rounded-xl border border-teal-500/20 bg-teal-500/5 p-3 space-y-2">
      <p className="text-[10px] text-muted-foreground">
        Alta mínima — el resto (cargo, área, foto) se completa después desde el Directorio.
      </p>
      <div className="grid grid-cols-3 gap-2">
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre completo" className="input-base col-span-1" />
        <input value={documento} onChange={(e) => setDocumento(e.target.value)} placeholder="Documento (opcional)" className="input-base col-span-1" />
        <select value={empresaId} onChange={(e) => setEmpresaId(e.target.value)} className="input-base col-span-1">
          <option value="">Empresa…</option>
          {sedes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      {error && <p className="text-[10px] text-destructive">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={crear}
          disabled={creando}
          className="h-8 px-3 text-xs font-semibold rounded-lg bg-teal-500 text-white hover:bg-teal-600 transition-colors disabled:opacity-50"
        >
          {creando ? "Creando…" : "Crear y agregar"}
        </button>
        <button onClick={onCancelar} className="h-8 px-3 text-xs rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors">
          Cancelar
        </button>
      </div>
    </div>
  )
}

// ── Paso 2 — Líderes y horario ───────────────────────────────────────────────

function PasoLideres({
  bloques, setBloques, onToggleLider, onBack, onNext,
}: {
  bloques: BloqueDraft[]; setBloques: (v: BloqueDraft[]) => void
  onToggleLider: (p: PersonaOpt) => void
  onBack: () => void; onNext: () => void
}) {
  const [q, setQ] = useState("")
  const [resultados, setResultados] = useState<PersonaOpt[]>([])
  const [recientes, setRecientes] = useState<PersonaOpt[]>([])

  useEffect(() => {
    api.get("/tc/cap-coordinador/lideres-recientes").then((r) => setRecientes(r.data)).catch(() => {})
  }, [])

  useEffect(() => {
    if (q.trim().length < 2) { setResultados([]); return }
    const t = setTimeout(() => {
      api.get("/tc/personas", { params: { q, estado: "Activo", limit: 20 } })
        .then((r) => setResultados(r.data.items ?? []))
        .catch(() => setResultados([]))
    }, 300)
    return () => clearTimeout(t)
  }, [q])

  function actualizarHorario(liderId: number, campo: "hora_inicio" | "hora_fin", valor: string) {
    setBloques(bloques.map((b) => (b.lider_id === liderId ? { ...b, [campo]: valor } : b)))
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-muted/5 p-5 space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Elegir líderes</p>

        {recientes.length > 0 && (
          <div>
            <p className="text-[10px] text-muted-foreground mb-1.5">Usados antes:</p>
            <div className="flex flex-wrap gap-1.5">
              {recientes.map((p) => {
                const activo = bloques.some((b) => b.lider_id === p.id)
                return (
                  <button
                    key={p.id}
                    onClick={() => onToggleLider(p)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      activo ? "border-teal-500/50 bg-teal-500/15 text-teal-400" : "border-border bg-background/60 text-foreground/80 hover:border-teal-500/40"
                    }`}
                  >
                    {p.nombre}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar otro líder por nombre…"
            className="input-base pl-8"
          />
        </div>
        {resultados.length > 0 && (
          <div className="space-y-1 max-h-40 overflow-y-auto border border-border rounded-lg p-1.5">
            {resultados.map((p) => (
              <button
                key={p.id}
                onClick={() => { onToggleLider(p); setQ(""); setResultados([]) }}
                className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-muted/10 text-left transition-colors"
              >
                <Plus className="w-3 h-3 text-teal-400 shrink-0" />
                <span className="text-xs font-medium">{p.nombre}</span>
                <span className="text-[10px] text-muted-foreground">{p.cargo_nombre}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {bloques.length > 0 && (
        <div className="rounded-2xl border border-border bg-muted/5 p-5 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
            Horario del día — cada líder con su franja
          </p>
          {bloques.map((b) => (
            <div key={b.lider_id} className="flex items-center gap-3 p-2.5 rounded-lg bg-background/40 border border-border">
              <span className="flex-1 min-w-0 text-sm font-medium truncate">{b.lider_nombre}</span>
              <div className="flex items-center gap-1.5 shrink-0">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="time"
                  value={b.hora_inicio}
                  onChange={(e) => actualizarHorario(b.lider_id, "hora_inicio", e.target.value)}
                  className="input-base w-24"
                />
                <span className="text-xs text-muted-foreground">–</span>
                <input
                  type="time"
                  value={b.hora_fin}
                  onChange={(e) => actualizarHorario(b.lider_id, "hora_fin", e.target.value)}
                  className="input-base w-24"
                />
              </div>
              <button
                onClick={() => setBloques(bloques.filter((x) => x.lider_id !== b.lider_id))}
                aria-label={`Quitar a ${b.lider_nombre}`}
                className="text-muted-foreground/50 hover:text-rose-400 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-between">
        <button onClick={onBack} className="flex items-center gap-1.5 h-9 px-4 text-sm rounded-xl border border-border text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          Atrás
        </button>
        <button
          onClick={onNext}
          disabled={bloques.length === 0}
          className="flex items-center gap-1.5 h-9 px-4 text-sm font-medium rounded-xl bg-teal-500/15 hover:bg-teal-500/25 text-teal-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Siguiente: Confirmar
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <style>{`
        .input-base {
          height: 2.25rem; padding: 0 0.75rem; border-radius: 0.5rem;
          border: 1px solid hsl(var(--border)); background: hsl(var(--background) / 0.6); font-size: 0.8125rem;
        }
        .input-base:focus { outline: none; box-shadow: 0 0 0 1px hsl(var(--ring)); }
      `}</style>
    </div>
  )
}

// ── Paso 3 — Confirmar ───────────────────────────────────────────────────────

function PasoConfirmar({
  fecha, titulo, descripcion, personas, bloques, enviando, onBack, onConfirmar,
}: {
  fecha: string; titulo: string; descripcion: string
  personas: PersonaOpt[]; bloques: BloqueDraft[]
  enviando: boolean
  onBack: () => void; onConfirmar: () => void
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-muted/5 p-5 space-y-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Fecha</p>
          <p className="text-sm font-semibold mt-0.5">{fecha}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{titulo}</p>
          {descripcion && <p className="text-xs text-muted-foreground mt-1">{descripcion}</p>}
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
            {personas.length} persona{personas.length !== 1 ? "s" : ""} a capacitar
          </p>
          <div className="flex flex-wrap gap-1.5">
            {personas.map((p) => (
              <span key={p.id} className="text-[11px] px-2 py-0.5 rounded-full border border-border bg-background/60 text-foreground/80">
                {p.nombre}
              </span>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
            {bloques.length} bloque{bloques.length !== 1 ? "s" : ""} — todas las personas incluidas por default en cada uno
          </p>
          <div className="space-y-1.5">
            {bloques.map((b) => (
              <div key={b.lider_id} className="flex items-center justify-between text-xs rounded-lg bg-background/40 border border-border px-3 py-2">
                <span className="font-medium">{b.lider_nombre}</span>
                <span className="text-muted-foreground">{b.hora_inicio} – {b.hora_fin}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-between">
        <button onClick={onBack} disabled={enviando} className="flex items-center gap-1.5 h-9 px-4 text-sm rounded-xl border border-border text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40">
          <ArrowLeft className="w-3.5 h-3.5" />
          Atrás
        </button>
        <button
          onClick={onConfirmar}
          disabled={enviando}
          className="flex items-center gap-1.5 h-9 px-5 text-sm font-medium rounded-xl bg-teal-500 text-white hover:bg-teal-600 transition-colors disabled:opacity-50"
        >
          {enviando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          {enviando ? "Creando…" : "Crear capacitación"}
        </button>
      </div>
    </div>
  )
}
