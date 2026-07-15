type NpsScaleProps = {
  value: number | null
  onChange: (value: number) => void
}

export function NpsScale({ value, onChange }: NpsScaleProps) {
  const scores = Array.from({ length: 11 }, (_, i) => i)

  return (
    <div>
      {/* Desktop: una fila de 11 */}
      <div className="hidden lg:grid grid-cols-11 gap-1.5 mb-2">
        {scores.map((score) => (
          <ScoreButton key={score} score={score} selected={value === score} onClick={() => onChange(score)} size="desktop" />
        ))}
      </div>
      {/* Mobile: dos filas, botones más grandes */}
      <div className="lg:hidden grid grid-cols-6 gap-2 mb-2">
        {scores.slice(0, 6).map((score) => (
          <ScoreButton key={score} score={score} selected={value === score} onClick={() => onChange(score)} size="mobile" />
        ))}
      </div>
      <div className="lg:hidden grid grid-cols-5 gap-2 w-[84%] mx-auto mb-5">
        {scores.slice(6).map((score) => (
          <ScoreButton key={score} score={score} selected={value === score} onClick={() => onChange(score)} size="mobile" />
        ))}
      </div>
      <div className="flex justify-between text-[10.5px] text-survey-muted mb-5 lg:mb-0">
        <span>Nada probable</span>
        <span>Muy probable</span>
      </div>
    </div>
  )
}

function ScoreButton({ score, selected, onClick, size }: { score: number; selected: boolean; onClick: () => void; size: "desktop" | "mobile" }) {
  const base = "aspect-square rounded-xl flex items-center justify-center font-mono font-semibold border transition"
  const sizing = size === "desktop" ? "text-xs" : "text-sm rounded-2xl"
  const state = selected
    ? "bg-survey-primary border-survey-primary text-white shadow-[0_6px_16px_rgba(212,58,86,0.35)]"
    : "bg-white border-survey-border text-survey-ink"
  return (
    <button type="button" onClick={onClick} className={`${base} ${sizing} ${state}`}>
      {score}
    </button>
  )
}
