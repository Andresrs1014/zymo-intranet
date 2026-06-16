/**
 * sigDocExtract — Extracción de texto a Markdown en el navegador.
 *
 * Réplica web del flujo de carga de procedimientos de net_file_manager
 * (procedureAnalysisService + documentService), adaptado al objeto `File`
 * del navegador en lugar del IPC de Electron.
 *
 * Soporta: .md / .txt (lectura directa), .docx (mammoth), .pdf (pdfjs-dist).
 */
import mammoth from "mammoth"
import * as pdfjs from "pdfjs-dist"

// mammoth expone convertToMarkdown en runtime, pero sus tipos (v1.12) solo
// declaran convertToHtml/extractRawText. Lo tipamos explícitamente.
interface MammothMarkdown {
  convertToMarkdown: (
    input: { arrayBuffer: ArrayBuffer },
    options?: { styleMap?: string[] },
  ) => Promise<{ value: string; messages: Array<{ type: string; message: string }> }>
}
const mammothMd = mammoth as unknown as MammothMarkdown

// El worker se resuelve desde el bundle local; Vite lo emite en build.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).href

export const SUPPORTED_EXTENSIONS = [".md", ".markdown", ".txt", ".docx", ".pdf"] as const

export const SUPPORTED_ACCEPT = ".md,.markdown,.txt,.docx,.pdf"

export function isAnalyzableFile(name: string): boolean {
  const lower = name.toLowerCase()
  return SUPPORTED_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

/** Convierte un .docx a Markdown usando mammoth (mismo styleMap que net_file_manager). */
async function docxToMarkdown(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammothMd.convertToMarkdown(
    { arrayBuffer },
    {
      styleMap: [
        "p[style-name='Heading 1'] => h1",
        "p[style-name='Heading 2'] => h2",
        "p[style-name='Heading 3'] => h3",
        "p[style-name='List Paragraph'] => li",
        "table => table",
      ],
    },
  )
  return result.value.trim()
}

/** Extrae texto de un .pdf usando pdfjs-dist, una sección por página. */
async function pdfToMarkdown(file: File): Promise<string> {
  const data = new Uint8Array(await file.arrayBuffer())
  const loadingTask = pdfjs.getDocument({ data })
  const pdf = await loadingTask.promise

  const sections: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()
    const pageText = textContent.items
      .map((item) => (item as { str?: string }).str ?? "")
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()
    if (pageText) {
      sections.push(`## Página ${i}\n\n${pageText}`)
    }
  }

  return sections.join("\n\n").trim()
}

/**
 * Extrae el contenido de un documento a Markdown plano.
 * Lanza Error con mensaje legible si el formato no es soportado o falla la conversión.
 */
export async function extractTextFromFile(file: File): Promise<string> {
  const lower = file.name.toLowerCase()

  if (lower.endsWith(".md") || lower.endsWith(".markdown") || lower.endsWith(".txt")) {
    const raw = await file.text()
    return raw.trim()
  }

  if (lower.endsWith(".docx")) {
    try {
      return await docxToMarkdown(file)
    } catch (err) {
      throw new Error(
        err instanceof Error ? `No se pudo leer el .docx: ${err.message}` : "No se pudo leer el documento Word",
      )
    }
  }

  if (lower.endsWith(".pdf")) {
    try {
      const text = await pdfToMarkdown(file)
      if (!text) throw new Error("El PDF no contiene texto extraíble (posible escaneo o imagen).")
      return text
    } catch (err) {
      throw new Error(
        err instanceof Error ? `No se pudo leer el PDF: ${err.message}` : "No se pudo leer el documento PDF",
      )
    }
  }

  throw new Error("Formato no soportado. Usa MD, TXT, DOCX o PDF.")
}
