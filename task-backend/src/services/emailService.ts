import nodemailer from "nodemailer"
import { env } from "../config/env"
import * as svc from "./systemConfigService"

// ─── Obtener email de usuario desde intranet API ─────────────────────────────

async function getUserEmail(userId: number): Promise<{ email: string; nombre: string } | null> {
  try {
    const res = await fetch(`${env.INTRANET_API_URL}/api/users/${userId}`, {
      headers: { "X-Internal-Key": env.INTERNAL_KEY },
    })
    if (!res.ok) return null
    const data = await res.json() as { email?: string; full_name?: string }
    return data.email ? { email: data.email, nombre: data.full_name ?? data.email } : null
  } catch {
    return null
  }
}

// ─── Transport ───────────────────────────────────────────────────────────────

interface SmtpCreds {
  host: string
  port: number
  user: string
  pass: string
  from: string | null
}

// SMTP corporativo centralizado (Configuración de la intranet) — gana si está configurado.
// Fallback a la config local de Tareas (systemConfigService) mientras no esté lleno.
async function getGlobalSmtp(): Promise<SmtpCreds | null> {
  try {
    const res = await fetch(`${env.INTRANET_API_URL}/api/admin/smtp-config/service`, {
      headers: { "X-Internal-Key": env.INTERNAL_KEY },
    })
    if (!res.ok) return null
    const data = await res.json() as {
      smtp_host: string; smtp_port: string; smtp_user: string; smtp_password: string; smtp_from: string
    }
    if (!data.smtp_host || !data.smtp_user || !data.smtp_password) return null
    return {
      host: data.smtp_host,
      port: parseInt(data.smtp_port || "587", 10),
      user: data.smtp_user,
      pass: data.smtp_password,
      from: data.smtp_from || null,
    }
  } catch {
    return null
  }
}

async function getTransport(): Promise<nodemailer.Transporter> {
  const global = await getGlobalSmtp()
  const host = global?.host ?? (await svc.getConfig("smtp_host"))
  const port = global?.port ?? parseInt((await svc.getConfig("smtp_port")) ?? "587", 10)
  const user = global?.user ?? (await svc.getConfig("smtp_user"))
  const pass = global?.pass ?? (await svc.getConfig("smtp_password"))

  if (!host || !user || !pass) throw new Error("Configuración SMTP incompleta")

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  })
}

async function getFromAddress(): Promise<string> {
  const global = await getGlobalSmtp()
  return global?.from ?? (await svc.getConfig("smtp_from")) ?? "ZYMO Intranet <noreply@zymo.com>"
}

// ─── Templates HTML (branded ZYMO) ──────────────────────────────────────────

const BASE_URL = "https://zymointranet.com"
const PRIMARY = "#C3182A"

