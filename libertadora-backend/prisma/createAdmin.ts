import "dotenv/config"
import bcrypt from "bcryptjs"
import { prisma } from "../src/config/prisma"

// Bootstrap de la primera cuenta -- necesario porque crear cuentas nuevas
// requiere ya ser admin (huevo y gallina). Corre una sola vez por servidor:
//   npx ts-node prisma/createAdmin.ts correo@ejemplo.com "contraseña" "Nombre"
// Si el correo ya existe, solo actualiza la contraseña y lo vuelve admin --
// seguro de correr más de una vez.
async function main() {
  const [email, password, nombre] = process.argv.slice(2)
  if (!email || !password) {
    console.error('Uso: npx ts-node prisma/createAdmin.ts correo@ejemplo.com "contraseña" "Nombre (opcional)"')
    process.exitCode = 1
    return
  }
  const passwordHash = await bcrypt.hash(password, 12)
  const user = await prisma.libertadoraUser.upsert({
    where: { email: email.trim().toLowerCase() },
    create: { email: email.trim().toLowerCase(), nombre: nombre ?? null, passwordHash, isAdmin: true },
    update: { passwordHash, isAdmin: true, active: true },
  })
  console.log(`Cuenta admin lista: ${user.email} (id ${user.id})`)
}

main()
  .catch((err) => {
    console.error("Error creando la cuenta admin:", err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
