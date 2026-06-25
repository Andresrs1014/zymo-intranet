import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import { useAuthStore } from "@/store/authStore"
import { canEditTyC } from "@/lib/permissions"
import { PageLayout } from "@/components/layout/PageLayout"
import { Save, Phone } from "lucide-react"

interface AreaConfig {
  id?: number
  area_id: number
  area_nombre: string
  lider_nombre: string
  lider_telefono: string
  activa: boolean
}

interface AreaGlobal { id: number; name: string }

export function TyCAreaConfigPage() {
  const user        = useAuthStore((s) => s.user)
  const puedeEditar = user ? canEditTyC(user.role, user.app_permissions) : false

  const [configs, setConfigs]   = useState<AreaConfig[]>([])
  const [areas, setAreas]       = useState<AreaGlobal[]>([])
  const [saving, setSaving]     = useState<number | null>(null)
  const [editMap, setEditMap]   = useState<Record<number, Partial<AreaConfig>>>({})

  useEffect(() => {
    Promise.all([api.get("/tc/area-config"), api.get("/areas")]).then(([c, a]) => {
      setConfigs(c.data)
      setAreas(a.data)
    })
  }, [])

  // Combinar áreas globales con configs existentes
  const rows: AreaConfig[] = areas.map((a) => {
    const cfg = configs.find((c) => c.area_id === a.id)
    return cfg ?? { area_id: a.id, area_nombre: a.name, lider_nombre: "", lider_telefono: "", activa: true }
  })

  function edit(areaId: number, field: keyof AreaConfig, value: string | boolean) {
    setEditMap((prev) => ({
      ...prev,
      [areaId]: { ...(prev[areaId] ?? {}), [field]: value },
    }))
  }

  function getVal(row: AreaConfig, field: keyof AreaConfig) {
    const ov = editMap[row.area_id]
    return ov && field in ov ? ov[field as keyof typeof ov] : row[field]
  }

  async function save(row: AreaConfig) {
    setSaving(row.area_id)
    const changes = editMap[row.area_id] ?? {}
    await api.put("/tc/area-config", {
      area_id:       row.area_id,
      lider_nombre:  (changes.lider_nombre  ?? row.lider_nombre)  as string,
      lider_telefono:(changes.lider_telefono ?? row.lider_telefono) as string,
      activa:        (changes.activa         ?? row.activa)         as boolean,
    })
    const [c] = await Promise.all([api.get("/tc/area-config")])
    setConfigs(c.data)
    setEditMap((prev) => { const n = { ...prev }; delete n[row.area_id]; return n })
    setSaving(null)
  }

  return (
    <PageLayout title="Configuración de áreas — T&C" mainClassName="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-8 py-8">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-teal-500 mb-1">
          Talento y Cultura · Configuración
        </p>
        <h1 className="text-xl font-bold mb-1">Áreas y líderes</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Define el líder y teléfono WhatsApp de cada área. Se usa para notificar automáticamente al agendar un evento.
        </p>

        <div className="space-y-2">
          {rows.map((row) => {
            const dirty = !!editMap[row.area_id]
            return (
              <div
                key={row.area_id}
                className={`rounded-xl border p-4 transition-colors ${dirty ? "border-teal-500/30 bg-teal-500/5" : "border-border bg-muted/5"}`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-36 shrink-0">
                    <p className="text-xs font-semibold">{row.area_nombre}</p>
                  </div>

                  <input
                    value={(getVal(row, "lider_nombre") as string) ?? ""}
                    onChange={(e) => edit(row.area_id, "lider_nombre", e.target.value)}
                    placeholder="Nombre del líder"
                    readOnly={!puedeEditar}
                    className="input-base flex-1 text-xs"
                  />

                  <div className="flex items-center gap-1.5 flex-1">
                    <Phone className="w-3 h-3 text-muted-foreground shrink-0" />
                    <input
                      value={(getVal(row, "lider_telefono") as string) ?? ""}
                      onChange={(e) => edit(row.area_id, "lider_telefono", e.target.value)}
                      placeholder="+57 300 000 0000"
                      readOnly={!puedeEditar}
                      className="input-base flex-1 text-xs"
                    />
                  </div>

                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={(getVal(row, "activa") as boolean) ?? true}
                      onChange={(e) => edit(row.area_id, "activa", e.target.checked)}
                      disabled={!puedeEditar}
                      className="w-3.5 h-3.5 accent-teal-500"
                    />
                    <span className="text-[10px] text-muted-foreground">Activa</span>
                  </label>

                  {puedeEditar && dirty && (
                    <button
                      onClick={() => save(row)}
                      disabled={saving === row.area_id}
                      className="flex items-center gap-1 text-xs text-teal-400 hover:text-teal-300 transition-colors whitespace-nowrap"
                    >
                      <Save className="w-3 h-3" />
                      {saving === row.area_id ? "..." : "Guardar"}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <p className="mt-4 text-[10px] text-muted-foreground">
          El teléfono debe incluir el código de país: <code className="text-teal-400">+57300...</code>
        </p>
      </div>
    </PageLayout>
  )
}
