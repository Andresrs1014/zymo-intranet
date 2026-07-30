import { useState, useEffect, useRef, useMemo, type FormEvent, type ChangeEvent } from "react"
import { z } from "zod"
import { Plus, Trash2 } from "lucide-react"
import type { HelixActividad, HelixEvidencia } from "@/types/helix"
import type { HelixActividadCreate, HelixSubactividadCreate } from "@/hooks/useHelixActividades"
import { useHelixProyectos } from "@/hooks/useHelixProyectos"
import { useHelixSubproyectos } from "@/hooks/useHelixSubproyectos"
import { useHelixUsuarios } from "@/hooks/useHelixUsuarios"
import { useHelixDependencias } from "@/hooks/useHelixDependencias"
import { helixApi } from "@/lib/helixApi"
import { useHelixToast } from "../HelixToast"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Slider } from "@/components/ui/slider"
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { BlurFade } from "@/components/ui/blur-fade"

interface TaskDialogProps {
  open: boolean
  onClose: () => void
  actividad?: HelixActividad
  onSaved: () => void
  createActividad: (data: HelixActividadCreate) => Promise<void>
  updateActividad: (id: number, data: Partial<HelixActividadCreate>) => Promise<void>
}

const ESTADOS = ["Backlog", "Planificado", "En curso", "Revision", "Terminado"] as const
const PRIORIDADES = ["Alta", "Media", "Baja"] as const

const TaskSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido").max(100, "Máximo 100 caracteres"),
  proyectoId: z.string().min(1, "Selecciona un proyecto principal"),
  subproyectoId: z.string().min(1, "Selecciona un subproyecto"),
  responsableId: z.string().min(1, "Selecciona un responsable"),
  prioridad: z.enum(PRIORIDADES),
  estado: z.enum(ESTADOS),
  fechaInicio: z.string().min(1, "Fecha de inicio requerida"),
  fechaFin: z.string().min(1, "Fecha de fin requerida"),
  puntos: z.string().refine((v) => parseInt(v, 10) > 0, "Debe ser positivo"),
})

type TaskSchemaFields = z.infer<typeof TaskSchema>
type FieldErrors = Partial<Record<keyof TaskSchemaFields, string>>

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function initialsOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  const initials = (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")
  return initials.toUpperCase() || "NA"
}

interface SubactividadRow {
  key: string
  nombre: string
  responsableId: string
  estado: string
}

function emptySubactividadRow(): SubactividadRow {
  return { key: crypto.randomUUID(), nombre: "", responsableId: "", estado: "Planificado" }
}

interface FormState {
  nombre: string
  proyectoId: string
  subproyectoId: string
  numeroActividad: string
  responsableId: string
  prioridad: string
  estado: string
  fechaInicio: string
  fechaFin: string
  avance: number
  puntos: string
  bloqueada: boolean
  dependenciaId: string
  costoInversion: string
  costoOptimizacion: string
  costoEjecucion: string
  comentarioInicial: string
}

