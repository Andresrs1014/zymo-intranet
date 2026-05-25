import { PrismaClient, ListType } from "@prisma/client"

const prisma = new PrismaClient()

const DEFAULT_ESTADOS = [
  { value: "pendiente",   label: "Pendiente",   color: "#9ca3af", sortOrder: 0, isInitialAssignment: true },
  { value: "en_progreso", label: "En progreso", color: "#60a5fa", sortOrder: 1 },
  { value: "revision",    label: "Revisión",    color: "#a78bfa", sortOrder: 2 },
  { value: "completada",  label: "Completada",  color: "#22c55e", sortOrder: 3, isFinal: true },
  { value: "cancelada",   label: "Cancelada",   color: "#ef4444", sortOrder: 4, isCanceled: true },
]

const DEFAULT_ETIQUETAS = [
  { value: "desarrollos",       label: "Desarrollos",       color: "#60a5fa", sortOrder: 0 },
  { value: "actualizaciones",   label: "Actualizaciones",   color: "#a78bfa", sortOrder: 1 },
  { value: "auditorias",        label: "Auditorías",        color: "#f59e0b", sortOrder: 2 },
  { value: "implementacion_okr",label: "Implementación OKR",color: "#2dd4bf", sortOrder: 3 },
  { value: "tareas_diarias",    label: "Tareas diarias",    color: "#9ca3af", sortOrder: 4 },
]

const DEFAULT_PLATAFORMAS = [
  { value: "intranet", label: "Intranet", sortOrder: 0 },
  { value: "crm",      label: "CRM",      sortOrder: 1 },
  { value: "erp",      label: "ERP",      sortOrder: 2 },
]

async function seedTeamLists(teamId: number) {
  for (const e of DEFAULT_ESTADOS) {
    await prisma.listConfig.upsert({
      where: { teamId_listType_value: { teamId, listType: ListType.estado, value: e.value } },
      update: {},
      create: { teamId, listType: ListType.estado, ...e },
    })
  }
  for (const e of DEFAULT_ETIQUETAS) {
    await prisma.listConfig.upsert({
      where: { teamId_listType_value: { teamId, listType: ListType.etiqueta, value: e.value } },
      update: {},
      create: { teamId, listType: ListType.etiqueta, ...e },
    })
  }
  for (const p of DEFAULT_PLATAFORMAS) {
    await prisma.listConfig.upsert({
      where: { teamId_listType_value: { teamId, listType: ListType.plataforma, value: p.value } },
      update: {},
      create: { teamId, listType: ListType.plataforma, ...p },
    })
  }
}

async function main() {
  // Create a demo team for testing (owner user id 1)
  const team = await prisma.team.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, name: "Equipo Demo", ownerUserId: 1 },
  })

  await seedTeamLists(team.id)

  console.log("✅ task-backend seed completado")
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())

export { seedTeamLists, DEFAULT_ESTADOS, DEFAULT_ETIQUETAS, DEFAULT_PLATAFORMAS }
