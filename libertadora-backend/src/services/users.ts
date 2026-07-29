import bcrypt from "bcryptjs"
import { z } from "zod"
import { prisma } from "../config/prisma"

export const CreateUserBody = z.object({
  email: z.string().trim().toLowerCase().email("Correo inválido"),
  nombre: z.string().trim().optional(),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  isAdmin: z.boolean().optional().default(false),
})

export const ResetPasswordBody = z.object({
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
})

const SAFE_FIELDS = { id: true, email: true, nombre: true, isAdmin: true, active: true, createdAt: true, lastLoginAt: true } as const

export async function listUsers() {
  return prisma.libertadoraUser.findMany({ orderBy: { createdAt: "desc" }, select: SAFE_FIELDS })
}

export async function createUser(data: z.infer<typeof CreateUserBody>) {
  const passwordHash = await bcrypt.hash(data.password, 12)
  return prisma.libertadoraUser.create({
    data: { email: data.email, nombre: data.nombre, passwordHash, isAdmin: data.isAdmin },
    select: SAFE_FIELDS,
  })
}

export async function setUserActive(id: string, active: boolean) {
  return prisma.libertadoraUser.update({ where: { id }, data: { active }, select: SAFE_FIELDS })
}

export async function setUserAdmin(id: string, isAdmin: boolean) {
  return prisma.libertadoraUser.update({ where: { id }, data: { isAdmin }, select: SAFE_FIELDS })
}

export async function resetUserPassword(id: string, password: string) {
  const passwordHash = await bcrypt.hash(password, 12)
  await prisma.libertadoraUser.update({ where: { id }, data: { passwordHash } })
}

/** Devuelve el usuario si el email existe, está activo y la contraseña coincide; null en cualquier otro caso. */
export async function verifyLogin(email: string, password: string) {
  const user = await prisma.libertadoraUser.findUnique({ where: { email: email.trim().toLowerCase() } })
  if (!user || !user.active) return null
  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) return null
  await prisma.libertadoraUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
  return user
}
