"use client"

import { useEffect, useId, useRef, useState } from "react"
import { motion } from "motion/react"
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

  function updateSquarePosition(squareId: number) {
    setSquares((current) =>
      current.map((sq) => (sq.id === squareId ? { ...sq, pos: getPos(dimensions) } : sq))
    )
  }

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
        "pointer-events-none absolute inset-0 h-full w-full fill-zinc-400/30 stroke-zinc-400/30",
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
        {squares.map(({ pos: [sx, sy], id: squareId }, index) => (
          <motion.rect
            key={`${sx}-${sy}-${index}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: maxOpacity }}
            transition={{ duration, repeat: 1, delay: index * 0.1, repeatType: "reverse", repeatDelay }}
            onAnimationComplete={() => updateSquarePosition(squareId)}
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
