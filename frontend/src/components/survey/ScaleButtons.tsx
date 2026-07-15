type ScaleButtonsProps = {
  value: number | null
  onChange: (value: number) => void
  lowLabel: string
  highLabel: string
}

/** Escala 1-5 usada en satisfacción, entregas, atención, valor futuro, etc. */
export function ScaleButtons({ value, onChange, lowLabel, highLabel }: ScaleButtonsProps) {
  const scores = [1, 2, 3, 4, 5]

  return (
    <div>
      <div className="grid grid-cols-5 gap-2.5 mb-2">
        {scores.map((score) => (
          <button
            key={score}
            type="button"
            onClick={() => onChange(score)}
            className={
              value === score
                ? "aspect-square rounded-xl flex items-center justify-center font-mono font-semibold text-sm border bg-survey-primary border-survey-primary text-white shadow-[0_6px_16px_rgba(212,58,86,0.35)]"
                : "aspect-square rounded-xl flex items-center justify-center font-mono font-semibold text-sm border bg-white border-survey-border text-survey-ink"
            }
          >
            {score}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-[10.5px] text-survey-muted mb-5">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  )
}
