export type SacView = "dashboard" | "records"

export interface ClientSurvey {
  id: number
  createdAt: string
  date: string
  company: string | null
  role: string | null
  email: string | null
  phone: string | null
  nps: number
  npsCategory: string
  satisfaction: number
  delivery: number
  attention: number
  meeting: number
  solution: number
  valuedAspect: string | null
  issue: string | null
  comment: string | null
  nextStep: string | null
}

export interface ExperienceSurvey {
  id: number
  createdAt: string
  date: string
  company: string | null
  contact: string | null
  email: string | null
  phone: string | null
  fit: string | null
  futureValue: number
  clarity: string | null
  exceededExpectations: string | null
  actionToday: string | null
  professionalSatisfaction: number
  meetingFit: number
  leadershipComment: string | null
  satisfaction: number
  solution: number
  nextStep: string | null
}

export interface VisitReport {
  id: number
  createdAt: string
  date: string
  commercial: string | null
  client: string
  contact: string | null
  outcome: string | null
  nextDate: string | null
  quality: number
  clientMood: number
  opportunity: number
  urgency: number
  observations: string | null
  actionPlan: string | null
}

export type RecordGroup = "client" | "commercial" | "visit"

// Registro unificado que devuelve GET /api/sac/dashboard — union laxa porque
// mezcla los 3 modelos con campos que no todos comparten.
export type SacRecord = (ClientSurvey | ExperienceSurvey | VisitReport) & {
  recordType: string
  recordGroup: RecordGroup
}

export interface CreateVisitInput {
  date?: string
  commercial?: string
  client: string
  contact?: string
  outcome?: string
  nextDate?: string
  quality: number
  clientMood: number
  opportunity: number
  urgency: number
  observations?: string
  actionPlan?: string
}

export interface SacRecordFilters {
  type?: RecordGroup
  status?: "risk" | "positive" | "followup"
  search?: string
}

export interface SacChartPoint {
  label: string
  value: number
}

export interface SacDashboardResult {
  records: SacRecord[]
  clientMetrics: {
    respuestas: number
    satisfaccion: number
    nps: number
    entregas: number
    atencion: number
    riesgos: number
  }
  commercialMetrics: {
    respuestas: number
    valorReunion: number
    atencion: number
    reunion: number
    claridadCritica: number
    seguimientos: number
  }
  charts: {
    clientBar: SacChartPoint[]
    commercialBar: SacChartPoint[]
    clientPie: SacChartPoint[]
    commercialPie: SacChartPoint[]
  }
  aiAnalysis: string[]
  strategies: string[]
}

export interface SurveyMagicLinkResult {
  token: string
  url: string
}
