import { useState } from "react"
import type { ComponentProps, FormEvent, ReactNode, RefObject } from "react"
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Building2,
  Check,
  CircleDot,
  Code2,
  Pencil,
  Plus,
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
import { extractErrorMessage } from "@/lib/ticketErrors"
import type { TicketAreaPrefix, TicketListItem } from "@/types/ticket"
import { useTicketToast } from "./TicketToast"

interface TicketConfigDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  returnFocusRef: RefObject<HTMLButtonElement | null>
}

type EditableListType =
  | "statuses" | "types" | "platforms" | "supervisors" | "analysts" | "coordinators" | "managers"
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

interface ListRowProps {
  item: TicketListItem
  index: number
  length: number
  editing: boolean
  draft: string
  confirming: boolean
  pending: boolean
  onDraftChange: (value: string) => void
  onEdit: () => void
  onSave: () => void
  onCancelEdit: () => void
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

interface ListConfigSectionProps {
  listType: EditableListType
  singular: string
  items: TicketListItem[]
  isLoading: boolean
}

function ListConfigSection({ listType, singular, items, isLoading }: ListConfigSectionProps) {
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
                onDraftChange={setDraft}
                onEdit={() => {
                  setEditingId(item.id)
                  setDraft(item.label)
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
  const supervisors = listsQuery.data?.supervisors ?? []
  const analysts = listsQuery.data?.analysts ?? []
  const coordinators = listsQuery.data?.coordinators ?? []
  const managers = listsQuery.data?.managers ?? []
  const areas = areasQuery.data ?? []

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
              <TabsList className="grid h-auto w-full grid-cols-2 gap-1 bg-zinc-100 p-1 sm:grid-cols-4">
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
                  <TabLabel icon={<UserCog className="h-4 w-4 shrink-0" />} count={supervisors.length}>
                    Supervisor
                  </TabLabel>
                </TabsTrigger>
                <TabsTrigger
                  value="analysts"
                  className="min-h-10 min-w-0 gap-1.5 px-2 text-xs data-[state=active]:bg-primary data-[state=active]:text-white sm:text-sm"
                >
                  <TabLabel icon={<Search className="h-4 w-4 shrink-0" />} count={analysts.length}>
                    Analista
                  </TabLabel>
                </TabsTrigger>
                <TabsTrigger
                  value="coordinators"
                  className="min-h-10 min-w-0 gap-1.5 px-2 text-xs data-[state=active]:bg-primary data-[state=active]:text-white sm:text-sm"
                >
                  <TabLabel icon={<Users className="h-4 w-4 shrink-0" />} count={coordinators.length}>
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
              {listsQuery.isError ? (
                <QueryErrorState onRetry={() => void listsQuery.refetch()} />
              ) : (
                <ListConfigSection
                  listType="supervisors"
                  singular="Supervisor"
                  items={supervisors}
                  isLoading={listsQuery.isLoading}
                />
              )}
            </TabsContent>
            <TabsContent value="analysts" className="mt-0 min-h-0 flex-1 overflow-hidden">
              {listsQuery.isError ? (
                <QueryErrorState onRetry={() => void listsQuery.refetch()} />
              ) : (
                <ListConfigSection
                  listType="analysts"
                  singular="Analista"
                  items={analysts}
                  isLoading={listsQuery.isLoading}
                />
              )}
            </TabsContent>
            <TabsContent value="coordinators" className="mt-0 min-h-0 flex-1 overflow-hidden">
              {listsQuery.isError ? (
                <QueryErrorState onRetry={() => void listsQuery.refetch()} />
              ) : (
                <ListConfigSection
                  listType="coordinators"
                  singular="Coordinador"
                  items={coordinators}
                  isLoading={listsQuery.isLoading}
                />
              )}
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
          </Tabs>
        </TooltipProvider>
      </DialogContent>
    </Dialog>
  )
}
