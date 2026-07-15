import { useEffect, useState } from "react"
import { PageLayout } from "@/components/layout/PageLayout"
import { AdminConfigNav } from "@/components/admin/AdminConfigNav"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api } from "@/lib/api"

interface WhatsappConfigRead {
  whatsapp_phone_number_id: string
  whatsapp_token_set: boolean
}

interface FormState {
  whatsapp_phone_number_id: string
  whatsapp_token: string
}

interface TestResult {
  ok: boolean
  mensaje: string
  detalle?: string
}

const EMPTY_FORM: FormState = { whatsapp_phone_number_id: "", whatsapp_token: "" }

export function WhatsappConfigPage() {
  const [config, setConfig] = useState<WhatsappConfigRead | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [testTo, setTestTo] = useState("")
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<TestResult | null>(null)

  function load() {
    setLoading(true)
    api
      .get<WhatsappConfigRead>("/api/admin/whatsapp-config")
      .then((res) => {
        setConfig(res.data)
        setForm({ whatsapp_phone_number_id: res.data.whatsapp_phone_number_id, whatsapp_token: "" })
      })
      .catch(() => setError("No se pudo cargar la configuración."))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  function handleChange(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setSuccess(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(false)
    const payload: Partial<FormState> = { whatsapp_phone_number_id: form.whatsapp_phone_number_id }
    if (form.whatsapp_token.trim()) payload.whatsapp_token = form.whatsapp_token

    try {
      await api.patch("/api/admin/whatsapp-config", payload)
      setSuccess(true)
      load()
    } catch {
      setError("Error al guardar la configuración. Intenta de nuevo.")
    } finally {
      setSaving(false)
    }
  }

  async function handleTest() {
    if (!testTo.trim()) return
    setTesting(true)
    setTestResult(null)
    try {
      const res = await api.post<TestResult>("/api/admin/whatsapp-config/test", { to: testTo.trim() })
      setTestResult(res.data)
    } catch {
      setTestResult({ ok: false, mensaje: "Error al contactar el servidor.", detalle: "Verifica que el backend esté corriendo." })
    } finally {
      setTesting(false)
    }
  }

  return (
    <PageLayout title="WhatsApp corporativo" mainClassName="flex-1 overflow-auto p-6">
      <AdminConfigNav />
      <div className="max-w-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">WhatsApp corporativo</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cuenta de WhatsApp Business API (Meta) compartida para notificaciones — usada hoy por T&C.
            Guardado en base de datos.
          </p>
        </div>

        {loading && <div className="text-center py-12 text-muted-foreground">Cargando configuración…</div>}

        {!loading && (
          <form onSubmit={handleSubmit} className="space-y-6">
            <section className="bg-card rounded-xl border border-border p-6 space-y-4">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Meta Business API</h2>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Phone Number ID</label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="123456789012345"
                  value={form.whatsapp_phone_number_id}
                  onChange={(e) => handleChange("whatsapp_phone_number_id", e.target.value)}
                />
              </div>

              <div>
                <Label className="mb-1">Token de acceso</Label>
                <Input
                  type="password"
                  placeholder="Dejar en blanco para no cambiar"
                  value={form.whatsapp_token}
                  onChange={(e) => handleChange("whatsapp_token", e.target.value)}
                  autoComplete="new-password"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {config?.whatsapp_token_set
                    ? "✓ Token configurado — solo escribe si quieres cambiarlo"
                    : "⚠ Sin token configurado"}
                </p>
              </div>
            </section>

            <section className="bg-card rounded-xl border border-border p-6 space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Diagnóstico</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Envía un mensaje de prueba a un número (formato E.164 sin +, ej. 573001234567).
                </p>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="573001234567"
                  value={testTo}
                  onChange={(e) => setTestTo(e.target.value)}
                />
                <Button type="button" onClick={handleTest} disabled={testing || !testTo.trim()} variant="outline" className="shrink-0">
                  {testing ? "Enviando…" : "Enviar prueba"}
                </Button>
              </div>

              {testResult && (
                <div
                  className={`rounded-lg border px-4 py-3 text-sm ${
                    testResult.ok
                      ? "bg-green-50 border-green-200 text-green-800"
                      : "bg-red-50 border-red-200 text-red-800"
                  }`}
                >
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

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
            )}
            {success && (
              <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
                ✓ Configuración guardada correctamente.
              </div>
            )}

            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>
                {saving ? "Guardando…" : "Guardar cambios"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </PageLayout>
  )
}
