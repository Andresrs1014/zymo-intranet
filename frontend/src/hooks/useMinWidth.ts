import { useState, useEffect } from "react"

/** True when viewport is at least `minPx` wide (matches Tailwind `lg` = 1024 by default). */
export function useMinWidth(minPx: number): boolean {
  const [ok, setOk] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(`(min-width: ${minPx}px)`).matches : false
  )

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${minPx}px)`)
    const fn = () => setOk(mq.matches)
    fn()
    mq.addEventListener("change", fn)
    return () => mq.removeEventListener("change", fn)
  }, [minPx])

  return ok
}
