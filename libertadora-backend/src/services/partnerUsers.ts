import bcrypt from "bcryptjs"
import { z } from "zod"
import { prisma } from "../config/prisma"

export const CreatePartnerUserBody = z.object({
  email: z.string().trim().toLowerCase().email("Correo inválido"),
  nombre: z.string().trim().optional(),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
})

export const ResetPasswordBody = z.object({
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
})

export async function listPartnerUsers() {
  return prisma.libertadoraPartnerUser.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, nombre: true, active: true, createdAt: true, lastLoginAt: true },
  })
}

export async function createPartnerUser(data: z.infer<typeof CreatePartnerUserBody>) {
  const passwordHash = await bcrypt.hash(data.password, 12)
  const user = await prisma.libertadoraPartnerUser.create({
    data: { email: data.email, nombre: data.nombre, passwordHash },
  })
  return { id: user.id, email: user.email, nombre: user.nombre, active: user.active, createdAt: user.createdAt }
}

const SAFE_FIELDS = { id: true, email: true, nombre: true, active: true, createdAt: true, lastLoginAt: true } as const

export async function setPartnerUserActive(id: string, active: boolean) {
  return prisma.libertadoraPartnerUser.update({ where: { id }, data: { active }, select: SAFE_FIELDS })
}

export async function resetPartnerUserPassword(id: string, password: string) {
  const passwordHash = await bcrypt.hash(password, 12)
  return prisma.libertadoraPartnerUser.update({ where: { id }, data: { passwordHash } })
}

/** Devuelve el usuario si el email existe, está activo y la contraseña coincide; null en cualquier otro caso. */
export async function verifyPartnerLogin(email: string, password: string) {
  const user = await prisma.libertadoraPartnerUser.findUnique({ where: { email: email.trim().toLowerCase() } })
  if (!user || !user.active) return null
  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) return null
  await prisma.libertadoraPartnerUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
  return user
}
