import { useCallback, useEffect, useRef, useState } from "react"

interface Pos { x: number; y: number }

function leer(clave: string): Pos {
  try {
    const v = JSON.parse(localStorage.getItem(clave) ?? "null") as Pos | null
    if (v && Number.isFinite(v.x) && Number.isFinite(v.y)) return v
  } catch { /* sin almacenamiento: queda en su sitio de origen */ }
  return { x: 0, y: 0 }
}

/**
 * Deja mover un elemento anclado abajo a la derecha de su contenedor: con el puntero (arrastrar) y con el teclado
 * (flechas; Mayús = pasos grandes; Inicio = volver). La posición se recuerda y siempre queda dentro del contenedor.
 * `consumirClick()` es true si el gesto fue un arrastre, para no tratarlo como un clic.
 */
export function useArrastrable(clave: string, margen = 40) {
  const [pos, setPos] = useState<Pos>(() => leer(clave))
  const ref = useRef<HTMLElement | null>(null)
  const gesto = useRef<{ px: number; py: number; x: number; y: number; movido: boolean } | null>(null)
  const movidoUltimo = useRef(false)

  const limitar = useCallback((p: Pos): Pos => {
    const el = ref.current
    const padre = el?.offsetParent as HTMLElement | null
    if (!el || !padre) return p
    const tx = Math.max(0, padre.clientWidth - el.offsetWidth - margen)
    const ty = Math.max(0, padre.clientHeight - el.offsetHeight - margen)
    return { x: Math.min(0, Math.max(-tx, p.x)), y: Math.min(0, Math.max(-ty, p.y)) }
  }, [margen])

  const guardar = useCallback((p: Pos) => {
    try { localStorage.setItem(clave, JSON.stringify(p)) } catch { /* privado o lleno */ }
  }, [clave])

  // si la ventana se achica o el elemento crece (se abre la bandeja), vuelve a quedar dentro
  useEffect(() => {
    const ajustar = () => setPos((p) => limitar(p))
    ajustar()
    window.addEventListener("resize", ajustar)
    return () => window.removeEventListener("resize", ajustar)
  }, [limitar])

  const agarre = {
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      if (e.button !== 0 || (e.target as HTMLElement).closest("[data-no-arrastrar]")) return
      e.currentTarget.setPointerCapture(e.pointerId)
      gesto.current = { px: e.clientX, py: e.clientY, x: pos.x, y: pos.y, movido: false }
    },
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      const g = gesto.current
      if (!g) return
      const dx = e.clientX - g.px
      const dy = e.clientY - g.py
      if (!g.movido && Math.hypot(dx, dy) < 5) return
      g.movido = true
      setPos(limitar({ x: g.x + dx, y: g.y + dy }))
    },
    onPointerUp: (e: React.PointerEvent<HTMLElement>) => {
      const g = gesto.current
      gesto.current = null
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
      movidoUltimo.current = !!g?.movido
      if (g?.movido) guardar(limitar({ x: g.x + e.clientX - g.px, y: g.y + e.clientY - g.py }))
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
      const paso = e.shiftKey ? 48 : 16
      const d: Record<string, Pos> = { ArrowLeft: { x: -paso, y: 0 }, ArrowRight: { x: paso, y: 0 }, ArrowUp: { x: 0, y: -paso }, ArrowDown: { x: 0, y: paso } }
      if (e.key === "Home") { e.preventDefault(); setPos({ x: 0, y: 0 }); guardar({ x: 0, y: 0 }); return }
      const m = d[e.key]
      if (!m || (e.target as HTMLElement).closest("[data-no-arrastrar]")) return
      e.preventDefault()
      const nuevo = limitar({ x: pos.x + m.x, y: pos.y + m.y })
      setPos(nuevo)
      guardar(nuevo)
    },
  }

  return {
    ref: ref as React.RefObject<never>,
    pos,
    agarre,
    consumirClick: () => { const v = movidoUltimo.current; movidoUltimo.current = false; return v },
  }
}
