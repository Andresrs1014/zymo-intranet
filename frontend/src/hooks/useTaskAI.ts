import { useState, useEffect, useRef } from "react"
import { taskApi } from "@/lib/taskApi"
import type { AISuggestions } from "@/types/task"

const DEBOUNCE_MS = 800

export function useTaskAISuggestions(titulo: string) {
  const [suggestions, setSuggestions] = useState<AISuggestions | null>(null)
  const [loading, setLoading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)

    if (!titulo || titulo.trim().length < 3) {
      setSuggestions(null)
      return
    }

    timerRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const { data } = await taskApi.post<AISuggestions>("/api/ai/suggestions", { titulo })
        setSuggestions(data)
      } catch {
        setSuggestions({ available: false })
      } finally {
        setLoading(false)
      }
    }, DEBOUNCE_MS)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [titulo])

  return { suggestions, loading }
}
