// Clasifica citas entre procedimientos, instructivos, protocolos y formatos.
// No corrige el texto: una cita a un código que no está en la carpeta queda ausente.

export type TipoDoc = "procedimiento" | "instructivo" | "protocolo" | "formato"
export type EstadoCita = "resuelta" | "ausente" | "otra_area" | "otro_codigo"
export type TipoDestino = TipoDoc | "area"

export interface ArchivoSig {
  codigo: string
  tipo: TipoDoc
  titulo: string
  ruta: string
}

export interface CitaExtraida {
  origenCodigo: string
  destinoTipo: TipoDestino
  destinoCodigo: string
  estado: EstadoCita
  frase: string
  nota: string | null
}

export interface Hogar {
  codigo: string
  procedimientoCodigo: string | null
  instructivoCodigo: string | null
  nota: string | null
}

const PREFIJO: Record<string, TipoDoc> = {
  PRC: "procedimiento",
  INS: "instructivo",
  PRT: "protocolo",
  FR: "formato",
}

/** Nombres de las otras carpetas/rar. SIG y SAC solo cuentan si van detrás de "área". */
export const AREAS_OTRAS = [
  "Operaciones IMCC",
  "Operaciones Logimat",
  "Proyectos y Negocios",
  "Talento y Cultura",
  "Seguridad y control",
  "Financiero",
]

const CODE_RE = /\b(PRC|INS|PRT|FR)-(\d{2,4})(?:-([A-Z]{2,5}))?\b/gi

export function codigoDesdeTexto(raw: string): { codigo: string; tipo: TipoDoc } | null {
  const m = raw.toUpperCase().match(/\b(PRC|INS|PRT|FR)-(\d{2,4})(?:-([A-Z]{2,5}))?\b/)
  if (!m) return null
  return armarCodigo(m[1], m[2], m[3])
}

export function tituloDesdeNombre(nombre: string): string {
  const base = nombre.replace(/\.[^.]+$/, "")
  const m = base.match(/\b(?:PRC|INS|PRT|FR)-\d{2,4}(?:-[A-Z]{2,5})?\b\s*(.*)$/i)
  const rest = (m?.[1] ?? "").replace(/[_]+/g, " ").trim()
  return rest || base.trim()
}

export function clasificarTexto(
  origenCodigo: string,
  texto: string,
  archivos: ArchivoSig[],
): CitaExtraida[] {
  const catalogo = indexar(archivos)
  const citas: CitaExtraida[] = []
  const vistas = new Set<string>()

  for (const match of texto.matchAll(new RegExp(CODE_RE.source, "gi"))) {
    const dest = armarCodigo(match[1], match[2], match[3])
    if (!dest || dest.codigo === origenCodigo) continue
    const frase = alrededor(texto, match.index ?? 0, match[0].length)
    const cita = clasificarCodigo(origenCodigo, dest, frase, catalogo)
    const key = `${cita.destinoTipo}|${cita.destinoCodigo}`
    if (vistas.has(key)) {
      const prev = citas.find((c) => `${c.destinoTipo}|${c.destinoCodigo}` === key)
      if (prev && rango(cita.estado) > rango(prev.estado)) {
        prev.estado = cita.estado
        prev.frase = cita.frase
        prev.nota = cita.nota
      }
      continue
    }
    vistas.add(key)
    citas.push(cita)
  }

  for (const area of areasMencionadas(texto)) {
    const key = `area|${area.nombre}`
    if (vistas.has(key)) continue
    vistas.add(key)
    citas.push({
      origenCodigo,
      destinoTipo: "area",
      destinoCodigo: area.nombre,
      estado: "otra_area",
      frase: area.frase,
      nota: "Citada desde esta área. Los archivos de allá no se abrieron.",
    })
  }

  return citas
}

export function asignarHogares(archivos: ArchivoSig[], citas: CitaExtraida[]): Hogar[] {
  const porCodigo = new Map(archivos.map((a) => [a.codigo, a]))
  const procedimientos = archivos
    .filter((a) => a.tipo === "procedimiento")
    .map((a) => a.codigo)
    .sort()
  const fallback = procedimientos[0] ?? null
  const resueltas = citas.filter((c) => c.estado === "resuelta")

  const hogarProc = new Map<string, string | null>()
  for (const codigo of procedimientos) hogarProc.set(codigo, codigo)

  for (const p of archivos.filter((a) => a.tipo === "protocolo")) {
    hogarProc.set(p.codigo, ganador(contarDesde(p.codigo, resueltas, "procedimiento", porCodigo)) ?? fallback)
  }
  for (const ins of archivos.filter((a) => a.tipo === "instructivo")) {
    hogarProc.set(ins.codigo, ganador(contarInstructivo(ins.codigo, resueltas, hogarProc, porCodigo)) ?? fallback)
  }
  for (const fr of archivos.filter((a) => a.tipo === "formato")) {
    const directos = contarDesde(fr.codigo, resueltas, "procedimiento", porCodigo)
    const viaIns = contarDesde(fr.codigo, resueltas, "instructivo", porCodigo)
    for (const [ins, n] of viaIns) {
      const casa = hogarProc.get(ins)
      if (casa) directos.set(casa, (directos.get(casa) ?? 0) + n)
    }
    hogarProc.set(fr.codigo, ganador(directos) ?? fallback)
  }

  return archivos.map((a) => {
    const procedimientoCodigo = hogarProc.get(a.codigo) ?? null
    const citado = resueltas.some((c) => c.destinoCodigo === a.codigo)
    const nota = a.tipo !== "procedimiento" && !citado && procedimientoCodigo
      ? "Ningún documento de la carpeta lo cita. Quedó en el primer procedimiento del área."
      : null
    const instructivoCodigo = a.tipo === "formato"
      ? ganador(contarDesde(a.codigo, resueltas, "instructivo", porCodigo))
      : null
    return { codigo: a.codigo, procedimientoCodigo, instructivoCodigo, nota }
  })
}

