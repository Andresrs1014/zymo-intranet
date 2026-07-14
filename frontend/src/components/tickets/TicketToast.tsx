import { useEffect, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { CheckCircle2, XCircle } from "lucide-react"

export type TicketToastType = "success" | "error"

interface TicketToastState {
  id: string
  message: string
  type: TicketToastType
}

const TICKET_TOAST_EVENT = "ticket-toast"
const AUTO_DISMISS_MS = 2800

// Confirmación prominente (no una notificación de esquina discreta como la
// de tareas-v2): top-center, ícono, animación spring de entrada/salida.
export function useTicketToast() {
  function showToast(message: string, type: TicketToastType = "success") {
    window.dispatchEvent(new CustomEvent(TICKET_TOAST_EVENT, { detail: { message, type } }))
  }
  return { showToast }
}

export function TicketToastContainer() {
  const [toast, setToast] = useState<TicketToastState | null>(null)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    function handler(e: Event) {
      const { message, type } = (e as CustomEvent<{ message: string; type: TicketToastType }>).detail
      const id = `${Date.now()}`
      setToast({ id, message, type })
      setTimeout(() => {
        setToast((current) => (current?.id === id ? null : current))
      }, AUTO_DISMISS_MS)
    }
    window.addEventListener(TICKET_TOAST_EVENT, handler)
    return () => window.removeEventListener(TICKET_TOAST_EVENT, handler)
  }, [])

  return (
    <div className="pointer-events-none fixed inset-x-0 top-6 z-[500] flex justify-center">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            role={toast.type === "error" ? "alert" : "status"}
            aria-live={toast.type === "error" ? "assertive" : "polite"}
            aria-atomic="true"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -24, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -16, scale: 0.95 }}
            transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 320, damping: 24 }}
            className={`pointer-events-auto flex items-center gap-3 rounded-xl border px-5 py-3.5 shadow-lg ${
              toast.type === "success"
                ? "border-primary/30 bg-white text-zinc-900"
                : "border-red-200 bg-red-50 text-red-900"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircle2 className="h-6 w-6 shrink-0 text-primary" />
            ) : (
              <XCircle className="h-6 w-6 shrink-0 text-red-600" />
            )}
            <span className="text-sm font-semibold">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
