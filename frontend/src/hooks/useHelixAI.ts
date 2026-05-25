import { useState, useCallback, useRef } from "react"
import { useAuthStore } from "@/store/authStore"

export interface ChatMessage {
  role: "user" | "agent"
  content: string
  timestamp: string
}

export interface UseHelixAIReturn {
  messages: ChatMessage[]
  isStreaming: boolean
  error: string | null
  sendMessage: (text: string) => void
  clearHistory: () => void
}

const HELIX_API_BASE = import.meta.env.VITE_HELIX_API_URL ?? "http://localhost:3001"

function parseSSEChunk(raw: string): string[] {
  const chunks: string[] = []
  const lines = raw.split("\n")
  for (const line of lines) {
    if (!line.startsWith("data: ")) continue
    const jsonStr = line.slice(6).trim()
    if (!jsonStr) continue
    try {
      const parsed = JSON.parse(jsonStr) as { chunk?: string; done?: boolean; error?: string }
      if (parsed.chunk) {
        chunks.push(parsed.chunk)
      }
    } catch {
      // skip malformed lines
    }
  }
  return chunks
}

export function useHelixAI(): UseHelixAIReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  // Ref mirrors messages to avoid stale closure in sendMessage
  const messagesRef = useRef<ChatMessage[]>([])

  const sendMessage = useCallback(
    (text: string) => {
      if (isStreaming) return

      const token = useAuthStore.getState().token
      const userMessage: ChatMessage = {
        role: "user",
        content: text,
        timestamp: new Date().toISOString(),
      }

      // Snapshot from ref (always current, no stale closure)
      const historialParaEnviar = messagesRef.current.map((m) => ({
        role: m.role === "agent" ? "assistant" : m.role,
        content: m.content,
      }))

      // Update state + ref with user message
      const withUser = [...messagesRef.current, userMessage]
      messagesRef.current = withUser
      setMessages(withUser)
      setIsStreaming(true)
      setError(null)

      const controller = new AbortController()
      abortRef.current = controller

      // Add agent placeholder
      const agentTimestamp = new Date().toISOString()
      const withPlaceholder = [...withUser, { role: "agent" as const, content: "", timestamp: agentTimestamp }]
      messagesRef.current = withPlaceholder
      setMessages(withPlaceholder)

      fetch(`${HELIX_API_BASE}/api/ai/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ mensaje: text, historial: historialParaEnviar }),
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`)
          }
          if (!response.body) {
            throw new Error("No response body")
          }

          const reader = response.body.getReader()
          const decoder = new TextDecoder()
          let buffer = ""

          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })

            // Process complete SSE messages (separated by double newline)
            const parts = buffer.split("\n\n")
            buffer = parts.pop() ?? ""

            for (const part of parts) {
              const chunks = parseSSEChunk(part)
              if (chunks.length > 0) {
                const combined = chunks.join("")
                setMessages((prev) => {
                  const updated = [...prev]
                  const lastIdx = updated.length - 1
                  if (lastIdx >= 0 && updated[lastIdx].role === "agent") {
                    updated[lastIdx] = {
                      ...updated[lastIdx],
                      content: updated[lastIdx].content + combined,
                    }
                  }
                  messagesRef.current = updated
                  return updated
                })
              }
            }
          }

          // Flush remaining buffer
          if (buffer) {
            const chunks = parseSSEChunk(buffer)
            if (chunks.length > 0) {
              const combined = chunks.join("")
              setMessages((prev) => {
                const updated = [...prev]
                const lastIdx = updated.length - 1
                if (lastIdx >= 0 && updated[lastIdx].role === "agent") {
                  updated[lastIdx] = {
                    ...updated[lastIdx],
                    content: updated[lastIdx].content + combined,
                  }
                }
                return updated
              })
            }
          }
        })
        .catch((err: unknown) => {
          const isAbort = err instanceof Error && err.name === "AbortError"
          if (!isAbort) {
            const msg = err instanceof Error ? err.message : "Error al conectar con el agente"
            setError(msg)
            // Remove empty agent placeholder on error
            setMessages((prev) => {
              const last = prev[prev.length - 1]
              if (last?.role === "agent" && last.content === "") {
                return prev.slice(0, -1)
              }
              return prev
            })
          }
        })
        .finally(() => {
          setIsStreaming(false)
          abortRef.current = null
        })
    },
    [isStreaming],
  )

  const clearHistory = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    messagesRef.current = []
    setMessages([])
    setError(null)
    setIsStreaming(false)
  }, [])

  return { messages, isStreaming, error, sendMessage, clearHistory }
}
