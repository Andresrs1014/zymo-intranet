/**
 * Lee Administrativo y escribe el grafo de Obsidian (wikilinks).
 *
 *   npx ts-node scripts/grafo-administrativo.ts --dir "<carpeta Administrativo>" --out "<vault>/grafo-sig"
 *   npx ts-node scripts/grafo-administrativo.ts --inventario --out ../docs/grafo-sig
 *
 * --inventario escribe solo los códigos vistos en la carpeta, sin aristas,
 * más el INS-009 reportado como citado y ausente. No abre otras áreas.
 */
import fs from "fs/promises"
import path from "path"
import mammoth from "mammoth"
import {
  asignarHogares,
  clasificarTexto,
  codigoDesdeTexto,
  tituloDesdeNombre,
  type ArchivoSig,
  type CitaExtraida,
} from "../src/services/citasSig"
import { renderGrafo } from "../src/services/grafoNotas"

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

async function main() {
  const out = path.resolve(flag("--out") ?? "grafo-sig")
  if (process.argv.includes("--inventario")) {
    await escribir(out, inventarioConocido(), [], [])
    await notaIns009(out)
    console.log(`Inventario escrito en ${out}. Sin texto de los Word: no hay aristas de cita.`)
    return
  }

  const dir = flag("--dir")
  if (!dir) {
    console.error("Falta --dir (carpeta Administrativo) o --inventario.")
    process.exitCode = 1
    return
  }
  const archivos = await leerCarpeta(dir)
  const textos = new Map<string, string>()
  for (const a of archivos) textos.set(a.codigo, await textoDe(a.ruta))

  const citas: CitaExtraida[] = []
  for (const a of archivos) citas.push(...clasificarTexto(a.codigo, textos.get(a.codigo) ?? "", archivos))
  const hogares = asignarHogares(archivos, citas)
  await escribir(out, archivos, citas, hogares)
  await fs.writeFile(path.join(out, "mapa.json"), JSON.stringify({ archivos, citas, hogares }, null, 2))
  console.log(`${archivos.length} documentos, ${citas.length} citas → ${out}`)
}

async function escribir(
  out: string,
  archivos: ArchivoSig[],
  citas: CitaExtraida[],
  hogares: ReturnType<typeof asignarHogares>,
) {
  for (const nota of renderGrafo(archivos, citas, hogares)) {
    const dest = path.join(out, nota.ruta)
    await fs.mkdir(path.dirname(dest), { recursive: true })
    await fs.writeFile(dest, nota.cuerpo)
  }
}

async function leerCarpeta(dir: string): Promise<ArchivoSig[]> {
  const rutas = await walk(dir)
  const archivos: ArchivoSig[] = []
  for (const ruta of rutas) {
    const parsed = codigoDesdeTexto(path.basename(ruta))
    if (!parsed) {
      console.warn(`Sin código, se deja fuera: ${ruta}`)
      continue
    }
    archivos.push({
      codigo: parsed.codigo,
      tipo: parsed.tipo,
      titulo: tituloDesdeNombre(path.basename(ruta)),
      ruta,
    })
  }
  return archivos.sort((a, b) => a.codigo.localeCompare(b.codigo))
}

async function walk(dir: string): Promise<string[]> {
  const out: string[] = []
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...await walk(full))
    else out.push(full)
  }
  return out
}

async function textoDe(ruta: string): Promise<string> {
  const ext = path.extname(ruta).toLowerCase()
  if (ext === ".docx") {
    const result = await mammoth.extractRawText({ path: ruta })
    return result.value
  }
  if (ext === ".md" || ext === ".txt") return fs.readFile(ruta, "utf8")
  console.warn(`Sin texto extraíble (${ext}), solo entra al catálogo: ${path.basename(ruta)}`)
  return ""
}

function inventarioConocido(): ArchivoSig[] {
  const items: ArchivoSig[] = []
  const push = (prefijo: string, n: number, tipo: ArchivoSig["tipo"]) => {
    const codigo = `${prefijo}-${String(n).padStart(3, "0")}-GAD`
    items.push({ codigo, tipo, titulo: codigo, ruta: `${codigo} (nombre completo en la carpeta)` })
  }
  for (let n = 1; n <= 7; n++) push("PRC", n, "procedimiento")
  for (let n = 1; n <= 6; n++) push("INS", n, "instructivo")
  push("PRT", 1, "protocolo")
  for (let n = 1; n <= 24; n++) push("FR", n, "formato")
  return items
}

async function notaIns009(out: string) {
  const cuerpo = [
    "---",
    "tipo: ausente",
    "codigo: INS-009",
    "estado: ausente",
    "tags: [sig, referencia-ausente]",
    "---",
    "",
    "# INS-009",
    "",
    "Quien opera la carpeta reportó que el instructivo de compras se nombra en el archivo y no existe. Cree que el código es INS-009. En Administrativo solo están INS-001 a INS-006. No se creó un Word para llenarlo.",
    "",
    "La frase exacta y el procedimiento que lo cita salen al leer el Word. Hasta entonces este nodo no se enlaza a un PRC inventado.",
    "",
    "[[Grafo SIG]]",
    "",
  ].join("\n")
  const dest = path.join(out, "ausentes", "INS-009.md")
  await fs.mkdir(path.dirname(dest), { recursive: true })
  await fs.writeFile(dest, cuerpo)
  const indice = path.join(out, "Grafo SIG.md")
  const prev = await fs.readFile(indice, "utf8")
  if (!prev.includes("[[INS-009]]")) {
    await fs.appendFile(indice, "\n## Reportado sin archivo\n\n- [[INS-009]] — instructivo de compras, frase pendiente de leer en el Word.\n")
  }
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
