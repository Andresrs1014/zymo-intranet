import { useState } from "react"
import { PageLayout } from "@/components/layout/PageLayout"
import { AdminConfigNav } from "@/components/admin/AdminConfigNav"
import { INTERNAL_MODULES, EXTERNAL_APPS, INTERNAL_MODULE_GROUPS, type AppDefinition } from "@/lib/roles"
import {
  useRoles,
  useCreateRole,
  useUpdateRole,
  useDeleteRole,
  getApiError,
  type RoleItem,
  type CreateRolePayload,
  type UpdateRolePayload,
} from "@/hooks/useRoles"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"

// ── Página principal ──────────────────────────────────────────────────────────

export function RolesPage() {
  const { data: roles = [], isLoading } = useRoles()
  const createRole   = useCreateRole()
  const updateRole   = useUpdateRole()
  const deleteRole   = useDeleteRole()

  const [modal, setModal]               = useState<"create" | "edit" | null>(null)
  const [selected, setSelected]         = useState<RoleItem | null>(null)
  const [mutationError, setMutationError] = useState<string>()
  const [deleteInfo, setDeleteInfo] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<RoleItem | null>(null)

  function openCreate() {
    setSelected(null)
    setMutationError(undefined)
    setDeleteInfo(null)
    setModal("create")
  }

  function openEdit(role: RoleItem) {
    setSelected(role)
    setMutationError(undefined)
    setDeleteInfo(null)
    setModal("edit")
  }

  function closeModal() {
    setModal(null)
    setSelected(null)
    setMutationError(undefined)
  }

  async function handleSubmit(data: CreateRolePayload | UpdateRolePayload) {
    setMutationError(undefined)
    try {
      if (modal === "create") {
        await createRole.mutateAsync(data as CreateRolePayload)
      } else if (modal === "edit" && selected) {
        await updateRole.mutateAsync({ id: selected.id, ...(data as UpdateRolePayload) })
      }
      closeModal()
    } catch (err) {
      setMutationError(getApiError(err))
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleteInfo(null)
    try {
      const result = await deleteRole.mutateAsync(deleteTarget.id)
      setDeleteInfo(
        `Rol eliminado. ${result.reassigned_users} usuario(s) quedaron con rol «empleado». Asígnales un rol en Gestión de usuarios.`,
      )
      setDeleteTarget(null)
    } catch (err) {
      setDeleteTarget(null)
      setMutationError(getApiError(err))
    }
  }

  return (
    <>
      <PageLayout title="Roles" mainClassName="flex-1 overflow-auto p-6">
          <AdminConfigNav />

          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-foreground">Gestión de Roles</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Define qué módulos ve cada rol. Tras cambiar permisos, el usuario debe volver a iniciar sesión.
              </p>
            </div>
            <Button
              onClick={openCreate}
              variant="default"
            >
              + Nuevo rol
            </Button>
          </div>

          {mutationError && !modal && (
            <p className="mb-4 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
              {mutationError}
            </p>
          )}
          {deleteInfo && (
            <p className="mb-4 text-sm text-green-800 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
              {deleteInfo}
            </p>
          )}

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando roles...</p>
          ) : (
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider w-32">
                      Nombre
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider w-40">
                      Etiqueta
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Descripción
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Accesos configurados
                    </th>
                    <th className="px-4 py-3 w-24" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {roles.map((role) => (
                    <tr key={role.id} className="hover:bg-muted transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {role.name}
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">
                        {role.label}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {role.description ?? <span className="text-muted-foreground/50">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <PermissionBadges role={role} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button
                            onClick={() => openEdit(role)}
                            variant="ghost"
                            size="sm"
                            className="text-xs px-2.5 py-1 h-auto text-primary hover:bg-primary/10"
                          >
                            Editar
                          </Button>
                          {role.name !== "admin" && (
                            <Button
                              onClick={() => setDeleteTarget(role)}
                              variant="ghost"
                              size="sm"
                              className="text-xs px-2.5 py-1 h-auto text-red-500 hover:bg-red-50"
                            >
                              Eliminar
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {roles.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                        No hay roles registrados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
      </PageLayout>

      {modal && (
        <RoleFormModal
          role={modal === "edit" ? selected ?? undefined : undefined}
          onSubmit={handleSubmit}
          onClose={closeModal}
          isLoading={createRole.isPending || updateRole.isPending}
          error={mutationError}
        />
      )}

      {deleteTarget && (
        <ConfirmDeleteModal
          role={deleteTarget}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          isLoading={deleteRole.isPending}
        />
      )}
    </>
  )
}

// ── Badges de permisos en la tabla ────────────────────────────────────────────

function PermissionBadges({ role }: { role: RoleItem }) {
  if (role.name === "admin") {
    return <span className="text-xs text-muted-foreground italic">Acceso total</span>
  }

  const perms = role.app_permissions ?? []
  if (perms.length === 0) {
    return <span className="text-xs text-muted-foreground/50">Sin accesos adicionales</span>
  }

  const allDefs: AppDefinition[] = [...INTERNAL_MODULES, ...EXTERNAL_APPS]

  return (
    <div className="flex flex-wrap gap-1">
      {perms.map((id) => {
        const def = allDefs.find((a) => a.id === id)
        const isModule = def?.category === "modulo"
        return (
          <span
            key={id}
            className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${
              isModule
                ? "bg-indigo-50 text-indigo-700"
                : "bg-primary/10 text-primary"
            }`}
          >
            {def?.icon} {def?.name ?? id}
          </span>
        )
      })}
    </div>
  )
}

// ── Modal crear / editar rol ──────────────────────────────────────────────────

interface RoleFormModalProps {
  role?: RoleItem
  onSubmit: (data: CreateRolePayload | UpdateRolePayload) => void
  onClose: () => void
  isLoading: boolean
  error?: string
}

function RoleFormModal({ role, onSubmit, onClose, isLoading, error }: RoleFormModalProps) {
  const isEdit = !!role

  const [name, setName]               = useState(role?.name ?? "")
  const [label, setLabel]             = useState(role?.label ?? "")
  const [description, setDescription] = useState(role?.description ?? "")
  const [permissions, setPermissions] = useState<string[]>(role?.app_permissions ?? [])

  function toggle(id: string) {
    setPermissions((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    )
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload = { label, description: description || undefined, app_permissions: permissions }
    onSubmit(isEdit ? payload : { name, ...payload })
  }

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-full max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar rol" : "Nuevo rol"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="px-1 py-2 space-y-5 overflow-y-auto flex-1">

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>
            )}

            {/* Nombre interno — solo en creación */}
            {!isEdit && (
              <div>
                <Label className="block text-xs font-medium mb-1">
                  Nombre interno <span className="text-muted-foreground">(sin espacios)</span>
                </Label>
                <Input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, "_"))}
                  placeholder="Ej. talento_cultura"
                />
              </div>
            )}

            <div>
              <Label className="block text-xs font-medium mb-1">Etiqueta</Label>
              <Input
                type="text"
                required
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Ej. Talento y Cultura"
              />
            </div>

            <div>
              <Label className="block text-xs font-medium mb-1">
                Descripción <span className="text-muted-foreground">(opcional)</span>
              </Label>
              <Input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Breve descripción del rol"
              />
            </div>

            {/* ── Permisos: Módulos internos (por grupo) ── */}
            {INTERNAL_MODULE_GROUPS.map((group) => (
              <PermissionGroup
                key={group.title}
                title={group.title}
                subtitle={group.subtitle}
                items={group.modules}
                selected={permissions}
                onToggle={toggle}
                badgeColor="bg-indigo-50 text-indigo-700"
              />
            ))}

            {/* ── Permisos: Apps externas ── */}
            <PermissionGroup
              title="Aplicaciones externas"
              subtitle="Links que aparecen en el Dashboard del usuario"
              items={EXTERNAL_APPS}
              selected={permissions}
              onToggle={toggle}
              badgeColor="bg-primary/10 text-primary"
            />

          </div>

          <DialogFooter className="pt-2 border-t border-border">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="default"
              disabled={isLoading}
              className="flex-1"
            >
              {isLoading
                ? "Guardando..."
                : isEdit
                  ? "Guardar cambios"
                  : "Crear rol"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Grupo de checkboxes reutilizable ──────────────────────────────────────────

interface PermissionGroupProps {
  title: string
  subtitle: string
  items: AppDefinition[]
  selected: string[]
  onToggle: (id: string) => void
  badgeColor: string
}

function PermissionGroup({ title, subtitle, items, selected, onToggle, badgeColor }: PermissionGroupProps) {
  return (
    <div>
      <p className="text-xs font-semibold text-foreground mb-0.5">{title}</p>
      <p className="text-xs text-muted-foreground mb-2">{subtitle}</p>
      <div className="space-y-2 rounded-lg border border-border bg-muted p-3">
        {items.map((item) => (
          <label key={item.id} className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={selected.includes(item.id)}
              onChange={() => onToggle(item.id)}
              className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary"
            />
            <span className="flex-1">
              <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium mb-0.5 ${badgeColor}`}>
                {item.icon} {item.name}
              </span>
              <span className="block text-xs text-muted-foreground">{item.description}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  )
}

// ── Modal confirmar eliminación ───────────────────────────────────────────────

function ConfirmDeleteModal({
  role,
  onConfirm,
  onCancel,
  isLoading,
}: {
  role: RoleItem
  onConfirm: () => void
  onCancel: () => void
  isLoading: boolean
}) {
  return (
    <Dialog open={true} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="w-full max-w-sm">
        <DialogHeader>
          <DialogTitle>¿Eliminar rol?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Se eliminará el rol <span className="font-medium text-foreground">{role.label}</span>. Los usuarios que lo
          tengan asignado pasarán automáticamente al rol <span className="font-medium text-foreground">empleado</span> y
          podrás asignarles otro rol después en Usuarios.
        </p>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
            Cancelar
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading}
            variant="destructive"
            className="flex-1"
          >
            {isLoading ? "Eliminando..." : "Eliminar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
