import { useRef, useEffect, useState, type KeyboardEvent } from "react"
import { useHelixAI } from "@/hooks/useHelixAI"

const QUICK_PROMPTS = [
  "¿Cómo va el equipo hoy?",
  "¿Qué actividades están vencidas?",
  "¿Cuál proyecto tiene mejor ROI?",
]

function TypingIndicator() {
  return (
    <span
      style={{
        display: "inline-flex",
        gap: 4,
        alignItems: "center",
        padding: "4px 2px",
      }}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "var(--helix-muted)",
            animation: "helix-bounce 1.2s infinite",
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}
      <style>{`
        @keyframes helix-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>
    </span>
  )
}

export function AIChat() {
  const { messages, isStreaming, error, sendMessage, clearHistory } = useHelixAI()
  const [inputValue, setInputValue] = useState("")
  const listEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isStreaming])

  function handleSend() {
    const text = inputValue.trim()
    if (!text || isStreaming) return
    setInputValue("")
    sendMessage(text)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        maxHeight: 500,
        background: "var(--helix-bg)",
        borderRadius: 8,
        border: "1px solid var(--helix-border)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          borderBottom: "1px solid var(--helix-border)",
          background: "var(--helix-surface)",
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--helix-ink)" }}>
          🤖 Agente Helix
        </span>
        <button
          onClick={clearHistory}
          title="Limpiar conversación"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: 11,
            color: "var(--helix-muted)",
            padding: "2px 6px",
            borderRadius: 4,
          }}
        >
          Limpiar
        </button>
      </div>

      {/* Message list */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 12,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {messages.length === 0 && !isStreaming && (
          <p
            style={{
              margin: "auto",
              color: "var(--helix-muted)",
              fontSize: 13,
              textAlign: "center",
            }}
          >
            Pregúntame sobre proyectos, actividades y ROI.
          </p>
        )}

        {messages.map((msg, idx) => {
          const isUser = msg.role === "user"
          const isLastAgent =
            !isUser && idx === messages.length - 1 && isStreaming && msg.content === ""

          return (
            <div
              key={idx}
              style={{
                display: "flex",
                justifyContent: isUser ? "flex-end" : "flex-start",
              }}
            >
              <div
                style={{
                  maxWidth: "80%",
                  padding: "8px 12px",
                  borderRadius: isUser ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                  background: isUser ? "var(--helix-accent)" : "var(--helix-surface)",
                  color: isUser ? "#fff" : "var(--helix-ink)",
                  fontSize: 13,
                  lineHeight: 1.5,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  border: isUser ? "none" : "1px solid var(--helix-border)",
                }}
              >
                {isLastAgent ? <TypingIndicator /> : msg.content}
              </div>
            </div>
          )
        })}

        {/* Streaming tail indicator when agent message already has content */}
        {isStreaming &&
          messages.length > 0 &&
          messages[messages.length - 1].role === "agent" &&
          messages[messages.length - 1].content !== "" && (
            <div style={{ display: "flex", justifyContent: "flex-start", marginTop: -6 }}>
              <TypingIndicator />
            </div>
          )}

        {error && (
          <p style={{ color: "var(--helix-accent)", fontSize: 12, textAlign: "center" }}>
            ⚠️ {error}
          </p>
        )}

        <div ref={listEndRef} />
      </div>

      {/* Quick prompts */}
      <div
        style={{
          display: "flex",
          gap: 6,
          padding: "6px 12px",
          overflowX: "auto",
          borderTop: "1px solid var(--helix-border)",
          background: "var(--helix-surface)",
        }}
      >
        {QUICK_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            onClick={() => {
              if (!isStreaming) sendMessage(prompt)
            }}
            disabled={isStreaming}
            style={{
              flexShrink: 0,
              padding: "4px 10px",
              fontSize: 11,
              borderRadius: 20,
              border: "1px solid var(--helix-border)",
              background: "var(--helix-bg)",
              color: "var(--helix-ink)",
              cursor: isStreaming ? "not-allowed" : "pointer",
              opacity: isStreaming ? 0.5 : 1,
              whiteSpace: "nowrap",
            }}
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Input area */}
      <div
        style={{
          display: "flex",
          gap: 8,
          padding: "8px 12px",
          borderTop: "1px solid var(--helix-border)",
          background: "var(--helix-surface)",
          alignItems: "flex-end",
        }}
      >
        <textarea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribe tu pregunta… (Enter para enviar)"
          disabled={isStreaming}
          rows={2}
          style={{
            flex: 1,
            resize: "none",
            border: "1px solid var(--helix-border)",
            borderRadius: 6,
            padding: "6px 10px",
            fontSize: 13,
            background: "var(--helix-bg)",
            color: "var(--helix-ink)",
            outline: "none",
            lineHeight: 1.4,
            fontFamily: "inherit",
          }}
        />
        <button
          onClick={handleSend}
          disabled={!inputValue.trim() || isStreaming}
          title="Enviar"
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            border: "none",
            background: "var(--helix-accent)",
            color: "#fff",
            fontSize: 16,
            cursor: !inputValue.trim() || isStreaming ? "not-allowed" : "pointer",
            opacity: !inputValue.trim() || isStreaming ? 0.5 : 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          ➤
        </button>
      </div>
    </div>
  )
}
