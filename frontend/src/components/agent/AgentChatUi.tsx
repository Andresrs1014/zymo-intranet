/**
 * Cuerpo del chat del agente — compartido entre ventana flotante y panel anclado.
 */
import { useEffect, useRef } from "react"
import { AgentMessageStream } from "./AgentMessageStream"
import type { AgentMessage, BienvenidaData } from "@/hooks/useAgent"

export const AGENT_SUGGESTED_PROMPTS: Record<"administrativo" | "zymo", string[]> = {
  administrativo: [
    "¿Qué solicitudes están pendientes?",
    "¿Cómo registro una cotización?",
    "Resumen del flujo de aprobación",
  ],
  zymo: ["Resumen de indicadores clave", "¿Qué áreas requieren atención?", "Prioridades para esta semana"],
}

export interface AgentChatUiProps {
  agente: "administrativo" | "zymo"
  usuarioNombre: string
  messages: AgentMessage[]
  isStreaming: boolean
  bienvenida: BienvenidaData | null
  error: string | null
  input: string
  onInputChange: (value: string) => void
  onSend: () => void
  onInputKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  onSuggestedPrompt: (text: string) => void
  onNewChat?: () => void
  showAlertStrip?: boolean
  showKeyboardHint?: boolean
  /** Header completo (título, acciones). Si es false, solo área de mensajes + input. */
  renderHeader?: () => React.ReactNode
  className?: string
}

export function AgentChatUi({
  agente,
  usuarioNombre,
  messages,
  isStreaming,
  bienvenida,
  error,
  input,
  onInputChange,
  onSend,
  onInputKeyDown,
  onSuggestedPrompt,
  onNewChat,
  showAlertStrip = true,
  showKeyboardHint = false,
  renderHeader,
  className = "",
}: AgentChatUiProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const alertas = bienvenida?.alertas ?? []
  const agentLabel = agente === "zymo" ? "ZYMO" : "Agente Administrativo"

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  return (
    <div className={`flex flex-col min-h-0 flex-1 ${className}`}>
      {renderHeader?.()}

      {showAlertStrip && alertas.length > 0 && messages.length <= 1 && (
        <div className="mx-3 mt-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 shrink-0">
          {alertas.map((a, i) => (
            <p key={i} className="text-xs text-amber-700 leading-snug">
              ⚠ {a}
            </p>
          ))}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-3">
        {messages.length === 0 && !isStreaming && (
          <div className="flex flex-col items-center justify-center h-full min-h-[120px] text-center text-muted-foreground">
            <p className="text-sm font-medium">¿En qué te ayudo hoy?</p>
            <p className="text-xs mt-1 px-2">
              {agente === "zymo"
                ? "Consultas de contexto gerencial e indicadores."
                : "Pregúntame sobre solicitudes, cotizaciones o procedimientos."}
            </p>
            <div className="flex flex-wrap gap-1.5 justify-center mt-4 max-w-full">
              {AGENT_SUGGESTED_PROMPTS[agente].map((p) => (
                <button
                  key={p}
                  type="button"
                  disabled={isStreaming}
                  onClick={() => onSuggestedPrompt(p)}
                  className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-muted hover:border-brand-blue/40 transition-colors disabled:opacity-50"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => {
          const prev = messages[i - 1]
          const showAgentLabel = msg.role === "agent" && prev?.role === "user"
          return (
            <AgentMessageStream
              key={i}
              message={msg}
              isLast={i === messages.length - 1}
              isStreaming={isStreaming}
              agentLabel={showAgentLabel ? agentLabel : undefined}
            />
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {error && (
        <div className="mx-3 mb-1 rounded-lg bg-red-50 border border-red-200 px-3 py-1.5 shrink-0">
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}

      <div className="px-3 pb-3 pt-2 border-t border-border shrink-0">
        {onNewChat && (
          <div className="flex justify-end mb-2">
            <button
              type="button"
              onClick={onNewChat}
              disabled={isStreaming}
              className="text-[11px] font-medium text-brand-blue hover:underline disabled:opacity-40"
            >
              Nueva conversación
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            rows={2}
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={onInputKeyDown}
            disabled={isStreaming}
            placeholder={`Escribe tu pregunta… (${usuarioNombre.split(" ")[0]}, Enter envía)`}
            className="flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30 disabled:bg-muted disabled:text-muted-foreground min-h-[44px]"
          />
          <button
            type="button"
            onClick={onSend}
            disabled={!input.trim() || isStreaming}
            className="shrink-0 w-9 h-9 rounded-xl bg-brand-blue text-white flex items-center justify-center hover:brightness-105 disabled:opacity-40 transition-all"
            aria-label="Enviar"
          >
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M3.105 2.288a.75.75 0 0 0-.826.95l1.414 4.925A1.5 1.5 0 0 0 5.135 9.25h6.115a.75.75 0 0 1 0 1.5H5.135a1.5 1.5 0 0 0-1.442 1.087L2.28 16.761a.75.75 0 0 0 .826.95 28.896 28.896 0 0 0 15.293-7.154.75.75 0 0 0 0-1.115A28.897 28.897 0 0 0 3.105 2.288Z" />
            </svg>
          </button>
        </div>
        {showKeyboardHint && (
          <p className="text-[10px] text-muted-foreground mt-1.5 text-center">Ctrl+K o ⌘K para expandir o minimizar</p>
        )}
      </div>
    </div>
  )
}
