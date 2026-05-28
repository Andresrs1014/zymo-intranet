import { useState } from "react"
import { PageLayout } from "@/components/layout/PageLayout"
import {
  useTiposGasto,
  useCrearTipoGasto,
  useEliminarTipoGasto,
  useCuentasContables,
  useCrearCuenta,
  useActualizarCuenta,
  useEliminarCuenta,
} from "@/hooks/useFinanciero"
import { Combobox } from "@/components/ui/Combobox"
import type { CuentaContable } from "@/types/financiero"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function FinancieroConfigPage() {
  return (
    <PageLayout title="Financiero — Configuración" mainClassName="flex-1 overflow-y-auto px-6 py-8 space-y-8">
          <TiposGastoSection />
          <CuentasContablesSection />
    </PageLayout>
  )
}

// ── Tipos de Gasto ────────────────────────────────────────────────────────────

function TiposGastoSection() {
  const { data: tipos = [], isLoading } = useTiposGasto()
  const crear = useCrearTipoGasto()
  const eliminar = useEliminarTipoGasto()
  const [nuevo, setNuevo] = useState("")

  function handleCrear() {
    const nombre = nuevo.trim()
    if (!nombre) return
    crear.mutate(nombre, { onSuccess: () => setNuevo("") })
  }

  return (
    <section className="bg-card rounded-xl border border-border shadow-sm p-6">
      <h2 className="text-sm font-bold text-foreground uppercase tracking-wide mb-4">
        Tipos de Gasto
      </h2>

      <div className="flex gap-2 mb-4">
        <Input
          type="text"
          value={nuevo}
          onChange={(e) => setNuevo(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCrear()}
          placeholder="Nombre del tipo de gasto"
          className="flex-1"
        />
        <Button
          onClick={handleCrear}
          disabled={crear.isPending || !nuevo.trim()}
        >
          Agregar
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : tipos.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay tipos de gasto configurados.</p>
      ) : (
        <ul className="divide-y divide-border">
          {tipos.map((t) => (
            <li key={t.id} className="flex items-center justify-between py-2.5 text-sm">
              <span className="text-foreground">{t.nombre}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (!confirm(`¿Eliminar tipo de gasto "${t.nombre}"?`)) return
                  eliminar.mutate(t.id)
                }}
                className="text-xs text-red-500 hover:text-red-700"
              >
                Eliminar
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// ── Cuentas Contables ─────────────────────────────────────────────────────────

function CuentasContablesSection() {
  const { data: cuentas = [], isLoading } = useCuentasContables(false)
  const { data: tipos = [] } = useTiposGasto()
  const crear = useCrearCuenta()
  const actualizar = useActualizarCuenta()
  const eliminar = useEliminarCuenta()

  const [form, setForm] = useState({ numero_cuenta: "", nombre_cuenta: "", tipo_gasto_id: null as number | null })
  const [editando, setEditando] = useState<CuentaContable | null>(null)

  const tiposOpciones = tipos.map((t) => ({ value: t.id, label: t.nombre }))

  function handleCrear() {
    if (!form.numero_cuenta.trim() || !form.nombre_cuenta.trim()) return
    crear.mutate(
      { ...form, tipo_gasto_id: form.tipo_gasto_id ?? undefined },
      { onSuccess: () => setForm({ numero_cuenta: "", nombre_cuenta: "", tipo_gasto_id: null }) }
    )
  }

  function handleToggleActivo(cuenta: CuentaContable) {
    actualizar.mutate({ id: cuenta.id, activo: !cuenta.activo })
  }

  function handleEditarTipo(cuenta: CuentaContable, tipoId: number | null) {
    actualizar.mutate({ id: cuenta.id, tipo_gasto_id: tipoId })
    setEditando(null)
  }

  return (
    <section className="bg-card rounded-xl border border-border shadow-sm p-6">
      <h2 className="text-sm font-bold text-foreground uppercase tracking-wide mb-4">
        Cuentas Contables
      </h2>

      {/* Formulario nueva cuenta */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 mb-4">
        <Input
          type="text"
          value={form.numero_cuenta}
          onChange={(e) => setForm((p) => ({ ...p, numero_cuenta: e.target.value }))}
          placeholder="No. cuenta (ej: 5105)"
        />
        <Input
          type="text"
          value={form.nombre_cuenta}
          onChange={(e) => setForm((p) => ({ ...p, nombre_cuenta: e.target.value }))}
          placeholder="Nombre de la cuenta"
        />
        <div className="flex gap-2">
          <Combobox
            className="flex-1"
            options={tiposOpciones}
            value={form.tipo_gasto_id}
            onChange={(v) => setForm((p) => ({ ...p, tipo_gasto_id: v as number | null }))}
            placeholder="Tipo de gasto"
          />
          <Button
            onClick={handleCrear}
            disabled={crear.isPending || !form.numero_cuenta.trim() || !form.nombre_cuenta.trim()}
            className="shrink-0"
          >
            Agregar
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : cuentas.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay cuentas contables configuradas.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs font-medium text-muted-foreground uppercase border-b border-border">
                <th className="pb-2 text-left pr-4">No. Cuenta</th>
                <th className="pb-2 text-left pr-4">Nombre</th>
                <th className="pb-2 text-left pr-4">Tipo de Gasto</th>
                <th className="pb-2 text-center">Activa</th>
                <th className="pb-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {cuentas.map((c) => (
                <tr key={c.id} className={c.activo ? "" : "opacity-50"}>
                  <td className="py-2.5 pr-4 font-mono text-xs text-muted-foreground">{c.numero_cuenta}</td>
                  <td className="py-2.5 pr-4 text-foreground">{c.nombre_cuenta}</td>
                  <td className="py-2.5 pr-4">
                    {editando?.id === c.id ? (
                      <Combobox
                        className="w-48"
                        options={tiposOpciones}
                        value={c.tipo_gasto_id}
                        onChange={(v) => handleEditarTipo(c, v as number | null)}
                        placeholder="Seleccionar tipo"
                      />
                    ) : (
                      <button
                        onClick={() => setEditando(c)}
                        className="text-muted-foreground hover:text-brand-blue transition-colors"
                        title="Cambiar tipo de gasto"
                      >
                        {c.tipo_gasto_nombre ?? <span className="text-border">—</span>}
                      </button>
                    )}
                  </td>
                  <td className="py-2.5 text-center">
                    <button
                      onClick={() => handleToggleActivo(c)}
                      className={`w-8 h-4 rounded-full transition-colors ${c.activo ? "bg-brand-blue" : "bg-border"}`}
                      title={c.activo ? "Desactivar" : "Activar"}
                    >
                      <span
                        className={`block w-3 h-3 rounded-full bg-white shadow transition-transform mx-0.5 ${c.activo ? "translate-x-4" : "translate-x-0"}`}
                      />
                    </button>
                  </td>
                  <td className="py-2.5 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (!confirm(`¿Eliminar la cuenta "${c.numero_cuenta} — ${c.nombre_cuenta}"?`)) return
                        eliminar.mutate(c.id)
                      }}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Eliminar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
