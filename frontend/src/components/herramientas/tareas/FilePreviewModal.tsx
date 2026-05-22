import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { TaskAttachment } from "@/types/workTask"
import { useAttachmentBlobUrl } from "@/hooks/useTaskAttachments"

interface FilePreviewModalProps {
  attachment: TaskAttachment | null
  open: boolean
  onClose: () => void
}

export function FilePreviewModal({ attachment, open, onClose }: FilePreviewModalProps) {
  // Only fetch while the modal is open — avoids fetching on every render
  const { blobUrl, loading, error } = useAttachmentBlobUrl(
    open && attachment ? attachment.id : null
  )

  if (!attachment) return null

  const isImage = attachment.mime_type.startsWith("image/")
  const isPdf = attachment.mime_type === "application/pdf"

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="truncate pr-8">{attachment.filename}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-auto bg-gray-100 rounded flex items-center justify-center min-h-[60vh]">
          {loading && (
            <p className="text-sm text-gray-400">Cargando archivo...</p>
          )}
          {error && (
            <p className="text-sm text-red-500">Error al cargar el archivo.</p>
          )}
          {blobUrl && isImage && (
            <img
              src={blobUrl}
              alt={attachment.filename}
              className="max-w-full max-h-[70vh] object-contain"
            />
          )}
          {blobUrl && isPdf && (
            <iframe
              src={blobUrl}
              className="w-full h-[70vh] border-0"
              title={attachment.filename}
            />
          )}
          {blobUrl && !isImage && !isPdf && (
            <div className="text-center p-8">
              <p className="text-gray-600 mb-4">
                Este tipo de archivo no se puede previsualizar directamente.
              </p>
              <a
                href={blobUrl}
                download={attachment.filename}
                className="text-blue-600 hover:underline text-sm"
              >
                Descargar {attachment.filename}
              </a>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
