import { useState, useEffect } from "react"

export type ToastType = "success" | "error" | "info"

export interface Toast {
  id: string
  message: string
  type: ToastType
}

const TASK_TOAST_EVENT = "task-toast"
const AUTO_DISMISS_MS = 3500
const MAX_TOASTS = 4

const TYPE_COLORS: Record<ToastType, string> = {
  success: "#059669",
  error: "#c41e3a",
  info: "#0284c7",
}

export function useTaskToast() {
  function showToast(message: string, type: ToastType = "info") {
    window.dispatchEvent(new CustomEvent(TASK_TOAST_EVENT, { detail: { message, type } }))
  }
  return { showToast }
}

export function TaskToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    function handler(e: Event) {
      const { message, type } = (e as CustomEvent<{ message: string; type: ToastType }>).detail
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
      setToasts((prev) => {
        const next = [...prev, { id, message, type }]
        return next.length > MAX_TOASTS ? next.slice(next.length - MAX_TOASTS) : next
      })
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), AUTO_DISMISS_MS)
    }
    window.addEventListener(TASK_TOAST_EVENT, handler)
    return () => window.removeEventListener(TASK_TOAST_EVENT, handler)
  }, [])

  if (toasts.length === 0) return null

  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 500,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        pointerEvents: "none",
      }}
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          style={{
            display: "flex",
            alignItems: "stretch",
            background: "#ffffff",
            borderRadius: 8,
            boxShadow: "0 10px 30px rgba(24,24,27,0.18)",
            border: "1px solid #e4e4e7",
            overflow: "hidden",
            minWidth: 240,
            maxWidth: 340,
            pointerEvents: "auto",
          }}
        >
          <div style={{ width: 4, flexShrink: 0, background: TYPE_COLORS[toast.type] }} />
          <div style={{ padding: "12px 16px", fontSize: 13, fontWeight: 500, color: "#18181b", lineHeight: 1.4 }}>
            {toast.message}
          </div>
        </div>
      ))}
    </div>
  )
}
