import ExcelJS from "exceljs"

export interface ResultadoIndicador {
  periodo: string
  numerador: number | null
  denominador: number | null
  resultado: number
  // Matriz de acciones de la hoja (solo si el mes la trae diligenciada).
  lectura?: string
  tipoAccion?: "correctiva" | "mejora" | "no_aplica"
  accion?: string
  cierre?: string
  lider?: string
}

export interface FichaIndicador {
  nombre: string
  codigo: string | null
  objetivo: string | null
  formula: string | null
  meta: string | null
  frecuencia: string | null
  fuente: string | null
  tipo: string | null
  tendencia: string | null
  plazo: string | null
  procesoResponsable: string | null
  versionDoc: string | null
  fechaDoc: string | null
  resultados: ResultadoIndicador[]
  hoja: string
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]

const LABELS: { key: keyof FichaIndicador; match: string }[] = [
  { key: "nombre", match: "nombre del indicador" },
  { key: "objetivo", match: "objetivo" },
  { key: "formula", match: "relacion matematica" },
  { key: "meta", match: "meta del indicador" },
  { key: "plazo", match: "plazo logro meta" },
  { key: "fuente", match: "fuente de" },
  { key: "procesoResponsable", match: "proceso responsable" },
  { key: "tipo", match: "tipo de indicador" },
  { key: "tendencia", match: "tendencia" },
  { key: "frecuencia", match: "frecuencia de medicion" },
]

type Cell = { r: number; c: number; v: string }

function norm(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim()
}

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return ""
  if (typeof value === "object" && "richText" in value) {
    return value.richText.map((t) => t.text).join("").trim()
  }
  if (typeof value === "object" && "result" in value) {
    const result = value.result
    if (result && typeof result === "object") return ""
    return cellText(result as ExcelJS.CellValue)
  }
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value).replace(/\s+/g, " ").trim()
}

function sheetCells(ws: ExcelJS.Worksheet): Cell[] {
  const out: Cell[] = []
  ws.eachRow({ includeEmpty: false }, (row, r) => {
    row.eachCell({ includeEmpty: false }, (cell, c) => {
      const v = cellText(cell.value)
      if (v) out.push({ r, c, v })
    })
  })
  return out
}

function labelOf(text: string): (typeof LABELS)[number] | undefined {
  const n = norm(text).replace(/:$/, "")
  return LABELS.find((l) => n === l.match || n.startsWith(l.match))
}

function blankFicha(hoja: string): FichaIndicador {
  return {
    nombre: "", codigo: null, objetivo: null, formula: null, meta: null, frecuencia: null,
    fuente: null, tipo: null, tendencia: null, plazo: null, procesoResponsable: null,
    versionDoc: null, fechaDoc: null, resultados: [], hoja,
  }
}

function applyHeader(ficha: FichaIndicador, text: string) {
  const n = norm(text)
  const codigo = n.match(/codigo\s+([a-z0-9-]+)/)
  const version = n.match(/version\s+([0-9.]+)/)
  const fecha = text.match(/fecha\s+(\d{1,2}\/\d{1,2}\/\d{4})/i)
  if (codigo) ficha.codigo = codigo[1].toUpperCase()
  if (version) ficha.versionDoc = version[1]
  if (fecha) ficha.fechaDoc = fecha[1]
}

function fillLabels(ficha: FichaIndicador, cells: Cell[]) {
  const byRow = new Map<number, Cell[]>()
  for (const cell of cells) {
    const row = byRow.get(cell.r) ?? []
    row.push(cell)
    byRow.set(cell.r, row)
  }
  for (const row of byRow.values()) {
    row.sort((a, b) => a.c - b.c)
    const marks: { i: number; label: (typeof LABELS)[number] }[] = []
    for (let i = 0; i < row.length; i++) {
      const label = labelOf(row[i].v)
      if (!label) continue
      if (marks[marks.length - 1]?.label.key === label.key) continue
      marks.push({ i, label })
    }
    for (let m = 0; m < marks.length; m++) {
      if (marks[m].label.key === "nombre") continue
      const from = marks[m].i + 1
      const to = m + 1 < marks.length ? marks[m + 1].i : row.length
      const value = row.slice(from, to).map((c) => c.v).find((v) => !labelOf(v))
      if (!value) continue
      const key = marks[m].label.key as Exclude<keyof FichaIndicador, "nombre" | "resultados" | "hoja">
      ficha[key] = value
    }
    const nombre = marks.find((m) => m.label.key === "nombre")
    if (nombre) {
      const to = marks.find((m) => m.i > nombre.i)?.i ?? row.length
      const value = row.slice(nombre.i + 1, to).map((c) => c.v).find((v) => !labelOf(v))
      if (value) ficha.nombre = value
    }
  }
}

