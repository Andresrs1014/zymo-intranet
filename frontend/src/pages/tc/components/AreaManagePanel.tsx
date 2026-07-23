import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import { Search, Plus, X, Loader2, UserRound } from "lucide-react"

interface PersonaMini { id: number; nombre: string; foto_url?: string }
interface CargoConfig { id: number; nombre: string; area_id: number | null; sede_ids: number[] }

interface Props {
  sedeId: number
  areaId: number | null
  /** Cargos ya conocidos del hub para esta área (id + nombre), para no esperar un fetch inicial. */
  cargosIniciales: { id: number; nombre: string }[]
  onChanged: () => void
}

export function AreaManagePanel({ sedeId, areaId, cargosIniciales, onChanged }: Props) {
  const [cargos, setCargos] = useState<CargoConfig[]>([])
  const [personasPorCargo, setPersonasPorCargo] = useState<Record<number, PersonaMini[]>>({})
  const [loading, setLoading] = useState(true)
  const [buscarCargoAbierto, setBuscarCargoAbierto] = useState(false)
  const [buscarPersonaCargoId, setBuscarPersonaCargoId] = useState<number | null>(null)

  const cargar = () => {
    setLoading(true)
    Promise.all([
      api.get("/tc/cargos", { params: { sede_id: sedeId, area_id: areaId ?? undefined } }),
      api.get("/tc/personas", { params: { empresa_id: sedeId, area_id: areaId ?? undefined, estado: "Activo", limit: 300 } }),
    ]).then(([cargosRes, personasRes]) => {
      const cargosData: CargoConfig[] = cargosRes.data ?? []
      setCargos(cargosData)
      const grupos: Record<number, PersonaMini[]> = {}
      for (const p of personasRes.data?.items ?? []) {
        if (!p.cargo_id) continue
        grupos[p.cargo_id] = grupos[p.cargo_id] ?? []
        grupos[p.cargo_id].push({ id: p.id, nombre: p.nombre, foto_url: p.foto_url })
      }
      setPersonasPorCargo(grupos)
    }).finally(() => setLoading(false))
  }

  useEffect(() => { cargar() }, [sedeId, areaId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function quitarPersonaDeCargo(personaId: number) {
    await api.put(`/tc/personas/${personaId}`, { cargo_id: null })
    cargar()
    onChanged()
  }

  async function agregarCargoExistente(cargo: CargoConfig) {
    if (!cargo.sede_ids.includes(sedeId) || cargo.area_id !== areaId) {
      await api.put(`/tc/cargos/${cargo.id}`, {
        nombre: cargo.nombre,
        area_id: areaId,
        sede_ids: cargo.sede_ids.includes(sedeId) ? cargo.sede_ids : [...cargo.sede_ids, sedeId],
      })
    }
    setBuscarCargoAbierto(false)
    cargar()
    onChanged()
  }

  async function crearCargoNuevo(nombre: string) {
    await api.post("/tc/cargos", { nombre, area_id: areaId, sede_ids: [sedeId] })
    setBuscarCargoAbierto(false)
    cargar()
    onChanged()
  }

  async function agregarPersonaACargo(personaId: number, cargoId: number) {
    await api.put(`/tc/personas/${personaId}`, { empresa_id: sedeId, area_id: areaId, cargo_id: cargoId })
    setBuscarPersonaCargoId(null)
    cargar()
    onChanged()
  }

  const listaCargos = cargos.length > 0 ? cargos : cargosIniciales.map((c) => ({ ...c, area_id: areaId, sede_ids: [sedeId] }))

  return (
    <div className="border-t border-border px-4 py-4 space-y-3 bg-background/30">
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Cargando…
        </div>
      ) : (
        <>
          {listaCargos.length === 0 && (
            <p className="text-xs text-muted-foreground">Sin cargos configurados en esta área todavía.</p>
          )}
          {listaCargos.map((cargo) => (
            <div key={cargo.id} className="rounded-xl border border-border bg-muted/5 p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold">{cargo.nombre}</p>
                <button
                  type="button"
                  onClick={() => setBuscarPersonaCargoId(cargo.id)}
                  className="flex items-center gap-1 text-[11px] font-semibold text-teal-400 hover:text-teal-300 transition-colors"
                >
                  <Plus className="w-3 h-3" /> Agregar persona
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(personasPorCargo[cargo.id] ?? []).length === 0 && (
                  <span className="text-[11px] text-muted-foreground italic">Sin personas asignadas aquí.</span>
                )}
                {(personasPorCargo[cargo.id] ?? []).map((p) => (
                  <span key={p.id} className="flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full border border-border bg-background/60 text-[11px]">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-teal-500/10 text-teal-400 shrink-0">
                      <UserRound className="w-2.5 h-2.5" />
                    </span>
                    {p.nombre}
                    <button
                      type="button"
                      onClick={() => quitarPersonaDeCargo(p.id)}
                      aria-label={`Quitar a ${p.nombre} de ${cargo.nombre}`}
                    >
                      <X className="w-3 h-3 text-muted-foreground/50 hover:text-rose-400" />
                    </button>
                  </span>
                ))}
              </div>
              {buscarPersonaCargoId === cargo.id && (
                <BuscarPersonaInline
                  onElegir={(personaId) => agregarPersonaACargo(personaId, cargo.id)}
                  onCancelar={() => setBuscarPersonaCargoId(null)}
                />
              )}
            </div>
          ))}

          {!buscarCargoAbierto ? (
            <button
              type="button"
              onClick={() => setBuscarCargoAbierto(true)}
              className="flex items-center gap-1.5 text-xs font-semibold text-teal-400 hover:text-teal-300 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Agregar cargo a esta área
            </button>
          ) : (
            <BuscarCargoInline
              onElegirExistente={agregarCargoExistente}
              onCrearNuevo={crearCargoNuevo}
              onCancelar={() => setBuscarCargoAbierto(false)}
            />
          )}
        </>
      )}
    </div>
  )
}

