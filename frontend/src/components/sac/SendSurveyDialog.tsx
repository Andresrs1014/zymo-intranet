import { useEffect, useState } from "react"
import { Copy, MessageCircle, Mail } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Combobox } from "@/components/ui/Combobox"
import { ShimmerButton } from "@/components/ui/shimmer-button"
import { useSacUI } from "@/context/SacContext"
import { useSendSurveyLink } from "@/hooks/useSac"
import { useTicketToast } from "@/components/tickets/TicketToast"
import { extractErrorMessage } from "@/lib/ticketErrors"

const LABEL = "mb-1.5 block text-[11px] font-bold uppercase tracking-[0.06em] text-zinc-500"

const SURVEY_TYPES = [
  { value: "client", label: "Fidelización de clientes (NPS)" },
  { value: "experience", label: "Diseñando la Experiencia" },
]

export function SendSurveyDialog() {
  const { sendSurveyOpen, setSendSurveyOpen } = useSacUI()
  const [surveyType, setSurveyType] = useState<"client" | "experience" | "">("")
  const [url, setUrl] = useState<string | null>(null)
  const sendLink = useSendSurveyLink()
  const { showToast } = useTicketToast()

  useEffect(() => {
    if (sendSurveyOpen) {
      setSurveyType("")
      setUrl(null)
    }
  }, [sendSurveyOpen])

  async function handleGenerate() {
    if (!surveyType) return
    try {
      const result = await sendLink.mutateAsync(surveyType)
      setUrl(result.shortUrl)
    } catch (err) {
      showToast(extractErrorMessage(err, "No se pudo generar el link."), "error")
    }
  }

  function handleCopy() {
    if (!url) return
    navigator.clipboard.writeText(url)
    showToast("Link copiado", "success")
  }

  return (
    <Dialog open={sendSurveyOpen} onOpenChange={setSendSurveyOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar encuesta</DialogTitle>
          <DialogDescription>Genera un link público de encuesta para compartir con el cliente.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <label className={LABEL}>Tipo de encuesta</label>
            <Combobox
              options={SURVEY_TYPES}
              value={surveyType || null}
              onChange={(v) => { setSurveyType((v as typeof surveyType) || ""); setUrl(null) }}
              placeholder="Seleccionar…"
            />
          </div>

          {!url ? (
            <ShimmerButton type="button" onClick={handleGenerate} disabled={!surveyType || sendLink.isPending} className="w-full justify-center">
              {sendLink.isPending ? "Generando…" : "Generar link"}
            </ShimmerButton>
          ) : (
            <div className="space-y-2">
              <div className="rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 text-xs text-zinc-700 break-all">
                {url}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-50"
                >
                  <Copy size={14} /> Copiar
                </button>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(url)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-50"
                >
                  <MessageCircle size={14} /> WhatsApp
                </a>
                <a
                  href={`mailto:?body=${encodeURIComponent(url)}`}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-50"
                >
                  <Mail size={14} /> Correo
                </a>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