function wrapEmail(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
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
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <h1>ZYMO Intranet</h1>
    <p>${title}</p>
  </div>
  <div class="body">
    ${body}
  </div>
  <div class="footer">
    <p>IMCCARGO · LOGIMAT · IMC Depósito — Notificación automática</p>
  </div>
</div>
</body>
</html>`
}

// ─── Email: nueva tarea asignada ──────────────────────────────────────────────

interface TaskAssignedData {
  asignadoNombre: string
  asignadoPorNombre: string
  titulo: string
  fecha: string
  prioridad: string
  equipo: string
}

async function sendTaskAssignedEmail(to: string, data: TaskAssignedData): Promise<void> {
  const from = await getFromAddress()
  const transport = await getTransport()

  const body = `
    <h2>Tienes una nueva tarea asignada</h2>
    <p>Hola <strong>${data.asignadoNombre}</strong>, <strong>${data.asignadoPorNombre}</strong> te ha asignado una tarea.</p>
    <div class="meta">
      <div class="meta-row"><span class="meta-label">Tarea</span><span class="meta-value">${data.titulo}</span></div>
      <div class="meta-row"><span class="meta-label">Fecha</span><span class="meta-value">${data.fecha}</span></div>
      <div class="meta-row"><span class="meta-label">Prioridad</span><span class="meta-value">${data.prioridad}</span></div>
      <div class="meta-row"><span class="meta-label">Equipo</span><span class="meta-value">${data.equipo}</span></div>
    </div>
    <p>Ingresa a la intranet para revisar los detalles y aceptar o rechazar la tarea.</p>
    <a href="${BASE_URL}/herramientas/tareas" class="cta">Ver tarea</a>
  `

  await transport.sendMail({
    from,
    to,
    subject: `[ZYMO] Nueva tarea: ${data.titulo}`,
    html: wrapEmail("Notificación de tarea", body),
  })
}

// ─── Email: tarea aceptada ────────────────────────────────────────────────────

interface TaskResponseData {
  creadorNombre: string
  asignadoNombre: string
  titulo: string
  fecha: string
}

async function sendTaskAcceptedEmail(to: string, data: TaskResponseData): Promise<void> {
  const from = await getFromAddress()
  const transport = await getTransport()

  const body = `
    <h2>Tu tarea fue aceptada</h2>
    <p>Hola <strong>${data.creadorNombre}</strong>, <strong>${data.asignadoNombre}</strong> aceptó la tarea que le asignaste.</p>
    <div class="meta">
      <div class="meta-row"><span class="meta-label">Tarea</span><span class="meta-value">${data.titulo}</span></div>
      <div class="meta-row"><span class="meta-label">Fecha</span><span class="meta-value">${data.fecha}</span></div>
    </div>
    <a href="${BASE_URL}/herramientas/tareas" class="cta">Ver en la intranet</a>
  `

  await transport.sendMail({
    from,
    to,
    subject: `[ZYMO] Tarea aceptada: ${data.titulo}`,
    html: wrapEmail("Confirmación de tarea", body),
  })
}

// ─── Email: tarea rechazada ───────────────────────────────────────────────────

async function sendTaskRejectedEmail(to: string, data: TaskResponseData): Promise<void> {
  const from = await getFromAddress()
  const transport = await getTransport()

  const body = `
    <h2>Tu tarea fue rechazada</h2>
    <p>Hola <strong>${data.creadorNombre}</strong>, <strong>${data.asignadoNombre}</strong> rechazó la tarea que le asignaste.</p>
    <div class="meta">
      <div class="meta-row"><span class="meta-label">Tarea</span><span class="meta-value">${data.titulo}</span></div>
      <div class="meta-row"><span class="meta-label">Fecha</span><span class="meta-value">${data.fecha}</span></div>
    </div>
    <p>Puedes reasignarla a otro miembro del equipo desde la intranet.</p>
    <a href="${BASE_URL}/herramientas/tareas" class="cta">Ver en la intranet</a>
  `

  await transport.sendMail({
    from,
    to,
    subject: `[ZYMO] Tarea rechazada: ${data.titulo}`,
    html: wrapEmail("Respuesta de tarea", body),
  })
}

// ─── Email de prueba ──────────────────────────────────────────────────────────

export async function sendTestEmail(to: string): Promise<void> {
  const from = await getFromAddress()
  const transport = await getTransport()

  const body = `
    <h2>Prueba de configuración</h2>
    <p>Si recibes este correo, la configuración SMTP de ZYMO Intranet está funcionando correctamente.</p>
    <div class="meta">
      <div class="meta-row"><span class="meta-label">Enviado a</span><span class="meta-value">${to}</span></div>
      <div class="meta-row"><span class="meta-label">Fecha</span><span class="meta-value">${new Date().toLocaleString("es-CO")}</span></div>
    </div>
  `

  await transport.sendMail({
    from,
    to,
    subject: "[ZYMO] Prueba de notificaciones",
    html: wrapEmail("Email de prueba", body),
  })
}

// ─── Función principal de disparo (fire-and-forget) ───────────────────────────

export async function notifyTaskAssigned(
  asignadoAId: number,
  subidoPorId: number,
  subidoPorNombre: string,
  titulo: string,
  fecha: Date,
  prioridad: string,
  teamNombre: string,
): Promise<void> {
  const enabled = await svc.getConfig("smtp_enabled")
  if (enabled !== "true") return

  const asignadoInfo = await getUserEmail(asignadoAId)
  if (!asignadoInfo) return

  await sendTaskAssignedEmail(asignadoInfo.email, {
    asignadoNombre: asignadoInfo.nombre,
    asignadoPorNombre: subidoPorNombre,
    titulo,
    fecha: fecha.toLocaleDateString("es-CO"),
    prioridad,
    equipo: teamNombre,
  })
}

export async function notifyTaskResponse(
  subidoPorId: number,
  asignadoNombre: string,
  titulo: string,
  fecha: Date,
  resultado: "aceptada" | "rechazada",
): Promise<void> {
  const enabled = await svc.getConfig("smtp_enabled")
  if (enabled !== "true") return

  const creadorInfo = await getUserEmail(subidoPorId)
  if (!creadorInfo) return

  const data: TaskResponseData = {
    creadorNombre: creadorInfo.nombre,
    asignadoNombre,
    titulo,
    fecha: fecha.toLocaleDateString("es-CO"),
  }

  if (resultado === "aceptada") {
    await sendTaskAcceptedEmail(creadorInfo.email, data)
  } else {
    await sendTaskRejectedEmail(creadorInfo.email, data)
  }
}
