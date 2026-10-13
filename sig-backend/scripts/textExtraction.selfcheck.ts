/**
 * Self-check de las partes puras de la extracción de texto (sin I/O ni binarios
 * externos). Corre: npm run selfcheck
 *
 * Cubre: cleanupMarkdown (des-escapado de numeración y encabezados) y
 * renderPdfTables (filas irregulares, escape de pipes, tabla GFM válida).
 */
import assert from "assert"
import { cleanupMarkdown, renderPdfTables, promoteTableHeaders, flujogramaImageIndices } from "../src/services/textExtraction"

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

// ── flujogramaImageIndices ──────────────────────────────────────────────────
const im = (n: number) => `<p><img src="sig-image:${n}" /></p>`
assert.deepStrictEqual(
  flujogramaImageIndices(`<p>FLUJOGRAMA</p><p>FASE A</p>${im(1)}${im(2)}<p>FASE B</p>${im(3)}<p>INDICADORES</p><p>Código: FR-1</p>${im(4)}`),
  [1, 2, 3],
  "junta las imágenes seguidas y corta al llegar a la siguiente sección",
)
assert.deepStrictEqual(
  flujogramaImageIndices(`<p>Los flujogramas de apoyo</p>${im(1)}<p>x</p><p>FLUJOGRAMA</p>${im(2)}<p>INDICADORES</p>`),
  [2],
  "ignora 'flujogramas' dentro de prosa",
)
assert.deepStrictEqual(
  flujogramaImageIndices(`<table><tr><td><p><img src="sig-image:1" /><strong>9. Flujograma </strong></p></td></tr></table><p> </p><p>INDICADORES</p>`),
  [1],
  "la imagen viene en el mismo párrafo del título",
)
assert.deepStrictEqual(
  flujogramaImageIndices(`<table><tr><td><p><strong>9. FLUJOGRAMA</strong></p></td></tr></table><table><tr><td>${im(1)}</td></tr></table>${im(2)}<table><tr><td><p>INDICADORES</p></td></tr></table>${im(3)}`),
  [1, 2],
  "título e imagen dentro de tablas de una celda (GIS/GEC)",
)
assert.deepStrictEqual(
  flujogramaImageIndices(`<p><strong>9. FLUJOGRAMA</strong></p><img src="sig-image:1" /><img src="sig-image:2" /><table><tr><td><p>Encabezado</p>${im(3)}</td></tr></table>`),
  [1, 2],
  "imágenes sueltas cuentan; una tabla con texto (encabezado con logo) corta",
)
assert.deepStrictEqual(flujogramaImageIndices("<p>Sin nada</p>"), [], "sin flujograma devuelve vacío")
console.log("flujogramaImageIndices ok")
