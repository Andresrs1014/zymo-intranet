import { useEffect, useState } from "react"
import type { ComponentProps, FocusEvent, FormEvent, ReactNode, RefObject } from "react"
import {
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Building2,
  Check,
  CircleDot,
  ClipboardCheck,
  Clock,
  Code2,
  Gauge,
  Pencil,
  Plus,
  Radio,
  Search,
  Settings2,
  Tags,
  Trash2,
  UserCheck,
  UserCog,
  Users,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  useCreateAreaPrefix,
  useCreateListItem,
  useDeleteAreaPrefix,
  useDeleteListItem,
  useTicketAreaPrefixes,
  useTicketConfigLists,
  useUpdateAreaPrefix,
  useUpdateListItem,
} from "@/hooks/useTickets"
import { cn } from "@/lib/utils"
import { api } from "@/lib/api"
import { extractErrorMessage } from "@/lib/ticketErrors"
import type { TicketAreaPrefix, TicketListItem } from "@/types/ticket"
import { useTicketToast } from "./TicketToast"

interface TicketConfigDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  returnFocusRef: RefObject<HTMLButtonElement | null>
}

type EditableListType =
  | "statuses" | "types" | "platforms" | "managers"
  | "priorities" | "impacts" | "channels" | "managementCriteria"
type MoveDirection = -1 | 1

interface IconActionProps extends ComponentProps<typeof Button> {
  label: string
  children: ReactNode
}

function IconAction({ label, children, className, ...props }: IconActionProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={label}
          className={cn(
            "h-8 w-8 shrink-0 text-zinc-500 transition-colors hover:text-zinc-950 motion-reduce:transition-none",
            className
          )}
          {...props}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  )
}

interface ItemActionsProps {
  index: number
  length: number
  confirming: boolean
  pending: boolean
  onMove: (direction: MoveDirection) => void
  onEdit: () => void
  onRequestDelete: () => void
  onConfirmDelete: () => void
  onCancelDelete: () => void
}

function ItemActions(props: ItemActionsProps) {
  if (props.confirming) {
    return (
      <div
        role="group"
        aria-label="Confirmar eliminaci&oacute;n"
        className="flex flex-wrap items-center justify-end gap-1.5"
      >
        <span className="mr-1 text-xs font-semibold text-destructive">&iquest;Eliminar?</span>
        <Button type="button" variant="ghost" size="sm" onClick={props.onCancelDelete}>
          Cancelar
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={props.pending}
          onClick={props.onConfirmDelete}
        >
          Eliminar
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-end gap-0.5">
      <IconAction
        label="Subir"
        disabled={props.pending || props.index === 0}
        onClick={() => props.onMove(-1)}
      >
        <ArrowUp className="h-4 w-4" />
      </IconAction>
      <IconAction
        label="Bajar"
        disabled={props.pending || props.index === props.length - 1}
        onClick={() => props.onMove(1)}
      >
        <ArrowDown className="h-4 w-4" />
      </IconAction>
      <IconAction label="Editar" disabled={props.pending} onClick={props.onEdit}>
        <Pencil className="h-4 w-4" />
      </IconAction>
      <IconAction
        label="Eliminar"
        disabled={props.pending}
        className="hover:bg-destructive/10 hover:text-destructive"
        onClick={props.onRequestDelete}
      >
        <Trash2 className="h-4 w-4" />
      </IconAction>
    </div>
  )
}

function EditActions({
  pending,
  onSave,
  onCancel,
}: {
  pending: boolean
  onSave: () => void
  onCancel: () => void
}) {
  return (
    <div className="flex items-center gap-0.5">
      <IconAction
        label="Guardar"
        disabled={pending}
        className="text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
        onClick={onSave}
      >
        <Check className="h-4 w-4" />
      </IconAction>
      <IconAction label="Cancelar" disabled={pending} onClick={onCancel}>
        <X className="h-4 w-4" />
      </IconAction>
    </div>
  )
}

function LoadingRows() {
  return (
    <div role="status" aria-label="Cargando configuraci&oacute;n" className="divide-y divide-zinc-100">
      {[0, 1, 2, 3].map((row) => (
        <div key={row} className="flex h-14 items-center justify-between gap-4 px-4">
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-8 w-32" />
        </div>
      ))}
    </div>
  )
}

function QueryErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <AlertCircle className="h-6 w-6 text-destructive" />
      <p className="text-sm font-medium text-zinc-700">No se pudo cargar la configuraci&oacute;n.</p>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        Reintentar
      </Button>
    </div>
  )
}

