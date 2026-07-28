import { useMemo, useState } from "react"
import { Search, Plus, Download, Pencil } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { formatCOP, productShortLabel } from "@/lib/libertadoraFormat"
import { LIB_ESTADOS, LIB_PRIORIDADES } from "@/types/libertadora"
import type { LibProspecto } from "@/types/libertadora"

const ESTADO_BADGE: Record<string, string> = {
  CERRADO: "success",
  INTERESADO: "warning",
  EN_PROCESO: "default",
  NO_INTERESADO: "destructive",
  CERRADO_NEG: "outline",
}

const PRIORIDAD_COLOR: Record<string, string> = {
  ALTA: "var(--lib-red)",
  MEDIA: "var(--lib-warn)",
  BAJA: "var(--lib-gray)",
}

interface ProspectosTableProps {
  prospectos: LibProspecto[]
  onNew: () => void
  onEdit: (p: LibProspecto) => void
  onExportCsv: (rows: LibProspecto[]) => void
}

export function ProspectosTable({ prospectos, onNew, onEdit, onExportCsv }: ProspectosTableProps) {
  const [search, setSearch] = useState("")
  const [estadoFiltro, setEstadoFiltro] = useState<string>("all")
  const [prioridadFiltro, setPrioridadFiltro] = useState<string>("all")

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return prospectos.filter((p) => {
      const matchesSearch = !term
        || p.empresa.toLowerCase().includes(term)
        || (p.gestion ?? "").toLowerCase().includes(term)
        || (p.accion ?? "").toLowerCase().includes(term)
      const matchesEstado = estadoFiltro === "all" || p.estado === estadoFiltro
      const matchesPrioridad = prioridadFiltro === "all" || p.prioridad === prioridadFiltro
      return matchesSearch && matchesEstado && matchesPrioridad
    })
  }, [prospectos, search, estadoFiltro, prioridadFiltro])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar empresa, producto, gestión o próxima acción..."
          />
        </div>
        <Select value={estadoFiltro} onValueChange={setEstadoFiltro}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {LIB_ESTADOS.map((e) => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={prioridadFiltro} onValueChange={setPrioridadFiltro}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Prioridad" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las prioridades</SelectItem>
            {LIB_PRIORIDADES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button type="button" style={{ background: "var(--lib-teal)" }} onClick={onNew} className="gap-1.5">
          <Plus className="h-4 w-4" /> Nuevo prospecto
        </Button>
        <Button type="button" variant="outline" onClick={() => onExportCsv(filtered)} className="gap-1.5">
          <Download className="h-4 w-4" /> Exportar CSV
        </Button>
      </div>

      <div className="max-h-[65vh] overflow-auto rounded-lg border border-zinc-200">
        <table className="w-full text-left text-[12.5px]">
          <thead className="sticky top-0" style={{ background: "var(--lib-navy)" }}>
            <tr className="text-white">
              {["#", "Empresa / cliente", "Producto", "Gestión comercial", "Estado", "COP/mes", "Prioridad", "Próxima acción", "Seguimiento", ""].map((h) => (
                <th key={h} className="whitespace-nowrap px-3 py-2 text-[11px] font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, i) => (
              <tr key={p.id} className="border-t border-zinc-100 hover:bg-[color:var(--lib-teal-l)]">
                <td className="px-3 py-2 text-zinc-400">{i + 1}</td>
                <td className="px-3 py-2 font-semibold text-zinc-700">{p.empresa}</td>
                <td className="px-3 py-2 text-zinc-500">{productShortLabel(p.producto)}</td>
                <td className="max-w-[220px] truncate px-3 py-2 text-zinc-500" title={p.gestion ?? ""}>{p.gestion || "—"}</td>
                <td className="px-3 py-2">
                  <Badge variant={(ESTADO_BADGE[p.estado] as "success" | "warning" | "default" | "destructive" | "outline") ?? "default"}>
                    {LIB_ESTADOS.find((e) => e.value === p.estado)?.label ?? p.estado}
                  </Badge>
                </td>
                <td className="px-3 py-2 font-semibold">{formatCOP(p.monto)}</td>
                <td className="px-3 py-2 font-semibold" style={{ color: PRIORIDAD_COLOR[p.prioridad] }}>{p.prioridad}</td>
                <td className="max-w-[180px] truncate px-3 py-2 text-zinc-500" title={p.accion ?? ""}>{p.accion || "—"}</td>
                <td className="px-3 py-2 text-zinc-400">{p.fecha || "—"}</td>
                <td className="px-3 py-2">
                  <Button type="button" size="icon" variant="ghost" onClick={() => onEdit(p)} aria-label={`Editar ${p.empresa}`}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-10 text-center text-sm text-zinc-400">
                  No hay prospectos para los filtros seleccionados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-right text-[11px] text-zinc-400">Mostrando {filtered.length} de {prospectos.length} prospectos</p>
    </div>
  )
}
