import cron from "node-cron"
import { generarAlertasWhatsApp, registrarAlertas } from "../services/alertaService"

export function startScheduler(): void {
  // Run every hour at minute 0
  cron.schedule("0 * * * *", async () => {
    try {
      const alertas = await generarAlertasWhatsApp()
      if (alertas.length > 0) {
        await registrarAlertas(alertas, "auto")
        console.log(`[scheduler] ${alertas.length} alertas registradas automáticamente`)
      }
    } catch (err) {
      console.error("[scheduler] Error en job de alertas:", err)
    }
  })
  console.log("[scheduler] Job de alertas iniciado — cada hora")
}
