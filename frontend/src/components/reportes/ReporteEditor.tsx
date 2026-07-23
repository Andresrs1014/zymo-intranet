// Editor de un reporte. Cubre tres casos de uso:
//   1) Crear un reporte nuevo (subiendo un .md o escribiéndolo en el textarea).
//   2) Editar uno existente (los campos arrancan pre-rellenos).
// La estética del área de escritura es "papel" — fondo claro, tipografía
// DM Sans/Mono, sin gradientes. El preview en vivo comparte ese mismo look.

import { useState, useRef, type DragEvent, type ChangeEvent } from "react"
import { motion } from "motion/react"
import { Upload, FileText, X, Eye, Pencil, Save, Loader, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { ShimmerButton } from "@/components/ui/shimmer-button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PROSE_TYPORA } from "@/lib/reportesShared"
import type { Reporte } from "@/lib/reportesShared"
import { ReporteMarkdown } from "./ReporteMarkdown"

interface Props {
  initial?: Reporte
  proyectosConocidos: string[]
  onSubmit: (data: FormPayload) => Promise<void>
  onCancel: () => void
  submitting?: boolean
}

/** Payload limpio que se pasa al onSubmit del padre (no expone FormData). */
export interface FormPayload {
  titulo: string
  descripcion?: string
  proyecto: string
  contenidoMd: string
  porcentajeAvance: number
  tiempoEstimadoHoras?: number
  tiempoRealHoras?: number
  archivo?: File
}

// ── Constantes del editor ─────────────────────────────────────────────────────

/** Extensiones aceptadas para el upload — coincide con el backend. */
const EXTENSIONES_PERMITIDAS = [".md", ".markdown", ".txt"]
/** Tamaño máximo en bytes (5 MB) — texto plano, más que suficiente. */
const MAX_BYTES = 5 * 1024 * 1024
/** Expresión regular para extraer el primer H1 del markdown (sirve como título). */
const H1_REGEX = /^#\s+(.+)$/m

export function ReporteEditor({
  initial,
  proyectosConocidos,
  onSubmit,
  onCancel,
  submitting,
}: Props) {
  // ── Estado del formulario ──────────────────────────────────────────────────
  const [titulo, setTitulo] = useState(initial?.titulo ?? "")
  const [descripcion, setDescripcion] = useState(initial?.descripcion ?? "")
  const [proyecto, setProyecto] = useState(initial?.proyecto ?? "")
  const [proyectoNuevo, setProyectoNuevo] = useState("")
  const [contenidoMd, setContenidoMd] = useState(initial?.contenidoMd ?? "")
  const [porcentaje, setPorcentaje] = useState(initial?.porcentajeAvance ?? 0)
  const [tiempoEst, setTiempoEst] = useState<string>(
    initial?.tiempoEstimadoHoras?.toString() ?? "",
  )
  const [tiempoReal, setTiempoReal] = useState<string>(
    initial?.tiempoRealHoras?.toString() ?? "",
  )
  const [archivo, setArchivo] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [mode, setMode] = useState<"edit" | "preview">("edit")
  /** Error visible en pantalla (en vez de `alert()`) — anuncia via aria-live. */
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Si el usuario eligió "+ Nuevo proyecto…", usamos el input de proyecto nuevo.
  const proyectoFinal = proyecto === "__nuevo__" ? proyectoNuevo.trim() : proyecto

  // ── Manejo del archivo .md ─────────────────────────────────────────────────

  /** Valida y carga el archivo. Si el textarea está vacío, también lo rellena. */
  const handleFile = async (file: File) => {
    setErrorMsg(null)
    const ext = "." + (file.name.split(".").pop() ?? "").toLowerCase()
    if (!EXTENSIONES_PERMITIDAS.includes(ext)) {
      setErrorMsg("Solo se permiten archivos .md, .markdown o .txt")
      return
    }
    if (file.size > MAX_BYTES) {
      setErrorMsg("El archivo no puede superar 5 MB")
      return
    }
    setArchivo(file)
    if (!contenidoMd.trim()) {
      const text = await file.text()
      setContenidoMd(text)
      // Si el reporte es nuevo y no hay título, intentamos sacarlo del primer H1.
      if (!titulo) {
        const h1 = text.match(H1_REGEX)
        if (h1) setTitulo(h1[1].trim())
      }
    }
  }

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!titulo.trim() || !proyectoFinal) {
      setErrorMsg("Título y proyecto son obligatorios")
      return
    }
    if (!archivo && !contenidoMd.trim()) {
      setErrorMsg("El reporte debe tener contenido (subí un .md o escribilo en el editor)")
      return
    }
    setErrorMsg(null)
    await onSubmit({
      titulo: titulo.trim(),
      descripcion: descripcion.trim() || undefined,
      proyecto: proyectoFinal,
      contenidoMd,
      porcentajeAvance: porcentaje,
      tiempoEstimadoHoras: tiempoEst ? parseFloat(tiempoEst) : undefined,
      tiempoRealHoras: tiempoReal ? parseFloat(tiempoReal) : undefined,
      archivo: archivo ?? undefined,
    })
  }

  return (
    <div className="space-y-5">
      {/* ── Error inline (anuncia via aria-live) ─────────────────────────── */}
      {errorMsg && (
        <div
          role="alert"
          aria-live="polite"
          className="flex items-start gap-2 px-4 py-3 rounded-md border border-red-200 bg-red-50 text-[12px] text-red-700 font-mono"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ── Formulario de metadatos ──────────────────────────────────────── */}
      <fieldset className="rounded-xl border border-zinc-200 bg-white p-5 space-y-4">
        <legend className="sr-only">Metadatos del reporte</legend>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Título */}
          <div className="md:col-span-2 space-y-1.5">
            <Label
              htmlFor="rep-titulo"
              className="font-mono text-[11px] uppercase tracking-wider text-zinc-500"
            >
              Título del reporte
            </Label>
            <Input
              id="rep-titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Refactor del módulo de Helix…"
              autoComplete="off"
              className="font-mono text-[13px]"
            />
          </div>

          {/* Proyecto */}
          <div className="space-y-1.5">
            <Label
              htmlFor="rep-proyecto"
              className="font-mono text-[11px] uppercase tracking-wider text-zinc-500"
            >
              Proyecto
            </Label>
            <select
              id="rep-proyecto"
              value={proyecto}
              onChange={(e) => setProyecto(e.target.value)}
              className="w-full h-9 px-3 rounded-md border border-zinc-200 bg-white font-mono text-[12px] focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-700 focus-visible:ring-offset-2"
            >
              <option value="" disabled>Seleccionar…</option>
              {proyectosConocidos.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
              <option value="__nuevo__">+ Nuevo proyecto…</option>
            </select>
            {proyecto === "__nuevo__" && (
              <Input
                id="rep-proyecto-nuevo"
                value={proyectoNuevo}
                onChange={(e) => setProyectoNuevo(e.target.value)}
                placeholder="Nombre del nuevo proyecto"
                autoComplete="off"
                className="font-mono text-[12px] mt-1.5"
              />
            )}
          </div>

          {/* % avance */}
          <div className="space-y-1.5">
            <Label
              htmlFor="rep-porcentaje"
              className="font-mono text-[11px] uppercase tracking-wider text-zinc-500"
            >
              % Avance ({porcentaje}%)
            </Label>
            <input
              id="rep-porcentaje"
              type="range"
              min={0}
              max={100}
              step={5}
              value={porcentaje}
              onChange={(e) => setPorcentaje(parseInt(e.target.value))}
              className="w-full accent-zinc-700"
            />
          </div>

          {/* Tiempo estimado */}
          <div className="space-y-1.5">
            <Label
              htmlFor="rep-tiempo-est"
              className="font-mono text-[11px] uppercase tracking-wider text-zinc-500"
            >
              Tiempo estimado (horas)
            </Label>
            <Input
              id="rep-tiempo-est"
              type="number"
              min={0}
              step={0.5}
              inputMode="decimal"
              spellCheck={false}
              autoComplete="off"
              value={tiempoEst}
              onChange={(e) => setTiempoEst(e.target.value)}
              placeholder="ej. 8"
              className="font-mono text-[12px] tabular-nums"
            />
          </div>

          {/* Tiempo real */}
          <div className="space-y-1.5">
            <Label
              htmlFor="rep-tiempo-real"
              className="font-mono text-[11px] uppercase tracking-wider text-zinc-500"
            >
              Tiempo real (horas, opcional)
            </Label>
            <Input
              id="rep-tiempo-real"
              type="number"
              min={0}
              step={0.5}
              inputMode="decimal"
              spellCheck={false}
              autoComplete="off"
              value={tiempoReal}
              onChange={(e) => setTiempoReal(e.target.value)}
              placeholder="ej. 6.5"
              className="font-mono text-[12px] tabular-nums"
            />
          </div>

          {/* Descripción */}
          <div className="md:col-span-2 space-y-1.5">
            <Label
              htmlFor="rep-descripcion"
              className="font-mono text-[11px] uppercase tracking-wider text-zinc-500"
            >
              Descripción corta (opcional)
            </Label>
            <Input
              id="rep-descripcion"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Resumen ejecutivo del reporte…"
              autoComplete="off"
              className="font-mono text-[12px]"
            />
          </div>
        </div>
      </fieldset>

      {/* ── Dropzone de archivo .md ──────────────────────────────────────── */}
      <FileDropzone
        archivo={archivo}
        dragOver={dragOver}
        onPick={() => fileRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onClear={() => setArchivo(null)}
        fileInputRef={fileRef}
        onFileChange={handleFileInput}
      />

      {/* ── Editor + preview (split pane con tabs) ───────────────────────── */}
      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
        {/* Tabs de modo */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-3 py-2 bg-zinc-50/50">
          <div className="flex items-center gap-1" role="tablist" aria-label="Modo de edición">
            <TabButton
              active={mode === "edit"}
              onClick={() => setMode("edit")}
              icon={Pencil}
              label="Editor"
            />
            <TabButton
              active={mode === "preview"}
              onClick={() => setMode("preview")}
              icon={Eye}
              label="Preview"
            />
          </div>
          <span className="font-mono text-[10px] text-zinc-400 uppercase tracking-wider tabular-nums">
            {contenidoMd.length} chars
          </span>
        </div>

        {mode === "edit" ? (
          <textarea
            value={contenidoMd}
            onChange={(e) => setContenidoMd(e.target.value)}
            placeholder={`# Título del reporte\n\nDescripción de lo que hiciste esta semana.\n\n\`\`\`mermaid\nflujograma del cambio\n\`\`\`\n\n- Punto 1\n- Punto 2`}
            spellCheck={false}
            aria-label="Contenido del reporte en Markdown"
            className={cn(
              "w-full h-[420px] px-5 py-4 font-mono text-[12px] text-zinc-700",
              "leading-relaxed bg-white resize-y focus:outline-none",
              "focus-visible:ring-2 focus-visible:ring-zinc-700 focus-visible:ring-inset",
              "placeholder:text-zinc-300",
            )}
          />
        ) : (
          <PreviewPane contenidoMd={contenidoMd} />
        )}
      </div>

      {/* ── Acciones (sticky al fondo del formulario) ────────────────────── */}
      <motion.div
        className="flex items-center justify-end gap-2 sticky bottom-0 bg-white/90 backdrop-blur py-3 -mx-6 px-6 border-t border-zinc-200"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="px-4 py-2 rounded-md text-[12px] font-medium text-zinc-600 hover:bg-zinc-100 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-700"
        >
          Cancelar
        </button>
        <ShimmerButton type="button" onClick={handleSubmit} disabled={submitting}>
          {submitting ? (
            <>
              <Loader className="w-3.5 h-3.5 animate-spin" />
              Guardando…
            </>
          ) : (
            <>
              <Save className="w-3.5 h-3.5" />
              {initial ? "Guardar cambios" : "Publicar reporte"}
            </>
          )}
        </ShimmerButton>
      </motion.div>
    </div>
  )
}

// ── Subcomponentes internos ───────────────────────────────────────────────────

/** Dropzone accesible para subir el .md original. */
function FileDropzone({
  archivo,
  dragOver,
  onPick,
  onDrop,
  onDragOver,
  onDragLeave,
  onClear,
  fileInputRef,
  onFileChange,
}: {
  archivo: File | null
  dragOver: boolean
  onPick: () => void
  onDrop: (e: DragEvent) => void
  onDragOver: (e: DragEvent) => void
  onDragLeave: () => void
  onClear: () => void
  fileInputRef: React.RefObject<HTMLInputElement | null>
  onFileChange: (e: ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        "rounded-xl border-2 border-dashed transition-colors p-6",
        dragOver
          ? "border-zinc-700 bg-zinc-100"
          : "border-zinc-300 bg-zinc-50 hover:border-zinc-500 hover:bg-white",
      )}
    >
      {/* Input file oculto pero accesible — el <button> de abajo lo dispara. */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".md,.markdown,.txt"
        onChange={onFileChange}
        className="sr-only"
        aria-label="Subir archivo Markdown"
      />

      <div className="flex items-center gap-4">
        {archivo ? (
          <>
            <FileText
              className="w-8 h-8 text-zinc-700 shrink-0"
              strokeWidth={1.5}
              aria-hidden="true"
            />
            <div className="flex-1 min-w-0">
              <p className="font-mono text-[12px] font-semibold text-zinc-800 truncate">
                {archivo.name}
              </p>
              <p className="text-[11px] text-zinc-500 mt-0.5 tabular-nums">
                {(archivo.size / 1024).toFixed(1)} KB · listo para subir
              </p>
            </div>
            <button
              type="button"
              onClick={onClear}
              className="p-1 rounded hover:bg-zinc-200 text-zinc-500 hover:text-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-700"
              aria-label="Quitar archivo"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </>
        ) : (
          <>
            <Upload
              className="w-8 h-8 text-zinc-400 shrink-0"
              strokeWidth={1.5}
              aria-hidden="true"
            />
            <div className="flex-1">
              <p className="font-mono text-[12px] font-semibold text-zinc-700">
                Subí tu archivo .md
              </p>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                Arrastralo acá o hacé click para elegir uno. También podés escribir abajo.
              </p>
            </div>
            {/* Botón explícito en vez de click sobre el div — accesible. */}
            <button
              type="button"
              onClick={onPick}
              className="px-3 py-1.5 rounded-md border border-zinc-300 bg-white text-[12px] font-medium text-zinc-700 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-700"
            >
              Elegir archivo
            </button>
          </>
        )}
      </div>
    </div>
  )
}

/** Tabla de tabs internos (Editor / Preview). */
function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ComponentType<{ className?: string }>
  label: string
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium",
        "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-700",
        active
          ? "bg-white text-zinc-800 shadow-sm"
          : "text-zinc-500 hover:text-zinc-800",
      )}
    >
      <Icon className="w-3.5 h-3.5" aria-hidden="true" />
      {label}
    </button>
  )
}

/** Panel de preview del markdown. */
function PreviewPane({ contenidoMd }: { contenidoMd: string }) {
  if (!contenidoMd.trim()) {
    return (
      <div className="px-8 py-6 min-h-[420px] flex items-center justify-center bg-zinc-50/30">
        <p className="text-zinc-400 font-mono text-[12px] italic">
          Nada para previsualizar todavía. Escribí o subí un .md…
        </p>
      </div>
    )
  }
  return (
    <div
      // `overscroll-behavior: contain` evita que el scroll del preview propague
      // al scroll principal del editor (molesto en trackpads).
      className="px-8 py-6 min-h-[420px] max-h-[600px] overflow-y-auto bg-zinc-50/30 overscroll-contain"
    >
      <div className={PROSE_TYPORA}>
        <ReporteMarkdown>{contenidoMd}</ReporteMarkdown>
      </div>
    </div>
  )
}
