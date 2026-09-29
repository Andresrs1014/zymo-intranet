/**
 * Sube el mapa de Administrativo a la intranet.
 * Por defecto solo imprime el plan. Con --subir pega contra la API.
 *
 *   SIG_BASE_URL=https://zymointranet.com/sig-api SIG_TOKEN=... \
 *     npx ts-node scripts/subir-administrativo.ts --dir "<Administrativo>" --subir
 *
 * Requiere el mismo --dir que el grafo (o --mapa grafo-sig/mapa.json más --dir
 * para los binarios). No sube otras áreas. Las citas ausentes y de otra área
 * se guardan sin destinoId.
 */
import fs from "fs/promises"
import path from "path"
import { spawnSync } from "child_process"

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

interface Archivo {
  codigo: string
  tipo: "procedimiento" | "instructivo" | "protocolo" | "formato"
  titulo: string
  ruta: string
}
interface Cita {
  origenCodigo: string
  destinoTipo: string
  destinoCodigo: string
  estado: "resuelta" | "ausente" | "otra_area" | "otro_codigo"
  frase: string
  nota: string | null
}
interface Hogar {
  codigo: string
  procedimientoCodigo: string | null
  instructivoCodigo: string | null
  nota: string | null
}

async function main() {
  const dir = flag("--dir")
  if (!dir) {
    console.error("Falta --dir con la carpeta Administrativo.")
    process.exitCode = 1
    return
  }
  const mapaPath = flag("--mapa")
  const mapa = mapaPath ? JSON.parse(await fs.readFile(mapaPath, "utf8")) : await construir(dir)
  const archivos: Archivo[] = mapa.archivos
  const citas: Cita[] = mapa.citas
  const hogares: Hogar[] = mapa.hogares
  console.log(`Plan: ${archivos.length} archivos, ${citas.length} citas.`)
  for (const h of hogares.filter((h) => h.nota)) console.log(`  ${h.codigo}: ${h.nota}`)
  if (!process.argv.includes("--subir")) {
    console.log("Dry-run. Agrega --subir con SIG_BASE_URL y SIG_TOKEN para cargar.")
    return
  }
  const base = (process.env.SIG_BASE_URL ?? "").replace(/\/$/, "")
  const token = process.env.SIG_TOKEN ?? ""
  if (!base || !token) {
    console.error("Faltan SIG_BASE_URL y SIG_TOKEN.")
    process.exitCode = 1
    return
  }
  await subir(base, token, archivos, citas, hogares)
}

async function construir(dir: string) {
  const out = path.join(process.cwd(), ".grafo-admin-tmp")
  const run = spawnSync("npx", ["ts-node", "scripts/grafo-administrativo.ts", "--dir", dir, "--out", out], {
    stdio: "inherit",
    cwd: process.cwd(),
  })
  if (run.status !== 0) throw new Error("El extractor falló")
  return JSON.parse(await fs.readFile(path.join(out, "mapa.json"), "utf8"))
}

async function subir(
  base: string,
  token: string,
  archivos: Archivo[],
  citas: Cita[],
  hogares: Hogar[],
) {
  const areaId = await asegurarArea(base, token)
  const ids = new Map<string, { tipo: Archivo["tipo"]; id: number; procedimientoId: number }>()

  for (const prc of archivos.filter((a) => a.tipo === "procedimiento")) {
    const id = await asegurarProcedimiento(base, token, areaId, prc)
    ids.set(prc.codigo, { tipo: "procedimiento", id, procedimientoId: id })
    await asegurarCommit(base, token, id, prc)
  }
  for (const tipo of ["instructivo", "protocolo", "formato"] as const) {
    for (const doc of archivos.filter((a) => a.tipo === tipo)) {
      const hogar = hogares.find((h) => h.codigo === doc.codigo)
      const procCodigo = hogar?.procedimientoCodigo
      const proc = procCodigo ? ids.get(procCodigo) : undefined
      if (!proc) {
        console.warn(`Sin casa, no se sube ${doc.codigo}`)
        continue
      }
      const id = await asegurarSoporte(base, token, doc, proc.id, hogares, ids)
      ids.set(doc.codigo, { tipo: doc.tipo, id, procedimientoId: proc.id })
    }
  }
  for (const cita of citas) {
    const origen = ids.get(cita.origenCodigo)
    if (!origen) continue
    const destino = ids.get(cita.destinoCodigo)
    await api(base, token, "POST", "/api/referencias", {
      procedimientoId: origen.procedimientoId,
      origenTipo: origen.tipo,
      origenId: origen.id,
      destinoTipo: cita.destinoTipo,
      destinoCodigo: cita.destinoCodigo,
      destinoId: cita.estado === "resuelta" ? destino?.id ?? null : null,
      estado: cita.estado === "resuelta" && !destino ? "ausente" : cita.estado,
      nota: cita.nota,
      frase: cita.frase?.slice(0, 500) ?? null,
    })
  }
  console.log("Subida lista.")
}

