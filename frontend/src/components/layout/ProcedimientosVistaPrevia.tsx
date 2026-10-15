import { useQuery } from "@tanstack/react-query"
import { FileText } from "lucide-react"

import { sigApi } from "@/lib/sigApi"
import { CuadroVistaPrevia, hace, type FilaPrevia } from "./CuadroVistaPrevia"

interface Procedimiento {
  id: number
  codigo: string
  titulo: string
  estado: string
  updatedAt: string
  area: { nombre: string; color: string | null }
  _count?: { commits: number }
}

/** Vista previa del SIG en el inicio: los procedimientos a los que la persona tiene acceso (los de su área si es líder). */
export function ProcedimientosVistaPrevia({ base }: { base: "/sig" | "/sig-area" }) {
  const { data, isLoading, isError } = useQuery<Procedimiento[]>({
    queryKey: ["sig", "procedimientos", "todos"],
    queryFn: async () => {
      const r = (await sigApi.get("/api/procedimientos")).data
      if (!Array.isArray(r)) throw new Error("respuesta inesperada")
      return r
    },
    staleTime: 5 * 60_000,
  })
  const filas = [...(data ?? [])]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .map((p): FilaPrevia => ({
      key: String(p.id),
      chip: { texto: p.estado === "VIGENTE" ? "Vigente" : p.estado.toLowerCase(), clase: p.estado === "VIGENTE" ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-600" },
      texto: `${p.codigo} · ${p.titulo}`,
      datos: [["Área", p.area.nombre], ["Versiones", p._count ? String(p._count.commits) : null], ["Actualizado", hace(p.updatedAt)]],
      aparte: p.codigo,
      to: `${base}?proc=${p.id}&codigo=${encodeURIComponent(p.codigo)}&titulo=${encodeURIComponent(p.titulo)}&areaNombre=${encodeURIComponent(p.area.nombre)}&areaColor=${encodeURIComponent(p.area.color ?? "")}`,
    }))
  return (
    <div className="grid gap-3">
      <CuadroVistaPrevia
        titulo={base === "/sig-area" ? "Procedimientos de tu área" : "Procedimientos"}
        icon={<FileText className="size-4" aria-hidden="true" />}
        total={isLoading ? undefined : filas.length}
        filas={filas}
        cargando={isLoading}
        error={isError}
        vacio="Aún no hay procedimientos cargados."
        amplio
        verTodo={base}
      />
    </div>
  )
}
