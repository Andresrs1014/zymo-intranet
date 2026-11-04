import type { CapacitorConfig } from "@capacitor/cli"

// El APK es un contenedor que abre la intranet publicada: las actualizaciones del sitio
// llegan sin reinstalar. dist/ solo es el respaldo mínimo que exige Capacitor.
const config: CapacitorConfig = {
  appId: "com.zymo.intranet",
  appName: "ZYMO Intranet",
  webDir: "dist",
  server: {
    url: "https://zymointranet.com",
    androidScheme: "https",
  },
}

export default config
