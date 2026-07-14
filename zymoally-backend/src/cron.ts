import cron from "node-cron"
import { syncMasterData } from "./services/masterDataSync"

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
              `personas +${r.personas.created}/~${r.personas.updated}`,
          ),
        )
        .catch((err) => console.error("[sync] error en sync programado:", err))
    },
    { timezone: "America/Bogota" },
  )
  console.log("[sync] cron de datos maestros programado (0 6,12,16 * * * America/Bogota)")
}
