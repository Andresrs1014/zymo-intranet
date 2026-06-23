interface Option<T extends string> {
  value: T
  label: string
  activeClass?: string
}

interface Props<T extends string> {
  name: string
  value: T
  options: Option<T>[]
  onChange: (value: T) => void
}

export function MntSegmentedControl<T extends string>({
  name,
  value,
  options,
  onChange,
}: Props<T>) {
  return (
    <div className="flex gap-3 flex-wrap" role="radiogroup" aria-label={name}>
      {options.map((opt) => {
        const selected = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            className={`rounded-xl border-2 px-5 py-3 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
              selected
                ? opt.activeClass ?? "border-primary bg-primary/5 text-primary"
                : "border-border bg-card text-muted-foreground hover:border-muted-foreground/40"
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
