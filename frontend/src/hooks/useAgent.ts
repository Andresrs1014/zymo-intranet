/**
 * Hook para interactuar con el Agente Administrativo ZYMO.
 * Maneja el estado del chat y el streaming SSE vía fetch + ReadableStream.
 */
import { useState, useCallback, useRef } from "react"
import { useAuthStore } from "@/store/authStore"

export interface AgentMessage {
  role: "user" | "agent"
  content: string
  timestamp: Date
}

export interface BienvenidaData {
  mensaje: string
  alertas: string[]
  cotizaciones_pendientes: number
}

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8001"

function authHeaders(): Record<string, string> {
  const token = useAuthStore.getState().token
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

export function useAgent(agente: "administrativo" | "zymo" = "administrativo") {
  const [messages, setMessages] = useState<AgentMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [bienvenida, setBienvenida] = useState<BienvenidaData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const chatEndpoint =
    agente === "zymo"
      ? `${BASE_URL}/api/zymo/chat`
      : `${BASE_URL}/api/agentes/administrativo/chat`

  // ── Bienvenida al login ────────────────────────────────────────────────────

  const cargarBienvenida = useCallback(async () => {
    // Bienvenida solo disponible para el Agente Administrativo
    if (agente !== "administrativo") return
    try {
      const res = await fetch(`${BASE_URL}/api/agentes/administrativo/bienvenida`, {
        method: "POST",
        headers: authHeaders(),
      })
      if (!res.ok) return
      const data: BienvenidaData = await res.json()
      setBienvenida(data)
      setMessages([
        {
          role: "agent",
          content: data.mensaje,
          timestamp: new Date(),
        },
      ])
    } catch {
      // Bienvenida es opcional — falla silenciosamente
    }
  }, [agente])

  // ── Enviar mensaje con streaming ───────────────────────────────────────────

  const sendMessage = useCallback(
    async (texto: string) => {
      if (!texto.trim() || isStreaming) return

      const userMsg: AgentMessage = {
        role: "user",
        content: texto.trim(),
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, userMsg])
      setIsStreaming(true)
      setError(null)

      const agentMsg: AgentMessage = {
        role: "agent",
        content: "",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, agentMsg])

      const historial = messages.map((m) => ({
        role: m.role === "user" ? "user" : "model",
        content: m.content,
      }))

      abortRef.current = new AbortController()

      try {
        const res = await fetch(chatEndpoint, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ mensaje: texto.trim(), historial }),
          signal: abortRef.current.signal,
        })

        if (!res.ok || !res.body) {
          throw new Error(`Error ${res.status}`)
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n")
          buffer = lines.pop() ?? ""

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue
            const raw = line.slice(6).trim()
            if (!raw) continue
            try {
              const parsed = JSON.parse(raw)
              if (parsed.chunk) {
                setMessages((prev) => {
                  const next = [...prev]
                  next[next.length - 1] = {
                    ...next[next.length - 1],
                    content: next[next.length - 1].content + parsed.chunk,
                  }
                  return next
                })
              }
              if (parsed.error) {
                setError(parsed.error)
              }
            } catch {
              // chunk inválido — ignorar
            }
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return
        setError("No se pudo conectar con el agente. Intenta de nuevo.")
        // Quitar el placeholder vacío del agente
        setMessages((prev) => prev.filter((_, i) => i !== prev.length - 1))
      } finally {
        setIsStreaming(false)
        abortRef.current = null
      }
    },
    [isStreaming, messages]
  )

  const cancelStream = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const clearMessages = useCallback(() => {
    setMessages([])
    setBienvenida(null)
    setError(null)
  }, [])

  return {
    messages,
    isStreaming,
    bienvenida,
    error,
    sendMessage,
    cancelStream,
    cargarBienvenida,
    clearMessages,
  }
}
