import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { LIB_PRODUCTOS, LIB_ESTADOS, LIB_PRIORIDADES } from "@/types/libertadora"
import type { LibProspecto, LibProspectoInput } from "@/types/libertadora"

const EMPTY: LibProspectoInput = {
  empresa: "",
  producto: "CREA PATRIMONIO PJ",
  gestion: "",
  estado: "EN_PROCESO",
  monto: 0,
  prioridad: "MEDIA",
  accion: "",
  fecha: "",
  trimestre: "Q3",
  tipo: "PJ",
}

interface ProspectoFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  prospecto: LibProspecto | null
  onSubmit: (data: LibProspectoInput) => void | Promise<void>
  onDelete?: () => void
  submitting?: boolean
}

export function ProspectoFormDialog({ open, onOpenChange, prospecto, onSubmit, onDelete, submitting }: ProspectoFormDialogProps) {
  const [form, setForm] = useState<LibProspectoInput>(EMPTY)

  useEffect(() => {
    if (open) setForm(prospecto ? { ...EMPTY, ...prospecto } : EMPTY)
  }, [open, prospecto])

  function set<K extends keyof LibProspectoInput>(key: K, value: LibProspectoInput[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{prospecto ? "Editar prospecto" : "Nuevo prospecto"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Empresa / cliente *</Label>
            <Input value={form.empresa} onChange={(e) => set("empresa", e.target.value)} placeholder="Nombre de la empresa o cliente" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Producto</Label>
              <Select value={form.producto} onValueChange={(v) => set("producto", v as LibProspectoInput["producto"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LIB_PRODUCTOS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Tipo</Label>
              <Select value={form.tipo ?? "PJ"} onValueChange={(v) => set("tipo", v as "PJ" | "PN")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PJ">PJ · Persona jurídica</SelectItem>
                  <SelectItem value="PN">PN · Persona natural</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Gestión comercial</Label>
            <Input value={form.gestion ?? ""} onChange={(e) => set("gestion", e.target.value)} placeholder="Describe la gestión realizada..." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Estado</Label>
              <Select value={form.estado} onValueChange={(v) => set("estado", v as LibProspectoInput["estado"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LIB_ESTADOS.map((e) => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Prioridad</Label>
              <Select value={form.prioridad} onValueChange={(v) => set("prioridad", v as LibProspectoInput["prioridad"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LIB_PRIORIDADES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Monto COP / mes</Label>
              <Input type="number" min={0} value={form.monto || ""} onChange={(e) => set("monto", Number(e.target.value) || 0)} placeholder="Ej. 505000" />
            </div>
            <div className="grid gap-1.5">
              <Label>Trimestre</Label>
              <Select value={form.trimestre ?? "Q3"} onValueChange={(v) => set("trimestre", v as LibProspectoInput["trimestre"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Q1">Q1 · Ene-Mar</SelectItem>
                  <SelectItem value="Q2">Q2 · Abr-Jun</SelectItem>
                  <SelectItem value="Q3">Q3 · Jul-Sep</SelectItem>
                  <SelectItem value="Q4">Q4 · Oct-Dic</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Próxima acción</Label>
            <Input value={form.accion ?? ""} onChange={(e) => set("accion", e.target.value)} placeholder="Ej. Enviar propuesta, confirmar cita..." />
          </div>

          <div className="grid gap-1.5">
            <Label>Fecha de seguimiento</Label>
            <Input type="date" value={form.fecha ?? ""} onChange={(e) => set("fecha", e.target.value)} />
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          {onDelete ? (
            <Button type="button" variant="destructive" onClick={onDelete}>Eliminar</Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button
              type="button"
              disabled={!form.empresa.trim() || submitting}
              style={{ background: "var(--lib-teal)" }}
              onClick={() => onSubmit(form)}
            >
              Guardar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
