import { useRef, useState } from "react"
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query"
import { sigApi } from "@/lib/sigApi"
import {
  Paperclip, Plus, FileText, Trash2, Loader, AlertCircle, AlertTriangle,
  X, FileCheck, Upload, Download, Pencil,
} from "lucide-react"

// ── Panel genérico de "archivo suelto" — usado por Formatos (cuelga de un
// instructivo) y Doc Anexos (cuelga del procedimiento). Sin extracción de texto
// ni versionado — a diferencia de Instructivos, son solo archivo + nombre.

export interface SigAnexoItem {
  id: number
  nombre: string
  nombreArchivo: string
  tipoMime: string | null
  autorNombre: string
  createdAt: string
  instructivo?: { codigo: string; titulo: string } | null
}

interface InstructivoOption { id: number; codigo: string; titulo: string }

interface Props {
  title: string
  emptyText: string
  listUrl: string
  uploadUrl: string
  deleteUrlBase: string
  archivoUrlBase: string
  queryKey: unknown[]
  canEdit?: boolean
  /** Campo extra fijo que va en el FormData (ej. { procedimientoId: "5" }) — omitir si instructivoOptions ya lo cubre */
  extraField?: { name: string; value: string }
  /** Si se pasa, el form exige elegir un instructivo antes de subir (uso: Formatos) */
  instructivoOptions?: InstructivoOption[]
}

function getErr(e: unknown, fallback: string): string {
  const data = (e as { response?: { data?: { error?: string } } })?.response?.data
  return typeof data?.error === "string" ? data.error : fallback
}

