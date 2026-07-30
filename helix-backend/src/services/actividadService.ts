import { prisma } from "../config/prisma"
import { Column, Priority } from "../utils/constants"

/**
 * Single responsibility: orchestrate the creation of an Actividad together with
 * the nested data the "Gestión de proyecto" form captures in one shot
 * (subactividades + comentario inicial), inside one transaction.
 *
 * Everything after creation (more comentarios, evidencias, subactividades)
 * goes through their own dedicated routers — this service does not touch them.
 */

export class ActividadValidationError extends Error {}

export interface SubactividadInput {
  nombre: string
  responsableId?: number | null
  responsableNombre?: string | null
  estado?: Column
}

export interface ActividadCreateInput {
  subproyectoId: number
  numeroActividad?: string | null
  responsableId: number
  responsableNombre: string
  responsableInitials: string
  responsableColor?: string
  nombre: string
  estado?: Column
  prioridad?: Priority
  fechaInicio: string
  fechaFin: string
  avance?: number
  puntos?: number
  costoInversion?: number
  costoOptimizacion?: number
  costoEjecucion?: number
  bloqueada?: boolean
  dependenciaId?: number | null
  subactividades?: SubactividadInput[]
  comentarioInicial?: string
}

export interface Autor {
  id: number
  nombre: string
}

function assertFechasValidas(fechaInicio: string, fechaFin: string) {
  if (new Date(fechaFin) < new Date(fechaInicio)) {
    throw new ActividadValidationError("La fecha fin debe ser igual o posterior a la fecha de inicio")
  }
}

export async function crearActividadCompleta(input: ActividadCreateInput, autor: Autor) {
  assertFechasValidas(input.fechaInicio, input.fechaFin)

  const subproyecto = await prisma.helixSubproyecto.findUnique({ where: { id: input.subproyectoId } })
  if (!subproyecto) {
    throw new ActividadValidationError("El subproyecto seleccionado no existe")
  }

  if (input.dependenciaId != null) {
    const dependencia = await prisma.helixDependencia.findUnique({ where: { id: input.dependenciaId } })
    if (!dependencia) {
      throw new ActividadValidationError("La dependencia seleccionada no existe")
    }
  }

  return prisma.$transaction(async (tx) => {
    const actividad = await tx.helixActividad.create({
      data: {
        subproyectoId: input.subproyectoId,
        numeroActividad: input.numeroActividad ?? null,
        responsableId: input.responsableId,
        responsableNombre: input.responsableNombre,
        responsableInitials: input.responsableInitials,
        responsableColor: input.responsableColor ?? "#5461c8",
        nombre: input.nombre,
        estado: input.estado ?? "Backlog",
        prioridad: input.prioridad ?? "Media",
        fechaInicio: new Date(input.fechaInicio),
        fechaFin: new Date(input.fechaFin),
        avance: input.avance ?? 0,
        puntos: input.puntos ?? 3,
        costoInversion: input.costoInversion ?? 0,
        costoOptimizacion: input.costoOptimizacion ?? 0,
        costoEjecucion: input.costoEjecucion ?? 0,
        bloqueada: input.bloqueada ?? false,
        dependenciaId: input.dependenciaId ?? null,
      },
    })

    if (input.subactividades?.length) {
      await tx.helixSubactividad.createMany({
        data: input.subactividades.map((s) => ({
          actividadId: actividad.id,
          nombre: s.nombre,
          responsableId: s.responsableId ?? null,
          responsableNombre: s.responsableNombre ?? null,
          estado: s.estado ?? "Planificado",
        })),
      })
    }

    const comentarioInicial = input.comentarioInicial?.trim()
    if (comentarioInicial) {
      await tx.helixComentario.create({
        data: {
          actividadId: actividad.id,
          autorId: autor.id,
          autorNombre: autor.nombre,
          texto: comentarioInicial,
          canal: "web",
        },
      })
    }

    return tx.helixActividad.findUniqueOrThrow({
      where: { id: actividad.id },
      include: { subactividades: true, comentarios: true, evidencias: true },
    })
  })
}

export type ActividadUpdateInput = Omit<ActividadCreateInput, "subactividades" | "comentarioInicial">

export async function actualizarActividad(id: number, input: ActividadUpdateInput) {
  assertFechasValidas(input.fechaInicio, input.fechaFin)

  const existente = await prisma.helixActividad.findUnique({ where: { id } })
  if (!existente) {
    return null
  }

  if (input.dependenciaId != null) {
    const dependencia = await prisma.helixDependencia.findUnique({ where: { id: input.dependenciaId } })
    if (!dependencia) {
      throw new ActividadValidationError("La dependencia seleccionada no existe")
    }
  }

  const completadaEn =
    input.estado === "Terminado" && existente.estado !== "Terminado"
      ? new Date()
      : input.estado !== "Terminado"
        ? null
        : existente.completadaEn

  return prisma.helixActividad.update({
    where: { id },
    data: {
      subproyectoId: input.subproyectoId,
      numeroActividad: input.numeroActividad ?? null,
      responsableId: input.responsableId,
      responsableNombre: input.responsableNombre,
      responsableInitials: input.responsableInitials,
      responsableColor: input.responsableColor ?? "#5461c8",
      nombre: input.nombre,
      estado: input.estado ?? "Backlog",
      prioridad: input.prioridad ?? "Media",
      fechaInicio: new Date(input.fechaInicio),
      fechaFin: new Date(input.fechaFin),
      avance: input.avance ?? 0,
      puntos: input.puntos ?? 3,
      costoInversion: input.costoInversion ?? 0,
      costoOptimizacion: input.costoOptimizacion ?? 0,
      costoEjecucion: input.costoEjecucion ?? 0,
      bloqueada: input.bloqueada ?? false,
      dependenciaId: input.dependenciaId ?? null,
      completadaEn,
    },
  })
}
