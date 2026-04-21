/**
 * Ventana flotante del Agente Administrativo ZYMO.
 *
 * Estados:
 *   minimized → barra pequeña abajo a la derecha con badge de alertas
 *   expanded  → panel lateral de ~400px con chat completo
 *
 * Se monta una sola vez en App.tsx y persiste entre navegación.
 */
import { useEffect, useRef, useState, useCallback } from "react"
import { useAgent } from "@/hooks/useAgent"
import { AgentMessageStream } from "./AgentMessageStream"

interface Props {
  /** "administrativo" = Sonia / compras. "zymo" = gerencia (Día 5) */
  agente: "administrativo" | "zymo"
  usuarioNombre: string
}

export function AgentFloatingWindow({ agente, usuarioNombre }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [input, setInput] = useState("")
  const [bienvenidaCargada, setBienvenidaCargada] = useState(false)

  // Drag state
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const dragging = useRef(false)
  const dragOffset = useRef({ x: 0, y: 0 })
  const windowRef = useRef<HTMLDivElement>(null)

  const { messages, isStreaming, bienvenida, error, sendMessage, cancelStream, cargarBienvenida } =
    useAgent(agente)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Cargar bienvenida una sola vez
  useEffect(() => {
    if (!bienvenidaCargada && agente === "administrativo") {
      setBienvenidaCargada(true)
      cargarBienvenida()
    }
  }, [bienvenidaCargada, agente, cargarBienvenida])

  // Auto-scroll al último mensaje
  useEffect(() => {
    if (expanded) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages, expanded])

  // ── Drag ────────────────────────────────────────────────────────────────────

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!windowRef.current) return
    dragging.current = true
    const rect = windowRef.current.getBoundingClientRect()
    dragOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
    e.preventDefault()
  }, [])

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!dragging.current) return
      setPos({
        x: e.clientX - dragOffset.current.x,
        y: e.clientY - dragOffset.current.y,
      })
    }
    function onMouseUp() {
      dragging.current = false
    }
    document.addEventListener("mousemove", onMouseMove)
    document.addEventListener("mouseup", onMouseUp)
    return () => {
      document.removeEventListener("mousemove", onMouseMove)
      document.removeEventListener("mouseup", onMouseUp)
    }
  }, [])

  // ── Estilos de posición ──────────────────────────────────────────────────────

  const posStyle: React.CSSProperties = pos
    ? { top: pos.y, left: pos.x, bottom: "auto", right: "auto" }
    : { bottom: 20, right: 20 }

  const alertas = bienvenida?.alertas ?? []
  const cotizacionesPendientes = bienvenida?.cotizaciones_pendientes ?? 0
  const badgeCount = alertas.length + (cotizacionesPendientes > 0 ? 1 : 0)

  // ── Envío de mensaje ─────────────────────────────────────────────────────────

  function handleSend() {
    if (!input.trim() || isStreaming) return
    sendMessage(input.trim())
    setInput("")
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // ── Render minimizado ────────────────────────────────────────────────────────

  if (!expanded) {
    return (
      <div
        ref={windowRef}
        className="fixed z-50 select-none"
        style={posStyle}
      >
        <button
          onMouseDown={handleMouseDown}
          onClick={() => setExpanded(true)}
          className="flex items-center gap-2.5 rounded-2xl bg-white border border-gray-200 shadow-lg px-4 py-3 hover:shadow-xl transition-shadow group cursor-pointer"
        >
          {/* Ícono agente */}
          <div className="relative">
            <div className="w-8 h-8 rounded-full bg-brand-blue flex items-center justify-center text-white text-sm font-bold">
              {agente === "zymo" ? "Z" : "A"}
            </div>
            {isStreaming && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-white animate-pulse" />
            )}
            {!isStreaming && badgeCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center border border-white">
                {badgeCount > 9 ? "9+" : badgeCount}
              </span>
            )}
          </div>

          <div className="text-left">
            <p className="text-xs font-semibold text-gray-800 leading-none">
              {agente === "zymo" ? "ZYMO" : "Agente Administrativo"}
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">
              {isStreaming ? "trabajando..." : badgeCount > 0 ? `${badgeCount} alerta${badgeCount > 1 ? "s" : ""}` : "disponible"}
            </p>
          </div>

          <svg className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500 transition-colors ml-1" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a.75.75 0 0 1 .75.75v10.638l3.96-4.158a.75.75 0 1 1 1.08 1.04l-5.25 5.5a.75.75 0 0 1-1.08 0l-5.25-5.5a.75.75 0 1 1 1.08-1.04l3.96 4.158V3.75A.75.75 0 0 1 10 3Z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    )
  }

  // ── Render expandido ─────────────────────────────────────────────────────────

  return (
    <div
      ref={windowRef}
      className="fixed z-50 flex flex-col bg-white border border-gray-200 rounded-2xl shadow-2xl select-none"
      style={{ ...posStyle, width: 380, height: 560 }}
    >
      {/* Header (arrastrable) */}
      <div
        onMouseDown={handleMouseDown}
        className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 rounded-t-2xl bg-brand-blue cursor-grab active:cursor-grabbing"
      >
        <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-white text-sm font-bold shrink-0">
          {agente === "zymo" ? "Z" : "A"}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white leading-none">
            {agente === "zymo" ? "ZYMO" : "Agente Administrativo"}
          </p>
          <p className="text-[10px] text-blue-100 mt-0.5 truncate">
            {isStreaming ? "escribiendo..." : `Hola, ${usuarioNombre.split(" ")[0]}`}
          </p>
        </div>
        {isStreaming && (
          <button
            onClick={cancelStream}
            className="text-blue-200 hover:text-white transition-colors text-xs shrink-0"
          >
            Detener
          </button>
        )}
        <button
          onClick={() => setExpanded(false)}
          className="text-blue-200 hover:text-white transition-colors shrink-0 ml-1"
          aria-label="Minimizar"
        >
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4 10a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H4.75A.75.75 0 0 1 4 10Z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {/* Alertas de bienvenida (solo si hay) */}
      {alertas.length > 0 && messages.length <= 1 && (
        <div className="mx-3 mt-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
          {alertas.map((a, i) => (
            <p key={i} className="text-xs text-amber-700 leading-snug">⚠ {a}</p>
          ))}
        </div>
      )}

      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.length === 0 && !isStreaming && (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
            <p className="text-sm font-medium">¿En qué te ayudo hoy?</p>
            <p className="text-xs mt-1">Pregúntame sobre solicitudes, cotizaciones o procedimientos.</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <AgentMessageStream key={i} message={msg} isLast={i === messages.length - 1} isStreaming={isStreaming} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="mx-3 mb-1 rounded-lg bg-red-50 border border-red-200 px-3 py-1.5">
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}

      {/* Input */}
      <div className="px-3 pb-3 pt-2 border-t border-gray-100">
        <div className="flex items-end gap-2">
          <textarea
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isStreaming}
            placeholder="Escribe tu pregunta... (Enter para enviar)"
            className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30 disabled:bg-gray-50 disabled:text-gray-400"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            className="shrink-0 w-9 h-9 rounded-xl bg-brand-blue text-white flex items-center justify-center hover:brightness-105 disabled:opacity-40 transition-all"
            aria-label="Enviar"
          >
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M3.105 2.288a.75.75 0 0 0-.826.95l1.414 4.925A1.5 1.5 0 0 0 5.135 9.25h6.115a.75.75 0 0 1 0 1.5H5.135a1.5 1.5 0 0 0-1.442 1.087L2.28 16.761a.75.75 0 0 0 .826.95 28.896 28.896 0 0 0 15.293-7.154.75.75 0 0 0 0-1.115A28.897 28.897 0 0 0 3.105 2.288Z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
