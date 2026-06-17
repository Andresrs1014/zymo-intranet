import mammoth from "mammoth"
// pdf-parse ESM workaround: tipos no coinciden con el export real
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse") as (buffer: Buffer) => Promise<{ text: string; numpages: number }>
import fs from "fs/promises"

export interface ExtractionResult {
  text: string
  warnings: string[]
}

interface MammothResult {
  value: string
  messages: Array<{ type: string; message: string }>
}

export async function extractText(filePath: string, fileName: string): Promise<ExtractionResult> {
  const lower = fileName.toLowerCase()

  if (lower.endsWith(".md") || lower.endsWith(".markdown") || lower.endsWith(".txt")) {
    const text = await fs.readFile(filePath, "utf-8")
    return { text: text.trim(), warnings: [] }
  }

  if (lower.endsWith(".docx")) {
    const buffer = await fs.readFile(filePath)
    const result: MammothResult = await (mammoth as unknown as {
      convertToMarkdown: (
        input: { buffer: Buffer },
        options?: { styleMap?: string[] },
      ) => Promise<MammothResult>
    }).convertToMarkdown(
      { buffer },
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
    const warnings = result.messages
      .filter((m) => m.type === "warning")
      .map((m) => m.message)
    return { text: result.value.trim(), warnings }
  }

  if (lower.endsWith(".pdf")) {
    const buffer = await fs.readFile(filePath)
    try {
      const data = await pdfParse(buffer)
      const text = data.text.trim()
      if (!text) {
        return {
          text: "",
          warnings: ["El PDF no contiene texto extraíble. Puede ser un documento escaneado o basado en imágenes."],
        }
      }
      return { text, warnings: [] }
    } catch {
      return {
        text: "",
        warnings: ["No se pudo extraer el texto del PDF. El archivo puede estar corrupto o protegido."],
      }
    }
  }

  if (lower.endsWith(".doc")) {
    return {
      text: "",
      warnings: [
        "Los archivos .doc (Word clásico) no admiten extracción automática de texto. " +
        "El archivo original está disponible en la pestaña Archivo para descarga o visualización.",
      ],
    }
  }

  return { text: "", warnings: ["Formato no reconocido para extracción de texto."] }
}
