import nodemailer from "nodemailer"
import { env } from "../config/env"

// ─── SMTP corporativo centralizado (Configuración de la intranet) ───────────
// Mismo patrón que task-backend/src/services/emailService.ts — principal +
// respaldo, sin fallback a config local (ZymoAlly nunca tuvo una propia).

interface SmtpCreds {
  host: string
  port: number
  user: string
  pass: string
  from: string
}

async function getSmtpCandidates(): Promise<SmtpCreds[]> {
  try {
    const res = await fetch(`${env.INTRANET_API_URL}/api/admin/smtp-config/service`, {
      headers: { "X-Internal-Key": env.INTERNAL_KEY },
    })
    if (!res.ok) return []
    const data = await res.json() as {
      primary: { smtp_host: string; smtp_port: string; smtp_user: string; smtp_password: string; smtp_from: string } | null
      backup: { smtp_host: string; smtp_port: string; smtp_user: string; smtp_password: string; smtp_from: string } | null
    }
    const toCreds = (c: typeof data.primary) => c ? {
      host: c.smtp_host,
      port: parseInt(c.smtp_port || "587", 10),
      user: c.smtp_user,
      pass: c.smtp_password,
      from: c.smtp_from || c.smtp_user,
    } : null
    return [toCreds(data.primary), toCreds(data.backup)].filter((c): c is SmtpCreds => c !== null)
  } catch {
    return []
  }
}

function buildTransport(creds: SmtpCreds): nodemailer.Transporter {
  return nodemailer.createTransport({
    host: creds.host,
    port: creds.port,
    secure: creds.port === 465,
    auth: { user: creds.user, pass: creds.pass },
    tls: { rejectUnauthorized: false },
  })
}

interface MailContent {
  to: string[]
  subject: string
  html: string
}

/** Envía probando el SMTP principal y, si falla, el de respaldo. No lanza —
 * el llamador (creación de ticket) no debe fallar por un problema de correo,
 * solo se registra en consola. */
export async function sendMailWithFallback(mail: MailContent): Promise<boolean> {
  if (!mail.to.length) return false
  const candidates = await getSmtpCandidates()
  if (!candidates.length) {
    console.warn("[email] SMTP no configurado — se omite envío:", mail.subject)
    return false
  }
  for (const creds of candidates) {
    try {
      await buildTransport(creds).sendMail({ from: creds.from, to: mail.to.join(","), subject: mail.subject, html: mail.html })
      return true
    } catch (err) {
      console.warn("[email] Fallo un SMTP, probando siguiente:", (err as Error).message)
    }
  }
  console.error("[email] Todos los SMTP configurados fallaron para:", mail.subject)
  return false
}

// ─── Notificación de recepción de ticket (Fase D) ────────────────────────────

const BASE_URL = env.PUBLIC_APP_URL
const PRIMARY = "#C3182A"

function wrapEmail(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
  body{margin:0;padding:0;background:#f4f4f5;font-family:'DM Sans',Arial,sans-serif;}
  .wrap{max-width:560px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7;}
  .header{background:${PRIMARY};padding:24px 32px;}
  .header h1{margin:0;color:#fff;font-size:18px;font-weight:700;letter-spacing:.5px;}
  .header p{margin:4px 0 0;color:rgba(255,255,255,.7);font-size:12px;text-transform:uppercase;letter-spacing:1px;}
  .body{padding:32px;}
  .body h2{margin:0 0 16px;font-size:20px;color:#18181b;font-weight:700;}
  .body p{margin:0 0 12px;color:#52525b;font-size:14px;line-height:1.6;}
  .meta{background:#f4f4f5;border-radius:8px;padding:16px;margin:20px 0;}
  .meta-row{display:flex;gap:8px;margin-bottom:8px;}
  .meta-row:last-child{margin-bottom:0;}
  .meta-label{font-size:12px;color:#71717a;font-weight:600;text-transform:uppercase;letter-spacing:.5px;min-width:90px;}
  .meta-value{font-size:13px;color:#18181b;font-weight:500;}
  .cta{display:inline-block;margin-top:20px;background:${PRIMARY};color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;}
  .footer{padding:16px 32px;border-top:1px solid #e4e4e7;text-align:center;}
  .footer p{margin:0;font-size:11px;color:#a1a1aa;}
</style></head>
<body><div class="wrap">
  <div class="header"><h1>ZYMO Intranet</h1><p>${title}</p></div>
  <div class="body">${body}</div>
  <div class="footer"><p>IMCCARGO · LOGIMAT · IMC Depósito — Notificación automática</p></div>
</div></body></html>`
}

interface TicketNotifyData {
  code: string
  area: string
  type: string
  priority: string
  description?: string | null
}

export async function notifyTicketReceived(recipients: string[], data: TicketNotifyData): Promise<void> {
  const uniqueRecipients = Array.from(new Set(recipients.filter(Boolean)))
  if (!uniqueRecipients.length) return

  const body = `
    <h2>Tienes un ticket para gestionar</h2>
    <p>Se registró una nueva solicitud/hallazgo asignado a tu área.</p>
    <div class="meta">
      <div class="meta-row"><span class="meta-label">Ticket</span><span class="meta-value">${data.code}</span></div>
      <div class="meta-row"><span class="meta-label">Área</span><span class="meta-value">${data.area}</span></div>
      <div class="meta-row"><span class="meta-label">Tipo</span><span class="meta-value">${data.type}</span></div>
      <div class="meta-row"><span class="meta-label">Prioridad</span><span class="meta-value">${data.priority}</span></div>
    </div>
    ${data.description ? `<p>${data.description}</p>` : ""}
    <p>Ingresa a la intranet para revisar el detalle y gestionarlo.</p>
    <a href="${BASE_URL}" class="cta">Ver ticket</a>
  `

  await sendMailWithFallback({
    to: uniqueRecipients,
    subject: `[ZYMO] Nuevo ticket para gestionar — ${data.code}`,
    html: wrapEmail("Notificación de ticket", body),
  })
}
