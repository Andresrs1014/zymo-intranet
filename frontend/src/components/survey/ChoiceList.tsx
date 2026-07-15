import type { ChoiceOption } from "@/lib/surveyApi"

type ChoiceListProps = {
  options: ChoiceOption[]
  value: string
  onChange: (value: string) => void
}

/** Botones de una sola columna para opciones tipo "aspecto valorado", "ajuste de soluciones", etc. */
export function ChoiceList({ options, value, onChange }: ChoiceListProps) {
  return (
    <div className="flex flex-col gap-2 mb-5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={
            value === opt.value
              ? "text-left px-4 py-3 rounded-xl border text-sm font-medium bg-survey-accent-bg border-survey-primary text-survey-primary"
              : "text-left px-4 py-3 rounded-xl border text-sm font-medium bg-white border-survey-border text-survey-ink"
          }
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
