import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { PageLayout } from "@/components/layout/PageLayout"
import { AdminConfigNav } from "@/components/admin/AdminConfigNav"
import { useArchivedTeams, useRestoreTeam, useHardDeleteTeam } from "@/hooks/useTaskTeams"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useSystemConfig, useUpdateSystemConfig, useTestEmail, useTestWebhook } from "@/hooks/useSystemConfig"

// Las cuentas de usuario (crear, editar, permisos, herramientas, archivar) viven solo en Organización.
type Tab = "equipos" | "config"

export function AdminPage() {
  const [tab, setTab] = useState<Tab>(new URLSearchParams(window.location.search).get("tab") === "config" ? "config" : "equipos")

  return (
    <PageLayout title="Equipos y webhook">
      <AdminConfigNav />
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground">Equipos y webhook</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Equipos de Gestión de Tareas archivados e integración con Power Automate. Las personas se gestionan en Organización.
        </p>
      </div>

      <div className="flex gap-1 mb-4 bg-muted rounded-lg p-1 w-fit">
        {([
          { key: "equipos", label: "Equipos archivados" },
          { key: "config", label: "Configuración" },
        ] as { key: Tab; label: string }[]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === t.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "config" ? <ConfigPanel /> : <ArchivedTeamsPanel />}
    </PageLayout>
  )
}

function ArchivedTeamsPanel() {
  const { data: teams = [], isLoading } = useArchivedTeams()
  const restore = useRestoreTeam()
  const hardDelete = useHardDeleteTeam()
  const [confirmId, setConfirmId] = useState<number | null>(null)

  if (isLoading) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Cargando...</p>
  }

  if (teams.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-muted-foreground text-sm">No hay equipos archivados.</p>
      </div>
    )
  }

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="px-4 py-3 font-medium text-muted-foreground">Equipo</th>
            <th className="px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Archivado</th>
            <th className="px-4 py-3 font-medium text-muted-foreground text-right">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {teams.map((team) => (
            <tr key={team.id} className="hover:bg-muted/50">
              <td className="px-4 py-3">
                <span className="font-medium text-foreground">{team.name}</span>
                <span className="text-xs text-muted-foreground ml-2">ID {team.id}</span>
              </td>
              <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">
                {new Date(team.updatedAt).toLocaleDateString("es-MX")}
              </td>
              <td className="px-4 py-3 text-right">
                {confirmId === team.id ? (
                  <div className="flex items-center justify-end gap-2">
                    <span className="text-xs text-red-600 font-medium">¿Borrar permanentemente?</span>
                    <button
                      onClick={async () => { await hardDelete.mutateAsync(team.id); setConfirmId(null) }}
                      disabled={hardDelete.isPending}
                      className="text-xs font-semibold text-red-600 hover:text-red-800 disabled:opacity-50"
                    >
                      Confirmar
                    </button>
                    <button onClick={() => setConfirmId(null)} className="text-xs text-muted-foreground hover:text-foreground">
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      onClick={() => restore.mutate(team.id)}
                      disabled={restore.isPending}
                      variant="outline"
                      size="sm"
                      className="text-xs px-3 py-1 h-auto"
                    >
                      Restaurar
                    </Button>
                    <Button
                      onClick={() => setConfirmId(team.id)}
                      variant="outline"
                      size="sm"
                      className="text-xs px-3 py-1 h-auto border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
                    >
                      Borrar definitivo
                    </Button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ConfigPanel() {
  const navigate = useNavigate()
  const { data: config, isLoading } = useSystemConfig()
  const updateConfig = useUpdateSystemConfig()
  const testEmail = useTestEmail()
  const testWebhook = useTestWebhook()

  const [smtp, setSmtp] = useState({ smtp_enabled: "false" })

  const [webhook, setWebhook] = useState({
    webhook_powerautomate_url: "",
    webhook_enabled: "false",
  })

  const [smtpMsg, setSmtpMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [webhookMsg, setWebhookMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    if (!config) return
    setSmtp({ smtp_enabled: config.smtp_enabled ?? "false" })
    setWebhook({
      webhook_powerautomate_url: config.webhook_powerautomate_url ?? "",
      webhook_enabled: config.webhook_enabled ?? "false",
    })
  }, [config])

  function handleSaveSmtp() {
    setSmtpMsg(null)
    updateConfig.mutate(
      { smtp_enabled: smtp.smtp_enabled },
      {
        onSuccess: () => setSmtpMsg({ ok: true, text: "Guardado" }),
        onError: () => setSmtpMsg({ ok: false, text: "Error al guardar" }),
      },
    )
  }

  function handleSaveWebhook() {
    setWebhookMsg(null)
    updateConfig.mutate(
      { webhook_powerautomate_url: webhook.webhook_powerautomate_url, webhook_enabled: webhook.webhook_enabled },
      {
        onSuccess: () => setWebhookMsg({ ok: true, text: "Webhook guardado" }),
        onError: () => setWebhookMsg({ ok: false, text: "Error al guardar" }),
      },
    )
  }

  function handleTestEmail() {
    setSmtpMsg(null)
    testEmail.mutate(undefined, {
      onSuccess: (d: { message?: string }) => setSmtpMsg({ ok: true, text: d.message ?? "Email de prueba enviado" }),
      onError: (e: unknown) => {
        const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Error al enviar"
        setSmtpMsg({ ok: false, text: msg })
      },
    })
  }

  function handleTestWebhook() {
    setWebhookMsg(null)
    testWebhook.mutate(undefined, {
      onSuccess: (d: { message?: string }) => setWebhookMsg({ ok: true, text: d.message ?? "Webhook de prueba enviado" }),
      onError: (e: unknown) => {
        const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Error al enviar"
        setWebhookMsg({ ok: false, text: msg })
      },
    })
  }

  if (isLoading) {
    return <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">Cargando...</div>
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* SMTP */}
      <div className="bg-card rounded-xl border border-border shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Correo electrónico (SMTP)</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Notificaciones por email al asignar o responder tareas</p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-xs text-muted-foreground">Activo</span>
            <button
              type="button"
              onClick={() => setSmtp((s) => ({ ...s, smtp_enabled: s.smtp_enabled === "true" ? "false" : "true" }))}
              className={`relative w-9 h-5 rounded-full transition-colors ${smtp.smtp_enabled === "true" ? "bg-primary" : "bg-muted-foreground/30"}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${smtp.smtp_enabled === "true" ? "translate-x-4" : "translate-x-0"}`} />
            </button>
          </label>
        </div>

        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            El correo se envía con la cuenta corporativa centralizada — la misma que usan Tickets y T&C.
          </p>
          <button
            type="button"
            onClick={() => navigate("/admin/configuracion/smtp")}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-muted/5 hover:bg-muted/10 hover:border-primary/30 transition-all text-sm font-medium"
          >
            Ir a SMTP corporativo →
          </button>
        </div>

        {smtpMsg && (
          <p className={`mt-3 text-xs ${smtpMsg.ok ? "text-green-600" : "text-destructive"}`}>{smtpMsg.text}</p>
        )}

        <div className="flex gap-2 mt-4">
          <Button size="sm" onClick={handleSaveSmtp} disabled={updateConfig.isPending} className="flex-1">
            Guardar
          </Button>
          <Button size="sm" variant="outline" onClick={handleTestEmail} disabled={testEmail.isPending}>
            {testEmail.isPending ? "Enviando…" : "Probar"}
          </Button>
        </div>
      </div>

      {/* Webhook Power Automate */}
      <div className="bg-card rounded-xl border border-border shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Webhook Power Automate</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Sincroniza tareas y eventos con el calendario de Outlook/Teams</p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-xs text-muted-foreground">Activo</span>
            <button
              type="button"
              onClick={() => setWebhook((s) => ({ ...s, webhook_enabled: s.webhook_enabled === "true" ? "false" : "true" }))}
              className={`relative w-9 h-5 rounded-full transition-colors ${webhook.webhook_enabled === "true" ? "bg-primary" : "bg-muted-foreground/30"}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${webhook.webhook_enabled === "true" ? "translate-x-4" : "translate-x-0"}`} />
            </button>
          </label>
        </div>

        <div className="space-y-3">
          <div>
            <Label htmlFor="webhook_url" className="text-xs mb-1">URL del trigger HTTP</Label>
            <Input
              id="webhook_url"
              value={webhook.webhook_powerautomate_url}
              onChange={(e) => setWebhook((s) => ({ ...s, webhook_powerautomate_url: e.target.value }))}
              placeholder="https://prod-xx.westus.logic.azure.com/workflows/..."
              className="h-8 text-sm font-mono"
            />
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            En Power Automate: crea un flujo con trigger "Cuando se reciba una solicitud HTTP", copia la URL generada y pégala aquí.
          </p>
        </div>

        {webhookMsg && (
          <p className={`mt-3 text-xs ${webhookMsg.ok ? "text-green-600" : "text-destructive"}`}>{webhookMsg.text}</p>
        )}

        <div className="flex gap-2 mt-4">
          <Button size="sm" onClick={handleSaveWebhook} disabled={updateConfig.isPending} className="flex-1">
            Guardar
          </Button>
          <Button size="sm" variant="outline" onClick={handleTestWebhook} disabled={testWebhook.isPending}>
            {testWebhook.isPending ? "Enviando…" : "Probar"}
          </Button>
        </div>
      </div>
    </div>
  )
}
