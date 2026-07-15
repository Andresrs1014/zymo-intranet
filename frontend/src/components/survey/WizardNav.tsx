type WizardNavProps = {
  onBack?: () => void
  onNext: () => void
  nextDisabled?: boolean
  nextLabel?: string
}

export function WizardNav({ onBack, onNext, nextDisabled, nextLabel = "Continuar" }: WizardNavProps) {
  return (
    <div className="flex items-center justify-between mt-2 lg:mt-0">
      {onBack ? (
        <button type="button" onClick={onBack} className="text-[12.5px] text-survey-muted font-medium">
          ← Atrás
        </button>
      ) : (
        <span />
      )}
      <button
        type="button"
        onClick={onNext}
        disabled={nextDisabled}
        className="bg-survey-primary text-white border-none px-7 py-3 rounded-xl text-[13px] font-semibold shadow-[0_10px_22px_rgba(212,58,86,0.28)] disabled:opacity-40 disabled:shadow-none lg:self-end w-full lg:w-auto"
      >
        {nextLabel}
      </button>
    </div>
  )
}
