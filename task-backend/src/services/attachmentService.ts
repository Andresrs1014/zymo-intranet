import fs from "fs"
import path from "path"
import prisma from "../config/prisma"
import { AppError } from "../middleware/errorHandler"
import { AuthPayload, getUserId } from "../middleware/auth"
import { getMemberTeamIds } from "../utils/permissions"
import { env } from "../config/env"

const ALLOWED_EXTENSIONS = new Set([
  "jpg", "jpeg", "png", "gif", "pdf",
  "docx", "xlsx", "pptx", "zip", "txt", "csv",
])
const MAX_SIZE_BYTES = 20 * 1024 * 1024 // 20 MB

export function validateUpload(file: Express.Multer.File): void {
  if (file.size > MAX_SIZE_BYTES) {
    throw new AppError(413, "El archivo supera el límite de 20 MB")
  }
  const ext = file.originalname.split(".").pop()?.toLowerCase() ?? ""
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new AppError(422, `Extensión no permitida: .${ext}`)
  }
}

export async function saveAttachment(
  taskId: number,
  user: AuthPayload,
  file: Express.Multer.File,
  storedFilename: string,
) {
  const userId = getUserId(user)

  const task = await prisma.task.findFirst({ where: { id: taskId }, select: { teamId: true } })
  if (!task) throw new AppError(404, "Tarea no encontrada")

  const memberTeams = await getMemberTeamIds(user)
  if (!memberTeams.includes(task.teamId)) {
    throw new AppError(403, "No tienes acceso a esta tarea")
  }

  const filePath = path.join("tasks", String(taskId), storedFilename)
  const attachment = await prisma.attachment.create({
    data: {
      taskId,
      filename: file.originalname,
      filePath,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      uploadedById: userId,
    },
  })

  await prisma.activityLog.create({
    data: {
      taskId,
      userId,
      userNombre: user.full_name ?? `Usuario ${userId}`,
      accion: "adjunto_subido",
      detalle: file.originalname,
    },
  })

  return attachment
}

export async function getAttachments(taskId: number, user: AuthPayload) {
  const task = await prisma.task.findFirst({ where: { id: taskId }, select: { teamId: true } })
  if (!task) throw new AppError(404, "Tarea no encontrada")

  const memberTeams = await getMemberTeamIds(user)
  if (!memberTeams.includes(task.teamId)) {
    throw new AppError(403, "No tienes acceso a esta tarea")
  }

  return prisma.attachment.findMany({
    where: { taskId },
    orderBy: { uploadedAt: "asc" },
  })
}

export async function deleteAttachment(attachmentId: number, user: AuthPayload): Promise<void> {
  const userId = getUserId(user)

  const attachment = await prisma.attachment.findFirst({ where: { id: attachmentId } })
  if (!attachment) throw new AppError(404, "Adjunto no encontrado")

  const task = await prisma.task.findFirst({
    where: { id: attachment.taskId },
    select: { teamId: true },
  })
  if (!task) throw new AppError(404, "Tarea no encontrada")

  const memberTeams = await getMemberTeamIds(user)
  if (!memberTeams.includes(task.teamId)) {
    throw new AppError(403, "No tienes acceso a este adjunto")
  }

  // Delete physical file
  const fullPath = path.resolve(env.UPLOAD_DIR, attachment.filePath)
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath)
  }

  await prisma.attachment.delete({ where: { id: attachmentId } })

  await prisma.activityLog.create({
    data: {
      taskId: attachment.taskId,
      userId,
      userNombre: user.full_name ?? `Usuario ${userId}`,
      accion: "adjunto_eliminado",
      detalle: attachment.filename,
    },
  })
}

export async function getAttachmentForDownload(attachmentId: number, user: AuthPayload) {
  const attachment = await prisma.attachment.findFirst({ where: { id: attachmentId } })
  if (!attachment) throw new AppError(404, "Adjunto no encontrado")

  const task = await prisma.task.findFirst({
    where: { id: attachment.taskId },
    select: { teamId: true },
  })
  if (!task) throw new AppError(404, "Tarea no encontrada")

  const memberTeams = await getMemberTeamIds(user)
  if (!memberTeams.includes(task.teamId)) {
    throw new AppError(403, "No tienes acceso a este adjunto")
  }

  const fullPath = path.resolve(env.UPLOAD_DIR, attachment.filePath)
  if (!fs.existsSync(fullPath)) throw new AppError(404, "Archivo no encontrado en disco")

  return { attachment, fullPath }
}
