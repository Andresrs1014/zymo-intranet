import { useState, useCallback, useEffect } from "react"
import { DayPicker } from "react-day-picker"
import { Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useEventsByDate } from "@/hooks/useWorkTasks"
import type { TaskEvent } from "@/types/workTask"
import { format } from "date-fns"
import { es } from "date-fns/locale"

interface Props {
  isOpen: boolean
  onDateSelect: (date: Date) => void
  onEventClick: (event: TaskEvent) => void
  onNewEvent: (date: Date) => void
}

const MIN_WIDTH = 280
const MAX_WIDTH = 500
const DEFAULT_WIDTH = 320

export function CalendarSidebar({
  isOpen,
  onDateSelect,
  onEventClick,
  onNewEvent,
}: Props) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_WIDTH)
  const [isDragging, setIsDragging] = useState(false)

  const fechaStr = format(selectedDate, "yyyy-MM-dd")
  const { data: events = [] } = useEventsByDate(isOpen ? fechaStr : null)

  const handleSelect = (date: Date | undefined) => {
    if (!date) return
    setSelectedDate(date)
    onDateSelect(date)
  }

  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const stopResizing = useCallback(() => setIsDragging(false), [])

  const resize = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return
      const newWidth = document.body.clientWidth - e.clientX
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth)
      }
    },
    [isDragging]
  )

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", resize)
      window.addEventListener("mouseup", stopResizing)
      document.body.style.userSelect = "none"
      document.body.style.cursor = "col-resize"
    } else {
      window.removeEventListener("mousemove", resize)
      window.removeEventListener("mouseup", stopResizing)
      document.body.style.userSelect = ""
      document.body.style.cursor = ""
    }
    return () => {
      window.removeEventListener("mousemove", resize)
      window.removeEventListener("mouseup", stopResizing)
    }
  }, [isDragging, resize, stopResizing])

  const isToday = fechaStr === format(new Date(), "yyyy-MM-dd")

  return (
    <aside
      className={`border-l border-border bg-background flex flex-col relative transition-all duration-300 ease-in-out ${
        isOpen ? "opacity-100" : "opacity-0 overflow-hidden border-l-0"
      }`}
      style={{ width: isOpen ? sidebarWidth : 0 }}
    >
      {isOpen && (
        <div
          className={`absolute left-0 top-0 bottom-0 w-2 cursor-col-resize z-30 transition-colors -translate-x-1/2 ${
            isDragging ? "bg-primary/40" : "bg-transparent hover:bg-primary/20"
          }`}
          onMouseDown={startResizing}
        />
      )}

      <div className="flex flex-col h-full">
        <div className="p-4 border-b border-border flex items-center gap-2 shrink-0">
          <Calendar className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">Agenda</span>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-3 border-b border-border/50">
            <DayPicker
              mode="single"
              selected={selectedDate}
              onSelect={handleSelect}
              locale={es}
              className="w-full"
              classNames={{
                selected: "bg-primary text-primary-foreground rounded-md font-bold",
                today: "bg-accent text-accent-foreground rounded-md font-semibold",
              }}
            />
          </div>

          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                {isToday ? "Hoy" : format(selectedDate, "d MMM", { locale: es })}
              </h4>
              <Badge variant="secondary" className="text-[10px]">
                {events.length} eventos
              </Badge>
            </div>

            <Button
              size="sm"
              variant="outline"
              className="w-full text-xs"
              onClick={() => onNewEvent(selectedDate)}
            >
              + Agendar
            </Button>

            {events.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                Sin eventos este día.
              </p>
            ) : (
              <div className="space-y-2">
                {events.map((ev: TaskEvent) => {
                  const hasConflict = ev.participants.some((p) => p.has_conflict)
                  return (
                    <div
                      key={ev.id}
                      onClick={() => onEventClick(ev)}
                      className={`rounded-lg border p-3 cursor-pointer transition-colors hover:border-primary/40 ${
                        hasConflict
                          ? "border-amber-200 bg-amber-50"
                          : "border-border bg-background hover:bg-muted/30"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className="text-sm font-semibold leading-tight line-clamp-2">
                          {ev.titulo}
                        </span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {ev.hora_inicio}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {ev.participants.length} participante
                        {ev.participants.length !== 1 ? "s" : ""}
                      </p>
                      {hasConflict && (
                        <p className="text-xs text-amber-700 mt-1">Conflicto de agenda</p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  )
}
