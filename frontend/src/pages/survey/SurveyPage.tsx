import { useParams, useSearchParams } from "react-router-dom"
import { ClientSurveyWizard } from "./ClientSurveyWizard"
import { ExperienceSurveyWizard } from "./ExperienceSurveyWizard"

export function SurveyPage() {
  const { surveyType } = useParams<{ surveyType: string }>()
  const [params] = useSearchParams()
  const token = params.get("t")

  if (!token) {
    return <InvalidLink message="Este enlace no incluye un código de acceso válido." />
  }
  if (surveyType === "client") {
    return <ClientSurveyWizard token={token} />
  }
  if (surveyType === "experience") {
    return <ExperienceSurveyWizard token={token} />
  }
  return <InvalidLink message="Este tipo de encuesta no existe." />
}

function InvalidLink({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-[#f4f4f6] flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm text-center">
        <h3 className="text-lg font-semibold text-survey-ink mb-2">Enlace no disponible</h3>
        <p className="text-[13px] text-survey-muted">{message}</p>
      </div>
    </div>
  )
}
