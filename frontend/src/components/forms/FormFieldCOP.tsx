import { useEffect, useState } from "react"
import { parseCOP } from "@/lib/formatters"

const defaultInputCls =
  "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30"

/**
 * Campo texto con parse COP al blur — no usar type="number" (rompe miles con punto en es-CO).
 */
export function MoneyInputCOP({
  value,
  onChange,
  className,
  placeholder = "0",
}: {
  value: number | null | undefined
  onChange: (v: number | undefined) => void
  className?: string
  placeholder?: string
}) {
  const [raw, setRaw] = useState(
    value != null && !Number.isNaN(value)
      ? value.toLocaleString("es-CO", { minimumFractionDigits: 0 })
      : ""
  )

  useEffect(() => {
    if (value != null && !Number.isNaN(value)) {
      setRaw(value.toLocaleString("es-CO", { minimumFractionDigits: 0 }))
    } else {
      setRaw("")
    }
  }, [value])

  const cls = className ?? defaultInputCls

  return (
    <input
      type="text"
      inputMode="decimal"
      value={raw}
      onChange={(e) => setRaw(e.target.value)}
      onBlur={() => {
        const parsed = parseCOP(raw)
        onChange(parsed)
        if (parsed != null) {
          setRaw(parsed.toLocaleString("es-CO", { minimumFractionDigits: 0 }))
        }
      }}
      placeholder={placeholder}
      className={cls}
    />
  )
}

export function FormFieldCOP({
  label,
  value,
  onChange,
  inputClassName,
}: {
  label: string
  value: number | null | undefined
  onChange: (v: number | undefined) => void
  inputClassName?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <MoneyInputCOP value={value} onChange={onChange} className={inputClassName} />
    </div>
  )
}
