/**
 * Ventana flotante del Agente Administrativo ZYMO.
 *
 * Estados:
 *   minimized → barra pequeña abajo a la derecha con badge de alertas
 *   expanded  → panel con chat completo (tamaño responsive)
 *
 * Se monta una sola vez en App.tsx y persiste entre navegación.
 */
import { useEffect, useRef, useState, useCallback } from "react"
import { useAgent } from "@/hooks/useAgent"
import { AgentChatUi } from "./AgentChatUi"
import { useAgentPanelStore } from "@/store/agentPanelStore"
import { useMinWidth } from "@/hooks/useMinWidth"

const LG_PX = 1024

interface Props {
  /** "administrativo" = Sonia / compras. "zymo" = gerencia (Día 5) */
  agente: "administrativo" | "zymo"
  usuarioNombre: string
}

function measurePanelSize() {
  return {
    w: Math.min(400, Math.floor(window.innerWidth * 0.9)),
    h: Math.min(600, Math.floor(window.innerHeight * 0.85)),
  }
}

export function AgentFloatingWindow({ agente, usuarioNombre }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [input, setInput] = useState("")
  const [bienvenidaCargada, setBienvenidaCargada] = useState(false)
  const [panelSize, setPanelSize] = useState(measurePanelSize)

  const docked = useAgentPanelStore((s) => s.docked)
  const lg = useMinWidth(LG_PX)
  const showFloating = !docked || !lg

  const drag = useRef(false)
  const dragOffset = useRef({ x: 0, y: 0 })
  const windowRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    function measure() {
      setPanelSize(measurePanelSize())
    }
    measure()
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!showFloating) return
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "k") return
      e.preventDefault()
      setExpanded((v) => !v)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [showFloating])

  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!windowRef.current) return
    drag.current = true
    const rect = windowRef.current.getBoundingClientRect()
    dragOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
    e.preventDefault()
  }, [])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!windowRef.current || e.touches.length !== 1) return
    const touch = e.touches[0]
    const rect = windowRef.current.getBoundingClientRect()
    drag.current = true
    dragOffset.current = {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
    }
  }, [])

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!drag.current) return
      setPos({
        x: e.clientX - dragOffset.current.x,
        y: e.clientY - dragOffset.current.y,
      })
    }
    function onMouseUp() {
      drag.current = false
    }
    function onTouchMove(e: TouchEvent) {
      if (!drag.current || e.touches.length !== 1) return
      e.preventDefault()
      const touch = e.touches[0]
      setPos({
        x: touch.clientX - dragOffset.current.x,
        y: touch.clientY - dragOffset.current.y,
      })
    }
    function onTouchEnd() {
      drag.current = false
    }
    document.addEventListener("mousemove", onMouseMove)
    document.addEventListener("mouseup", onMouseUp)
    document.addEventListener("touchmove", onTouchMove, { passive: false })
    document.addEventListener("touchend", onTouchEnd)
    return () => {
      document.removeEventListener("mousemove", onMouseMove)
      document.removeEventListener("mouseup", onMouseUp)
      document.removeEventListener("touchmove", onTouchMove)
      document.removeEventListener("touchend", onTouchEnd)
    }
  }, [])

  const posStyle: React.CSSProperties = pos
    ? { top: pos.y, left: pos.x, bottom: "auto", right: "auto" }
    : { bottom: 20, right: 20 }

  const alertas = bienvenida?.alertas ?? []
  const cotizacionesPendientes = bienvenida?.cotizaciones_pendientes ?? 0
  const badgeCount = alertas.length + (cotizacionesPendientes > 0 ? 1 : 0)

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

  if (!showFloating) return null

  if (!expanded) {
    return (
      <div ref={windowRef} className="fixed z-50 select-none" style={posStyle}>
        <button
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onClick={() => setExpanded(true)}
          type="button"
          className="flex items-center gap-2.5 rounded-2xl bg-white border border-gray-200 shadow-lg px-4 py-3 hover:shadow-xl transition-shadow group cursor-pointer"
        >
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
              {isStreaming
                ? "trabajando..."
                : badgeCount > 0
                  ? `${badgeCount} alerta${badgeCount > 1 ? "s" : ""}`
                  : "disponible"}
            </p>
          </div>

          <svg
            className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500 transition-colors ml-1"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 3a.75.75 0 0 1 .75.75v10.638l3.96-4.158a.75.75 0 1 1 1.08 1.04l-5.25 5.5a.75.75 0 0 1-1.08 0l-5.25-5.5a.75.75 0 1 1 1.08-1.04l3.96 4.158V3.75A.75.75 0 0 1 10 3Z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
    )
  }

  return (
    <div
      ref={windowRef}
      className="fixed z-50 flex flex-col bg-white border border-gray-200 rounded-2xl shadow-2xl select-none overflow-hidden min-w-[280px] min-h-[320px]"
      style={{
        ...posStyle,
        width: panelSize.w,
        height: panelSize.h,
        maxWidth: "min(400px, 90vw)",
        maxHeight: "min(600px, 85vh)",
        resize: "both",
      }}
    >
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
        showKeyboardHint
        renderHeader={() => (
          <div
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 rounded-t-2xl bg-brand-blue cursor-grab active:cursor-grabbing shrink-0"
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
                type="button"
                onClick={cancelStream}
                className="text-blue-200 hover:text-white transition-colors text-xs shrink-0"
              >
                Detener
              </button>
            )}
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="text-blue-200 hover:text-white transition-colors shrink-0 ml-1"
              aria-label="Minimizar"
            >
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M4 10a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H4.75A.75.75 0 0 1 4 10Z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        )}
      />
    </div>
  )
}
