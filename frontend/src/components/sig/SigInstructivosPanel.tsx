import { useEffect, useRef, useState } from "react"
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query"
import { sigApi } from "@/lib/sigApi"
import { cn } from "@/lib/utils"
import {
  BookOpen, Plus, FileText, Trash2, Loader, AlertCircle, AlertTriangle,
  X, FileCheck, Upload, FolderOpen, Paperclip,
  Download, RefreshCw, ChevronRight,
} from "lucide-react"

const MAX_INSTRUCTIVOS = 20

export interface SigInstructivo {
  id: number
  procedimientoId: number
  codigo: string
  titulo: string
  descripcion: string | null
  contenido: string
  versionDoc: string
  autorNombre: string
  createdAt: string
  archivoOriginal: string | null
  nombreArchivo: string | null
  tipoMime: string | null
}

interface Props {
  procedimientoId: number
  procCodigo?: string
  canEdit?: boolean
  onSelectInst?: (inst: SigInstructivo) => void
}

interface FormState {
  visible: boolean
  file: File | null
  fileName: string
  codigo: string
  titulo: string
  descripcion: string
  versionDoc: string
  error: string
  submitting: boolean
  warnings: string[]
}

const FORM_DEFAULT: FormState = {
  visible: false, file: null, fileName: "", codigo: "",
  titulo: "", descripcion: "", versionDoc: "1.0", error: "", submitting: false, warnings: [],
}

const SUPPORTED_ACCEPT = ".md,.markdown,.txt,.docx,.pdf,.doc"

function getErr(e: unknown, fallback: string): string {
  const data = (e as { response?: { data?: { error?: string | { message?: string } } } })?.response?.data
  if (typeof data?.error === "string") return data.error
  return fallback
}

export const PROSE = `prose prose-sm max-w-none
  prose-headings:font-mono prose-headings:text-zinc-700 prose-headings:font-semibold prose-headings:text-[13px]
  prose-p:text-zinc-600 prose-p:text-[13px] prose-p:leading-relaxed
  prose-strong:text-zinc-800 prose-strong:font-semibold
  prose-li:text-zinc-600 prose-li:text-[13px] prose-li:leading-relaxed
  prose-ul:space-y-1.5 prose-ol:space-y-1.5 prose-ul:my-3 prose-ol:my-3
  prose-code:text-helix-ai prose-code:bg-zinc-100 prose-code:px-1 prose-code:rounded prose-code:text-[11px]
  prose-table:text-[12px] prose-th:text-zinc-600 prose-th:font-mono prose-th:font-semibold prose-th:text-[11px] prose-th:border prose-th:border-zinc-200 prose-th:px-3 prose-th:py-1.5 prose-th:bg-zinc-50
  prose-td:text-zinc-600 prose-td:text-[12px] prose-td:border prose-td:border-zinc-100 prose-td:px-3 prose-td:py-1.5
  prose-hr:border-zinc-200`

