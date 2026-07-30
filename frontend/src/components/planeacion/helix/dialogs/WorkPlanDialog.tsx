import { useState, useEffect, type FormEvent } from "react"
import { z } from "zod"
import { useHelixUsuarios } from "@/hooks/useHelixUsuarios"
import { useHelixPlanesTrabajo, type PlanTrabajoCreate } from "@/hooks/useHelixPlanesTrabajo"
import { useHelixToast } from "../HelixToast"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { BlurFade } from "@/components/ui/blur-fade"
import { SubactividadesEditor, emptySubactividadRow, type SubactividadRow } from "./SubactividadesEditor"

interface WorkPlanDialogProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
}

const ACTIVIDADES_EJEMPLO = [
  "Definir alcance y responsables",
  "Ejecutar actividades priorizadas",
  "Validar avances, evidencias y bloqueos",
  "Cerrar plan con lecciones aprendidas",
].join("\n")

function emptySubactividadesBase(): SubactividadRow[] {
  return [
    { ...emptySubactividadRow(), nombre: "Definir entregable" },
    { ...emptySubactividadRow(), nombre: "Registrar avance" },
    { ...emptySubactividadRow(), nombre: "Adjuntar evidencia" },
  ]
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function addDaysIso(iso: string, dias: number): string {
  const fecha = new Date(`${iso}T12:00:00`)
  fecha.setDate(fecha.getDate() + dias)
  return fecha.toISOString().slice(0, 10)
}

function initialsOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  const initials = (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")
  return initials.toUpperCase() || "NA"
}

const WorkPlanSchema = z.object({
  nombre: z.string().min(1, "El nombre del plan es requerido").max(100, "Máximo 100 caracteres"),
  liderResponsableId: z.string().min(1, "Selecciona un responsable líder"),
  fechaInicio: z.string().min(1, "Fecha de inicio requerida"),
  fechaFin: z.string().min(1, "Fecha de fin requerida"),
})

type WorkPlanFields = z.infer<typeof WorkPlanSchema>
type FieldErrors = Partial<Record<keyof WorkPlanFields, string>>

interface FormState {
  nombre: string
  objetivo: string
  liderResponsableId: string
  fechaInicio: string
  fechaFin: string
  actividades: string
}

function buildInitialForm(): FormState {
  const hoy = todayISO()
  return {
    nombre: "",
    objetivo: "",
    liderResponsableId: "",
    fechaInicio: hoy,
    fechaFin: addDaysIso(hoy, 14),
    actividades: ACTIVIDADES_EJEMPLO,
  }
}

export function WorkPlanDialog({ open, onClose, onSaved }: WorkPlanDialogProps) {
  const { usuarios } = useHelixUsuarios()
  const { createPlanTrabajo } = useHelixPlanesTrabajo()
  const { showToast } = useHelixToast()

  const [form, setForm] = useState<FormState>(buildInitialForm)
  const [subactividades, setSubactividades] = useState<SubactividadRow[]>(emptySubactividadesBase)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [apiError, setApiError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setForm(buildInitialForm())
      setSubactividades(emptySubactividadesBase())
      setFieldErrors({})
      setApiError(null)
      setSaving(false)
    }
  }, [open])

  if (!open) return null

  function setField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }))
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
    const parsed = WorkPlanSchema.safeParse({
      nombre: form.nombre,
      liderResponsableId: form.liderResponsableId,
      fechaInicio: form.fechaInicio,
      fechaFin: form.fechaFin,
    })

    const errs: FieldErrors = {}
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors
      for (const [k, v] of Object.entries(flat)) {
        if (v && v.length > 0) errs[k as keyof WorkPlanFields] = v[0]
      }
    }
    if (!errs.fechaFin && form.fechaFin < form.fechaInicio) {
      errs.fechaFin = "Debe ser igual o posterior a Fecha Inicio"
    }
    const actividadesValidas = form.actividades.split("\n").map((a) => a.trim()).filter(Boolean)
    if (actividadesValidas.length === 0) {
      errs.nombre = errs.nombre ?? undefined
      setApiError("El plan necesita al menos una actividad en \"Actividades iniciales\"")
    }
    setFieldErrors(errs)
    return Object.keys(errs).length === 0 && actividadesValidas.length > 0
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setApiError(null)
    if (!validate()) return

    setSaving(true)
    const lider = usuarios.find((u) => u.id === Number(form.liderResponsableId))
    const actividades = form.actividades.split("\n").map((a) => a.trim()).filter(Boolean)

    const payload: PlanTrabajoCreate = {
      nombre: form.nombre.trim(),
      objetivo: form.objetivo.trim() || undefined,
      liderResponsableId: Number(form.liderResponsableId),
      liderResponsableNombre: lider?.full_name ?? "",
      liderResponsableInitials: lider ? initialsOf(lider.full_name) : "",
      liderResponsableColor: lider?.color ?? "#5461c8",
      fechaInicio: form.fechaInicio,
      fechaFin: form.fechaFin,
      actividades,
      subactividadesBase: subactividades
        .filter((row) => row.nombre.trim())
        .map((row) => {
          const subLider = usuarios.find((u) => u.id === Number(row.responsableId))
          return {
            nombre: row.nombre.trim(),
            responsableId: subLider ? subLider.id : null,
            responsableNombre: subLider?.full_name ?? null,
            estado: row.estado,
          }
        }),
    }

    try {
      const resultado = await createPlanTrabajo(payload)
      showToast(`Plan creado con ${resultado.actividades.length} actividad(es)`, "success")
      onSaved()
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al crear el plan de trabajo"
      setApiError(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Plan de trabajo</DialogTitle>
          <DialogDescription>Registro rápido: reparte actividades automáticamente en un rango de fechas.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
          {apiError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
              {apiError}
            </div>
          )}

          <BlurFade duration={0.3}>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="wp-nombre">Nombre del plan *</Label>
                <Input
                  id="wp-nombre"
                  value={form.nombre}
                  onChange={(e) => setField("nombre", e.target.value)}
                  placeholder="Ej. Plan de estabilización operativa"
                  autoFocus
                  className={fieldErrors.nombre ? "border-destructive" : undefined}
                />
                {fieldErrors.nombre && <p className="text-xs text-destructive">{fieldErrors.nombre}</p>}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="wp-objetivo">Objetivo</Label>
                <Textarea
                  id="wp-objetivo"
                  value={form.objetivo}
                  onChange={(e) => setField("objetivo", e.target.value)}
                  placeholder="Resultado esperado, área o cliente interno"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="wp-lider">Responsable líder *</Label>
                  <Select value={form.liderResponsableId} onValueChange={(v) => setField("liderResponsableId", v)}>
                    <SelectTrigger id="wp-lider" className={fieldErrors.liderResponsableId ? "border-destructive" : undefined}>
                      <SelectValue placeholder="Seleccionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      {usuarios.map((u) => (
                        <SelectItem key={u.id} value={String(u.id)}>{u.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldErrors.liderResponsableId && <p className="text-xs text-destructive">{fieldErrors.liderResponsableId}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="wp-inicio">Inicio *</Label>
                  <Input
                    id="wp-inicio"
                    type="date"
                    value={form.fechaInicio}
                    onChange={(e) => setField("fechaInicio", e.target.value)}
                    className={fieldErrors.fechaInicio ? "border-destructive" : undefined}
                  />
                  {fieldErrors.fechaInicio && <p className="text-xs text-destructive">{fieldErrors.fechaInicio}</p>}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="wp-fin">Fin *</Label>
                  <Input
                    id="wp-fin"
                    type="date"
                    value={form.fechaFin}
                    min={form.fechaInicio}
                    onChange={(e) => setField("fechaFin", e.target.value)}
                    className={fieldErrors.fechaFin ? "border-destructive" : undefined}
                  />
                  {fieldErrors.fechaFin && <p className="text-xs text-destructive">{fieldErrors.fechaFin}</p>}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="wp-actividades">Actividades iniciales *</Label>
                <Textarea
                  id="wp-actividades"
                  value={form.actividades}
                  onChange={(e) => setField("actividades", e.target.value)}
                  placeholder={"Una actividad por línea. Ej.\nLevantar alcance\nValidar responsables"}
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">Una por línea — se reparten automáticamente entre Inicio y Fin.</p>
              </div>
            </div>
          </BlurFade>

          <BlurFade duration={0.3} delay={0.05}>
            <SubactividadesEditor
              rows={subactividades}
              usuarios={usuarios}
              onAdd={addSubactividadRow}
              onUpdate={updateSubactividadRow}
              onRemove={removeSubactividadRow}
              title="Subactividades base (se repiten en cada actividad)"
            />
          </BlurFade>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? "Creando..." : "Crear plan"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
