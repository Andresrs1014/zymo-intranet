import { useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { sigApi } from "@/lib/sigApi"
import { cn } from "@/lib/utils"
import {
  X, UploadCloud, FolderOpen, FileText, Loader, AlertTriangle,
  Trash2, ArrowRight, ChevronLeft, CheckCircle, Bot, User,
} from "lucide-react"

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

const TITLES: Record<Categoria, { title: string; hint: string }> = {
  procedimiento: {
    title: "Subir procedimientos",
    hint: "Cada archivo se asigna después como nueva versión de un procedimiento existente (o uno nuevo).",
  },
  soporte: {
    title: "Subir documentos de soporte",
    hint: "Instructivos, formatos o anexos — seleccioná varios y asignalos todos a un mismo procedimiento.",
  },
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SigArchivosPendientesModal({ categoria, onClose }: { categoria: Categoria; onClose: () => void }) {
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState("")
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [assigningId, setAssigningId] = useState<number | null>(null) // fila "procedimiento" en asignación inline
  const [asignandoSoporte, setAsignandoSoporte] = useState(false)     // panel de asignación "soporte"

  const listKey = ["sig", "archivos-pendientes", categoria]
  const { data: archivos = [], isLoading } = useQuery<ArchivoPendiente[]>({
    queryKey: listKey,
    queryFn: async () => (await sigApi.get("/api/archivos-pendientes", { params: { categoria, asignado: false } })).data,
  })

  async function handleFiles(fileList: FileList) {
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
      await qc.invalidateQueries({ queryKey: listKey })
    } catch (e) {
      setUploadError(getErr(e, "Error al subir los archivos"))
    } finally {
      setUploading(false)
    }
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) void handleFiles(e.target.files)
    e.target.value = ""
  }

  async function handleDiscard(id: number) {
    try {
      await sigApi.delete(`/api/archivos-pendientes/${id}`)
      setSelected((s) => { const n = new Set(s); n.delete(id); return n })
      await qc.invalidateQueries({ queryKey: listKey })
    } catch (e) {
      setUploadError(getErr(e, "No se pudo descartar el archivo"))
    }
  }

  function toggleSelected(id: number) {
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }

  const meta = TITLES[categoria]

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-zinc-900/50 backdrop-blur-[1px]">
      <div
        className="bg-white rounded-xl w-full max-w-xl max-h-[85vh] flex flex-col border border-zinc-200 shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-200 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-6 w-6 rounded-md bg-helix-accent/10 border border-helix-accent/20 flex items-center justify-center shrink-0">
              <UploadCloud className="h-3.5 w-3.5 text-helix-accent" />
            </div>
            <span className="text-[13px] font-semibold text-zinc-800 font-mono">{meta.title}</span>
          </div>
          <button
            onClick={onClose}
            className="h-6 w-6 flex items-center justify-center rounded text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {asignandoSoporte ? (
          <AsignarSoportePanel
            archivos={archivos.filter((a) => selected.has(a.id))}
            onBack={() => setAsignandoSoporte(false)}
            onDone={async () => {
              setAsignandoSoporte(false)
              setSelected(new Set())
              await qc.invalidateQueries({ queryKey: listKey })
            }}
          />
        ) : (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <p className="text-xs text-zinc-500 leading-relaxed">{meta.hint}</p>

            {/* Dropzone */}
            <input ref={fileInputRef} type="file" accept={UPLOAD_ACCEPT} multiple onChange={onInputChange} className="hidden" />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full flex flex-col items-center gap-2 py-6 rounded-xl border-2 border-dashed border-zinc-200 hover:border-helix-accent/40 hover:bg-zinc-50 transition-colors disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <Loader className="h-5 w-5 text-helix-accent animate-spin" />
                  <span className="text-xs text-zinc-500 font-mono">Subiendo…</span>
                </>
              ) : (
                <>
                  <FolderOpen className="h-5 w-5 text-zinc-400" />
                  <span className="text-xs text-zinc-500 font-mono">Click para elegir varios archivos</span>
                  <span className="text-[11px] text-zinc-400 font-mono">MD · TXT · DOCX · PDF · DOC</span>
                </>
              )}
            </button>
            {uploadError && <ErrorBox msg={uploadError} />}

            {/* Lista de pendientes */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] text-zinc-400 uppercase tracking-widest font-mono">
                  Sin asignar ({archivos.length})
                </label>
                {categoria === "soporte" && selected.size > 0 && (
                  <button
                    onClick={() => setAsignandoSoporte(true)}
                    className="flex items-center gap-1 text-[11px] text-helix-accent hover:opacity-80 transition-opacity font-mono"
                  >
                    Asignar {selected.size} a un procedimiento <ArrowRight className="h-2.5 w-2.5" />
                  </button>
                )}
              </div>

              {isLoading && (
                <div className="flex items-center gap-2 text-zinc-400 py-6 justify-center">
                  <Loader className="h-3.5 w-3.5 animate-spin" />
                  <span className="text-xs font-mono">Cargando…</span>
                </div>
              )}

              {!isLoading && archivos.length === 0 && (
                <p className="text-xs text-zinc-400 font-mono py-4 text-center">Nada pendiente por ahora.</p>
              )}

              <div className="space-y-1.5">
                {archivos.map((a) => (
                  <ArchivoRow
                    key={a.id}
                    archivo={a}
                    categoria={categoria}
                    selected={selected.has(a.id)}
                    onToggleSelected={() => toggleSelected(a.id)}
                    onDiscard={() => handleDiscard(a.id)}
                    isAssigning={assigningId === a.id}
                    onStartAssign={() => setAssigningId(a.id)}
                    onCancelAssign={() => setAssigningId(null)}
                    onAssigned={async () => {
                      setAssigningId(null)
                      await qc.invalidateQueries({ queryKey: listKey })
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Fila de archivo pendiente ───────────────────────────────────────────────────

function ArchivoRow({
  archivo, categoria, selected, onToggleSelected, onDiscard,
  isAssigning, onStartAssign, onCancelAssign, onAssigned,
}: {
  archivo: ArchivoPendiente
  categoria: Categoria
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
      <div className="flex items-center gap-2.5 px-3 py-2 bg-white">
        {categoria === "soporte" && (
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelected}
            className="h-3.5 w-3.5 rounded border-zinc-300 accent-helix-accent shrink-0"
          />
        )}
        <FileText className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[12px] text-zinc-700 font-mono truncate">{archivo.nombreArchivo}</p>
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 font-mono">
            <span>{fmtSize(archivo.tamanoBytes)}</span>
            <span>·</span>
            {archivo.origen === "mcp" ? <Bot className="h-2.5 w-2.5" /> : <User className="h-2.5 w-2.5" />}
            <span className="truncate">{archivo.subidoPorNombre}</span>
          </div>
        </div>
        {categoria === "procedimiento" && !isAssigning && (
          <button
            onClick={onStartAssign}
            className="shrink-0 flex items-center gap-1 text-[11px] px-2 py-1 rounded border border-helix-accent/30 text-helix-accent hover:bg-helix-accent/5 transition-colors font-mono"
          >
            Asignar <ArrowRight className="h-2.5 w-2.5" />
          </button>
        )}
        <button
          onClick={onDiscard}
          title="Descartar"
          className="shrink-0 h-6 w-6 flex items-center justify-center rounded text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-colors"
        >
          <Trash2 className="h-3 w-3" />
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
    <div className="px-3 py-3 bg-zinc-50 border-t border-zinc-200 space-y-2.5">
      <div className="grid grid-cols-2 gap-2">
        <select
          value={areaId ?? ""}
          onChange={(e) => { setAreaId(e.target.value ? Number(e.target.value) : null); setProcId(null) }}
          className="bg-white border border-zinc-200 rounded-lg px-2.5 py-1.5 text-[11px] text-zinc-700 font-mono focus:outline-none focus:ring-1 focus:ring-helix-accent/40"
        >
          <option value="">Área…</option>
          {areas.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
        </select>
        <select
          value={procId ?? ""}
          onChange={(e) => setProcId(e.target.value ? Number(e.target.value) : null)}
          disabled={areaId == null}
          className="bg-white border border-zinc-200 rounded-lg px-2.5 py-1.5 text-[11px] text-zinc-700 font-mono focus:outline-none focus:ring-1 focus:ring-helix-accent/40 disabled:opacity-50"
        >
          <option value="">Procedimiento…</option>
          {procs.map((p) => <option key={p.id} value={p.id}>{p.codigo} — {p.titulo}</option>)}
        </select>
      </div>
      <input
        value={mensaje}
        onChange={(e) => setMensaje(e.target.value)}
        placeholder="Mensaje de la versión"
        className="w-full bg-white border border-zinc-200 rounded-lg px-2.5 py-1.5 text-[11px] text-zinc-700 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-helix-accent/40"
      />
      <input
        value={versionDoc}
        onChange={(e) => setVersionDoc(e.target.value)}
        placeholder="Versión del documento (opcional, ej. 1.0)"
        className="w-full bg-white border border-zinc-200 rounded-lg px-2.5 py-1.5 text-[11px] text-zinc-700 font-mono placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-helix-accent/40"
      />
      {error && <ErrorBox msg={error} />}
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] text-zinc-500 hover:text-zinc-700 border border-zinc-200 rounded-lg transition-colors font-mono"
        >
          <ChevronLeft className="h-3 w-3" /> Cancelar
        </button>
        <button
          onClick={submit}
          disabled={submitting || !procId || !mensaje.trim()}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-helix-accent text-white text-[11px] font-medium rounded-lg hover:opacity-90 disabled:opacity-40 transition-opacity font-mono"
        >
          {submitting ? <Loader className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
          Asignar como nueva versión
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
    <div className="flex-1 overflow-y-auto p-5 space-y-4">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-600 transition-colors font-mono"
      >
        <ChevronLeft className="h-3 w-3" /> Volver a la lista
      </button>

      <div>
        <label className="text-[11px] text-zinc-400 uppercase tracking-widest font-mono block mb-1.5">
          Procedimiento destino ({archivos.length} archivo{archivos.length !== 1 ? "s" : ""})
        </label>
        <div className="grid grid-cols-2 gap-2">
          <select
            value={areaId ?? ""}
            onChange={(e) => { setAreaId(e.target.value ? Number(e.target.value) : null); setProcId(null) }}
            className="bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-1.5 text-[11px] text-zinc-700 font-mono focus:outline-none focus:ring-1 focus:ring-helix-accent/40"
          >
            <option value="">Área…</option>
            {areas.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </select>
          <select
            value={procId ?? ""}
            onChange={(e) => setProcId(e.target.value ? Number(e.target.value) : null)}
            disabled={areaId == null}
            className="bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-1.5 text-[11px] text-zinc-700 font-mono focus:outline-none focus:ring-1 focus:ring-helix-accent/40 disabled:opacity-50"
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
            <div key={a.id} className="rounded-lg border border-zinc-200 p-2.5 space-y-2">
              <p className="text-[11px] text-zinc-500 font-mono truncate">{a.nombreArchivo}</p>
              <div className="grid grid-cols-3 gap-1.5">
                <select
                  value={it.tipo}
                  onChange={(e) => updateItem(a.id, { tipo: e.target.value as SoporteTipo })}
                  className="bg-zinc-50 border border-zinc-200 rounded px-2 py-1 text-[11px] text-zinc-700 font-mono focus:outline-none focus:ring-1 focus:ring-helix-accent/40"
                >
                  <option value="instructivo">Instructivo</option>
                  <option value="formato">Formato</option>
                  <option value="doc_anexo">Documento anexo</option>
                </select>
                <input
                  value={it.titulo}
                  onChange={(e) => updateItem(a.id, { titulo: e.target.value })}
                  placeholder="Título"
                  className="bg-zinc-50 border border-zinc-200 rounded px-2 py-1 text-[11px] text-zinc-700 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-helix-accent/40"
                />
                {it.tipo === "instructivo" ? (
                  <input
                    value={it.codigo}
                    onChange={(e) => updateItem(a.id, { codigo: e.target.value.toUpperCase() })}
                    placeholder="Código (req.)"
                    className={cn(
                      "bg-zinc-50 border rounded px-2 py-1 text-[11px] text-zinc-700 font-mono placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-helix-accent/40",
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
        className="w-full flex items-center justify-center gap-1.5 py-2 bg-helix-accent text-white text-xs font-medium rounded-lg hover:opacity-90 disabled:opacity-40 transition-opacity font-mono"
      >
        {submitting ? <Loader className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
        Asignar {archivos.length} documento{archivos.length !== 1 ? "s" : ""}
      </button>
    </div>
  )
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-50 border border-red-200">
      <AlertTriangle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
      <p className="text-xs text-red-600 leading-relaxed">{msg}</p>
    </div>
  )
}
