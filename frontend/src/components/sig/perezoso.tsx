import { lazy, Suspense, type ComponentType } from "react"
import { Loader } from "lucide-react"

/** Lo que se ve en el sitio de un panel pesado mientras baja: un respiro corto, sin saltos de diseño. */
function CargandoPanel() {
  return (
    <div role="status" className="flex h-full min-h-40 flex-1 items-center justify-center gap-2 text-xs text-zinc-600">
      <Loader className="h-4 w-4 animate-spin" aria-hidden />
      Cargando…
    </div>
  )
}

/** Un componente que se descarga solo cuando se usa por primera vez (el SIG abre más rápido): `perezoso(() => import("./X"), "X")`. */
export function perezoso<M, K extends keyof M & string>(cargar: () => Promise<M>, nombre: K) {
  type P = M[K] extends ComponentType<infer Q> ? Q : never
  const Cargado = lazy(() => cargar().then((m) => ({ default: m[nombre] as unknown as ComponentType<P> })))
  return function Perezoso(props: P) {
    return (
      <Suspense fallback={<CargandoPanel />}>
        <Cargado {...(props as P & React.JSX.IntrinsicAttributes)} />
      </Suspense>
    )
  }
}
