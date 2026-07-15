import { useEffect, useState } from "react"
import { SurveyShell } from "@/components/survey/SurveyShell"
import { QuestionHeading } from "@/components/survey/QuestionHeading"
import { NpsScale } from "@/components/survey/NpsScale"
import { ScaleButtons } from "@/components/survey/ScaleButtons"
import { ChoiceList } from "@/components/survey/ChoiceList"
import { TextAreaField, TextField } from "@/components/survey/FormField"
import { WizardNav } from "@/components/survey/WizardNav"
import { ThankYouScreen } from "@/components/survey/ThankYouScreen"
import { fetchSurveyConfig, submitClientSurvey, type SurveyConfig } from "@/lib/surveyApi"

const TOTAL_STEPS = 7

type FormState = {
  nps: number | null
  satisfaction: number | null
  delivery: number | null
  attention: number | null
  valuedAspect: string
  issue: string
  comment: string
  company: string
  role: string
  email: string
  phone: string
}

const initialState: FormState = {
  nps: null,
  satisfaction: null,
  delivery: null,
  attention: null,
  valuedAspect: "",
  issue: "",
  comment: "",
  company: "",
  role: "",
  email: "",
  phone: "",
}

export function ClientSurveyWizard({ token }: { token: string }) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<FormState>(initialState)
  const [config, setConfig] = useState<SurveyConfig | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ npsCategory: string } | null>(null)

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
      const res = await submitClientSurvey(token, {
        nps: form.nps!,
        satisfaction: form.satisfaction!,
        delivery: form.delivery!,
        attention: form.attention!,
        valuedAspect: form.valuedAspect || undefined,
        issue: form.issue || undefined,
        comment: form.comment || undefined,
        company: form.company || undefined,
        role: form.role || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
      })
      setResult(res)
    } catch {
      setError("No se pudo enviar la encuesta. Verifica tu conexión e intenta de nuevo.")
    } finally {
      setSubmitting(false)
    }
  }

  const stepReady = [
    form.nps !== null,
    form.satisfaction !== null,
    form.delivery !== null,
    form.attention !== null,
    form.valuedAspect !== "",
    true, // comentario opcional
    true, // datos de contacto opcionales
  ][step - 1]

  if (result) {
    return (
      <SurveyShell
        logoSrc="/brand/zymo_logo.png"
        title="Fidelización de clientes"
        badge="Su voz construye la ruta"
        heading="Su opinión define cómo mejoramos su operación logística."
        description="Gracias por tomarse el tiempo de responder."
        stats={[]}
        currentStep={TOTAL_STEPS}
        totalSteps={TOTAL_STEPS}
      >
        <ThankYouScreen
          category={result.npsCategory}
          message="Su respuesta fue registrada exitosamente. El equipo de Servicio al Cliente la revisará para seguir mejorando su experiencia."
        />
      </SurveyShell>
    )
  }

  return (
    <SurveyShell
      logoSrc="/brand/zymo_logo.png"
      title="Fidelización de clientes"
      badge="Su voz construye la ruta"
      heading="Su opinión define cómo mejoramos su operación logística."
      description="2 minutos, 7 preguntas. Sus respuestas llegan directo al equipo de Servicio al Cliente — sin intermediarios."
      stats={[
        { value: "+1,200", label: "Respuestas este trimestre" },
        { value: "48h", label: "Tiempo de respuesta" },
      ]}
      currentStep={step}
      totalSteps={TOTAL_STEPS}
    >
      {step === 1 && (
        <>
          <QuestionHeading tag="Recomendación" question="¿Qué tan probable es que nos recomiende con un colega?" hint="0 = Nada probable · 10 = Muy probable" />
          <NpsScale value={form.nps} onChange={(v) => update("nps", v)} />
        </>
      )}
      {step === 2 && (
        <>
          <QuestionHeading tag="Satisfacción" question="¿Qué tan satisfecho está con nuestro servicio en general?" />
          <ScaleButtons value={form.satisfaction} onChange={(v) => update("satisfaction", v)} lowLabel="Muy insatisfecho" highLabel="Muy satisfecho" />
        </>
      )}
      {step === 3 && (
        <>
          <QuestionHeading tag="Entregas" question="¿Cómo calificaría el cumplimiento de nuestras entregas?" />
          <ScaleButtons value={form.delivery} onChange={(v) => update("delivery", v)} lowLabel="Muy deficiente" highLabel="Excelente" />
        </>
      )}
      {step === 4 && (
        <>
          <QuestionHeading tag="Atención" question="¿Cómo calificaría la atención y comunicación recibida?" />
          <ScaleButtons value={form.attention} onChange={(v) => update("attention", v)} lowLabel="Muy deficiente" highLabel="Excelente" />
        </>
      )}
      {step === 5 && config && (
        <>
          <QuestionHeading tag="Aspectos" question="¿Qué aspecto valora más y cuál tuvo inconveniente?" hint="El inconveniente es opcional" />
          <ChoiceList options={config.surveyValueChoices} value={form.valuedAspect} onChange={(v) => update("valuedAspect", v)} />
          <ChoiceList options={config.surveyIssues} value={form.issue} onChange={(v) => update("issue", v)} />
        </>
      )}
      {step === 6 && (
        <>
          <QuestionHeading tag="Observaciones" question="¿Qué podríamos hacer mejor?" hint="Opcional" />
          <TextAreaField value={form.comment} onChange={(v) => update("comment", v)} placeholder="Ej. Me gustaría rastreo en tiempo real de mis embarques" />
        </>
      )}
      {step === 7 && (
        <>
          <QuestionHeading tag="Datos" question="¿Desea que le demos seguimiento?" hint="Opcional — datos estrictamente confidenciales" />
          <TextField value={form.company} onChange={(v) => update("company", v)} placeholder="Nombre o razón social" />
          <TextField value={form.role} onChange={(v) => update("role", v)} placeholder="Cargo o área" />
          <TextField value={form.email} onChange={(v) => update("email", v)} placeholder="Correo electrónico" type="email" />
          <TextField value={form.phone} onChange={(v) => update("phone", v)} placeholder="WhatsApp, ej. +57 300 000 0000" />
        </>
      )}

      {error && <p className="text-[12px] text-survey-primary mb-3">{error}</p>}

      <WizardNav
        onBack={step > 1 ? () => setStep(step - 1) : undefined}
        onNext={step < TOTAL_STEPS ? () => setStep(step + 1) : handleSubmit}
        nextDisabled={!stepReady || submitting}
        nextLabel={step < TOTAL_STEPS ? "Continuar" : submitting ? "Enviando..." : "Enviar mi respuesta"}
      />
    </SurveyShell>
  )
}
