import { useState, useEffect } from "react"
import { Sidebar } from "@/components/layout/Sidebar"
import { TopBar } from "@/components/layout/TopBar"
import { api } from "@/lib/api"

// ── Types ─────────────────────────────────────────────────────────────────────

interface OcConfigRead {
  smtp_host: string
  smtp_port: string
  smtp_user: string
  smtp_password_set: boolean
  smtp_from: string
  email_directora: string
}

interface FormState {
  smtp_host: string
  smtp_port: string
  smtp_user: string
  smtp_password: string
  smtp_from: string
  email_directora: string
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
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

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
        })
      })
      .catch(() => setError("No se pudo cargar la configuración."))
      .finally(() => setLoading(false))
  }, [])

  function handleChange(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setSuccess(false)
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
                </section>

                {/* Feedback */}
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