function SlaHoursField({
  item,
  pending,
  onSave,
}: {
  item: TicketListItem
  pending: boolean
  onSave: (hours: number | null) => void
}) {
  function handleBlur(event: FocusEvent<HTMLInputElement>) {
    const raw = event.target.value.trim()
    const parsed = raw === "" ? null : Math.max(0, Number(raw))
    if (parsed === (item.slaHours ?? null)) return
    onSave(Number.isNaN(parsed) ? null : parsed)
  }

  return (
    <label className="flex shrink-0 items-center gap-1.5 text-xs text-zinc-500">
      <Clock className="h-3.5 w-3.5" />
      <Input
        key={`${item.id}-${item.slaHours ?? "none"}`}
        type="number"
        min={0}
        disabled={pending}
        defaultValue={item.slaHours ?? ""}
        placeholder="Sin límite"
        aria-label={`Horas laborales límite para ${item.label}`}
        className="h-8 w-24 text-xs"
        onBlur={handleBlur}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur()
        }}
      />
      <span>h</span>
    </label>
  )
}

interface ListRowProps {
  item: TicketListItem
  index: number
  length: number
  editing: boolean
  draft: string
  confirming: boolean
  pending: boolean
  showSlaHours?: boolean
  onDraftChange: (value: string) => void
  onEdit: () => void
  onSave: () => void
  onCancelEdit: () => void
  onSaveSla: (hours: number | null) => void
  onMove: (direction: MoveDirection) => void
  onRequestDelete: () => void
  onConfirmDelete: () => void
  onCancelDelete: () => void
}

function ListRow(props: ListRowProps) {
  return (
    <li className="flex min-h-14 flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      {props.editing ? (
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Input
            autoFocus
            name={"edit-list-item-" + props.item.id}
            autoComplete="off"
            aria-label="Editar valor"
            value={props.draft}
            className="h-9"
            onChange={(event) => props.onDraftChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") props.onSave()
              if (event.key === "Escape") props.onCancelEdit()
            }}
          />
          <EditActions
            pending={props.pending}
            onSave={props.onSave}
            onCancel={props.onCancelEdit}
          />
        </div>
      ) : (
        <>
          <div className="flex min-w-0 items-center gap-3">
            <span className="w-6 shrink-0 font-mono text-[11px] text-zinc-400">
              {String(props.index + 1).padStart(2, "0")}
            </span>
            <span className="truncate text-sm font-medium text-zinc-800">{props.item.label}</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {props.showSlaHours ? (
              <SlaHoursField item={props.item} pending={props.pending} onSave={props.onSaveSla} />
            ) : null}
            <ItemActions
              index={props.index}
              length={props.length}
              confirming={props.confirming}
              pending={props.pending}
              onMove={props.onMove}
              onEdit={props.onEdit}
              onRequestDelete={props.onRequestDelete}
              onConfirmDelete={props.onConfirmDelete}
              onCancelDelete={props.onCancelDelete}
            />
          </div>
        </>
      )}
    </li>
  )
}

interface ListConfigSectionProps {
  listType: EditableListType
  singular: string
  items: TicketListItem[]
  isLoading: boolean
  showSlaHours?: boolean
}

type RolTicket = "supervisor" | "analista" | "coordinador"
interface PersonaCargo {
  id: number
  nombre: string
  email: string
}

