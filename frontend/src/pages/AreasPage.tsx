import { useState, useEffect, useCallback, type ReactNode } from "react"
import { PageLayout } from "@/components/layout/PageLayout"
import { api } from "@/lib/api"
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
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function AreasPage() {
  return (
    <PageLayout title="Áreas y Sedes" mainClassName="flex-1 overflow-auto p-6">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-foreground">Áreas y Sedes</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Administra los catálogos de áreas y sedes de la organización.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <AreasPanel />
            <SedesPanel />
          </div>
          <CargosPanel />
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
      <p className="text-xs text-muted-foreground mb-2 max-w-md">
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
            <label className="flex items-center gap-1.5 shrink-0 text-xs text-foreground cursor-pointer">
              <input
                type="checkbox"
                className="rounded border-border"
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

// ── Cargos Panel (T&C) ────────────────────────────────────────────────────────

interface TcEmpresa { id: number; nombre: string; codigo: string }
interface TcArea    { id: number; name: string }   // Area global (campo 'name', no 'nombre')
interface TcCargo   { id: number; empresa_id: number; area_id: number | null; nombre: string }

function CargosPanel() {
  const [empresas, setEmpresas]     = useState<TcEmpresa[]>([])
  const [empresaId, setEmpresaId]   = useState<number | null>(null)
  const [areas, setAreas]           = useState<TcArea[]>([])
  const [cargos, setCargos]         = useState<TcCargo[]>([])
  const [loading, setLoading]       = useState(false)
  const [pending, setPending]       = useState(false)
  const [error, setError]           = useState<string>()

  const [showCreate, setShowCreate] = useState(false)
  const [newNombre, setNewNombre]   = useState("")
  const [newAreaId, setNewAreaId]   = useState<number | "">("")

  const [editId, setEditId]         = useState<number | null>(null)
  const [editNombre, setEditNombre] = useState("")
  const [editAreaId, setEditAreaId] = useState<number | "">("")

  const [deleteId, setDeleteId]     = useState<number | null>(null)

  useEffect(() => {
    api.get("/tc/empresas").then((r) => {
      const lista: TcEmpresa[] = Array.isArray(r.data) ? r.data : []
      setEmpresas(lista)
      if (lista.length > 0) setEmpresaId(lista[0].id)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    api.get("/areas")
      .then((r) => setAreas(Array.isArray(r.data) ? r.data : []))
      .catch(() => setAreas([]))
  }, [])

  const cargarCargos = useCallback(() => {
    if (!empresaId) { setCargos([]); return }
    setLoading(true)
    api.get("/tc/cargos", { params: { empresa_id: empresaId } })
      .then((r) => setCargos(Array.isArray(r.data) ? r.data : []))
      .catch(() => setCargos([]))
      .finally(() => setLoading(false))
  }, [empresaId])

  useEffect(() => { cargarCargos() }, [cargarCargos])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newNombre.trim() || !empresaId) return
    setError(undefined)
    setPending(true)
    try {
      await api.post("/tc/cargos", { empresa_id: empresaId, area_id: newAreaId || null, nombre: newNombre.trim() })
      setNewNombre(""); setNewAreaId(""); setShowCreate(false)
      cargarCargos()
    } catch { setError("No se pudo crear el cargo.") }
    finally { setPending(false) }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!editId || !editNombre.trim()) return
    setError(undefined)
    setPending(true)
    try {
      await api.put(`/tc/cargos/${editId}`, { nombre: editNombre.trim(), area_id: editAreaId || null })
      setEditId(null)
      cargarCargos()
    } catch { setError("No se pudo actualizar el cargo.") }
    finally { setPending(false) }
  }

  async function handleDelete() {
    if (!deleteId) return
    setError(undefined)
    setPending(true)
    try {
      await api.delete(`/tc/cargos/${deleteId}`)
      setDeleteId(null)
      cargarCargos()
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
      setError(typeof detail === "string" ? detail : "No se pudo eliminar el cargo.")
      setDeleteId(null)
    }
    finally { setPending(false) }
  }

  function openEdit(c: TcCargo) {
    setEditId(c.id)
    setEditNombre(c.nombre)
    setEditAreaId(c.area_id ?? "")
    setError(undefined)
  }

  const areaMap = new Map(areas.map((a) => [a.id, a.name]))

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden mt-6">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div>
          <h3 className="font-semibold text-foreground text-sm">Cargos</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Posiciones laborales por empresa del grupo ZYMO (módulo T&amp;C).
          </p>
        </div>
        <Button
          onClick={() => { setShowCreate(true); setEditId(null); setError(undefined) }}
          variant="default" size="sm" className="text-xs px-3 py-1.5 h-auto"
        >
          + Nuevo
        </Button>
      </div>

      {/* Empresa tabs */}
      {empresas.length > 0 && (
        <div className="flex gap-1 px-4 pt-3 pb-2 border-b border-border">
          {empresas.map((e) => (
            <button
              key={e.id}
              onClick={() => { setEmpresaId(e.id); setShowCreate(false); setEditId(null); setDeleteId(null) }}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                empresaId === e.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent"
              }`}
            >
              {e.codigo}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p className="mx-4 mt-3 text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>
      )}

      {/* Create form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="flex flex-wrap gap-2 px-4 py-3 border-b border-border">
          <Input
            type="text" autoFocus required
            value={newNombre} onChange={(e) => setNewNombre(e.target.value)}
            placeholder="Nombre del cargo"
            className="flex-1 h-8 text-sm min-w-[180px]"
          />
          <select
            value={newAreaId}
            onChange={(e) => setNewAreaId(e.target.value ? Number(e.target.value) : "")}
            className="h-8 text-sm bg-background border border-input rounded-md px-2 min-w-[150px]"
          >
            <option value="">Sin área</option>
            {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <Button type="submit" variant="default" size="sm" disabled={pending}
            className="text-xs px-3 py-1.5 h-auto whitespace-nowrap">
            {pending ? "..." : "Agregar"}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setShowCreate(false)}
            className="text-xs px-3 py-1.5 h-auto">
            ✕
          </Button>
        </form>
      )}

      {/* List */}
      {loading ? (
        <p className="px-4 py-6 text-xs text-muted-foreground">Cargando...</p>
      ) : cargos.length === 0 ? (
        <p className="px-4 py-8 text-center text-xs text-muted-foreground">
          No hay cargos registrados para esta empresa.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {cargos.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5 hover:bg-muted transition-colors">
              {editId === c.id ? (
                <form onSubmit={handleUpdate} className="flex flex-1 flex-wrap gap-2">
                  <Input
                    type="text" autoFocus required
                    value={editNombre} onChange={(e) => setEditNombre(e.target.value)}
                    className="flex-1 h-8 text-sm min-w-[180px]"
                  />
                  <select
                    value={editAreaId}
                    onChange={(e) => setEditAreaId(e.target.value ? Number(e.target.value) : "")}
                    className="h-8 text-sm bg-background border border-input rounded-md px-2 min-w-[150px]"
                  >
                    <option value="">Sin área</option>
                    {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                  <Button type="submit" variant="ghost" size="sm" disabled={pending}
                    className="text-xs px-2 py-1 h-auto text-primary hover:bg-primary/10">
                    {pending ? "..." : "Guardar"}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setEditId(null)}
                    className="text-xs px-2 py-1 h-auto">✕</Button>
                </form>
              ) : deleteId === c.id ? (
                <div className="flex flex-1 items-center gap-2">
                  <span className="flex-1 text-sm text-foreground">{c.nombre}</span>
                  <span className="text-xs text-red-500">¿Eliminar?</span>
                  <Button onClick={handleDelete} disabled={pending} variant="ghost" size="sm"
                    className="text-xs px-2 py-1 h-auto text-red-500 hover:bg-red-50">
                    {pending ? "..." : "Sí"}
                  </Button>
                  <Button onClick={() => setDeleteId(null)} variant="ghost" size="sm"
                    className="text-xs px-2 py-1 h-auto">No</Button>
                </div>
              ) : (
                <>
                  <span className="flex-1 text-sm text-foreground min-w-0">{c.nombre}</span>
                  {c.area_id && (
                    <span className="text-[11px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full shrink-0">
                      {areaMap.get(c.area_id) ?? "—"}
                    </span>
                  )}
                  <Button onClick={() => openEdit(c)} variant="ghost" size="sm"
                    className="text-xs px-2 py-1 h-auto text-primary hover:bg-primary/10">
                    Editar
                  </Button>
                  <Button onClick={() => { setDeleteId(c.id); setError(undefined) }} variant="ghost" size="sm"
                    className="text-xs px-2 py-1 h-auto text-red-500 hover:bg-red-50">
                    Eliminar
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
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
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="font-semibold text-foreground text-sm">{title}</h3>
        <Button
          onClick={onOpenCreate}
          variant="default"
          size="sm"
          className="text-xs px-3 py-1.5 h-auto"
        >
          + Nuevo
        </Button>
      </div>

      {error && (
        <p className="mx-4 mt-3 text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>
      )}

      {showCreate && (
        <form onSubmit={submitCreate} className="flex gap-2 px-4 py-3 border-b border-border">
          <Input
            type="text"
            autoFocus
            required
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={`Nombre del ${entityLabel}`}
            className="flex-1 h-8 text-sm"
          />
          <Button
            type="submit"
            variant="default"
            size="sm"
            disabled={isPending}
            className="text-xs px-3 py-1.5 h-auto whitespace-nowrap"
          >
            {isPending ? "..." : "Agregar"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancelCreate}
            className="text-xs px-3 py-1.5 h-auto"
          >
            ✕
          </Button>
        </form>
      )}

      {isLoading ? (
        <p className="px-4 py-6 text-xs text-muted-foreground">Cargando...</p>
      ) : items.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-muted-foreground">
          No hay {title.toLowerCase()} registradas.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5 hover:bg-muted transition-colors">
              {editTarget?.id === item.id ? (
                <form onSubmit={submitEdit} className="flex flex-1 gap-2">
                  <Input
                    type="text"
                    autoFocus
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 h-8 text-sm"
                  />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    disabled={isPending}
                    className="text-xs px-2 py-1 h-auto text-primary hover:bg-primary/10"
                  >
                    {isPending ? "..." : "Guardar"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onCancelEdit}
                    className="text-xs px-2 py-1 h-auto"
                  >
                    ✕
                  </Button>
                </form>
              ) : deleteTarget?.id === item.id ? (
                <div className="flex flex-1 items-center gap-2">
                  <span className="flex-1 text-sm text-foreground">{item.name}</span>
                  <span className="text-xs text-red-500">¿Eliminar?</span>
                  <Button
                    onClick={onDelete}
                    disabled={isPending}
                    variant="ghost"
                    size="sm"
                    className="text-xs px-2 py-1 h-auto text-red-500 hover:bg-red-50"
                  >
                    {isPending ? "..." : "Sí"}
                  </Button>
                  <Button
                    onClick={onCancelDelete}
                    variant="ghost"
                    size="sm"
                    className="text-xs px-2 py-1 h-auto"
                  >
                    No
                  </Button>
                </div>
              ) : (
                <>
                  <span className="flex-1 text-sm text-foreground min-w-0">{item.name}</span>
                  {renderAfterName?.(item)}
                  <Button
                    onClick={() => openEdit(item)}
                    variant="ghost"
                    size="sm"
                    className="text-xs px-2 py-1 h-auto text-primary hover:bg-primary/10"
                  >
                    Editar
                  </Button>
                  <Button
                    onClick={() => onDeleteRequest(item)}
                    variant="ghost"
                    size="sm"
                    className="text-xs px-2 py-1 h-auto text-red-500 hover:bg-red-50"
                  >
                    Eliminar
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
