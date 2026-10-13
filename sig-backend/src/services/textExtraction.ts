import mammoth from "mammoth"
import { PDFParse } from "pdf-parse"
import TurndownService from "turndown"
import fs from "fs/promises"
import fsSync from "fs"
import os from "os"
import path from "path"
import { execFile } from "child_process"
import { promisify } from "util"
import { createHash, randomUUID } from "crypto"

const execFileAsync = promisify(execFile)

// Imágenes embebidas en el .docx (flujogramas, tablas escaneadas) se guardan
// aquí en vez de inlinearse como base64 en el texto extraído -- un solo
// flujograma pesaba ~2M caracteres embebido, reventando cualquier consumidor
// de texto (incluido el MCP). Ver convertImage más abajo.
const FLUJOGRAMA_DIR = path.join(process.cwd(), "uploads", "sig", "flujogramas")
fsSync.mkdirSync(FLUJOGRAMA_DIR, { recursive: true })

// OCR: tope de páginas y umbral de "texto digital escaso" (PDF escaneado o mixto).
const OCR_MAX_PAGES = Number(process.env.SIG_OCR_MAX_PAGES ?? 50)
const PDF_SPARSE_CHARS_PER_PAGE = 200

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

// Encabezados: nombres de estilo de Word en inglés (plantilla EN), español
// (Word ES: "Título N", "Párrafo de lista") y variantes en mayúscula que usan
// varias plantillas del SIG. Sin esto, un doc autoría Word-ES pierde toda su
// jerarquía de secciones al aplanarse a párrafos.
const HEADING_STYLE_MAP: string[] = [
  "p[style-name='Heading 1'] => h1:fresh",
  "p[style-name='Heading 2'] => h2:fresh",
  "p[style-name='Heading 3'] => h3:fresh",
  "p[style-name='Heading 4'] => h4:fresh",
  "p[style-name='Heading 5'] => h5:fresh",
  "p[style-name='Heading 6'] => h6:fresh",
  "p[style-name='Title'] => h1:fresh",
  "p[style-name='Subtitle'] => h2:fresh",
  "p[style-name='Título 1'] => h1:fresh",
  "p[style-name='Título 2'] => h2:fresh",
  "p[style-name='Título 3'] => h3:fresh",
  "p[style-name='Título 4'] => h4:fresh",
  "p[style-name='Título 5'] => h5:fresh",
  "p[style-name='Título 6'] => h6:fresh",
  "p[style-name='Titulo 1'] => h1:fresh",
  "p[style-name='Titulo 2'] => h2:fresh",
  "p[style-name='Titulo 3'] => h3:fresh",
  "p[style-name='TÍTULO 1'] => h1:fresh",
  "p[style-name='TÍTULO 2'] => h2:fresh",
  "p[style-name='TÍTULO 3'] => h3:fresh",
  "p[style-name='Título'] => h1:fresh",
  "p[style-name='Subtítulo'] => h2:fresh",
  "p[style-name='List Paragraph'] => li:fresh",
  "p[style-name='Párrafo de lista'] => li:fresh",
  "p[style-name='Parrafo de lista'] => li:fresh",
]

// @joplin/turndown-plugin-gfm no publica tipos; require + cast evita depender de
// un .d.ts ambiente (que ts-node no carga al correr un script fuera de src/).
const { gfm } = require("@joplin/turndown-plugin-gfm") as { gfm: TurndownService.Plugin }

const turndown = new TurndownService({
  headingStyle: "atx",
  hr: "---",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
  emDelimiter: "*",
  strongDelimiter: "**",
})
turndown.use(gfm) // tablas GFM, tachado, listas de tareas

