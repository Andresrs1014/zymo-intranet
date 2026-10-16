import "./organizacion.css"
import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { Pencil, Trash2 } from "lucide-react"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"
import { PageLayout } from "@/components/layout/PageLayout"
import { RailOrganizacion } from "@/components/admin/org/RailOrganizacion"
import { AreaUsuarios } from "@/components/admin/org/AreaUsuarios"
import { TodasPersonas } from "@/components/admin/org/TodasPersonas"
import { AreaAcceso } from "@/components/admin/org/AreaAcceso"
import { CarpetaSig } from "@/components/admin/org/CarpetaSig"
import { useAreas, useDeleteArea, useUpdateArea, type AreaItem } from "@/hooks/useAreas"
import { getApiError } from "@/hooks/useRoles"
import { useUsers } from "@/hooks/useUsers"
import { useUsuariosArea } from "@/hooks/useAreaAcceso"

type Pestana = "usuarios" | "acceso"

/** Áreas, sedes, usuarios y acceso a aplicaciones en un solo lugar: el área manda. */
export function OrganizacionPage() {
  const [params, setParams] = useSearchParams()
  const { data: areas = [], isLoading } = useAreas()
  const { data: usuarios = [] } = useUsers()

  const pedida = Number(params.get("area")) || null
  // «Todas las personas» es la vista principal; un área solo se abre si se pide (?area=ID)
  const area = areas.find((a) => a.id === pedida) ?? null
  const pestana: Pestana = params.get("tab") === "acceso" ? "acceso" : "usuarios"

  const conteo = useMemo(() => {
    const c: Record<string, number> = {}
    for (const u of usuarios) if (u.area) c[u.area] = (c[u.area] ?? 0) + 1
    return c
  }, [usuarios])
  const nombresAreas = useMemo(() => Object.fromEntries(areas.map((a) => [a.id, a.name])), [areas])

  const ir = (cambios: Record<string, string>) => {
    const n = new URLSearchParams(params)
    for (const [k, v] of Object.entries(cambios)) n.set(k, v)
    setParams(n, { replace: true })
  }

  return (
    <PageLayout title="Organización" mainClassName="org-root flex min-h-0 flex-1 overflow-hidden bg-white">
      <RailOrganizacion areas={areas} conteo={conteo} total={usuarios.length} activa={area?.id ?? null} onElegir={(id) => ir({ area: String(id) })} onTodas={() => ir({ area: "todas" })} />
      <div className="min-w-0 flex-1 overflow-y-auto">
        {isLoading && <p className="p-10 font-mono text-[12px] text-org-tinta/40">Cargando áreas…</p>}
        {!area && <TodasPersonas areas={areas} onVerArea={(id) => ir({ area: String(id), tab: "usuarios" })} />}
        {area && (
          <div key={area.id} className="mx-auto max-w-5xl px-6 pb-16 pt-8 sm:px-10">
            <EncabezadoArea area={area} pestana={pestana} onPestana={(t) => ir({ tab: t })} />
            <div className="pt-6">
              {pestana === "usuarios"
                ? <AreaUsuarios areaId={area.id} areaNombre={area.name} />
                : <AreaAcceso areaId={area.id} nombresAreas={nombresAreas} />}
            </div>
          </div>
        )}
      </div>
      <style>{`
        @keyframes org-in { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }
        @media (prefers-reduced-motion: reduce) { * { animation-duration: .01ms !important; animation-delay: 0ms !important; transition-duration: .01ms !important } }
      `}</style>
    </PageLayout>
  )
}

function EncabezadoArea({ area, pestana, onPestana }: { area: AreaItem; pestana: Pestana; onPestana: (t: Pestana) => void }) {
  const { data: usuarios = [] } = useUsuariosArea(area.id)
  const renombrar = useUpdateArea()
  const borrar = useDeleteArea()
  const [editando, setEditando] = useState(false)
  const [nombre, setNombre] = useState(area.name)
  const [error, setError] = useState<string>()
  useEffect(() => { setNombre(area.name); setEditando(false); setError(undefined) }, [area.id, area.name])

  async function guardarNombre() {
    const n = nombre.trim()
    if (!n || n === area.name) { setEditando(false); return }
    setError(undefined)
    try { await renombrar.mutateAsync({ id: area.id, name: n }); setEditando(false) } catch (err) { setError(getApiError(err)) }
  }

  async function eliminar() {
    let aviso = `¿Eliminar el área «${area.name}»?`
    try {
      const { data } = await api.get<{ directorio: unknown[]; cuentas: unknown[] }>(`/areas/${area.id}/en-uso`)
      if (data.directorio.length || data.cuentas.length) aviso += `\n\nLa usan ${data.directorio.length} persona(s) del directorio y ${data.cuentas.length} cuenta(s).`
    } catch { /* si falla la consulta, se confirma con el texto básico */ }
    if (!window.confirm(aviso)) return
    setError(undefined)
    try { await borrar.mutateAsync(area.id) } catch (err) { setError(getApiError(err)) }
  }

  return (
    <header>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-org-vivo">Área</p>
          {editando ? (
            <input
              autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} onBlur={guardarNombre}
              onKeyDown={(e) => { if (e.key === "Enter") guardarNombre(); if (e.key === "Escape") setEditando(false) }}
              aria-label="Nombre del área"
              className="mt-1 w-full max-w-md border-b-2 border-org-vivo bg-transparent text-3xl font-semibold tracking-tight text-org-tinta focus:outline-none focus-visible:ring-2 focus-visible:ring-org-vivo/30 rounded-sm"
            />
          ) : (
            <h2 className="mt-1 truncate text-3xl font-semibold tracking-tight text-org-tinta">{area.name}</h2>
          )}
          <p className="mt-2 font-mono text-[12px] text-org-tinta/55">
            <span className="text-org-rojo">{usuarios.length}</span> personas · <span className="text-org-rojo">{usuarios.filter((u) => u.permisos.length > 0).length}</span> con permisos asignados
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <button type="button" onClick={() => setEditando(true)} aria-label="Renombrar el área" className="rounded-lg p-2 text-org-tinta/40 transition-colors hover:bg-org-tinte hover:text-org-rojo"><Pencil className="h-4 w-4" aria-hidden /></button>
          <button type="button" onClick={eliminar} aria-label="Eliminar el área" className="rounded-lg p-2 text-org-tinta/40 transition-colors hover:bg-org-tinte hover:text-org-rojo"><Trash2 className="h-4 w-4" aria-hidden /></button>
        </div>
      </div>
      <CarpetaSig areaId={area.id} />
      {error && <p role="alert" className="mt-3 rounded-lg border border-org-linea bg-org-tinte px-3 py-2 text-[12px] text-org-rojo">{error}</p>}
      <div role="tablist" aria-label="Contenido del área" className="mt-6 flex gap-6 border-b border-org-linea">
        {([["usuarios", "Personas"], ["acceso", "Aplicaciones"]] as const).map(([t, texto]) => (
          <button
            key={t} role="tab" aria-selected={pestana === t} type="button" onClick={() => onPestana(t)}
            className={cn(
              "-mb-px border-b-2 pb-3 text-[14px] transition-colors",
              pestana === t ? "border-org-rojo font-semibold text-org-rojo" : "border-transparent text-org-tinta/55 hover:text-org-tinta",
            )}
          >
            {texto}
          </button>
        ))}
      </div>
    </header>
  )
}
