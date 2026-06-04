import nodemailer from "nodemailer"
import { env } from "../config/env"

interface AprobacionEmailData {
  codigo: string
  titulo: string
  aprobadoPor: string
  mensaje: string
}

export async function sendAprobacionEmail(data: AprobacionEmailData): Promise<void> {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
    console.log("[SIG email] SMTP no configurado, omitiendo notificación")
    return
  }

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  })

  await transporter.sendMail({
    from: env.SMTP_FROM,
    to: env.SMTP_USER, // por defecto notifica al mismo correo configurado
    subject: `[SIG] Procedimiento aprobado: ${data.codigo} — ${data.titulo}`,
    html: `
      <div style="font-family: DM Sans, sans-serif; max-width: 600px;">
        <h2 style="color: #22c55e;">✅ Procedimiento aprobado</h2>
        <p><strong>Código:</strong> ${data.codigo}</p>
        <p><strong>Título:</strong> ${data.titulo}</p>
        <p><strong>Aprobado por:</strong> ${data.aprobadoPor}</p>
        <p><strong>Commit:</strong> ${data.mensaje}</p>
        <hr/>
        <p style="color: #6b7280; font-size: 12px;">Sistema de Gestión Integrada — ZYMO Intranet</p>
      </div>
    `,
  })
}
