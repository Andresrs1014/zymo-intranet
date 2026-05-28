import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"

export function DesarrolloInnovacionTab() {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-4">
        <svg className="w-6 h-6 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M6 2a1 1 0 0 0-1 1v1H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-1V3a1 1 0 1 0-2 0v1H7V3a1 1 0 0 0-1-1Zm0 5a1 1 0 0 0 0 2h8a1 1 0 1 0 0-2H6Zm0 4a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2H6Z" clipRule="evenodd" />
        </svg>
      </div>
      <h3 className="text-base font-semibold text-foreground mb-2">
        Gestión de Tareas — nueva herramienta
      </h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">
        El registro y seguimiento de tareas de Desarrollo e Innovación se ha trasladado
        a la nueva herramienta transversal con mejores capacidades de seguimiento.
      </p>
      <Button
        onClick={() => navigate("/herramientas/tareas")}
        variant="default"
        className="bg-gray-950 hover:bg-gray-800"
      >
        Ir a Gestión de Tareas →
      </Button>
    </div>
  )
}