export function SigInstructivosPanel({ procedimientoId, procCodigo, canEdit = false, onSelectInst }: Props) {
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLDivElement>(null)

  const [form, setForm] = useState<FormState>(FORM_DEFAULT)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)

  const { data: instructivos = [], isLoading } = useQuery<SigInstructivo[]>({
    queryKey: ["sig", "instructivos", procedimientoId],
    queryFn: () =>
      sigApi.get(`/api/instructivos?procedimientoId=${procedimientoId}&activo=true`).then((r) => r.data),
  })

  const atLimit = instructivos.length >= MAX_INSTRUCTIVOS
  const showSection = canEdit || isLoading || instructivos.length > 0

  if (!showSection) return null

  function handleFile(file: File) {
    const lower = file.name.toLowerCase()
    const allowed = [".md", ".markdown", ".txt", ".docx", ".pdf", ".doc"]
    if (!allowed.some((ext) => lower.endsWith(ext))) {
      setForm((f) => ({ ...f, error: "Formato no soportado. Usa MD, TXT, DOCX, PDF o DOC." }))
      return
    }
    const baseName = file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ")
    setForm((f) => ({
      ...f,
      visible: true,
      file,
      fileName: file.name,
      titulo: baseName,
      codigo: "",
      error: "",
      warnings: [],
    }))
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 100)
  }

  function openFilePicker() {
    if (atLimit || form.visible) return
    fileInputRef.current?.click()
  }

  async function handleSave() {
    const { file, codigo, titulo, descripcion, versionDoc } = form
    if (!file) {
      setForm((f) => ({ ...f, error: "Selecciona un archivo primero." }))
      return
    }
    if (!codigo.trim()) {
      setForm((f) => ({ ...f, error: "El código es obligatorio (ej. INS-OP-001)." }))
      return
    }
    if (!titulo.trim()) {
      setForm((f) => ({ ...f, error: "El título es obligatorio." }))
      return
    }
    if (atLimit) {
      setForm((f) => ({ ...f, error: `Límite de ${MAX_INSTRUCTIVOS} documentos por procedimiento.` }))
      return
    }

    setForm((f) => ({ ...f, submitting: true, error: "" }))

    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("procedimientoId", String(procedimientoId))
      fd.append("codigo", codigo.trim().toUpperCase())
      fd.append("titulo", titulo.trim())
      if (descripcion.trim()) fd.append("descripcion", descripcion.trim())
      fd.append("versionDoc", versionDoc.trim() || "1.0")

      const res = await sigApi.post("/api/instructivos/upload", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      })

      const warnings: string[] = res.data?.warnings ?? []
      qc.invalidateQueries({ queryKey: ["sig", "instructivos", procedimientoId] })
      setForm({ ...FORM_DEFAULT, visible: false })

      if (warnings.length > 0) {
        setForm((f) => ({ ...f, warnings }))
      }
    } catch (e) {
      setForm((f) => ({ ...f, submitting: false, error: getErr(e, "No se pudo guardar.") }))
    }
  }

  const reextractMutation = useMutation({
    mutationFn: (id: number) => sigApi.post(`/api/instructivos/${id}/reextract`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sig", "instructivos", procedimientoId] }),
  })

  async function handleDelete(id: number) {
    setDeleting(id)
    setConfirmDeleteId(null)
    try {
      await sigApi.delete(`/api/instructivos/${id}`)
      qc.invalidateQueries({ queryKey: ["sig", "instructivos", procedimientoId] })
    } catch {
      // silent
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="mt-12 pt-8 border-t border-zinc-100">
      <input
        ref={fileInputRef}
        type="file"
        accept={SUPPORTED_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
          e.target.value = ""
        }}
      />

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-zinc-400" />
            <span className="text-[13px] font-mono font-semibold text-zinc-600">Documentos de soporte</span>
            {instructivos.length > 0 && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-zinc-200 text-zinc-400">
                {instructivos.length}
              </span>
            )}
          </div>
          <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed max-w-md">
            Instructivos, guías o normas que complementan
            {procCodigo ? ` ${procCodigo}` : " este procedimiento"}.
          </p>
        </div>

        {canEdit && (
          <button
            onClick={openFilePicker}
            disabled={form.visible || atLimit}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono font-semibold
                       border border-helix-accent/30 text-helix-accent hover:bg-helix-accent/5
                       transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus className="h-3 w-3" />
            Agregar documento
          </button>
        )}
      </div>

      {/* Capacity bar */}
      {canEdit && instructivos.length > 0 && (
        <div className="flex items-center gap-2 mb-4">
          <div className="flex-1 h-1 rounded-full bg-zinc-100">
            <div
              className="h-1 rounded-full bg-helix-done/60 transition-all duration-500"
              style={{ width: `${(instructivos.length / MAX_INSTRUCTIVOS) * 100}%` }}
            />
          </div>
          <span className="text-[10px] text-zinc-400 font-mono tabular-nums">
            {instructivos.length} / {MAX_INSTRUCTIVOS}
          </span>
        </div>
      )}

      {/* Post-save warnings */}
      {form.warnings.length > 0 && (
        <div className="mb-4 space-y-1.5">
          {form.warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-700">{w}</p>
            </div>
          ))}
        </div>
      )}

      {/* Upload form */}
      {form.visible && canEdit && (
        <div
          ref={formRef}
          className="mb-4 rounded-xl border border-helix-accent/25 bg-helix-accent/5 p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-3.5 w-3.5 text-helix-accent" />
              <p className="text-[12px] font-semibold text-zinc-700 font-mono">Nuevo documento</p>
            </div>
            <button
              onClick={() => setForm(FORM_DEFAULT)}
              className="p-1 rounded text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {form.fileName && (
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white border border-zinc-200">
              <FolderOpen className="h-3 w-3 text-zinc-400 shrink-0" />
              <span className="text-[11px] text-zinc-600 truncate font-mono">{form.fileName}</span>
              <span className="ml-auto text-[10px] text-zinc-400 font-mono tabular-nums">
                {(form.file?.size ? (form.file.size / 1024).toFixed(0) : "?")} KB
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Field label="Código *">
              <input
                value={form.codigo}
                onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value.toUpperCase() }))}
                placeholder="INS-OP-001"
                className={inputCls}
              />
            </Field>
            <Field label="Versión">
              <input
                value={form.versionDoc}
                onChange={(e) => setForm((f) => ({ ...f, versionDoc: e.target.value }))}
                placeholder="1.0"
                className={inputCls}
              />
            </Field>
          </div>

          <Field label="Título *">
            <input
              value={form.titulo}
              onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
              placeholder="Ej. Instructivo de recepción de muestras"
              className={inputCls}
            />
          </Field>

          <Field label="Descripción (opcional)">
            <input
              value={form.descripcion}
              onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
              placeholder="Propósito o alcance de este documento"
              className={inputCls}
            />
          </Field>

          {form.error && (
            <div className="flex items-start gap-2 px-2.5 py-2 rounded-lg bg-red-50 border border-red-200">
              <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-red-600">{form.error}</p>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => setForm(FORM_DEFAULT)}
              className="flex-1 py-1.5 rounded-lg text-[11px] font-mono border border-zinc-200 text-zinc-500 hover:bg-zinc-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => void handleSave()}
              disabled={form.submitting}
              className="flex-1 py-1.5 rounded-lg text-[11px] font-mono font-semibold bg-helix-accent text-white hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {form.submitting
                ? <><Loader className="h-3 w-3 animate-spin" /> Subiendo…</>
                : <><FileCheck className="h-3 w-3" /> Guardar documento</>
              }
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-8 gap-2 text-zinc-400">
          <Loader className="h-4 w-4 animate-spin" />
          <span className="text-xs font-mono">Cargando documentos…</span>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && instructivos.length === 0 && canEdit && !form.visible && (
        <div className="flex flex-col items-center justify-center py-10 gap-3 rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50">
          <BookOpen className="h-8 w-8 text-zinc-300" />
          <div className="text-center space-y-1">
            <p className="text-[12px] font-mono text-zinc-500">Sin documentos de soporte</p>
            <p className="text-[11px] text-zinc-400 max-w-[260px] leading-relaxed">
              Agrega instructivos o guías que complementen el procedimiento. No es obligatorio.
            </p>
          </div>
          <button
            onClick={openFilePicker}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono font-semibold
                       border border-helix-accent/30 text-helix-accent hover:bg-helix-accent/5 transition-colors"
          >
            <Upload className="h-3 w-3" />
            Cargar primer documento
          </button>
        </div>
      )}

      {/* Compact list */}
      {!isLoading && instructivos.length > 0 && (
        <div className="space-y-2">
          {instructivos.map((inst) => (
            <div
              key={inst.id}
              onClick={() => onSelectInst?.(inst)}
              className="group flex items-center gap-3 px-4 py-3 border border-zinc-200 rounded-lg bg-white hover:border-zinc-300 hover:shadow-sm cursor-pointer transition-all"
            >
              <FileText className="h-4 w-4 text-zinc-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-mono font-semibold text-zinc-700">{inst.codigo}</span>
                  <span className="text-[10px] font-mono text-zinc-400">v{inst.versionDoc}</span>
                  {inst.archivoOriginal && !inst.tipoMime?.startsWith("text/") && (
                    <span className="text-[9px] font-mono px-1.5 py-px rounded bg-zinc-100 text-zinc-500">
                      {inst.tipoMime === "application/pdf" ? "PDF" : inst.tipoMime?.includes("docx") ? "DOCX" : "DOC"}
                    </span>
                  )}
                  {!inst.contenido.trim() && (
                    <span className="text-[9px] font-mono px-1.5 py-px rounded bg-amber-100 text-amber-600">sin texto</span>
                  )}
                </div>
                <p className="text-[12px] text-zinc-500 truncate mt-0.5">{inst.titulo}</p>
              </div>

              {/* Re-extract button for empty contenido */}
              {!inst.contenido.trim() && inst.archivoOriginal && (
                <button
                  onClick={(e) => { e.stopPropagation(); reextractMutation.mutate(inst.id) }}
                  disabled={reextractMutation.isPending}
                  title="Re-extraer texto"
                  className="opacity-0 group-hover:opacity-100 shrink-0 p-1.5 rounded hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-all"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", reextractMutation.isPending && "animate-spin")} />
                </button>
              )}

              {/* Delete button */}
              {canEdit && (
                confirmDeleteId === inst.id ? (
                  <div
                    className="flex items-center gap-1 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <AlertTriangle className="h-2.5 w-2.5 text-amber-500" />
                    <button
                      onClick={() => void handleDelete(inst.id)}
                      disabled={deleting === inst.id}
                      className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 border border-red-200 hover:bg-red-500/20 font-mono"
                    >
                      {deleting === inst.id ? "…" : "Sí"}
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="text-[9px] px-1 py-0.5 rounded text-zinc-400 hover:text-zinc-600 font-mono"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(inst.id) }}
                    disabled={!!deleting}
                    className="opacity-0 group-hover:opacity-100 shrink-0 p-1.5 rounded hover:bg-red-50 text-zinc-300 hover:text-red-400 transition-all"
                  >
                    {deleting === inst.id ? <Loader className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                )
              )}

              <ChevronRight className="h-3.5 w-3.5 text-zinc-300 shrink-0" />
            </div>
          ))}
        </div>
      )}

      {atLimit && canEdit && (
        <div className="flex items-center gap-2 px-3 py-2 mt-3 rounded-lg bg-amber-50 border border-amber-200">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
          <p className="text-[11px] text-amber-700 font-mono">
            Límite de {MAX_INSTRUCTIVOS} documentos alcanzado. Elimina uno para agregar más.
          </p>
        </div>
      )}

      {canEdit && (
        <p className="text-[10px] text-zinc-400 text-center mt-4 font-mono opacity-70">
          Formatos: MD · TXT · DOCX · PDF · DOC
        </p>
      )}
    </div>
  )
}