function rango(estado: EstadoCita): number {
  if (estado === "resuelta") return 3
  if (estado === "otro_codigo") return 2
  if (estado === "ausente") return 1
  return 0
}

function clasificarCodigo(
  origenCodigo: string,
  dest: { codigo: string; tipo: TipoDoc },
  frase: string,
  catalogo: ReturnType<typeof indexar>,
): CitaExtraida {
  const archivo = resolver(dest.codigo, catalogo)
  if (archivo) {
    return {
      origenCodigo,
      destinoTipo: archivo.tipo,
      destinoCodigo: archivo.codigo,
      estado: "resuelta",
      frase,
      nota: null,
    }
  }
  const alias = otroCodigoEnFrase(frase, dest, catalogo)
  if (alias) {
    return {
      origenCodigo,
      destinoTipo: dest.tipo,
      destinoCodigo: dest.codigo,
      estado: "otro_codigo",
      frase,
      nota: `En la misma frase aparece ${alias.codigo}.`,
    }
  }
  return {
    origenCodigo,
    destinoTipo: dest.tipo,
    destinoCodigo: dest.codigo,
    estado: "ausente",
    frase,
    nota: "El código se cita y el archivo no está en la carpeta.",
  }
}

function armarCodigo(prefijo: string, num: string, sufijo?: string): { codigo: string; tipo: TipoDoc } {
  const p = prefijo.toUpperCase()
  const codigo = `${p}-${num.padStart(3, "0")}${sufijo ? `-${sufijo.toUpperCase()}` : ""}`
  return { codigo, tipo: PREFIJO[p] }
}

function numeroClave(codigo: string): string {
  const m = codigo.match(/^(PRC|INS|PRT|FR)-(\d{3,4})/)
  return m ? `${m[1]}-${m[2]}` : codigo
}

function indexar(archivos: ArchivoSig[]) {
  const exact = new Map<string, ArchivoSig>()
  const porNumero = new Map<string, ArchivoSig>()
  for (const a of archivos) {
    exact.set(a.codigo, a)
    if (!porNumero.has(numeroClave(a.codigo))) porNumero.set(numeroClave(a.codigo), a)
  }
  return { exact, porNumero }
}

function resolver(codigo: string, catalogo: ReturnType<typeof indexar>): ArchivoSig | null {
  return catalogo.exact.get(codigo) ?? catalogo.porNumero.get(numeroClave(codigo)) ?? null
}

function otroCodigoEnFrase(
  frase: string,
  dest: { codigo: string; tipo: TipoDoc },
  catalogo: ReturnType<typeof indexar>,
): ArchivoSig | null {
  for (const match of frase.matchAll(new RegExp(CODE_RE.source, "gi"))) {
    const otro = armarCodigo(match[1], match[2], match[3])
    if (otro.tipo !== dest.tipo || otro.codigo === dest.codigo) continue
    const archivo = resolver(otro.codigo, catalogo)
    if (archivo) return archivo
  }
  return null
}

function alrededor(texto: string, index: number, len: number): string {
  let start = index
  while (start > 0 && texto[start - 1] !== "." && texto[start - 1] !== "\n" && index - start < 180) start--
  let end = index + len
  while (end < texto.length && texto[end] !== "." && texto[end] !== "\n" && end - index < 180) end++
  return texto.slice(start, end).replace(/\s+/g, " ").trim()
}

function areasMencionadas(texto: string): { nombre: string; frase: string }[] {
  const out: { nombre: string; frase: string }[] = []
  for (const nombre of AREAS_OTRAS) {
    const re = new RegExp(`(?:área|area|departamento)\\s+${escapeRe(nombre)}|\\b${escapeRe(nombre)}\\b`, "i")
    const m = re.exec(texto)
    if (!m || m.index === undefined) continue
    out.push({ nombre, frase: alrededor(texto, m.index, m[0].length) })
  }
  const cortas = texto.match(/(?:área|area|departamento)\s+(SAC|SIG)\b/i)
  if (cortas) {
    const nombre = cortas[1].toUpperCase()
    const idx = cortas.index ?? 0
    out.push({ nombre, frase: alrededor(texto, idx, cortas[0].length) })
  }
  return out
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function contarDesde(
  destino: string,
  citas: CitaExtraida[],
  tipoOrigen: TipoDoc,
  porCodigo: Map<string, ArchivoSig>,
): Map<string, number> {
  const counts = new Map<string, number>()
  for (const c of citas) {
    if (c.destinoCodigo !== destino) continue
    const origen = porCodigo.get(c.origenCodigo)
    if (!origen || origen.tipo !== tipoOrigen) continue
    counts.set(origen.codigo, (counts.get(origen.codigo) ?? 0) + 1)
  }
  return counts
}

function contarInstructivo(
  destino: string,
  citas: CitaExtraida[],
  hogarProc: Map<string, string | null>,
  porCodigo: Map<string, ArchivoSig>,
): Map<string, number> {
  const counts = contarDesde(destino, citas, "procedimiento", porCodigo)
  for (const [prt, n] of contarDesde(destino, citas, "protocolo", porCodigo)) {
    const casa = hogarProc.get(prt)
    if (!casa) continue
    counts.set(casa, (counts.get(casa) ?? 0) + n)
  }
  return counts
}

function ganador(counts: Map<string, number>): string | null {
  let best: string | null = null
  let bestN = 0
  for (const [codigo, n] of [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (n > bestN) {
      best = codigo
      bestN = n
    }
  }
  return best
}
