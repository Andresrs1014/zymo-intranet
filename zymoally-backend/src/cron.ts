import cron from "node-cron"
import { syncMasterData } from "./services/masterDataSync"
import { runTicketReminders } from "./services/ticketReminders"

/**
 * Programa la sincronización de datos maestros (áreas, plataformas, personas)
 * desde el directorio de la intranet. `node-cron` es el primer uso de esta
 * dependencia en los backends Node del repo — patrón a clonar si otro backend
 * necesita un cron interno. Horario: 6am, 12pm y 4pm hora de Bogotá — el
 * contenedor corre en UTC por defecto (sin TZ configurada), así que el
 * timezone se fija explícito, mismo patrón que
 * backend/app/agents/worker.py y backend/app/main.py.
 */
export function startSyncCron(): void {
  cron.schedule(
    "0 6,12,16 * * *",
    () => {
      syncMasterData()
        .then((r) =>
          console.log(
            `[sync] datos maestros ${r.ranAt} — areas +${r.areas.created}/~${r.areas.updated}, ` +
              `platforms +${r.platforms.created}/~${r.platforms.updated}, ` +
              `clients +${r.clients.created}/~${r.clients.updated}, ` +
              `supervisors +${r.supervisors.created}/~${r.supervisors.updated}, ` +
              `analysts +${r.analysts.created}/~${r.analysts.updated}, ` +
              `coordinators +${r.coordinators.created}/~${r.coordinators.updated}, ` +
              `managers +${r.managers.created}/~${r.managers.updated}`,
          ),
        )
        .catch((err) => console.error("[sync] error en sync programado:", err))
    },
    { timezone: "America/Bogota" },
  )
  console.log("[sync] cron de datos maestros programado (0 6,12,16 * * * America/Bogota)")
}

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
