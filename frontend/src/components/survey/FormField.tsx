type TextFieldProps = {
  value: string
  onChange: (value: string) => void
  placeholder: string
  type?: string
}

export function TextField({ value, onChange, placeholder, type = "text" }: TextFieldProps) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg border border-survey-border px-3.5 py-2.5 text-sm text-survey-ink placeholder:text-survey-muted focus:outline-none focus:ring-1 focus:ring-survey-primary/50 mb-3"
    />
  )
}

type TextAreaProps = TextFieldProps & { maxLength?: number }

export function TextAreaField({ value, onChange, placeholder, maxLength = 500 }: TextAreaProps) {
  return (
    <div className="mb-3">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        rows={4}
        className="w-full rounded-lg border border-survey-border px-3.5 py-2.5 text-sm text-survey-ink placeholder:text-survey-muted focus:outline-none focus:ring-1 focus:ring-survey-primary/50 resize-none"
      />
      <div className="text-right text-[10px] text-survey-muted mt-1">{value.length}/{maxLength}</div>
    </div>
  )
}
