import { Router, Request, Response } from "express"
import multer from "multer"
import path from "path"
import fs from "fs"
import { v4 as uuidv4 } from "uuid"
import { z } from "zod"
import { env } from "../config/env"
import { idParamSchema } from "../utils/validators"
import * as attachmentService from "../services/attachmentService"

// ─── Multer storage: uploads/tasks/{taskId}/{uuid}.ext ───────────────────────
const storage = multer.diskStorage({
  destination(req, _file, cb) {
    const taskId = req.params.id ?? "unknown"
    const dir = path.resolve(env.UPLOAD_DIR, "tasks", taskId)
    fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename(_req, file, cb) {
    const ext = file.originalname.split(".").pop() ?? ""
    cb(null, `${uuidv4()}.${ext}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
})

// ─── Task-scoped routes — mount at /api/tasks ─────────────────────────────────
export const taskAttachmentsRouter = Router()

taskAttachmentsRouter.post(
  "/:id/attachments",
  upload.single("file"),
  async (req: Request, res: Response) => {
    const { id } = idParamSchema.parse(req.params)
    if (!req.file) {
      res.status(400).json({ error: "No se recibió ningún archivo" })
      return
    }
    attachmentService.validateUpload(req.file)
    const attachment = await attachmentService.saveAttachment(
      id,
      req.user!,
      req.file,
      req.file.filename,
    )
    res.status(201).json(attachment)
  },
)

taskAttachmentsRouter.get("/:id/attachments", async (req: Request, res: Response) => {
  const { id } = idParamSchema.parse(req.params)
  const attachments = await attachmentService.getAttachments(id, req.user!)
  res.json(attachments)
})

// ─── Attachment-level routes — mount at /api/attachments ─────────────────────
export const attachmentActionsRouter = Router()

const attachmentIdSchema = z.object({
  attachmentId: z.string().regex(/^\d+$/).transform(Number),
})

attachmentActionsRouter.get("/:attachmentId/download", async (req: Request, res: Response) => {
  const { attachmentId } = attachmentIdSchema.parse(req.params)
  const { attachment, fullPath } = await attachmentService.getAttachmentForDownload(
    attachmentId,
    req.user!,
  )
  res.setHeader("Content-Disposition", `attachment; filename="${attachment.filename}"`)
  res.setHeader("Content-Type", attachment.mimeType)
  res.sendFile(fullPath)
})

attachmentActionsRouter.delete("/:attachmentId", async (req: Request, res: Response) => {
  const { attachmentId } = attachmentIdSchema.parse(req.params)
  await attachmentService.deleteAttachment(attachmentId, req.user!)
  res.status(204).send()
})
