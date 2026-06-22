import { useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "@/lib/api"
import { PageLayout } from "@/components/layout/PageLayout"
import { ArrowLeft, Upload, CheckCircle, AlertTriangle, Loader2, FileJson } from "lucide-react"

interface ImportItem {
  legacy_id: string
  nombre: string
  initials: string
  documento: string
  company_legacy_id: number
  area_nombre: string
  cargo_nombre: string
  genero: string
  rh: string
  email: string
  email_corporativo: string
  telefono: string
  tipo_contrato: string
  fecha_ingreso: string | null
  antiguedad_label: string
  estado: string
  tipo_salida: string
  fecha_salida: string | null
  idp_active: boolean
  idp_eligible: boolean
}

interface ImportResult {
  created: number
  skipped: number
}

function parseDate(s: string | undefined | null): string | null {
  if (!s?.trim()) return null
  const parts = s.trim().split("/")
  if (parts.length === 3) {
    const y = parseInt(parts[2]), m = parseInt(parts[1]), d = parseInt(parts[0])
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
    }
  }
  return null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPerson(p: any): ImportItem {
  return {
    legacy_id: String(p.id || ""),
    nombre: (p.name || "").trim(),
    initials: (p.initials || "").trim(),
    documento: String(p.document || "").trim(),
    company_legacy_id: typeof p.companyId === "number" ? p.companyId : 0,
    area_nombre: "",  // todas vacías en el export
    cargo_nombre: (p.role || "").trim(),
    genero: (p.gender || "").trim(),
    rh: (p.rh || "").trim(),
    email: (p.email || "").trim(),
    email_corporativo: (p.corporateEmail || "").trim(),
    telefono: String(p.phone || "").trim(),
    tipo_contrato: (p.contract || "Término indefinido").trim(),
    fecha_ingreso: parseDate(p.joined),
    antiguedad_label: "",
    estado: (p.status || "Activo").trim(),
    tipo_salida: (p.exitType || "").trim(),
    fecha_salida: parseDate(p.exitDate),
    idp_active: Boolean(p.idpActive),
    idp_eligible: p.idpEligible !== false,
  }
}

function parseFile(text: string): ImportItem[] {
  // Strip JS comment block and assignment wrapper
  let raw = text.replace(/^\/\*[\s\S]*?\*\/\s*/m, "")
  raw = raw.replace(/^window\.\w+\s*=\s*/, "").trim()
  raw = raw.replace(/;\s*window\.[\s\S]*$/, "").trim()
  const data = JSON.parse(raw)
  const people = data.people ?? (Array.isArray(data) ? data : [])
  return people.map(mapPerson)
}

const EMPRESA_LABEL: Record<number, string> = { 0: "ZYMOLOGI", 1: "ZYMOIMCC", 2: "ZYMOIMDE" }

export function TyCImportPage() {
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)

  const [items, setItems]       = useState<ImportItem[] | null>(null)
  const [parseErr, setParseErr] = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)
  const [result, setResult]     = useState<ImportResult | null>(null)
  const [apiErr, setApiErr]     = useState<string | null>(null)

  function handleFile(file: File) {
    setItems(null)
    setParseErr(null)
    setResult(null)
    setApiErr(null)

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const parsed = parseFile(e.target!.result as string)
        if (parsed.length === 0) throw new Error("El archivo no contiene personas.")
        setItems(parsed)
      } catch (err) {
        setParseErr(err instanceof Error ? err.message : "Error al parsear el archivo.")
      }
    }
    reader.readAsText(file, "utf-8")
  }

  async function handleImport() {
    if (!items) return
    setLoading(true)
    setApiErr(null)
    try {
      const { data } = await api.post<ImportResult>("/tc/import/json", items)
      setResult(data)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setApiErr(msg ?? "Error al importar. Verifica que tengas permiso de importación.")
    } finally {
      setLoading(false)
    }
  }

  const byCompany = items
    ? items.reduce<Record<number, number>>((acc, p) => {
        acc[p.company_legacy_id] = (acc[p.company_legacy_id] ?? 0) + 1
        return acc
      }, {})
    : null

  return (
    <PageLayout title="T&C — Importar colaboradores" mainClassName="flex-1 overflow-y-auto">

      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-border">
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => navigate("/tc")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            T&C
          </button>
          <span className="text-muted-foreground/30 text-xs">/</span>
          <span className="text-sm font-medium">Importar colaboradores</span>
        </div>
        <p className="text-xs text-muted-foreground max-w-lg">
          Carga el archivo JS exportado desde el Directorio ZYMO. El sistema detecta
          automáticamente el formato y mapea las empresas (companyId 0/1/2).
          Los colaboradores ya existentes (mismo legacy_id) se omiten.
        </p>
      </div>

      <div className="px-6 py-6 max-w-xl space-y-5">

        {/* Drop zone */}
        {!result && (
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              const file = e.dataTransfer.files[0]
              if (file) handleFile(file)
            }}
            className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-border/60 rounded-xl py-10 cursor-pointer hover:border-teal-500/40 hover:bg-teal-500/5 transition-all"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted/30">
              <FileJson className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">Arrastra el archivo o haz clic</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                .js (export del Directorio ZYMO) o .json
              </p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".js,.json"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </div>
        )}

        {/* Error de parseo */}
        {parseErr && (
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            {parseErr}
          </div>
        )}

        {/* Preview */}
        {items && !result && (
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="px-4 py-3 bg-muted/10 border-b border-border flex items-center justify-between">
              <p className="text-sm font-medium">{items.length} colaboradores listos para importar</p>
            </div>

            {/* Por empresa */}
            <div className="px-4 py-3 space-y-2">
              {byCompany && Object.entries(byCompany).map(([cId, count]) => {
                const pct = Math.round((count / items.length) * 100)
                return (
                  <div key={cId} className="flex items-center gap-3">
                    <span className="text-[11px] font-mono text-muted-foreground w-20">
                      {EMPRESA_LABEL[Number(cId)] ?? `ID ${cId}`}
                    </span>
                    <div className="flex-1 h-1.5 bg-muted/30 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-teal-500/70 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[11px] tabular-nums text-muted-foreground w-8 text-right">
                      {count}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Sample */}
            <div className="px-4 pb-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Muestra</p>
              <div className="space-y-1">
                {items.slice(0, 3).map((p) => (
                  <div key={p.legacy_id} className="flex items-center gap-2 text-xs">
                    <span className="font-mono w-5 h-5 flex items-center justify-center rounded bg-teal-500/10 text-teal-500 text-[10px] font-bold shrink-0">
                      {p.initials}
                    </span>
                    <span className="font-medium truncate flex-1">{p.nombre}</span>
                    <span className="text-muted-foreground shrink-0">{EMPRESA_LABEL[p.company_legacy_id]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Error de API */}
        {apiErr && (
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            {apiErr}
          </div>
        )}

        {/* Resultado */}
        {result && (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5 space-y-3">
            <div className="flex items-center gap-2.5">
              <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
              <p className="font-semibold text-emerald-500">Importación completada</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-background/50 border border-border p-3 text-center">
                <p className="text-2xl font-bold tabular-nums">{result.created}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Creados</p>
              </div>
              <div className="rounded-lg bg-background/50 border border-border p-3 text-center">
                <p className="text-2xl font-bold tabular-nums text-muted-foreground">{result.skipped}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Omitidos</p>
              </div>
            </div>
            <button
              onClick={() => navigate("/tc/directorio")}
              className="w-full h-9 px-4 text-sm font-medium bg-teal-500/10 text-teal-500 rounded-lg hover:bg-teal-500/20 transition-colors"
            >
              Ver directorio →
            </button>
          </div>
        )}

        {/* Botón de acción */}
        {items && !result && (
          <button
            onClick={handleImport}
            disabled={loading}
            className="flex items-center justify-center gap-2 w-full h-9 px-4 text-sm font-medium bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors disabled:opacity-60"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Importando…</>
            ) : (
              <><Upload className="w-4 h-4" /> Importar {items.length} colaboradores</>
            )}
          </button>
        )}

        {result && (
          <button
            onClick={() => { setItems(null); setResult(null) }}
            className="w-full h-8 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Importar otro archivo
          </button>
        )}

      </div>
    </PageLayout>
  )
}
