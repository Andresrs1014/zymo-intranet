type ThankYouScreenProps = {
  category?: string
  message: string
}

/** Pantalla final del cliente — sin botones de compartir, esos son para el staff. */
export function ThankYouScreen({ category, message }: ThankYouScreenProps) {
  return (
    <div className="text-center py-6">
      {category ? (
        <span className="inline-block text-[10.5px] font-semibold uppercase tracking-wide text-survey-primary bg-survey-accent-bg px-3 py-1.5 rounded-full mb-4">
          {category}
        </span>
      ) : null}
      <h3 className="text-xl font-semibold text-survey-ink mb-2">Muchas gracias</h3>
      <p className="text-[13px] text-survey-muted leading-relaxed">{message}</p>
    </div>
  )
}
