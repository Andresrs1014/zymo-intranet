import cron from "node-cron"
import { runEscalationCheck } from "./escalation"
import { syncDirectoryCache } from "../services/directoryCacheSync"

export function startScheduler(): void {
  // Run every hour at minute 0
  cron.schedule("0 * * * *", async () => {
    console.log("[Scheduler] Running escalation check...")
    try {
      await runEscalationCheck()
    } catch (err) {
      console.error("[Scheduler] Escalation check error:", err)
    }
  })

  // Directorio intranet → directory_cache (6am, 12pm, 4pm Bogotá)
  cron.schedule(
    "0 6,12,16 * * *",
    () => {
      syncDirectoryCache()
        .then((r) =>
          console.log(
            `[Scheduler] directory sync ${r.ranAt} — areas +${r.areas.created}/~${r.areas.updated}, ` +
              `personas +${r.personas.created}/~${r.personas.updated}`,
          ),
        )
        .catch((err) => console.error("[Scheduler] directory sync error:", err))
    },
    { timezone: "America/Bogota" },
  )

  console.log("[Scheduler] Escalation job registered (runs hourly)")
  console.log("[Scheduler] Directory cache sync registered (0 6,12,16 * * * America/Bogota)")
}
