import { prisma } from "../config/prisma"
import type { SubactividadInput } from "./actividadService"

/**
 * Single responsibility: crear un Plan de trabajo (Subproyecto tipo=PlanDeTrabajo,
 * sin Proyecto principal ni ROI) y repartir sus "actividades iniciales" en
 * bloques de fecha secuenciales, replicando las mismas subactividades base en
 * cada una — mismo algoritmo que el prototipo original (buildWorkPlanTasks),
 * todo en una transacción.
 */

export class PlanTrabajoValidationError extends Error {}

const MS_POR_DIA = 24 * 60 * 60 * 1000

export interface PlanTrabajoInput {
  nombre: string
  objetivo?: string
  liderResponsableId: number
  liderResponsableNombre: string
  liderResponsableInitials: string
  liderResponsableColor?: string
  fechaInicio: string
  fechaFin: string
  actividades: string[]
  subactividadesBase?: SubactividadInput[]
}

function sumarDias(fechaIso: string, dias: number): string {
  const fecha = new Date(`${fechaIso}T12:00:00`)
  fecha.setDate(fecha.getDate() + dias)
  return fecha.toISOString().slice(0, 10)
}

export async function crearPlanDeTrabajo(input: PlanTrabajoInput) {
  const nombresActividades = input.actividades.map((a) => a.trim()).filter(Boolean)
  if (nombresActividades.length === 0) {
    throw new PlanTrabajoValidationError("El plan necesita al menos una actividad")
  }
  if (new Date(input.fechaFin) < new Date(input.fechaInicio)) {
    throw new PlanTrabajoValidationError("La fecha fin debe ser igual o posterior a la fecha de inicio")
  }

  const inicio = new Date(`${input.fechaInicio}T12:00:00`)
  const fin = new Date(`${input.fechaFin}T12:00:00`)
  const totalDias = Math.max(0, Math.round((fin.getTime() - inicio.getTime()) / MS_POR_DIA))
  const paso = Math.max(1, Math.ceil((totalDias + 1) / nombresActividades.length))

  return prisma.$transaction(async (tx) => {
    const plan = await tx.helixSubproyecto.create({
      data: {
        nombre: input.nombre,
        objetivo: input.objetivo ?? null,
        tipo: "PlanDeTrabajo",
        proyectoId: null,
      },
    })

    const actividadesCreadas = []
    for (let index = 0; index < nombresActividades.length; index++) {
      const inicioActividad = sumarDias(input.fechaInicio, Math.min(totalDias, index * paso))
      const finActividadCalculado =
        index === nombresActividades.length - 1
          ? input.fechaFin
          : sumarDias(inicioActividad, Math.max(0, Math.min(paso - 1, totalDias)))
      const finActividad = finActividadCalculado > input.fechaFin ? input.fechaFin : finActividadCalculado

      const actividad = await tx.helixActividad.create({
        data: {
          subproyectoId: plan.id,
          responsableId: input.liderResponsableId,
          responsableNombre: input.liderResponsableNombre,
          responsableInitials: input.liderResponsableInitials,
          responsableColor: input.liderResponsableColor ?? "#5461c8",
          nombre: nombresActividades[index],
          estado: index === 0 ? "Planificado" : "Backlog",
          prioridad: index === 0 ? "Alta" : "Media",
          fechaInicio: new Date(inicioActividad),
          fechaFin: new Date(finActividad),
        },
      })

      if (input.subactividadesBase?.length) {
        await tx.helixSubactividad.createMany({
          data: input.subactividadesBase.map((s) => ({
            actividadId: actividad.id,
            nombre: s.nombre,
            responsableId: s.responsableId ?? null,
            responsableNombre: s.responsableNombre ?? null,
            estado: s.estado ?? "Planificado",
          })),
        })
      }

      if (input.objetivo?.trim()) {
        await tx.helixComentario.create({
          data: {
            actividadId: actividad.id,
            autorId: input.liderResponsableId,
            autorNombre: input.liderResponsableNombre,
            texto: `Objetivo del plan: ${input.objetivo.trim()}`,
            canal: "web",
          },
        })
      }

      actividadesCreadas.push(actividad)
    }

    return { plan, actividades: actividadesCreadas }
  })
}
