import { useEffect, useState } from "react"
import { PageLayout } from "@/components/layout/PageLayout"
import { AdminConfigNav } from "@/components/admin/AdminConfigNav"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api } from "@/lib/api"

interface SmtpConfigRead {
  smtp_host: string
  smtp_port: string
  smtp_user: string
  smtp_password_set: boolean
  smtp_from: string
}

interface FormState {
  smtp_host: string
  smtp_port: string
  smtp_user: string
  smtp_password: string
  smtp_from: string
}

interface TestEmailItemResult {
  email: string
  ok: boolean
  detalle?: string
}

interface TestEmailResult {
  ok: boolean
  mensaje: string
  detalle?: string
  resultados?: TestEmailItemResult[]
}

const EMPTY_FORM: FormState = { smtp_host: "", smtp_port: "587", smtp_user: "", smtp_password: "", smtp_from: "" }

export function SmtpConfigPage() {
  const [config, setConfig] = useState<SmtpConfigRead | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<TestEmailResult | null>(null)
  const [testRecipients, setTestRecipients] = useState("")

  function load() {
    setLoading(true)
    api
      .get<SmtpConfigRead>("/api/admin/smtp-config")
      .then((res) => {
        setConfig(res.data)
        setForm({
          smtp_host: res.data.smtp_host,
          smtp_port: res.data.smtp_port,
          smtp_user: res.data.smtp_user,
          smtp_password: "",
          smtp_from: res.data.smtp_from,
        })
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
    const payload: Partial<FormState> = {
      smtp_host: form.smtp_host,
      smtp_port: form.smtp_port,
      smtp_user: form.smtp_user,
      smtp_from: form.smtp_from,
    }
    if (form.smtp_password.trim()) payload.smtp_password = form.smtp_password

    try {
      await api.patch("/api/admin/smtp-config", payload)
      setSuccess(true)
      load()
    } catch {
      setError("Error al guardar la configuración. Intenta de nuevo.")
    } finally {
      setSaving(false)
    }
  }

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    const destinatarios = testRecipients
      .split(/[,\n]/)
      .map((e) => e.trim())
      .filter(Boolean)
    try {
      const res = await api.post<TestEmailResult>("/api/admin/smtp-config/test", {
        destinatarios: destinatarios.length ? destinatarios : undefined,
      })
      setTestResult(res.data)
    } catch {
      setTestResult({ ok: false, mensaje: "Error al contactar el servidor.", detalle: "Verifica que el backend esté corriendo." })
    } finally {
      setTesting(false)
    }
  }

  return (
    <PageLayout title="SMTP corporativo" mainClassName="flex-1 overflow-auto p-6">
      <AdminConfigNav />
      <div className="max-w-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">SMTP corporativo</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cuenta compartida usada para enviar alertas por correo desde Tickets, T&C y Gestión de Tareas.
            Guardado en base de datos — nunca en variables de entorno.
          </p>
        </div>

        {loading && <div className="text-center py-12 text-muted-foreground">Cargando configuración…</div>}

        {!loading && (
          <form onSubmit={handleSubmit} className="space-y-6">
            <section className="bg-card rounded-xl border border-border p-6 space-y-4">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Servidor SMTP</h2>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Host SMTP</label>
                  <input
                    type="text"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="smtp.gmail.com"
                    value={form.smtp_host}
                    onChange={(e) => handleChange("smtp_host", e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Puerto</label>
                  <input
                    type="number"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="587"
                    value={form.smtp_port}
                    onChange={(e) => handleChange("smtp_port", e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Usuario (cuenta Gmail)</label>
                <input
                  type="email"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="alertas@zymologistica.com"
                  value={form.smtp_user}
                  onChange={(e) => handleChange("smtp_user", e.target.value)}
                />
              </div>

              <div>
                <Label className="mb-1">Contraseña de aplicación</Label>
                <Input
                  type="password"
                  placeholder="Dejar en blanco para no cambiar"
                  value={form.smtp_password}
                  onChange={(e) => handleChange("smtp_password", e.target.value)}
                  autoComplete="new-password"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {config?.smtp_password_set
                    ? "✓ Contraseña configurada — solo escribe si quieres cambiarla"
                    : "⚠ Sin contraseña configurada"}
                  {" · "}Genera una en{" "}
                  <a
                    href="https://myaccount.google.com/apppasswords"
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    myaccount.google.com/apppasswords
                  </a>{" "}
                  (requiere verificación en 2 pasos activada).
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Nombre "De"</label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="ZYMO Intranet"
                  value={form.smtp_from}
                  onChange={(e) => handleChange("smtp_from", e.target.value)}
                />
                <p className="mt-1 text-xs text-muted-foreground">Si se deja vacío, se usa el usuario SMTP como remitente.</p>
              </div>
            </section>

            <section className="bg-card rounded-xl border border-border p-6 space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Diagnóstico de correo</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Sin destinatarios, se auto-envía a la propia cuenta (valida solo login). Para confirmar que
                  la entrega real funciona en cada área, pega aquí un correo por área a validar
                  (compras, T&C, tickets…), separados por coma o línea nueva.
                </p>
              </div>

              <textarea
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring font-mono"
                rows={3}
                placeholder="auxiliar.compras@zymologistica.com&#10;lider.tyc@zymologistica.com"
                value={testRecipients}
                onChange={(e) => setTestRecipients(e.target.value)}
              />

              <div className="flex justify-end">
                <Button type="button" onClick={handleTest} disabled={testing} variant="outline" className="shrink-0">
                  {testing ? "Probando…" : "Enviar correo de prueba"}
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
                  {testResult.resultados && testResult.resultados.length > 1 && (
                    <ul className="mt-3 space-y-1">
                      {testResult.resultados.map((r) => (
                        <li key={r.email} className="flex items-start gap-1.5 text-xs">
                          <span>{r.ok ? "✅" : "❌"}</span>
                          <span className="font-mono">{r.email}</span>
                          {r.detalle && <span className="opacity-70">— {r.detalle}</span>}
                        </li>
                      ))}
                    </ul>
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