// mammoth emite <table> sin <thead> ni <th>. Sin esto, turndown/GFM genera una
// fila de encabezado vacía y empuja el encabezado real al cuerpo. Se promueve
// la primera fila a <thead>/<th>. Tablas anidadas se dejan intactas.
export function promoteTableHeaders(html: string): string {
  return html.replace(/<table>([\s\S]*?)<\/table>/gi, (full: string, inner: string) => {
    if (/<thead[\s>]/i.test(full) || /<table[\s>]/i.test(inner)) return full
    const firstRow = inner.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/i)
    if (!firstRow) return full
    const headRow = firstRow[0]
      .replace(/<td(\s[^>]*)?>/gi, "<th$1>")
      .replace(/<\/td>/gi, "</th>")
    const rest = inner.slice(inner.indexOf(firstRow[0]) + firstRow[0].length)
    return `<table><thead>${headRow}</thead><tbody>${rest}</tbody></table>`
  })
}

export function cleanupMarkdown(md: string): string {
  return md
    .replace(/(\d)\\([.)])/g, "$1$2") // 5\. -> 5.   1\) -> 1)
    .replace(/^\\([#>-])/gm, "$1") // \#  \>  \-  al inicio de línea
    .replace(/^(\d+)\.\s{2,}/gm, "$1. ") // "1.  paso" -> "1. paso"
    .replace(/\[Imagen del documento[^\]]*\]/g, "[Imagen del documento — no incluida en el texto]")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

export async function extractText(filePath: string, fileName: string): Promise<ExtractionResult> {
  const lower = fileName.toLowerCase()

  if (lower.endsWith(".md") || lower.endsWith(".markdown") || lower.endsWith(".txt")) {
    let raw = await fs.readFile(filePath)
    if (raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf) raw = raw.subarray(3) // BOM UTF-8
    let text = raw.toString("utf-8")
    const warnings: string[] = []
    if (text.includes("�")) {
      // El archivo no era UTF-8 válido (típico .txt de Windows en CP-1252).
      text = raw.toString("latin1")
      warnings.push("El archivo no estaba en UTF-8; se decodificó como Latin-1. Revisar acentos y símbolos.")
    }
    return { text: text.trim(), warnings }
  }

  if (lower.endsWith(".docx")) {
    return extractDocx(filePath)
  }

  if (lower.endsWith(".doc")) {
    // 1) LibreOffice headless: convierte .doc -> .docx conservando tablas,
    //    encabezados y listas. antiword (abajo) solo da texto plano.
    const converted = await tryLibreOfficeConvert(filePath, "docx")
    if (converted) {
      try {
        const res = await extractDocx(converted)
        return {
          ...res,
          warnings: [
            ...res.warnings,
            "Archivo .doc convertido a .docx con LibreOffice para la extracción.",
          ],
        }
      } finally {
        await fs.rm(path.dirname(converted), { recursive: true, force: true }).catch(() => {})
      }
    }

    // 2) Fallback: antiword. Texto plano, sin estructura.
    try {
      const { stdout } = await execFileAsync("antiword", ["-m", "UTF-8.txt", filePath], {
        maxBuffer: 10 * 1024 * 1024,
      })
      const text = stdout.trim()
      if (!text) {
        return { text: "", warnings: ["El archivo .doc no contiene texto extraíble o está protegido."] }
      }
      return {
        text,
        warnings: [
          "Extracción de .doc por antiword: texto plano, sin tablas ni encabezados. " +
            "Recomendado resubir el documento en .docx o .pdf para un análisis fiel.",
        ],
      }
    } catch {
      return {
        text: "",
        warnings: [
          "No se pudo extraer texto del archivo .doc (LibreOffice y antiword fallaron). " +
            "El archivo original está disponible para descarga.",
        ],
      }
    }
  }

  if (lower.endsWith(".pdf")) {
    return extractPdf(filePath)
  }

  return { text: "", warnings: ["Formato no reconocido para extracción de texto."] }
}

// ── .docx ────────────────────────────────────────────────────────────────────

/**
 * Índices (sig-image:N) de las imágenes del flujograma. En muchos procedimientos el
 * flujograma viene partido en varias imágenes seguidas (fases) bajo un párrafo
 * "FLUJOGRAMA", con a lo sumo un subtítulo corto entre una y otra; termina en la
 * siguiente sección (dos bloques de texto seguidos o una tabla con texto). Sin título propio, cae al primer
 * `FLUJOGRAMA` seguido de imagen (ya no coincide con "flujogramas" dentro de prosa).
 */
export function flujogramaImageIndices(html: string): number[] {
  const blocks = html.match(/<(p|h[1-6]|table|ul|ol)\b[\s\S]*?<\/\1>|<img\b[^>]*>/g) ?? []
  const imgs = (b: string) => [...b.matchAll(/sig-image:(\d+)/g)].map((m) => Number(m[1]))
  const text = (b: string) => b.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()
  const hi = blocks.findIndex((b) => /^[\d.\s)-]*FLUJOGRAMA\s*:?$/i.test(text(b)))
  if (hi >= 0) {
    const run: number[] = [...imgs(blocks[hi])] // la imagen puede venir en el mismo párrafo del título
    let seguidosDeTexto = 0
    for (const b of blocks.slice(hi + 1)) {
      const ii = imgs(b)
      const esTabla = b.startsWith("<table")
      if (ii.length && (!esTabla || !text(b))) { run.push(...ii); seguidosDeTexto = 0; continue } // tabla con texto = encabezado, no flujograma
      if (esTabla || ++seguidosDeTexto >= 2) break
    }
    if (run.length) return run
  }
  const m = html.match(/\bFLUJOGRAMA\b[\s\S]{0,400}?sig-image:(\d+)/i)
  return m ? [Number(m[1])] : []
}

// Pega las imágenes en vertical con GraphicsMagick (ya está en la imagen Docker por pdf2pic).
// Devuelve el nombre del archivo guardado; si gm falla, guarda solo la primera y avisa.
async function guardarFlujograma(
  imgs: Array<{ buffer: Buffer; ext: string }>,
  warnings: string[],
): Promise<string> {
  const id = randomUUID()
  if (imgs.length > 1) {
    const tmp = imgs.map((im, i) => path.join(FLUJOGRAMA_DIR, `_parte_${id}_${i}.${im.ext}`))
    const out = `flujo_${id}.png`
    try {
      await Promise.all(tmp.map((f, i) => fs.writeFile(f, imgs[i].buffer)))
      await execFileAsync("gm", ["convert", ...tmp, "-background", "white", "-gravity", "center", "-append", path.join(FLUJOGRAMA_DIR, out)], {
        timeout: 60_000,
      })
      return out
    } catch {
      warnings.push(`El flujograma tiene ${imgs.length} imágenes y no se pudieron unir; solo se guardó la primera.`)
    } finally {
      await Promise.all(tmp.map((f) => fs.unlink(f).catch(() => {})))
    }
  }
  const filename = `flujo_${id}.${imgs[0].ext}`
  await fs.writeFile(path.join(FLUJOGRAMA_DIR, filename), imgs[0].buffer)
  return filename
}

async function extractDocx(filePath: string): Promise<ExtractionResult> {
  const buffer = await fs.readFile(filePath)

  const images: Array<{ index: number; buffer: Buffer; ext: string }> = []
  let imageCounter = 0

  const result: MammothResult = await (mammoth as unknown as {
    convertToHtml: (
      input: { buffer: Buffer },
      options?: { styleMap?: string[]; convertImage?: unknown },
    ) => Promise<MammothResult>
  }).convertToHtml(
    { buffer },
    {
      styleMap: HEADING_STYLE_MAP,
      // No inlinear imágenes como base64: se guardan aparte y se referencian
      // con un marcador liviano que se resuelve tras la conversión.
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

  // El flujograma puede ser varias imágenes seguidas; se unen en una sola.
  const flujogramaIdx = new Set(flujogramaImageIndices(result.value))
  const flujoImgs = images.filter((i) => flujogramaIdx.has(i.index))
  const flujogramaImagenUrl = flujoImgs.length ? await guardarFlujograma(flujoImgs, warnings) : undefined

  // HTML -> Markdown con tablas GFM, encabezados y numeración de listas.
  let md = turndown.turndown(promoteTableHeaders(result.value))

  // Reemplaza los marcadores de imagen. La del flujograma se marca explícita;
  // el resto se deja señalado (no se omite en silencio) para que el agente
  // sepa que había una imagen y no la está viendo.
  // El texto de cada imagen se saca por OCR (script, sin gastar contexto del
  // modelo): el agente lee texto y solo mira la imagen si el OCR no sirvió.
  const ocrByIndex = await ocrDocxImages(images, warnings)
  md = md.replace(/!\[[^\]]*\]\(sig-image:(\d+)\)/g, (_m, n: string) => {
    const idx = parseInt(n, 10)
    const ocr = ocrByIndex.get(idx)
    const esFlujo = flujogramaIdx.has(idx)
    const base = esFlujo
      ? "[FLUJOGRAMA — ver imagen original adjunta al procedimiento]"
      : "[Imagen del documento — no incluida en el texto]"
    return ocr ? `${base}\n\n[Texto de la imagen reconocido por OCR; puede tener errores]\n\n${ocr}` : base
  })

  return { text: cleanupMarkdown(md), warnings, flujogramaImagenUrl }
}

// OCR de imágenes embebidas (png/jpg/bmp/gif; emf/wmf/svg no los lee tesseract).
// Apagable con SIG_OCR_IMAGES=false; topes por cantidad y por tamaño mínimo
// (logos/íconos pesan poco y no tienen texto útil).
const OCR_IMG_MAX = Number(process.env.SIG_OCR_MAX_IMAGES ?? 10)
const OCR_IMG_MIN_BYTES = 8 * 1024
const OCR_IMG_EXT = new Set(["png", "jpg", "bmp", "gif"])

async function ocrDocxImages(
  images: Array<{ index: number; buffer: Buffer; ext: string }>,
  warnings: string[],
): Promise<Map<number, string>> {
  const out = new Map<number, string>()
  if (process.env.SIG_OCR_IMAGES === "false") return out
  const todo = images
    .filter((i) => OCR_IMG_EXT.has(i.ext) && i.buffer.length >= OCR_IMG_MIN_BYTES)
    .slice(0, OCR_IMG_MAX)
  if (!todo.length) return out
  try {
    const { createWorker } = await import("tesseract.js")
    const worker = await createWorker("spa+eng")
    try {
      for (const img of todo) {
        const { data: { text } } = await worker.recognize(img.buffer)
        const clean = text.trim()
        if (clean.length >= 20) out.set(img.index, clean)
      }
    } finally {
      await worker.terminate()
    }
  } catch (e) {
    warnings.push(`OCR de imágenes del documento falló: ${e instanceof Error ? e.message : String(e)}`)
  }
  return out
}

// ── .pdf ─────────────────────────────────────────────────────────────────────

/**
 * Páginas [desde, hasta] (base 1) donde vive el flujograma de un PDF: desde la página
 * con el título "FLUJOGRAMA" (línea propia) hasta la de "INDICADORES", inclusive
 * (la imagen puede quedar en cualquiera de las dos). null si no hay título.
 */
export function flujogramaPdfPaginas(textos: string[]): [number, number] | null {
  const desde = textos.findIndex((t) => /^[ \t]*[\d.)\- \t]*FLUJOGRAMA[ \t]*:?[ \t]*$/im.test(t))
  if (desde < 0) return null
  const sig = textos.findIndex((t, i) => i >= desde && /^[ \t]*[\d.)\- \t]*INDICADORES\b/im.test(t))
  return [desde + 1, (sig < 0 ? textos.length - 1 : sig) + 1]
}

