/** Lee un archivo de imagen como data URL (base64). */
export function readImageAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error("No se pudo leer la imagen"))
    reader.readAsDataURL(file)
  })
}

/** Input compacto para foto de evidencia. */
export function FotoEvidenciaField({
  label,
  hint,
  required,
  valuePreview,
  onChange,
  id: idProp,
}: {
  label: string
  hint?: string
  required?: boolean
  valuePreview?: string | null
  onChange: (dataUrl: string | null) => void
  id?: string
}) {
  const inputId = idProp ?? `foto-evidencia-${label.replace(/\s+/g, "-").toLowerCase()}`
  return (
    <div>
      <label htmlFor={inputId} className="block text-sm font-medium text-foreground mb-1">
        {label}
        {required && " *"}
      </label>
      {hint && <p className="text-xs text-muted-foreground mb-2">{hint}</p>}
      <input
        id={inputId}
        type="file"
        accept="image/*"
        capture="environment"
        aria-required={required || undefined}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (!file) {
            onChange(null)
            return
          }
          void readImageAsDataUrl(file).then(onChange).catch(() => onChange(null))
        }}
        className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-amber-500/15 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-amber-700"
      />
      {valuePreview && (
        <img
          src={valuePreview}
          alt="Vista previa de evidencia"
          width={320}
          height={128}
          className="mt-2 max-h-32 rounded-lg border border-border object-cover"
        />
      )}
    </div>
  )
}
