// Ejecutar una sola vez: npx ts-node prisma/backfillTicketTypes.ts
// Agrega los tipos de ticket de operación interna a instalaciones que ya
// tenían sembrado el listType "types" (el guard de seed.ts es todo-o-nada
// por grupo, así que un seed nuevo no los agrega a una BD existente).
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const NEW_TYPES = [
  "Novedad de proceso",
  "Faltante o inconsistencia",
  "Mantenimiento de instalaciones",
  "Capacitación de personal",
  "Corrección de procedimiento",
  "OKR",
]

async function main() {
  const existing = await prisma.zymoConfigList.findMany({ where: { listType: "types" } })
  const maxSortOrder = existing.reduce((max, item) => Math.max(max, item.sortOrder), -1)

  const result = await prisma.zymoConfigList.createMany({
    data: NEW_TYPES.map((value, index) => ({
      listType: "types",
      value,
      label: value,
      sortOrder: maxSortOrder + 1 + index,
    })),
    skipDuplicates: true,
  })

  console.log(`Backfill listo: ${result.count} tipo(s) nuevo(s) insertado(s) (de ${NEW_TYPES.length}, duplicados omitidos).`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
