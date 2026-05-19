import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { useUploadTaskAttachment } from "@/hooks/useTaskAttachments"

interface FileUploadZoneProps {
  taskId: number
}

export function FileUploadZone({ taskId }: FileUploadZoneProps) {
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const uploadMutation = useUploadTaskAttachment()

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      await uploadMutation.mutateAsync({ taskId, file })
    } catch (err) {
      console.error("Error uploading file:", err)
    } finally {
      setUploading(false)
      if (inputRef.current) {
        inputRef.current.value = ""
      }
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
        onChange={handleFileChange}
        className="hidden"
        id={`file-upload-${taskId}`}
      />
      <label htmlFor={`file-upload-${taskId}`}>
        <Button type="button" variant="outline" size="sm" asChild>
          <span className="cursor-pointer">
            {uploading ? "Subiendo..." : "Adjuntar archivo"}
          </span>
        </Button>
      </label>
      <span className="text-xs text-muted-foreground">
        PDF, JPG, PNG, GIF, WebP (max 10MB)
      </span>
    </div>
  )
}