import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  // Clean existing data (order matters for FK constraints)
  await prisma.helixAIConversacion.deleteMany()
  await prisma.helixAlerta.deleteMany()
  await prisma.helixEncuesta.deleteMany()
  await prisma.helixEvidencia.deleteMany()
  await prisma.helixComentario.deleteMany()
  await prisma.helixActividad.deleteMany()
  await prisma.helixSubproyecto.deleteMany()

  // Seed subproyectos
  const sp1 = await prisma.helixSubproyecto.create({
    data: { nombre: "Implementacion MVP", objetivo: "Herramienta base de gestion para Zymo", inversionEst: 18000000, retornoEsp: 32000000 }
  })
  const sp2 = await prisma.helixSubproyecto.create({
    data: { nombre: "Experiencia del cliente", objetivo: "Mejorar visibilidad, alertas y cumplimiento", inversionEst: 12000000, retornoEsp: 24500000 }
  })
  const sp3 = await prisma.helixSubproyecto.create({
    data: { nombre: "Automatizacion operativa", objetivo: "Alertas y seguimiento de responsables", inversionEst: 15000000, retornoEsp: 36000000 }
  })

  // Seed actividades (using fake responsable IDs — real users come from the intranet)
  const a1 = await prisma.helixActividad.create({
    data: {
      subproyectoId: sp1.id,
      responsableId: 1,
      responsableNombre: "Ana Ruiz",
      responsableInitials: "AR",
      responsableColor: "#ef3340",
      nombre: "Definir alcance del modulo de clientes",
      estado: "Terminado",
      prioridad: "Alta",
      fechaInicio: new Date("2026-05-01"),
      fechaFin: new Date("2026-05-04"),
      avance: 100,
      puntos: 5,
      costoInversion: 1800000,
      costoOptimizacion: 450000,
      costoEjecucion: 950000,
      bloqueada: false,
      completadaEn: new Date("2026-05-04"),
      comentarios: {
        create: [{ autorId: 1, autorNombre: "Ana Ruiz", texto: "Alcance aprobado por el equipo funcional.", canal: "web" }]
      }
    }
  })

  await prisma.helixActividad.create({
    data: {
      subproyectoId: sp1.id,
      responsableId: 2,
      responsableNombre: "Luisa Mora",
      responsableInitials: "LM",
      responsableColor: "#002f43",
      nombre: "Prototipo responsive para celular",
      estado: "Revision",
      prioridad: "Media",
      fechaInicio: new Date("2026-05-03"),
      fechaFin: new Date("2026-05-10"),
      avance: 82,
      puntos: 8,
      costoInversion: 4200000,
      costoOptimizacion: 900000,
      costoEjecucion: 2100000,
      bloqueada: false,
      dependenciaId: a1.id,
      comentarios: {
        create: [{ autorId: 2, autorNombre: "Luisa Mora", texto: "Pendiente validar experiencia en pantalla pequeña.", canal: "web" }]
      }
    }
  })

  await prisma.helixActividad.create({
    data: {
      subproyectoId: sp3.id,
      responsableId: 3,
      responsableNombre: "Carlos Diaz",
      responsableInitials: "CD",
      responsableColor: "#5461c8",
      nombre: "Integracion de alertas por correo",
      estado: "En curso",
      prioridad: "Alta",
      fechaInicio: new Date("2026-05-06"),
      fechaFin: new Date("2026-05-14"),
      avance: 46,
      puntos: 8,
      costoInversion: 2600000,
      costoOptimizacion: 700000,
      costoEjecucion: 1800000,
      bloqueada: true,
      comentarios: {
        create: [{ autorId: 3, autorNombre: "Carlos Diaz", texto: "Falta definir correo corporativo de salida.", canal: "web" }]
      }
    }
  })

  await prisma.helixActividad.create({
    data: {
      subproyectoId: sp3.id,
      responsableId: 4,
      responsableNombre: "Mateo Gil",
      responsableInitials: "MG",
      responsableColor: "#1f9d6a",
      nombre: "Reglas de analisis IA para riesgos",
      estado: "En curso",
      prioridad: "Alta",
      fechaInicio: new Date("2026-05-08"),
      fechaFin: new Date("2026-05-17"),
      avance: 35,
      puntos: 13,
      costoInversion: 5200000,
      costoOptimizacion: 1500000,
      costoEjecucion: 2400000,
      bloqueada: false,
    }
  })

  await prisma.helixActividad.create({
    data: {
      subproyectoId: sp2.id,
      responsableId: 1,
      responsableNombre: "Ana Ruiz",
      responsableInitials: "AR",
      responsableColor: "#ef3340",
      nombre: "Plantilla de estado semanal",
      estado: "Planificado",
      prioridad: "Media",
      fechaInicio: new Date("2026-05-12"),
      fechaFin: new Date("2026-05-18"),
      avance: 15,
      puntos: 3,
      costoInversion: 1200000,
      costoOptimizacion: 350000,
      costoEjecucion: 600000,
      bloqueada: false,
    }
  })

  await prisma.helixActividad.create({
    data: {
      subproyectoId: sp2.id,
      responsableId: 2,
      responsableNombre: "Luisa Mora",
      responsableInitials: "LM",
      responsableColor: "#002f43",
      nombre: "Backlog de mejoras posteriores",
      estado: "Backlog",
      prioridad: "Baja",
      fechaInicio: new Date("2026-05-18"),
      fechaFin: new Date("2026-05-22"),
      avance: 0,
      puntos: 2,
      costoInversion: 900000,
      costoOptimizacion: 250000,
      costoEjecucion: 400000,
      bloqueada: false,
    }
  })

  console.log("✅ Helix seed completado")
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