function yearOf(ficha: FichaIndicador): string | null {
  const blob = `${ficha.plazo ?? ""} ${ficha.fechaDoc ?? ""}`
  return blob.match(/20\d{2}/)?.[0] ?? null
}

function byRowOf(cells: Cell[]): Map<number, Cell[]> {
  const byRow = new Map<number, Cell[]>()
  for (const cell of cells) {
    const row = byRow.get(cell.r) ?? []
    row.push(cell)
    byRow.set(cell.r, row)
  }
  for (const row of byRow.values()) row.sort((a, b) => a.c - b.c)
  return byRow
}

// Las celdas combinadas repiten el texto en cada columna: la columna "real" es la de más a la izquierda.
function colOf(row: Cell[], pred: (n: string) => boolean): number | null {
  return row.find((c) => pred(norm(c.v)))?.c ?? null
}

function num(row: Cell[], col: number | null): number | null {
  if (col == null) return null
  const v = row.find((c) => c.c === col)?.v
  if (v == null) return null
  const n = Number(v.replace(",", "."))
  return v !== "" && Number.isFinite(n) ? n : null
}

function textoAt(row: Cell[], col: number | null): string | null {
  if (col == null) return null
  const v = row.find((c) => c.c === col)?.v
  if (!v || norm(v) === "no aplica") return null
  return v
}

// Tabla bajo "RESULTADO DEL INDICADOR": mes | numerador | denominador | resultado.
// Ojo: la hoja trae otras tablas con meses (datos crudos, gráficas); solo esta es el resultado.
function tablaResultados(ficha: FichaIndicador, byRow: Map<number, Cell[]>, header: Cell, year: string | null) {
  const hrow = byRow.get(header.r) ?? []
  const mesCol = colOf(hrow, (n) => n === "mes")
  if (mesCol == null) return
  const intermedias = hrow.filter((c) => c.c > mesCol && c.c < header.c && norm(c.v) !== "mes")
  const distintas = [...new Set(intermedias.map((c) => c.v))]
  // Con 3+ variables (p. ej. ausentismo) numerador/denominador no son un par: solo se guarda el resultado.
  const par = distintas.length === 2
  const numCol = par ? intermedias.find((c) => c.v === distintas[0])!.c : null
  const denCol = par ? intermedias.find((c) => c.v === distintas[1])!.c : null
  const vistos = new Set<string>()
  for (let r = header.r + 1; ; r++) {
    const row = byRow.get(r)
    const mes = row?.find((c) => c.c === mesCol)
    const idx = mes ? MESES.indexOf(norm(mes.v)) : -1
    if (!row || idx < 0 || vistos.has(norm(mes!.v))) break
    vistos.add(norm(mes!.v))
    const numerador = num(row, numCol)
    const denominador = num(row, denCol)
    let resultado = num(row, header.c)
    if (resultado == null && numerador != null && denominador) resultado = numerador / denominador
    if (resultado == null || !Number.isFinite(resultado)) continue
    ficha.resultados.push({
      periodo: year ? `${year}-${String(idx + 1).padStart(2, "0")}` : norm(mes!.v),
      numerador, denominador, resultado,
    })
  }
}

// Matriz de acciones: por mes, qué se leyó del resultado y qué se hizo.
function matrizAcciones(ficha: FichaIndicador, byRow: Map<number, Cell[]>, cells: Cell[], year: string | null) {
  const titulo = cells.find((c) => norm(c.v).startsWith("matriz de acciones"))
  if (!titulo) return
  const enc = [titulo.r + 1, titulo.r + 2].flatMap((r) => byRow.get(r) ?? [])
  const mesCol = colOf(enc, (n) => n.startsWith("mes de resultado"))
  const lecturaCol = colOf(enc, (n) => n.startsWith("descripcion/observacion de resultado"))
  const accionCol = colOf(enc, (n) => n.startsWith("descripcion/observacion de la accion"))
  const correctivaCol = colOf(enc, (n) => n === "accion correctiva")
  const mejoraCol = colOf(enc, (n) => n === "accion mejora")
  const noAplicaCol = colOf(enc, (n) => n === "no aplica")
  const cierreCol = colOf(enc, (n) => n.startsWith("fecha de cierre"))
  const liderCol = colOf(enc, (n) => n.startsWith("lider responsable"))
  if (mesCol == null) return
  const marcada = (row: Cell[], col: number | null) => col != null && norm(row.find((c) => c.c === col)?.v ?? "") === "x"
  for (let r = titulo.r + 3; ; r++) {
    const row = byRow.get(r)
    const mes = row?.find((c) => c.c === mesCol)
    const idx = mes ? MESES.indexOf(norm(mes.v)) : -1
    if (!row || idx < 0) break
    const periodo = year ? `${year}-${String(idx + 1).padStart(2, "0")}` : norm(mes!.v)
    const res = ficha.resultados.find((x) => x.periodo === periodo)
    if (!res) continue
    const lectura = textoAt(row, lecturaCol)
    if (lectura) res.lectura = lectura
    if (marcada(row, correctivaCol)) res.tipoAccion = "correctiva"
    else if (marcada(row, mejoraCol)) res.tipoAccion = "mejora"
    else if (marcada(row, noAplicaCol)) res.tipoAccion = "no_aplica"
    const accion = textoAt(row, accionCol)
    if (accion) res.accion = accion
    const cierre = textoAt(row, cierreCol)
    if (cierre) res.cierre = cierre
    const lider = textoAt(row, liderCol)
    if (lider) res.lider = lider
  }
}

