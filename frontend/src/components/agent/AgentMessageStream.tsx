/**
 * Renderiza un mensaje del chat del agente.
 * - Mensajes del agente: markdown completo (negritas, listas, tablas, código)
 * - Mensajes del usuario: texto plano
 * - Cursor parpadeante en el último mensaje mientras hace streaming
 */
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
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
        className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed break-words ${
          isAgent
            ? "bg-gray-100 text-gray-800 rounded-tl-sm"
            : "bg-brand-blue text-white rounded-tr-sm whitespace-pre-wrap"
        }`}
      >
        {isAgent ? (
          <div className="prose prose-sm prose-gray max-w-none
            prose-p:my-1 prose-p:leading-relaxed
            prose-ul:my-1 prose-ul:pl-4 prose-ul:list-disc
            prose-ol:my-1 prose-ol:pl-4 prose-ol:list-decimal
            prose-li:my-0.5
            prose-strong:font-semibold prose-strong:text-gray-900
            prose-code:bg-gray-200 prose-code:px-1 prose-code:rounded prose-code:text-xs prose-code:font-mono
            prose-pre:bg-gray-200 prose-pre:p-2 prose-pre:rounded-lg prose-pre:text-xs prose-pre:overflow-x-auto
            prose-table:text-xs prose-table:border-collapse
            prose-th:border prose-th:border-gray-300 prose-th:bg-gray-200 prose-th:px-2 prose-th:py-1
            prose-td:border prose-td:border-gray-300 prose-td:px-2 prose-td:py-1
            prose-headings:font-semibold prose-headings:text-gray-900 prose-headings:my-1
            prose-blockquote:border-l-2 prose-blockquote:border-gray-400 prose-blockquote:pl-2 prose-blockquote:italic
          ">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content || (showCursor ? "\u200b" : "…")}
            </ReactMarkdown>
          </div>
        ) : (
          message.content || "…"
        )}
        {showCursor && (
          <span className="inline-block w-0.5 h-3.5 bg-gray-500 ml-0.5 align-middle animate-pulse" />
        )}
      </div>
    </div>
  )
}
