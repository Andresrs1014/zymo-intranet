import { zymoallyApi } from "@/lib/zymoallyApi"

// Los endpoints de exportar requieren el JWT de sesión (interceptor de
// zymoallyApi) — un <a href> plano no manda ese header, por eso se pide como
// blob y se dispara la descarga a mano. El nombre de archivo lo pone el
// backend vía Content-Disposition; se reusa acá en vez de inventar uno nuevo.
export async function downloadFile(url: string, fallbackName: string): Promise<void> {
  const response = await zymoallyApi.get<Blob>(url, { responseType: "blob" })
  const disposition = response.headers["content-disposition"] as string | undefined
  const match = disposition?.match(/filename="?([^"]+)"?/)
  const filename = match?.[1] ?? fallbackName

  const blobUrl = URL.createObjectURL(response.data)
  const link = document.createElement("a")
  link.href = blobUrl
  link.download = filename
  link.click()
  URL.revokeObjectURL(blobUrl)
}
