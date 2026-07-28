import { useState } from "react"
import { Plus, KeyRound, Ban, CheckCircle2 } from "lucide-react"
import { PageLayout } from "@/components/layout/PageLayout"
import { AdminConfigNav } from "@/components/admin/AdminConfigNav"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import {
  useLibPartnerUsers, useCreateLibPartnerUser, useSetLibPartnerUserActive, useResetLibPartnerUserPassword,
} from "@/hooks/useLibertadora"
import type { LibPartnerUser } from "@/types/libertadora"

function CreatePartnerUserDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [email, setEmail] = useState("")
  const [nombre, setNombre] = useState("")
  const [password, setPassword] = useState("")
  const createMut = useCreateLibPartnerUser()

  async function handleSubmit() {
    await createMut.mutateAsync({ email, nombre: nombre || undefined, password })
    setEmail(""); setNombre(""); setPassword("")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Nueva cuenta externa</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Correo</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@skandia.com.co" />
          </div>
          <div className="grid gap-1.5">
            <Label>Nombre (opcional)</Label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre de la persona" />
          </div>
          <div className="grid gap-1.5">
            <Label>Contraseña inicial</Label>
            <Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" />
            <p className="text-[11px] text-zinc-400">Compártela con la persona por el canal que prefieran — no hay recuperación por correo todavía.</p>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="button" disabled={!email || password.length < 8 || createMut.isPending} onClick={handleSubmit}>
            Crear cuenta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ResetPasswordDialog({ user, onOpenChange }: { user: LibPartnerUser | null; onOpenChange: (v: boolean) => void }) {
  const [password, setPassword] = useState("")
  const resetMut = useResetLibPartnerUserPassword()

  async function handleSubmit() {
    if (!user) return
    await resetMut.mutateAsync({ id: user.id, password })
    setPassword("")
    onOpenChange(false)
  }

  return (
    <Dialog open={Boolean(user)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Nueva contraseña para {user?.email}</DialogTitle></DialogHeader>
        <div className="grid gap-1.5">
          <Label>Contraseña nueva</Label>
          <Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="button" disabled={password.length < 8 || resetMut.isPending} onClick={handleSubmit}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function UsuariosExternosPage() {
  const { data: users, isLoading, isError } = useLibPartnerUsers()
  const setActive = useSetLibPartnerUserActive()
  const [createOpen, setCreateOpen] = useState(false)
  const [resetTarget, setResetTarget] = useState<LibPartnerUser | null>(null)

  return (
    <PageLayout title="Usuarios externos">
      <div className="mx-auto max-w-3xl">
        <AdminConfigNav />

        <div className="mb-4 flex items-start justify-between gap-3">
          <p className="max-w-lg text-[13px] leading-relaxed text-zinc-600">
            Cuentas para socios externos que necesitan acceder a un módulo puntual de la intranet sin ser
            usuarios de la intranet — hoy solo <strong>Libertadora Seguros</strong> (Skandia). Una cuenta por
            persona; la contraseña la fija un admin/gerente aquí mismo.
          </p>
          <Button type="button" className="shrink-0 gap-1.5" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Nueva cuenta
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-bold">Libertadora Seguros · Skandia CREA</CardTitle></CardHeader>
          <CardContent className="pt-0">
            {isLoading && <Skeleton className="h-40 rounded-lg" />}
            {isError && <p className="text-sm text-red-600">No se pudieron cargar las cuentas.</p>}
            {users && (
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wide text-zinc-400">
                    <th className="py-2 pr-3">Correo</th>
                    <th className="py-2 pr-3">Nombre</th>
                    <th className="py-2 pr-3">Estado</th>
                    <th className="py-2 pr-3">Último acceso</th>
                    <th className="py-2 pr-3" />
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-t border-zinc-100">
                      <td className="py-2 pr-3 font-medium text-zinc-700">{u.email}</td>
                      <td className="py-2 pr-3 text-zinc-500">{u.nombre || "—"}</td>
                      <td className="py-2 pr-3">
                        <Badge variant={u.active ? "success" : "destructive"}>{u.active ? "Activa" : "Desactivada"}</Badge>
                      </td>
                      <td className="py-2 pr-3 text-zinc-400">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("es-CO") : "Nunca"}</td>
                      <td className="py-2 pr-3">
                        <div className="flex justify-end gap-1">
                          <Button type="button" size="sm" variant="ghost" className="gap-1" onClick={() => setResetTarget(u)}>
                            <KeyRound className="h-3.5 w-3.5" /> Contraseña
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="gap-1"
                            onClick={() => setActive.mutate({ id: u.id, active: !u.active })}
                          >
                            {u.active ? <><Ban className="h-3.5 w-3.5" /> Desactivar</> : <><CheckCircle2 className="h-3.5 w-3.5" /> Reactivar</>}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr><td colSpan={5} className="py-8 text-center text-sm text-zinc-400">Sin cuentas creadas todavía.</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      <CreatePartnerUserDialog open={createOpen} onOpenChange={setCreateOpen} />
      <ResetPasswordDialog user={resetTarget} onOpenChange={(v) => !v && setResetTarget(null)} />
    </PageLayout>
  )
}
