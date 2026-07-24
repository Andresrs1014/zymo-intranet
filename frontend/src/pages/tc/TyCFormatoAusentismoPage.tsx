import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "@/lib/api"
import { PageLayout } from "@/components/layout/PageLayout"
import { ArrowLeft, Building2, ClipboardCheck, Loader2, Search } from "lucide-react"

interface Plataforma {
  sede_id: number
  sede_nombre: string
  configurada: boolean
  nombre: string
  logo_url: string
}

interface PersonaEncontrada {
  id: number
  nombre: string
  cargo_nombre: string
  sede_id: number | null
  empresa_nombre: string
  firma_url: string
}

const TIPOS = ["Permiso", "Licencia remunerada", "Licencia no remunerada"] as const
type Tipo = (typeof TIPOS)[number]

export function TyCFormatoAusentismoPage() {
  const navigate = useNavigate()

  const [plataformas, setPlataformas] = useState<Plataforma[]>([])
  const [documento, setDocumento] = useState("")
  const [buscando, setBuscando] = useState(false)
  const [errorBusqueda, setErrorBusqueda] = useState("")
  const [persona, setPersona] = useState<PersonaEncontrada | null>(null)

  const [tipo, setTipo] = useState<Tipo>("Permiso")
  const [fechaInicio, setFechaInicio] = useState("")
  const [horaInicio, setHoraInicio] = useState("")
  const [fechaFin, setFechaFin] = useState("")
  const [horaFin, setHoraFin] = useState("")
  const [motivo, setMotivo] = useState("")
  const [reponeTiempo, setReponeTiempo] = useState<"Sí" | "No">("No")
  const [como, setComo] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [errorEnvio, setErrorEnvio] = useState("")
  const [enviado, setEnviado] = useState(false)

  useEffect(() => {
    api.get("/tc/plataformas")
      .then((r) => setPlataformas((Array.isArray(r.data) ? r.data : []).filter((p: Plataforma) => p.configurada)))
      .catch(() => {})
  }, [])

  async function buscarPorDocumento() {
    const doc = documento.trim()
    if (!doc) return
    setBuscando(true)
    setErrorBusqueda("")
    setPersona(null)
    try {
      const { data } = await api.get("/tc/formatos-api/persona-por-documento", { params: { documento: doc } })
      setPersona(data)
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setErrorBusqueda(detail || "No se pudo buscar la cédula.")
    } finally {
      setBuscando(false)
    }
  }

  const plataformaPersona = persona ? plataformas.find((p) => p.sede_id === persona.sede_id) : undefined

  const puedeEnviar = !!persona?.firma_url && !!fechaInicio && !!fechaFin && !enviando

  async function enviar() {
    if (!persona || !puedeEnviar) return
    setEnviando(true)
    setErrorEnvio("")
    try {
      await api.post("/tc/formatos-api/ausentismo", {
        documento: documento.trim(),
        tipo,
        fecha_inicio: fechaInicio,
        hora_inicio: horaInicio,
        fecha_fin: fechaFin,
        hora_fin: horaFin,
        motivo,
        repone_tiempo: reponeTiempo === "Sí",
        como,
      })
      setEnviado(true)
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setErrorEnvio(detail || "No se pudo enviar el formato.")
    } finally {
      setEnviando(false)
    }
  }

  return (
    <PageLayout title="Formato de Ausentismo" mainClassName="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-8 py-8">
        <button
          onClick={() => navigate("/tc/formatos")}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Formatos digitales
        </button>

        <div className="rounded-2xl border border-border bg-muted/5 overflow-hidden">
          {/* Banda corporativa */}
          <div className="bg-rose-600 px-6 py-5 text-white">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] opacity-80">Gestión del Talento Humano</p>
            <h1 className="text-xl font-bold mt-0.5">Formato de Ausentismo</h1>
            <p className="text-xs opacity-80 mt-0.5">Permisos, licencia remunerada y licencia no remunerada</p>
          </div>

          <div className="p-6 space-y-6">
            {/* Cédula */}
            <Seccion titulo="Cédula del solicitante">
              <div className="flex gap-2">
                <input
                  className="input-base"
                  value={documento}
                  onChange={(e) => setDocumento(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && buscarPorDocumento()}
                  placeholder="Número de documento"
                  inputMode="numeric"
                />
                <button
                  type="button"
                  onClick={buscarPorDocumento}
                  disabled={buscando || !documento.trim()}
                  className="flex items-center gap-1.5 px-4 rounded-lg bg-rose-500/15 text-rose-400 text-xs font-semibold hover:bg-rose-500/25 transition-colors disabled:opacity-40 shrink-0"
                >
                  {buscando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                  Buscar
                </button>
              </div>
              {errorBusqueda && <p className="text-xs text-destructive mt-2">{errorBusqueda}</p>}
            </Seccion>

            {persona && (
              <>
                {/* Datos del solicitante — resueltos por cédula, no editables */}
                <Seccion titulo="Datos del solicitante">
                  <div className="flex items-center gap-3 rounded-xl border border-border p-3">
                    <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-white shrink-0">
                      {plataformaPersona?.logo_url ? (
                        <img src={plataformaPersona.logo_url} alt={persona.empresa_nombre} className="h-[80%] w-[80%] object-contain" />
                      ) : (
                        <Building2 className="h-4 w-4 text-muted-foreground/40" />
                      )}
                    </span>
                    <div>
                      <p className="text-sm font-semibold leading-tight">{persona.nombre}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{persona.cargo_nombre || "Sin cargo"} · {persona.empresa_nombre}</p>
                    </div>
                  </div>
                </Seccion>

                {/* Tipo de solicitud */}
                <Seccion titulo="Tipo de solicitud">
                  <div className="grid grid-cols-3 gap-2">
                    {TIPOS.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTipo(t)}
                        className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                          tipo === t ? "border-rose-500/50 bg-rose-500/10 text-rose-400" : "border-border text-muted-foreground hover:border-rose-500/30"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </Seccion>

                {/* Fechas */}
                <Seccion titulo="Fecha y hora">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Inicio</p>
                      <div className="grid grid-cols-2 gap-2">
                        <input type="date" className="input-base" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
                        <input type="time" className="input-base" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Fin</p>
                      <div className="grid grid-cols-2 gap-2">
                        <input type="date" className="input-base" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
                        <input type="time" className="input-base" value={horaFin} onChange={(e) => setHoraFin(e.target.value)} />
                      </div>
                    </div>
                  </div>
                </Seccion>

                {/* Motivo */}
                <Seccion titulo="Motivo del permiso y/o licencia">
                  <textarea className="input-base" rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Describe el motivo" />
                </Seccion>

                {/* Repone tiempo */}
                <Seccion titulo="¿Repone tiempo?">
                  <div className="flex gap-2">
                    {(["Sí", "No"] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setReponeTiempo(v)}
                        className={`rounded-xl border px-4 py-1.5 text-xs font-semibold transition-colors ${
                          reponeTiempo === v ? "border-rose-500/50 bg-rose-500/10 text-rose-400" : "border-border text-muted-foreground hover:border-rose-500/30"
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                  {reponeTiempo === "Sí" && (
                    <input className="input-base mt-3" value={como} onChange={(e) => setComo(e.target.value)} placeholder="¿Cómo va a reponer el tiempo?" />
                  )}
                </Seccion>

                {/* Firma — se trae del perfil, no se escribe a mano */}
                <Seccion titulo="Firma del empleado">
                  {persona.firma_url ? (
                    <img src={persona.firma_url} alt="Firma" className="h-16 rounded-lg border border-border bg-white px-3" />
                  ) : (
                    <p className="text-xs text-amber-500">
                      Este colaborador no tiene firma digital registrada en su perfil de T&C — pídele a T&C que se la agregue antes de continuar.
                    </p>
                  )}
                </Seccion>

                <div className="pt-2 border-t border-border/60">
                  {enviado ? (
                    <p className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-500/10 text-emerald-500 text-sm font-semibold py-3">
                      <ClipboardCheck className="w-4 h-4" />
                      Enviado — quedó registrado como novedad en tu perfil
                    </p>
                  ) : (
                    <>
                      {errorEnvio && <p className="text-xs text-destructive mb-2">{errorEnvio}</p>}
                      <button
                        type="button"
                        onClick={enviar}
                        disabled={!puedeEnviar}
                        className="w-full flex items-center justify-center gap-2 rounded-xl bg-rose-600 text-white text-sm font-semibold py-3 hover:bg-rose-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardCheck className="w-4 h-4" />}
                        {enviando ? "Enviando…" : "Enviar formato"}
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </PageLayout>
  )
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">{titulo}</p>
      {children}
    </div>
  )
}
