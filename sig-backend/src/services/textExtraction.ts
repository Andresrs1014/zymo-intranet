import mammoth from "mammoth"
import { PDFParse } from "pdf-parse"
import fs from "fs/promises"
import fsSync from "fs"
import os from "os"
import path from "path"
import { execFile } from "child_process"
import { promisify } from "util"

const execFileAsync = promisify(execFile)

// Imágenes embebidas en el .docx (flujogramas, tablas escaneadas) se guardan
// aquí en vez de inlinearse como base64 en el texto extraído -- un solo
// flujograma pesaba ~2M caracteres embebido, reventando cualquier consumidor
// de texto (incluido el MCP). Ver convertImage más abajo.
const FLUJOGRAMA_DIR = path.join(process.cwd(), "uploads", "sig", "flujogramas")
fsSync.mkdirSync(FLUJOGRAMA_DIR, { recursive: true })

export interface ExtractionResult {
  text: string
  warnings: string[]
  flujogramaImagenUrl?: string
}

interface MammothResult {
  value: string
  messages: Array<{ type: string; message: string }>
}

interface MammothImageElement {
  contentType: string
  readAsBuffer: () => Promise<Buffer>
}

export async function extractText(filePath: string, fileName: string): Promise<ExtractionResult> {
  const lower = fileName.toLowerCase()

  if (lower.endsWith(".md") || lower.endsWith(".markdown") || lower.endsWith(".txt")) {
    const text = await fs.readFile(filePath, "utf-8")
    return { text: text.trim(), warnings: [] }
  }

  if (lower.endsWith(".docx")) {
    const buffer = await fs.readFile(filePath)

    const images: Array<{ index: number; buffer: Buffer; ext: string }> = []
    let imageCounter = 0

    const result: MammothResult = await (mammoth as unknown as {
      convertToMarkdown: (
        input: { buffer: Buffer },
        options?: { styleMap?: string[]; convertImage?: unknown },
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
        // No inlinear imágenes como base64 -- se guardan aparte y se referencian
        // con un marcador liviano que se resuelve después de convertToMarkdown.
        convertImage: mammoth.images.imgElement(async (element: MammothImageElement) => {
          imageCounter += 1
          const index = imageCounter
          const ext = (element.contentType.split("/")[1] || "png").replace("jpeg", "jpg")
          const imgBuffer = await element.readAsBuffer()
          images.push({ index, buffer: imgBuffer, ext })
          return { src: `sig-image:${index}` }
        }),
      },
    )
    const warnings = result.messages
      .filter((m) => m.type === "warning")
      .map((m) => m.message)

    // El flujograma es la imagen que aparece justo después de la palabra
    // "FLUJOGRAMA" en el documento -- patrón confirmado en los 12 procedimientos
    // SIG reales (bullet en negrita, no un heading real de Word).
    let flujogramaImagenUrl: string | undefined
    const flujogramaMatch = result.value.match(/FLUJOGRAMA[\s\S]{0,300}?sig-image:(\d+)/i)
    if (flujogramaMatch) {
      const img = images.find((i) => i.index === parseInt(flujogramaMatch[1], 10))
      if (img) {
        const filename = `flujo_${Date.now()}_${img.index}.${img.ext}`
        await fs.writeFile(path.join(FLUJOGRAMA_DIR, filename), img.buffer)
        flujogramaImagenUrl = filename
      }
    }

    // Cualquier otra imagen (ej. tablas escaneadas) no se persiste todavía --
    // ponytail: solo se necesita el flujograma hoy, se omite el resto del
    // texto para no volver a embeber base64. Ampliar a una galería genérica
    // si en el futuro se necesita ver esas imágenes desde la intranet.
    const text = result.value
      .replace(/!\[[^\]]*\]\(sig-image:\d+\)/g, "[Imagen omitida]")
      .trim()

    return { text, warnings, flujogramaImagenUrl }
  }

  if (lower.endsWith(".pdf")) {
    const buffer = await fs.readFile(filePath)
    // pdf-parse v2 expone una clase (PDFParse), no la función callable de v1 --
    // el parser debe destruirse explicitamente, no lo recolecta el GC solo.
    const parser = new PDFParse({ data: buffer })
    try {
      const data = await parser.getText()
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

      const pageCount = data.total || 1
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
    } finally {
      await parser.destroy()
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
