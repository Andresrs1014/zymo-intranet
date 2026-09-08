import { Router, Request, Response } from "express"
import { z } from "zod"
import prisma from "../config/prisma"
import { requireSigAccess, getUserId } from "../middleware/auth"
import { resolveActorName } from "../utils/userNames"
import { derivarVeredicto, FUNCIONES, CLASIFICACIONES } from "../services/veredicto"
import { validarDemostracion } from "../services/hallazgoValidacion"

const router = Router()

// ── POST /api/auditorias — crea una corrida del agente analista ───────────────
const HallazgoIn = z.object({
  funcion: z.enum(FUNCIONES),
  nivel: z.number().int().min(1).max(2),
  clasificacion: z.enum(CLASIFICACIONES),
  fragmento: z.string().min(1),
  archivo: z.string().nullable().optional(),
  descripcion: z.string().min(1),
  demostracion: z.any().optional(),
  palabra: z.any().nullable().optional(),
  impacto: z.string().nullable().optional(),
  dedupeKey: z.string().min(1),
  sustituyeA: z.number().int().positive().nullable().optional(),
})

const ConsultaIn = z.object({
  tipo: z.enum(["documento_faltante", "contexto_operativo"]),
  funcion: z.enum(FUNCIONES),
  fragmento: z.string().nullable().optional(),
  documentoEsperado: z.string().nullable().optional(),
  motivo: z.string().nullable().optional(),
  preguntas: z.array(z.string()).default([]),
})

const CierreIn = z.object({
  hallazgoId: z.number().int().positive(),
  motivo: z.string().min(1),
  evidencia: z.string().min(1),
})

const AuditoriaSchema = z.object({
  procedimientoId: z.number().int().positive(),
  commitId: z.number().int().positive().nullable().optional(),
  resumenEjecutivo: z.string().min(1),
  reporteMarkdown: z.string().min(1),
  normas: z.array(z.string()).default([]),
  alcanceArchivos: z.array(z.string()).default([]),
  modelosUsados: z.array(z.string()).default([]),
  tokensUsados: z.number().int().nonnegative().optional(),
  operadorNombre: z.string().nullable().optional(),
  hallazgos: z.array(HallazgoIn).default([]),
  consultas: z.array(ConsultaIn).default([]),
  cierres: z.array(CierreIn).default([]),
})

