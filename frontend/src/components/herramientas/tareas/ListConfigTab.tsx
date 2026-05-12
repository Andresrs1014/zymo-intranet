import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ESTADOS, ETIQUETAS, PLATAFORMAS } from "@/types/workTask"
import { ESTADO_LABELS, ETIQUETA_LABELS, PLATAFORMA_LABELS } from "@/lib/taskTheme"
import { taskCard } from "@/lib/taskTheme"

export function ListConfigTab() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Configuración de listas</h2>
        <p className="text-xs text-muted-foreground">Solo lectura</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Estados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {ESTADOS.map((item) => (
              <span key={item} className="px-3 py-1 rounded-full bg-gray-100 text-sm border border-gray-200">
                {ESTADO_LABELS[item] ?? item}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Etiquetas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {ETIQUETAS.map((item) => (
              <span key={item} className="px-3 py-1 rounded-full bg-gray-100 text-sm border border-gray-200">
                {ETIQUETA_LABELS[item] ?? item}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Plataformas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {PLATAFORMAS.map((item) => (
              <span key={item} className="px-3 py-1 rounded-full bg-gray-100 text-sm border border-gray-200">
                {PLATAFORMA_LABELS[item] ?? item}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}