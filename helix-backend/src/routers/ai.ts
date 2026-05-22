import http from "http"
import { URL } from "url"
import { Router } from "express"
import { prisma } from "../config/prisma"
import { getUserId } from "../middleware/auth"
import { env } from "../config/env"

const router = Router()

// POST /api/ai/chat — proxies SSE stream to FastAPI helix agent
router.post("/chat", (req, res, next) => {
  try {
    const { mensaje, historial } = req.body as {
      mensaje: string
      historial?: Array<{ role: string; content: string }>
    }

    const authHeader = req.headers.authorization

    const fastapiUrl = new URL("/api/agentes/helix/chat", env.INTRANET_API_URL)
    const bodyStr = JSON.stringify({ mensaje, historial: historial ?? [] })

    const options: http.RequestOptions = {
      hostname: fastapiUrl.hostname,
      port: fastapiUrl.port ? Number(fastapiUrl.port) : 80,
      path: fastapiUrl.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(bodyStr),
        "Authorization": authHeader ?? "",
        "X-Internal-Key": env.INTERNAL_KEY,
      },
    }

    res.setHeader("Content-Type", "text/event-stream")
    res.setHeader("Cache-Control", "no-cache")
    res.setHeader("Connection", "keep-alive")
    res.setHeader("X-Accel-Buffering", "no")

    const proxyReq = http.request(options, (proxyRes) => {
      proxyRes.pipe(res)
    })

    proxyReq.on("error", (err) => {
      if (!res.headersSent) {
        next(err)
      } else {
        res.end()
      }
    })

    proxyReq.write(bodyStr)
    proxyReq.end()
  } catch (err) {
    next(err)
  }
})

// GET /api/ai/conversacion — returns stored conversation for current user
router.get("/conversacion", async (req, res, next) => {
  try {
    const userId = getUserId(req.user!)
    const conv = await prisma.helixAIConversacion.findFirst({
      where: { usuarioId: userId },
      orderBy: { updatedAt: "desc" },
    })
    res.json({ mensajes: conv?.mensajes ?? [] })
  } catch (err) {
    next(err)
  }
})

export default router
