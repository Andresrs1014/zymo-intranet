import { useRef, useState, useEffect, useCallback } from "react"
import { formatCOP } from "@/lib/formatters"
import { FormFieldCOP, MoneyInputCOP } from "@/components/forms/FormFieldCOP"
import { useNavigate, useParams } from "react-router-dom"
import { PageLayout } from "@/components/layout/PageLayout"
import {
  useSolicitud,
  useCrearCotizacion,
  useProveedores,
  useExtraerCotizacion,
  useCotizaciones,
  useActualizarProforma,
  useSubirProforma,
} from "@/hooks/useOC"
import type { CotizacionCreatePayload, ExtraccionResult, ItemCotizacion } from "@/hooks/useOC"
import { api } from "@/lib/api"
import { puedeGestionarProformaDesdeOc } from "@/lib/ocProforma"
import { getApiError } from "@/hooks/useUsers"
import { useDraft, useAutosaveDraft, useDeleteDraft } from "@/hooks/useDraft"
import { usePhase2Poll } from "@/hooks/useExtraccionIA"
import type { Phase2Result } from "@/hooks/useExtraccionIA"

const EMPTY_FORM: CotizacionCreatePayload = {
  proveedor_nombre: "",
  proveedor_nit: "",
  proveedor_email: "",
  numero_cotizacion_proveedor: "",
  valor_unitario: 0,
  valor_antes_iva: undefined,
  valor_iva: undefined,
  valor_total: 0,
  fecha_estimada_entrega: "",
  forma_pago: "",
  plazo_entrega: "",
  garantia: "",
  anticipo: "",
  pago_saldo: "",
  observaciones: "",
}

const EMPTY_ITEM: ItemCotizacion = {
  descripcion: "",
  referencia: "",
  cantidad: undefined,
  valor_unitario: undefined,
  valor_total: undefined,
}

type ExtraccionStatus = "idle" | "loading" | "ok" | "warn" | "error"

function calcRowTotal(item: ItemCotizacion): number | undefined {
  if (item.cantidad != null && item.valor_unitario != null) {
    return item.cantidad * item.valor_unitario
  }
  return item.valor_total
}

function sumaItems(items: ItemCotizacion[]): number {
  return items.reduce((acc, item) => {
    const t = calcRowTotal(item)
    return acc + (t ?? 0)
  }, 0)
}