// Imágenes grandes (los logos del encabezado miden ~150 px) de esas páginas, sin repetidas
// (un mismo objeto puede reaparecer en la página siguiente), unidas por guardarFlujograma.
async function flujogramaDePdf(
  parser: PDFParse,
  textos: string[],
  warnings: string[],
): Promise<string | undefined> {
  const rango = flujogramaPdfPaginas(textos)
  if (!rango) return undefined
  try {
    const r = await Promise.race([
      parser.getImage({ imageThreshold: 300, imageBuffer: true, imageDataUrl: false }),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("tiempo agotado")), 30_000)),
    ])
    const vistas = new Set<string>()
    const imgs: Array<{ buffer: Buffer; ext: string }> = []
    for (const pg of r.pages) {
      if (pg.pageNumber < rango[0] || pg.pageNumber > rango[1]) continue
      for (const im of pg.images) {
        const buffer = Buffer.from(im.data)
        const hash = createHash("sha1").update(buffer).digest("hex")
        if (vistas.has(hash)) continue
        vistas.add(hash)
        imgs.push({ buffer, ext: buffer[0] === 0xff && buffer[1] === 0xd8 ? "jpg" : "png" })
      }
    }
    return imgs.length ? await guardarFlujograma(imgs, warnings) : undefined
  } catch (e) {
    warnings.push(`No se pudo extraer la imagen del flujograma del PDF: ${e instanceof Error ? e.message : String(e)}`)
    return undefined
  }
}