export function SigAnexoPanel({
  title, emptyText, listUrl, uploadUrl, deleteUrlBase, archivoUrlBase,
  queryKey, canEdit = false, extraField, instructivoOptions,
}: Props) {
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [file, setFile] = useState<File | null>(null)
  const [nombre, setNombre] = useState("")
  const [instructivoId, setInstructivoId] = useState("")
  const [visible, setVisible] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [deleting, setDeleting] = useState<number | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [downloading, setDownloading] = useState<number | null>(null)
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null)
  const [batchErrors, setBatchErrors] = useState<string[]>([])
  const [editingInstructivoFor, setEditingInstructivoFor] = useState<number | null>(null)

  const { data: items = [], isLoading } = useQuery<SigAnexoItem[]>({
    queryKey,
    queryFn: () => sigApi.get(listUrl).then((r) => r.data),
  })

  // Elegir si el formato es "del procedimiento" (sin instructivo) o "de un
  // instructivo" puntual -- editable después de subido, no solo al cargarlo.
  const updateInstructivoMutation = useMutation({
    mutationFn: ({ id, instructivoId }: { id: number; instructivoId: number | null }) =>
      sigApi.patch(`${deleteUrlBase}/${id}`, { instructivoId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey })
      setEditingInstructivoFor(null)
    },
  })

  function handleFile(f: File) {
    setFile(f)
    setNombre(f.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "))
    setVisible(true)
    setError("")
  }

  // Varios archivos a la vez: sin form de revisión por archivo (solo piden
  // "nombre", se auto-genera del nombre de archivo como ya hacía el single) --
  // se suben uno por uno para no perder cuál falló, y seguir con el resto.
  async function handleFilesBatch(files: File[]) {
    setBatchErrors([])
    setBatchProgress({ done: 0, total: files.length })
    const errors: string[] = []
    for (let i = 0; i < files.length; i++) {
      const f = files[i]
      try {
        const fd = new FormData()
        fd.append("file", f)
        fd.append("nombre", f.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "))
        if (extraField) fd.append(extraField.name, extraField.value)
        await sigApi.post(uploadUrl, fd, { headers: { "Content-Type": "multipart/form-data" } })
      } catch (e) {
        errors.push(`${f.name}: ${getErr(e, "no se pudo guardar")}`)
      }
      setBatchProgress({ done: i + 1, total: files.length })
    }
    qc.invalidateQueries({ queryKey })
    setBatchProgress(null)
    setBatchErrors(errors)
  }

  async function handleSave() {
    if (!file) { setError("Selecciona un archivo primero."); return }
    if (!nombre.trim()) { setError("El nombre es obligatorio."); return }

    setSubmitting(true)
    setError("")
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("nombre", nombre.trim())
      if (extraField) fd.append(extraField.name, extraField.value)
      if (instructivoOptions && instructivoId) fd.append("instructivoId", instructivoId)

      await sigApi.post(uploadUrl, fd, { headers: { "Content-Type": "multipart/form-data" } })
      qc.invalidateQueries({ queryKey })
      setVisible(false)
      setFile(null)
      setNombre("")
      setInstructivoId("")
    } catch (e) {
      setError(getErr(e, "No se pudo guardar."))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDownload(item: SigAnexoItem) {
    setDownloading(item.id)
    try {
      const res = await sigApi.get(`${archivoUrlBase}/${item.id}/archivo`, { responseType: "blob" })
      const url = URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement("a")
      a.href = url
      a.download = item.nombreArchivo
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      setError("No se pudo descargar el archivo.")
    } finally {
      setDownloading(null)
    }
  }

  async function handleDelete(id: number) {
    setDeleting(id)
    setConfirmDeleteId(null)
    try {
      await sigApi.delete(`${deleteUrlBase}/${id}`)
      qc.invalidateQueries({ queryKey })
    } catch {
      // silent
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto bg-white">
    <div className="max-w-3xl mx-auto px-8 py-8">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          if (files.length === 1) handleFile(files[0])
          else if (files.length > 1) void handleFilesBatch(files)
          e.target.value = ""
        }}
      />

      <div className="flex items-start justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <Paperclip className="h-4 w-4 text-zinc-400" />
          <span className="text-[13px] font-mono font-semibold text-zinc-600">{title}</span>
          {items.length > 0 && (
            <span className="text-[11px] font-mono px-1.5 py-0.5 rounded border border-zinc-200 text-zinc-400">
              {items.length}
            </span>
          )}
        </div>
        {canEdit && (
          <button
            onClick={() => (visible ? null : fileInputRef.current?.click())}
            disabled={visible || !!batchProgress}
            title="Podés seleccionar varios archivos a la vez"
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono font-semibold
                       border border-helix-accent/30 text-helix-accent hover:bg-helix-accent/5
                       transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus className="h-3 w-3" />
            Agregar
          </button>
        )}
      </div>

      {batchProgress && (
        <div className="mb-4 flex items-center gap-2 px-3 py-2.5 rounded-lg bg-helix-accent/5 border border-helix-accent/20">
          <Loader className="h-3.5 w-3.5 text-helix-accent animate-spin shrink-0" />
          <span className="text-[11px] text-zinc-600 font-mono">
            Subiendo {batchProgress.done}/{batchProgress.total}…
          </span>
        </div>
      )}

      {batchErrors.length > 0 && (
        <div className="mb-4 space-y-1.5">
          {batchErrors.map((msg, i) => (
            <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200">
              <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-red-600 flex-1">{msg}</p>
              <button
                onClick={() => setBatchErrors((e) => e.filter((_, j) => j !== i))}
                className="text-red-400 hover:text-red-600 shrink-0"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {visible && canEdit && (
        <div className="mb-4 rounded-xl border border-helix-accent/25 bg-helix-accent/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-3.5 w-3.5 text-helix-accent" />
              <p className="text-[12px] font-semibold text-zinc-700 font-mono">Nuevo documento</p>
            </div>
            <button
              onClick={() => { setVisible(false); setFile(null); setNombre(""); setError("") }}
              className="p-1 rounded text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {file && (
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white border border-zinc-200">
              <Paperclip className="h-3 w-3 text-zinc-400 shrink-0" />
              <span className="text-[11px] text-zinc-600 truncate font-mono">{file.name}</span>
              <span className="ml-auto text-[11px] text-zinc-400 font-mono tabular-nums">
                {(file.size / 1024).toFixed(0)} KB
              </span>
            </div>
          )}

          {instructivoOptions && (
            <div>
              <label className="text-[11px] text-zinc-400 uppercase tracking-widest font-mono block mb-1">
                Instructivo (opcional)
              </label>
              <select
                value={instructivoId}
                onChange={(e) => setInstructivoId(e.target.value)}
                className="w-full bg-white border border-zinc-200 rounded-lg px-2.5 py-1.5 text-[12px] text-zinc-700 font-mono focus:outline-none focus:ring-1 focus:ring-helix-accent/40"
              >
                <option value="">— Sin instructivo —</option>
                {instructivoOptions.map((i) => (
                  <option key={i.id} value={i.id}>{i.codigo} — {i.titulo}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="text-[11px] text-zinc-400 uppercase tracking-widest font-mono block mb-1">
              Nombre *
            </label>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full bg-white border border-zinc-200 rounded-lg px-2.5 py-1.5 text-[12px] text-zinc-700 font-mono placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-helix-accent/40"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 px-2.5 py-2 rounded-lg bg-red-50 border border-red-200">
              <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-red-600">{error}</p>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => { setVisible(false); setFile(null); setNombre(""); setError("") }}
              className="flex-1 py-1.5 rounded-lg text-[11px] font-mono border border-zinc-200 text-zinc-500 hover:bg-zinc-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => void handleSave()}
              disabled={submitting}
              className="flex-1 py-1.5 rounded-lg text-[11px] font-mono font-semibold bg-helix-accent text-white hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {submitting
                ? <><Loader className="h-3 w-3 animate-spin" /> Subiendo…</>
                : <><FileCheck className="h-3 w-3" /> Guardar</>
              }
            </button>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-8 gap-2 text-zinc-400">
          <Loader className="h-4 w-4 animate-spin" />
          <span className="text-xs font-mono">Cargando…</span>
        </div>
      )}

      {!isLoading && items.length === 0 && canEdit && !visible && (
        <div className="flex flex-col items-center justify-center py-10 gap-3 rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50">
          <Paperclip className="h-8 w-8 text-zinc-300" />
          <div className="text-center space-y-1">
            <p className="text-[12px] font-mono text-zinc-500">Sin documentos</p>
            <p className="text-[11px] text-zinc-400 max-w-[280px] leading-relaxed">{emptyText}</p>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono font-semibold
                       border border-helix-accent/30 text-helix-accent hover:bg-helix-accent/5 transition-colors"
          >
            <Upload className="h-3 w-3" />
            Cargar primer documento
          </button>
        </div>
      )}

      {!isLoading && items.length === 0 && !canEdit && (
        <p className="text-[11px] text-zinc-400 text-center py-10">{emptyText}</p>
      )}

      {!isLoading && items.length > 0 && (
        <div className="space-y-2">
          {error && !visible && (
            <div className="flex items-start gap-2 px-2.5 py-2 rounded-lg bg-red-50 border border-red-200" aria-live="polite">
              <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-red-600">{error}</p>
            </div>
          )}
          {items.map((item) => (
            <div
              key={item.id}
              className="group flex items-center gap-3 px-4 py-3 border border-zinc-200 rounded-lg bg-white hover:border-zinc-300 hover:shadow-sm transition-all"
            >
              <FileText className="h-4 w-4 text-zinc-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[12px] font-mono font-semibold text-zinc-700">{item.nombre}</span>
                  {instructivoOptions && canEdit && editingInstructivoFor === item.id ? (
                    <select
                      autoFocus
                      value={item.instructivo ? instructivoOptions.find((o) => o.codigo === item.instructivo!.codigo)?.id ?? "" : ""}
                      onChange={(e) => {
                        updateInstructivoMutation.mutate({
                          id: item.id,
                          instructivoId: e.target.value ? Number(e.target.value) : null,
                        })
                      }}
                      onBlur={() => setEditingInstructivoFor(null)}
                      disabled={updateInstructivoMutation.isPending}
                      onClick={(e) => e.stopPropagation()}
                      className="text-[10px] font-mono px-1 py-px rounded border border-helix-accent/40 bg-white text-zinc-600 max-w-[160px]"
                    >
                      <option value="">— Sin instructivo —</option>
                      {instructivoOptions.map((o) => (
                        <option key={o.id} value={o.id}>{o.codigo} — {o.titulo}</option>
                      ))}
                    </select>
                  ) : item.instructivo ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); instructivoOptions && canEdit && setEditingInstructivoFor(item.id) }}
                      title={`${item.instructivo.titulo}${instructivoOptions && canEdit ? " — click para cambiar" : ""}`}
                      className="text-[10px] font-mono px-1.5 py-px rounded bg-zinc-100 text-zinc-500 truncate max-w-[140px] hover:bg-zinc-200 transition-colors"
                    >
                      {item.instructivo.codigo}
                    </button>
                  ) : (
                    instructivoOptions && canEdit && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditingInstructivoFor(item.id) }}
                        title="Asociar a un instructivo"
                        className="flex items-center gap-1 text-[10px] font-mono px-1.5 py-px rounded border border-dashed border-zinc-300 text-zinc-400 hover:border-helix-accent/40 hover:text-helix-accent transition-colors"
                      >
                        <Pencil className="h-2.5 w-2.5" />
                        Sin instructivo
                      </button>
                    )
                  )}
                </div>
                <p className="text-[11px] text-zinc-400 truncate mt-0.5">{item.nombreArchivo}</p>
              </div>
              <button
                onClick={() => void handleDownload(item)}
                disabled={downloading === item.id}
                className="shrink-0 p-1.5 rounded text-zinc-300 hover:text-helix-accent hover:bg-helix-accent/5 transition-colors disabled:opacity-40"
                title="Descargar"
                aria-label={`Descargar ${item.nombre}`}
              >
                {downloading === item.id
                  ? <Loader className="h-3.5 w-3.5 animate-spin" />
                  : <Download className="h-3.5 w-3.5" />
                }
              </button>
              {canEdit && (
                confirmDeleteId === item.id ? (
                  <div className="flex items-center gap-1 shrink-0">
                    <AlertTriangle className="h-2.5 w-2.5 text-amber-500" />
                    <button
                      onClick={() => void handleDelete(item.id)}
                      disabled={deleting === item.id}
                      className="text-[11px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 border border-red-200 hover:bg-red-500/20 font-mono"
                    >
                      {deleting === item.id ? "…" : "Sí"}
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="text-[11px] px-1 py-0.5 rounded text-zinc-400 hover:text-zinc-600 font-mono"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteId(item.id)}
                    disabled={!!deleting}
                    className="opacity-0 group-hover:opacity-100 shrink-0 p-1.5 rounded hover:bg-red-50 text-zinc-300 hover:text-red-400 transition-all"
                  >
                    {deleting === item.id ? <Loader className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                )
              )}
            </div>
          ))}
        </div>
      )}
    </div>
    </div>
  )
}
