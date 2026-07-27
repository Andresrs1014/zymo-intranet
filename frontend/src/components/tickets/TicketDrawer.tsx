import { useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { FormSelect } from "@/components/tareas/FormSelect"
import { useTicketsUI } from "@/context/TicketsContext"
import {
  useTicket, useTicketConfigLists, useUpdateTicketStatus, useUpdateTicketCriterio,
  useAddTicketAction, useUploadTicketEvidence,
} from "@/hooks/useTickets"
import { extractErrorMessage } from "@/lib/ticketErrors"

type DrawerTab = "detalle" | "bitacora" | "evidencias"

export function TicketDrawer() {
  const { openTicketId, setOpenTicketId } = useTicketsUI()
  const [tab, setTab] = useState<DrawerTab>("detalle")
  const { data: ticket } = useTicket(openTicketId)
  const { data: lists } = useTicketConfigLists()
  const updateStatus = useUpdateTicketStatus()
  const updateCriterio = useUpdateTicketCriterio()
  const addAction = useAddTicketAction()
  const uploadEvidence = useUploadTicketEvidence()
  const [newAction, setNewAction] = useState("")
  const [newFiles, setNewFiles] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)

  if (!ticket) return null

  function handleStatusChange(status: string) {
    if (updateStatus.isPending) return
    const enteringClosed = /cerrado/i.test(status) && !/cerrado/i.test(ticket!.status)
    if (enteringClosed && !window.confirm(`¿Cambiar el estado a "${status}"? Esto registra la fecha de cierre del ticket.`)) {
      return
    }
    setError(null)
    updateStatus.mutate(
      { ticketId: ticket!.id, status },
      { onError: (err) => setError(extractErrorMessage(err)) },
    )
  }

  function handleCriterioChange(managementCriteria: string) {
    if (updateCriterio.isPending) return
    setError(null)
    updateCriterio.mutate(
      { ticketId: ticket!.id, managementCriteria },
      { onError: (err) => setError(extractErrorMessage(err)) },
    )
  }

  function handleAddAction() {
    if (!newAction.trim() || addAction.isPending) return
    setError(null)
    addAction.mutate(
      { ticketId: ticket!.id, texto: newAction.trim() },
      {
        onSuccess: () => setNewAction(""),
        onError: (err) => setError(extractErrorMessage(err)),
      },
    )
  }

  function handleUploadEvidence() {
    if (!newFiles.length || uploadEvidence.isPending) return
    setError(null)
    uploadEvidence.mutate(
      { ticketId: ticket!.id, files: newFiles },
      {
        onSuccess: () => setNewFiles([]),
        onError: (err) => setError(extractErrorMessage(err)),
      },
    )
  }

  return (
    <Sheet open={openTicketId !== null} onOpenChange={(open) => !open && setOpenTicketId(null)}>
      <SheetContent side="right" className="w-full max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-mono text-base">{ticket.code}</SheetTitle>
        </SheetHeader>

        {error && (
          <p className="mt-2 rounded-md bg-[#fce9ed] px-3 py-2 text-sm text-[#a8172f]">{error}</p>
        )}

        <Tabs value={tab} onValueChange={(v) => setTab(v as DrawerTab)} className="mt-4">
          <TabsList>
            <TabsTrigger value="detalle">Detalle</TabsTrigger>
            <TabsTrigger value="bitacora">Bitácora ({ticket.actions.length})</TabsTrigger>
            <TabsTrigger value="evidencias">Evidencias ({ticket.evidence.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="detalle" className="space-y-4 py-3">
            <div className="text-[13px] text-zinc-700">
              <p><strong>Tipo:</strong> {ticket.type}</p>
              <p><strong>Área:</strong> {ticket.area}</p>
              {ticket.client && <p><strong>Referencia:</strong> {ticket.client}</p>}
              <p><strong>Fecha:</strong> {ticket.date}</p>
              {ticket.dueDate && <p><strong>Fecha compromiso:</strong> {ticket.dueDate}</p>}
              <p><strong>Prioridad:</strong> {ticket.priority}</p>
              {ticket.impact && <p><strong>Impacto:</strong> {ticket.impact}</p>}
              {ticket.channel && <p><strong>Canal:</strong> {ticket.channel}</p>}
              {ticket.platform && <p><strong>Plataforma:</strong> {ticket.platform}</p>}
              {ticket.supervisor && <p><strong>Supervisor:</strong> {ticket.supervisor}</p>}
              {ticket.analysts.length > 0 && <p><strong>Analista(s):</strong> {ticket.analysts.join(", ")}</p>}
              {ticket.coordinator && <p><strong>Coordinador:</strong> {ticket.coordinator}</p>}
              {ticket.manager && <p><strong>Gestiona:</strong> {ticket.manager}</p>}
              {ticket.phone && <p><strong>Teléfono:</strong> {ticket.phone}</p>}
              {ticket.email && <p><strong>Correo:</strong> {ticket.email}</p>}
              {ticket.closedDate && <p><strong>Cierre:</strong> {ticket.closedDate}</p>}
              {ticket.description && <p className="mt-2 whitespace-pre-wrap">{ticket.description}</p>}
            </div>

            <FormSelect
              label="Estado"
              value={ticket.status}
              onChange={handleStatusChange}
              options={(lists?.statuses ?? []).map((s) => ({ value: s.value, label: s.label }))}
            />
            <FormSelect
              label="Criterio de gestión"
              value={ticket.managementCriteria ?? ""}
              onChange={handleCriterioChange}
              options={(lists?.managementCriteria ?? []).map((m) => ({ value: m.value, label: m.label }))}
              noneLabel="Sin definir"
            />
          </TabsContent>

          <TabsContent value="bitacora" className="space-y-3 py-3">
            {ticket.actions.map((action) => (
              <div key={action.id} className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-[13px] text-zinc-700">
                {action.texto}
              </div>
            ))}
            <div className="flex gap-2">
              <input
                value={newAction}
                onChange={(e) => setNewAction(e.target.value)}
                placeholder="Agregar acción…"
                className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <button
                type="button"
                disabled={!newAction.trim() || addAction.isPending}
                onClick={handleAddAction}
                className="rounded-md bg-primary px-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
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
              <input type="file" multiple onChange={(e) => setNewFiles(Array.from(e.target.files ?? []))} />
              <button
                type="button"
                disabled={!newFiles.length || uploadEvidence.isPending}
                onClick={handleUploadEvidence}
                className="rounded-md bg-primary px-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
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
