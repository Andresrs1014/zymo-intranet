export type TicketView = "list" | "board" | "dashboard"

export interface TicketAction {
  id: number
  ticketId: number
  createdAt: string
  texto: string
}

export interface TicketEvidence {
  id: number
  ticketId: number
  createdAt: string
  filename: string
  url: string | null
}

export interface Ticket {
  id: number
  code: string
  createdAt: string
  monthKey: string
  area: string
  areaPrefix: string
  client: string | null
  platform: string | null
  supervisor: string | null
  supervisorEmail: string | null
  analyst: string | null
  analystEmail: string | null
  coordinator: string | null
  coordinatorEmail: string | null
  manager: string | null
  managerEmail: string | null
  phone: string | null
  email: string | null
  owner: string | null
  date: string
  dueDate: string | null
  type: string
  status: string
  priority: string
  impact: string | null
  channel: string | null
  managementCriteria: string | null
  closedDate: string | null
  closedAt: string | null
  description: string | null
  actions: TicketAction[]
  evidence: TicketEvidence[]
  /** Calculado en el backend (Fase C) — horas laborales 7am-7pm. */
  slaLimitHours: number | null
  slaElapsedHours: number
  slaOverdue: boolean | null
}

export interface CreateTicketInput {
  area: string
  areaPrefix: string
  client?: string
  platform?: string
  supervisor?: string
  analyst?: string
  coordinator?: string
  manager?: string
  phone?: string
  email?: string
  owner?: string
  date: string
  dueDate?: string
  type: string
  status: string
  priority: string
  impact?: string
  channel?: string
  managementCriteria?: string
  description?: string
  actionsInitial?: string
  evidence?: File[]
}

export interface TicketListItem {
  id: number
  value: string
  label: string
  /** Solo tiene valor real en la lista "priorities" (Fase C — SLA por prioridad). */
  slaHours?: number | null
}

export interface TicketConfigLists {
  clients: TicketListItem[]
  platforms: TicketListItem[]
  supervisors: TicketListItem[]
  analysts: TicketListItem[]
  coordinators: TicketListItem[]
  managers: TicketListItem[]
  generators: TicketListItem[]
  phones: TicketListItem[]
  emails: TicketListItem[]
  impacts: TicketListItem[]
  types: TicketListItem[]
  statuses: TicketListItem[]
  priorities: TicketListItem[]
  channels: TicketListItem[]
  managementCriteria: TicketListItem[]
}

export interface TicketAreaPrefix {
  id: number
  area: string
  prefix: string
  isActive: boolean
  sortOrder: number
}

export interface TicketDashboardMetrics {
  total: number
  open: number
  critical: number
  withEvidence: number
  due: number
  overLimit: number
  closed: number
  byStatus: Record<string, number>
  byType: Record<string, number>
  byArea: Record<string, number>
}

export interface ScoreLeaderboardEntry {
  label: string
  avgScore: number
  count: number
  resolved: number
}

export interface ScoreLeaderboards {
  byPlatform: ScoreLeaderboardEntry[]
  byPerson: ScoreLeaderboardEntry[]
}

export interface TicketDashboardResult {
  metrics: TicketDashboardMetrics
  aiAnalysis: string[]
  /** Score de calidad de gestión (0-100, pesos provisionales) — ver
   * docs/superpowers/specs/2026-07-17-zymoally-score-gestion-design.md */
  scoreLeaderboards: ScoreLeaderboards
}