// Supervisor/Analista/Coordinador ya no son texto libre (ver [[project_directorio_jerarquia_tickets]])
// — se curan personas reales del Directorio (con cargo asignado) filtrando
// por área, para que el formulario de tickets solo ofrezca gente relevante y
// con correo real. `curados`/`onChange` viven en el padre para que el badge
// de conteo en la pestaña se actualice al marcar/desmarcar.
function RolTicketSection({
  rol, singular, curados, onChange,
}: {
  rol: RolTicket
  singular: string
  curados: PersonaCargo[]
  onChange: (next: PersonaCargo[]) => void
}) {
  const { showToast } = useTicketToast()
  const [query, setQuery] = useState("")
  const [candidatos, setCandidatos] = useState<PersonaCargo[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Buscador por nombre en vez de filtro por área — el filtro por área se
  // intentó dos veces (persona.area_id, luego con fallback al área del
  // cargo) y siguió sin encontrar candidatos reales; reconciliar área de
  // persona vs área de cargo resultó frágil. Buscar por nombre es más simple
  // y no depende de ese dato.
  useEffect(() => {
    setLoading(true)
    const timeout = setTimeout(() => {
      api.get("/operativo/personas/candidatos-cargo", { params: query ? { q: query } : {} })
        .then(({ data }) => setCandidatos(Array.isArray(data) ? data : []))
        .catch(() => setCandidatos([]))
        .finally(() => setLoading(false))
    }, 250)
    return () => clearTimeout(timeout)
  }, [query])

  const curadosIds = new Set(curados.map((p) => p.id))

  async function toggle(persona: PersonaCargo, checked: boolean) {
    const next = checked ? [...curados, persona] : curados.filter((p) => p.id !== persona.id)
    onChange(next)
    setSaving(true)
    try {
      await api.put("/operativo/personas/roles-ticket", { rol, persona_ids: next.map((p) => p.id) })
    } catch (error) {
      onChange(curados)
      showToast(extractErrorMessage(error, "No se pudo guardar el cambio."), "error")
    } finally {
      setSaving(false)
    }
  }

  return (
    <section aria-label={singular} className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-zinc-200 bg-zinc-50/80 p-4">
        <label className="mb-1.5 block text-xs font-semibold text-zinc-600">
          Buscar persona (nombre o número de documento)
        </label>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Nombre o cédula…"
          className="h-10 max-w-xs bg-white"
        />
        <p className="mt-2 text-xs text-zinc-500">
          Marca quiénes pueden aparecer como {singular.toLocaleLowerCase("es")} en el formulario de tickets —
          solo aparecen personas con cargo asignado.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {loading ? (
          <LoadingRows />
        ) : candidatos.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-zinc-500">
            {query ? "Sin resultados para esa búsqueda." : "No hay personas con cargo asignado."}
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {candidatos.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                <input
                  type="checkbox"
                  checked={curadosIds.has(p.id)}
                  disabled={saving}
                  onChange={(e) => void toggle(p, e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300"
                />
                <span className="text-sm text-zinc-900">{p.nombre}</span>
                <span className="ml-auto truncate text-xs text-zinc-400">{p.email}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

function ListConfigSection({ listType, singular, items, isLoading, showSlaHours }: ListConfigSectionProps) {
  const createItem = useCreateListItem()
  const updateItem = useUpdateListItem()
  const deleteItem = useDeleteListItem()
  const { showToast } = useTicketToast()
  const [newLabel, setNewLabel] = useState("")
  const [editingId, setEditingId] = useState<number | null>(null)
  const [draft, setDraft] = useState("")
  const [confirmingId, setConfirmingId] = useState<number | null>(null)
  const pending = createItem.isPending || updateItem.isPending || deleteItem.isPending
  const inputId = listType + "-new"

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    const label = newLabel.trim()
    if (!label) return
    try {
      await createItem.mutateAsync({ listType, value: label, label, sortOrder: items.length })
      setNewLabel("")
      showToast(singular + " agregado", "success")
    } catch (error) {
      showToast(
        extractErrorMessage(error, "No se pudo agregar el valor. Revisa si ya existe."),
        "error"
      )
    }
  }

  async function handleSave(item: TicketListItem) {
    const label = draft.trim()
    if (!label || label === item.label) {
      setEditingId(null)
      return
    }
    try {
      await updateItem.mutateAsync({ id: item.id, label })
      setEditingId(null)
      showToast("Cambio guardado", "success")
    } catch (error) {
      showToast(extractErrorMessage(error), "error")
    }
  }

  async function handleMove(index: number, direction: MoveDirection) {
    const targetIndex = index + direction
    const item = items[index]
    const target = items[targetIndex]
    if (!item || !target) return
    try {
      await Promise.all([
        updateItem.mutateAsync({ id: item.id, sortOrder: targetIndex }),
        updateItem.mutateAsync({ id: target.id, sortOrder: index }),
      ])
      showToast("Orden actualizado", "success")
    } catch (error) {
      showToast(extractErrorMessage(error, "No se pudo actualizar el orden."), "error")
    }
  }

  async function handleDelete(item: TicketListItem) {
    try {
      await deleteItem.mutateAsync(item.id)
      setConfirmingId(null)
      showToast(singular + " eliminado", "success")
    } catch (error) {
      showToast(extractErrorMessage(error, "No se pudo eliminar el valor."), "error")
    }
  }

  async function handleSaveSla(item: TicketListItem, hours: number | null) {
    try {
      await updateItem.mutateAsync({ id: item.id, slaHours: hours })
      showToast("SLA actualizado", "success")
    } catch (error) {
      showToast(extractErrorMessage(error, "No se pudo actualizar el SLA."), "error")
    }
  }

  return (
    <section aria-label={singular} className="flex h-full min-h-0 flex-col">
      <form onSubmit={handleCreate} className="shrink-0 border-b border-zinc-200 bg-zinc-50/80 p-4">
        <label htmlFor={inputId} className="mb-1.5 block text-xs font-semibold text-zinc-600">
          Nuevo {singular.toLocaleLowerCase("es")}
        </label>
        <div className="flex gap-2">
          <Input
            id={inputId}
            name={listType + "-new-label"}
            autoComplete="off"
            required
            value={newLabel}
            placeholder={"Ej. " + singular + "\u2026"}
            className="h-10 flex-1 bg-white"
            onChange={(event) => setNewLabel(event.target.value)}
          />
          <Button type="submit" disabled={pending} className="shrink-0">
            <Plus className="mr-2 h-4 w-4" />
            Agregar
          </Button>
        </div>
      </form>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {isLoading ? (
          <LoadingRows />
        ) : items.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-zinc-500">
            No hay valores configurados.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {items.map((item, index) => (
              <ListRow
                key={item.id}
                item={item}
                index={index}
                length={items.length}
                editing={editingId === item.id}
                draft={draft}
                confirming={confirmingId === item.id}
                pending={pending}
                showSlaHours={showSlaHours}
                onDraftChange={setDraft}
                onEdit={() => {
                  setEditingId(item.id)
                  setDraft(item.label)
                  setConfirmingId(null)
                }}
                onSave={() => void handleSave(item)}
                onCancelEdit={() => setEditingId(null)}
                onSaveSla={(hours) => void handleSaveSla(item, hours)}
                onMove={(direction) => void handleMove(index, direction)}
                onRequestDelete={() => {
                  setConfirmingId(item.id)
                  setEditingId(null)
                }}
                onConfirmDelete={() => void handleDelete(item)}
                onCancelDelete={() => setConfirmingId(null)}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

interface AreaRowProps {
  item: TicketAreaPrefix
  index: number
  length: number
  editing: boolean
  draft: { area: string; prefix: string }
  confirming: boolean
  pending: boolean
  onDraftChange: (draft: { area: string; prefix: string }) => void
  onEdit: () => void
  onSave: () => void
  onCancelEdit: () => void
  onMove: (direction: MoveDirection) => void
  onRequestDelete: () => void
  onConfirmDelete: () => void
  onCancelDelete: () => void
}

function AreaRow(props: AreaRowProps) {
  const saveOnEnter = (key: string) => {
    if (key === "Enter") props.onSave()
    if (key === "Escape") props.onCancelEdit()
  }

  return (
    <li className="flex min-h-16 flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      {props.editing ? (
        <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_7rem_auto] gap-2">
          <Input
            autoFocus
            name={"edit-area-" + props.item.id}
            autoComplete="off"
            aria-label="Editar &aacute;rea"
            value={props.draft.area}
            className="h-9"
            onChange={(event) => props.onDraftChange({ ...props.draft, area: event.target.value })}
            onKeyDown={(event) => saveOnEnter(event.key)}
          />
          <Input
            aria-label="Editar prefijo"
            name={"edit-prefix-" + props.item.id}
            autoComplete="off"
            spellCheck={false}
            value={props.draft.prefix}
            className="h-9 font-mono uppercase"
            onChange={(event) =>
              props.onDraftChange({ ...props.draft, prefix: event.target.value.toUpperCase() })
            }
            onKeyDown={(event) => saveOnEnter(event.key)}
          />
          <EditActions
            pending={props.pending}
            onSave={props.onSave}
            onCancel={props.onCancelEdit}
          />
        </div>
      ) : (
        <>
          <div className="flex min-w-0 items-center gap-3">
            <span className="w-6 shrink-0 font-mono text-[11px] text-zinc-400">
              {String(props.index + 1).padStart(2, "0")}
            </span>
            <span className="truncate text-sm font-medium text-zinc-800">{props.item.area}</span>
            <code className="shrink-0 rounded border border-primary/20 bg-primary/5 px-2 py-0.5 font-mono text-xs font-semibold text-primary">
              {props.item.prefix}
            </code>
          </div>
          <ItemActions
            index={props.index}
            length={props.length}
            confirming={props.confirming}
            pending={props.pending}
            onMove={props.onMove}
            onEdit={props.onEdit}
            onRequestDelete={props.onRequestDelete}
            onConfirmDelete={props.onConfirmDelete}
            onCancelDelete={props.onCancelDelete}
          />
        </>
      )}
    </li>
  )
}

function AreaPrefixSection({
  items,
  isLoading,
}: {
  items: TicketAreaPrefix[]
  isLoading: boolean
}) {
  const createItem = useCreateAreaPrefix()
  const updateItem = useUpdateAreaPrefix()
  const deleteItem = useDeleteAreaPrefix()
  const { showToast } = useTicketToast()
  const [newItem, setNewItem] = useState({ area: "", prefix: "" })
  const [editingId, setEditingId] = useState<number | null>(null)
  const [draft, setDraft] = useState({ area: "", prefix: "" })
  const [confirmingId, setConfirmingId] = useState<number | null>(null)
  const pending = createItem.isPending || updateItem.isPending || deleteItem.isPending

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    const area = newItem.area.trim()
    const prefix = newItem.prefix.trim()
    if (!area || !prefix) return
    const sortOrder = items.reduce((max, item) => Math.max(max, item.sortOrder), -1) + 1
    try {
      await createItem.mutateAsync({ area, prefix, sortOrder })
      setNewItem({ area: "", prefix: "" })
      showToast("Prefijo de \u00e1rea agregado", "success")
    } catch (error) {
      showToast(extractErrorMessage(error, "No se pudo agregar el prefijo."), "error")
    }
  }

  async function handleSave(item: TicketAreaPrefix) {
    const area = draft.area.trim()
    const prefix = draft.prefix.trim()
    if (!area || !prefix) return
    try {
      await updateItem.mutateAsync({ id: item.id, area, prefix })
      setEditingId(null)
      showToast("Cambio guardado", "success")
    } catch (error) {
      showToast(extractErrorMessage(error), "error")
    }
  }

  async function handleMove(index: number, direction: MoveDirection) {
    const target = items[index + direction]
    const item = items[index]
    if (!item || !target) return
    try {
      await Promise.all([
        updateItem.mutateAsync({ id: item.id, sortOrder: target.sortOrder }),
        updateItem.mutateAsync({ id: target.id, sortOrder: item.sortOrder }),
      ])
      showToast("Orden actualizado", "success")
    } catch (error) {
      showToast(extractErrorMessage(error, "No se pudo actualizar el orden."), "error")
    }
  }

  async function handleDelete(item: TicketAreaPrefix) {
    try {
      await deleteItem.mutateAsync(item.id)
      setConfirmingId(null)
      showToast("Prefijo de \u00e1rea eliminado", "success")
    } catch (error) {
      showToast(extractErrorMessage(error, "No se pudo eliminar el prefijo."), "error")
    }
  }

  return (
    <section aria-label="C&oacute;digo por &aacute;rea" className="flex h-full min-h-0 flex-col">
      <form
        onSubmit={handleCreate}
        className="grid shrink-0 grid-cols-1 gap-3 border-b border-zinc-200 bg-zinc-50/80 p-4 sm:grid-cols-[minmax(0,1fr)_8rem_auto] sm:items-end"
      >
        <label className="grid gap-1.5 text-xs font-semibold text-zinc-600">
          Nueva &aacute;rea
          <Input
            name="new-area"
            autoComplete="off"
            required
            value={newItem.area}
            placeholder={"Ej. Calidad\u2026"}
            className="h-10 bg-white"
            onChange={(event) => setNewItem({ ...newItem, area: event.target.value })}
          />
        </label>
        <label className="grid gap-1.5 text-xs font-semibold text-zinc-600">
          Prefijo
          <Input
            name="new-prefix"
            autoComplete="off"
            required
            spellCheck={false}
            value={newItem.prefix}
            placeholder={"Ej. CAL\u2026"}
            className="h-10 bg-white font-mono uppercase"
            onChange={(event) =>
              setNewItem({ ...newItem, prefix: event.target.value.toUpperCase() })
            }
          />
        </label>
        <Button
          type="submit"
          disabled={pending}
          className="sm:self-end"
        >
          <Plus className="mr-2 h-4 w-4" />
          Agregar
        </Button>
      </form>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {isLoading ? (
          <LoadingRows />
        ) : items.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-zinc-500">
            No hay prefijos configurados.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {items.map((item, index) => (
              <AreaRow
                key={item.id}
                item={item}
                index={index}
                length={items.length}
                editing={editingId === item.id}
                draft={draft}
                confirming={confirmingId === item.id}
                pending={pending}
                onDraftChange={setDraft}
                onEdit={() => {
                  setEditingId(item.id)
                  setDraft({ area: item.area, prefix: item.prefix })
                  setConfirmingId(null)
                }}
                onSave={() => void handleSave(item)}
                onCancelEdit={() => setEditingId(null)}
                onMove={(direction) => void handleMove(index, direction)}
                onRequestDelete={() => {
                  setConfirmingId(item.id)
                  setEditingId(null)
                }}
                onConfirmDelete={() => void handleDelete(item)}
                onCancelDelete={() => setConfirmingId(null)}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

function TabLabel({
  icon,
  children,
  count,
}: {
  icon: ReactNode
  children: ReactNode
  count: number
}) {
  return (
    <>
      {icon}
      <span className="truncate">{children}</span>
      <span className="rounded bg-black/5 px-1.5 py-0.5 font-mono text-[10px] leading-none">
        {count}
      </span>
    </>
  )
}

export function TicketConfigDialog({
  open,
  onOpenChange,
  returnFocusRef,
}: TicketConfigDialogProps) {
  const listsQuery = useTicketConfigLists()
  const areasQuery = useTicketAreaPrefixes()
  const statuses = listsQuery.data?.statuses ?? []
  const types = listsQuery.data?.types ?? []
  const platforms = listsQuery.data?.platforms ?? []
  const managers = listsQuery.data?.managers ?? []
  const priorities = listsQuery.data?.priorities ?? []
  const impacts = listsQuery.data?.impacts ?? []
  const channels = listsQuery.data?.channels ?? []
  const managementCriteria = listsQuery.data?.managementCriteria ?? []
  const areas = areasQuery.data ?? []

  const [rolesTicket, setRolesTicket] = useState<Record<RolTicket, PersonaCargo[]>>({
    supervisor: [], analista: [], coordinador: [],
  })
  useEffect(() => {
    if (!open) return
    api.get("/operativo/personas/roles-ticket").then(({ data }) => {
      setRolesTicket({
        supervisor: data?.supervisor ?? [],
        analista: data?.analista ?? [],
        coordinador: data?.coordinador ?? [],
      })
    }).catch(() => {})
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[min(90dvh,45rem)] w-[calc(100%-1.5rem)] max-w-2xl flex-col gap-0 overflow-hidden border-zinc-200 bg-white p-0 text-zinc-950 shadow-2xl motion-reduce:duration-0 motion-reduce:animate-none"
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          const focusTarget = returnFocusRef.current ?? document.getElementById("tickets-sidebar-trigger")
          focusTarget?.focus()
        }}
      >
        <div className="relative shrink-0 border-b border-zinc-200 px-5 py-4 pr-14">
          <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-primary" />
          <DialogHeader className="text-left">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Settings2 className="h-[18px] w-[18px]" />
              </span>
              <div className="min-w-0">
                <DialogTitle className="truncate text-base">Configuraci&oacute;n de tickets</DialogTitle>
                <DialogDescription className="mt-1">
                  Estado, tipo, prefijos por &aacute;rea y listas de personas.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <TooltipProvider delayDuration={250}>
          <Tabs defaultValue="statuses" className="flex min-h-0 flex-1 flex-col">
            <div className="shrink-0 border-b border-zinc-200 px-4 py-3">
              <TabsList className="grid h-auto w-full grid-cols-3 gap-1 bg-zinc-100 p-1 sm:grid-cols-5">
                <TabsTrigger
                  value="statuses"
                  className="min-h-10 min-w-0 gap-1.5 px-2 text-xs data-[state=active]:bg-primary data-[state=active]:text-white sm:text-sm"
                >
                  <TabLabel icon={<CircleDot className="h-4 w-4 shrink-0" />} count={statuses.length}>
                    Estado
                  </TabLabel>
                </TabsTrigger>
                <TabsTrigger
                  value="types"
                  className="min-h-10 min-w-0 gap-1.5 px-2 text-xs data-[state=active]:bg-primary data-[state=active]:text-white sm:text-sm"
                >
                  <TabLabel icon={<Tags className="h-4 w-4 shrink-0" />} count={types.length}>
                    Tipo
                  </TabLabel>
                </TabsTrigger>
                <TabsTrigger
                  value="areas"
                  className="min-h-10 min-w-0 gap-1.5 px-2 text-xs data-[state=active]:bg-primary data-[state=active]:text-white sm:text-sm"
                >
                  <TabLabel icon={<Code2 className="h-4 w-4 shrink-0" />} count={areas.length}>
                    <span className="sm:hidden">C&oacute;d. &aacute;rea</span>
                    <span className="hidden sm:inline">C&oacute;digo por &aacute;rea</span>
                  </TabLabel>
                </TabsTrigger>
                <TabsTrigger
                  value="platforms"
                  className="min-h-10 min-w-0 gap-1.5 px-2 text-xs data-[state=active]:bg-primary data-[state=active]:text-white sm:text-sm"
                >
                  <TabLabel icon={<Building2 className="h-4 w-4 shrink-0" />} count={platforms.length}>
                    Plataforma
                  </TabLabel>
                </TabsTrigger>
                <TabsTrigger
                  value="supervisors"
                  className="min-h-10 min-w-0 gap-1.5 px-2 text-xs data-[state=active]:bg-primary data-[state=active]:text-white sm:text-sm"
                >
                  <TabLabel icon={<UserCog className="h-4 w-4 shrink-0" />} count={rolesTicket.supervisor.length}>
                    Supervisor
                  </TabLabel>
                </TabsTrigger>
                <TabsTrigger
                  value="analysts"
                  className="min-h-10 min-w-0 gap-1.5 px-2 text-xs data-[state=active]:bg-primary data-[state=active]:text-white sm:text-sm"
                >
                  <TabLabel icon={<Search className="h-4 w-4 shrink-0" />} count={rolesTicket.analista.length}>
                    Analista
                  </TabLabel>
                </TabsTrigger>
                <TabsTrigger
                  value="coordinators"
                  className="min-h-10 min-w-0 gap-1.5 px-2 text-xs data-[state=active]:bg-primary data-[state=active]:text-white sm:text-sm"
                >
                  <TabLabel icon={<Users className="h-4 w-4 shrink-0" />} count={rolesTicket.coordinador.length}>
                    Coordinador
                  </TabLabel>
                </TabsTrigger>
                <TabsTrigger
                  value="managers"
                  className="min-h-10 min-w-0 gap-1.5 px-2 text-xs data-[state=active]:bg-primary data-[state=active]:text-white sm:text-sm"
                >
                  <TabLabel icon={<UserCheck className="h-4 w-4 shrink-0" />} count={managers.length}>
                    Gestiona
                  </TabLabel>
                </TabsTrigger>
                <TabsTrigger
                  value="priorities"
                  className="min-h-10 min-w-0 gap-1.5 px-2 text-xs data-[state=active]:bg-primary data-[state=active]:text-white sm:text-sm"
                >
                  <TabLabel icon={<Gauge className="h-4 w-4 shrink-0" />} count={priorities.length}>
                    Prioridad
                  </TabLabel>
                </TabsTrigger>
                <TabsTrigger
                  value="impacts"
                  className="min-h-10 min-w-0 gap-1.5 px-2 text-xs data-[state=active]:bg-primary data-[state=active]:text-white sm:text-sm"
                >
                  <TabLabel icon={<AlertTriangle className="h-4 w-4 shrink-0" />} count={impacts.length}>
                    Impacto
                  </TabLabel>
                </TabsTrigger>
                <TabsTrigger
                  value="channels"
                  className="min-h-10 min-w-0 gap-1.5 px-2 text-xs data-[state=active]:bg-primary data-[state=active]:text-white sm:text-sm"
                >
                  <TabLabel icon={<Radio className="h-4 w-4 shrink-0" />} count={channels.length}>
                    Canal
                  </TabLabel>
                </TabsTrigger>
                <TabsTrigger
                  value="managementCriteria"
                  className="min-h-10 min-w-0 gap-1.5 px-2 text-xs data-[state=active]:bg-primary data-[state=active]:text-white sm:text-sm"
                >
                  <TabLabel icon={<ClipboardCheck className="h-4 w-4 shrink-0" />} count={managementCriteria.length}>
                    <span className="sm:hidden">Criterio</span>
                    <span className="hidden sm:inline">Criterio de gesti&oacute;n</span>
                  </TabLabel>
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="statuses" className="mt-0 min-h-0 flex-1 overflow-hidden">
              {listsQuery.isError ? (
                <QueryErrorState onRetry={() => void listsQuery.refetch()} />
              ) : (
                <ListConfigSection
                  listType="statuses"
                  singular="Estado"
                  items={statuses}
                  isLoading={listsQuery.isLoading}
                />
              )}
            </TabsContent>
            <TabsContent value="types" className="mt-0 min-h-0 flex-1 overflow-hidden">
              {listsQuery.isError ? (
                <QueryErrorState onRetry={() => void listsQuery.refetch()} />
              ) : (
                <ListConfigSection
                  listType="types"
                  singular="Tipo"
                  items={types}
                  isLoading={listsQuery.isLoading}
                />
              )}
            </TabsContent>
            <TabsContent value="areas" className="mt-0 min-h-0 flex-1 overflow-hidden">
              {areasQuery.isError ? (
                <QueryErrorState onRetry={() => void areasQuery.refetch()} />
              ) : (
                <AreaPrefixSection items={areas} isLoading={areasQuery.isLoading} />
              )}
            </TabsContent>
            <TabsContent value="platforms" className="mt-0 min-h-0 flex-1 overflow-hidden">
              {listsQuery.isError ? (
                <QueryErrorState onRetry={() => void listsQuery.refetch()} />
              ) : (
                <ListConfigSection
                  listType="platforms"
                  singular="Plataforma"
                  items={platforms}
                  isLoading={listsQuery.isLoading}
                />
              )}
            </TabsContent>
            <TabsContent value="supervisors" className="mt-0 min-h-0 flex-1 overflow-hidden">
              <RolTicketSection
                rol="supervisor"
                singular="Supervisor"
                curados={rolesTicket.supervisor}
                onChange={(next) => setRolesTicket((r) => ({ ...r, supervisor: next }))}
              />
            </TabsContent>
            <TabsContent value="analysts" className="mt-0 min-h-0 flex-1 overflow-hidden">
              <RolTicketSection
                rol="analista"
                singular="Analista"
                curados={rolesTicket.analista}
                onChange={(next) => setRolesTicket((r) => ({ ...r, analista: next }))}
              />
            </TabsContent>
            <TabsContent value="coordinators" className="mt-0 min-h-0 flex-1 overflow-hidden">
              <RolTicketSection
                rol="coordinador"
                singular="Coordinador"
                curados={rolesTicket.coordinador}
                onChange={(next) => setRolesTicket((r) => ({ ...r, coordinador: next }))}
              />
            </TabsContent>
            <TabsContent value="managers" className="mt-0 min-h-0 flex-1 overflow-hidden">
              {listsQuery.isError ? (
                <QueryErrorState onRetry={() => void listsQuery.refetch()} />
              ) : (
                <ListConfigSection
                  listType="managers"
                  singular="Gestor"
                  items={managers}
                  isLoading={listsQuery.isLoading}
                />
              )}
            </TabsContent>
            <TabsContent value="priorities" className="mt-0 min-h-0 flex-1 overflow-hidden">
              {listsQuery.isError ? (
                <QueryErrorState onRetry={() => void listsQuery.refetch()} />
              ) : (
                <ListConfigSection
                  listType="priorities"
                  singular="Prioridad"
                  items={priorities}
                  isLoading={listsQuery.isLoading}
                  showSlaHours
                />
              )}
            </TabsContent>
            <TabsContent value="impacts" className="mt-0 min-h-0 flex-1 overflow-hidden">
              {listsQuery.isError ? (
                <QueryErrorState onRetry={() => void listsQuery.refetch()} />
              ) : (
                <ListConfigSection
                  listType="impacts"
                  singular="Impacto"
                  items={impacts}
                  isLoading={listsQuery.isLoading}
                />
              )}
            </TabsContent>
            <TabsContent value="channels" className="mt-0 min-h-0 flex-1 overflow-hidden">
              {listsQuery.isError ? (
                <QueryErrorState onRetry={() => void listsQuery.refetch()} />
              ) : (
                <ListConfigSection
                  listType="channels"
                  singular="Canal"
                  items={channels}
                  isLoading={listsQuery.isLoading}
                />
              )}
            </TabsContent>
            <TabsContent value="managementCriteria" className="mt-0 min-h-0 flex-1 overflow-hidden">
              {listsQuery.isError ? (
                <QueryErrorState onRetry={() => void listsQuery.refetch()} />
              ) : (
                <ListConfigSection
                  listType="managementCriteria"
                  singular="Criterio de gestión"
                  items={managementCriteria}
                  isLoading={listsQuery.isLoading}
                />
              )}
            </TabsContent>
          </Tabs>
        </TooltipProvider>
      </DialogContent>
    </Dialog>
  )
}
