// Lo que sig_review_context del MCP tiene que poder leer de un procedimiento:
// protocolos y citas (resueltas y rotas), junto con instructivos y formatos.

import prisma from "../config/prisma"

export async function cargarVinculos(procedimientoId: number) {
  const [instructivos, protocolos, formatos, referencias] = await Promise.all([
    prisma.sigInstructivo.findMany({
      where: { procedimientoId, activo: true },
      orderBy: { codigo: "asc" },
      select: { id: true, codigo: true, titulo: true, contenido: true },
    }),
    prisma.sigProtocolo.findMany({
      where: { procedimientoId, activo: true },
      orderBy: { codigo: "asc" },
      select: { id: true, codigo: true, titulo: true, contenido: true },
    }),
    prisma.sigFormato.findMany({
      where: { procedimientoId },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true, nombreArchivo: true, instructivoId: true },
    }),
    prisma.sigReferencia.findMany({
      where: { procedimientoId },
      orderBy: [{ estado: "asc" }, { destinoCodigo: "asc" }],
    }),
  ])
  return { instructivos, protocolos, referencias, formatos }
}
