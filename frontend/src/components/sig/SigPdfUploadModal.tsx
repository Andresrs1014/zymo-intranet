import { useCallback, useRef, useState } from "react"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"
import {
  X, FileUp, Loader, AlertTriangle, FileText,
} from "lucide-react"

export interface SigPdfUploadModalProps {
  procedimientoId: number
  procedimientoCodigo: string
  onTextExtracted: (text: string) => void
  onClose: () => void
}

const MOCK_RESPONSE = {
  texto_extraido: `# Procedimiento de Control Financiero\n\n## 1. Objeto\nEstablecer los lineamientos para el control de gastos...\n\n## 2. Alcance\nAplica a todas las áreas del grupo ZYMO...`,
  warnings: ["Texto extraído por OCR (3 páginas). Puede contener errores de reconocimiento."],
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function isPdfFile(file: File): boolean {
  return file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf"
}

export function SigPdfUploadModal({
  procedimientoId,
  procedimientoCodigo,
  onTextExtracted,
  onClose,
}: SigPdfUploadModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ texto: string; warnings: string[] } | null>(null)
  const [editedText, setEditedText] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const selectFile = useCallback((selected: File) => {
    if (!isPdfFile(selected)) {
      setError("Solo se aceptan archivos PDF.")
      return
    }
    setError(null)
    setResult(null)
    setEditedText("")
    setFile(selected)
  }, [])

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) selectFile(f)
    e.target.value = ""
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) selectFile(f)
  }

  async function handleExtract() {
    if (!file || loading) return
    setLoading(true)
    setError(null)
    setResult(null)

    const formData = new FormData()
    formData.append("file", file)

    try {
      const { data } = await api.post(
        `/sig-api/api/procedimientos/${procedimientoId}/upload-pdf`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" }, timeout: 120_000 },
      )
      setResult({ texto: data.texto_extraido, warnings: data.warnings ?? [] })
      setEditedText(data.texto_extraido)
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      const isUnavailable = !status || status === 404 || status === 502 || status === 503

      if (isUnavailable) {
        setResult({
          texto: MOCK_RESPONSE.texto_extraido,
          warnings: [
            ...MOCK_RESPONSE.warnings,
            "Respuesta simulada — el endpoint de extracción aún no está disponible.",
          ],
        })
        setEditedText(MOCK_RESPONSE.texto_extraido)
      } else {
        setError("No se pudo extraer el texto. Verifica que el PDF sea legible.")
      }
    } finally {
      setLoading(false)
    }
  }

  function handleConfirm() {
    if (!editedText.trim()) return
    onTextExtracted(editedText)
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-zinc-900/60 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="bg-zinc-950 rounded-2xl w-full max-w-2xl border border-white/10 shadow-2xl overflow-hidden mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-7 w-7 rounded-lg bg-lime-400/10 border border-lime-400/20 flex items-center justify-center shrink-0">
              <FileUp className="h-3.5 w-3.5 text-lime-400" />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-white font-mono truncate">
                Importar desde PDF
              </p>
              <p className="text-[10px] text-zinc-500 font-mono truncate">{procedimientoCodigo}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-7 w-7 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 transition-colors shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Paso 1 — selección */}
          {!result && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={onInputChange}
                className="hidden"
              />

              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                className={cn(
                  "rounded-2xl border-2 border-dashed transition-all duration-200",
                  "bg-white/5 border-white/10",
                  dragOver && "border-lime-400/50 bg-lime-400/5",
                  file && "border-lime-400/30 bg-lime-400/5",
                )}
              >
                <div className="flex flex-col items-center gap-3 py-10 px-6">
                  {file ? (
                    <>
                      <FileText className="h-8 w-8 text-lime-400" />
                      <div className="text-center">
                        <p className="text-sm text-white font-mono font-medium">{file.name}</p>
                        <p className="text-[11px] text-zinc-500 font-mono mt-1">
                          {formatFileSize(file.size)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-[11px] text-zinc-400 hover:text-white font-mono transition-colors underline underline-offset-2"
                      >
                        Cambiar archivo
                      </button>
                    </>
                  ) : (
                    <>
                      <FileUp className="h-8 w-8 text-zinc-500" />
                      <p className="text-sm text-zinc-400 text-center">
                        Arrastra un PDF aquí o selecciónalo desde tu equipo
                      </p>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-white/10
                                   rounded-lg text-zinc-300 hover:text-white hover:border-white/20
                                   transition-all font-mono"
                      >
                        Seleccionar PDF
                      </button>
                    </>
                  )}
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                  <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-300">{error}</p>
                </div>
              )}

              {loading ? (
                <div className="flex flex-col items-center gap-3 py-6 animate-in fade-in duration-300">
                  <Loader className="h-6 w-6 text-lime-400 animate-spin" />
                  <p className="text-xs text-zinc-400 font-mono text-center max-w-sm leading-relaxed">
                    Extrayendo texto… esto puede tomar hasta 2 minutos si el PDF está escaneado.
                  </p>
                </div>
              ) : (
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3 py-1.5 text-xs text-zinc-500 hover:text-white font-mono transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleExtract()}
                    disabled={!file}
                    className={cn(
                      "flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-mono font-medium transition-all",
                      file
                        ? "bg-lime-400 text-zinc-950 hover:bg-lime-300"
                        : "bg-white/5 text-zinc-600 cursor-not-allowed",
                    )}
                  >
                    Extraer texto
                  </button>
                </div>
              )}
            </>
          )}

          {/* Paso 3 — revisión */}
          {result && (
            <>
              {result.warnings.length > 0 && (
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/25">
                  <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    {result.warnings.map((w, i) => (
                      <p key={i} className="text-xs text-amber-200/90 leading-relaxed">
                        {w.includes("OCR") && !w.startsWith("⚠") ? `⚠ ${w}` : w}
                      </p>
                    ))}
                    {result.warnings.some((w) => w.toLowerCase().includes("ocr")) && (
                      <p className="text-[11px] text-amber-300/70">
                        Revisa el contenido antes de confirmar.
                      </p>
                    )}
                  </div>
                </div>
              )}

              <textarea
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                className="w-full min-h-[300px] max-h-[50vh] font-mono text-[12px] text-zinc-200
                           bg-white/5 border border-white/10 rounded-xl p-4 resize-y
                           focus:outline-none focus:ring-1 focus:ring-lime-400/40 transition-all"
                spellCheck={false}
              />

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 text-xs text-zinc-500 hover:text-white font-mono transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={!editedText.trim()}
                  className={cn(
                    "flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-mono font-medium transition-all",
                    editedText.trim()
                      ? "bg-lime-400 text-zinc-950 hover:bg-lime-300"
                      : "bg-white/5 text-zinc-600 cursor-not-allowed",
                  )}
                >
                  Usar este texto
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
