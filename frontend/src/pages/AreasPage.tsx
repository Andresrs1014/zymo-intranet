import { useState, type ReactNode } from "react"
import { PageLayout } from "@/components/layout/PageLayout"
import {
  useAreas,
  useCreateArea,
  useUpdateArea,
  useDeleteArea,
  type AreaItem,
} from "@/hooks/useAreas"
import {
  useSedes,
  useCreateSede,
  useUpdateSede,
  useDeleteSede,
  type SedeItem,
} from "@/hooks/useSedes"
import { getApiError } from "@/hooks/useRoles"

export function AreasPage() {
  return (
    <PageLayout title="Áreas y Sedes" mainClassName="flex-1 overflow-auto p-6">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Áreas y Sedes</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Administra los catálogos de áreas y sedes de la organización.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <AreasPanel />
            <SedesPanel />
          </div>
    </PageLayout>
  )
}

// ── Areas Panel ───────────────────────────────────────────────────────────────

function AreasPanel() {
  const { data: areas = [], isLoading } = useAreas()
  const createArea = useCreateArea()
  const updateArea = useUpdateArea()
  const deleteArea = useDeleteArea()

  const [editTarget, setEditTarget] = useState<AreaItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AreaItem | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [error, setError] = useState<string>()

  async function handleCreate(name: string) {
    setError(undefined)
    try {
      await createArea.mutateAsync(name)
      setShowCreate(false)
    } catch (err) {
      setError(getApiError(err))
    }
  }

  async function handleUpdate(id: number, name: string) {
    setError(undefined)
    try {
      await updateArea.mutateAsync({ id, name })
      setEditTarget(null)
    } catch (err) {
      setError(getApiError(err))
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setError(undefined)
    try {
      await deleteArea.mutateAsync(deleteTarget.id)
      setDeleteTarget(null)
    } catch (err) {
      setError(getApiError(err))
      setDeleteTarget(null)
    }
  }

  return (
    <CatalogPanel
      title="Áreas"
      items={areas}
      isLoading={isLoading}
      error={error}
      isPending={createArea.isPending || updateArea.isPending || deleteArea.isPending}
      showCreate={showCreate}
      onOpenCreate={() => { setShowCreate(true); setError(undefined) }}
      onCancelCreate={() => setShowCreate(false)}
      onCreate={handleCreate}
      editTarget={editTarget}
      onEdit={(item) => { setEditTarget(item); setError(undefined) }}
      onCancelEdit={() => setEditTarget(null)}
      onUpdate={handleUpdate}
      deleteTarget={deleteTarget}
      onDeleteRequest={(item) => setDeleteTarget(item)}
      onCancelDelete={() => setDeleteTarget(null)}
      onDelete={handleDelete}
      entityLabel="área"
    />
  )
}

// ── Sedes Panel ───────────────────────────────────────────────────────────────

function SedesPanel() {
  const { data: sedes = [], isLoading } = useSedes()
  const createSede = useCreateSede()
  const updateSede = useUpdateSede()
  const deleteSede = useDeleteSede()

  const [editTarget, setEditTarget] = useState<SedeItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SedeItem | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [error, setError] = useState<string>()

  async function handleCreate(name: string) {
    setError(undefined)
    try {
      await createSede.mutateAsync({ name })
      setShowCreate(false)
    } catch (err) {
      setError(getApiError(err))
    }
  }

  async function handleUpdate(id: number, name: string) {
    setError(undefined)
    try {
      await updateSede.mutateAsync({ id, name })
      setEditTarget(null)
    } catch (err) {
      setError(getApiError(err))
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setError(undefined)
    try {
      await deleteSede.mutateAsync(deleteTarget.id)
      setDeleteTarget(null)
    } catch (err) {
      setError(getApiError(err))
      setDeleteTarget(null)
    }
  }

  return (
    <div>
      <p className="text-xs text-gray-500 mb-2 max-w-md">
        Solo las sedes con «OC compras» aparecen como plataforma al crear solicitudes. Ej.: Transversal puede existir como sede de usuario pero no formaliza compras.
      </p>
      <CatalogPanel
        title="Sedes"
        items={sedes}
        isLoading={isLoading}
        error={error}
        isPending={createSede.isPending || updateSede.isPending || deleteSede.isPending}
        showCreate={showCreate}
        onOpenCreate={() => { setShowCreate(true); setError(undefined) }}
        onCancelCreate={() => setShowCreate(false)}
        onCreate={handleCreate}
        editTarget={editTarget}
        onEdit={(item) => { setEditTarget(item as SedeItem); setError(undefined) }}
        onCancelEdit={() => setEditTarget(null)}
        onUpdate={handleUpdate}
        deleteTarget={deleteTarget}
        onDeleteRequest={(item) => setDeleteTarget(item as SedeItem)}
        onCancelDelete={() => setDeleteTarget(null)}
        onDelete={handleDelete}
        entityLabel="sede"
        renderAfterName={(item) => {
          if (item.visible_en_solicitudes_oc === undefined) return null
          return (
            <label className="flex items-center gap-1.5 shrink-0 text-xs text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                className="rounded border-gray-300"
                checked={item.visible_en_solicitudes_oc}
                onChange={async (e) => {
                  setError(undefined)
                  try {
                    await updateSede.mutateAsync({
                      id: item.id,
                      visible_en_solicitudes_oc: e.target.checked,
                    })
                  } catch (err) {
                    setError(getApiError(err))
                  }
                }}
              />
              OC compras
            </label>
          )
        }}
      />
    </div>
  )
}

// ── CatalogPanel (shared UI) ──────────────────────────────────────────────────

interface CatalogItem {
  id: number
  name: string
  visible_en_solicitudes_oc?: boolean
}

interface CatalogPanelProps {
  title: string
  items: CatalogItem[]
  isLoading: boolean
  error: string | undefined
  isPending: boolean
  showCreate: boolean
  onOpenCreate: () => void
  onCancelCreate: () => void
  onCreate: (name: string) => void
  editTarget: CatalogItem | null
  onEdit: (item: CatalogItem) => void
  onCancelEdit: () => void
  onUpdate: (id: number, name: string) => void
  deleteTarget: CatalogItem | null
  onDeleteRequest: (item: CatalogItem) => void
  onCancelDelete: () => void
  onDelete: () => void
  entityLabel: string
  /** Solo para sedes: control de visibilidad en solicitudes OC */
  renderAfterName?: (item: CatalogItem) => ReactNode
}

function CatalogPanel({
  title, items, isLoading, error, isPending,
  showCreate, onOpenCreate, onCancelCreate, onCreate,
  editTarget, onEdit, onCancelEdit, onUpdate,
  deleteTarget, onDeleteRequest, onCancelDelete, onDelete,
  entityLabel,
  renderAfterName,
}: CatalogPanelProps) {
  const [newName, setNewName] = useState("")
  const [editName, setEditName] = useState("")

  function submitCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    onCreate(newName.trim())
    setNewName("")
  }

  function openEdit(item: CatalogItem) {
    setEditName(item.name)
    onEdit(item)
  }

  function submitEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editTarget || !editName.trim()) return
    onUpdate(editTarget.id, editName.trim())
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
        <button
          onClick={onOpenCreate}
          className="rounded-lg bg-brand-blue px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-blue/90 transition-colors"
        >
          + Nuevo
        </button>
      </div>

      {error && (
        <p className="mx-4 mt-3 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      {showCreate && (
        <form onSubmit={submitCreate} className="flex gap-2 px-4 py-3 border-b border-gray-50">
          <input
            type="text"
            autoFocus
            required
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={`Nombre del ${entityLabel}`}
            className={inputCls}
          />
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-brand-blue px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-blue/90 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {isPending ? "..." : "Agregar"}
          </button>
          <button
            type="button"
            onClick={onCancelCreate}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            ✕
          </button>
        </form>
      )}

      {isLoading ? (
        <p className="px-4 py-6 text-xs text-gray-400">Cargando...</p>
      ) : items.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-gray-400">
          No hay {title.toLowerCase()} registradas.
        </p>
      ) : (
        <ul className="divide-y divide-gray-50">
          {items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5 hover:bg-gray-50 transition-colors">
              {editTarget?.id === item.id ? (
                <form onSubmit={submitEdit} className="flex flex-1 gap-2">
                  <input
                    type="text"
                    autoFocus
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className={inputCls}
                  />
                  <button
                    type="submit"
                    disabled={isPending}
                    className="rounded px-2 py-1 text-xs font-medium text-brand-blue hover:bg-brand-blue/10 disabled:opacity-50 transition-colors"
                  >
                    {isPending ? "..." : "Guardar"}
                  </button>
                  <button
                    type="button"
                    onClick={onCancelEdit}
                    className="rounded px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 transition-colors"
                  >
                    ✕
                  </button>
                </form>
              ) : deleteTarget?.id === item.id ? (
                <div className="flex flex-1 items-center gap-2">
                  <span className="flex-1 text-sm text-gray-700">{item.name}</span>
                  <span className="text-xs text-red-500">¿Eliminar?</span>
                  <button
                    onClick={onDelete}
                    disabled={isPending}
                    className="rounded px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50 disabled:opacity-50 transition-colors"
                  >
                    {isPending ? "..." : "Sí"}
                  </button>
                  <button
                    onClick={onCancelDelete}
                    className="rounded px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 transition-colors"
                  >
                    No
                  </button>
                </div>
              ) : (
                <>
                  <span className="flex-1 text-sm text-gray-800 min-w-0">{item.name}</span>
                  {renderAfterName?.(item)}
                  <button
                    onClick={() => openEdit(item)}
                    className="rounded px-2 py-1 text-xs font-medium text-brand-blue hover:bg-brand-blue/10 transition-colors"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => onDeleteRequest(item)}
                    className="rounded px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50 transition-colors"
                  >
                    Eliminar
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const inputCls =
  "flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-900 focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue transition-colors"