// La hoja viene prellenada hasta diciembre: los meses finales sin acciones y sin casos no se midieron todavía.
function quitarMesesSinMedir(ficha: FichaIndicador) {
  while (ficha.resultados.length > 0) {
    const ult = ficha.resultados[ficha.resultados.length - 1]
    // ponytail: un 0 final sin lectura ni acción se toma por "sin medir"; si hace falta distinguirlo, usar la fecha de corte.
    if ((ult.numerador ?? 0) !== 0 || ult.resultado !== 0 || ult.lectura || ult.accion) break
    ficha.resultados.pop()
  }
}

// Formato viejo / hojas sin encabezado de resultados: fila con mes + cifras, el último número es el resultado.
function filasPorMes(ficha: FichaIndicador, byRow: Map<number, Cell[]>, year: string | null) {
  for (const row of byRow.values()) {
    const mes = row.find((c) => MESES.includes(norm(c.v)))
    if (!mes) continue
    const nums = row.filter((c) => c.c > mes.c).map((c) => Number(c.v.replace(",", "."))).filter((n) => Number.isFinite(n))
    if (nums.length === 0) continue
    const resultado = nums[nums.length - 1]
    const numerador = nums.length >= 3 ? nums[0] : null
    const denominador = nums.length >= 3 ? nums[1] : null
    if (resultado === 0 && (numerador ?? 0) === 0 && (denominador ?? 0) === 0) continue
    const idx = MESES.indexOf(norm(mes.v)) + 1
    const periodo = year ? `${year}-${String(idx).padStart(2, "0")}` : norm(mes.v)
    if (ficha.resultados.some((r) => r.periodo === periodo)) continue
    ficha.resultados.push({ periodo, numerador, denominador, resultado })
  }
}

function fillResultados(ficha: FichaIndicador, cells: Cell[]) {
  const year = yearOf(ficha)
  const byRow = byRowOf(cells)
  const header = cells.find((c) => norm(c.v).startsWith("resultado del indicador"))
  if (header) tablaResultados(ficha, byRow, header, year)
  if (ficha.resultados.length > 0) {
    matrizAcciones(ficha, byRow, cells, year)
    quitarMesesSinMedir(ficha)
  } else {
    filasPorMes(ficha, byRow, year)
  }
  ficha.resultados.sort((a, b) => a.periodo.localeCompare(b.periodo))
}

function leerHoja(ws: ExcelJS.Worksheet): FichaIndicador | null {
  if (norm(ws.name) === "listas") return null
  const cells = sheetCells(ws)
  if (!cells.some((c) => labelOf(c.v)?.key === "nombre")) return null
  const ficha = blankFicha(ws.name)
  for (const cell of cells) applyHeader(ficha, cell.v)
  fillLabels(ficha, cells)
  if (!ficha.nombre) return null
  fillResultados(ficha, cells)
  return ficha
}

export async function leerIndicadoresXlsx(filePath: string): Promise<FichaIndicador[]> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(filePath)
  const fichas = wb.worksheets.map(leerHoja).filter((f): f is FichaIndicador => f != null)
  const counts = new Map<string, number>()
  for (const f of fichas) counts.set(f.nombre, (counts.get(f.nombre) ?? 0) + 1)
  for (const f of fichas) {
    if ((counts.get(f.nombre) ?? 0) > 1) f.nombre = `${f.nombre} · ${f.hoja}`
  }
  return fichas
}