router.post("/auditorias", requireSigAccess, async (req: Request, res: Response) => {
  const parsed = AuditoriaSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(422).json({ error: parsed.error.flatten() })
    return
  }
  const b = parsed.data

  const proc = await prisma.sigProcedimiento.findUnique({ where: { id: b.procedimientoId } })
  if (!proc) {
    res.status(404).json({ error: "Procedimiento no encontrado" })
    return
  }

  const autorId = getUserId(req.user!)
  const autorNombre = await resolveActorName(autorId, req.user!.full_name)
  const now = new Date()

  // Regla de demostración (§4): los hallazgos que no prueban su caso bajan a
  // observación (no se descartan). `ajustes` va en la respuesta.
  const { hallazgos: hallazgosValidados, ajustes } = validarDemostracion(b.hallazgos)

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      // 1) Auditoría con veredicto provisional (se recalcula al final).
      const aud = await tx.sigAnalisisAuditoria.create({
        data: {
          procedimientoId: b.procedimientoId,
          commitId: b.commitId ?? null,
          veredicto: "incompleto",
          resumenEjecutivo: b.resumenEjecutivo,
          reporteMarkdown: b.reporteMarkdown,
          normas: b.normas,
          alcanceArchivos: b.alcanceArchivos,
          modelosUsados: b.modelosUsados,
          tokensUsados: b.tokensUsados ?? null,
          autorId,
          autorNombre,
          operadorId: autorId,
          operadorNombre: b.operadorNombre ?? null,
        },
      })

      // Hallazgos ABIERTO previos del procedimiento -> para dedupe (§6.3) y para
      // detectar los "no mencionados" (§8.1).
      const previosAbiertos = await tx.sigHallazgo.findMany({
        where: { procedimientoId: b.procedimientoId, estado: "ABIERTO" },
        select: { id: true, dedupeKey: true },
      })
      const previosPorKey = new Map(previosAbiertos.map((h) => [h.dedupeKey, h.id]))

      // 2) Hallazgos nuevos: se omite el que ya existe ABIERTO con el mismo
      //    dedupeKey (es el mismo hallazgo de una corrida anterior).
      const deduplicados: string[] = []
      const aInsertar = hallazgosValidados.filter((h) => {
        if (previosPorKey.has(h.dedupeKey)) {
          deduplicados.push(h.dedupeKey)
          return false
        }
        return true
      })
      if (aInsertar.length) {
        await tx.sigHallazgo.createMany({
          data: aInsertar.map((h) => ({
            procedimientoId: b.procedimientoId,
            auditoriaId: aud.id,
            commitId: b.commitId ?? null,
            funcion: h.funcion,
            nivel: h.nivel,
            clasificacion: h.clasificacion,
            fragmento: h.fragmento,
            archivo: h.archivo ?? null,
            descripcion: h.descripcion,
            demostracion: h.demostracion ?? {},
            palabra: h.palabra ?? undefined,
            impacto: h.impacto ?? null,
            dedupeKey: h.dedupeKey,
            sustituyeA: h.sustituyeA ?? null,
          })),
        })
      }

      // 3) Consultas nuevas (ABIERTA).
      if (b.consultas.length) {
        await tx.sigConsulta.createMany({
          data: b.consultas.map((c) => ({
            procedimientoId: b.procedimientoId,
            auditoriaId: aud.id,
            tipo: c.tipo,
            funcion: c.funcion,
            fragmento: c.fragmento ?? null,
            documentoEsperado: c.documentoEsperado ?? null,
            motivo: c.motivo ?? null,
            preguntas: c.preguntas,
          })),
        })
      }

      // 4) Cierres: el agente cierra los hallazgos previos que esta versión
      //    resuelve (rúbrica §8). Solo aplica a hallazgos ABIERTO del mismo
      //    procedimiento.
      const cerradosIds: number[] = []
      for (const cierre of b.cierres) {
        const r = await tx.sigHallazgo.updateMany({
          where: { id: cierre.hallazgoId, procedimientoId: b.procedimientoId, estado: "ABIERTO" },
          data: {
            estado: "CERRADO",
            motivoCierre: cierre.motivo,
            evidenciaCierre: cierre.evidencia,
            cerradoPorId: autorId,
            cerradoNombre: autorNombre,
            cerradoEn: now,
          },
        })
        if (r.count > 0) cerradosIds.push(cierre.hallazgoId)
      }

      // §8.1 — hallazgos previos que esta corrida NI re-detectó (mismo
      //  dedupeKey) NI cerró. Quedan ABIERTO pero se reportan: el agente
      //  tiene que dar cuenta de todos.
      const keysEntrantes = new Set(hallazgosValidados.map((h) => h.dedupeKey))
      const noMencionados = previosAbiertos
        .filter((p) => !keysEntrantes.has(p.dedupeKey) && !cerradosIds.includes(p.id))
        .map((p) => p.id)

      // 5) Veredicto = estado ACTUAL del procedimiento tras esta corrida:
      //    todos los hallazgos ABIERTO + consultas ABIERTA.
      const abiertos = await tx.sigHallazgo.findMany({
        where: { procedimientoId: b.procedimientoId, estado: "ABIERTO" },
        select: { funcion: true, clasificacion: true },
      })
      const consultasAbiertas = await tx.sigConsulta.count({
        where: { procedimientoId: b.procedimientoId, estado: "ABIERTA" },
      })
      const { veredicto, veredictoPorFuncion, conteo } = derivarVeredicto(abiertos, consultasAbiertas)

      const auditoria = await tx.sigAnalisisAuditoria.update({
        where: { id: aud.id },
        data: { veredicto, veredictoPorFuncion, conteo },
        include: { hallazgos: true, consultas: true },
      })
      return { auditoria, deduplicados, cerradosIds, noMencionados }
    })

    res.status(201).json({
      ...resultado.auditoria,
      orquestacion: {
        ajustesDemostracion: ajustes,
        hallazgosDeduplicados: resultado.deduplicados,
        hallazgosCerrados: resultado.cerradosIds,
        hallazgosPreviosNoMencionados: resultado.noMencionados,
      },
    })
  } catch (e) {
    res.status(500).json({ error: "No se pudo guardar la auditoría", detail: String(e) })
  }
})

// ── GET /api/auditorias?procedimientoId=&limit= ──────────────────────────────
router.get("/auditorias", async (req: Request, res: Response) => {
  const { procedimientoId, limit } = req.query
  const auditorias = await prisma.sigAnalisisAuditoria.findMany({
    where: procedimientoId ? { procedimientoId: parseInt(procedimientoId as string) } : {},
    orderBy: { createdAt: "desc" },
    take: limit ? parseInt(limit as string) : 20,
    include: { _count: { select: { hallazgos: true, consultas: true } } },
  })
  res.json(auditorias)
})

// ── GET /api/auditorias/:id ─────────────────────────────────────────────────
router.get("/auditorias/:id", async (req: Request, res: Response) => {
  const aud = await prisma.sigAnalisisAuditoria.findUnique({
    where: { id: parseInt(req.params.id) },
    include: {
      hallazgos: { orderBy: [{ funcion: "asc" }, { id: "asc" }] },
      consultas: { orderBy: { id: "asc" } },
      procedimiento: { select: { codigo: true, titulo: true } },
    },
  })
  if (!aud) {
    res.status(404).json({ error: "Auditoría no encontrada" })
    return
  }
  res.json(aud)
})