// ── Buscar cargo existente (con fallback a crear uno nuevo) ──────────────────

function BuscarCargoInline({
  onElegirExistente, onCrearNuevo, onCancelar,
}: {
  onElegirExistente: (cargo: CargoConfig) => void
  onCrearNuevo: (nombre: string) => void
  onCancelar: () => void
}) {
  const [q, setQ] = useState("")
  const [resultados, setResultados] = useState<CargoConfig[]>([])
  const [buscando, setBuscando] = useState(false)

  useEffect(() => {
    setBuscando(true)
    api.get("/tc/cargos").then((r) => setResultados(r.data ?? [])).finally(() => setBuscando(false))
  }, [])

  const filtrados = q.trim()
    ? resultados.filter((c) => c.nombre.toLowerCase().includes(q.trim().toLowerCase()))
    : resultados

  return (
    <div className="mt-3 rounded-xl border border-teal-500/20 bg-teal-500/5 p-3 space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar cargo ya existente…"
          className="w-full h-9 pl-9 pr-3 rounded-lg border border-border bg-background/60 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
        />
        {buscando && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-muted-foreground" />}
      </div>
      <div className="max-h-40 overflow-y-auto space-y-1">
        {filtrados.slice(0, 20).map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onElegirExistente(c)}
            className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-muted/10 text-left transition-colors text-xs"
          >
            <Plus className="w-3 h-3 text-teal-400 shrink-0" />
            {c.nombre}
          </button>
        ))}
        {!buscando && q.trim() && filtrados.length === 0 && (
          <button
            type="button"
            onClick={() => onCrearNuevo(q.trim())}
            className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-muted/10 text-left transition-colors text-xs text-teal-400"
          >
            <Plus className="w-3 h-3 shrink-0" />
            Crear "{q.trim()}" como cargo nuevo
          </button>
        )}
      </div>
      <button onClick={onCancelar} className="text-[11px] text-muted-foreground hover:text-foreground">Cancelar</button>
    </div>
  )
}

// ── Buscar persona existente ──────────────────────────────────────────────────

function BuscarPersonaInline({
  onElegir, onCancelar,
}: {
  onElegir: (personaId: number) => void
  onCancelar: () => void
}) {
  const [q, setQ] = useState("")
  const [resultados, setResultados] = useState<{ id: number; nombre: string; cargo_nombre?: string; empresa_nombre?: string }[]>([])
  const [buscando, setBuscando] = useState(false)

  useEffect(() => {
    if (q.trim().length < 2) { setResultados([]); return }
    setBuscando(true)
    const t = setTimeout(() => {
      api.get("/tc/personas", { params: { q, estado: "Activo", limit: 20 } })
        .then((r) => setResultados(r.data.items ?? []))
        .finally(() => setBuscando(false))
    }, 300)
    return () => clearTimeout(t)
  }, [q])

  return (
    <div className="mt-2 rounded-lg border border-teal-500/20 bg-teal-500/5 p-2 space-y-1.5">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar persona por nombre o documento…"
          className="w-full h-8 pl-7 pr-2 rounded-lg border border-border bg-background/60 text-[11px] focus:outline-none focus:ring-1 focus:ring-ring"
        />
        {buscando && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 animate-spin text-muted-foreground" />}
      </div>
      {resultados.length > 0 && (
        <div className="max-h-32 overflow-y-auto space-y-0.5">
          {resultados.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onElegir(p.id)}
              className="w-full flex items-center gap-2 p-1.5 rounded-lg hover:bg-muted/10 text-left transition-colors"
            >
              <Plus className="w-2.5 h-2.5 text-teal-400 shrink-0" />
              <span className="text-[11px] font-medium">{p.nombre}</span>
              <span className="text-[10px] text-muted-foreground">{p.cargo_nombre} · {p.empresa_nombre}</span>
            </button>
          ))}
        </div>
      )}
      <button onClick={onCancelar} className="text-[10px] text-muted-foreground hover:text-foreground">Cancelar</button>
    </div>
  )
}
