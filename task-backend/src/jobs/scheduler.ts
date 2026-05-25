import cron from "node-cron"
import { runEscalationCheck } from "./escalation"

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

  console.log("[Scheduler] Escalation job registered (runs hourly)")
}
