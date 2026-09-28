import { useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { sigApi } from "@/lib/sigApi"
import { cn } from "@/lib/utils"
import {
  Inbox, ChevronUp, FileText, Loader, AlertTriangle,
  Trash2, ArrowRight, ChevronLeft, CheckCircle, Bot, User, Plus, Layers,
} from "lucide-react"

// Tray persistente abajo a la derecha (mismo patrón que SigAnalisisQueue) --
// a diferencia del job queue, esto NO se vacía solo: los archivos quedan acá
// hasta que alguien los asigna a mano, sobreviven cerrar/reabrir el tray.

const UPLOAD_ACCEPT = ".md,.markdown,.txt,.docx,.pdf,.doc"

type Categoria = "procedimiento" | "soporte"
type SoporteTipo = "instructivo" | "formato" | "doc_anexo"

interface ArchivoPendiente {
  id: number
  nombreArchivo: string
  tipoMime: string | null
  tamanoBytes: number
  categoria: Categoria
  origen: "intranet" | "mcp"
  subidoPorNombre: string
  createdAt: string
}

interface SigArea { id: number; nombre: string; color: string }
interface SigProcedimiento { id: number; areaId: number; codigo: string; titulo: string }

function getErr(e: unknown, fallback: string): string {
  return (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function stripExt(name: string): string {
  return name.replace(/\.[^./\\]+$/, "")
}

const LIST_KEY = ["sig", "archivos-pendientes"]

// ── Component ─────────────────────────────────────────────────────────────────

export function SigArchivosPendientesTray() {
  const qc = useQueryClient()
  const [expanded, setExpanded] = useState(false)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [assigningId, setAssigningId] = useState<number | null>(null)
  const [asignandoSoporte, setAsignandoSoporte] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState("")

  const inputProcRef = useRef<HTMLInputElement>(null)
  const inputSoporteRef = useRef<HTMLInputElement>(null)

  const { data: archivos = [] } = useQuery<ArchivoPendiente[]>({
    queryKey: LIST_KEY,
    queryFn: async () => (await sigApi.get("/api/archivos-pendientes", { params: { asignado: false } })).data,
    refetchInterval: 30_000, // por si el MCP sube archivos en background
  })

  const procedimientos = archivos.filter((a) => a.categoria === "procedimiento")
  const soporte = archivos.filter((a) => a.categoria === "soporte")

  async function handleUpload(fileList: FileList, categoria: Categoria) {
    const files = Array.from(fileList)
    if (files.length === 0) return
    setUploading(true)
    setUploadError("")
    try {
      const fd = new FormData()
      files.forEach((f) => fd.append("files", f))
      fd.append("categoria", categoria)
      await sigApi.post("/api/archivos-pendientes/upload", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      setExpanded(true)
      await qc.invalidateQueries({ queryKey: LIST_KEY })
    } catch (e) {
      setUploadError(getErr(e, "Error al subir los archivos"))
    } finally {
      setUploading(false)
    }
  }

  async function handleDiscard(id: number) {
    try {
      await sigApi.delete(`/api/archivos-pendientes/${id}`)
      setSelected((s) => { const n = new Set(s); n.delete(id); return n })
      await qc.invalidateQueries({ queryKey: LIST_KEY })
    } catch (e) {
      setUploadError(getErr(e, "No se pudo descartar el archivo"))
    }
  }

  function toggleSelected(id: number) {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className={cn(
          "absolute bottom-5 right-5 z-40 flex items-center gap-2 px-3.5 py-2 rounded-xl border-2 bg-white text-zinc-900 transition-colors",
          archivos.length > 0
            ? "border-red-500 shadow-[0_0_14px_rgba(239,68,68,0.55)] hover:shadow-[0_0_18px_rgba(239,68,68,0.7)]"
            : "border-zinc-200 shadow-sm hover:border-zinc-300",
        )}
      >
        <Inbox className="h-3.5 w-3.5 text-zinc-900" />
        <span className="text-[12px] font-mono">Archivos pendientes</span>
        {archivos.length > 0 && (
          <span className="text-[12px] font-mono font-bold text-emerald-600">
            {archivos.length}
          </span>
        )}
      </button>
    )
  }

  return (
    <div className="absolute bottom-5 right-5 z-40 w-[440px] max-h-[70vh] flex flex-col rounded-xl border border-zinc-200 shadow-2xl shadow-zinc-900/20 overflow-hidden bg-white">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-2 px-3.5 py-2.5 bg-zinc-900">
        <Inbox className="h-3.5 w-3.5 text-violet-400 shrink-0" />
        <span className="text-[12px] font-mono text-white font-semibold flex-1">
          Archivos pendientes {archivos.length > 0 && `(${archivos.length})`}
        </span>
        <button
          onClick={() => { setExpanded(false); setAssigningId(null); setAsignandoSoporte(false) }}
          className="h-5 w-5 rounded flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
        >
          <ChevronUp className="h-3 w-3 rotate-180" />
        </button>
      </div>

      {asignandoSoporte ? (
        <AsignarSoportePanel
          archivos={soporte.filter((a) => selected.has(a.id))}
          onBack={() => setAsignandoSoporte(false)}
          onDone={async () => {
            setAsignandoSoporte(false)
            setSelected(new Set())
            await qc.invalidateQueries({ queryKey: LIST_KEY })
          }}
        />
      ) : (
        <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
          {/* Subida rápida */}
          <div className="flex gap-2">
            <input ref={inputProcRef} type="file" accept={UPLOAD_ACCEPT} multiple className="hidden"
              onChange={(e) => { if (e.target.files) void handleUpload(e.target.files, "procedimiento"); e.target.value = "" }} />
            <input ref={inputSoporteRef} type="file" accept={UPLOAD_ACCEPT} multiple className="hidden"
              onChange={(e) => { if (e.target.files) void handleUpload(e.target.files, "soporte"); e.target.value = "" }} />
            <button
              onClick={() => inputProcRef.current?.click()}
              disabled={uploading}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-helix-accent/30 text-helix-accent hover:bg-helix-accent/5 transition-colors text-[11px] font-mono disabled:opacity-50"
            >
              {uploading ? <Loader className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
              Procedimientos
            </button>
            <button
              onClick={() => inputSoporteRef.current?.click()}
              disabled={uploading}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-zinc-200 text-zinc-500 hover:border-helix-accent/40 hover:text-helix-accent transition-colors text-[11px] font-mono disabled:opacity-50"
            >
              {uploading ? <Loader className="h-3 w-3 animate-spin" /> : <Layers className="h-3 w-3" />}
              Soporte
            </button>
          </div>
          {uploadError && <ErrorBox msg={uploadError} />}

          {archivos.length === 0 && (
            <p className="text-xs text-zinc-400 font-mono py-6 text-center">Nada pendiente por ahora.</p>
          )}

          {/* Sección procedimientos */}
          {procedimientos.length > 0 && (
            <div>
              <label className="text-[11px] text-zinc-400 uppercase tracking-widest font-mono block mb-1.5">
                Procedimientos ({procedimientos.length})
              </label>
              <div className="space-y-1.5">
                {procedimientos.map((a) => (
                  <ArchivoRow
                    key={a.id}
                    archivo={a}
                    selectable={false}
                    selected={false}
                    onToggleSelected={() => {}}
                    onDiscard={() => handleDiscard(a.id)}
                    isAssigning={assigningId === a.id}
                    onStartAssign={() => setAssigningId(a.id)}
                    onCancelAssign={() => setAssigningId(null)}
                    onAssigned={async () => { setAssigningId(null); await qc.invalidateQueries({ queryKey: LIST_KEY }) }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Sección soporte */}
          {soporte.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] text-zinc-400 uppercase tracking-widest font-mono">
                  Documentos de soporte ({soporte.length})
                </label>
                {selected.size > 0 && (
                  <button
                    onClick={() => setAsignandoSoporte(true)}
                    className="flex items-center gap-1 text-[11px] text-helix-accent hover:opacity-80 transition-opacity font-mono"
                  >
                    Asignar {selected.size} <ArrowRight className="h-2.5 w-2.5" />
                  </button>
                )}
              </div>
              <div className="space-y-1.5">
                {soporte.map((a) => (
                  <ArchivoRow
                    key={a.id}
                    archivo={a}
                    selectable
                    selected={selected.has(a.id)}
                    onToggleSelected={() => toggleSelected(a.id)}
                    onDiscard={() => handleDiscard(a.id)}
                    isAssigning={false}
                    onStartAssign={() => {}}
                    onCancelAssign={() => {}}
                    onAssigned={() => {}}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Fila de archivo pendiente ───────────────────────────────────────────────────

function ArchivoRow({
  archivo, selectable, selected, onToggleSelected, onDiscard,
  isAssigning, onStartAssign, onCancelAssign, onAssigned,
}: {
  archivo: ArchivoPendiente
  selectable: boolean
  selected: boolean
  onToggleSelected: () => void
  onDiscard: () => void
  isAssigning: boolean
  onStartAssign: () => void
  onCancelAssign: () => void
  onAssigned: () => void
}) {
  return (
    <div className={cn("rounded-lg border overflow-hidden", isAssigning ? "border-helix-accent/40" : "border-zinc-200")}>
      <div className="flex items-center gap-2 px-2.5 py-1.5 bg-white">
        {selectable && (
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelected}
            className="h-3.5 w-3.5 rounded border-zinc-300 accent-helix-accent shrink-0"
          />
        )}
        <FileText className="h-3 w-3 text-zinc-400 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-zinc-700 font-mono truncate">{archivo.nombreArchivo}</p>
          <div className="flex items-center gap-1 text-[10px] text-zinc-400 font-mono">
            <span>{fmtSize(archivo.tamanoBytes)}</span>
            <span>·</span>
            {archivo.origen === "mcp" ? <Bot className="h-2.5 w-2.5" /> : <User className="h-2.5 w-2.5" />}
            <span className="truncate">{archivo.subidoPorNombre}</span>
          </div>
        </div>
        {!selectable && !isAssigning && (
          <button
            onClick={onStartAssign}
            className="shrink-0 flex items-center gap-1 text-[10px] px-1.5 py-1 rounded border border-helix-accent/30 text-helix-accent hover:bg-helix-accent/5 transition-colors font-mono"
          >
            Asignar <ArrowRight className="h-2.5 w-2.5" />
          </button>
        )}
        <button
          onClick={onDiscard}
          title="Descartar"
          className="shrink-0 h-5 w-5 flex items-center justify-center rounded text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-colors"
        >
          <Trash2 className="h-2.5 w-2.5" />
        </button>
      </div>

      {isAssigning && (
        <AsignarProcedimientoForm archivo={archivo} onCancel={onCancelAssign} onDone={onAssigned} />
      )}
    </div>
  )
}

// ── Área + procedimiento picker (compartido) ─────────────────────────────────────

function useAreasYProcedimientos(areaId: number | null) {
  const { data: areas = [] } = useQuery<SigArea[]>({
    queryKey: ["sig", "areas"],
    queryFn: async () => (await sigApi.get("/api/areas")).data,
  })
  const { data: procs = [] } = useQuery<SigProcedimiento[]>({
    queryKey: ["sig", "procs-by-area", areaId],
    queryFn: async () => (await sigApi.get(`/api/procedimientos?areaId=${areaId}`)).data,
    enabled: areaId != null,
  })
  return { areas, procs }
}

// ── Asignar un archivo "procedimiento" como nueva versión ───────────────────────

function AsignarProcedimientoForm({
  archivo, onCancel, onDone,
}: { archivo: ArchivoPendiente; onCancel: () => void; onDone: () => void }) {
  const [areaId, setAreaId] = useState<number | null>(null)
  const [procId, setProcId] = useState<number | null>(null)
  const [mensaje, setMensaje] = useState(`Nueva versión — ${stripExt(archivo.nombreArchivo)}`)
  const [versionDoc, setVersionDoc] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const { areas, procs } = useAreasYProcedimientos(areaId)

  async function submit() {
    if (!procId || !mensaje.trim()) return
    setSubmitting(true)
    setError("")
    try {
      await sigApi.post(`/api/archivos-pendientes/${archivo.id}/asignar-procedimiento`, {
        procedimientoId: procId,
        mensaje: mensaje.trim(),
        versionDoc: versionDoc.trim() || undefined,
      })
      onDone()
    } catch (e) {
      setError(getErr(e, "No se pudo asignar el archivo"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="px-2.5 py-2.5 bg-zinc-50 border-t border-zinc-200 space-y-2">
      <div className="grid grid-cols-2 gap-1.5">
        <select
          value={areaId ?? ""}
          onChange={(e) => { setAreaId(e.target.value ? Number(e.target.value) : null); setProcId(null) }}
          className="bg-white border border-zinc-200 rounded-lg px-2 py-1 text-[11px] text-zinc-700 font-mono focus:outline-none focus:ring-1 focus:ring-helix-accent/40"
        >
          <option value="">Área…</option>
          {areas.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
        </select>
        <select
          value={procId ?? ""}
          onChange={(e) => setProcId(e.target.value ? Number(e.target.value) : null)}
          disabled={areaId == null}
          className="bg-white border border-zinc-200 rounded-lg px-2 py-1 text-[11px] text-zinc-700 font-mono focus:outline-none focus:ring-1 focus:ring-helix-accent/40 disabled:opacity-50"
        >
          <option value="">Procedimiento…</option>
          {procs.map((p) => <option key={p.id} value={p.id}>{p.codigo} — {p.titulo}</option>)}
        </select>
      </div>
      <input
        value={mensaje}
        onChange={(e) => setMensaje(e.target.value)}
        placeholder="Mensaje de la versión"
        className="w-full bg-white border border-zinc-200 rounded-lg px-2 py-1 text-[11px] text-zinc-700 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-helix-accent/40"
      />
      <input
        value={versionDoc}
        onChange={(e) => setVersionDoc(e.target.value)}
        placeholder="Versión del documento (opcional, ej. 1.0)"
        className="w-full bg-white border border-zinc-200 rounded-lg px-2 py-1 text-[11px] text-zinc-700 font-mono placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-helix-accent/40"
      />
      {error && <ErrorBox msg={error} />}
      <div className="flex gap-1.5">
        <button
          onClick={onCancel}
          className="flex items-center gap-1 px-2 py-1 text-[11px] text-zinc-500 hover:text-zinc-700 border border-zinc-200 rounded-lg transition-colors font-mono"
        >
          <ChevronLeft className="h-3 w-3" /> Cancelar
        </button>
        <button
          onClick={submit}
          disabled={submitting || !procId || !mensaje.trim()}
          className="flex-1 flex items-center justify-center gap-1.5 py-1 bg-helix-accent text-white text-[11px] font-medium rounded-lg hover:opacity-90 disabled:opacity-40 transition-opacity font-mono"
        >
          {submitting ? <Loader className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
          Asignar
        </button>
      </div>
    </div>
  )
}

// ── Panel: asignar varios archivos "soporte" a un mismo procedimiento ───────────

function AsignarSoportePanel({
  archivos, onBack, onDone,
}: { archivos: ArchivoPendiente[]; onBack: () => void; onDone: () => void }) {
  const [areaId, setAreaId] = useState<number | null>(null)
  const [procId, setProcId] = useState<number | null>(null)
  const [items, setItems] = useState<Record<number, { tipo: SoporteTipo; titulo: string; codigo: string }>>(() =>
    Object.fromEntries(archivos.map((a) => [a.id, { tipo: "instructivo" as SoporteTipo, titulo: stripExt(a.nombreArchivo), codigo: "" }])),
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const { areas, procs } = useAreasYProcedimientos(areaId)

  function updateItem(id: number, patch: Partial<{ tipo: SoporteTipo; titulo: string; codigo: string }>) {
    setItems((s) => ({ ...s, [id]: { ...s[id], ...patch } }))
  }

  const faltaCodigo = archivos.some((a) => items[a.id]?.tipo === "instructivo" && !items[a.id]?.codigo.trim())

  async function submit() {
    if (!procId || faltaCodigo) return
    setSubmitting(true)
    setError("")
    try {
      await sigApi.post("/api/archivos-pendientes/asignar-soporte", {
        procedimientoId: procId,
        items: archivos.map((a) => ({
          id: a.id,
          tipo: items[a.id].tipo,
          titulo: items[a.id].titulo.trim(),
          ...(items[a.id].tipo === "instructivo" ? { codigo: items[a.id].codigo.trim() } : {}),
        })),
      })
      onDone()
    } catch (e) {
      setError(getErr(e, "No se pudieron asignar los archivos"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-600 transition-colors font-mono"
      >
        <ChevronLeft className="h-3 w-3" /> Volver
      </button>

      <div>
        <label className="text-[11px] text-zinc-400 uppercase tracking-widest font-mono block mb-1.5">
          Destino ({archivos.length} archivo{archivos.length !== 1 ? "s" : ""})
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          <select
            value={areaId ?? ""}
            onChange={(e) => { setAreaId(e.target.value ? Number(e.target.value) : null); setProcId(null) }}
            className="bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-1 text-[11px] text-zinc-700 font-mono focus:outline-none focus:ring-1 focus:ring-helix-accent/40"
          >
            <option value="">Área…</option>
            {areas.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </select>
          <select
            value={procId ?? ""}
            onChange={(e) => setProcId(e.target.value ? Number(e.target.value) : null)}
            disabled={areaId == null}
            className="bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-1 text-[11px] text-zinc-700 font-mono focus:outline-none focus:ring-1 focus:ring-helix-accent/40 disabled:opacity-50"
          >
            <option value="">Procedimiento…</option>
            {procs.map((p) => <option key={p.id} value={p.id}>{p.codigo} — {p.titulo}</option>)}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        {archivos.map((a) => {
          const it = items[a.id]
          return (
            <div key={a.id} className="rounded-lg border border-zinc-200 p-2 space-y-1.5">
              <p className="text-[11px] text-zinc-500 font-mono truncate">{a.nombreArchivo}</p>
              <div className="grid grid-cols-3 gap-1.5">
                <select
                  value={it.tipo}
                  onChange={(e) => updateItem(a.id, { tipo: e.target.value as SoporteTipo })}
                  className="bg-zinc-50 border border-zinc-200 rounded px-1.5 py-1 text-[10px] text-zinc-700 font-mono focus:outline-none focus:ring-1 focus:ring-helix-accent/40"
                >
                  <option value="instructivo">Instructivo</option>
                  <option value="formato">Formato</option>
                  <option value="doc_anexo">Anexo</option>
                </select>
                <input
                  value={it.titulo}
                  onChange={(e) => updateItem(a.id, { titulo: e.target.value })}
                  placeholder="Título"
                  className="bg-zinc-50 border border-zinc-200 rounded px-1.5 py-1 text-[10px] text-zinc-700 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-helix-accent/40"
                />
                {it.tipo === "instructivo" ? (
                  <input
                    value={it.codigo}
                    onChange={(e) => updateItem(a.id, { codigo: e.target.value.toUpperCase() })}
                    placeholder="Código"
                    className={cn(
                      "bg-zinc-50 border rounded px-1.5 py-1 text-[10px] text-zinc-700 font-mono placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-helix-accent/40",
                      !it.codigo.trim() ? "border-amber-300" : "border-zinc-200",
                    )}
                  />
                ) : <div />}
              </div>
            </div>
          )
        })}
      </div>

      {error && <ErrorBox msg={error} />}

      <button
        onClick={submit}
        disabled={submitting || !procId || faltaCodigo}
        className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-helix-accent text-white text-[11px] font-medium rounded-lg hover:opacity-90 disabled:opacity-40 transition-opacity font-mono"
      >
        {submitting ? <Loader className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
        Asignar {archivos.length} documento{archivos.length !== 1 ? "s" : ""}
      </button>
    </div>
  )
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="flex items-start gap-2 p-2 rounded-lg bg-red-50 border border-red-200">
      <AlertTriangle className="h-3 w-3 text-red-500 mt-0.5 shrink-0" />
      <p className="text-[11px] text-red-600 leading-relaxed">{msg}</p>
    </div>
  )
}
