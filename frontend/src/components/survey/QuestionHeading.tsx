type QuestionHeadingProps = {
  tag: string
  question: string
  hint?: string
}

export function QuestionHeading({ tag, question, hint }: QuestionHeadingProps) {
  return (
    <div className="text-center lg:text-left mb-5">
      <span className="hidden lg:inline-block text-[10.5px] font-semibold uppercase tracking-wide text-survey-primary bg-survey-accent-bg px-2.5 py-1 rounded-full mb-3">
        {tag}
      </span>
      <span className="lg:hidden block text-[10px] font-semibold uppercase tracking-wide text-survey-primary mb-2.5">{tag}</span>
      <h4 className="text-[17.5px] lg:text-[19px] font-semibold lg:font-bold text-survey-ink leading-snug mb-1.5">{question}</h4>
      {hint ? <p className="text-[11.5px] text-survey-muted">{hint}</p> : null}
    </div>
  )
}
