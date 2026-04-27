import { useState, useRef, useEffect } from "react"

export interface ComboboxOption {
  value: string | number
  label: string
  sublabel?: string
  /** Texto secundario (ej. tipo de gasto en cuentas contables). */
  detail?: string
}

interface ComboboxProps {
  options: ComboboxOption[]
  value: string | number | null
  onChange: (value: string | number | null) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Buscar...",
  disabled = false,
  className = "",
}: ComboboxProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = options.find((o) => o.value === value) ?? null

  const filtered = query.trim()
    ? options.filter(
        (o) =>
          o.label.toLowerCase().includes(query.toLowerCase()) ||
          o.sublabel?.toLowerCase().includes(query.toLowerCase()) ||
          o.detail?.toLowerCase().includes(query.toLowerCase())
      )
    : options

  // Cerrar al hacer click fuera
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery("")
      }
    }
    document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [])

  function handleSelect(opt: ComboboxOption) {
    onChange(opt.value)
    setOpen(false)
    setQuery("")
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation()
    onChange(null)
    setQuery("")
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return
          setOpen((o) => !o)
          setTimeout(() => inputRef.current?.focus(), 50)
        }}
        className="w-full flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-left focus:outline-none focus:ring-2 focus:ring-brand-blue/30 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className={`block min-w-0 ${selected ? "text-gray-900" : "text-gray-400"} text-left`}>
          {selected ? (
            <span className="flex flex-col items-start gap-0.5 min-w-0 w-full">
              <span className="truncate w-full">
                {selected.sublabel && (
                  <span className="font-mono text-xs text-gray-500 mr-1.5">{selected.sublabel}</span>
                )}
                {selected.label}
              </span>
              {selected.detail && (
                <span className="text-xs text-gray-400 truncate w-full">{selected.detail}</span>
              )}
            </span>
          ) : (
            placeholder
          )}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {selected && (
            <span
              onClick={handleClear}
              className="text-gray-400 hover:text-gray-600 cursor-pointer p-0.5 rounded"
              role="button"
              aria-label="Limpiar selección"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
              </svg>
            </span>
          )}
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
          </svg>
        </div>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
          {/* Search input */}
          <div className="p-2 border-b border-gray-100">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar..."
              className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
            />
          </div>

          {/* Options list */}
          <ul className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-gray-400 text-center">Sin resultados</li>
            ) : (
              filtered.map((opt) => (
                <li
                  key={opt.value}
                  onClick={() => handleSelect(opt)}
                  className={`px-3 py-2 text-sm cursor-pointer transition-colors hover:bg-brand-blue/5 ${
                    opt.value === value ? "bg-brand-blue/10 text-brand-blue font-medium" : "text-gray-700"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {opt.sublabel && (
                      <span className="font-mono text-xs text-gray-400 shrink-0 pt-0.5 tabular-nums">
                        {opt.sublabel}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{opt.label}</div>
                      {opt.detail && (
                        <div
                          className={`text-xs truncate mt-0.5 font-normal ${
                            opt.value === value ? "text-brand-blue/80" : "text-gray-400"
                          }`}
                        >
                          {opt.detail}
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
