import type { ReactNode } from "react"
import { PageLayout } from "@/components/layout/PageLayout"
import { LibertadoraProvider } from "@/context/LibertadoraContext"
import { LibertadoraHeader } from "./LibertadoraHeader"
import { LibertadoraTabsBar } from "./LibertadoraTabsBar"
import "@/styles/libertadora.css"

export function LibertadoraShell({ children }: { children: ReactNode }) {
  return (
    <LibertadoraProvider>
      <PageLayout
        title="Libertadora Seguros · CRM Skandia CREA"
        belowTopBar={<><LibertadoraHeader /><LibertadoraTabsBar /></>}
      >
        <div className="libertadora-scope">{children}</div>
      </PageLayout>
    </LibertadoraProvider>
  )
}
