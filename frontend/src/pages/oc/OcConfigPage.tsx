import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Mail, ArrowRight } from "lucide-react"
import { PageLayout } from "@/components/layout/PageLayout"
import { api } from "@/lib/api"
import { useRef } from "react"
import { useListasFormulario, useGuardarListas, useUploadClientesExcel } from "@/hooks/useOC"
import type { ListasFormulario } from "@/hooks/useOC"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  useTiposMantenimiento,
  useCrearTipoMantenimiento,
  useToggleTipoMantenimiento,
  useMntNotificacionesConfig,
  useActualizarMntNotificaciones,
  useAuxiliaresPortal,
  useRegenerarPortalAuxiliar,
} from "@/hooks/useMantenimiento"

async function descargarExcelPrueba(): Promise<string> {
  const res = await api.get("/api/oc/config/test/generar-excel", { responseType: "blob" })
  const disposition: string = res.headers["content-disposition"] ?? ""
  const match = disposition.match(/filename="(.+?)"/)
  const filename = match ? match[1] : "prueba.xlsx"
  const url = URL.createObjectURL(res.data as Blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return filename
}

async function descargarParPrueba(): Promise<string> {
  const res = await api.get("/api/oc/config/test/generar-par", { responseType: "blob" })
  const disposition: string = res.headers["content-disposition"] ?? ""
  const match = disposition.match(/filename="(.+?)"/)
  const filename = match ? match[1] : "par-prueba.zip"
  const url = URL.createObjectURL(res.data as Blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return filename
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface OcConfigRead {
  email_directora: string
  email_compras?: string
  email_financiero?: string
  email_gerente?: string
  email_contabilidad?: string
  intranet_url?: string
  // Branding
  empresa_nombre?: string
  empresa_color?: string
  empresa_nit?: string
  empresa_tel?: string
  empresa_dir?: string
  empresa_dept?: string
  // Email templates
  email_prefijo?: string
  email_intro_flujo1?: string
  email_intro_flujo2?: string
  email_intro_flujo3?: string
  email_intro_flujo4?: string
}

interface FormState {
  email_directora: string
  email_compras: string
  email_financiero: string
  email_gerente: string
  email_contabilidad: string
  intranet_url: string
  // Branding
  empresa_nombre: string
  empresa_color: string
  empresa_nit: string
  empresa_tel: string
  empresa_dir: string
  empresa_dept: string
  // Email templates
  email_prefijo: string
  email_intro_flujo1: string
  email_intro_flujo2: string
  email_intro_flujo3: string
  email_intro_flujo4: string
}

interface TestEmailResult {
  ok: boolean
  mensaje: string
  detalle?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchConfig(): Promise<OcConfigRead> {
  const res = await api.get("/api/oc/config")
  return res.data
}

async function saveConfig(payload: Partial<FormState>): Promise<void> {
  await api.patch("/api/oc/config", payload)
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function OcConfigPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState<FormState>({
    email_directora: "",
    email_compras: "",
    email_financiero: "",
    email_gerente: "",
    email_contabilidad: "",
    intranet_url: "",
    empresa_nombre: "",
    empresa_color: "",
    empresa_nit: "",
    empresa_tel: "",
    empresa_dir: "",
    empresa_dept: "",
    email_prefijo: "",
    email_intro_flujo1: "",
    email_intro_flujo2: "",
    email_intro_flujo3: "",
    email_intro_flujo4: "",
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<TestEmailResult | null>(null)
  const [generandoExcel, setGenerandoExcel] = useState(false)
  const [ultimoArchivo, setUltimoArchivo] = useState<string | null>(null)
  const [errorExcel, setErrorExcel] = useState<string | null>(null)
  const [generandoPar, setGenerandoPar] = useState(false)
  const [ultimoPar, setUltimoPar] = useState<string | null>(null)
  const [errorPar, setErrorPar] = useState<string | null>(null)

  const { data: listas } = useListasFormulario()
  const guardarListas = useGuardarListas()
  const uploadClientes = useUploadClientesExcel()
  const [listasForm, setListasForm] = useState<ListasFormulario>({
    prioridades: [],
    categorias: [],
    grupos_articulos: [],
    clientes: [],
    condiciones: [],
    placas: [],
  })
  const [listasGuardadas, setListasGuardadas] = useState(false)

  useEffect(() => {
    if (listas) setListasForm(listas)
  }, [listas])

  useEffect(() => {
    fetchConfig()
      .then((data) => {
        setForm({
          email_directora: data.email_directora,
          email_compras: data.email_compras ?? "",
          email_financiero: data.email_financiero ?? "",
          email_gerente: data.email_gerente ?? "",
          email_contabilidad: data.email_contabilidad ?? "",
          intranet_url: data.intranet_url ?? "",
          empresa_nombre: data.empresa_nombre ?? "",
          empresa_color: data.empresa_color ?? "",
          empresa_nit: data.empresa_nit ?? "",
          empresa_tel: data.empresa_tel ?? "",
          empresa_dir: data.empresa_dir ?? "",
          empresa_dept: data.empresa_dept ?? "",
          email_prefijo: data.email_prefijo ?? "",
          email_intro_flujo1: data.email_intro_flujo1 ?? "",
          email_intro_flujo2: data.email_intro_flujo2 ?? "",
          email_intro_flujo3: data.email_intro_flujo3 ?? "",
          email_intro_flujo4: data.email_intro_flujo4 ?? "",
        })
      })
      .catch(() => setError("No se pudo cargar la configuración."))
      .finally(() => setLoading(false))
  }, [])

  function handleChange(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setSuccess(false)
  }

  async function handleTestEmail() {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await api.post<TestEmailResult>("/api/oc/config/test-email", {})
      setTestResult(res.data)
    } catch {
      setTestResult({
        ok: false,
        mensaje: "Error al contactar el servidor.",
        detalle: "Revisa que el backend esté corriendo y vuelve a intentarlo.",
      })
    } finally {
      setTesting(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(false)

    const payload: Partial<FormState> = {
      email_directora: form.email_directora,
      email_compras: form.email_compras,
      email_financiero: form.email_financiero,
      email_gerente: form.email_gerente,
      email_contabilidad: form.email_contabilidad,
      intranet_url: form.intranet_url,
      empresa_nombre: form.empresa_nombre,
      empresa_color: form.empresa_color,
      empresa_nit: form.empresa_nit,
      empresa_tel: form.empresa_tel,
      empresa_dir: form.empresa_dir,
      empresa_dept: form.empresa_dept,
      email_prefijo: form.email_prefijo,
      email_intro_flujo1: form.email_intro_flujo1,
      email_intro_flujo2: form.email_intro_flujo2,
      email_intro_flujo3: form.email_intro_flujo3,
      email_intro_flujo4: form.email_intro_flujo4,
    }
    try {
      await saveConfig(payload)
      setSuccess(true)
    } catch {
      setError("Error al guardar la configuración. Intente de nuevo.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <PageLayout title="Configuración OC" mainClassName="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto">
            {/* Header */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-foreground">
                Configuración OC
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Ajustes de correo electrónico para el módulo de compras.
                Los valores aquí sobrescriben los del servidor sin necesidad de reiniciarlo.
              </p>
            </div>

            {loading && (
              <div className="text-center py-12 text-muted-foreground">
                Cargando configuración…
              </div>
            )}

            {!loading && (
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* SMTP — ahora centralizado */}
                <section className="bg-card rounded-xl border border-border p-6 space-y-3">
                  <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                    Servidor SMTP
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    El correo de compras ahora usa la cuenta corporativa centralizada — la misma
                    que comparten Tickets y T&C.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate("/admin/configuracion/smtp")}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-muted/5 hover:bg-muted/10 hover:border-primary/30 transition-all text-sm font-medium"
                  >
                    <Mail className="w-4 h-4 text-sky-500" /> Ir a SMTP corporativo
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </section>

                {/* Destinatarios */}
                <section className="bg-card rounded-xl border border-border p-6 space-y-4">
                  <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                    Destinatarios
                  </h2>

                  <Field
                    label="Email directora (aprobaciones)"
                    placeholder="directora@empresa.com"
                    value={form.email_directora}
                    onChange={(v) => handleChange("email_directora", v)}
                    type="email"
                    hint="Recibe el correo de aprobación cuando hay una cotización lista."
                  />
                  <Field
                    label="Email de compras (nuevas solicitudes internas)"
                    placeholder="compras@empresa.com"
                    value={form.email_compras}
                    onChange={(v) => handleChange("email_compras", v)}
                    type="email"
                    hint="Recibe la notificación cuando un coordinador crea una solicitud desde la intranet."
                  />
                  <Field
                    label="Email financiero (OC en plataforma y proformas)"
                    placeholder="financiero@empresa.com"
                    value={form.email_financiero}
                    onChange={(v) => handleChange("email_financiero", v)}
                    type="email"
                    hint="Recibe el correo cuando una OC pasa a 'En plataforma' y cuando se activa anticipo/proforma (Flujos 5 y Proforma)."
                  />
                  <Field
                    label="Email gerente (CC en compras ≥ $2.5M)"
                    placeholder="gerente@empresa.com"
                    value={form.email_gerente}
                    onChange={(v) => handleChange("email_gerente", v)}
                    type="email"
                    hint="Recibe copia del correo de aprobación cuando el valor de la cotización supera $2.500.000 COP (Flujo 3)."
                  />
                  <Field
                    label="Email contabilidad (alertas de OC en plataforma)"
                    placeholder="contabilidad@empresa.com"
                    value={form.email_contabilidad}
                    onChange={(v) => handleChange("email_contabilidad", v)}
                    type="email"
                    hint="Recibe el correo cuando una OC se marca como 'En plataforma' para su gestión contable."
                  />
                  <Field
                    label="URL de la intranet (para links en emails)"
                    placeholder="https://intranet.empresa.com"
                    value={form.intranet_url}
                    onChange={(v) => handleChange("intranet_url", v)}
                    hint="Se usa para generar el link directo a la solicitud en los correos."
                  />
                </section>

                {/* Identidad de la empresa */}
                <section className="bg-card rounded-xl border border-border p-6 space-y-4">
                  <div>
                    <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                      Identidad de la empresa
                    </h2>
                    <p className="text-xs text-muted-foreground mt-1">
                      Branding que aparece en el encabezado y pie de todos los correos.
                      Dejar vacío para usar los valores por defecto de LOGIMAT.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Field
                      label="Nombre de la empresa"
                      placeholder="LOGIMAT S.A.S."
                      value={form.empresa_nombre}
                      onChange={(v) => handleChange("empresa_nombre", v)}
                    />
                    <div>
                      <Label className="mb-1">
                        Color principal (hex)
                      </Label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          className="h-9 w-12 rounded border border-border cursor-pointer p-0.5"
                          value={form.empresa_color || "#C8102E"}
                          onChange={(e) => handleChange("empresa_color", e.target.value)}
                        />
                        <Input
                          type="text"
                          className="flex-1 font-mono"
                          placeholder="#C8102E"
                          value={form.empresa_color}
                          onChange={(e) => handleChange("empresa_color", e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Field
                      label="NIT"
                      placeholder="830.103.877-6"
                      value={form.empresa_nit}
                      onChange={(v) => handleChange("empresa_nit", v)}
                    />
                    <Field
                      label="Teléfono / PBX"
                      placeholder="(1) 7 44 92 00"
                      value={form.empresa_tel}
                      onChange={(v) => handleChange("empresa_tel", v)}
                    />
                  </div>

                  <Field
                    label="Dirección / Ubicación"
                    placeholder="Zona Franca de Bogotá"
                    value={form.empresa_dir}
                    onChange={(v) => handleChange("empresa_dir", v)}
                  />
                  <Field
                    label="Nombre del departamento (subheader del email)"
                    placeholder="Departamento de Compras"
                    value={form.empresa_dept}
                    onChange={(v) => handleChange("empresa_dept", v)}
                  />
                </section>

                {/* Plantillas de correo */}
                <section className="bg-card rounded-xl border border-border p-6 space-y-5">
                  <div>
                    <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                      Plantillas de correo
                    </h2>
                    <p className="text-xs text-muted-foreground mt-1">
                      Personaliza el asunto y el cuerpo de cada flujo. Dejar en blanco usa el texto por defecto.
                      Puedes usar <code className="bg-muted px-1 rounded">{"{solicitante}"}</code> en los flujos 1, 2 y 4 para insertar el nombre del solicitante.
                    </p>
                  </div>

                  <Field
                    label="Prefijo de asunto (aparece al inicio de todos los correos)"
                    placeholder="[Compras LOGIMAT]"
                    value={form.email_prefijo}
                    onChange={(v) => handleChange("email_prefijo", v)}
                    hint='Ejemplo: "[Compras IMC]" · Si se deja vacío se usará "[Compras LOGIMAT]"'
                  />

                  <TextareaField
                    label="Flujo 1 — Intro: Solicitud en gestión (al solicitante)"
                    placeholder="Tu solicitud de compra ha sido recibida y un auxiliar de compras ya está trabajando en ella. Te notificaremos en cuanto tengamos una cotización lista."
                    value={form.email_intro_flujo1}
                    onChange={(v) => handleChange("email_intro_flujo1", v)}
                  />
                  <TextareaField
                    label="Flujo 2 — Intro: Cotización lista (al solicitante)"
                    placeholder="Ya tenemos una cotización lista para tu solicitud. Está en proceso de aprobación por la dirección."
                    value={form.email_intro_flujo2}
                    onChange={(v) => handleChange("email_intro_flujo2", v)}
                  />
                  <TextareaField
                    label="Flujo 3 — Intro: Aprobación requerida (a la directora)"
                    placeholder="Hay una solicitud de compra que requiere tu aprobación:"
                    value={form.email_intro_flujo3}
                    onChange={(v) => handleChange("email_intro_flujo3", v)}
                  />
                  <TextareaField
                    label="Flujo 4 — Intro: OC enviada (al solicitante)"
                    placeholder="La Orden de Compra para tu solicitud ha sido generada y enviada al proveedor."
                    value={form.email_intro_flujo4}
                    onChange={(v) => handleChange("email_intro_flujo4", v)}
                  />
                </section>

                {/* Listas del formulario de solicitud */}
                <section className="bg-card rounded-xl border border-border p-6 space-y-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                        Listas del formulario de solicitud
                      </h2>
                      <p className="text-xs text-muted-foreground mt-1">
                        Opciones que aparecen en los desplegables del formulario de nueva solicitud (módulo Operativo).
                      </p>
                    </div>
                    <Button
                      type="button"
                      disabled={guardarListas.isPending}
                      onClick={() => {
                        guardarListas.mutate(listasForm, {
                          onSuccess: () => setListasGuardadas(true),
                        })
                      }}
                      className="shrink-0"
                    >
                      {guardarListas.isPending ? "Guardando…" : "Guardar listas"}
                    </Button>
                  </div>

                  {listasGuardadas && (
                    <p className="text-xs text-green-600 font-medium">✓ Listas guardadas correctamente.</p>
                  )}

                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <ListaEditor
                      label="Prioridades"
                      items={listasForm.prioridades}
                      onChange={(v) => { setListasForm(prev => ({ ...prev, prioridades: v })); setListasGuardadas(false) }}
                    />
                    <ListaEditor
                      label="Categorías / Estatus"
                      items={listasForm.categorias}
                      onChange={(v) => { setListasForm(prev => ({ ...prev, categorias: v })); setListasGuardadas(false) }}
                    />
                    <ListaEditor
                      label="Grupos de artículos"
                      items={listasForm.grupos_articulos}
                      onChange={(v) => { setListasForm(prev => ({ ...prev, grupos_articulos: v })); setListasGuardadas(false) }}
                    />
                    <ListaEditorBulk
                      label="Clientes"
                      items={listasForm.clientes}
                      onChange={(v) => { setListasForm(prev => ({ ...prev, clientes: v })); setListasGuardadas(false) }}
                      onUploadExcel={(file) => {
                        uploadClientes.mutate(file, {
                          onSuccess: (data) => {
                            setListasForm(data)
                            setListasGuardadas(true)
                          }
                        })
                      }}
                      isUploading={uploadClientes.isPending}
                    />
                    <ListaEditor
                      label="Condiciones"
                      items={listasForm.condiciones}
                      onChange={(v) => { setListasForm(prev => ({ ...prev, condiciones: v })); setListasGuardadas(false) }}
                    />
                    <ListaEditor
                      label="Placas / Equipos (montacargas)"
                      items={listasForm.placas}
                      onChange={(v) => { setListasForm(prev => ({ ...prev, placas: v })); setListasGuardadas(false) }}
                    />
                  </div>
                </section>

                {/* Test SMTP */}
                <section className="bg-card rounded-xl border border-border p-6 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                        Diagnóstico de correo
                      </h2>
                      <p className="text-xs text-muted-foreground mt-1">
                        Envía un correo de prueba al usuario SMTP configurado para verificar
                        que las credenciales funcionan. El error exacto se mostrará aquí.
                      </p>
                    </div>
                    <Button
                      type="button"
                      onClick={handleTestEmail}
                      disabled={testing}
                      variant="outline"
                      className="shrink-0 flex items-center gap-2"
                    >
                      {testing ? (
                        <>
                          <svg className="animate-spin h-4 w-4 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                          </svg>
                          Probando…
                        </>
                      ) : (
                        <>
                          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M3.105 2.288a.75.75 0 0 0-.826.95l1.414 4.926A1.5 1.5 0 0 0 5.135 9.25h6.115a.75.75 0 0 1 0 1.5H5.135a1.5 1.5 0 0 0-1.442 1.086l-1.414 4.926a.75.75 0 0 0 .826.95 28.897 28.897 0 0 0 15.293-7.154.75.75 0 0 0 0-1.115A28.897 28.897 0 0 0 3.105 2.288Z"/>
                          </svg>
                          Enviar correo de prueba
                        </>
                      )}
                    </Button>
                  </div>

                  {testResult && (
                    <div className={`rounded-lg border px-4 py-3 text-sm ${
                      testResult.ok
                        ? "bg-green-50 border-green-200 text-green-800"
                        : "bg-red-50 border-red-200 text-red-800"
                    }`}>
                      <p className="font-semibold flex items-center gap-1.5">
                        {testResult.ok ? "✅" : "❌"} {testResult.mensaje}
                      </p>
                      {testResult.detalle && (
                        <pre className="mt-2 text-xs whitespace-pre-wrap font-mono leading-relaxed opacity-80">
                          {testResult.detalle}
                        </pre>
                      )}
                    </div>
                  )}
                </section>

                {/* Herramientas de prueba del motor */}
                <section className="bg-card rounded-xl border border-border p-6 space-y-5">
                  <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                    Herramientas de prueba del motor
                  </h2>

                  {/* Excel solo */}
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-foreground">Cotización Excel</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Genera un Excel con datos aleatorios y sinónimos del motor.
                        Consecutivo único (<code className="bg-muted px-1 rounded">prueba.001.xlsx</code>…).
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={generandoExcel}
                      onClick={async () => {
                        setGenerandoExcel(true)
                        setUltimoArchivo(null)
                        setErrorExcel(null)
                        try {
                          const nombre = await descargarExcelPrueba()
                          setUltimoArchivo(nombre)
                        } catch (err: any) {
                          setErrorExcel(err?.message ?? "Error al generar el archivo.")
                        } finally {
                          setGenerandoExcel(false)
                        }
                      }}
                      className="shrink-0 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-60 transition-colors"
                    >
                      {generandoExcel ? "Generando…" : "Generar Excel"}
                    </button>
                  </div>
                  {ultimoArchivo && (
                    <p className="text-xs text-green-600 font-medium">
                      ✓ Descargado: <span className="font-mono">{ultimoArchivo}</span>
                    </p>
                  )}
                  {errorExcel && (
                    <p className="text-xs text-red-600 font-medium">✗ {errorExcel}</p>
                  )}

                  <div className="border-t border-border" />

                  {/* Par Cotización + Factura */}
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        Par de prueba: Cotización + Factura PDF
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Descarga un <strong>.zip</strong> con el Excel de cotización y la factura de venta colombiana
                        con los <strong>mismos datos</strong> (NIT, proveedor, totales). Ideal para probar la validación
                        financiera end-to-end. Incluye resolución DIAN, IVA 19%, formato legal colombiano.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={generandoPar}
                      onClick={async () => {
                        setGenerandoPar(true)
                        setUltimoPar(null)
                        setErrorPar(null)
                        try {
                          const nombre = await descargarParPrueba()
                          setUltimoPar(nombre)
                        } catch (err: any) {
                          setErrorPar(err?.message ?? "Error al generar el par.")
                        } finally {
                          setGenerandoPar(false)
                        }
                      }}
                      className="shrink-0 rounded-lg border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-60 transition-colors whitespace-nowrap"
                    >
                      {generandoPar ? "Generando…" : "Generar par (.zip)"}
                    </button>
                  </div>
                  {ultimoPar && (
                    <p className="text-xs text-green-600 font-medium">
                      ✓ Descargado: <span className="font-mono">{ultimoPar}</span> — descomprímelo para obtener el Excel y el PDF.
                    </p>
                  )}
                  {errorPar && (
                    <p className="text-xs text-red-600 font-medium">✗ {errorPar}</p>
                  )}
                </section>

                {/* Tipos de Mantenimiento */}
                <section className="bg-card rounded-xl border border-border p-6 space-y-5">
                  <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                    Tipos de Mantenimiento
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Lista de tipos disponibles al crear una solicitud de mantenimiento.
                  </p>
                  <TiposMantenimientoConfig />
                </section>

                <section className="bg-card rounded-xl border border-border p-6 space-y-5">
                  <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                    WhatsApp — Mantenimiento
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Número por defecto para enviar el link móvil al auxiliar (formato: 573001234567, sin +).
                  </p>
                  <WhatsAppMantenimientoConfig />
                </section>

                <section className="bg-card rounded-xl border border-border p-6 space-y-5">
                  <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                    Portales móviles — Auxiliares
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Cada auxiliar tiene un link permanente (no expira). Regenerar invalida el anterior.
                  </p>
                  <PortalesAuxiliaresConfig />
                </section>

                {/* Feedback guardado */}
                {error && (
                  <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                )}
                {success && (
                  <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
                    ✓ Configuración guardada correctamente.
                  </div>
                )}

                {/* Save */}
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-lg bg-[#003087] px-6 py-2 text-sm font-semibold text-white hover:bg-[#002266] disabled:opacity-60 transition-colors"
                  >
                    {saving ? "Guardando…" : "Guardar cambios"}
                  </button>
                </div>
              </form>
            )}
          </div>
    </PageLayout>
  )
}

// ── Tipos de Mantenimiento sub-componente ─────────────────────────────────────

function TiposMantenimientoConfig() {
  const { data: tipos = [], isLoading } = useTiposMantenimiento(false) // incluir inactivos
  const { mutateAsync: crear, isPending: creando } = useCrearTipoMantenimiento()
  const { mutateAsync: toggle } = useToggleTipoMantenimiento()
  const [nuevoNombre, setNuevoNombre] = useState("")
  const [err, setErr] = useState<string | null>(null)

  async function handleCrear() {
    setErr(null)
    if (!nuevoNombre.trim()) { setErr("El nombre es requerido."); return }
    try {
      await crear({ nombre: nuevoNombre.trim() })
      setNuevoNombre("")
    } catch {
      setErr("Error al crear el tipo.")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          type="text"
          className="flex-1 h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder="Nuevo tipo de mantenimiento..."
          value={nuevoNombre}
          onChange={(e) => setNuevoNombre(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void handleCrear() } }}
        />
        <Button type="button" size="sm" disabled={creando} onClick={() => void handleCrear()}>
          {creando ? "Agregando…" : "Agregar"}
        </Button>
      </div>
      {err && <p className="text-xs text-destructive">{err}</p>}

      {isLoading && <p className="text-sm text-muted-foreground">Cargando...</p>}
      <div className="space-y-2">
        {tipos.map((t) => (
          <div
            key={t.id}
            className={`flex items-center justify-between rounded-lg border px-3 py-2 ${
              t.activo ? "border-border bg-background" : "border-border/40 bg-muted/30 opacity-60"
            }`}
          >
            <span className="text-sm text-foreground">{t.nombre}</span>
            <button
              type="button"
              onClick={() => toggle({ id: t.id, activo: !t.activo })}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {t.activo ? "Desactivar" : "Activar"}
            </button>
          </div>
        ))}
        {tipos.length === 0 && !isLoading && (
          <p className="text-sm text-muted-foreground">No hay tipos configurados aún.</p>
        )}
      </div>
    </div>
  )
}

function WhatsAppMantenimientoConfig() {
  const { data, isLoading } = useMntNotificacionesConfig()
  const { mutateAsync: guardar, isPending: guardando } = useActualizarMntNotificaciones()
  const [numero, setNumero] = useState("")
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  useEffect(() => {
    if (data?.whatsapp_numero_default != null) {
      setNumero(data.whatsapp_numero_default)
    }
  }, [data?.whatsapp_numero_default])

  async function handleGuardar() {
    setErr(null)
    setOk(false)
    const limpio = numero.replace(/\D/g, "")
    if (limpio && limpio.length < 10) {
      setErr("Número inválido — usa formato internacional, ej. 573001234567")
      return
    }
    try {
      await guardar({ whatsapp_numero_default: limpio })
      setOk(true)
      setTimeout(() => setOk(false), 3000)
    } catch {
      setErr("Error al guardar.")
    }
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Cargando…</p>
  }

  return (
    <div className="space-y-3 max-w-md">
      <div>
        <label className="block text-xs text-muted-foreground mb-1">
          Número WhatsApp (E.164 sin +)
        </label>
        <input
          type="text"
          inputMode="numeric"
          className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder="573001234567"
          value={numero}
          onChange={(e) => setNumero(e.target.value)}
        />
      </div>
      <div className="flex items-center gap-3">
        <Button type="button" size="sm" disabled={guardando} onClick={() => void handleGuardar()}>
          {guardando ? "Guardando…" : "Guardar número"}
        </Button>
        {ok && <span className="text-xs text-emerald-600">Guardado</span>}
      </div>
      {err && <p className="text-xs text-destructive">{err}</p>}
    </div>
  )
}

function PortalesAuxiliaresConfig() {
  const { data: portales = [], isLoading } = useAuxiliaresPortal()
  const { mutateAsync: regenerar, isPending } = useRegenerarPortalAuxiliar()
  const [msg, setMsg] = useState<string | null>(null)

  async function handleRegenerar(userId: number) {
    await regenerar(userId)
    setMsg("Portal regenerado")
    setTimeout(() => setMsg(null), 3000)
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Cargando…</p>
  }

  if (portales.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No hay usuarios con rol auxiliar_mantenimiento.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {portales.map((p) => (
        <div
          key={p.user_id}
          className="rounded-lg border border-border px-3 py-3 flex flex-col sm:flex-row sm:items-center gap-3"
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{p.full_name}</p>
            <p className="text-xs text-muted-foreground font-mono truncate">{p.url_portal}</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void navigator.clipboard.writeText(p.url_portal)}
            >
              Copiar
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={isPending}
              onClick={() => void handleRegenerar(p.user_id)}
            >
              Regenerar
            </Button>
          </div>
        </div>
      ))}
      {msg && <p className="text-xs text-emerald-600">{msg}</p>}
    </div>
  )
}

// ── Field helper ──────────────────────────────────────────────────────────────

interface FieldProps {
  label: string
  placeholder?: string
  value: string
  onChange: (v: string) => void
  type?: string
  hint?: string
}

function Field({ label, placeholder, value, onChange, type = "text", hint }: FieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1">
        {label}
      </label>
      <input
        type={type}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

// ── TextareaField ─────────────────────────────────────────────────────────────

interface TextareaFieldProps {
  label: string
  placeholder?: string
  value: string
  onChange: (v: string) => void
  hint?: string
}

function TextareaField({ label, placeholder, value, onChange, hint }: TextareaFieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1">
        {label}
      </label>
      <textarea
        rows={3}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

// ── ListaEditor ───────────────────────────────────────────────────────────────

function ListaEditor({
  label,
  items,
  onChange,
}: {
  label: string
  items: string[]
  onChange: (items: string[]) => void
}) {
  const [input, setInput] = useState("")

  function agregar() {
    const trimmed = input.trim()
    if (!trimmed || items.includes(trimmed)) return
    onChange([...items, trimmed])
    setInput("")
  }

  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-2">{label}</label>
      <div className="flex flex-wrap gap-1.5 mb-2 min-h-[2rem]">
        {items.map((item) => (
          <span
            key={item}
            className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-xs font-medium text-blue-700"
          >
            {item}
            <button
              type="button"
              onClick={() => onChange(items.filter((i) => i !== item))}
              className="text-blue-400 hover:text-blue-700 transition-colors"
            >
              ×
            </button>
          </span>
        ))}
        {items.length === 0 && (
          <span className="text-xs text-muted-foreground italic">Sin opciones — agrega la primera</span>
        )}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); agregar() } }}
          placeholder="Escribe y presiona Enter o Agregar"
          className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="button"
          onClick={agregar}
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted transition-colors"
        >
          Agregar
        </button>
      </div>
    </div>
  )
}

// ── ListaEditorBulk ───────────────────────────────────────────────────────────

function ListaEditorBulk({
  label,
  items,
  onChange,
  onUploadExcel,
  isUploading,
}: {
  label: string
  items: string[]
  onChange: (items: string[]) => void
  onUploadExcel?: (file: File) => void
  isUploading?: boolean
}) {
  const [input, setInput] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setInput(items.join("\n"))
  }, [items])

  function handleBlur() {
    const newItems = input
      .split("\n")
      .map((i) => i.trim())
      .filter(Boolean)
    
    // Solo actualizar si hay cambios reales
    const uniqueItems = Array.from(new Set(newItems))
    if (JSON.stringify(uniqueItems) !== JSON.stringify(items)) {
      onChange(uniqueItems)
    }
  }

  return (
    <div className="sm:col-span-2">
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-medium text-foreground">
          {label} <span className="text-muted-foreground font-normal">({items.length} registrados)</span>
        </label>
        {onUploadExcel && (
          <div className="flex items-center gap-2">
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              ref={fileRef}
              onChange={(e) => {
                if (e.target.files?.[0]) onUploadExcel(e.target.files[0])
                e.target.value = ""
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={isUploading}
              className="flex items-center gap-1.5 rounded-lg border border-primary/20 bg-blue-50 px-3 py-1.5 text-xs font-medium text-primary hover:bg-blue-100 transition-colors disabled:opacity-50"
            >
              {isUploading ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Cargando...
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                  </svg>
                  Cargar desde Excel
                </>
              )}
            </button>
          </div>
        )}
      </div>
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onBlur={handleBlur}
        rows={6}
        placeholder="Un elemento por línea. O carga un Excel y se llenará automáticamente..."
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring font-mono resize-y"
      />
      <p className="text-xs text-muted-foreground mt-1">
        Puedes editar la lista manualmente (un cliente por línea). Haz clic fuera del recuadro para actualizar y luego presiona "Guardar listas" arriba.
      </p>
    </div>
  )
}
