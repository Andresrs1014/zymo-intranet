import { useEffect, useState } from "react"
import { SurveyShell } from "@/components/survey/SurveyShell"
import { QuestionHeading } from "@/components/survey/QuestionHeading"
import { ScaleButtons } from "@/components/survey/ScaleButtons"
import { ChoiceList } from "@/components/survey/ChoiceList"
import { TextAreaField, TextField } from "@/components/survey/FormField"
import { WizardNav } from "@/components/survey/WizardNav"
import { ThankYouScreen } from "@/components/survey/ThankYouScreen"
import { fetchSurveyConfig, submitExperienceSurvey, type SurveyConfig } from "@/lib/surveyApi"

const TOTAL_STEPS = 8

type FormState = {
  fit: string
  futureValue: number | null
  clarity: string
  exceededExpectations: string
  actionToday: string
  professionalSatisfaction: number | null
  meetingFit: number | null
  leadershipComment: string
  company: string
  contact: string
  email: string
  phone: string
}

const initialState: FormState = {
  fit: "",
  futureValue: null,
  clarity: "",
  exceededExpectations: "",
  actionToday: "",
  professionalSatisfaction: null,
  meetingFit: null,
  leadershipComment: "",
  company: "",
  contact: "",
  email: "",
  phone: "",
}

export function ExperienceSurveyWizard({ token }: { token: string }) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<FormState>(initialState)
  const [config, setConfig] = useState<SurveyConfig | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    fetchSurveyConfig().then(setConfig).catch(() => setError("No se pudo cargar la encuesta. Intenta de nuevo más tarde."))
  }, [])

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)
    try {
      await submitExperienceSurvey(token, {
        fit: form.fit || undefined,
        futureValue: form.futureValue!,
        clarity: form.clarity || undefined,
        exceededExpectations: form.exceededExpectations || undefined,
        actionToday: form.actionToday || undefined,
        professionalSatisfaction: form.professionalSatisfaction!,
        meetingFit: form.meetingFit!,
        leadershipComment: form.leadershipComment || undefined,
        company: form.company || undefined,
        contact: form.contact || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
      })
      setSubmitted(true)
    } catch {
      setError("No se pudo enviar la encuesta. Verifica tu conexión e intenta de nuevo.")
    } finally {
      setSubmitting(false)
    }
  }

  const stepReady = [
    form.fit !== "",
    form.futureValue !== null,
    form.clarity !== "",
    true, // expectativas opcional
    true, // accion hoy opcional
    form.professionalSatisfaction !== null,
    form.meetingFit !== null,
    true, // datos de contacto opcionales
  ][step - 1]

  const shellProps = {
    logoSrc: "/brand/zymo_logo.png",
    title: "Diseñando la Experiencia",
    badge: "Su visión afina nuestra propuesta",
    heading: "Su visión afina nuestra propuesta logística.",
    description: "3 minutos, 8 preguntas. Evalúa el valor de la reunión y las acciones que debemos preparar para la próxima interacción.",
    stats: [
      { value: "+800", label: "Respuestas este trimestre" },
      { value: "24h", label: "Seguimiento comercial" },
    ],
  }

  if (submitted) {
    return (
      <SurveyShell {...shellProps} currentStep={TOTAL_STEPS} totalSteps={TOTAL_STEPS}>
        <ThankYouScreen message="Su respuesta de experiencia fue registrada exitosamente. Nuestro equipo comercial la usará para preparar la próxima interacción." />
      </SurveyShell>
    )
  }

  return (
    <SurveyShell {...shellProps} currentStep={step} totalSteps={TOTAL_STEPS}>
      {step === 1 && config && (
        <>
          <QuestionHeading tag="Solución" question="¿Siente que las soluciones propuestas se adaptan a las necesidades actuales de su logística?" />
          <ChoiceList options={config.experienceFitChoices} value={form.fit} onChange={(v) => update("fit", v)} />
        </>
      )}
      {step === 2 && (
        <>
          <QuestionHeading tag="Valor" question="¿Qué tanto valor aportó esta reunión a la planeación de sus operaciones futuras?" />
          <ScaleButtons value={form.futureValue} onChange={(v) => update("futureValue", v)} lowLabel="Bajo valor" highLabel="Alto valor" />
        </>
      )}
      {step === 3 && config && (
        <>
          <QuestionHeading tag="Claridad" question="¿La información y los tiempos de respuesta brindados fueron claros y veraces?" />
          <ChoiceList options={config.experienceClarityChoices} value={form.clarity} onChange={(v) => update("clarity", v)} />
        </>
      )}
      {step === 4 && (
        <>
          <QuestionHeading tag="Expectativas" question="¿Hubo algún aspecto de nuestra propuesta que superara sus expectativas iniciales?" hint="Opcional" />
          <TextAreaField value={form.exceededExpectations} onChange={(v) => update("exceededExpectations", v)} placeholder="Describa el aspecto que superó sus expectativas" />
        </>
      )}
      {step === 5 && (
        <>
          <QuestionHeading tag="Acción" question="¿Qué acción específica podríamos tomar hoy para que nuestra próxima interacción sea excelente?" hint="Opcional" />
          <TextAreaField value={form.actionToday} onChange={(v) => update("actionToday", v)} placeholder="Acción concreta para preparar la siguiente interacción" />
        </>
      )}
      {step === 6 && (
        <>
          <QuestionHeading tag="Atención" question="¿Qué tan satisfecho se encuentra con la atención profesional recibida en esta visita?" />
          <ScaleButtons value={form.professionalSatisfaction} onChange={(v) => update("professionalSatisfaction", v)} lowLabel="Muy bajo" highLabel="Excelente" />
        </>
      )}
      {step === 7 && (
        <>
          <QuestionHeading tag="Objetivos" question="¿La duración y el contenido de la reunión fueron óptimos para sus objetivos?" />
          <ScaleButtons value={form.meetingFit} onChange={(v) => update("meetingFit", v)} lowLabel="No fue óptima" highLabel="Totalmente óptima" />
        </>
      )}
      {step === 8 && (
        <>
          <QuestionHeading tag="Datos" question="Déjenos saber cómo podemos seguir liderando su logística pensando en usted." hint="Opcional" />
          <TextField value={form.company} onChange={(v) => update("company", v)} placeholder="Cliente / empresa" />
          <TextField value={form.contact} onChange={(v) => update("contact", v)} placeholder="Contacto que responde" />
          <TextField value={form.email} onChange={(v) => update("email", v)} placeholder="Correo electrónico" type="email" />
          <TextField value={form.phone} onChange={(v) => update("phone", v)} placeholder="WhatsApp, ej. +57 300 000 0000" />
          <TextAreaField value={form.leadershipComment} onChange={(v) => update("leadershipComment", v)} placeholder="Comentarios, prioridades, expectativas o recomendaciones" />
        </>
      )}

      {error && <p className="text-[12px] text-survey-primary mb-3">{error}</p>}

      <WizardNav
        onBack={step > 1 ? () => setStep(step - 1) : undefined}
        onNext={step < TOTAL_STEPS ? () => setStep(step + 1) : handleSubmit}
        nextDisabled={!stepReady || submitting}
        nextLabel={step < TOTAL_STEPS ? "Continuar" : submitting ? "Enviando..." : "Enviar Diseñando la Experiencia"}
      />
    </SurveyShell>
  )
}
