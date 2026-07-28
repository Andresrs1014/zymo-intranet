import { useMemo, type ReactNode } from "react"
import { Award } from "lucide-react"
import libertadoraLogo from "@/assets/libertadora-logo.jpg"
import "@/styles/libertadora.css"

// Header propio de Libertadora (no el TopBar general de la intranet) — la
// imagen es la tarjeta de presentación original de la ejecutiva (nombre,
// cargo, celular, PBX, correo ya vienen diseñados ahí), se mantiene intacta
// tal cual pidió el usuario. El texto de este componente NO repite esos
// datos — solo agrega lo que la imagen no trae (marca del módulo, badge del
// producto, fecha).
//
// `action` (ej. botón "Salir" del panel del socio) se renderiza DENTRO del
// mismo flex row, no superpuesto encima — así nunca choca con el badge/fecha
// sin importar el ancho de pantalla.
export function LibertadoraHeader({ action }: { action?: ReactNode }) {
  const today = useMemo(
    () => new Date().toLocaleDateString("es-CO", { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
    []
  )

  return (
    <div
      className="libertadora-scope flex flex-wrap items-center justify-between gap-4 px-6 py-4 text-white"
      style={{ background: "linear-gradient(135deg, var(--lib-navy) 0%, var(--lib-navy2) 55%, var(--lib-teal-d) 100%)" }}
    >
      <div className="flex items-center gap-4">
        <img src={libertadoraLogo} alt="Libertadora Seguros" className="h-20 rounded-md bg-white/95 px-2 py-1" />
        <div>
          <h1 className="text-base font-extrabold tracking-wide" style={{ color: "#00E5D4" }}>LIBERTADORA SEGUROS</h1>
          <p className="text-[11px] opacity-75">Sistema de control y seguimiento comercial · 2026</p>
          <div className="mt-1 h-0.5 w-48 rounded-full" style={{ background: "linear-gradient(90deg, var(--lib-orange), var(--lib-teal))" }} />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex flex-col items-end gap-1 text-right">
          <span
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-bold"
            style={{ background: "linear-gradient(90deg, var(--lib-orange), #e06010)" }}
          >
            <Award className="h-3.5 w-3.5" /> SKANDIA · PRODUCTO CREA
          </span>
          <span className="text-[10px] capitalize opacity-60">{today}</span>
        </div>
        {action}
      </div>
    </div>
  )
}
