import type { ButtonHTMLAttributes, ReactNode } from "react"
import { motion } from "motion/react"
import { cn } from "@/lib/utils"

interface ShimmerButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
}

// Versión simplificada del Shimmer Button de magicui.design/docs/components/
// shimmer-button: un barrido de luz diagonal en loop sobre el botón. Se
// reimplementó con "motion" (ya instalado, usado por AnimatedGridPattern y
// BlurFade) en vez de los keyframes CSS del original, para no tener que
// registrar animaciones nuevas en tailwind.config.js — mismo efecto visual,
// sin tocar configuración global. Paleta blanco+rojo de la marca, no el
// negro/blanco por defecto de Magic UI.
export function ShimmerButton({ className, children, ...props }: ShimmerButtonProps) {
  return (
    <button
      className={cn(
        "relative inline-flex items-center justify-center gap-1.5 overflow-hidden rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-sm transition hover:brightness-95 disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      {...props}
    >
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 z-0 w-1/3 -skew-x-[20deg] bg-white/30"
        initial={{ x: "-140%" }}
        animate={{ x: "340%" }}
        transition={{ duration: 2.2, repeat: Infinity, repeatDelay: 1.4, ease: "easeInOut" }}
      />
      <span className="relative z-10 inline-flex items-center gap-1.5">{children}</span>
    </button>
  )
}
