import cron from "node-cron"
import { runTicketReminders } from "./services/ticketReminders"

/**
 * Fase F — recordatorios de tickets sin cerrar (día 7/15/22/30). Corre una
 * vez al día, 8am hora de Bogotá. Solo alerta, nunca cierra tickets
 * automáticamente (decisión de negocio explícita, 2026-07-16).
 */
export function startReminderCron(): void {
  cron.schedule(
    "0 8 * * *",
    () => {
      runTicketReminders()
        .then((r) => console.log(`[reminders] ${r.ranAt} — ${r.checked} ticket(s) abiertos revisados, ${r.sent} recordatorio(s) enviado(s)`))
        .catch((err) => console.error("[reminders] error en cron de recordatorios:", err))
    },
    { timezone: "America/Bogota" },
  )
  console.log("[reminders] cron de recordatorios programado (0 8 * * * America/Bogota)")
}