export function CotizacionFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: solicitud, isLoading: loadingSolicitud } = useSolicitud(id)
  const { data: cotizaciones = [] } = useCotizaciones(id)
  const { data: proveedores = [] } = useProveedores()
  const crearCotizacion = useCrearCotizacion()
  const extraerCotizacion = useExtraerCotizacion()
  const actualizarProforma = useActualizarProforma(id ?? "")
  const subirProforma = useSubirProforma(id ?? "")

  const [form, setForm] = useState<CotizacionCreatePayload>(EMPTY_FORM)
  const [items, setItems] = useState<ItemCotizacion[]>([])
  const [error, setError] = useState<string>()
  const [extraccion, setExtraccion] = useState<ExtraccionResult | null>(null)
  const [extStatus, setExtStatus] = useState<ExtraccionStatus>("idle")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [proformaMutationError, setProformaMutationError] = useState<string | null>(null)

  // ── Fase 2 IA ─────────────────────────────────────────────────────────────
  const [phase2Applied, setPhase2Applied] = useState(false)
  const [phase2Pending, setPhase2Pending] = useState(false)
  const [phase2Result, setPhase2Result] = useState<Phase2Result | null>(null)

  // Poll de Fase 2 — activo solo después de subir un archivo
  const { data: phase2Data } = usePhase2Poll(id, phase2Pending)

  // Cuando Fase 2 llega, guardar resultado pero NO aplicar automáticamente
  useEffect(() => {
    if (phase2Data?.phase2_disponible && !phase2Applied) {
      setPhase2Result(phase2Data)
      setPhase2Pending(false)
    }
  }, [phase2Data, phase2Applied])

  // ── Borradores ────────────────────────────────────────────────────────────
  const { data: borrador } = useDraft("cotizacion", id)
  const deleteDraft = useDeleteDraft()
  const [showDraftModal, setShowDraftModal] = useState(false)
  const [draftRestored, setDraftRestored] = useState(false)
  const [formDirty, setFormDirty] = useState(false)

  // Autosave solo si el usuario tocó el formulario o restauró un borrador — evita crear borradores fantasma
  useAutosaveDraft(
    "cotizacion",
    id,
    (draftRestored || formDirty) ? form as unknown as Record<string, unknown> : null
  )

  useEffect(() => {
    if (borrador && !draftRestored) {
      setShowDraftModal(true)
    }
  }, [borrador, draftRestored])

  function restaurarBorrador() {
    if (!borrador?.payload) return
    setForm((prev) => ({ ...prev, ...(borrador.payload as unknown as typeof prev) }))
    setDraftRestored(true)
    setShowDraftModal(false)
  }

  function descartarBorrador() {
    if (id) deleteDraft.mutate({ tipo: "cotizacion", solicitudId: id })
    setShowDraftModal(false)
  }

  const puedeProforma =
    solicitud && puedeGestionarProformaDesdeOc(cotizaciones.length, solicitud.estado)

  const totalItems = sumaItems(items)
  const hayItems = items.length > 0
  // Con ítems: los precios de fila son base sin IVA → total = suma + IVA
  const ivaConItems = form.valor_iva ?? 0
  const valorTotalConItems = totalItems + ivaConItems

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setFormDirty(true)
  }

  function handleProveedorSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const proveedor = proveedores.find((p) => p.id === e.target.value)
    if (proveedor) {
      setForm((prev) => ({
        ...prev,
        proveedor_nombre: proveedor.nombre,
        proveedor_nit: proveedor.nit ?? "",
        proveedor_email: proveedor.email ?? "",
      }))
      setFormDirty(true)
    }
  }

  function aplicarExtraccion(ext: ExtraccionResult) {
    const extItems = ext.items ?? []
    const sumaExtItems = extItems.reduce<number>((acc, it) => acc + (it.valor_total ?? 0), 0)

    // Si el backend extrajo un total global pero no pudo extraer el IVA,
    // lo derivamos aquí como (total_extraído − suma_ítems). Esto funciona
    // para cualquier formato de cotización (con o sin label explícito de IVA).
    let ivaDerivado: number | undefined = ext.valor_iva ?? undefined
    if (
      ivaDerivado == null &&
      extItems.length > 0 &&
      ext.valor_total != null &&
      sumaExtItems > 0
    ) {
      const diff = Math.round((ext.valor_total - sumaExtItems) * 100) / 100
      if (diff > 0 && diff <= sumaExtItems * 0.35) {
        ivaDerivado = diff
      }
    }

    setForm((prev) => ({
      ...prev,
      proveedor_nit: ext.proveedor_nit ?? prev.proveedor_nit,
      proveedor_nombre: ext.proveedor_nombre ?? prev.proveedor_nombre,
      numero_cotizacion_proveedor: ext.numero_cotizacion_proveedor ?? prev.numero_cotizacion_proveedor,
      valor_unitario: ext.valor_unitario ?? prev.valor_unitario,
      valor_antes_iva: ext.valor_antes_iva ?? prev.valor_antes_iva,
      valor_iva: ivaDerivado ?? prev.valor_iva,
      valor_total: ext.valor_total ?? prev.valor_total,
      forma_pago: ext.forma_pago ?? prev.forma_pago,
      plazo_entrega: ext.plazo_entrega ?? prev.plazo_entrega,
      garantia: ext.garantia ?? prev.garantia,
      anticipo: ext.anticipo ?? prev.anticipo,
      pago_saldo: ext.pago_saldo ?? prev.pago_saldo,
    }))
    if (extItems.length) {
      setItems(extItems)
    }
    setFormDirty(true)
  }

  function aplicarFase2() {
    if (!phase2Result) return
    const CAMPOS_MONETARIOS = new Set(["valor_unitario", "valor_antes_iva", "valor_iva", "valor_total"])

    setForm((prev) => {
      const next = { ...prev }
      for (const campo of (phase2Result.phase2_campos_completados as string[])) {
        const valor = phase2Result[campo]
        if (valor != null && (next as Record<string, unknown>)[campo] == null) {
          if (CAMPOS_MONETARIOS.has(campo)) {
            const num = Number(valor)
            if (isFinite(num)) {
              (next as Record<string, unknown>)[campo] = num
            }
          } else {
            (next as Record<string, unknown>)[campo] = String(valor)
          }
        }
      }
      return next
    })
    setPhase2Applied(true)
    setPhase2Result(null)
    setFormDirty(true)
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !id) return

    setPhase2Pending(false)
    setPhase2Result(null)
    setPhase2Applied(false)
    setExtStatus("loading")
    setExtraccion(null)

    extraerCotizacion.mutate(
      { solicitudId: id, file },
      {
        onSuccess: (data) => {
          setExtraccion(data)
          setExtStatus(data.campos_encontrados >= 3 ? "ok" : "warn")
          aplicarExtraccion(data)
          setPhase2Pending(true)
          setPhase2Applied(false)
          setPhase2Result(null)
        },
        onError: () => setExtStatus("error"),
      }
    )
    e.target.value = ""
  }

  // ── Item handlers ─────────────────────────────────────────────────────────

  function handleAddItem() {
    setItems((prev) => [...prev, { ...EMPTY_ITEM }])
  }

  function handleRemoveItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  function handleItemChange(index: number, field: keyof ItemCotizacion, raw: string) {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item
        if (field === "cantidad") {
          const qty = raw === "" ? undefined : Number(raw)
          const updated = { ...item, cantidad: qty }
          if (qty != null && item.valor_unitario != null) {
            updated.valor_total = qty * item.valor_unitario
          }
          return updated
        }
        return { ...item, [field]: raw }
      })
    )
  }

  function handleItemValorUnitario(index: number, unit: number | undefined) {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item
        const updated = { ...item, valor_unitario: unit }
        if (item.cantidad != null && unit != null) {
          updated.valor_total = item.cantidad * unit
        }
        return updated
      })
    )
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  // Guard síncrono para evitar doble envío por clics rápidos antes del re-render
  const submitInFlight = useRef(false)

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()

    if (submitInFlight.current || crearCotizacion.isPending) return
    submitInFlight.current = true
    setError(undefined)

    if (!form.proveedor_nombre.trim()) {
      submitInFlight.current = false
      setError("El nombre del proveedor es requerido.")
      return
    }

    const valorTotal = hayItems ? valorTotalConItems : form.valor_total
    if (!valorTotal || valorTotal <= 0) {
      submitInFlight.current = false
      setError("El valor total debe ser mayor a 0.")
      return
    }

    if (hayItems) {
      const sinDescripcion = items.some((it) => !it.descripcion.trim())
      if (sinDescripcion) {
        submitInFlight.current = false
        setError("Todos los ítems deben tener descripción.")
        return
      }
    }

    const payload: CotizacionCreatePayload = {
      ...form,
      valor_total: valorTotal,
      // Con ítems, la suma de filas es siempre el subtotal antes de IVA
      valor_antes_iva: hayItems ? totalItems : form.valor_antes_iva,
      proveedor_nit: form.proveedor_nit || undefined,
      proveedor_email: form.proveedor_email || undefined,
      numero_cotizacion_proveedor: form.numero_cotizacion_proveedor || undefined,
      fecha_estimada_entrega: form.fecha_estimada_entrega || undefined,
      forma_pago: form.forma_pago || undefined,
      plazo_entrega: form.plazo_entrega || undefined,
      garantia: form.garantia || undefined,
      anticipo: form.anticipo || undefined,
      pago_saldo: form.pago_saldo || undefined,
      observaciones: form.observaciones || undefined,
      items: hayItems ? items.map((it, i) => ({ ...it, num: it.num ?? i + 1 })) : undefined,
    }

    crearCotizacion.mutate(
      { solicitudId: id!, payload },
      {
        onSuccess: () => {
          submitInFlight.current = false
          if (id) deleteDraft.mutate({ tipo: "cotizacion", solicitudId: id })
          navigate(`/oc/solicitudes/${id}`)
        },
        onError: (err: any) => {
          submitInFlight.current = false
          setError(err?.response?.data?.detail ?? "Error al guardar la cotización.")
        },
      }
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, items, hayItems, valorTotalConItems, totalItems, id, crearCotizacion, deleteDraft, navigate])

  if (loadingSolicitud) {
    return (
      <PageLayout title="OC Automatizaciones" mainClassName="flex-1 flex items-center justify-center overflow-hidden text-muted-foreground text-sm">
        Cargando...
      </PageLayout>
    )
  }

  return (
    <>
      {showDraftModal && borrador && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-card rounded-2xl shadow-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-lg font-bold text-foreground mb-2">Borrador guardado</h2>
            <p className="text-sm text-muted-foreground mb-1">
              Tienes un borrador de cotización guardado del{" "}
              <span className="font-medium text-foreground">
                {new Date(borrador.updated_at).toLocaleDateString("es-CO", {
                  day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
                })}
              </span>
            </p>
            <p className="text-sm text-muted-foreground mb-5">¿Deseas continuar donde lo dejaste?</p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={descartarBorrador}
                className="px-4 py-2 rounded-lg text-sm text-foreground border border-border hover:bg-muted"
              >
                Descartar
              </button>
              <button
                type="button"
                onClick={restaurarBorrador}
                className="px-4 py-2 rounded-lg text-sm bg-[#003087] text-white hover:bg-[#002266] font-medium"
              >
                Continuar borrador
              </button>
            </div>
          </div>
        </div>
      )}

      <PageLayout title="OC Automatizaciones">
          <button
            onClick={() => navigate(`/oc/solicitudes/${id}`)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
          >
            ← Volver al detalle
          </button>

          <div className="mb-6">
            <h1 className="text-xl font-bold text-foreground">Cargar Cotización</h1>
            {solicitud && (
              <p className="text-sm text-muted-foreground mt-0.5">
                <span className="font-mono text-primary font-semibold">
                  {solicitud.consecutivo_os}
                </span>{" "}
                — {solicitud.descripcion}
              </p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="max-w-3xl space-y-5">

            {/* ── Extracción automática ─────────────────────────────────────── */}
            <div className="bg-card rounded-xl border border-border shadow-sm p-5">
              <h2 className="text-sm font-semibold text-foreground mb-3">
                Extracción automática
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  (PDF, Excel o Word del proveedor)
                </span>
              </h2>

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.xlsx,.xls,.docx"
                onChange={handleFileChange}
                className="hidden"
              />

              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragOver(false)
                  const file = e.dataTransfer.files[0]
                  if (file && extStatus !== "loading") {
                    const synth = { target: { files: [file], value: "" } } as any
                    handleFileChange(synth)
                  }
                }}
                onClick={() => extStatus !== "loading" && fileInputRef.current?.click()}
                className={`w-full rounded-lg border-2 border-dashed py-6 flex flex-col items-center gap-2 cursor-pointer transition-all ${
                  extStatus === "loading"
                    ? "border-border opacity-50 cursor-not-allowed"
                    : dragOver
                    ? "border-primary bg-primary/5 text-primary/70"
                    : "border-border text-muted-foreground hover:border-primary/40 hover:text-primary/70 hover:bg-primary/5"
                }`}
              >
                {extStatus === "loading" ? (
                  <>
                    <span className="text-xl">⏳</span>
                    <span className="text-sm">Analizando documento...</span>
                  </>
                ) : (
                  <>
                    <span className="text-2xl">📎</span>
                    <span className="text-sm font-medium">
                      {dragOver ? "Suelta aquí el archivo" : "Arrastra el archivo aquí o haz clic para seleccionar"}
                    </span>
                    <span className="text-xs">PDF, Excel (.xlsx) o Word (.docx)</span>
                  </>
                )}
              </div>

              {extraccion && extStatus !== "idle" && (
                <div className={`mt-3 rounded-lg p-4 border text-sm ${
                  extStatus === "ok"
                    ? "bg-green-50 border-green-200"
                    : "bg-amber-50 border-amber-200"
                }`}>
                  <div className={`font-semibold mb-2 ${extStatus === "ok" ? "text-green-700" : "text-amber-700"}`}>
                    {extStatus === "ok"
                      ? `✓ Extracción exitosa — ${extraccion.campos_encontrados} campos encontrados`
                      : `⚠ Extracción parcial — ${extraccion.campos_encontrados} campos encontrados`}
                    <span className="font-normal ml-2 text-xs opacity-70">{extraccion.nombre_archivo}</span>
                    {extraccion.items?.length > 0 && (
                      <span className="ml-2 text-xs bg-indigo-100 text-indigo-700 rounded px-1.5 py-0.5 font-medium">
                        {extraccion.items.length} ítems detectados
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <ExtraidoItem label="NIT" value={extraccion.proveedor_nit} />
                    <ExtraidoItem label="Proveedor" value={extraccion.proveedor_nombre} />
                    <ExtraidoItem label="N° cotización" value={extraccion.numero_cotizacion_proveedor} />
                    <ExtraidoItem label="Valor unitario" value={extraccion.valor_unitario} money />
                    <ExtraidoItem label="Subtotal (antes IVA)" value={extraccion.valor_antes_iva} money />
                    <ExtraidoItem label="IVA" value={extraccion.valor_iva} money />
                    <ExtraidoItem label="Valor total" value={extraccion.valor_total} money />
                    <ExtraidoItem label="Forma de pago" value={extraccion.forma_pago} />
                    <ExtraidoItem label="Plazo de entrega" value={extraccion.plazo_entrega} />
                    <ExtraidoItem label="Garantía" value={extraccion.garantia} />
                    <ExtraidoItem label="Anticipo" value={extraccion.anticipo} />
                    <ExtraidoItem label="Pago saldo" value={extraccion.pago_saldo} />
                  </div>
                  {extStatus === "warn" && (
                    <p className="text-amber-600 text-xs mt-2">
                      Revisa y completa los campos no encontrados manualmente.
                    </p>
                  )}
                </div>
              )}

              {extStatus === "error" && (
                <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
                  No se pudo leer el archivo. Verifica que sea un PDF de texto (no escaneado), Excel o Word válido.
                </div>
              )}

              {/* Banner Fase 2 — aparece cuando Gemini completó campos adicionales */}
              {phase2Result && !phase2Applied && (
                <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 text-sm">
                  <div className="flex items-center gap-2 text-blue-700">
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z" clipRule="evenodd"/>
                    </svg>
                    <span>
                      IA completó{" "}
                      <strong>{phase2Result.phase2_campos_count as number} campo{(phase2Result.phase2_campos_count as number) !== 1 ? "s" : ""}</strong>
                      {" "}adicional{(phase2Result.phase2_campos_count as number) !== 1 ? "es" : ""} que el motor no encontró.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={aplicarFase2}
                    className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
                  >
                    Aplicar campos
                  </button>
                </div>
              )}

              {/* Indicador mientras Gemini procesa en background */}
              {phase2Pending && (
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground py-1">
                  <svg className="animate-spin h-3.5 w-3.5 text-primary" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  IA analizando el documento en segundo plano…
                </div>
              )}
            </div>

            {/* ── Anticipo / proforma (misma gestión que en el detalle) ───────────────── */}
            {puedeProforma && solicitud && (
              <div
                className={`rounded-xl border px-5 py-4 space-y-3 ${
                  solicitud.tiene_proforma ? "border-yellow-300 bg-yellow-50/80" : "border-border bg-card"
                }`}
              >
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <svg
                    className={`w-4 h-4 ${solicitud.tiene_proforma ? "text-yellow-600" : "text-muted-foreground"}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z"
                    />
                  </svg>
                  Anticipo / proforma
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    (se enviará junto al flujo de aprobación si aplica)
                  </span>
                </h2>
                <p className="text-xs text-foreground/70">
                  Active si el proveedor cobra anticipo o envió proforma. Luego puede adjuntar el PDF/documento antes de{' '}
                  <strong className="text-foreground">Enviar a aprobación</strong>.
                </p>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-semibold ${solicitud.tiene_proforma ? "text-yellow-800" : "text-muted-foreground"}`}>
                      {solicitud.tiene_proforma ? "Indicador activado" : "Sin anticipo/proforma marcado"}
                    </span>
                    {solicitud.tiene_proforma && (
                      <span className="rounded-full bg-yellow-200 px-2 py-0.5 text-[10px] font-bold text-yellow-800 uppercase">
                        Activo
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setProformaMutationError(null)
                      actualizarProforma.mutate(!solicitud.tiene_proforma, {
                        onSuccess: () => setProformaMutationError(null),
                        onError: (err) => setProformaMutationError(getApiError(err)),
                      })
                    }}
                    disabled={actualizarProforma.isPending}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
                      solicitud.tiene_proforma
                        ? "border-yellow-400 bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
                        : "border-border bg-card text-foreground hover:bg-muted"
                    }`}
                  >
                    {actualizarProforma.isPending
                      ? "Guardando..."
                      : solicitud.tiene_proforma
                        ? "Desactivar"
                        : "Marcar anticipo / proforma"}
                  </button>
                </div>
                {solicitud.tiene_proforma && (
                  <div className="flex flex-col gap-2 pt-3 border-t border-yellow-200/70">
                    <div className="flex flex-wrap items-center gap-3">
                      {solicitud.proforma_path ? (
                        <button
                          type="button"
                          onClick={async () => {
                            setProformaMutationError(null)
                            try {
                              const resp = await api.get(`/api/oc/solicitudes/${solicitud.id}/proforma/descargar`, {
                                responseType: "blob",
                              })
                              const url = URL.createObjectURL(resp.data as Blob)
                              window.open(url, "_blank")
                              setTimeout(() => URL.revokeObjectURL(url), 60_000)
                            } catch (err) {
                              setProformaMutationError(getApiError(err))
                            }
                          }}
                          className="text-xs font-medium text-yellow-700 underline hover:text-yellow-900"
                        >
                          Ver archivo de proforma
                        </button>
                      ) : (
                        <span className="text-xs text-yellow-700 italic">Aún sin archivo adjunto</span>
                      )}
                      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-yellow-300 bg-card px-3 py-1.5 text-xs font-semibold text-yellow-800 hover:bg-yellow-50 disabled:opacity-50">
                        {subirProforma.isPending ? "Subiendo…" : solicitud.proforma_path ? "Reemplazar archivo" : "Adjuntar proforma"}
                        <input
                          type="file"
                          className="hidden"
                          accept=".pdf,.xlsx,.xls,.docx,.jpg,.jpeg,.png,.msg"
                          disabled={subirProforma.isPending}
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (!file) return
                            if (file.size > 20 * 1024 * 1024) { setProformaMutationError("El archivo supera el límite de 20 MB."); e.target.value = ""; return }
                            setProformaMutationError(null)
                            subirProforma.mutate(file, {
                              onSuccess: () => setProformaMutationError(null),
                              onError: (err) => setProformaMutationError(getApiError(err)),
                            })
                            e.target.value = ""
                          }}
                        />
                      </label>
                    </div>
                    {proformaMutationError && (
                      <p className="text-xs text-red-600" role="alert">
                        {proformaMutationError}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Catálogo de proveedores ───────────────────────────────────── */}
            {proveedores.length > 0 && (
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                <label className="block text-sm font-medium text-primary mb-2">
                  Seleccionar del catálogo de proveedores (opcional)
                </label>
                <select
                  onChange={handleProveedorSelect}
                  defaultValue=""
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">— Elegir proveedor existente —</option>
                  {proveedores.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} {p.nit ? `(NIT: ${p.nit})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* ── Datos del proveedor ───────────────────────────────────────── */}
            <div className="bg-card rounded-xl border border-border shadow-sm p-5 space-y-4">
              <h2 className="text-sm font-semibold text-foreground">Datos del proveedor</h2>

              <Field label="Nombre del proveedor *">
                <input
                  name="proveedor_nombre"
                  value={form.proveedor_nombre}
                  onChange={handleChange}
                  placeholder="Empresa S.A.S."
                  className={inputCls}
                  required
                />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="NIT del proveedor">
                  <input
                    name="proveedor_nit"
                    value={form.proveedor_nit ?? ""}
                    onChange={handleChange}
                    placeholder="900.123.456-7"
                    className={inputCls}
                  />
                </Field>
                <Field label="N° cotización">
                  <input
                    name="numero_cotizacion_proveedor"
                    value={form.numero_cotizacion_proveedor ?? ""}
                    onChange={handleChange}
                    placeholder="COT-2026-001"
                    className={inputCls}
                  />
                </Field>
              </div>

              <Field label="Email del proveedor">
                <input
                  name="proveedor_email"
                  type="email"
                  value={form.proveedor_email ?? ""}
                  onChange={handleChange}
                  placeholder="ventas@proveedor.com"
                  className={inputCls}
                />
              </Field>
            </div>

            {/* ── Ítems de la cotización ────────────────────────────────────── */}
            <div className="bg-card rounded-xl border border-border shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Ítems de la cotización</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {hayItems
                      ? `${items.length} ítem${items.length !== 1 ? "s" : ""} — el total se calcula automáticamente`
                      : "Opcional — para cotizaciones con múltiples productos"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-200 px-3 py-1.5 text-xs font-medium hover:bg-indigo-100 transition-colors"
                >
                  + Agregar ítem
                </button>
              </div>

              {!hayItems ? (
                <div className="text-center py-8 text-muted-foreground/50 text-xs border-2 border-dashed border-border rounded-lg">
                  Sin ítems — el valor total se ingresa manualmente abajo
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="text-muted-foreground border-b border-border text-left">
                        <th className="py-2 pr-2 w-8 font-medium">#</th>
                        <th className="py-2 pr-2 font-medium">Descripción *</th>
                        <th className="py-2 pr-2 w-28 font-medium">Referencia</th>
                        <th className="py-2 pr-2 w-20 font-medium">Cant.</th>
                        <th className="py-2 pr-2 w-28 font-medium">V. Unit.</th>
                        <th className="py-2 pr-2 w-28 font-medium text-right">V. Total</th>
                        <th className="py-2 w-8" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {items.map((item, i) => {
                        const rowTotal = calcRowTotal(item)
                        return (
                          <tr key={i} className="group hover:bg-muted/50">
                            <td className="py-1.5 pr-2 text-muted-foreground font-mono">{i + 1}</td>
                            <td className="py-1.5 pr-2">
                              <input
                                value={item.descripcion}
                                onChange={(e) => handleItemChange(i, "descripcion", e.target.value)}
                                placeholder="Descripción del producto"
                                className={itemInputCls}
                              />
                            </td>
                            <td className="py-1.5 pr-2">
                              <input
                                value={item.referencia ?? ""}
                                onChange={(e) => handleItemChange(i, "referencia", e.target.value)}
                                placeholder="Ref."
                                className={itemInputCls}
                              />
                            </td>
                            <td className="py-1.5 pr-2">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={item.cantidad ?? ""}
                                onChange={(e) => handleItemChange(i, "cantidad", e.target.value)}
                                placeholder="0"
                                className={`${itemInputCls} text-right`}
                              />
                            </td>
                            <td className="py-1.5 pr-2">
                              <MoneyInputCOP
                                value={item.valor_unitario}
                                onChange={(v) => handleItemValorUnitario(i, v)}
                                placeholder="0"
                                className={`${itemInputCls} text-right`}
                              />
                            </td>
                            <td className="py-1.5 pr-2 text-right font-mono text-foreground">
                              {rowTotal != null
                                ? `$${rowTotal.toLocaleString("es-CO", { minimumFractionDigits: 0 })}`
                                : <span className="text-muted-foreground/40">—</span>}
                            </td>
                            <td className="py-1.5">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(i)}
                                className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 text-sm transition-opacity w-6 h-6 flex items-center justify-center rounded"
                                title="Eliminar fila"
                              >
                                ×
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-border">
                        <td colSpan={5} className="py-2 text-right text-xs font-semibold text-foreground pr-2">
                          Total {items.length} ítem{items.length !== 1 ? "s" : ""}:
                        </td>
                        <td className="py-2 pr-2 text-right font-mono font-bold text-foreground text-sm">
                          ${totalItems.toLocaleString("es-CO", { minimumFractionDigits: 0 })}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* ── Valores ──────────────────────────────────────────────────── */}
            <div className="bg-card rounded-xl border border-border shadow-sm p-5 space-y-4">
              <h2 className="text-sm font-semibold text-foreground">Valores</h2>

              {hayItems ? (
                /* Con ítems: subtotal = suma de filas, total = subtotal + IVA */
                <div className="space-y-3">
                  <div className="rounded-lg bg-indigo-50 border border-indigo-200 px-4 py-3 text-xs text-indigo-700 space-y-1">
                    <div className="flex justify-between">
                      <span>Subtotal ({items.length} ítem{items.length !== 1 ? "s" : ""}):</span>
                      <span className="font-bold">
                        ${totalItems.toLocaleString("es-CO", { minimumFractionDigits: 0 })}
                      </span>
                    </div>
                    {ivaConItems > 0 && (
                      <div className="flex justify-between text-orange-600">
                        <span>+ IVA:</span>
                        <span className="font-bold">
                          ${ivaConItems.toLocaleString("es-CO", { minimumFractionDigits: 0 })}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-indigo-200 pt-1 text-sm font-semibold text-indigo-900">
                      <span>Total a pagar:</span>
                      <span>
                        ${valorTotalConItems.toLocaleString("es-CO", { minimumFractionDigits: 0 })}
                      </span>
                    </div>
                  </div>
                  <Field label="IVA (si aplica)">
                    <MoneyInputCOP
                      value={form.valor_iva}
                      onChange={(v) => setForm((prev) => ({ ...prev, valor_iva: v }))}
                      placeholder="0"
                      className={inputCls}
                    />
                  </Field>
                </div>
              ) : (
                /* Sin ítems: campos manuales con auto-cálculo */
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormFieldCOP
                      label="Valor unitario"
                      value={form.valor_unitario || undefined}
                      onChange={(v) => setForm((prev) => ({ ...prev, valor_unitario: v ?? 0 }))}
                      inputClassName={inputCls}
                    />
                    <FormFieldCOP
                      label="Subtotal (antes de IVA)"
                      value={form.valor_antes_iva}
                      onChange={(v) => {
                        setForm((prev) => {
                          const next = { ...prev, valor_antes_iva: v }
                          if (v != null && prev.valor_iva != null) {
                            next.valor_total = Math.round((v + prev.valor_iva) * 100) / 100
                          }
                          return next
                        })
                      }}
                      inputClassName={inputCls}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormFieldCOP
                      label="IVA"
                      value={form.valor_iva}
                      onChange={(v) => {
                        setForm((prev) => {
                          const next = { ...prev, valor_iva: v }
                          if (prev.valor_antes_iva != null && v != null) {
                            next.valor_total =
                              Math.round((prev.valor_antes_iva + v) * 100) / 100
                          }
                          return next
                        })
                      }}
                      inputClassName={inputCls}
                    />
                    <FormFieldCOP
                      label="Valor total *"
                      value={form.valor_total || undefined}
                      onChange={(v) => {
                        setForm((prev) => {
                          const next = { ...prev, valor_total: v ?? 0 }
                          if (v != null && prev.valor_iva != null) {
                            next.valor_antes_iva =
                              Math.round((v - prev.valor_iva) * 100) / 100
                          }
                          return next
                        })
                      }}
                      inputClassName={inputCls}
                    />
                  </div>
                  {/* Indicador de consistencia */}
                  {form.valor_antes_iva != null && form.valor_iva != null && form.valor_total > 0 && (
                    (() => {
                      const esperado = Math.round((form.valor_antes_iva + form.valor_iva) * 100) / 100
                      const diff = Math.abs(esperado - form.valor_total)
                      return diff > 1 ? (
                        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                          ⚠ Subtotal + IVA = {esperado.toLocaleString("es-CO")} — no coincide con el total ingresado ({form.valor_total.toLocaleString("es-CO")})
                        </p>
                      ) : (
                        <p className="text-xs text-green-600">✓ Subtotal + IVA coinciden con el total</p>
                      )
                    })()
                  )}
                </div>
              )}

              <Field label="Fecha estimada de entrega">
                <input
                  name="fecha_estimada_entrega"
                  type="date"
                  value={form.fecha_estimada_entrega ?? ""}
                  onChange={handleChange}
                  className={inputCls}
                />
              </Field>
            </div>

            {/* ── Condiciones ───────────────────────────────────────────────── */}
            <div className="bg-card rounded-xl border border-border shadow-sm p-5 space-y-4">
              <h2 className="text-sm font-semibold text-foreground">Condiciones</h2>

              <Field label="Forma de pago">
                <input
                  name="forma_pago"
                  value={form.forma_pago ?? ""}
                  onChange={handleChange}
                  placeholder="Ej: Crédito 30 días, Contado..."
                  className={inputCls}
                />
              </Field>

              <Field label="Plazo de entrega">
                <input
                  name="plazo_entrega"
                  value={form.plazo_entrega ?? ""}
                  onChange={handleChange}
                  placeholder="Ej: 5 días hábiles"
                  className={inputCls}
                />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Anticipo">
                  <input
                    name="anticipo"
                    value={form.anticipo ?? ""}
                    onChange={handleChange}
                    placeholder="Ej: 50%"
                    className={inputCls}
                  />
                </Field>
                <Field label="Pago de saldo">
                  <input
                    name="pago_saldo"
                    value={form.pago_saldo ?? ""}
                    onChange={handleChange}
                    placeholder="Ej: Contra entrega"
                    className={inputCls}
                  />
                </Field>
              </div>

              <Field label="Garantía">
                <input
                  name="garantia"
                  value={form.garantia ?? ""}
                  onChange={handleChange}
                  placeholder="Ej: 1 año de garantía en defectos de fabricación"
                  className={inputCls}
                />
              </Field>

              <Field label="Observaciones adicionales">
                <textarea
                  name="observaciones"
                  value={form.observaciones ?? ""}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Garantías, condiciones especiales, etc."
                  className={`${inputCls} resize-none`}
                />
              </Field>
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={crearCotizacion.isPending}
                className="rounded-lg bg-brand-blue px-6 py-2.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {crearCotizacion.isPending ? "Guardando..." : "Enviar a aprobación"}
              </button>
              <button
                type="button"
                onClick={() => navigate(`/oc/solicitudes/${id}`)}
                className="rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
      </PageLayout>
    </>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/50"

const itemInputCls =
  "w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground placeholder-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring/50"

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function ExtraidoItem({
  label,
  value,
  money,
}: {
  label: string
  value: string | number | null | undefined
  money?: boolean
}) {
  const found = value !== null && value !== undefined
  const display = found
    ? money
      ? formatCOP(Number(value))
      : String(value)
    : "No encontrado"

  return (
    <div className={`flex gap-1 ${found ? "text-foreground" : "text-muted-foreground"}`}>
      <span className="font-medium shrink-0">{label}:</span>
      <span className="truncate">{display}</span>
    </div>
  )
}
