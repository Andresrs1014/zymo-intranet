import { Router, Request, Response } from "express"
import { z } from "zod"
import prisma from "../config/prisma"

// Buscador del SIG: procedimientos, instructivos, protocolos, formatos y documentos anexos (políticas, etc.) en una sola consulta.
// Los líderes de área (`req.sigAreaIds`) solo encuentran lo de su carpeta. Se filtra aquí y no en SQL para ignorar tildes y mayúsculas.
const router = Router()

const POR_TIPO = 6
const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()

const procSel = { select: { id: true, codigo: true, titulo: true, area: { select: { id: true, nombre: true, color: true } } } } as const

router.get("/", async (req: Request, res: Response) => {
  const q = z.string().trim().min(2).max(80).safeParse(req.query.q)
  if (!q.success) { res.json({ resultados: [] }); return }
  const aguja = fold(q.data)
  const alcance = req.sigAreaIds ? { areaId: { in: req.sigAreaIds } } : {}
  const dePropio = req.sigAreaIds ? { procedimiento: { areaId: { in: req.sigAreaIds } } } : {}

  const [procs, inst, prot, form, anex] = await Promise.all([
    prisma.sigProcedimiento.findMany({ where: alcance, select: { id: true, codigo: true, titulo: true, area: { select: { id: true, nombre: true, color: true } } } }),
    prisma.sigInstructivo.findMany({ where: { activo: true, ...dePropio }, select: { id: true, codigo: true, titulo: true, estado: true, procedimiento: procSel } }),
    prisma.sigProtocolo.findMany({ where: { activo: true, ...dePropio }, select: { id: true, codigo: true, titulo: true, procedimiento: procSel } }),
    prisma.sigFormato.findMany({ where: dePropio, select: { id: true, nombre: true, nombreArchivo: true, estado: true, procedimiento: procSel } }),
    prisma.sigDocAnexo.findMany({ where: dePropio, select: { id: true, nombre: true, nombreArchivo: true, estado: true, procedimiento: procSel } }),
  ])

  // lo que empieza con lo escrito va primero; después lo que solo lo contiene
  const elegir = <T,>(filas: T[], texto: (f: T) => string, codigo: (f: T) => string) =>
    filas
      .map((f) => ({ f, t: fold(texto(f)), c: fold(codigo(f)) }))
      .filter((x) => x.t.includes(aguja))
      .sort((a, b) => Number(b.c.startsWith(aguja)) - Number(a.c.startsWith(aguja)) || a.t.localeCompare(b.t))
      .slice(0, POR_TIPO)
      .map((x) => x.f)

  res.json({
    resultados: [
      ...elegir(procs, (p) => `${p.codigo} ${p.titulo} ${p.area.nombre}`, (p) => p.codigo).map((p) => ({
        tipo: "procedimiento", id: p.id, codigo: p.codigo, titulo: p.titulo, procedimiento: { id: p.id, codigo: p.codigo, titulo: p.titulo, area: p.area },
      })),
      ...elegir(inst, (i) => `${i.codigo} ${i.titulo}`, (i) => i.codigo).map((i) => ({ tipo: "instructivo", id: i.id, codigo: i.codigo, titulo: i.titulo, estado: i.estado, procedimiento: i.procedimiento })),
      ...elegir(prot, (p) => `${p.codigo} ${p.titulo}`, (p) => p.codigo).map((p) => ({ tipo: "protocolo", id: p.id, codigo: p.codigo, titulo: p.titulo, procedimiento: p.procedimiento })),
      ...elegir(form, (f) => `${f.nombre} ${f.nombreArchivo}`, (f) => f.nombre).map((f) => ({ tipo: "formato", id: f.id, titulo: f.nombre, archivo: f.nombreArchivo, estado: f.estado, procedimiento: f.procedimiento })),
      ...elegir(anex, (a) => `${a.nombre} ${a.nombreArchivo}`, (a) => a.nombre).map((a) => ({ tipo: "anexo", id: a.id, titulo: a.nombre, archivo: a.nombreArchivo, estado: a.estado, procedimiento: a.procedimiento })),
    ],
  })
})

export default router
