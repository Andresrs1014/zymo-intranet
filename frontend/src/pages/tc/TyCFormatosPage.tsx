import { PageLayout } from "@/components/layout/PageLayout"
import { FileText } from "lucide-react"

export function TyCFormatosPage() {
  return (
    <PageLayout title="Formatos digitales" mainClassName="flex-1 overflow-y-auto">
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 py-24 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-500/10 text-teal-400">
          <FileText className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-lg font-bold">Formatos digitales</h1>
          <p className="text-sm text-muted-foreground mt-1">Estamos trabajando en los formatos.</p>
        </div>
      </div>
    </PageLayout>
  )
}
