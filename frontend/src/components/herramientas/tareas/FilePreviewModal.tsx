import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { TaskAttachment } from "@/types/workTask"
import { getAttachmentUrl } from "@/hooks/useTaskAttachments"

interface FilePreviewModalProps {
  attachment: TaskAttachment | null
  open: boolean
  onClose: () => void
}

export function FilePreviewModal({ attachment, open, onClose }: FilePreviewModalProps) {
  if (!attachment) return null

  const url = getAttachmentUrl(attachment.id)
  const isImage = attachment.mime_type.startsWith("image/")
  const isPdf = attachment.mime_type === "application/pdf"

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="truncate pr-8">{attachment.filename}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-auto bg-gray-100 rounded flex items-center justify-center min-h-[60vh]">
          {isImage && (
            <img
              src={url}
              alt={attachment.filename}
              className="max-w-full max-h-[70vh] object-contain"
            />
          )}
          {isPdf && (
            <iframe
              src={url}
              className="w-full h-[70vh] border-0"
              title={attachment.filename}
            />
          )}
          {!isImage && !isPdf && (
            <div className="text-center p-8">
              <p className="text-gray-600 mb-4">Este tipo de archivo no se puede previsualizar.</p>
              <a
                href={url}
                download={attachment.filename}
                className="text-blue-600 hover:underline"
              >
                Descargar archivo
              </a>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}