async function extractPdf(filePath: string): Promise<ExtractionResult> {
  const buffer = await fs.readFile(filePath)
  // pdf-parse v2 expone una clase (PDFParse); debe destruirse explícitamente.
  const parser = new PDFParse({ data: buffer })
  try {
    // Texto con estructura: líneas reales + separador de columna cuando hay un
    // salto horizontal grande (emula celdas de tabla en el flujo de texto).
    const data = await (parser as unknown as {
      getText: (p?: Record<string, unknown>) => Promise<{
        text: string
        total?: number
        pages?: Array<{ num?: number; text?: string }>
      }>
    }).getText({ lineEnforce: true, cellSeparator: " | ", cellThreshold: 7 })

    const digital = (data.text ?? "").trim()
    const pages = data.pages ?? []
    const pageCount = data.total || pages.length || 1
    // "Escaso" = poco texto total, o una fracción alta de páginas casi vacías
    // (PDF mixto: carátula digital + cuerpo escaneado).
    const nearEmptyPages = pages.filter((p) => (p.text ?? "").trim().length < 100).length
    const looksSparse =
      digital.length < pageCount * PDF_SPARSE_CHARS_PER_PAGE ||
      (pages.length > 1 && nearEmptyPages / pages.length >= 0.3)

    // Antes de getTable: getImage se cuelga si corre después de getTable sobre el mismo parser.
    const flujoWarns: string[] = []
    const flujogramaImagenUrl = await flujogramaDePdf(parser, pages.map((p) => p.text ?? ""), flujoWarns)

    // Tablas ruladas detectadas por geometría -> se anexan como tablas GFM.
    let tablesMd = ""
    try {
      const tableData = await (parser as unknown as {
        getTable: (p?: Record<string, unknown>) => Promise<{ pages?: Array<{ num: number; tables: string[][][] }> }>
      }).getTable()
      tablesMd = renderPdfTables(tableData.pages ?? [])
    } catch {
      // sin tablas detectables
    }

    if (digital && !looksSparse) {
      const parts = [digital]
      const warns: string[] = [...flujoWarns]
      if (tablesMd) {
        parts.push("\n\n## Tablas detectadas en el PDF\n\n" + tablesMd)
        warns.push("Tablas del PDF reconstruidas por geometría; verificar contra el original.")
      }
      return { text: parts.join("").trim(), warnings: warns, flujogramaImagenUrl }
    }

    // Texto digital ausente o escaso => PDF escaneado o mixto: OCR.
    const ocr = await ocrPdf(filePath, pageCount)
    const best = ocr.text.length >= digital.length ? ocr.text : digital
    if (!best) {
      return {
        text: "",
        warnings: [
          "PDF sin texto digital y OCR sin resultado. Verifica que el documento sea legible.",
        ],
      }
    }
    const parts = [best]
    if (tablesMd) parts.push("\n\n## Tablas detectadas en el PDF\n\n" + tablesMd)
    return {
      text: parts.join("").trim(),
      warnings: [
        ...ocr.warnings,
        ...flujoWarns,
        ...(tablesMd ? ["Tablas del PDF reconstruidas por geometría; verificar contra el original."] : []),
      ],
      flujogramaImagenUrl,
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

export function renderPdfTables(pages: Array<{ num: number; tables: string[][][] }>): string {
  const blocks: string[] = []
  for (const page of pages) {
    for (const table of page.tables ?? []) {
      if (!table.length) continue
      const cols = Math.max(...table.map((r) => r.length))
      const norm = table.map((r) => {
        const cells = [...r]
        while (cells.length < cols) cells.push("")
        return cells.map((c) => (c ?? "").replace(/\s*\n\s*/g, " ").replace(/\|/g, "\\|").trim())
      })
      const [head, ...body] = norm
      const lines = [
        `| ${head.join(" | ")} |`,
        `| ${head.map(() => "---").join(" | ")} |`,
        ...body.map((r) => `| ${r.join(" | ")} |`),
      ]
      blocks.push(`*(página ${page.num})*\n\n${lines.join("\n")}`)
    }
  }
  return blocks.join("\n\n")
}

async function ocrPdf(filePath: string, pageCount: number): Promise<{ text: string; warnings: string[] }> {
  const { fromPath } = await import("pdf2pic")
  const { createWorker } = await import("tesseract.js")

  const converter = fromPath(filePath, {
    density: 300,
    saveFilename: `ocr_${randomUUID()}`,
    savePath: os.tmpdir(),
    format: "png",
    // Sin width/height forzados: pdf2pic escala desde density y conserva la
    // relación de aspecto del original (antes se recortaban los no-A4).
  })

  const pages = Math.min(pageCount, OCR_MAX_PAGES)
  const worker = await createWorker("spa+eng")
  const ocrTexts: string[] = []
  try {
    for (let i = 1; i <= pages; i++) {
      const page = await converter(i)
      if (!page.path) continue
      try {
        const { data: { text } } = await worker.recognize(page.path)
        ocrTexts.push(text.trim())
      } finally {
        await fs.unlink(page.path).catch(() => {})
      }
    }
  } finally {
    await worker.terminate()
  }

  const text = ocrTexts.join("\n\n").trim()
  const warnings: string[] = []
  if (text) {
    warnings.push(
      `Texto extraído por OCR (${pages}${pageCount > OCR_MAX_PAGES ? ` de ${pageCount}` : ""} páginas). ` +
        "Puede contener errores de reconocimiento y no conserva la estructura de tablas.",
    )
    if (pageCount > OCR_MAX_PAGES) {
      warnings.push(`El PDF tiene ${pageCount} páginas; el OCR procesó solo las primeras ${OCR_MAX_PAGES}.`)
    }
  }
  return { text, warnings }
}

// ── LibreOffice headless ─────────────────────────────────────────────────────

export async function tryLibreOfficeConvert(filePath: string, toExt: "docx" | "pdf"): Promise<string | null> {
  const outDir = path.join(os.tmpdir(), `lo_${randomUUID()}`)
  await fs.mkdir(outDir, { recursive: true })
  try {
    // UserInstallation propio por invocación: dos conversiones concurrentes
    // comparten el lock del perfil de LibreOffice y una falla.
    await execFileAsync(
      "soffice",
      [
        "--headless",
        "--norestore",
        "--nolockcheck",
        `-env:UserInstallation=file://${outDir}`,
        "--convert-to",
        toExt,
        "--outdir",
        outDir,
        filePath,
      ],
      { timeout: 90_000, maxBuffer: 20 * 1024 * 1024 },
    )
    const out = path.join(outDir, `${path.basename(filePath, path.extname(filePath))}.${toExt}`)
    await fs.access(out)
    return out
  } catch {
    await fs.rm(outDir, { recursive: true, force: true }).catch(() => {})
    return null
  }
}