function buildInitialForm(actividad: HelixActividad | undefined, proyectoIdDeSubproyecto: (subproyectoId: number) => string): FormState {
  if (actividad) {
    return {
      nombre: actividad.nombre,
      proyectoId: proyectoIdDeSubproyecto(actividad.subproyectoId),
      subproyectoId: String(actividad.subproyectoId),
      numeroActividad: actividad.numeroActividad ?? "",
      responsableId: String(actividad.responsableId),
      prioridad: actividad.prioridad,
      estado: actividad.estado,
      fechaInicio: actividad.fechaInicio.slice(0, 10),
      fechaFin: actividad.fechaFin.slice(0, 10),
      avance: actividad.avance,
      puntos: String(actividad.puntos),
      bloqueada: actividad.bloqueada,
      dependenciaId: actividad.dependenciaId ? String(actividad.dependenciaId) : "",
      costoInversion: actividad.costoInversion ? String(actividad.costoInversion) : "",
      costoOptimizacion: actividad.costoOptimizacion ? String(actividad.costoOptimizacion) : "",
      costoEjecucion: actividad.costoEjecucion ? String(actividad.costoEjecucion) : "",
      comentarioInicial: "",
    }
  }
  const hoy = todayISO()
  return {
    nombre: "",
    proyectoId: "",
    subproyectoId: "",
    numeroActividad: "",
    responsableId: "",
    prioridad: "Media",
    estado: "Backlog",
    fechaInicio: hoy,
    fechaFin: hoy,
    avance: 0,
    puntos: "3",
    bloqueada: false,
    dependenciaId: "",
    costoInversion: "",
    costoOptimizacion: "",
    costoEjecucion: "",
    comentarioInicial: "",
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const BACKEND_URL = (import.meta as { env?: Record<string, string> }).env?.VITE_HELIX_API_URL ?? "http://localhost:3001"
const IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".gif", ".webp"]

function isImageFile(nombre: string): boolean {
  const ext = nombre.toLowerCase().slice(nombre.lastIndexOf("."))
  return IMAGE_EXTS.includes(ext)
}

export function TaskDialog({ open, onClose, actividad, onSaved, createActividad, updateActividad }: TaskDialogProps) {
  const { proyectos } = useHelixProyectos()
  const { subproyectos } = useHelixSubproyectos()
  const { usuarios } = useHelixUsuarios()
  const { dependencias } = useHelixDependencias()
  const { showToast } = useHelixToast()

  const isEdit = actividad !== undefined

  const proyectoIdDeSubproyecto = (subproyectoId: number): string => {
    const sub = subproyectos.find((s) => s.id === subproyectoId)
    return sub ? String(sub.proyectoId) : ""
  }

  const [form, setForm] = useState<FormState>(() => buildInitialForm(actividad, proyectoIdDeSubproyecto))
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [apiError, setApiError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [costosOpen, setCostosOpen] = useState(false)
  const [subactividades, setSubactividades] = useState<SubactividadRow[]>([])

  const [evidencias, setEvidencias] = useState<HelixEvidencia[]>([])
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  useEffect(() => {
    if (open) {
      setForm(buildInitialForm(actividad, proyectoIdDeSubproyecto))
      setFieldErrors({})
      setApiError(null)
      setSaving(false)
      setCostosOpen(false)
      setSubactividades([])
      setEvidencias(actividad?.evidencias ?? [])
      setUploadProgress(null)
      setSelectedFile(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, actividad])

  const subproyectosDelProyecto = useMemo(
    () => subproyectos.filter((s) => String(s.proyectoId) === form.proyectoId),
    [subproyectos, form.proyectoId]
  )

  if (!open) return null

  const title = isEdit ? "Editar actividad" : "Nueva actividad"

  function setField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  function handleProyectoChange(value: string) {
    setField("proyectoId", value)
    setField("subproyectoId", "")
  }

  function addSubactividadRow() {
    setSubactividades((prev) => [...prev, emptySubactividadRow()])
  }

  function updateSubactividadRow(key: string, patch: Partial<SubactividadRow>) {
    setSubactividades((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  function removeSubactividadRow(key: string) {
    setSubactividades((prev) => prev.filter((row) => row.key !== key))
  }

  function validate(): boolean {
    const parsed = TaskSchema.safeParse({
      nombre: form.nombre,
      proyectoId: form.proyectoId,
      subproyectoId: form.subproyectoId,
      responsableId: form.responsableId,
      prioridad: form.prioridad,
      estado: form.estado,
      fechaInicio: form.fechaInicio,
      fechaFin: form.fechaFin,
      puntos: form.puntos,
    })

    const errs: FieldErrors = {}
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors
      for (const [k, v] of Object.entries(flat)) {
        if (v && v.length > 0) errs[k as keyof TaskSchemaFields] = v[0]
      }
    }
    if (!errs.fechaFin && form.fechaInicio && form.fechaFin && form.fechaFin < form.fechaInicio) {
      errs.fechaFin = "Debe ser igual o posterior a Fecha Inicio"
    }
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setApiError(null)
    setSaving(true)

    const responsable = usuarios.find((u) => u.id === Number(form.responsableId))

    const payload: HelixActividadCreate = {
      subproyectoId: Number(form.subproyectoId),
      numeroActividad: form.numeroActividad.trim() || undefined,
      responsableId: Number(form.responsableId),
      responsableNombre: responsable?.full_name ?? "",
      responsableInitials: responsable ? initialsOf(responsable.full_name) : "",
      responsableColor: responsable?.color ?? "#5461c8",
      nombre: form.nombre.trim(),
      estado: form.estado,
      prioridad: form.prioridad,
      fechaInicio: form.fechaInicio,
      fechaFin: form.fechaFin,
      avance: form.avance,
      puntos: Number(form.puntos),
      bloqueada: form.bloqueada,
      dependenciaId: form.dependenciaId ? Number(form.dependenciaId) : null,
    }

    if (form.costoInversion !== "") payload.costoInversion = Number(form.costoInversion)
    if (form.costoOptimizacion !== "") payload.costoOptimizacion = Number(form.costoOptimizacion)
    if (form.costoEjecucion !== "") payload.costoEjecucion = Number(form.costoEjecucion)

    if (!isEdit) {
      const subactividadesValidas: HelixSubactividadCreate[] = subactividades
        .filter((row) => row.nombre.trim())
        .map((row) => {
          const subResponsable = usuarios.find((u) => u.id === Number(row.responsableId))
          return {
            nombre: row.nombre.trim(),
            responsableId: subResponsable ? subResponsable.id : null,
            responsableNombre: subResponsable?.full_name ?? null,
            estado: row.estado,
          }
        })
      if (subactividadesValidas.length) payload.subactividades = subactividadesValidas
      if (form.comentarioInicial.trim()) payload.comentarioInicial = form.comentarioInicial.trim()
    }

    try {
      if (isEdit && actividad) {
        await updateActividad(actividad.id, payload)
      } else {
        await createActividad(payload)
      }
      onSaved()
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al guardar la actividad"
      setApiError(msg)
    } finally {
      setSaving(false)
    }
  }

  async function handleUpload() {
    if (!selectedFile || !actividad) return
    setUploadProgress(-1)
    try {
      const fd = new FormData()
      fd.append("archivo", selectedFile)
      const res = await helixApi.post<HelixEvidencia>(`/api/actividades/${actividad.id}/evidencias`, fd, {
        onUploadProgress: (evt) => {
          if (evt.total) setUploadProgress(Math.round((evt.loaded / evt.total) * 100))
        },
      })
      setUploadProgress(100)
      setTimeout(() => setUploadProgress(null), 600)
      setEvidencias((prev) => [...prev, res.data])
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ""
      showToast("Evidencia subida correctamente", "success")
    } catch {
      setUploadProgress(null)
      showToast("Error al subir la evidencia", "error")
    }
  }

  async function handleDeleteEvidencia(evidenciaId: number) {
    if (!actividad) return
    try {
      await helixApi.delete(`/api/actividades/${actividad.id}/evidencias/${evidenciaId}`)
      setEvidencias((prev) => prev.filter((e) => e.id !== evidenciaId))
      showToast("Evidencia eliminada", "info")
    } catch {
      showToast("Error al eliminar la evidencia", "error")
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
          {apiError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
              {apiError}
            </div>
          )}

          <BlurFade duration={0.3}>
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contexto del proyecto</p>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="td-proyecto">Proyecto principal *</Label>
                  <Select value={form.proyectoId} onValueChange={handleProyectoChange}>
                    <SelectTrigger id="td-proyecto" className={fieldErrors.proyectoId ? "border-destructive" : undefined}>
                      <SelectValue placeholder="Seleccionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      {proyectos.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>{p.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldErrors.proyectoId && <p className="text-xs text-destructive">{fieldErrors.proyectoId}</p>}
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="td-subproyecto">Subproyecto asociado *</Label>
                  <Select
                    value={form.subproyectoId}
                    onValueChange={(v) => setField("subproyectoId", v)}
                    disabled={!form.proyectoId}
                  >
                    <SelectTrigger id="td-subproyecto" className={fieldErrors.subproyectoId ? "border-destructive" : undefined}>
                      <SelectValue placeholder={form.proyectoId ? "Seleccionar..." : "Elige un proyecto primero"} />
                    </SelectTrigger>
                    <SelectContent>
                      {subproyectosDelProyecto.map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>{s.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldErrors.subproyectoId && <p className="text-xs text-destructive">{fieldErrors.subproyectoId}</p>}
                  {form.proyectoId && subproyectosDelProyecto.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Este proyecto no tiene subproyectos. Créalos en Configuración de proyectos.
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-[120px_1fr] gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="td-numero">No. actividad</Label>
                  <Input
                    id="td-numero"
                    value={form.numeroActividad}
                    onChange={(e) => setField("numeroActividad", e.target.value)}
                    placeholder="ACT-001"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="td-nombre">Actividad *</Label>
                  <Input
                    id="td-nombre"
                    value={form.nombre}
                    onChange={(e) => setField("nombre", e.target.value)}
                    placeholder="Nombre de la actividad"
                    autoFocus
                    className={fieldErrors.nombre ? "border-destructive" : undefined}
                  />
                  {fieldErrors.nombre && <p className="text-xs text-destructive">{fieldErrors.nombre}</p>}
                </div>
              </div>
            </div>
          </BlurFade>

          <BlurFade duration={0.3} delay={0.03}>
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Responsabilidad y agenda</p>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="td-responsable">Responsable *</Label>
                  <Select value={form.responsableId} onValueChange={(v) => setField("responsableId", v)}>
                    <SelectTrigger id="td-responsable" className={fieldErrors.responsableId ? "border-destructive" : undefined}>
                      <SelectValue placeholder="Seleccionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      {usuarios.map((u) => (
                        <SelectItem key={u.id} value={String(u.id)}>{u.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldErrors.responsableId && <p className="text-xs text-destructive">{fieldErrors.responsableId}</p>}
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="td-dependencia">Dependencia</Label>
                  <Select
                    value={form.dependenciaId || "none"}
                    onValueChange={(v) => setField("dependenciaId", v === "none" ? "" : v)}
                  >
                    <SelectTrigger id="td-dependencia"><SelectValue placeholder="Sin dependencia" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin dependencia</SelectItem>
                      {dependencias.map((d) => (
                        <SelectItem key={d.id} value={String(d.id)}>{d.nombre} ({d.tipo})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="td-fecha-inicio">Fecha Inicio *</Label>
                  <Input
                    id="td-fecha-inicio"
                    type="date"
                    value={form.fechaInicio}
                    onChange={(e) => setField("fechaInicio", e.target.value)}
                    className={fieldErrors.fechaInicio ? "border-destructive" : undefined}
                  />
                  {fieldErrors.fechaInicio && <p className="text-xs text-destructive">{fieldErrors.fechaInicio}</p>}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="td-fecha-fin">Fecha Fin *</Label>
                  <Input
                    id="td-fecha-fin"
                    type="date"
                    value={form.fechaFin}
                    min={form.fechaInicio}
                    onChange={(e) => setField("fechaFin", e.target.value)}
                    className={fieldErrors.fechaFin ? "border-destructive" : undefined}
                  />
                  {fieldErrors.fechaFin && <p className="text-xs text-destructive">{fieldErrors.fechaFin}</p>}
                </div>
              </div>

              <div className="flex flex-col gap-1.5 w-32">
                <Label htmlFor="td-puntos">Puntos</Label>
                <Input
                  id="td-puntos"
                  type="number"
                  min={0}
                  value={form.puntos}
                  onChange={(e) => setField("puntos", e.target.value)}
                  className={fieldErrors.puntos ? "border-destructive" : undefined}
                />
                {fieldErrors.puntos && <p className="text-xs text-destructive">{fieldErrors.puntos}</p>}
              </div>
            </div>
          </BlurFade>

          <BlurFade duration={0.3} delay={0.06}>
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Estado y control</p>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="td-prioridad">Prioridad</Label>
                  <Select value={form.prioridad} onValueChange={(v) => setField("prioridad", v)}>
                    <SelectTrigger id="td-prioridad"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PRIORIDADES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="td-estado">Estado</Label>
                  <Select value={form.estado} onValueChange={(v) => setField("estado", v)}>
                    <SelectTrigger id="td-estado"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ESTADOS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <Label id="td-avance-label">Avance</Label>
                  <span className="font-mono text-sm text-muted-foreground">{form.avance}%</span>
                </div>
                <Slider
                  aria-labelledby="td-avance-label"
                  value={[form.avance]}
                  max={100}
                  step={5}
                  onValueChange={([v]) => setField("avance", v)}
                />
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="td-bloqueada"
                  checked={form.bloqueada}
                  onCheckedChange={(checked) => setField("bloqueada", checked === true)}
                />
                <Label htmlFor="td-bloqueada" className="cursor-pointer font-normal">Actividad bloqueada</Label>
              </div>
            </div>
          </BlurFade>

          {!isEdit && (
            <BlurFade duration={0.3} delay={0.09}>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Subactividades</p>
                  <Button type="button" variant="outline" size="sm" onClick={addSubactividadRow}>
                    <Plus className="h-3.5 w-3.5" /> Adicionar
                  </Button>
                </div>

                {subactividades.map((row) => (
                  <div key={row.key} className="grid grid-cols-[1fr_140px_130px_auto] items-center gap-2">
                    <Input
                      value={row.nombre}
                      onChange={(e) => updateSubactividadRow(row.key, { nombre: e.target.value })}
                      placeholder="Ej. Validar entregable"
                      aria-label="Nombre de la subactividad"
                    />
                    <Select
                      value={row.responsableId || "none"}
                      onValueChange={(v) => updateSubactividadRow(row.key, { responsableId: v === "none" ? "" : v })}
                    >
                      <SelectTrigger aria-label="Responsable de la subactividad"><SelectValue placeholder="Sin responsable" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin responsable</SelectItem>
                        {usuarios.map((u) => (
                          <SelectItem key={u.id} value={String(u.id)}>{u.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={row.estado} onValueChange={(v) => updateSubactividadRow(row.key, { estado: v })}>
                      <SelectTrigger aria-label="Estado de la subactividad"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ESTADOS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeSubactividadRow(row.key)}
                      aria-label="Eliminar subactividad"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </BlurFade>
          )}

          <Collapsible open={costosOpen} onOpenChange={setCostosOpen}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-primary"
              >
                <span>{costosOpen ? "▾" : "▸"}</span> Costos (opcional)
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="td-costo-inversion">Inversión</Label>
                <Input
                  id="td-costo-inversion"
                  type="number"
                  min={0}
                  placeholder="0"
                  value={form.costoInversion}
                  onChange={(e) => setField("costoInversion", e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="td-costo-optimizacion">Optimización</Label>
                <Input
                  id="td-costo-optimizacion"
                  type="number"
                  min={0}
                  placeholder="0"
                  value={form.costoOptimizacion}
                  onChange={(e) => setField("costoOptimizacion", e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="td-costo-ejecucion">Ejecución</Label>
                <Input
                  id="td-costo-ejecucion"
                  type="number"
                  min={0}
                  placeholder="0"
                  value={form.costoEjecucion}
                  onChange={(e) => setField("costoEjecucion", e.target.value)}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>

          <div className="flex flex-col gap-3 border-t pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Soporte y trazabilidad</p>

            {!isEdit && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="td-comentario">Comentario inicial</Label>
                <Textarea
                  id="td-comentario"
                  value={form.comentarioInicial}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setField("comentarioInicial", e.target.value)}
                  placeholder="Arranque, contexto o acuerdo inicial de la actividad"
                  rows={3}
                />
              </div>
            )}

            {isEdit && (
              <div className="flex flex-col gap-3">
                <Label>Evidencias</Label>

                {evidencias.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    {evidencias.map((ev) => (
                      <div key={ev.id} className="flex items-center gap-2 rounded-md border bg-muted/40 px-2.5 py-1.5">
                        {isImageFile(ev.nombre) && (
                          <img
                            src={`${BACKEND_URL}/uploads/${ev.ruta}`}
                            alt={ev.nombre}
                            className="h-8 w-8 shrink-0 rounded object-cover"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-semibold">{ev.nombre}</div>
                          <div className="text-xs text-muted-foreground">{formatFileSize(ev.tamanio)}</div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          onClick={() => handleDeleteEvidencia(ev.id)}
                          aria-label="Eliminar evidencia"
                        >
                          ×
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf,.docx,.xlsx"
                    className="flex-1 text-xs"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleUpload}
                    disabled={!selectedFile || uploadProgress !== null}
                  >
                    Subir archivo
                  </Button>
                </div>

                {uploadProgress !== null && (
                  <div className="h-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-[width]"
                      style={{ width: uploadProgress === -1 ? "40%" : `${uploadProgress}%` }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