// ── Archivo original viewer ───────────────────────────────────────────────────

export function InstructivoArchivoView({ inst }: { inst: SigInstructivo }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [arrayBuffer, setArrayBuffer] = useState<ArrayBuffer | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const docxRef = useRef<HTMLDivElement>(null)

  const isPdf  = inst.tipoMime === "application/pdf"
  const isDocx = inst.tipoMime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

  useEffect(() => {
    let blobUrl: string | null = null
    setLoading(true)
    setError(null)
    setObjectUrl(null)
    setArrayBuffer(null)

    sigApi.get(`/api/instructivos/${inst.id}/archivo`, { responseType: "blob" })
      .then(async (res) => {
        const blob: Blob = res.data
        blobUrl = URL.createObjectURL(blob)
        setObjectUrl(blobUrl)
        if (isDocx) {
          const ab = await blob.arrayBuffer()
          setArrayBuffer(ab)
        }
      })
      .catch(() => setError("No se pudo cargar el archivo."))
      .finally(() => setLoading(false))

    return () => { if (blobUrl) URL.revokeObjectURL(blobUrl) }
  }, [inst.id, isDocx])

  useEffect(() => {
    if (!isDocx || !arrayBuffer || !docxRef.current) return
    import("docx-preview").then(({ renderAsync }) => {
      renderAsync(arrayBuffer, docxRef.current!, undefined, {
        className: "docx-render",
        inWrapper: false,
      }).catch(() => setError("No se pudo renderizar el documento Word."))
    })
  }, [arrayBuffer, isDocx])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center gap-2 text-zinc-400 bg-white">
        <div className="h-3 w-3 rounded-full border border-zinc-300 border-t-zinc-600 animate-spin" />
        <span className="text-xs font-mono">Cargando archivo…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-white">
        <AlertCircle className="h-5 w-5 text-zinc-300" />
        <p className="text-sm text-zinc-400 font-mono">{error}</p>
      </div>
    )
  }

  if (isPdf && objectUrl) {
    return (
      <div className="flex-1 overflow-hidden bg-zinc-100">
        <iframe
          src={objectUrl}
          className="w-full h-full border-0"
          title={inst.nombreArchivo ?? "Archivo PDF"}
        />
      </div>
    )
  }

  if (isDocx) {
    return (
      <div className="flex-1 overflow-auto bg-white p-6">
        <div ref={docxRef} className="max-w-3xl mx-auto" />
      </div>
    )
  }

  // .doc u otro — descarga
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-white">
      <Paperclip className="h-8 w-8 text-zinc-300" />
      <div className="text-center">
        <p className="text-sm font-mono text-zinc-600">{inst.nombreArchivo ?? "Archivo"}</p>
        <p className="text-[11px] text-zinc-400 mt-1">Este formato no puede mostrarse en el navegador.</p>
      </div>
      {objectUrl && (
        <a
          href={objectUrl}
          download={inst.nombreArchivo ?? "archivo"}
          className="flex items-center gap-1.5 text-[11px] px-3 py-2 rounded border border-zinc-200 text-zinc-600 hover:border-zinc-400 hover:text-zinc-900 transition-colors font-mono"
        >
          <Download className="h-3.5 w-3.5" />
          Descargar {inst.nombreArchivo}
        </a>
      )}
    </div>
  )
}

const inputCls =
  "w-full bg-white border border-zinc-200 rounded-lg px-2.5 py-1.5 text-[12px] text-zinc-700 font-mono placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-helix-accent/40 transition-colors"

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] text-zinc-400 uppercase tracking-widest font-mono block mb-1">{label}</label>
      {children}
    </div>
  )
}
