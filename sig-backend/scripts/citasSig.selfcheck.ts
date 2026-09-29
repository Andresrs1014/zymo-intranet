/**
 * Self-check del clasificador de citas y de las notas del grafo.
 * Sin I/O de los Word reales. Corre encadenado en: npm run selfcheck
 */
import assert from "assert"
import { asignarHogares, clasificarTexto, type ArchivoSig } from "../src/services/citasSig"
import { renderGrafo } from "../src/services/grafoNotas"

const archivos: ArchivoSig[] = [
  { codigo: "PRC-001-GAD", tipo: "procedimiento", titulo: "Compras", ruta: "PRC-001-GAD.docx" },
  { codigo: "PRC-002-GAD", tipo: "procedimiento", titulo: "Servicios", ruta: "PRC-002-GAD.docx" },
  { codigo: "INS-001-GAD", tipo: "instructivo", titulo: "Alimentación", ruta: "INS-001-GAD.docx" },
  { codigo: "INS-005-GAD", tipo: "instructivo", titulo: "Proveedores", ruta: "INS-005-GAD.docx" },
  { codigo: "INS-002-GAD", tipo: "instructivo", titulo: "Limpieza", ruta: "INS-002-GAD.docx" },
  { codigo: "PRT-001-GAD", tipo: "protocolo", titulo: "Compliance", ruta: "PRT-001-GAD.docx" },
  { codigo: "FR-001-GAD", tipo: "formato", titulo: "Registro", ruta: "FR-001-GAD.xlsx" },
  { codigo: "FR-099-GAD", tipo: "formato", titulo: "Huérfano", ruta: "FR-099-GAD.xlsx" },
]

const textoPrc = [
  "Seguir el INS-001 y el formato FR-001.",
  "El instructivo de compras INS-009 no está armado.",
  "Si falla, usar el INS-009, ver INS-005.",
  "Escalar al área Financiero y al departamento SAC.",
].join(" ")

const citasPrc = clasificarTexto("PRC-001-GAD", textoPrc, archivos)
const porDestino = new Map(citasPrc.map((c) => [c.destinoCodigo, c]))

assert.strictEqual(porDestino.get("INS-001-GAD")?.estado, "resuelta")
assert.strictEqual(porDestino.get("FR-001-GAD")?.estado, "resuelta")

const soloAusente = clasificarTexto("PRC-001-GAD", "Falta el instructivo de compras INS-009.", archivos)
assert.strictEqual(soloAusente.find((c) => c.destinoCodigo === "INS-009")?.estado, "ausente")

const alias = citasPrc.find((c) => c.destinoCodigo === "INS-009")
assert.strictEqual(alias?.estado, "otro_codigo")
assert.match(alias?.nota ?? "", /INS-005-GAD/)

assert.strictEqual(porDestino.get("Financiero")?.estado, "otra_area")
assert.strictEqual(porDestino.get("SAC")?.estado, "otra_area")
assert.strictEqual(porDestino.get("SIG"), undefined)

// PRC-001 cita dos veces el instructivo no cuenta: clasificar deduplica.
// PRC-002 también lo cita una vez. Empate: gana el código menor.
const citas = [
  ...clasificarTexto("PRC-002-GAD", "Ver INS-001.", archivos),
  ...citasPrc,
  ...clasificarTexto("PRT-001-GAD", "Aplicar INS-002.", archivos),
  ...clasificarTexto("PRC-001-GAD", "Protocolo PRT-001.", archivos),
]
const hogares = asignarHogares(archivos, citas)
const hogar = (codigo: string) => hogares.find((h) => h.codigo === codigo)

assert.strictEqual(hogar("INS-001-GAD")?.procedimientoCodigo, "PRC-001-GAD")
assert.strictEqual(hogar("PRT-001-GAD")?.procedimientoCodigo, "PRC-001-GAD")
assert.strictEqual(hogar("INS-002-GAD")?.procedimientoCodigo, "PRC-001-GAD")
assert.strictEqual(hogar("FR-001-GAD")?.procedimientoCodigo, "PRC-001-GAD")
assert.strictEqual(hogar("FR-099-GAD")?.procedimientoCodigo, "PRC-001-GAD")
assert.match(hogar("FR-099-GAD")?.nota ?? "", /carpeta lo cita/)

const notas = renderGrafo(archivos, citas, hogares)
const ausente = notas.find((n) => n.ruta === "ausentes/INS-009.md")
assert.ok(ausente)
assert.match(ausente!.cuerpo, /\[\[INS-009\]\]|referencia-ausente/)
assert.match(ausente!.cuerpo, /\[\[PRC-001-GAD\]\]/)
const area = notas.find((n) => n.ruta === "areas/Financiero.md")
assert.ok(area)
assert.match(area!.cuerpo, /area-sin-leer/)
assert.match(area!.cuerpo, /no se abrieron/)
const indice = notas.find((n) => n.ruta === "Grafo SIG.md")
assert.ok(indice)
assert.match(indice!.cuerpo, /pase entre el procedimiento/)

console.log("citasSig.selfcheck ok")
