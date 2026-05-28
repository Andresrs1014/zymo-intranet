import { useState } from "react"
import type { UserListItem } from "@/types/auth"
import type { CreateUserPayload, UpdateUserPayload } from "@/hooks/useUsers"
import { useRoles } from "@/hooks/useRoles"
import { useAreas } from "@/hooks/useAreas"
import { useSedes } from "@/hooks/useSedes"
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

interface Props {
  user?: UserListItem
  onSubmit: (data: CreateUserPayload | UpdateUserPayload) => void
  onClose: () => void
  isLoading: boolean
  error?: string
}

export function UserFormModal({ user, onSubmit, onClose, isLoading, error }: Props) {
  const isEdit = !!user
  const { data: roles = [] } = useRoles()
  const { data: areas = [] } = useAreas()
  const { data: sedes = [] } = useSedes()
  const [form, setForm] = useState({
    email: user?.email ?? "",
    password: "",
    full_name: user?.full_name ?? "",
    role: user?.role ?? "empleado",
    sede: user?.sede ?? "",
    area: user?.area ?? "",
  })

  const [passwordError, setPasswordError] = useState<string | null>(null)

  function set(field: string, value: string) {
    if (field === "password") setPasswordError(null)
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isEdit) {
      const body: UpdateUserPayload = {
        full_name: form.full_name || undefined,
        role: form.role || undefined,
        sede: form.sede || undefined,
        area: form.area || undefined,
      }
      const pw = form.password.trim()
      if (pw && pw.length < 8) {
        setPasswordError("La contraseña debe tener al menos 8 caracteres.")
        return
      }
      setPasswordError(null)
      if (pw) {
        body.new_password = pw
      }
      onSubmit(body)
    } else {
      onSubmit({
        email: form.email,
        password: form.password,
        full_name: form.full_name,
        role: form.role,
        sede: form.sede || undefined,
        area: form.area || undefined,
      } satisfies CreateUserPayload)
    }
  }

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-full max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar usuario" : "Nuevo usuario"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-1">
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>
          )}
          {passwordError && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{passwordError}</p>
          )}

          {!isEdit && (
            <Field label="Correo electrónico">
              <Input
                type="email"
                required
                autoComplete="off"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </Field>
          )}

          <Field label="Nombre completo">
            <Input
              type="text"
              required
              value={form.full_name}
              onChange={(e) => set("full_name", e.target.value)}
            />
          </Field>

          {!isEdit && (
            <Field label="Contraseña">
              <Input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                placeholder="Mínimo 8 caracteres"
              />
            </Field>
          )}

          {isEdit && (
            <Field label="Nueva contraseña (opcional)">
              <Input
                type="password"
                minLength={8}
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                placeholder="Dejar vacío para no cambiar · mín. 8 caracteres"
              />
            </Field>
          )}

          <Field label="Rol">
            <select
              value={form.role}
              onChange={(e) => set("role", e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {roles.map((r) => (
                <option key={r.id} value={r.name}>
                  {r.label}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Sede">
              <select
                value={form.sede}
                onChange={(e) => set("sede", e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">— Sin sede —</option>
                {sedes.map((s) => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Área">
              <select
                value={form.area}
                onChange={(e) => set("area", e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">— Sin área —</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.name}>{a.name}</option>
                ))}
              </select>
            </Field>
          </div>

          <DialogFooter className="pt-1">
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
                  : "Crear usuario"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <Label className="block text-xs font-medium mb-1">{label}</Label>
      {children}
    </div>
  )
}
