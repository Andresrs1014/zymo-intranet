import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { AnimatedCircularProgressBar } from "@/components/ui/animated-circular-progress-bar"
import { NumberTicker } from "@/components/ui/number-ticker"
import { BlurFade } from "@/components/ui/blur-fade"
import type { Ticket } from "@/types/ticket"

function isResuelto(t: Ticket): boolean {
  return /cerrado/i.test(t.status)
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?"
}

interface BreakdownRowProps {
  label: string
  resolved: number
  total: number
}

function BreakdownRow({ label, resolved, total }: BreakdownRowProps) {
  const pct = total > 0 ? Math.round((resolved / total) * 100) : 0
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-foreground truncate">{label}</span>
        <span className="text-muted-foreground tabular-nums">{resolved}/{total}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function groupBy(tickets: Ticket[], key: "platform" | "area"): { label: string; resolved: number; total: number }[] {
  const map = new Map<string, { resolved: number; total: number }>()
  for (const t of tickets) {
    const label = (key === "platform" ? t.platform : t.area) || "Sin definir"
    const entry = map.get(label) ?? { resolved: 0, total: 0 }
    entry.total += 1
    if (isResuelto(t)) entry.resolved += 1
    map.set(label, entry)
  }
  return Array.from(map.entries())
    .map(([label, v]) => ({ label, ...v }))
    .sort((a, b) => b.total - a.total)
}

export function TicketScorePanel({ tickets, userName }: { tickets: Ticket[]; userName: string }) {
  const total = tickets.length
  const resolved = tickets.filter(isResuelto).length
  const pct = total > 0 ? Math.round((resolved / total) * 100) : 0
  const byPlatform = groupBy(tickets, "platform")
  const byArea = groupBy(tickets, "area")

  return (
    <BlurFade duration={0.35}>
      <div className="rounded-2xl border border-border bg-card p-6 flex flex-col items-center text-center">
        <Avatar className="h-16 w-16 mb-3">
          <AvatarFallback className="bg-primary/10 text-primary font-bold text-lg">
            {initials(userName)}
          </AvatarFallback>
        </Avatar>
        <p className="font-bold text-foreground leading-tight">{userName}</p>
        <p className="text-xs text-muted-foreground mb-6">Gestionar mis tickets</p>

        <AnimatedCircularProgressBar
          value={pct}
          gaugePrimaryColor="hsl(var(--primary))"
          gaugeSecondaryColor="hsl(var(--muted))"
          className="size-32 text-xl mb-2"
        />
        <p className="text-sm text-muted-foreground mb-1">Tickets resueltos</p>
        <p className="text-2xl font-bold tabular-nums mb-6">
          <NumberTicker value={resolved} className="text-foreground" />{" "}
          <span className="text-sm font-normal text-muted-foreground">/ {total}</span>
        </p>

        {byPlatform.length > 0 && (
          <div className="w-full text-left space-y-3 mb-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Por plataforma</p>
            {byPlatform.map((row) => (
              <BreakdownRow key={row.label} {...row} />
            ))}
          </div>
        )}

        {byArea.length > 0 && (
          <div className="w-full text-left space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Por área</p>
            {byArea.map((row) => (
              <BreakdownRow key={row.label} {...row} />
            ))}
          </div>
        )}
      </div>
    </BlurFade>
  )
}
