import type { ReactNode } from "react"
import { useNavigate } from "react-router-dom"
import { Sidebar } from "@/components/layout/Sidebar"
import { TopBar } from "@/components/layout/TopBar"
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar"
import { MovilBarraSuperior, MovilEspaciador } from "@/components/movil/Movil"

/** Lo que cambia solo en teléfono (por debajo de `md`). */
export interface PageLayoutMovil {
  titulo?: ReactNode
  subtitulo?: ReactNode
  /** Ruta (o acción) de "atrás": en lugar del menú, la barra muestra una flecha. */
  atras?: string | (() => void)
  /** Botones a la derecha de la barra superior. */
  acciones?: ReactNode
  /** Barra inferior del módulo (`MovilBarraInferior`). */
  barraInferior?: ReactNode
  /** Botón flotante o barra de acciones fija (`MovilFab`, etc.). */
  flotante?: ReactNode
  /** Deja más hueco abajo cuando hay botón flotante o barra de acciones. */
  conFlotante?: boolean
}

interface PageLayoutProps {
  title: string
  children: ReactNode
  /** Clases del `<main>` (scroll, padding). */
  mainClassName?: string
  /** Renderizado entre `TopBar` y `<main>` (por ejemplo pestañas). */
  belowTopBar?: ReactNode
  /** Después de `<main>`, dentro de la columna de contenido (p. ej. overlays). */
  afterMain?: ReactNode
  movil?: PageLayoutMovil
}

function BarraMovil({ title, movil }: { title: string; movil?: PageLayoutMovil }) {
  const { toggleSidebar } = useSidebar()
  const navigate = useNavigate()
  const atras = movil?.atras
  return (
    <MovilBarraSuperior
      titulo={movil?.titulo ?? title}
      subtitulo={movil?.subtitulo}
      izquierda={atras ? "atras" : "menu"}
      onIzquierda={atras ? () => (typeof atras === "string" ? navigate(atras) : atras()) : toggleSidebar}
      derecha={movil?.acciones}
    />
  )
}

export function PageLayout({
  title,
  children,
  mainClassName = "flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-8",
  belowTopBar,
  afterMain,
  movil,
}: PageLayoutProps) {
  const hueco = movil?.barraInferior || movil?.flotante
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex h-dvh w-full bg-gray-50 max-md:bg-[#F4F4F5]">
        <Sidebar />

        <div className="flex flex-1 min-w-0 min-h-0">
          <div className="flex flex-1 flex-col min-w-0 min-h-0 overflow-hidden">
            <TopBar title={title} />
            <BarraMovil title={title} movil={movil} />
            {belowTopBar}
            <main className={mainClassName}>
              {children}
              {hueco && <MovilEspaciador conFab={movil?.conFlotante ?? !!movil?.flotante} />}
            </main>
            {afterMain}
            {movil?.barraInferior}
            {movil?.flotante}
          </div>
        </div>
      </div>
    </SidebarProvider>
  )
}
