import { useEffect } from "react"

interface ImageModalProps {
  isOpen: boolean
  imageUrl: string
  filename: string
  onClose: () => void
}

export function ImageModal({ isOpen, imageUrl, filename, onClose }: ImageModalProps) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    if (isOpen) document.addEventListener("keydown", handleEsc)
    return () => document.removeEventListener("keydown", handleEsc)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative max-w-[90vw] max-h-[90vh] flex flex-col bg-white rounded-xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50 shrink-0">
          <h3 className="text-sm font-medium text-gray-700 truncate max-w-[60vw]">{filename}</h3>
          <div className="flex items-center gap-2">
            <a
              href={imageUrl}
              download={filename}
              className="p-1.5 text-gray-500 hover:text-primary hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-medium"
              title="Descargar imagen"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Descargar
            </a>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors ml-2"
              title="Cerrar"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div className="p-4 overflow-auto flex items-center justify-center bg-gray-100/50">
          <img
            src={imageUrl}
            alt={filename}
            className="max-w-full max-h-[75vh] object-contain rounded border border-gray-200 shadow-sm"
          />
        </div>
      </div>
    </div>
  )
}