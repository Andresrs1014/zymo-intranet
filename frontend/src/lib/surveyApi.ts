// Cliente del formulario público de encuestas (/e/:surveyType) — sin sesión de
// intranet, el único auth es el token del magic-link. No reusar zymoallyApi.ts
// (ese inyecta el JWT de sesión vía interceptor, no aplica acá).
const API_URL = import.meta.env.VITE_ZYMOALLY_API_URL ?? "http://localhost:3005"

export type ChoiceOption = { value: string; label: string }

export type SurveyConfig = {
  surveyValueChoices: ChoiceOption[]
  surveyIssues: ChoiceOption[]
  experienceFitChoices: ChoiceOption[]
  experienceClarityChoices: ChoiceOption[]
}

export async function fetchSurveyConfig(): Promise<SurveyConfig> {
  const res = await fetch(`${API_URL}/public/survey/config`)
  if (!res.ok) throw new Error("No se pudo cargar la configuración de la encuesta")
  return res.json()
}

async function postSurvey(path: string, token: string, body: unknown) {
  const res = await fetch(`${API_URL}/public/survey/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? "No se pudo enviar la encuesta")
  }
  return res.json()
}

export type ClientSurveyPayload = {
  nps: number
  satisfaction: number
  delivery: number
  attention: number
  valuedAspect?: string
  issue?: string
  comment?: string
  company?: string
  role?: string
  email?: string
  phone?: string
}

export function submitClientSurvey(token: string, body: ClientSurveyPayload): Promise<{ npsCategory: string }> {
  return postSurvey("client", token, body)
}

export type ExperienceSurveyPayload = {
  fit?: string
  futureValue: number
  clarity?: string
  exceededExpectations?: string
  actionToday?: string
  professionalSatisfaction: number
  meetingFit: number
  leadershipComment?: string
  company?: string
  contact?: string
  email?: string
  phone?: string
}

export function submitExperienceSurvey(token: string, body: ExperienceSurveyPayload): Promise<{ ok: boolean }> {
  return postSurvey("experience", token, body)
}
