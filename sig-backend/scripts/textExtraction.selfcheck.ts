/**
 * Self-check de las partes puras de la extracción de texto (sin I/O ni binarios
 * externos). Corre: npm run selfcheck
 *
 * Cubre: cleanupMarkdown (des-escapado de numeración y encabezados) y
 * renderPdfTables (filas irregulares, escape de pipes, tabla GFM válida).
 */
import assert from "assert"
import { cleanupMarkdown, renderPdfTables, promoteTableHeaders } from "../src/services/textExtraction"

// ── cleanupMarkdown ─────────────────────────────────────────────────────────
assert.strictEqual(
  cleanupMarkdown("El paso 5\\.3 y el 1\\) inician el flujo."),
  "El paso 5.3 y el 1) inician el flujo.",
  "des-escapa numeración de pasos",
)

assert.strictEqual(
  cleanupMarkdown("\\# OBJETIVO\n\n\\- primer punto"),
  "# OBJETIVO\n\n- primer punto",
  "des-escapa # y - a inicio de línea",
)

assert.strictEqual(
  cleanupMarkdown("línea 1\n\n\n\n\nlínea 2"),
  "línea 1\n\nlínea 2",
  "colapsa 3+ saltos de línea",
)

assert.strictEqual(
  cleanupMarkdown("ver [Imagen del documento adjunta abajo] aquí"),
  "ver [Imagen del documento — no incluida en el texto] aquí",
  "normaliza el marcador de imagen",
)

// ── renderPdfTables ─────────────────────────────────────────────────────────
const out = renderPdfTables([
  {
    num: 2,
    tables: [
      [
        ["Actividad", "Responsable"],
        ["Revisar solicitud", "Coordinador"],
        ["Aprobar"], // fila corta -> se rellena
      ],
    ],
  },
])
assert.ok(out.includes("*(página 2)*"), "marca el número de página")
assert.ok(out.includes("| Actividad | Responsable |"), "encabezado de la tabla")
assert.ok(out.includes("| --- | --- |"), "separador GFM")
assert.ok(out.includes("| Aprobar |  |"), "rellena celdas faltantes de una fila corta")

const piped = renderPdfTables([
  { num: 1, tables: [[["A|B", "C"], ["multi\nlínea", "x"]]] },
])
assert.ok(piped.includes("A\\|B"), "escapa el pipe dentro de una celda")
assert.ok(piped.includes("| multi línea | x |"), "aplana saltos de línea dentro de la celda")

assert.strictEqual(renderPdfTables([]), "", "sin páginas -> cadena vacía")

// ── promoteTableHeaders ────────────────────────────────────────────────────
const promoted = promoteTableHeaders(
  "<table><tr><td>Actividad</td><td>Responsable</td></tr><tr><td>Revisar</td><td>Coordinador</td></tr></table>",
)
assert.ok(promoted.includes("<thead><tr><th>Actividad</th><th>Responsable</th></tr></thead>"), "promueve 1ª fila a thead/th")
assert.ok(promoted.includes("<tbody><tr><td>Revisar</td><td>Coordinador</td></tr></tbody>"), "resto va a tbody")

const withThead = "<table><thead><tr><th>A</th></tr></thead><tr><td>1</td></tr></table>"
assert.strictEqual(promoteTableHeaders(withThead), withThead, "no toca tablas que ya tienen thead")

const nested = "<table><tr><td><table><tr><td>x</td></tr></table></td></tr></table>"
assert.strictEqual(promoteTableHeaders(nested), nested, "deja intactas las tablas anidadas")

console.log("textExtraction.selfcheck: OK")