// ── PATCH /api/auditorias/:id/validar — firma del humano ─────────────────────
router.patch("/auditorias/:id/validar", requireSigAccess, async (req: Request, res: Response) => {
  const userId = getUserId(req.user!)
  const userName = await resolveActorName(userId, req.user!.full_name)
  try {
    const updated = await prisma.sigAnalisisAuditoria.update({
      where: { id: parseInt(req.params.id) },
      data: { validadoPorId: userId, validadoNombre: userName, validadoEn: new Date() },
    })
    res.json(updated)
  } catch {
    res.status(404).json({ error: "Auditoría no encontrada" })
  }
})

// ── GET /api/hallazgos?procedimientoId=&estado= ──────────────────────────────
// Lo usa el orquestador del MCP para cargar los hallazgos ABIERTO antes de una
// re-corrida (rúbrica §7 / §8).
router.get("/hallazgos", async (req: Request, res: Response) => {
  const { procedimientoId, estado, funcion } = req.query
  const hallazgos = await prisma.sigHallazgo.findMany({
    where: {
      ...(procedimientoId ? { procedimientoId: parseInt(procedimientoId as string) } : {}),
      ...(estado ? { estado: (estado as string).toUpperCase() } : {}),
      ...(funcion ? { funcion: funcion as string } : {}),
    },
    orderBy: [{ estado: "asc" }, { funcion: "asc" }, { id: "asc" }],
  })
  res.json(hallazgos)
})

// ── PATCH /api/hallazgos/:id — cierre/reapertura manual (humano) ─────────────
const HallazgoPatch = z.object({
  estado: z.enum(["ABIERTO", "CERRADO"]),
  motivoCierre: z.string().nullable().optional(),
  evidenciaCierre: z.string().nullable().optional(),
})

router.patch("/hallazgos/:id", requireSigAccess, async (req: Request, res: Response) => {
  const parsed = HallazgoPatch.safeParse(req.body)
  if (!parsed.success) {
    res.status(422).json({ error: parsed.error.flatten() })
    return
  }
  const userId = getUserId(req.user!)
  const userName = await resolveActorName(userId, req.user!.full_name)
  const cerrar = parsed.data.estado === "CERRADO"

  try {
    const updated = await prisma.sigHallazgo.update({
      where: { id: parseInt(req.params.id) },
      data: {
        estado: parsed.data.estado,
        motivoCierre: cerrar ? parsed.data.motivoCierre ?? "Cierre manual" : null,
        evidenciaCierre: cerrar ? parsed.data.evidenciaCierre ?? null : null,
        cerradoPorId: cerrar ? userId : null,
        cerradoNombre: cerrar ? userName : null,
        cerradoEn: cerrar ? new Date() : null,
      },
    })
    res.json(updated)
  } catch {
    res.status(404).json({ error: "Hallazgo no encontrado" })
  }
})

// ── GET /api/consultas?procedimientoId=&estado= ─────────────────────────────
router.get("/consultas", async (req: Request, res: Response) => {
  const { procedimientoId, estado } = req.query
  const consultas = await prisma.sigConsulta.findMany({
    where: {
      ...(procedimientoId ? { procedimientoId: parseInt(procedimientoId as string) } : {}),
      ...(estado ? { estado: (estado as string).toUpperCase() } : {}),
    },
    orderBy: [{ estado: "asc" }, { id: "asc" }],
  })
  res.json(consultas)
})

// ── PATCH /api/consultas/:id — el usuario responde ──────────────────────────
const ConsultaPatch = z.object({
  respuestaUsuario: z.string().min(1),
  resolucion: z.enum([
    "sin_hallazgo",
    "observacion",
    "nc_menor",
    "nc_mayor",
    "otro_nombre",
    "indexado",
  ]),
})

router.patch("/consultas/:id", requireSigAccess, async (req: Request, res: Response) => {
  const parsed = ConsultaPatch.safeParse(req.body)
  if (!parsed.success) {
    res.status(422).json({ error: parsed.error.flatten() })
    return
  }
  const userId = getUserId(req.user!)
  const userName = await resolveActorName(userId, req.user!.full_name)

  try {
    const updated = await prisma.sigConsulta.update({
      where: { id: parseInt(req.params.id) },
      data: {
        respuestaUsuario: parsed.data.respuestaUsuario,
        resolucion: parsed.data.resolucion,
        estado: "RESUELTA",
        resueltoPorId: userId,
        resueltoNombre: userName,
        resueltoEn: new Date(),
      },
    })
    res.json(updated)
  } catch {
    res.status(404).json({ error: "Consulta no encontrada" })
  }
})

export default router
