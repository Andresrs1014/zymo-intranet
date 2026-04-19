import { useState, useEffect } from "react"
import { Sidebar } from "@/components/layout/Sidebar"
import { TopBar } from "@/components/layout/TopBar"
import { api } from "@/lib/api"
import { useListasFormulario, useGuardarListas } from "@/hooks/useOC"
import type { ListasFormulario } from "@/hooks/useOC"

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

// ── Types ─────────────────────────────────────────────────────────────────────

interface OcConfigRead {
  smtp_host: string
  smtp_port: string
  smtp_user: string
  smtp_password_set: boolean
  smtp_from: string
  email_directora: string
  email_compras?: string
  intranet_url?: string
}

interface FormState {
  smtp_host: string
  smtp_port: string
  smtp_user: string
  smtp_password: string
  smtp_from: string
  email_directora: string
  email_compras: string
  intranet_url: string
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
  const [config, setConfig] = useState<OcConfigRead | null>(null)
  const [form, setForm] = useState<FormState>({
    smtp_host: "",
    smtp_port: "",
    smtp_user: "",
    smtp_password: "",
    smtp_from: "",
    email_directora: "",
    email_compras: "",
    intranet_url: "",
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

  const { data: listas } = useListasFormulario()
  const guardarListas = useGuardarListas()
  const [listasForm, setListasForm] = useState<ListasFormulario>({
    prioridades: [],
    categorias: [],
    grupos_articulos: [],
    clientes: [],
    condiciones: [],
  })
  const [listasGuardadas, setListasGuardadas] = useState(false)

  useEffect(() => {
    if (listas) setListasForm(listas)
  }, [listas])

  useEffect(() => {
    fetchConfig()
      .then((data) => {
        setConfig(data)
        setForm({
          smtp_host: data.smtp_host,
          smtp_port: data.smtp_port,
          smtp_user: data.smtp_user,
          smtp_password: "",
          smtp_from: data.smtp_from,
          email_directora: data.email_directora,
          email_compras: data.email_compras ?? "",
          intranet_url: data.intranet_url ?? "",
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

    // Only send password if user typed something
    const payload: Partial<FormState> = {
      smtp_host: form.smtp_host,
      smtp_port: form.smtp_port,
      smtp_user: form.smtp_user,
      smtp_from: form.smtp_from,
      email_directora: form.email_directora,
      email_compras: form.email_compras,
      intranet_url: form.intranet_url,
    }
    if (form.smtp_password.trim()) {
      payload.smtp_password = form.smtp_password
    }

    try {
      await saveConfig(payload)
      setSuccess(true)
      // Refresh so smtp_password_set reflects reality
      const updated = await fetchConfig()
      setConfig(updated)
      setForm((prev) => ({ ...prev, smtp_password: "" }))
    } catch {
      setError("Error al guardar la configuración. Intente de nuevo.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto">
            {/* Header */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900">
                Configuración OC
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Ajustes de correo electrónico para el módulo de compras.
                Los valores aquí sobrescriben los del servidor sin necesidad de reiniciarlo.
              </p>
            </div>

            {loading && (
              <div className="text-center py-12 text-gray-400">
                Cargando configuración…
              </div>
            )}

            {!loading && (
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* SMTP */}
                <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
                  <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                    Servidor SMTP
                  </h2>

                  <div className="grid grid-cols-2 gap-4">
                    <Field
                      label="Host SMTP"
                      placeholder="smtp.office365.com"
                      value={form.smtp_host}
                      onChange={(v) => handleChange("smtp_host", v)}
                    />
                    <Field
                      label="Puerto"
                      placeholder="587"
                      value={form.smtp_port}
                      onChange={(v) => handleChange("smtp_port", v)}
                      type="number"
                    />
                  </div>

                  <Field
                    label="Usuario (email remitente)"
                    placeholder="compras@empresa.com"
                    value={form.smtp_user}
                    onChange={(v) => handleChange("smtp_user", v)}
                    type="email"
                  />

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Contraseña
                    </label>
                    <input
                      type="password"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Dejar en blanco para no cambiar"
                      value={form.smtp_password}
                      onChange={(e) => handleChange("smtp_password", e.target.value)}
                      autoComplete="new-password"
                    />
                    <p className="mt-1 text-xs text-gray-400">
                      {config?.smtp_password_set
                        ? "✓ Contraseña configurada — solo escribe si quieres cambiarla"
                        : "⚠ Sin contraseña configurada"}
                    </p>
                  </div>

                  <Field
                    label='Nombre "De" (smtp_from)'
                    placeholder="compras@empresa.com"
                    value={form.smtp_from}
                    onChange={(v) => handleChange("smtp_from", v)}
                    hint="Si se deja vacío, se usa el usuario SMTP como remitente."
                  />
                </section>

                {/* Destinatarios */}
                <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
                  <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
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
                    label="URL de la intranet (para links en emails)"
                    placeholder="https://intranet.empresa.com"
                    value={form.intranet_url}
                    onChange={(v) => handleChange("intranet_url", v)}
                    hint="Se usa para generar el link directo a la solicitud en los correos."
                  />
                </section>

                {/* Listas del formulario de solicitud */}
                <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                        Listas del formulario de solicitud
                      </h2>
                      <p className="text-xs text-gray-400 mt-1">
                        Opciones que aparecen en los desplegables del formulario de nueva solicitud (módulo Operativo).
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={guardarListas.isPending}
                      onClick={() => {
                        guardarListas.mutate(listasForm, {
                          onSuccess: () => setListasGuardadas(true),
                        })
                      }}
                      className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
                    >
                      {guardarListas.isPending ? "Guardando…" : "Guardar listas"}
                    </button>
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
                    <ListaEditor
                      label="Clientes"
                      items={listasForm.clientes}
                      onChange={(v) => { setListasForm(prev => ({ ...prev, clientes: v })); setListasGuardadas(false) }}
                    />
                    <ListaEditor
                      label="Condiciones"
                      items={listasForm.condiciones}
                      onChange={(v) => { setListasForm(prev => ({ ...prev, condiciones: v })); setListasGuardadas(false) }}
                    />
                  </div>
                </section>

                {/* Test SMTP */}
                <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                        Diagnóstico de correo
                      </h2>
                      <p className="text-xs text-gray-400 mt-1">
                        Envía un correo de prueba al usuario SMTP configurado para verificar
                        que las credenciales funcionan. El error exacto se mostrará aquí.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleTestEmail}
                      disabled={testing}
                      className="shrink-0 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 transition-colors flex items-center gap-2"
                    >
                      {testing ? (
                        <>
                          <svg className="animate-spin h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
                    </button>
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
                <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                        Herramientas de prueba del motor
                      </h2>
                      <p className="text-xs text-gray-400 mt-1">
                        Genera un Excel con datos aleatorios y sinónimos del motor para probar la extracción automática.
                        Cada archivo tiene un consecutivo único (<code className="bg-gray-100 px-1 rounded">prueba.001.xlsx</code>,{" "}
                        <code className="bg-gray-100 px-1 rounded">prueba.002.xlsx</code>…).
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
                      className="shrink-0 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 transition-colors flex items-center gap-2"
                    >
                      {generandoExcel ? "Generando…" : "Generar Excel de prueba"}
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
                    className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
                  >
                    {saving ? "Guardando…" : "Guardar cambios"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </main>
      </div>
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
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <input
        type={type}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
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
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
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
          <span className="text-xs text-gray-400 italic">Sin opciones — agrega la primera</span>
        )}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); agregar() } }}
          placeholder="Escribe y presiona Enter o Agregar"
          className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={agregar}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Agregar
        </button>
      </div>
    </div>
  )
}
