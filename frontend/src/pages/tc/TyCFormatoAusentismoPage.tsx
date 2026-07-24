import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "@/lib/api"
import { PageLayout } from "@/components/layout/PageLayout"
import { ArrowLeft, Building2, ClipboardCheck } from "lucide-react"

interface Plataforma {
  sede_id: number
  sede_nombre: string
  configurada: boolean
  nombre: string
  logo_url: string
}

const TIPOS = ["Permiso", "Licencia remunerada", "Licencia no remunerada"] as const
type Tipo = (typeof TIPOS)[number]

export function TyCFormatoAusentismoPage() {
  const navigate = useNavigate()

  const [plataformas, setPlataformas] = useState<Plataforma[]>([])
  const [sedeId, setSedeId] = useState<number | null>(null)
  const [tipo, setTipo] = useState<Tipo>("Permiso")
  const [nombre, setNombre] = useState("")
  const [cargo, setCargo] = useState("")
  const [fechaInicio, setFechaInicio] = useState("")
  const [horaInicio, setHoraInicio] = useState("")
  const [fechaFin, setFechaFin] = useState("")
  const [horaFin, setHoraFin] = useState("")
  const [motivo, setMotivo] = useState("")
  const [reponeTiempo, setReponeTiempo] = useState<"Sí" | "No">("No")
  const [como, setComo] = useState("")
  const [firma, setFirma] = useState("")

  useEffect(() => {
    api.get("/tc/plataformas")
      .then((r) => setPlataformas((Array.isArray(r.data) ? r.data : []).filter((p: Plataforma) => p.configurada)))
      .catch(() => {})
  }, [])

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
            {/* Empresa */}
            <Seccion titulo="Empresa">
              <div className="grid grid-cols-3 gap-2">
                {plataformas.map((p) => (
                  <button
                    key={p.sede_id}
                    type="button"
                    onClick={() => setSedeId(p.sede_id)}
                    className={`flex flex-col items-center gap-2 rounded-xl border p-3 transition-colors ${
                      sedeId === p.sede_id ? "border-rose-500/50 bg-rose-500/10" : "border-border hover:border-rose-500/30"
                    }`}
                  >
                    <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-white">
                      {p.logo_url ? (
                        <img src={p.logo_url} alt={p.nombre} className="h-[80%] w-[80%] object-contain" />
                      ) : (
                        <Building2 className="h-4 w-4 text-muted-foreground/40" />
                      )}
                    </span>
                    <span className="text-[10px] font-semibold text-center leading-tight">{p.nombre || p.sede_nombre}</span>
                  </button>
                ))}
              </div>
            </Seccion>

            {/* Datos del solicitante */}
            <Seccion titulo="Datos del solicitante">
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Nombre completo">
                  <input className="input-base" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre y apellido" />
                </Campo>
                <Campo label="Cargo">
                  <input className="input-base" value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="Cargo actual" />
                </Campo>
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

            {/* Firma */}
            <Seccion titulo="Firma del empleado">
              <input className="input-base" value={firma} onChange={(e) => setFirma(e.target.value)} placeholder="Escribe tu nombre completo como firma" />
              <p className="text-[11px] text-muted-foreground mt-2">Al escribir tu nombre confirmas que la información suministrada es verídica.</p>
            </Seccion>

            <div className="pt-2 border-t border-border/60">
              <button
                type="button"
                disabled
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-rose-600/40 text-white/70 text-sm font-semibold py-3 cursor-not-allowed"
              >
                <ClipboardCheck className="w-4 h-4" />
                Vista previa de diseño — envío aún no conectado
              </button>
            </div>
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

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  )
}
