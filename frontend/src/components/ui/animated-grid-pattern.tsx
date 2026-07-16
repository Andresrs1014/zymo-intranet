"use client"

import { useEffect, useId, useRef, useState } from "react"
import { motion, useReducedMotion } from "motion/react"
import { cn } from "@/lib/utils"

// Puerto fiel de magicui.design/docs/components/animated-grid-pattern —
// grid SVG de fondo con cuadrados que aparecen/desaparecen en posiciones
// aleatorias, usando ResizeObserver para adaptarse al contenedor.
export interface AnimatedGridPatternProps {
  width?: number
  height?: number
  x?: number
  y?: number
  strokeDasharray?: number | string
  numSquares?: number
  className?: string
  maxOpacity?: number
  duration?: number
  repeatDelay?: number
}

export function AnimatedGridPattern({
  width = 40,
  height = 40,
  x = -1,
  y = -1,
  strokeDasharray = 0,
  numSquares = 50,
  className,
  maxOpacity = 0.5,
  duration = 4,
  repeatDelay = 0.5,
}: AnimatedGridPatternProps) {
  const id = useId()
  const prefersReducedMotion = useReducedMotion()
  const containerRef = useRef<SVGSVGElement>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [squares, setSquares] = useState<{ id: number; pos: [number, number] }[]>([])

  function getPos(dims: { width: number; height: number }): [number, number] {
    return [
      Math.floor((Math.random() * dims.width) / width),
      Math.floor((Math.random() * dims.height) / height),
    ]
  }

  function generateSquares(count: number, dims: { width: number; height: number }) {
    return Array.from({ length: count }, (_, i) => ({ id: i, pos: getPos(dims) }))
  }

  // ponytail: la versión original reposicionaba cada cuadrado vía setState en
  // `onAnimationComplete` (un re-render de React por cuadrado, ~70 veces
  // escalonadas) — con 70 cuadrados eso midió 4700 renders/4s en vivo, ruido
  // suficiente para interferir con clics rápidos en el resto de la página
  // (confirmado con el profiler de React). El pulso in/out ahora lo maneja
  // Framer Motion solo (repeat: Infinity, sin JS de por medio); se pierde el
  // reposicionamiento con el tiempo, se mantiene el efecto de "grid vivo".
  useEffect(() => {
    if (dimensions.width && dimensions.height) {
      setSquares(generateSquares(numSquares, dimensions))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dimensions, numSquares])

  useEffect(() => {
    const node = containerRef.current
    if (!node) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({ width: entry.contentRect.width, height: entry.contentRect.height })
      }
    })
    observer.observe(node)
    return () => observer.unobserve(node)
  }, [])

  return (
    <svg
      ref={containerRef}
      aria-hidden="true"
      className={cn(
        // Los cuadrados animados usan fill="currentColor" (resuelto por la
        // propiedad CSS `color`, no `fill`) — por eso el color base va en
        // text-*, no fill-*. `stroke-*` sí colorea la línea del grid base.
        "pointer-events-none absolute inset-0 h-full w-full text-zinc-400/30 stroke-zinc-400/30",
        className
      )}
    >
      <defs>
        <pattern id={id} width={width} height={height} patternUnits="userSpaceOnUse" x={x} y={y}>
          <path d={`M.5 ${height}V.5H${width}`} fill="none" strokeDasharray={strokeDasharray} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
      <svg x={x} y={y} className="overflow-visible">
        {squares.map(({ pos: [sx, sy] }, index) => (
          <motion.rect
            key={`${sx}-${sy}-${index}`}
            initial={{ opacity: prefersReducedMotion ? maxOpacity : 0 }}
            animate={{ opacity: maxOpacity }}
            transition={
              prefersReducedMotion
                ? { duration: 0 }
                : { duration, repeat: Infinity, delay: index * 0.1, repeatType: "reverse", repeatDelay }
            }
            width={width - 1}
            height={height - 1}
            x={sx * width + 1}
            y={sy * height + 1}
            fill="currentColor"
            strokeWidth={0}
          />
        ))}
      </svg>
    </svg>
  )
}
