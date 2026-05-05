/**
 * Panel del agente anclado a la derecha del layout (escritorio).
 */
import { useEffect, useState } from "react"
import { useAgent } from "@/hooks/useAgent"
import { AgentChatUi } from "./AgentChatUi"

interface Props {
  agente: "administrativo" | "zymo"
  usuarioNombre: string
}

export function AgentDockedPanel({ agente, usuarioNombre }: Props) {
  const [input, setInput] = useState("")
  const [bienvenidaCargada, setBienvenidaCargada] = useState(false)

  const {
    messages,
    isStreaming,
    bienvenida,
    error,
    sendMessage,
    cancelStream,
    cargarBienvenida,
    clearMessages,
  } = useAgent(agente)

  useEffect(() => {
    if (!bienvenidaCargada && agente === "administrativo") {
      setBienvenidaCargada(true)
      cargarBienvenida()
    }
  }, [bienvenidaCargada, agente, cargarBienvenida])

  function handleSend() {
    if (!input.trim() || isStreaming) return
    sendMessage(input.trim())
    setInput("")
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  async function handleNewChat() {
    clearMessages()
    setInput("")
    if (agente === "administrativo") {
      await cargarBienvenida()
    }
  }

  return (
    <AgentChatUi
      agente={agente}
      usuarioNombre={usuarioNombre}
      messages={messages}
      isStreaming={isStreaming}
      bienvenida={bienvenida}
      error={error}
      input={input}
      onInputChange={setInput}
      onSend={handleSend}
      onInputKeyDown={handleKeyDown}
      onSuggestedPrompt={(text) => {
        if (isStreaming) return
        sendMessage(text)
      }}
      onNewChat={handleNewChat}
      showKeyboardHint={false}
      renderHeader={() => (
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 shrink-0 bg-brand-blue">
          <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-white text-sm font-bold shrink-0">
            {agente === "zymo" ? "Z" : "A"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white leading-none">
              {agente === "zymo" ? "ZYMO" : "Agente Administrativo"}
            </p>
            <p className="text-[10px] text-blue-100 mt-0.5 truncate">
              {isStreaming ? "escribiendo…" : `Hola, ${usuarioNombre.split(" ")[0]}`}
            </p>
          </div>
          {isStreaming && (
            <button
              type="button"
              onClick={cancelStream}
              className="text-blue-200 hover:text-white transition-colors text-xs shrink-0"
            >
              Detener
            </button>
          )}
        </div>
      )}
    />
  )
}
