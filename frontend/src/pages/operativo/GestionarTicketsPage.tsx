import { useMemo, useState } from "react"
import { PageLayout } from "@/components/layout/PageLayout"
import { BlurFade } from "@/components/ui/blur-fade"
import { AnimatedGridPattern } from "@/components/ui/animated-grid-pattern"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/store/authStore"
import { canSeeTicketsGerencia } from "@/lib/permissions"
import { useTickets } from "@/hooks/useTickets"
import { TicketScorePanel } from "@/components/operativo/gestion-tickets/TicketScorePanel"
import { TicketHistoryRow } from "@/components/operativo/gestion-tickets/TicketHistoryRow"
import { TicketGerenciaRow } from "@/components/operativo/gestion-tickets/TicketGerenciaRow"
import { TicketManageSheet } from "@/components/operativo/gestion-tickets/TicketManageSheet"

type Vista = "mis" | "todos"

export function GestionarTicketsPage() {
  const user = useAuthStore((s) => s.user)
  const esGerencia = canSeeTicketsGerencia(user?.role ?? "", user?.app_permissions)
  const [vista, setVista] = useState<Vista>("mis")

  const enVistaTotal = esGerencia && vista === "todos"
  const { data: misTickets = [], isLoading: cargandoMis } = useTickets({ asignadoAMi: true }, { enabled: !enVistaTotal })
  const { data: todosTickets = [], isLoading: cargandoTodos } = useTickets({}, { enabled: enVistaTotal })
  const tickets = enVistaTotal ? todosTickets : misTickets
  const isLoading = enVistaTotal ? cargandoTodos : cargandoMis

  const [search, setSearch] = useState("")
  const [openTicketId, setOpenTicketId] = useState<number | null>(null)

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return tickets
    return tickets.filter((t) =>
      [t.code, t.area, t.platform, t.description, t.status, t.supervisor, ...t.analysts]
        .join(" ")
        .toLowerCase()
        .includes(term)
    )
  }, [tickets, search])

  const pendientes = filtered.filter((t) => !/cerrado/i.test(t.status))
  const cerrados = filtered.filter((t) => /cerrado/i.test(t.status))

  return (
    <PageLayout title="Gestionar mis tickets" mainClassName="relative isolate flex-1 overflow-y-auto p-6">
      {/* Fondo de profundidad — mismo tratamiento de atmósfera que ya usa
          TicketsShell/TaskShell (grid animado en rojo + blooms de blur),
          adaptado a un layout con Sidebar/TopBar compartidos: acá vive
          adentro de <main>, no reemplaza el shell de la intranet. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <AnimatedGridPattern
          numSquares={50}
          maxOpacity={0.25}
          duration={3.5}
          repeatDelay={1}
          className={cn(
            "inset-x-0 inset-y-0 h-full text-primary stroke-primary/20",
            "[mask-image:radial-gradient(1200px_circle_at_10%_0%,white,transparent)]"
          )}
        />
        <div
          className="absolute -right-20 -top-20 h-[360px] w-[360px] rounded-full"
          style={{
            background:
              "radial-gradient(50% 50% at 50% 50%, rgba(239,51,64,0.22) 0%, rgba(196,30,58,0.11) 45%, transparent 72%)",
            filter: "blur(60px)",
          }}
        />
        <div
          className="absolute bottom-[-8%] left-[8%] h-[280px] w-[280px] rounded-full"
          style={{
            background: "radial-gradient(50% 50% at 50% 50%, rgba(196,30,58,0.14) 0%, transparent 70%)",
            filter: "blur(55px)",
          }}
        />
      </div>

      <div className="relative mx-auto grid max-w-6xl grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        {/* Panel izquierdo — resumen/score, como el perfil de un jugador */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <TicketScorePanel tickets={tickets} userName={user?.full_name ?? user?.email ?? "—"} />
        </div>

        {/* Columna principal — historial de tickets asignados, o vista total (gerencia) */}
        <div className="min-w-0 space-y-6">
          {esGerencia && (
            <div className="inline-flex rounded-lg border border-border bg-background/80 p-1 backdrop-blur-sm">
              <button
                type="button"
                onClick={() => setVista("mis")}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors",
                  vista === "mis" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Mis tickets
              </button>
              <button
                type="button"
                onClick={() => setVista("todos")}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors",
                  vista === "todos" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Todos los tickets
              </button>
            </div>
          )}

          <input
            type="text"
            name="buscar-tickets"
            autoComplete="off"
            aria-label="Buscar tickets"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por código, área, plataforma, supervisor, analista…"
            className="w-full rounded-lg border border-border bg-background/80 px-3 py-2 text-sm text-foreground backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />

          {isLoading && <p className="text-sm text-muted-foreground">Cargando tickets…</p>}

          {!isLoading && filtered.length === 0 && (
            <div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
              {enVistaTotal ? "No hay tickets registrados todavía." : "No tienes tickets asignados todavía."}
            </div>
          )}

          {pendientes.length > 0 && (
            <div className="space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Pendientes ({pendientes.length})
              </p>
              <div className="space-y-2">
                {pendientes.map((t, i) => (
                  <BlurFade key={t.id} duration={0.3} delay={Math.min(0.05 * i, 0.4)}>
                    {enVistaTotal
                      ? <TicketGerenciaRow ticket={t} onClick={() => setOpenTicketId(t.id)} />
                      : <TicketHistoryRow ticket={t} onClick={() => setOpenTicketId(t.id)} />}
                  </BlurFade>
                ))}
              </div>
            </div>
          )}

          {cerrados.length > 0 && (
            <div className="space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Cerrados ({cerrados.length})
              </p>
              <div className="space-y-2">
                {cerrados.map((t, i) => (
                  <BlurFade key={t.id} duration={0.3} delay={Math.min(0.05 * i, 0.4)}>
                    {enVistaTotal
                      ? <TicketGerenciaRow ticket={t} onClick={() => setOpenTicketId(t.id)} />
                      : <TicketHistoryRow ticket={t} onClick={() => setOpenTicketId(t.id)} />}
                  </BlurFade>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <TicketManageSheet ticketId={openTicketId} onClose={() => setOpenTicketId(null)} />
    </PageLayout>
  )
}
