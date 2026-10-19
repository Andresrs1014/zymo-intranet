/** Lo que se ve mientras baja la pantalla a la que entras: una barra que avanza arriba y el espacio ya reservado. */
export function CargandoPagina() {
  return (
    <div role="status" aria-live="polite" className="fixed inset-0 z-50 grid place-items-center bg-white/70">
      <span className="absolute inset-x-0 top-0 h-0.5 overflow-hidden bg-red-100" aria-hidden="true">
        <span className="block h-full w-1/3 bg-red-600 [animation:cargando-barra_1.1s_cubic-bezier(.2,.8,.2,1)_infinite]" />
      </span>
      <span className="text-sm text-zinc-600">Cargando…</span>
      <style>{`
        @keyframes cargando-barra { from { transform: translateX(-100%) } to { transform: translateX(300%) } }
        @media (prefers-reduced-motion: reduce) { [style*="cargando-barra"], span[class*="cargando-barra"] { animation: none !important } }
      `}</style>
    </div>
  )
}
