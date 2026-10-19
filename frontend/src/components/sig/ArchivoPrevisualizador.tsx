import { useEffect, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Download, FileQuestion, Loader } from "lucide-react"
import { sigApi } from "@/lib/sigApi"
import { DocxViewer } from "@/components/sig/SigFileViewer"

/**
 * Vista previa desplegable de CUALQUIER archivo del SIG. `base` es la ruta del recurso (p. ej. «/api/formatos/12»);
 * se pide `${base}/archivo` y, para Office, `${base}/archivo/pdf` (el servidor lo convierte con LibreOffice).
 *  - PDF, imágenes, audio y video: visor nativo del navegador.
 *  - Texto, JSON, XML, registros, Markdown: texto (el Markdown se renderiza).
 *  - Excel, CSV, ODS: tabla. Word, PowerPoint, OpenDocument, RTF: PDF; si la conversión falla, Word y Excel caen al visor del navegador.
 *  - Lo demás (zip, ejecutables…): ficha con el dato del archivo y descarga, sin inventar una vista.
 * No carga nada hasta que se monta, así que quien la use la monta solo al desplegar.
 */

type Hoja = { nombre: string; filas: string[][] }
type Vista =
  | { t: "cargando" }
  | { t: "url"; url: string; tipo: "pdf" | "imagen" | "audio" | "video" }
  | { t: "texto"; texto: string; md: boolean; truncado: boolean }
  | { t: "tabla"; hojas: Hoja[] }
  | { t: "docx"; data: ArrayBuffer }
  | { t: "otro"; motivo: string }

const EXT = {
  imagen: ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "avif", "ico"],
  audio: ["mp3", "wav", "ogg", "m4a", "aac", "flac"],
  video: ["mp4", "webm", "mov", "m4v", "ogv"],
  texto: ["txt", "log", "json", "xml", "yml", "yaml", "ini", "cfg", "conf", "html", "htm", "css", "js", "ts", "sql", "py", "sh", "bat", "tex", "rst"],
  markdown: ["md", "markdown"],
  tabla: ["csv", "tsv"],
  excel: ["xlsx", "xls", "xlsm", "ods"],
  office: ["doc", "docx", "ppt", "pptx", "odt", "odp", "rtf"],
}
const MAX_BINARIO = 60 * 1024 * 1024 // más que esto no se baja entero al navegador para verlo
const MAX_TEXTO = 300_000
const MAX_FILAS = 500
const MAX_COLS = 40

const extension = (nombre: string) => (nombre.split(".").pop() ?? "").toLowerCase()
const mb = (b: number) => `${(b / 1024 / 1024).toFixed(1)} MB`

async function leerTabla(buf: ArrayBuffer): Promise<Hoja[]> {
  const XLSX = await import("xlsx")
  const libro = XLSX.read(buf, { type: "array" })
  return libro.SheetNames.slice(0, 12).map((n) => ({
    nombre: n,
    filas: (XLSX.utils.sheet_to_json<string[]>(libro.Sheets[n]!, { header: 1, raw: false, defval: "" }) as string[][])
      .slice(0, MAX_FILAS).map((f) => f.slice(0, MAX_COLS).map(String)),
  }))
}

