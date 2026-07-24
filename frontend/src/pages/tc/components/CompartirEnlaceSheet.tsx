import { useState } from "react"
import { Check, Link2 } from "lucide-react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { BlurFade } from "@/components/ui/blur-fade"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  url: string
  titulo: string
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12.004 2.003c-5.514 0-9.997 4.483-9.997 9.997 0 1.762.464 3.484 1.346 4.997L2 22l5.126-1.335a9.958 9.958 0 0 0 4.877 1.27h.004c5.514 0 9.997-4.483 9.997-9.997 0-2.67-1.04-5.182-2.929-7.07a9.935 9.935 0 0 0-7.07-2.865zm.001 18.16h-.003a8.19 8.19 0 0 1-4.174-1.14l-.3-.178-3.043.793.812-2.968-.195-.306a8.147 8.147 0 0 1-1.253-4.36c0-4.507 3.667-8.173 8.176-8.173a8.12 8.12 0 0 1 5.783 2.397 8.113 8.113 0 0 1 2.393 5.784c0 4.508-3.667 8.15-8.196 8.15z" />
    </svg>
  )
}

export function CompartirEnlaceSheet({ open, onOpenChange, url, titulo }: Props) {
  const [copiado, setCopiado] = useState(false)

  function compartirWhatsapp() {
    const texto = encodeURIComponent(`${titulo}\n${url}`)
    window.open(`https://wa.me/?text=${texto}`, "_blank", "noopener,noreferrer")
  }

  async function copiarEnlace() {
    try {
      await navigator.clipboard.writeText(url)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch { /* clipboard no disponible en este navegador */ }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto max-w-md rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>Compartir enlace</SheetTitle>
          <SheetDescription>{titulo} — cualquiera con este enlace puede diligenciarlo, sin iniciar sesión.</SheetDescription>
        </SheetHeader>
        <div className="grid grid-cols-2 gap-4 mt-4 pb-2">
          <BlurFade delay={0.02} direction="up" offset={8}>
            <button
              type="button"
              onClick={compartirWhatsapp}
              className="w-full flex flex-col items-center gap-2 rounded-xl p-3 hover:bg-muted/40 transition-colors"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366] text-white">
                <WhatsAppIcon className="h-6 w-6" />
              </span>
              <span className="text-xs font-medium">WhatsApp</span>
            </button>
          </BlurFade>
          <BlurFade delay={0.08} direction="up" offset={8}>
            <button
              type="button"
              onClick={copiarEnlace}
              className="w-full flex flex-col items-center gap-2 rounded-xl p-3 hover:bg-muted/40 transition-colors"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-foreground">
                {copiado ? <Check className="h-5 w-5" /> : <Link2 className="h-5 w-5" />}
              </span>
              <span className="text-xs font-medium">{copiado ? "¡Copiado!" : "Copiar enlace"}</span>
            </button>
          </BlurFade>
        </div>
      </SheetContent>
    </Sheet>
  )
}
