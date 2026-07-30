import { Plus, Trash2 } from "lucide-react"
import type { HelixUsuario } from "@/types/helix"
import { HELIX_ESTADOS } from "@/lib/helixConstants"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"

export interface SubactividadRow {
  key: string
  nombre: string
  responsableId: string
  estado: string
}

export function emptySubactividadRow(): SubactividadRow {
  return { key: crypto.randomUUID(), nombre: "", responsableId: "", estado: "Planificado" }
}

interface SubactividadesEditorProps {
  rows: SubactividadRow[]
  usuarios: HelixUsuario[]
  onAdd: () => void
  onUpdate: (key: string, patch: Partial<SubactividadRow>) => void
  onRemove: (key: string) => void
  title?: string
}

export function SubactividadesEditor({
  rows,
  usuarios,
  onAdd,
  onUpdate,
  onRemove,
  title = "Subactividades",
}: SubactividadesEditorProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
        <Button type="button" variant="outline" size="sm" onClick={onAdd}>
          <Plus className="h-3.5 w-3.5" /> Adicionar
        </Button>
      </div>

      {rows.map((row) => (
        <div key={row.key} className="grid grid-cols-[1fr_140px_130px_auto] items-center gap-2">
          <Input
            value={row.nombre}
            onChange={(e) => onUpdate(row.key, { nombre: e.target.value })}
            placeholder="Ej. Validar entregable"
            aria-label="Nombre de la subactividad"
          />
          <Select
            value={row.responsableId || "none"}
            onValueChange={(v) => onUpdate(row.key, { responsableId: v === "none" ? "" : v })}
          >
            <SelectTrigger aria-label="Responsable de la subactividad"><SelectValue placeholder="Sin responsable" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin responsable</SelectItem>
              {usuarios.map((u) => (
                <SelectItem key={u.id} value={String(u.id)}>{u.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={row.estado} onValueChange={(v) => onUpdate(row.key, { estado: v })}>
            <SelectTrigger aria-label="Estado de la subactividad"><SelectValue /></SelectTrigger>
            <SelectContent>
              {HELIX_ESTADOS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onRemove(row.key)}
            aria-label="Eliminar subactividad"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ))}
    </div>
  )
}
