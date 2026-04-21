/**
 * Renderiza un mensaje del chat del agente.
 * Muestra un cursor parpadeante en el último mensaje mientras hace streaming.
 */
import type { AgentMessage } from "@/hooks/useAgent"

interface Props {
  message: AgentMessage
  isLast: boolean
  isStreaming: boolean
}

export function AgentMessageStream({ message, isLast, isStreaming }: Props) {
  const isAgent = message.role === "agent"
  const showCursor = isAgent && isLast && isStreaming

  return (
    <div className={`flex ${isAgent ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words ${
          isAgent
            ? "bg-gray-100 text-gray-800 rounded-tl-sm"
            : "bg-brand-blue text-white rounded-tr-sm"
        }`}
      >
        {message.content || (showCursor ? "" : "…")}
        {showCursor && (
          <span className="inline-block w-0.5 h-3.5 bg-gray-500 ml-0.5 align-middle animate-pulse" />
        )}
      </div>
    </div>
  )
}
