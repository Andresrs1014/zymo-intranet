import { useEffect, useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FormSelect } from "@/components/tareas/FormSelect"
import { MultiCombobox } from "@/components/ui/Combobox"
import { api } from "@/lib/api"
import { useAuthStore } from "@/store/authStore"
import { canSeeTicketsGerencia } from "@/lib/permissions"
import {
  useTicket, useTicketConfigLists, useUpdateTicketStatus, useUpdateTicketCriterio,
  useUpdateTicketFechaCompromiso, useAddTicketAction, useUploadTicketEvidence,
  useAssignTicket, useMarkTicketReady, useValidateTicketClosure, useDeleteTicket,
} from "@/hooks/useTickets"
import { extractErrorMessage } from "@/lib/ticketErrors"
import { formatSlaHours } from "@/lib/ticketWork"

type Tab = "detalle" | "bitacora" | "evidencias"
type PersonaDirectorio = { id: number; nombre: string; email: string }

export function TicketManageSheet({ ticketId, onClose }: { ticketId: number | null; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("detalle")
  const { data: ticket } = useTicket(ticketId)
  const { data: lists } = useTicketConfigLists()
  const updateStatus = useUpdateTicketStatus()
  const updateCriterio = useUpdateTicketCriterio()
  const updateFecha = useUpdateTicketFechaCompromiso()
  const addAction = useAddTicketAction()
  const uploadEvidence = useUploadTicketEvidence()
  const assignTicket = useAssignTicket()
  const markReady = useMarkTicketReady()
  const validateClosure = useValidateTicketClosure()
  const deleteTicket = useDeleteTicket()
  const [newAction, setNewAction] = useState("")
  const [newFiles, setNewFiles] = useState<File[]>([])
  const [fechaCompromiso, setFechaCompromiso] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [analistasOptions, setAnalistasOptions] = useState<PersonaDirectorio[]>([])
  const [analistasSeleccionados, setAnalistasSeleccionados] = useState<string[]>([])
  const [comentarioGerencia, setComentarioGerencia] = useState("")

  const user = useAuthStore((s) => s.user)
  const userEmail = (user?.email ?? "").toLowerCase()
  const isOverride = user?.role === "admin" || Boolean(user?.app_permissions?.includes("mod_tickets_config"))
  const isGerencia = canSeeTicketsGerencia(user?.role ?? "", user?.app_permissions) || isOverride

  useEffect(() => {
    if (!ticketId) return
    api.get("/operativo/personas/lista-simple", { params: { rol: "analista" } })
      .then(({ data }) => setAnalistasOptions(Array.isArray(data) ? data : []))
      .catch(() => setAnalistasOptions([]))
  }, [ticketId])

  useEffect(() => {
    if (!ticket) return
    setAnalistasSeleccionados(
      analistasOptions.filter((p) => ticket.analystEmails.map((e) => e.toLowerCase()).includes(p.email.toLowerCase())).map((p) => String(p.id))
    )
  }, [ticket, analistasOptions])

  if (!ticket) return null

  const isSupervisor = Boolean(ticket.supervisorEmail && ticket.supervisorEmail.toLowerCase() === userEmail) || isOverride || isGerencia
  const isAnalyst = ticket.analystEmails.map((e) => e.toLowerCase()).includes(userEmail) || isOverride || isGerencia
  const pendienteAsignacion = ticket.status === "Abierto" || ticket.status === "En analisis"
  const enGestion = ticket.status === "En gestion"
  const pendienteValidacion = ticket.status === "Pendiente validacion"

  function handleAsignar() {
    if (!analistasSeleccionados.length || assignTicket.isPending) return
    const personas = analistasSeleccionados
      .map((id) => analistasOptions.find((p) => String(p.id) === id))
      .filter((p): p is PersonaDirectorio => Boolean(p))
    setError(null)
    assignTicket.mutate(
      { ticketId: ticket!.id, analysts: personas.map((p) => p.nombre), analystEmails: personas.map((p) => p.email) },
      { onError: (err) => setError(extractErrorMessage(err)) },
    )
  }

  function handleMarcarListo() {
    if (markReady.isPending) return
    setError(null)
    markReady.mutate(ticket!.id, { onError: (err) => setError(extractErrorMessage(err)) })
  }

  function handleValidar(accion: "cerrar" | "regresar") {
    if (validateClosure.isPending) return
    if (accion === "regresar" && !comentarioGerencia.trim()) {
      setError("Escribe un comentario explicando qué falta antes de regresar el ticket.")
      return
    }
    setError(null)
    validateClosure.mutate(
      { ticketId: ticket!.id, accion, comentario: comentarioGerencia.trim() || undefined },
      { onSuccess: () => setComentarioGerencia(""), onError: (err) => setError(extractErrorMessage(err)) },
    )
  }

  function handleDelete() {
    if (deleteTicket.isPending) return
    if (!window.confirm(`¿Borrar definitivamente el ticket ${ticket!.code}? Esta acción no se puede deshacer.`)) return
    setError(null)
    deleteTicket.mutate(ticket!.id, { onSuccess: onClose, onError: (err) => setError(extractErrorMessage(err)) })
  }

  function handleStatusChange(status: string) {
    if (updateStatus.isPending) return
    const enteringClosed = /cerrado/i.test(status) && !/cerrado/i.test(ticket!.status)
    if (enteringClosed && !window.confirm(`¿Cambiar el estado a "${status}"? Esto registra la fecha de cierre del ticket.`)) {
      return
    }
    setError(null)
    updateStatus.mutate({ ticketId: ticket!.id, status }, { onError: (err) => setError(extractErrorMessage(err)) })
  }

  function handleCriterioChange(managementCriteria: string) {
    if (updateCriterio.isPending) return
    setError(null)
    updateCriterio.mutate({ ticketId: ticket!.id, managementCriteria }, { onError: (err) => setError(extractErrorMessage(err)) })
  }

  function handleFechaCompromiso() {
    if (!fechaCompromiso || updateFecha.isPending) return
    setError(null)
    updateFecha.mutate(
      { ticketId: ticket!.id, dueDate: fechaCompromiso },
      { onSuccess: () => setFechaCompromiso(""), onError: (err) => setError(extractErrorMessage(err)) },
    )
  }

  function handleAddAction() {
    if (!newAction.trim() || addAction.isPending) return
    setError(null)
    addAction.mutate(
      { ticketId: ticket!.id, texto: newAction.trim() },
      { onSuccess: () => setNewAction(""), onError: (err) => setError(extractErrorMessage(err)) },
    )
  }

  function handleUploadEvidence() {
    if (!newFiles.length || uploadEvidence.isPending) return
    setError(null)
    uploadEvidence.mutate(
      { ticketId: ticket!.id, files: newFiles },
      { onSuccess: () => setNewFiles([]), onError: (err) => setError(extractErrorMessage(err)) },
    )
  }

  const overdue = ticket.slaOverdue === true && !/cerrado/i.test(ticket.status)

  return (
    <Sheet open={ticketId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-mono text-base flex items-center gap-2">
            {ticket.code}
            {overdue && <Badge variant="destructive" className="text-[10px]">Vencido SLA</Badge>}
          </SheetTitle>
        </SheetHeader>

        {isOverride && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleteTicket.isPending}
            className="mt-2 text-[11px] text-destructive/70 underline hover:text-destructive disabled:opacity-50"
          >
            {deleteTicket.isPending ? "Borrando…" : "Borrar ticket definitivamente"}
          </button>
        )}

        {error && (
          <p role="alert" aria-live="polite" className="mt-2 rounded-md bg-[#fce9ed] px-3 py-2 text-sm text-[#a8172f]">
            {error}
          </p>
        )}

        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="mt-4">
          <TabsList>
            <TabsTrigger value="detalle">Detalle</TabsTrigger>
            <TabsTrigger value="bitacora">Bitácora ({ticket.actions.length})</TabsTrigger>
            <TabsTrigger value="evidencias">Evidencias ({ticket.evidence.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="detalle" className="space-y-4 py-3">
            <div className="text-[13px] text-zinc-700">
              <p><strong>Tipo:</strong> {ticket.type}</p>
              <p><strong>Área:</strong> {ticket.area}</p>
              {ticket.platform && <p><strong>Plataforma:</strong> {ticket.platform}</p>}
              {ticket.client && <p><strong>Referencia:</strong> {ticket.client}</p>}
              <p><strong>Fecha:</strong> {ticket.date}</p>
              <p><strong>Prioridad:</strong> {ticket.priority}</p>
              {ticket.impact && <p><strong>Impacto:</strong> {ticket.impact}</p>}
              {ticket.slaLimitHours != null && (
                <p>
                  <strong>SLA:</strong> {formatSlaHours(ticket.slaElapsedHours)} de {formatSlaHours(ticket.slaLimitHours)} laborales
                  {overdue && <span className="text-destructive font-semibold"> — vencido</span>}
                </p>
              )}
              {ticket.dueDate && <p><strong>Fecha compromiso:</strong> {ticket.dueDate}</p>}
              {ticket.closedDate && <p><strong>Cierre:</strong> {ticket.closedDate}</p>}
              {ticket.description && <p className="mt-2 whitespace-pre-wrap">{ticket.description}</p>}
            </div>

            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-zinc-500">Estado</span>
                <Badge variant={ticket.status === "Cerrado" ? "default" : "secondary"}>{ticket.status}</Badge>
              </div>

              {isSupervisor && pendienteAsignacion && (
                <div className="space-y-2">
                  <p className="text-[13px] text-zinc-600">Analiza el ticket y asígnalo al analista correspondiente.</p>
                  <MultiCombobox
                    options={analistasOptions.map((p) => ({ value: String(p.id), label: p.nombre }))}
                    values={analistasSeleccionados}
                    onChange={(v) => setAnalistasSeleccionados(v.map(String))}
                    placeholder="Seleccionar analista(s)..."
                  />
                  <Button type="button" size="sm" disabled={!analistasSeleccionados.length || assignTicket.isPending} onClick={handleAsignar}>
                    {assignTicket.isPending ? "Asignando…" : "Asignar"}
                  </Button>
                </div>
              )}

              {isAnalyst && enGestion && (
                <div className="space-y-2">
                  <p className="text-[13px] text-zinc-600">
                    Sube la evidencia del cambio en la pestaña "Evidencias" y luego marca el ticket como listo.
                  </p>
                  <Button
                    type="button" size="sm" disabled={!ticket.evidence.length || markReady.isPending}
                    title={!ticket.evidence.length ? "Sube al menos un archivo de evidencia primero" : undefined}
                    onClick={handleMarcarListo}
                  >
                    {markReady.isPending ? "Enviando…" : "Marcar listo para validación"}
                  </Button>
                </div>
              )}

              {isGerencia && pendienteValidacion && (
                <div className="space-y-2">
                  <p className="text-[13px] text-zinc-600">Revisa la evidencia y valida el cierre, o regresa el ticket con un comentario.</p>
                  <textarea
                    value={comentarioGerencia}
                    onChange={(e) => setComentarioGerencia(e.target.value)}
                    placeholder="Comentario (obligatorio solo si regresas el ticket)"
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-primary"
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <Button type="button" size="sm" disabled={validateClosure.isPending} onClick={() => handleValidar("cerrar")}>
                      {validateClosure.isPending ? "Guardando…" : "Validar y cerrar"}
                    </Button>
                    <Button type="button" size="sm" variant="outline" disabled={validateClosure.isPending} onClick={() => handleValidar("regresar")}>
                      Regresar a gestión
                    </Button>
                  </div>
                </div>
              )}

              {!pendienteAsignacion && !enGestion && !pendienteValidacion && ticket.status !== "Escalado" && (
                <p className="text-[13px] text-zinc-600">
                  {ticket.validatedBy ? `Cerrado y validado por ${ticket.validatedBy}.` : "Este ticket está cerrado."}
                </p>
              )}

              {(isSupervisor || isAnalyst) && ticket.status !== "Escalado" && !/cerrado/i.test(ticket.status) && (
                <button
                  type="button"
                  className="text-[12px] text-zinc-500 underline hover:text-zinc-700"
                  disabled={updateStatus.isPending}
                  onClick={() => handleStatusChange("Escalado")}
                >
                  Escalar ticket
                </button>
              )}
            </div>

            <FormSelect
              label="Criterio de gestión"
              value={ticket.managementCriteria ?? ""}
              onChange={handleCriterioChange}
              options={(lists?.managementCriteria ?? []).map((m) => ({ value: m.value, label: m.label }))}
              noneLabel="Sin definir"
            />

            <div>
              <label htmlFor="fecha-compromiso" className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.06em] text-zinc-500">
                Fecha de compromiso
              </label>
              <div className="flex gap-2">
                <input
                  id="fecha-compromiso"
                  type="date"
                  value={fechaCompromiso}
                  onChange={(e) => setFechaCompromiso(e.target.value)}
                  className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-primary"
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={!fechaCompromiso || updateFecha.isPending}
                  onClick={handleFechaCompromiso}
                >
                  {updateFecha.isPending ? "Guardando…" : "Guardar"}
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="bitacora" className="space-y-3 py-3">
            {ticket.actions.map((action) => (
              <div key={action.id} className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-[13px] text-zinc-700">
                {action.texto}
              </div>
            ))}
            <div className="flex gap-2">
              <input
                aria-label="Agregar acción"
                value={newAction}
                onChange={(e) => setNewAction(e.target.value)}
                placeholder="Agregar acción…"
                className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <button
                type="button"
                disabled={!newAction.trim() || addAction.isPending}
                onClick={handleAddAction}
                className="rounded-md bg-primary px-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:hover:bg-primary"
              >
                {addAction.isPending ? "Agregando…" : "Agregar"}
              </button>
            </div>
          </TabsContent>

          <TabsContent value="evidencias" className="space-y-3 py-3">
            {ticket.evidence.map((ev) => (
              <a
                key={ev.id}
                href={ev.url ?? "#"}
                target="_blank"
                rel="noreferrer"
                className="block rounded-md border border-zinc-200 px-3 py-2 text-[13px] text-primary hover:underline"
              >
                {ev.filename}
              </a>
            ))}
            <div className="flex gap-2">
              <input
                type="file"
                multiple
                aria-label="Adjuntar evidencia"
                onChange={(e) => setNewFiles(Array.from(e.target.files ?? []))}
              />
              <button
                type="button"
                disabled={!newFiles.length || uploadEvidence.isPending}
                onClick={handleUploadEvidence}
                className="rounded-md bg-primary px-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:hover:bg-primary"
              >
                {uploadEvidence.isPending ? "Subiendo…" : "Subir"}
              </button>
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}
