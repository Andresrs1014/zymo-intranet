export type UserRole =
  | "admin"
  | "directivo"
  | "talento_cultura"
  | "comercial"
  | "operativo"
  | "empleado"
  | string  // permite roles futuros sin cambios de tipo

export interface User {
  id: number
  email: string
  full_name: string | null
  role: UserRole
  sede: string | null   // IMCCARGO / LOGIMAT / IMC Depósito → futuro: sede
  area: string | null   // Comercial / Operaciones / RRHH / etc.
  is_active: boolean
}

export interface TokenResponse {
  access_token: string
  token_type: string
}

export interface UserListItem extends User {
  created_at: string
  last_login_at: string | null
}
