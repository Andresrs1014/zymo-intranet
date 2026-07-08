import { PrismaClient } from "@prisma/client"
import { PQR_LIST_TYPES, SAC_LIST_TYPES, defaultAreaPrefixes, defaultPqrConfig, defaultSacConfig } from "../src/utils/constants"

const prisma = new PrismaClient()

async function main() {
  const existingPqrLists = await prisma.zymoConfigList.count({ where: { listType: { in: [...PQR_LIST_TYPES] } } })
  if (existingPqrLists === 0) {
    await prisma.zymoConfigList.createMany({
      data: PQR_LIST_TYPES.flatMap((listType) =>
        defaultPqrConfig[listType].map((value, index) => ({ listType, value, label: value, sortOrder: index }))
      ),
    })
    console.log("Seed: ZymoConfigList poblado con maestros PQR por defecto.")
  }

  const existingSacLists = await prisma.zymoConfigList.count({ where: { listType: { in: [...SAC_LIST_TYPES] } } })
  if (existingSacLists === 0) {
    await prisma.zymoConfigList.createMany({
      data: SAC_LIST_TYPES.flatMap((listType) =>
        defaultSacConfig[listType].map((item, index) => ({ listType, value: item.value, label: item.label, sortOrder: index }))
      ),
    })
    console.log("Seed: ZymoConfigList poblado con opciones de formularios SAC por defecto.")
  }

  const existingAreas = await prisma.zymoAreaPrefix.count()
  if (existingAreas === 0) {
    await prisma.zymoAreaPrefix.createMany({
      data: defaultAreaPrefixes.map((item, index) => ({ ...item, sortOrder: index })),
    })
    console.log("Seed: ZymoAreaPrefix poblado con áreas por defecto.")
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
