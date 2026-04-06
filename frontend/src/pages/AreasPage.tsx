import { Sidebar } from "@/components/layout/Sidebar"
import { TopBar } from "@/components/layout/TopBar"

export function AreasPage() {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar title="Áreas y Sedes" />
        <main className="flex-1 overflow-auto p-6">
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <p className="text-4xl mb-4">🏢</p>
              <h2 className="text-xl font-semibold text-gray-700 mb-2">Áreas y Sedes</h2>
              <p className="text-gray-500">Próximamente: administra las áreas y sedes de la organización.</p>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
