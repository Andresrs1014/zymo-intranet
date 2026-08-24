import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  // Lazy initializer en vez de useState(undefined) + set en useEffect: si el
  // valor real solo llega después del primer render, un <Navigate> montado
  // como hijo (ver SigRoute en App.tsx) ya dispara su navegación con el
  // valor viejo antes de que este efecto corra — el componente se desmonta
  // y la corrección nunca llega a producir una segunda navegación.
  const [isMobile, setIsMobile] = React.useState(() => window.innerWidth < MOBILE_BREAKPOINT)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    mql.addEventListener("change", onChange)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return isMobile
}
