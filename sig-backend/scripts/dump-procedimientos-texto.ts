// Solo lectura -- dump del texto vigente de cada procedimiento para analisis
// externo (no toca nada). Imprime JSON a stdout: id, codigo, titulo, area,
// texto del ultimo commit aprobado, y flujograma si existe.
//
// Uso:
//   npx ts-node scripts/dump-procedimientos-texto.ts > /tmp/procedimientos.json

import prisma from "../src/config/prisma"

async function main() {
  const procedimientos = await prisma.sigProcedimiento.findMany({
    orderBy: { id: "asc" },
    include: {
      area: { select: { nombre: true } },
      commits: {
        where: { estado: "APROBADO" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { contenidoAgente: true, flujogramaMmd: true, versionDoc: true },
      },
    },
  })

  const salida = procedimientos.map((p) => {
    const ultimo = p.commits[0]
    return {
      id:            p.id,
      codigo:        p.codigo,
      titulo:        p.titulo,
      area:          p.area.nombre,
      versionDoc:    ultimo?.versionDoc ?? null,
      texto:         ultimo?.contenidoAgente ?? null,
      flujogramaMmd: ultimo?.flujogramaMmd ?? null,
    }
  })

  console.log(JSON.stringify(salida, null, 2))
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
