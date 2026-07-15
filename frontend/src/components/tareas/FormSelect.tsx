import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// Radix Select prohíbe items con value="". Para las listas que tienen una opción
// vacía seleccionable ("Sin asignar", "Sin modalidad") usamos este sentinel y lo
// traducimos a "" hacia afuera.
const NONE = "__none__"

interface Option {
  value: string
  label: string
}

interface FormSelectProps {
  label?: string
  value: string
  onChange: (value: string) => void
  options: Option[]
  placeholder?: string
  /** Si se define, agrega un item seleccionable que representa "" (ej. "Sin asignar"). */
  noneLabel?: string
  triggerClassName?: string
}

const LABEL_CLASS =
  "mb-1.5 block text-[11px] font-bold uppercase tracking-[0.06em] text-zinc-500"

export function FormSelect({
  label,
  value,
  onChange,
  options,
  placeholder = "Seleccionar…",
  noneLabel,
  triggerClassName,
}: FormSelectProps) {
  const selectValue = value === "" && noneLabel ? NONE : value

  return (
    <div>
      {label && <label className={LABEL_CLASS}>{label}</label>}
      <Select value={selectValue} onValueChange={(v) => onChange(v === NONE ? "" : v)}>
        <SelectTrigger
          className={cn("h-10 border-zinc-300 bg-white text-zinc-900", triggerClassName)}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {noneLabel && <SelectItem value={NONE}>{noneLabel}</SelectItem>}
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
