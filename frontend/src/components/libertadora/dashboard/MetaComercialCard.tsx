import { useEffect, useState } from "react"
import { Target } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AnimatedCircularProgressBar } from "@/components/ui/animated-circular-progress-bar"
import { useLibMeta, useUpdateLibMeta } from "@/hooks/useLibertadora"
import type { LibKpis, LibMeta } from "@/types/libertadora"

type MetaField = "metaMensual" | "metaAnual" | "metaCierres" | "metaCitas"

function MetaInput({
  label, field, value, onCommit,
}: { label: string; field: MetaField; value: number | null; onCommit: (field: MetaField, value: number) => void }) {
  const [draft, setDraft] = useState(value != null ? String(value) : "")
  useEffect(() => setDraft(value != null ? String(value) : ""), [value])

  return (
    <div className="flex flex-col gap-1">
      <Label className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">{label}</Label>
      <Input
        type="number"
        min={0}
        value={draft}
        placeholder="Sin definir"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const parsed = Number(draft)
          if (Number.isFinite(parsed) && parsed >= 0) onCommit(field, parsed)
        }}
      />
    </div>
  )
}

export function MetaComercialCard({ kpis }: { kpis: LibKpis }) {
  const { data: meta } = useLibMeta()
  const updateMeta = useUpdateLibMeta()

  function commit(field: MetaField, value: number) {
    updateMeta.mutate({ [field]: value } as Partial<LibMeta>)
  }

  // Ported 1:1 de updateGoal(): proyección anual = monto cerrado x 12 vs. meta anual.
  const metaAnual = meta?.metaAnual ?? 0
  const proyeccionAnual = kpis.mo * 12
  const pct = metaAnual > 0 ? Math.min(100, Math.round((proyeccionAnual / metaAnual) * 100)) : 0

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-bold text-zinc-800">
          <Target className="h-4 w-4" style={{ color: "var(--lib-teal)" }} />
          Meta comercial 2026
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6 sm:grid-cols-[1fr_auto]">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <MetaInput label="Meta mensual COP" field="metaMensual" value={meta?.metaMensual ?? null} onCommit={commit} />
          <MetaInput label="Meta anual COP" field="metaAnual" value={meta?.metaAnual ?? null} onCommit={commit} />
          <MetaInput label="Meta cierres / mes" field="metaCierres" value={meta?.metaCierres ?? null} onCommit={commit} />
          <MetaInput label="Meta citas / semana" field="metaCitas" value={meta?.metaCitas ?? null} onCommit={commit} />
        </div>
        {metaAnual > 0 && (
          <div className="flex flex-col items-center justify-center gap-1">
            <AnimatedCircularProgressBar
              value={pct}
              gaugePrimaryColor="var(--lib-teal)"
              gaugeSecondaryColor="var(--lib-teal-l)"
              className="size-24 text-base"
            />
            <p className="text-center text-[10.5px] text-zinc-400">Avance proyección anual<br />(mensual × 12)</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
