import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { LibCita, LibCitaInput, LibModalidad, LibEstadoCita } from "@/types/libertadora"

const MODALIDADES: LibModalidad[] = ["Presencial", "Microsoft Teams", "Zoom", "WhatsApp", "Telefónica"]
const ESTADOS: { value: LibEstadoCita; label: string }[] = [
  { value: "pending", label: "Pendiente" },
  { value: "confirmed", label: "Confirmada" },
  { value: "cancelled", label: "Cancelada" },
]

function emptyForm(fecha?: string, hora?: string): LibCitaInput {
  return {
    cliente: "", fecha: fecha ?? "", hora: hora ?? "09:00",
    modalidad: "Presencial", producto: "PORTAFOLIO", estado: "pending", notas: "",
  }
}

interface CitaFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cita: LibCita | null
  prefill?: { fecha: string; hora: string } | null
  onSubmit: (data: LibCitaInput) => void | Promise<void>
  onDelete?: () => void
  submitting?: boolean
}

export function CitaFormDialog({ open, onOpenChange, cita, prefill, onSubmit, onDelete, submitting }: CitaFormDialogProps) {
  const [form, setForm] = useState<LibCitaInput>(emptyForm())

  useEffect(() => {
    if (open) setForm(cita ? { ...emptyForm(), ...cita } : emptyForm(prefill?.fecha, prefill?.hora))
  }, [open, cita, prefill])

  function set<K extends keyof LibCitaInput>(key: K, value: LibCitaInput[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{cita ? "Editar cita" : "Nueva cita"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Cliente / empresa *</Label>
            <Input value={form.cliente} onChange={(e) => set("cliente", e.target.value)} placeholder="Nombre del cliente o empresa" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Fecha *</Label>
              <Input type="date" value={form.fecha} onChange={(e) => set("fecha", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Hora</Label>
              <Input type="time" value={form.hora} onChange={(e) => set("hora", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Modalidad</Label>
              <Select value={form.modalidad} onValueChange={(v) => set("modalidad", v as LibModalidad)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MODALIDADES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Estado</Label>
              <Select value={form.estado} onValueChange={(v) => set("estado", v as LibEstadoCita)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ESTADOS.map((e) => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Objetivo / notas</Label>
            <Input value={form.notas ?? ""} onChange={(e) => set("notas", e.target.value)} placeholder="Objetivo, personas a contactar, material necesario..." />
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
              disabled={!form.cliente.trim() || !form.fecha || submitting}
              style={{ background: "var(--lib-teal)" }}
              onClick={() => onSubmit(form)}
            >
              Guardar cita
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
