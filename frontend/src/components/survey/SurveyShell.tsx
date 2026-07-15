import type { ReactNode } from "react"

type StatItem = { value: string; label: string }

type SurveyShellProps = {
  logoSrc: string
  title: string
  badge: string
  heading: string
  description: string
  stats: StatItem[]
  currentStep: number // 1-indexado
  totalSteps: number
  children: ReactNode
}

/**
 * Una sola página responsive: el panel de marca oscuro (desktop, "recompensa")
 * y la banda de header roja (mobile, "alivio") se muestran/ocultan por breakpoint CSS,
 * no por detección de dispositivo.
 */
export function SurveyShell({ logoSrc, title, badge, heading, description, stats, currentStep, totalSteps, children }: SurveyShellProps) {
  const percent = Math.round((currentStep / totalSteps) * 100)
  const stepLabel = `Pregunta ${currentStep} de ${totalSteps}`

  return (
    <div className="min-h-screen bg-[#f4f4f6] flex items-center justify-center p-0 lg:p-10">
      <div className="w-full flex flex-col lg:max-w-3xl lg:rounded-2xl lg:overflow-hidden lg:shadow-[0_24px_60px_rgba(0,0,0,0.3)] lg:grid lg:grid-cols-[1fr_1.15fr] min-h-screen lg:min-h-0">
        {/* Panel de marca — solo desktop */}
        <div className="hidden lg:flex relative flex-col justify-between p-9 overflow-hidden [background:radial-gradient(120%_140%_at_15%_0%,#4a1420_0%,#241014_55%,#180c0e_100%)]">
          <div
            className="absolute inset-0 opacity-50"
            style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)", backgroundSize: "16px 16px" }}
          />
          <div className="relative z-10">
            <div className="inline-block bg-white rounded-lg px-3 py-2 mb-7">
              <img src={logoSrc} alt="ZYMO" className="h-4" />
            </div>
            <span className="inline-block text-[10px] font-semibold tracking-wider uppercase text-[#ffa8b8] bg-[rgba(212,58,86,0.18)] border border-[rgba(212,58,86,0.35)] px-3 py-1.5 rounded-full mb-4">
              {badge}
            </span>
            <h2 className="text-white text-2xl font-semibold leading-snug mb-2.5 tracking-tight">{heading}</h2>
            <p className="text-[#c9bcc0] text-[13px] leading-relaxed">{description}</p>
          </div>
          <div className="relative z-10 flex gap-6 mt-7 pt-5 border-t border-white/10">
            {stats.map((stat) => (
              <div key={stat.label}>
                <b className="block text-survey-primary text-xl font-mono">{stat.value}</b>
                <span className="text-[#9c8f93] text-[9.5px] uppercase tracking-wide">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Banda de header — solo mobile */}
        <div className="lg:hidden relative bg-gradient-to-br from-survey-primary to-survey-primary-dark px-6 pt-6 pb-11">
          <div className="inline-block bg-white rounded-md px-2.5 py-1.5 mb-3.5">
            <img src={logoSrc} alt="ZYMO" className="h-3.5" />
          </div>
          <h5 className="text-white text-[15px] font-semibold mb-1.5">{title}</h5>
          <p className="text-white/85 text-[11px]">Solo te tomará 2 minutos · Confidencial</p>
          <div className="absolute -bottom-px left-0 right-0 h-7 bg-white rounded-t-[50%]" />
        </div>

        {/* Formulario */}
        <div className="bg-white flex-1 flex flex-col justify-start lg:justify-center px-6 py-7 lg:px-10 lg:py-9 -mt-3.5 lg:mt-0 rounded-t-3xl lg:rounded-none relative">
          {/* Progreso desktop: anillo */}
          <div className="hidden lg:flex items-center gap-3 mb-5">
            <div
              className="w-[38px] h-[38px] rounded-full flex items-center justify-center"
              style={{ background: `conic-gradient(#d43a56 ${percent}%, #f0e8ea 0)` }}
            >
              <div className="w-7 h-7 rounded-full bg-white" />
            </div>
            <span className="text-[10.5px] text-survey-muted font-mono">{stepLabel.toUpperCase()}</span>
          </div>

          {/* Progreso mobile: puntos */}
          <div className="lg:hidden flex justify-center gap-1.5 mb-5">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={
                  i + 1 === currentStep
                    ? "w-4 h-1.5 rounded-full bg-survey-primary"
                    : "w-1.5 h-1.5 rounded-full bg-[#ece9ea]"
                }
              />
            ))}
          </div>

          {children}
        </div>
      </div>
    </div>
  )
}
