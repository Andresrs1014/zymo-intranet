import { useEffect, useMemo, useState } from "react"
import { PageLayout } from "@/components/layout/PageLayout"
import { api } from "@/lib/api"
import {
  rubricaDe, resultadoDe, RESULTADO_COLOR, NIVELES_DESEMPENO,
  type RubricaCategoria,
} from "@/lib/evaluacionDesempenoRubricas"
import { Search, ClipboardCheck, Loader2, X, User, RotateCcw } from "lucide-react"

interface PersonaLista {
  id: number
  nombre: string
  documento: string
  empresa_nombre: string
  area_nombre: string
  cargo_nombre: string
}

interface PersonaDetalle {
  id: number
  nombre: string
  cargo_nombre: string
  area_nombre: string
  empresa_nombre: string
  firma_url: string
  tipo: "operativo" | "lideres"
}

const PERIODOS = ["1er semestre", "2do semestre"] as const

export function TyCEvaluacionDesempenoPage() {
  const [personas, setPersonas] = useState<PersonaLista[]>([])
  const [busqueda, setBusqueda] = useState("")
  const [persona, setPersona] = useState<PersonaDetalle | null>(null)
  const [cargandoPersona, setCargandoPersona] = useState(false)

  const [periodo, setPeriodo] = useState<(typeof PERIODOS)[number]>(PERIODOS[0])
  const [anio, setAnio] = useState(new Date().getFullYear())
  const [respuestas, setRespuestas] = useState<Record<string, number>>({})
  const [accionMejora, setAccionMejora] = useState("")
  const [observacionesLider, setObservacionesLider] = useState("")
  const [observacionesLiderado, setObservacionesLiderado] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState("")
  const [enviado, setEnviado] = useState(false)

  useEffect(() => {
    api.get("/tc/evaluaciones-desempeno/personas-lista")
      .then((r) => setPersonas(Array.isArray(r.data) ? r.data : []))
      .catch(() => {})
  }, [])

  const resultados = useMemo(() => {
    if (!busqueda.trim() || persona) return []
    const q = busqueda.trim().toLowerCase()
    return personas.filter((p) =>
      p.nombre.toLowerCase().includes(q) || p.documento.includes(q)
    ).slice(0, 8)
  }, [busqueda, personas, persona])

  async function seleccionar(p: PersonaLista) {
    setBusqueda(p.nombre)
    setCargandoPersona(true)
    setError("")
    try {
      const { data } = await api.get(`/tc/evaluaciones-desempeno/persona/${p.id}`)
      setPersona(data)
    } catch {
      setError("No se pudo cargar el perfil de esta persona.")
    } finally {
      setCargandoPersona(false)
    }
  }

  function reiniciar() {
    setPersona(null)
    setBusqueda("")
    setRespuestas({})
    setAccionMejora("")
    setObservacionesLider("")
    setObservacionesLiderado("")
    setEnviado(false)
    setError("")
  }

  const rubrica: RubricaCategoria[] = persona ? rubricaDe(persona.tipo) : []

  function key(catIdx: number, itemIdx: number) { return `${catIdx}.${itemIdx}` }

  function calificar(catIdx: number, itemIdx: number, valor: number) {
    setRespuestas((prev) => ({ ...prev, [key(catIdx, itemIdx)]: valor }))
  }

  const categoriasCalculo = rubrica.map((cat, catIdx) => {
    const valores = cat.items.map((_, itemIdx) => respuestas[key(catIdx, itemIdx)]).filter((v): v is number => v != null)
    const completa = valores.length === cat.items.length && cat.items.length > 0
    const puntaje = completa ? valores.reduce((a, b) => a + b, 0) / valores.length : null
    const total = puntaje != null ? puntaje * cat.peso : null
    return { ...cat, puntaje, total, completa }
  })

  const todasCompletas = categoriasCalculo.length > 0 && categoriasCalculo.every((c) => c.completa)
  const puntajeTotal = todasCompletas ? categoriasCalculo.reduce((a, c) => a + (c.total ?? 0), 0) : null
  const resultado = puntajeTotal != null ? resultadoDe(puntajeTotal) : null
  const requiereAccionMejora = resultado != null && resultado !== "Sobresaliente" && resultado !== "Satisfactorio"

  const puedeEnviar = !!persona
    && todasCompletas
    && observacionesLider.trim().length > 0
    && observacionesLiderado.trim().length > 0
    && (!requiereAccionMejora || accionMejora.trim().length > 0)
    && !enviando

  async function enviar() {
    if (!persona || !puedeEnviar) return
    setEnviando(true)
    setError("")
    try {
      await api.post("/tc/evaluaciones-desempeno", {
        persona_id: persona.id,
        tipo: persona.tipo,
        periodo,
        anio,
        categorias: rubrica.map((cat, catIdx) => ({
          nombre: cat.nombre,
          peso: cat.peso,
          items: cat.items.map((it, itemIdx) => ({ texto: it.texto, valor: respuestas[key(catIdx, itemIdx)] })),
        })),
        accion_mejora: accionMejora,
        observaciones_lider: observacionesLider,
        observaciones_liderado: observacionesLiderado,
      })
      setEnviado(true)
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(detail || "No se pudo enviar la evaluación.")
    } finally {
      setEnviando(false)
    }
  }

  return (
    <PageLayout title="Evaluación de desempeño" mainClassName="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 sm:px-8 py-6 sm:py-10">
        <div className="rounded-2xl border border-border bg-muted/5 overflow-hidden">
          <div className="bg-teal-600 px-5 sm:px-8 py-5 text-white">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] opacity-80">Gestión del Talento Humano</p>
            <h1 className="text-xl font-bold mt-0.5">Evaluación de desempeño</h1>
            <p className="text-xs opacity-80 mt-0.5">Rúbrica semestral — la competencia correcta (Líderes u Operativo) se resuelve sola según a quién evalúas.</p>
          </div>

          <div className="p-5 sm:p-6 lg:p-8 space-y-6">
            {/* Buscar persona */}
            {!persona && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">¿A quién vas a evaluar?</p>
                <div className="relative sm:max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    className="input-base pl-9"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Buscar por nombre o documento…"
                  />
                  {cargandoPersona && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
                </div>
                {resultados.length > 0 && (
                  <div className="sm:max-w-md mt-2 space-y-1 border border-border rounded-xl p-2 max-h-64 overflow-y-auto">
                    {resultados.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => seleccionar(p)}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted/40 transition-colors"
                      >
                        <p className="text-sm font-medium">{p.nombre}</p>
                        <p className="text-xs text-muted-foreground">{p.cargo_nombre || "Sin cargo"} · {p.empresa_nombre}</p>
                      </button>
                    ))}
                  </div>
                )}
                {error && <p className="text-xs text-destructive mt-2">{error}</p>}
              </div>
            )}

            {persona && !enviado && (
              <>
                {/* Persona seleccionada */}
                <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-500/10 text-teal-400 shrink-0">
                      <User className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold leading-tight truncate">{persona.nombre}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{persona.cargo_nombre || "Sin cargo"} · {persona.empresa_nombre}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-500/15 text-teal-400 uppercase tracking-wide">
                      Rúbrica {persona.tipo === "lideres" ? "Líderes" : "Operativo"}
                    </span>
                    <button type="button" onClick={reiniciar} className="p-1.5 rounded-full hover:bg-muted/40 text-muted-foreground transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Periodo */}
                <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Periodo</p>
                    <select className="input-base" value={periodo} onChange={(e) => setPeriodo(e.target.value as typeof periodo)}>
                      {PERIODOS.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Año</p>
                    <input type="number" className="input-base" value={anio} onChange={(e) => setAnio(Number(e.target.value))} />
                  </div>
                </div>

                {/* Rúbrica */}
                <div className="space-y-5">
                  {categoriasCalculo.map((cat, catIdx) => (
                    <div key={cat.nombre} className="rounded-xl border border-border p-4">
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <p className="text-sm font-semibold">{cat.nombre}</p>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] font-bold text-muted-foreground">{Math.round(cat.peso * 100)}%</span>
                          {cat.puntaje != null && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-muted text-foreground tabular-nums">
                              {cat.puntaje.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="space-y-3">
                        {cat.items.map((item, itemIdx) => (
                          <div key={itemIdx} className="space-y-1.5">
                            <p className="text-xs text-muted-foreground leading-relaxed">{item.texto}</p>
                            <div className="flex flex-wrap gap-1.5">
                              {NIVELES_DESEMPENO.map((n) => (
                                <button
                                  key={n.valor}
                                  type="button"
                                  onClick={() => calificar(catIdx, itemIdx, n.valor)}
                                  title={n.nombre}
                                  className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                                    respuestas[key(catIdx, itemIdx)] === n.valor
                                      ? "border-teal-500/50 bg-teal-500/10 text-teal-400"
                                      : "border-border text-muted-foreground hover:border-teal-500/30"
                                  }`}
                                >
                                  {n.valor} · {n.nombre}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Resumen en vivo */}
                <div className="rounded-xl border border-border bg-muted/10 p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Puntaje total</p>
                    <p className="text-2xl font-bold tabular-nums mt-0.5">{puntajeTotal != null ? puntajeTotal.toFixed(2) : "—"} / 5</p>
                  </div>
                  {resultado && (
                    <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${RESULTADO_COLOR[resultado]}`}>
                      {resultado}
                    </span>
                  )}
                </div>

                {requiereAccionMejora && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                      Acción de mejora <span className="text-amber-500">— obligatoria con este resultado</span>
                    </p>
                    <textarea className="input-base" rows={2} value={accionMejora} onChange={(e) => setAccionMejora(e.target.value)} placeholder="Plan de acción y mejora" />
                  </div>
                )}

                {/* Retroalimentación */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Observaciones líder de proceso</p>
                    <textarea className="input-base" rows={3} value={observacionesLider} onChange={(e) => setObservacionesLider(e.target.value)} placeholder="Retroalimentación del líder hacia el liderado" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Observaciones del liderado</p>
                    <textarea className="input-base" rows={3} value={observacionesLiderado} onChange={(e) => setObservacionesLiderado(e.target.value)} placeholder="Retroalimentación del liderado hacia el líder" />
                  </div>
                </div>

                {/* Firmas — se traen del perfil de cada uno */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Firma líder</p>
                    <FirmaOAviso url={null} propia />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Firma liderado</p>
                    <FirmaOAviso url={persona.firma_url} nombre={persona.nombre} />
                  </div>
                </div>

                <div className="pt-2 border-t border-border/60">
                  {error && <p className="text-xs text-destructive mb-2">{error}</p>}
                  <button
                    type="button"
                    onClick={enviar}
                    disabled={!puedeEnviar}
                    className="w-full lg:w-auto lg:min-w-[16rem] lg:mx-auto flex items-center justify-center gap-2 rounded-xl bg-teal-600 text-white text-sm font-semibold py-3 px-6 hover:bg-teal-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardCheck className="w-4 h-4" />}
                    {enviando ? "Enviando…" : "Enviar evaluación"}
                  </button>
                  {!todasCompletas && <p className="text-[11px] text-muted-foreground text-center mt-2">Faltan ítems por calificar.</p>}
                </div>
              </>
            )}

            {enviado && persona && (
              <div className="text-center py-10 space-y-4">
                <p className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-500/10 text-emerald-500 text-sm font-semibold py-3">
                  <ClipboardCheck className="w-4 h-4" />
                  Enviado — quedó registrado en el perfil de {persona.nombre}
                </p>
                <button
                  type="button"
                  onClick={reiniciar}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-500/15 text-teal-400 text-xs font-semibold hover:bg-teal-500/25 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Evaluar a otra persona
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageLayout>
  )
}

function FirmaOAviso({ url, propia, nombre }: { url: string | null; propia?: boolean; nombre?: string }) {
  if (propia) {
    return <p className="text-xs text-muted-foreground">Se toma de tu propia firma registrada en T&C al enviar.</p>
  }
  if (url) {
    return <img src={url} alt={`Firma de ${nombre}`} className="h-16 rounded-lg border border-border bg-white px-3" />
  }
  return <p className="text-xs text-amber-500">{nombre} no tiene firma digital registrada — no se podrá enviar hasta que la agregue en su perfil.</p>
}
