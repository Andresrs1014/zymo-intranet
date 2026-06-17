import { useEffect, useMemo, useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { sigApi } from "@/lib/sigApi"
import { useAuthStore } from "@/store/authStore"
import { cn } from "@/lib/utils"
import { extractTextFromFile, isAnalyzableFile, SUPPORTED_ACCEPT } from "@/lib/sigDocExtract"
import {
  X, Plus, Layers, FileText, FolderOpen, Loader, AlertTriangle,
  CheckCircle, UploadCloud, Eye, EyeOff, ChevronLeft, GitCommit,
} from "lucide-react"

// ── Types ───────────────────────────────────────────────────────────────────

interface SigArea {
  id: number
  nombre: string
  color: string
  _count?: { procedimientos: number }
}

interface SigProcedimiento {
  id: number
  areaId: number
  codigo: string
  titulo: string
  estado: "BORRADOR" | "VIGENTE" | "OBSOLETO"
}

export interface PreselectedProc {
  id: number
  codigo: string
  titulo: string
  areaId: number
  areaNombre: string
  areaColor: string
}

interface Props {
  /** Si se pasa, el modal carga una nueva versión de un procedimiento existente. */
  preselected?: PreselectedProc | null
  onClose: () => void
  onSuccess?: (commitId: number) => void
}

type Step = "select" | "create-area" | "create-proc" | "load-file" | "commit" | "done"

const COLORS = [
  "#ef3340", "#3b82f6", "#10b981", "#f59e0b",
  "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16",
]

function getErr(e: unknown, fallback: string): string {
  return (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SigCargarModal({ preselected, onClose, onSuccess }: Props) {
  const user = useAuthStore((s) => s.user)
  const isManager = user?.role === "admin" || user?.role === "gerente"
  const qc = useQueryClient()

  const [step, setStep] = useState<Step>(preselected ? "load-file" : "select")

  // ── Selection state ─────────────────────────────────────────────────────────
  const [areaId, setAreaId] = useState<number | null>(preselected?.areaId ?? null)
  const [proc, setProc] = useState<SigProcedimiento | null>(
    preselected
      ? { id: preselected.id, areaId: preselected.areaId, codigo: preselected.codigo, titulo: preselected.titulo, estado: "VIGENTE" }
      : null,
  )

  // ── Create-area state ─────────────────────────────────────────────────────────
  const [areaNombre, setAreaNombre] = useState("")
  const [areaColor, setAreaColor] = useState(COLORS[0])
  const [creatingArea, setCreatingArea] = useState(false)

  // ── Create-proc state ─────────────────────────────────────────────────────────
  const [codigo, setCodigo] = useState("")
  const [titulo, setTitulo] = useState("")
  const [descripcion, setDescripcion] = useState("")
  const [creatingProc, setCreatingProc] = useState(false)

  // ── File state ──────────────────────────────────────────────────────────────
  const [fileName, setFileName] = useState<string | null>(null)
  const [content, setContent] = useState("")
  const [extracting, setExtracting] = useState(false)
  const [fileError, setFileError] = useState("")
  const [showPreview, setShowPreview] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Commit state ──────────────────────────────────────────────────────────────
  const [mensaje, setMensaje] = useState("")
  const [versionDoc, setVersionDoc] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [commitId, setCommitId] = useState<number | null>(null)
  const [error, setError] = useState("")

  // ── Queries ───────────────────────────────────────────────────────────────────
  const { data: areas = [] } = useQuery<SigArea[]>({
    queryKey: ["sig", "areas"],
    queryFn: async () => (await sigApi.get("/api/areas")).data,
  })

  const { data: procs = [] } = useQuery<SigProcedimiento[]>({
    queryKey: ["sig", "procs-by-area", areaId],
    queryFn: async () => (await sigApi.get(`/api/procedimientos?areaId=${areaId}`)).data,
    enabled: areaId != null && !preselected,
  })

  const selectedArea = useMemo<{ nombre: string; color: string } | null>(() => {
    if (preselected) return { nombre: preselected.areaNombre, color: preselected.areaColor }
    return areas.find((a) => a.id === areaId) ?? null
  }, [areas, areaId, preselected])

  // Mensaje por defecto al fijar el procedimiento destino
  useEffect(() => {
    if (proc && !mensaje) {
      setMensaje(preselected ? `Nueva versión de ${proc.codigo}` : `Carga inicial de ${proc.codigo}`)
    }
  }, [proc, preselected, mensaje])

  // ── Handlers ────────────────────────────────────────────────────────────────
  async function handleCreateArea() {
    if (!areaNombre.trim()) return
    setCreatingArea(true)
    setError("")
    try {
      const res = await sigApi.post("/api/areas", { nombre: areaNombre.trim(), color: areaColor })
      await qc.invalidateQueries({ queryKey: ["sig", "areas"] })
      setAreaId(res.data.id)
      setAreaNombre("")
      setStep("create-proc")
    } catch (e) {
      setError(getErr(e, "Error al crear el área"))
    } finally {
      setCreatingArea(false)
    }
  }

  async function handleCreateProc() {
    if (areaId == null || !codigo.trim() || !titulo.trim()) return
    setCreatingProc(true)
    setError("")
    try {
      const res = await sigApi.post("/api/procedimientos", {
        areaId,
        codigo: codigo.trim().toUpperCase(),
        titulo: titulo.trim(),
        descripcion: descripcion.trim() || undefined,
      })
      await qc.invalidateQueries({ queryKey: ["sig", "procs-by-area", areaId] })
      await qc.invalidateQueries({ queryKey: ["sig", "areas"] })
      setProc(res.data)
      setMensaje(`Carga inicial de ${res.data.codigo}`)
      setVersionDoc("1.0")
      setStep("load-file")
    } catch (e) {
      setError(getErr(e, "Error al crear el procedimiento"))
    } finally {
      setCreatingProc(false)
    }
  }

  async function handleFile(file: File) {
    if (!isAnalyzableFile(file.name)) {
      setFileError("Formato no soportado. Usa MD, TXT, DOCX o PDF.")
      return
    }
    setExtracting(true)
    setFileError("")
    try {
      const text = await extractTextFromFile(file)
      setContent(text)
      setFileName(file.name)
    } catch (e) {
      setFileError(e instanceof Error ? e.message : "Error al leer el archivo")
      setContent("")
      setFileName(null)
    } finally {
      setExtracting(false)
    }
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) void handleFile(file)
    e.target.value = ""
  }

  async function handleSubmit() {
    if (!proc || !mensaje.trim() || !content) return
    setSubmitting(true)
    setError("")
    try {
      const res = await sigApi.post("/api/commits", {
        procedimientoId: proc.id,
        contenidoOriginal: content,
        contenidoAgente: content,
        mensaje: mensaje.trim(),
        versionDoc: versionDoc.trim() || undefined,
      })
      // Refrescar todo lo que depende de este procedimiento / commits
      qc.invalidateQueries({ queryKey: ["sig", "procedimiento", proc.id] })
      qc.invalidateQueries({ queryKey: ["sig", "commits-by-proc", proc.id] })
      qc.invalidateQueries({ queryKey: ["sig", "procs-by-area", proc.areaId] })
      qc.invalidateQueries({ queryKey: ["sig", "commits", "pendientes"] })
      qc.invalidateQueries({ queryKey: ["sig", "commits", "pendientes-detail"] })
      setCommitId(res.data.id)
      setStep("done")
      onSuccess?.(res.data.id)
    } catch (e) {
      setError(getErr(e, "Error al cargar la versión"))
    } finally {
      setSubmitting(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-zinc-900/50 backdrop-blur-[1px]"
    >
      <div
        className="bg-white rounded-xl w-full max-w-md border border-zinc-200 shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-200">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-6 w-6 rounded-md bg-helix-accent/10 border border-helix-accent/20 flex items-center justify-center shrink-0">
              <UploadCloud className="h-3.5 w-3.5 text-helix-accent" />
            </div>
            <span className="text-[13px] font-semibold text-zinc-800 font-mono">
              {preselected ? "Cargar nueva versión" : "Cargar procedimiento"}
            </span>
            {selectedArea && (
              <span
                className="flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full border font-mono shrink-0"
                style={{ color: selectedArea.color, borderColor: `${selectedArea.color}40`, backgroundColor: `${selectedArea.color}10` }}
              >
                <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: selectedArea.color }} />
                {selectedArea.nombre}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="h-6 w-6 flex items-center justify-center rounded text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="p-5 min-h-[180px]">
          {/* ── SELECT ───────────────────────────────────────────────────────── */}
          {step === "select" && (
            <div className="space-y-4">
              <p className="text-xs text-zinc-500 leading-relaxed">
                Selecciona el procedimiento destino. Cada carga genera una versión que
                {isManager ? " queda vigente" : " entra a la cola de revisión del gerente"}.
              </p>

              {/* Área */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] text-zinc-400 uppercase tracking-widest font-mono">Área</label>
                  <button
                    onClick={() => { setError(""); setStep("create-area") }}
                    className="flex items-center gap-1 text-[10px] text-helix-accent hover:opacity-80 transition-opacity font-mono"
                  >
                    <Plus className="h-2.5 w-2.5" /> Nueva área
                  </button>
                </div>
                <select
                  value={areaId ?? ""}
                  onChange={(e) => { setAreaId(e.target.value ? Number(e.target.value) : null); setProc(null) }}
                  className="w-full bg-zinc-50 border border-zinc-200 hover:border-zinc-300 rounded-lg px-3 py-2 text-xs text-zinc-700 font-mono focus:outline-none focus:ring-1 focus:ring-helix-accent/40 transition-colors"
                >
                  <option value="">Seleccionar área…</option>
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>{a.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Procedimiento */}
              {areaId != null && (
                <div>
                  <label className="text-[10px] text-zinc-400 uppercase tracking-widest font-mono block mb-1.5">Procedimiento</label>
                  <select
                    value={proc?.id ?? ""}
                    onChange={(e) => {
                      if (e.target.value === "new") {
                        setProc(null)
                        setError("")
                        setStep("create-proc")
                        return
                      }
                      const p = procs.find((x) => x.id === Number(e.target.value)) ?? null
                      setProc(p)
                      if (p) { setMensaje(`Carga inicial de ${p.codigo}`); setStep("load-file") }
                    }}
                    className="w-full bg-zinc-50 border border-zinc-200 hover:border-zinc-300 rounded-lg px-3 py-2 text-xs text-zinc-700 font-mono focus:outline-none focus:ring-1 focus:ring-helix-accent/40 transition-colors"
                  >
                    <option value="">Seleccionar procedimiento…</option>
                    {procs.map((p) => (
                      <option key={p.id} value={p.id}>{p.codigo} — {p.titulo}</option>
                    ))}
                    <option value="new">+ Crear nuevo procedimiento</option>
                  </select>
                </div>
              )}

              {error && <ErrorBox msg={error} />}
            </div>
          )}

          {/* ── CREATE AREA ──────────────────────────────────────────────────── */}
          {step === "create-area" && (
            <div className="space-y-3.5">
              <StepTitle icon={<Layers className="h-3 w-3 text-helix-ai" />} label="Nueva área" />
              <Field label="Nombre">
                <input
                  value={areaNombre}
                  onChange={(e) => setAreaNombre(e.target.value)}
                  placeholder="ej. Talento &amp; Cultura"
                  autoFocus
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-1.5 text-xs text-zinc-700 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-helix-accent/40 transition-colors"
                />
              </Field>
              <div>
                <label className="text-[10px] text-zinc-400 uppercase tracking-widest font-mono block mb-2">Color</label>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setAreaColor(c)}
                      className="h-5 w-5 rounded-full transition-transform hover:scale-110"
                      style={{ backgroundColor: c, outline: areaColor === c ? `2px solid ${c}` : "none", outlineOffset: 2 }}
                    />
                  ))}
                </div>
              </div>
              {error && <ErrorBox msg={error} />}
              <FooterButtons
                onBack={() => setStep("select")}
                primaryLabel={creatingArea ? "Creando…" : "Crear área"}
                primaryDisabled={creatingArea || !areaNombre.trim()}
                primaryLoading={creatingArea}
                onPrimary={handleCreateArea}
              />
            </div>
          )}

          {/* ── CREATE PROC ──────────────────────────────────────────────────── */}
          {step === "create-proc" && (
            <div className="space-y-3.5">
              <StepTitle icon={<Plus className="h-3 w-3 text-helix-done" />} label="Nuevo procedimiento" />
              <Field label="Código">
                <input
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                  placeholder="ej. TC-001"
                  autoFocus
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-1.5 text-xs text-zinc-700 font-mono placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-helix-accent/40 transition-colors"
                />
              </Field>
              <Field label="Título">
                <input
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Nombre del procedimiento"
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-1.5 text-xs text-zinc-700 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-helix-accent/40 transition-colors"
                />
              </Field>
              <Field label="Descripción (opcional)">
                <input
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Descripción breve"
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-1.5 text-xs text-zinc-700 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-helix-accent/40 transition-colors"
                />
              </Field>
              {error && <ErrorBox msg={error} />}
              <FooterButtons
                onBack={() => setStep("select")}
                primaryLabel={creatingProc ? "Creando…" : "Crear y continuar"}
                primaryDisabled={creatingProc || !codigo.trim() || !titulo.trim()}
                primaryLoading={creatingProc}
                onPrimary={handleCreateProc}
              />
            </div>
          )}

          {/* ── LOAD FILE ────────────────────────────────────────────────────── */}
          {step === "load-file" && (
            <div className="space-y-4">
              <StepTitle
                icon={<FileText className="h-3 w-3 text-helix-warning" />}
                label="Cargar documento"
                hint="MD · TXT · DOCX · PDF"
              />

              <input
                ref={fileInputRef}
                type="file"
                accept={SUPPORTED_ACCEPT}
                onChange={onInputChange}
                className="hidden"
              />

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={extracting}
                className={cn(
                  "w-full flex flex-col items-center gap-2 py-7 rounded-xl border-2 border-dashed transition-colors group disabled:opacity-50",
                  fileName
                    ? "border-helix-done/40 bg-helix-done/5 hover:bg-helix-done/10"
                    : "border-zinc-200 hover:border-helix-accent/40 hover:bg-zinc-50",
                )}
              >
                {extracting ? (
                  <>
                    <Loader className="h-5 w-5 text-helix-accent animate-spin" />
                    <span className="text-xs text-zinc-500 font-mono">Extrayendo contenido…</span>
                  </>
                ) : fileName ? (
                  <>
                    <FileText className="h-5 w-5 text-helix-done" />
                    <span className="text-xs text-helix-done font-mono font-medium">{fileName}</span>
                    <span className="text-[10px] text-zinc-400 font-mono">
                      {content.length.toLocaleString()} caracteres · click para cambiar
                    </span>
                  </>
                ) : (
                  <>
                    <FolderOpen className="h-5 w-5 text-zinc-400 group-hover:text-helix-accent transition-colors" />
                    <span className="text-xs text-zinc-500 group-hover:text-zinc-700 transition-colors font-mono">
                      Click para seleccionar archivo
                    </span>
                  </>
                )}
              </button>

              {fileError && <ErrorBox msg={fileError} />}

              {content && (
                <div>
                  <button
                    onClick={() => setShowPreview((v) => !v)}
                    className="flex items-center gap-1.5 text-[10px] text-zinc-400 hover:text-zinc-600 transition-colors mb-1.5 font-mono"
                  >
                    {showPreview ? <EyeOff className="h-2.5 w-2.5" /> : <Eye className="h-2.5 w-2.5" />}
                    {showPreview ? "Ocultar vista previa" : "Ver contenido extraído"}
                  </button>
                  {showPreview && (
                    <pre className="bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-[10px] text-zinc-500 font-mono leading-relaxed overflow-auto max-h-40 whitespace-pre-wrap">
                      {content.slice(0, 1200)}{content.length > 1200 ? "\n…" : ""}
                    </pre>
                  )}
                </div>
              )}

              <FooterButtons
                onBack={preselected ? undefined : () => setStep("select")}
                primaryLabel="Continuar"
                primaryDisabled={!content}
                onPrimary={() => setStep("commit")}
              />
            </div>
          )}

          {/* ── COMMIT ───────────────────────────────────────────────────────── */}
          {step === "commit" && proc && (
            <div className="space-y-3.5">
              {/* Destino */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-50 border border-zinc-200">
                {selectedArea && (
                  <div className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: selectedArea.color }} />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-mono mb-0.5">Procedimiento destino</p>
                  <p className="text-xs font-mono text-helix-accent font-semibold">{proc.codigo}</p>
                  <p className="text-xs text-zinc-500 truncate mt-0.5">{proc.titulo}</p>
                </div>
                {fileName && (
                  <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-helix-warning/10 text-helix-warning border border-helix-warning/20 font-mono max-w-[110px] truncate">
                    {fileName}
                  </span>
                )}
              </div>

              <Field label="Mensaje de la versión">
                <textarea
                  value={mensaje}
                  onChange={(e) => setMensaje(e.target.value)}
                  rows={3}
                  autoFocus
                  placeholder="Describe el contenido que se está cargando…"
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-xs text-zinc-700 placeholder:text-zinc-400 resize-none focus:outline-none focus:ring-1 focus:ring-helix-accent/40 transition-colors leading-relaxed"
                />
              </Field>

              <Field label="Versión del documento (opcional)">
                <input
                  value={versionDoc}
                  onChange={(e) => setVersionDoc(e.target.value)}
                  placeholder="ej. 1.0"
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-1.5 text-xs text-zinc-700 font-mono placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-helix-accent/40 transition-colors"
                />
              </Field>

              {error && <ErrorBox msg={error} />}

              <FooterButtons
                onBack={() => setStep("load-file")}
                primaryLabel={submitting ? "Cargando…" : isManager ? "Cargar y publicar" : "Enviar a revisión"}
                primaryDisabled={submitting || !mensaje.trim() || !content}
                primaryLoading={submitting}
                primaryIcon={<GitCommit className="h-3 w-3" />}
                onPrimary={handleSubmit}
              />
            </div>
          )}

          {/* ── DONE ─────────────────────────────────────────────────────────── */}
          {step === "done" && commitId != null && (
            <div className="flex flex-col items-center justify-center py-6 gap-4 text-center">
              <div className="h-14 w-14 rounded-full bg-helix-done/10 border border-helix-done/25 flex items-center justify-center">
                <CheckCircle className="h-7 w-7 text-helix-done" />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-zinc-800 font-mono mb-1">
                  {isManager ? "Versión publicada" : "Versión enviada"}
                </p>
                <p className="text-xs text-zinc-500 leading-relaxed max-w-[260px]">
                  {isManager
                    ? `El commit #${String(commitId).padStart(4, "0")} quedó aprobado y el procedimiento está vigente.`
                    : `El commit #${String(commitId).padStart(4, "0")} está pendiente de aprobación del gerente.`}
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-full py-2 text-xs font-medium text-white bg-helix-accent hover:opacity-90 rounded-lg transition-opacity font-mono"
              >
                Cerrar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StepTitle({ icon, label, hint }: { icon: React.ReactNode; label: string; hint?: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-5 w-5 rounded bg-zinc-100 border border-zinc-200 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <span className="text-xs font-medium text-zinc-700 font-mono">{label}</span>
      {hint && <span className="text-[10px] text-zinc-400 font-mono">{hint}</span>}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] text-zinc-400 uppercase tracking-widest font-mono block mb-1.5">{label}</label>
      {children}
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

function FooterButtons({
  onBack, primaryLabel, primaryDisabled, primaryLoading, primaryIcon, onPrimary,
}: {
  onBack?: () => void
  primaryLabel: string
  primaryDisabled?: boolean
  primaryLoading?: boolean
  primaryIcon?: React.ReactNode
  onPrimary: () => void
}) {
  return (
    <div className="flex gap-2 pt-1">
      {onBack && (
        <button
          onClick={onBack}
          className="flex items-center gap-1 px-3 py-2 text-xs text-zinc-500 hover:text-zinc-700 border border-zinc-200 hover:border-zinc-300 rounded-lg transition-colors font-mono"
        >
          <ChevronLeft className="h-3 w-3" /> Atrás
        </button>
      )}
      <button
        onClick={onPrimary}
        disabled={primaryDisabled}
        className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-helix-accent text-white text-xs font-medium rounded-lg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity font-mono"
      >
        {primaryLoading ? <Loader className="h-3 w-3 animate-spin" /> : primaryIcon}
        {primaryLabel}
      </button>
    </div>
  )
}