export function ArchivoPrevisualizador({ base, nombre, mime, tamano, altura = "70vh" }: {
  base: string
  nombre: string
  mime?: string | null
  tamano?: number | null
  /** Alto del recuadro (CSS). */
  altura?: string
}) {
  const [vista, setVista] = useState<Vista>({ t: "cargando" })
  const ext = extension(nombre)

  useEffect(() => {
    let cancelado = false
    let url: string | null = null
    const pedir = async (ruta: string) => (await sigApi.get<Blob>(`${base}/${ruta}`, { responseType: "blob" })).data
    const poner = (v: Vista) => { if (!cancelado) setVista(v) }
    const blobUrl = (b: Blob, tipo?: string) => { url = URL.createObjectURL(tipo ? new Blob([b], { type: tipo }) : b); return url }
    const grande = tamano != null && tamano > MAX_BINARIO

    ;(async () => {
      try {
        if (ext === "pdf") {
          if (grande) return poner({ t: "otro", motivo: `Pesa ${mb(tamano!)}: es demasiado para verlo aquí. Descárgalo.` })
          return poner({ t: "url", tipo: "pdf", url: blobUrl(await pedir("archivo"), "application/pdf") })
        }
        if (EXT.imagen.includes(ext) || EXT.audio.includes(ext) || EXT.video.includes(ext)) {
          if (grande) return poner({ t: "otro", motivo: `Pesa ${mb(tamano!)}: es demasiado para verlo aquí. Descárgalo.` })
          const tipo = EXT.imagen.includes(ext) ? "imagen" : EXT.audio.includes(ext) ? "audio" : "video"
          const b = await pedir("archivo")
          return poner({ t: "url", tipo, url: blobUrl(!b.type && mime ? new Blob([b], { type: mime }) : b) })
        }
        if (EXT.markdown.includes(ext) || EXT.texto.includes(ext)) {
          const t = await (await pedir("archivo")).text()
          return poner({ t: "texto", md: EXT.markdown.includes(ext), texto: t.slice(0, MAX_TEXTO), truncado: t.length > MAX_TEXTO })
        }
        if (EXT.tabla.includes(ext)) return poner({ t: "tabla", hojas: await leerTabla(await (await pedir("archivo")).arrayBuffer()) })
        if (EXT.excel.includes(ext) || EXT.office.includes(ext)) {
          try {
            return poner({ t: "url", tipo: "pdf", url: blobUrl(await pedir("archivo/pdf"), "application/pdf") })
          } catch {
            // El servidor no pudo convertirlo: Excel y Word se pueden mostrar en el navegador
            if (EXT.excel.includes(ext)) return poner({ t: "tabla", hojas: await leerTabla(await (await pedir("archivo")).arrayBuffer()) })
            if (ext === "docx") return poner({ t: "docx", data: await (await pedir("archivo")).arrayBuffer() })
            return poner({ t: "otro", motivo: "No se pudo generar la vista previa de este documento. Descárgalo para abrirlo." })
          }
        }
        poner({ t: "otro", motivo: "Este tipo de archivo no tiene vista previa en el navegador." })
      } catch {
        poner({ t: "otro", motivo: "No se pudo cargar el archivo." })
      }
    })()

    return () => { cancelado = true; if (url) URL.revokeObjectURL(url) }
  }, [base, ext, mime, tamano])

  async function descargar() {
    const b = (await sigApi.get<Blob>(`${base}/archivo`, { responseType: "blob" })).data
    const a = document.createElement("a")
    a.href = URL.createObjectURL(b)
    a.download = nombre
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  const marco = "overflow-hidden rounded-lg border border-zinc-300 bg-zinc-100"

  if (vista.t === "cargando") {
    return (
      <div className={`${marco} flex items-center justify-center gap-2 py-10 text-zinc-600`} role="status">
        <Loader className="h-3.5 w-3.5 animate-spin" aria-hidden />
        <span className="text-xs font-mono">Preparando vista previa…</span>
      </div>
    )
  }
  if (vista.t === "otro") {
    return (
      <div className={`${marco} flex flex-col items-center gap-2 px-4 py-8 text-center`}>
        <FileQuestion className="h-6 w-6 text-zinc-500" aria-hidden />
        <p className="text-xs font-mono text-zinc-700">{nombre}</p>
        <p className="max-w-sm text-xs text-zinc-600" role="alert">{vista.motivo}</p>
        <button type="button" onClick={() => void descargar()} className="mt-1 inline-flex items-center gap-1.5 rounded border border-zinc-300 bg-white px-3 py-1 text-xs font-mono text-zinc-700 hover:border-helix-accent/40 hover:text-helix-accent-ink">
          <Download className="h-3 w-3" aria-hidden /> Descargar
        </button>
      </div>
    )
  }
  if (vista.t === "url") {
    return (
      <div className={`${marco} flex items-center justify-center bg-zinc-200`} style={{ height: altura }}>
        {vista.tipo === "pdf" && <iframe src={`${vista.url}#view=FitH`} title={nombre} className="h-full w-full border-0 bg-zinc-200" />}
        {vista.tipo === "imagen" && <img src={vista.url} alt={nombre} className="max-h-full max-w-full object-contain" />}
        {vista.tipo === "audio" && <audio src={vista.url} controls className="w-full max-w-md px-4" />}
        {vista.tipo === "video" && <video src={vista.url} controls className="max-h-full max-w-full" />}
      </div>
    )
  }
  if (vista.t === "docx") {
    return (
      <div className={marco} style={{ height: altura }}>
        <DocxViewer data={vista.data} onError={() => setVista({ t: "otro", motivo: "No se pudo mostrar el documento Word. Descárgalo para abrirlo." })} />
      </div>
    )
  }
  if (vista.t === "texto") {
    return (
      <div className={`${marco} overflow-auto bg-white p-4`} style={{ maxHeight: altura }}>
        {vista.md
          ? <div className="prose prose-sm max-w-none text-zinc-800"><ReactMarkdown remarkPlugins={[remarkGfm]}>{vista.texto}</ReactMarkdown></div>
          : <pre className="whitespace-pre-wrap break-words text-xs font-mono text-zinc-800">{vista.texto}</pre>}
        {vista.truncado && <p className="mt-3 text-xs font-mono text-zinc-500">Se muestra el comienzo del archivo; descárgalo para verlo completo.</p>}
      </div>
    )
  }
  return <TablaHojas hojas={vista.hojas} altura={altura} marco={marco} />
}

function TablaHojas({ hojas, altura, marco }: { hojas: Hoja[]; altura: string; marco: string }) {
  const [activa, setActiva] = useState(0)
  const h = hojas[activa] ?? hojas[0]
  if (!h) return <div className={`${marco} px-4 py-8 text-center text-xs text-zinc-600`}>El archivo está vacío.</div>
  return (
    <div className={`${marco} flex flex-col bg-white`} style={{ maxHeight: altura }}>
      {hojas.length > 1 && (
        <div role="tablist" aria-label="Hojas" className="flex shrink-0 gap-1 overflow-x-auto border-b border-zinc-300 bg-zinc-100 px-2 pt-1.5">
          {hojas.map((x, i) => (
            <button key={x.nombre} type="button" role="tab" aria-selected={i === activa} onClick={() => setActiva(i)}
              className={`whitespace-nowrap rounded-t px-3 py-1 text-xs font-mono ${i === activa ? "bg-white font-semibold text-zinc-800" : "text-zinc-600 hover:text-zinc-800"}`}>
              {x.nombre}
            </button>
          ))}
        </div>
      )}
      <div className="overflow-auto">
        <table className="min-w-full border-collapse text-xs">
          <tbody>
            {h.filas.map((fila, i) => (
              <tr key={i} className={i === 0 ? "sticky top-0 bg-zinc-100 font-semibold" : i % 2 ? "bg-zinc-50" : ""}>
                {fila.map((c, j) => <td key={j} className="max-w-[260px] truncate border border-zinc-200 px-2 py-1 text-zinc-800" title={c}>{c}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {h.filas.length >= MAX_FILAS && <p className="shrink-0 border-t border-zinc-200 px-3 py-1.5 text-xs font-mono text-zinc-500">Se muestran las primeras {MAX_FILAS} filas; descarga el archivo para ver todo.</p>}
    </div>
  )
}
