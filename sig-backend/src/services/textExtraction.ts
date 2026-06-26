import mammoth from "mammoth"
// pdf-parse ESM workaround: tipos no coinciden con el export real
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse") as (buffer: Buffer) => Promise<{ text: string; numpages: number }>
import fs from "fs/promises"
import os from "os"
import { execFile } from "child_process"
import { promisify } from "util"

const execFileAsync = promisify(execFile)

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
      if (text) return { text, warnings: [] }

      // PDF escaneado: OCR solo corre cuando pdf-parse no encuentra texto digital.
      const { fromPath } = await import("pdf2pic")
      const { createWorker } = await import("tesseract.js")

      const converter = fromPath(filePath, {
        density: 200,
        saveFilename: "ocr_page",
        savePath: os.tmpdir(),
        format: "png",
        width: 2480,
        height: 3508,
      })

      const pageCount = data.numpages || 1
      const worker = await createWorker("spa")
      const ocrTexts: string[] = []

      try {
        for (let i = 1; i <= Math.min(pageCount, 20); i++) {
          const result = await converter(i)
          if (result.path) {
            try {
              const { data: { text: ocrText } } = await worker.recognize(result.path)
              ocrTexts.push(ocrText.trim())
            } finally {
              await fs.unlink(result.path).catch(() => {})
            }
          }
        }
      } finally {
        await worker.terminate()
      }

      const combinedText = ocrTexts.join("\n\n").trim()
      if (!combinedText) {
        return {
          text: "",
          warnings: ["PDF escaneado: OCR no encontro texto. Verifica que el documento sea legible."],
        }
      }
      return {
        text: combinedText,
        warnings: [`Texto extraido por OCR (${pageCount} paginas). Puede contener errores de reconocimiento.`],
      }
    } catch {
      return {
        text: "",
        warnings: ["No se pudo procesar el PDF. El archivo puede estar corrupto o protegido."],
      }
    }
  }

  if (lower.endsWith(".doc")) {
    try {
      // antiword extrae texto plano de archivos .doc (Word 97-2003)
      const { stdout } = await execFileAsync("antiword", ["-m", "UTF-8.txt", filePath], {
        maxBuffer: 10 * 1024 * 1024,
      })
      const text = stdout.trim()
      if (!text) {
        return {
          text: "",
          warnings: ["El archivo .doc no contiene texto extraíble o está protegido."],
        }
      }
      return { text, warnings: [] }
    } catch {
      return {
        text: "",
        warnings: [
          "No se pudo extraer texto del archivo .doc. " +
          "El archivo original está disponible para descarga.",
        ],
      }
    }
  }

  return { text: "", warnings: ["Formato no reconocido para extracción de texto."] }
}
