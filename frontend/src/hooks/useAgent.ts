/**
 * Hook para interactuar con el Agente Administrativo ZYMO.
 * Maneja el estado del chat y el streaming SSE vía fetch + ReadableStream.
 * Persistencia en localStorage (máx. 30 mensajes por agente).
 */
import { useState, useCallback, useRef, useEffect } from "react"
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

const MAX_STORED_MESSAGES = 30

function storageKey(agente: string) {
  return `zymo_agent_chat_${agente}`
}

function loadStoredMessages(agente: string): AgentMessage[] {
  try {
    const raw = localStorage.getItem(storageKey(agente))
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.slice(-MAX_STORED_MESSAGES).flatMap((m) => {
      if (!m || typeof m !== "object") return []
      const o = m as Record<string, unknown>
      const role = o.role
      const content = o.content
      const ts = o.timestamp
      if (role !== "user" && role !== "agent") return []
      if (typeof content !== "string") return []
      const timestamp =
        typeof ts === "string" || typeof ts === "number" ? new Date(ts) : new Date()
      return [{ role, content, timestamp }]
    })
  } catch {
    return []
  }
}

function authHeaders(): Record<string, string> {
  const token = useAuthStore.getState().token
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

export function useAgent(agente: "administrativo" | "zymo" = "administrativo") {
  const [messages, setMessages] = useState<AgentMessage[]>(() => loadStoredMessages(agente))
  const [isStreaming, setIsStreaming] = useState(false)
  const [bienvenida, setBienvenida] = useState<BienvenidaData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const messagesRef = useRef(messages)
  messagesRef.current = messages

  const chatEndpoint =
    agente === "zymo"
      ? `${BASE_URL}/api/zymo/chat`
      : `${BASE_URL}/api/agentes/administrativo/chat`

  useEffect(() => {
    try {
      if (messages.length === 0) {
        localStorage.removeItem(storageKey(agente))
        return
      }
      const serializable = messages.slice(-MAX_STORED_MESSAGES).map((m) => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp.toISOString(),
      }))
      localStorage.setItem(storageKey(agente), JSON.stringify(serializable))
    } catch {
      // storage lleno o privado — ignorar
    }
  }, [messages, agente])

  // ── Bienvenida al login ────────────────────────────────────────────────────

  const cargarBienvenida = useCallback(async () => {
    if (agente !== "administrativo") return
    try {
      const res = await fetch(`${BASE_URL}/api/agentes/administrativo/bienvenida`, {
        method: "POST",
        headers: authHeaders(),
      })
      if (!res.ok) return
      const data: BienvenidaData = await res.json()
      setBienvenida(data)
      setMessages((prev) => {
        if (prev.length > 0) return prev
        return [
          {
            role: "agent",
            content: data.mensaje,
            timestamp: new Date(),
          },
        ]
      })
    } catch {
      // Bienvenida es opcional — falla silenciosamente
    }
  }, [agente])

  // ── Enviar mensaje con streaming ───────────────────────────────────────────

  const sendMessage = useCallback(
    async (texto: string) => {
      if (!texto.trim() || isStreaming) return

      const historial = messagesRef.current.map((m) => ({
        role: m.role === "user" ? "user" : "model",
        content: m.content,
      }))

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
              const parsed = JSON.parse(raw) as { chunk?: string; error?: string }
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
        setMessages((prev) => prev.filter((_, i) => i !== prev.length - 1))
      } finally {
        setIsStreaming(false)
        abortRef.current = null
      }
    },
    [isStreaming, chatEndpoint]
  )

  const cancelStream = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const clearMessages = useCallback(() => {
    setMessages([])
    setBienvenida(null)
    setError(null)
    try {
      localStorage.removeItem(storageKey(agente))
    } catch {
      /* noop */
    }
  }, [agente])

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
