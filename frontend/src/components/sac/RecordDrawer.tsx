import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useSacUI } from "@/context/SacContext"
import type { ClientSurvey, ExperienceSurvey, VisitReport } from "@/types/sac"

function Field({ label, value }: { label: string; value: unknown }) {
  if (value === null || value === undefined || value === "") return null
  return (
    <p className="text-[13px] text-zinc-700">
      <strong className="text-zinc-900">{label}:</strong> {String(value)}
    </p>
  )
}

export function RecordDrawer() {
  const { openRecord, setOpenRecord } = useSacUI()

  return (
    <Sheet open={openRecord !== null} onOpenChange={(open) => !open && setOpenRecord(null)}>
      <SheetContent side="right" className="w-full max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-base">{openRecord?.recordType}</SheetTitle>
        </SheetHeader>

        {openRecord && (
          <div className="mt-4 space-y-2">
            <Field label="Fecha" value={openRecord.date} />

            {openRecord.recordGroup === "client" && (() => {
              const r = openRecord as ClientSurvey
              return (
                <>
                  <Field label="Empresa" value={r.company} />
                  <Field label="Rol" value={r.role} />
                  <Field label="Correo" value={r.email} />
                  <Field label="Teléfono" value={r.phone} />
                  <Field label="NPS" value={r.nps} />
                  <Field label="Categoría NPS" value={r.npsCategory} />
                  <Field label="Satisfacción" value={r.satisfaction} />
                  <Field label="Entregas" value={r.delivery} />
                  <Field label="Atención" value={r.attention} />
                  <Field label="Aspecto valorado" value={r.valuedAspect} />
                  <Field label="Inconveniente" value={r.issue} />
                  <Field label="Comentario" value={r.comment} />
                  <Field label="Siguiente paso" value={r.nextStep} />
                </>
              )
            })()}

            {openRecord.recordGroup === "commercial" && (() => {
              const r = openRecord as ExperienceSurvey
              return (
                <>
                  <Field label="Empresa" value={r.company} />
                  <Field label="Contacto" value={r.contact} />
                  <Field label="Correo" value={r.email} />
                  <Field label="Teléfono" value={r.phone} />
                  <Field label="¿Se adaptan?" value={r.fit} />
                  <Field label="Valor a futuro" value={r.futureValue} />
                  <Field label="Claridad" value={r.clarity} />
                  <Field label="¿Superó expectativas?" value={r.exceededExpectations} />
                  <Field label="Acción de hoy" value={r.actionToday} />
                  <Field label="Satisfacción profesional" value={r.professionalSatisfaction} />
                  <Field label="Ajuste de la reunión" value={r.meetingFit} />
                  <Field label="Comentario de liderazgo" value={r.leadershipComment} />
                </>
              )
            })()}

            {openRecord.recordGroup === "visit" && (() => {
              const r = openRecord as VisitReport
              return (
                <>
                  <Field label="Comercial" value={r.commercial} />
                  <Field label="Cliente" value={r.client} />
                  <Field label="Contacto" value={r.contact} />
                  <Field label="Resultado" value={r.outcome} />
                  <Field label="Próxima fecha" value={r.nextDate} />
                  <Field label="Calidad" value={r.quality} />
                  <Field label="Ánimo del cliente" value={r.clientMood} />
                  <Field label="Oportunidad" value={r.opportunity} />
                  <Field label="Urgencia" value={r.urgency} />
                  <Field label="Observaciones" value={r.observations} />
                  <Field label="Plan de acción" value={r.actionPlan} />
                </>
              )
            })()}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
