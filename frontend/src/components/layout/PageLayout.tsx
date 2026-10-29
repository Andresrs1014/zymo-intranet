import { Sidebar } from "@/components/layout/Sidebar"
import { TopBar } from "@/components/layout/TopBar"
import { SidebarProvider } from "@/components/ui/sidebar"

interface PageLayoutProps {
  title: string
  children: React.ReactNode
  /** Clases del `<main>` (scroll, padding). */
  mainClassName?: string
  /** Renderizado entre `TopBar` y `<main>` (por ejemplo pestañas). */
  belowTopBar?: React.ReactNode
  /** Después de `<main>`, dentro de la columna de contenido (p. ej. overlays). */
  afterMain?: React.ReactNode
}

export function PageLayout({
  title,
  children,
  mainClassName = "flex-1 overflow-y-auto px-6 py-8",
  belowTopBar,
  afterMain,
}: PageLayoutProps) {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex h-screen w-full bg-gray-50">
        <Sidebar />

        <div className="flex flex-1 min-w-0 min-h-0">
          <div className="flex flex-1 flex-col min-w-0 min-h-0 overflow-hidden">
            <TopBar title={title} />
            {belowTopBar}
            <main className={mainClassName}>{children}</main>
            {afterMain}
          </div>
        </div>
      </div>
    </SidebarProvider>
  )
}
