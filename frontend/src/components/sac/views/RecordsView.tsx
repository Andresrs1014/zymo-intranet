import { useState } from "react"
import { Search } from "lucide-react"
import { useSacDashboard } from "@/hooks/useSac"
import { useSacUI } from "@/context/SacContext"
import { Combobox } from "@/components/ui/Combobox"
import type { RecordGroup, SacRecord } from "@/types/sac"

const TYPE_OPTIONS = [
  { value: "client", label: "Fidelización de clientes" },
  { value: "commercial", label: "Diseñando la Experiencia" },
  { value: "visit", label: "Reporte de visita" },
]

const STATUS_OPTIONS = [
  { value: "risk", label: "En riesgo" },
  { value: "positive", label: "Positivo" },
  { value: "followup", label: "Requiere seguimiento" },
]

const GROUP_BADGE: Record<RecordGroup, string> = {
  client: "bg-zinc-100 text-zinc-700",
  commercial: "bg-blue-50 text-blue-700",
  visit: "bg-amber-50 text-amber-700",
}

function recordContact(r: SacRecord): string {
  const rec = r as unknown as Record<string, unknown>
  return String(rec.company ?? rec.client ?? rec.contact ?? "—")
}

function recordResult(r: SacRecord): string {
  const rec = r as unknown as Record<string, unknown>
  if (r.recordGroup === "client") return `NPS ${rec.nps ?? "—"} · ${rec.npsCategory ?? ""}`
  if (r.recordGroup === "commercial") return String(rec.fit ?? "—")
  return String(rec.outcome ?? "—")
}

const FILTER_LABEL = "mb-1.5 block text-[11px] font-bold uppercase tracking-[0.06em] text-zinc-500"

export function RecordsView() {
  const [type, setType] = useState<RecordGroup | "">("")
  const [status, setStatus] = useState<"" | "risk" | "positive" | "followup">("")
  const [search, setSearch] = useState("")
  const { data, isLoading } = useSacDashboard({
    type: type || undefined,
    status: status || undefined,
    search: search || undefined,
  })
  const { setOpenRecord } = useSacUI()

  return (
    <div>
      <div className="mb-4 rounded-lg border border-zinc-200 bg-white p-4">
        <h3 className="mb-3 text-[11px] font-bold uppercase tracking-[0.06em] text-zinc-500">Filtros</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div>
            <label className={FILTER_LABEL}>Tipo</label>
            <Combobox
              options={TYPE_OPTIONS}
              value={type || null}
              onChange={(v) => setType((v as RecordGroup) || "")}
              placeholder="Todos"
            />
          </div>
          <div>
            <label className={FILTER_LABEL}>Estado</label>
            <Combobox
              options={STATUS_OPTIONS}
              value={status || null}
              onChange={(v) => setStatus((v as typeof status) || "")}
              placeholder="Todos"
            />
          </div>
        </div>
        <div className="mt-3 border-t border-zinc-100 pt-3">
          <label className={FILTER_LABEL}>Buscar</label>
          <div className="relative max-w-md">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Empresa, contacto, observaciones…"
              className="h-10 w-full rounded-md border border-zinc-300 bg-white pl-9 pr-3 text-sm text-zinc-900 outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
            />
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-[11px] font-bold uppercase tracking-[0.06em] text-zinc-500">
            <tr>
              <th className="px-4 py-2.5">Tipo</th>
              <th className="px-4 py-2.5">Fecha</th>
              <th className="px-4 py-2.5">Cliente / contacto</th>
              <th className="px-4 py-2.5">Resultado</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-zinc-400">Cargando…</td></tr>
            )}
            {!isLoading && (data?.records.length ?? 0) === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-zinc-400">Sin registros para estos filtros.</td></tr>
            )}
            {data?.records.map((r) => (
              <tr
                key={`${r.recordGroup}-${r.id}`}
                onClick={() => setOpenRecord(r)}
                className="cursor-pointer border-b border-zinc-100 last:border-0 hover:bg-zinc-50"
              >
                <td className="px-4 py-2.5">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${GROUP_BADGE[r.recordGroup]}`}>
                    {r.recordType}
                  </span>
                </td>
                <td className="px-4 py-2.5 font-mono text-[12px] text-zinc-700">{r.date}</td>
                <td className="px-4 py-2.5">{recordContact(r)}</td>
                <td className="px-4 py-2.5">{recordResult(r)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
