import assert from "assert"
import fs from "fs"
import os from "os"
import path from "path"
import ExcelJS from "exceljs"
import { leerIndicadoresXlsx } from "../src/services/indicadorHoja"

async function libro(hojas: (wb: ExcelJS.Workbook) => void): Promise<string> {
  const wb = new ExcelJS.Workbook()
  hojas(wb)
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kpi-"))
  const file = path.join(dir, "kpi.xlsx")
  await wb.xlsx.writeFile(file)
  return file
}

function ficha(ws: ExcelJS.Worksheet, nombre: string, resultado: number) {
  ws.getCell("E2").value = "FORMATO HOJA DE VIDA INDICADORES"
  ws.getCell("M2").value = "CODIGO FR-010-GER"
  ws.getCell("M3").value = "VERSIÓN 1"
  ws.getCell("B6").value = "NOMBRE DEL INDICADOR:"
  ws.getCell("C6").value = "NOMBRE DEL INDICADOR:"
  ws.getCell("D6").value = nombre
  ws.getCell("H6").value = "TIPO DE INDICADOR"
  ws.getCell("I6").value = "Cumplimiento"
  ws.getCell("J6").value = "TENDENCIA"
  ws.getCell("K6").value = "Ascendente"
  ws.getCell("L6").value = "FRECUENCIA DE MEDICIÓN:"
  ws.getCell("M6").value = "Mensual"
  ws.getCell("B8").value = "OBJETIVO:"
  ws.getCell("D8").value = "Medir el cumplimiento"
  ws.getCell("B10").value = "RELACIÓN MATEMÁTICA:"
  ws.getCell("D10").value = "hechas ÷ totales"
  ws.getCell("B12").value = "META DEL INDICADOR AÑO 2026"
  ws.getCell("D12").value = "≥ 90 %"
  ws.getCell("B14").value = "PLAZO LOGRO META"
  ws.getCell("D14").value = "Anual (vigencia 2026)"
  ws.getCell("B17").value = "FUENTE DE INFORMACIÓN:"
  ws.getCell("D17").value = "Intranet ZYMO"
  ws.getCell("B20").value = "PROCESO RESPONSABLE DE LA MEDICION Y SEGUIMIENTO"
  ws.getCell("D20").value = "ADMINISTRATIVO"
  ws.getCell("D31").value = "ENERO"
  ws.getCell("F31").value = 0
  ws.getCell("G31").value = 0
  ws.getCell("D39").value = "SEPTIEMBRE"
  ws.getCell("F39").value = 86
  ws.getCell("G39").value = 92
  ws.getCell("J39").value = resultado
}

async function main() {
  const uno = await libro((wb) => ficha(wb.addWorksheet("OPORTUNIDAD"), "Oportunidad en compras", 0.9347826086956522))
  const fichas = await leerIndicadoresXlsx(uno)
  assert.strictEqual(fichas.length, 1)
  assert.strictEqual(fichas[0].nombre, "Oportunidad en compras")
  assert.strictEqual(fichas[0].codigo, "FR-010-GER")
  assert.strictEqual(fichas[0].meta, "≥ 90 %")
  assert.strictEqual(fichas[0].frecuencia, "Mensual")
  assert.strictEqual(fichas[0].tipo, "Cumplimiento")
  assert.strictEqual(fichas[0].tendencia, "Ascendente")
  assert.strictEqual(fichas[0].fuente, "Intranet ZYMO")
  assert.strictEqual(fichas[0].procesoResponsable, "ADMINISTRATIVO")
  assert.strictEqual(fichas[0].formula, "hechas ÷ totales")
  assert.deepStrictEqual(fichas[0].resultados, [
    { periodo: "2026-09", numerador: 86, denominador: 92, resultado: 0.9347826086956522 },
  ])

  const dos = await libro((wb) => {
    ficha(wb.addWorksheet("LOGI"), "Limpieza", 0.9)
    ficha(wb.addWorksheet("IMCC"), "Limpieza", 0.8)
    wb.addWorksheet("listas").getCell("A1").value = "TIPO"
  })
  const ambas = await leerIndicadoresXlsx(dos)
  assert.deepStrictEqual(ambas.map((f) => f.nombre).sort(), ["Limpieza · IMCC", "Limpieza · LOGI"])
  // Formato real: tabla "RESULTADO DEL INDICADOR" (con celdas combinadas), fórmula compartida sin valor
  // guardado, otra tabla de meses que no es el resultado y matriz de acciones.
  const real = await libro((wb) => {
    const ws = wb.addWorksheet("REAL")
    ficha(ws, "Frecuencia AT", 0)
    for (const c of ["D31", "F31", "G31", "D39", "F39", "G39", "J39"]) ws.getCell(c).value = null
    ws.getCell("D22").value = "MES"; ws.getCell("F22").value = "Casos"; ws.getCell("G22").value = "Total"; ws.getCell("J22").value = "RESULTADO DEL INDICADOR"
    const filas: [string, number, number][] = [["ENERO", 1, 100], ["FEBRERO", 0, 50], ["MARZO", 1, 50]]
    filas.forEach(([mes, n, d], i) => {
      const r = 23 + i
      ws.getCell(`D${r}`).value = mes
      ws.getCell(`F${r}`).value = n
      ws.getCell(`G${r}`).value = d
      if (mes === "ENERO") ws.getCell(`J${r}`).value = { formula: "F23/G23", result: 0.01 }
      else ws.getCell(`J${r}`).value = { sharedFormula: "J23" } as unknown as ExcelJS.CellValue
    })
    ws.getCell("D30").value = "Abril"; ws.getCell("F30").value = 99; ws.getCell("J30").value = 99
    ws.getCell("B40").value = "Matriz de acciones"
    ws.getCell("B41").value = "Mes de resultado"; ws.getCell("C41").value = "Descripción/observación de resultado"
    ws.getCell("G41").value = "Accion Correctiva"; ws.getCell("J41").value = "Descripción/observación de la acción ejecutada"
    ws.getCell("L41").value = "Fecha de Cierre"; ws.getCell("M41").value = "Lider responsable (Nombre y apellido)"
    ws.getCell("B43").value = "ENERO"; ws.getCell("C43").value = "Hubo 1 accidente"; ws.getCell("G43").value = "X"
    ws.getCell("J43").value = "Socializar la lección"; ws.getCell("L43").value = new Date("2026-02-28T00:00:00Z"); ws.getCell("M43").value = "Ana Pérez"
  })
  const [r] = await leerIndicadoresXlsx(real)
  assert.deepStrictEqual(r.resultados.map((x) => [x.periodo, x.numerador, x.denominador, x.resultado]), [
    ["2026-01", 1, 100, 0.01],
    ["2026-02", 0, 50, 0], // fórmula compartida sin valor: se calcula 0 ÷ 50
    ["2026-03", 1, 50, 0.02],
  ])
  assert.deepStrictEqual(
    { l: r.resultados[0].lectura, t: r.resultados[0].tipoAccion, a: r.resultados[0].accion, c: r.resultados[0].cierre, d: r.resultados[0].lider },
    { l: "Hubo 1 accidente", t: "correctiva", a: "Socializar la lección", c: "2026-02-28", d: "Ana Pérez" },
  )
  console.log("indicadorHoja.selfcheck ok")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