async function asegurarArea(base: string, token: string): Promise<number> {
  const areas = await api<Array<{ id: number; nombre: string }>>(base, token, "GET", "/api/areas")
  const ya = areas.find((a) => a.nombre.toLowerCase() === "administrativo")
  if (ya) return ya.id
  const creada = await api<{ id: number }>(base, token, "POST", "/api/areas", {
    nombre: "Administrativo",
    descripcion: "Gestión administrativa. Mapa cargado desde procedimientos_nuevos.",
    color: "#0f766e",
  })
  return creada.id
}

async function asegurarProcedimiento(base: string, token: string, areaId: number, doc: Archivo): Promise<number> {
  const lista = await api<Array<{ id: number; codigo: string }>>(base, token, "GET", "/api/procedimientos")
  const ya = lista.find((p) => p.codigo.toUpperCase() === doc.codigo)
  if (ya) return ya.id
  const creado = await api<{ id: number }>(base, token, "POST", "/api/procedimientos", {
    areaId,
    codigo: doc.codigo,
    titulo: doc.titulo.slice(0, 255) || doc.codigo,
  })
  return creado.id
}

async function asegurarCommit(base: string, token: string, procedimientoId: number, doc: Archivo) {
  const proc = await api<{ commits: unknown[] }>(base, token, "GET", `/api/procedimientos/${procedimientoId}`)
  if (proc.commits.length > 0) return
  await subirArchivo(base, token, "/api/commits/upload", doc.ruta, {
    procedimientoId: String(procedimientoId),
    mensaje: "Carga inicial desde procedimientos_nuevos/Administrativo",
  })
}

async function asegurarSoporte(
  base: string,
  token: string,
  doc: Archivo,
  procedimientoId: number,
  hogares: Hogar[],
  ids: Map<string, { id: number }>,
): Promise<number> {
  if (doc.tipo === "formato") {
    const lista = await api<Array<{ id: number; nombreArchivo: string }>>(base, token, "GET", `/api/formatos?procedimientoId=${procedimientoId}`)
    const nombre = path.basename(doc.ruta)
    const ya = lista.find((f) => f.nombreArchivo === nombre)
    if (ya) return ya.id
    const hogar = hogares.find((h) => h.codigo === doc.codigo)
    const inst = hogar?.instructivoCodigo ? ids.get(hogar.instructivoCodigo) : undefined
    const fields: Record<string, string> = {
      procedimientoId: String(procedimientoId),
      nombre: doc.titulo.slice(0, 255) || doc.codigo,
    }
    if (inst) fields.instructivoId = String(inst.id)
    const created = await subirArchivo(base, token, "/api/formatos/upload", doc.ruta, fields)
    return created.id as number
  }
  const recurso = doc.tipo === "protocolo" ? "protocolos" : "instructivos"
  const lista = await api<Array<{ id: number; codigo: string }>>(base, token, "GET", `/api/${recurso}?procedimientoId=${procedimientoId}`)
  const ya = lista.find((r) => r.codigo.toUpperCase() === doc.codigo)
  if (ya) return ya.id
  const created = await subirArchivo(base, token, `/api/${recurso}/upload`, doc.ruta, {
    procedimientoId: String(procedimientoId),
    codigo: doc.codigo,
    titulo: doc.titulo.slice(0, 255) || doc.codigo,
  })
  const row = (created.created ?? created) as { id: number }
  return row.id
}

async function subirArchivo(base: string, token: string, rutaApi: string, archivo: string, fields: Record<string, string>) {
  const buf = await fs.readFile(archivo)
  const fd = new FormData()
  fd.append("file", new Blob([buf]), path.basename(archivo))
  for (const [k, v] of Object.entries(fields)) fd.append(k, v)
  const res = await fetch(`${base}${rutaApi}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  })
  if (!res.ok) throw new Error(`${rutaApi} ${res.status}: ${await res.text()}`)
  return res.json() as Promise<Record<string, unknown>>
}

async function api<T>(base: string, token: string, method: string, ruta: string, body?: unknown): Promise<T> {
  const res = await fetch(`${base}${ruta}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`${method} ${ruta} ${res.status}: ${await res.text()}`)
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
