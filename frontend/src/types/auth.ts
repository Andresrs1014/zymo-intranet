export type UserRole = string

export interface User {
  id: number
  email: string
  full_name: string | null
  role: UserRole
  sede: string | null
  area: string | null
  is_active: boolean
  app_permissions?: string[]
  user_tools?: string[]
  is_team_member?: boolean
}

export interface TokenResponse {
  access_token: string
  token_type: string
}

export interface UserListItem extends User {
  created_at: string
  last_login_at: string | null
}
