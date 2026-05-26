import ExcelJS from "exceljs"
import PDFDocument from "pdfkit"
import { Response } from "express"
import prisma from "../config/prisma"
import { AppError } from "../middleware/errorHandler"
import { AuthPayload } from "../middleware/auth"
import { getManagedTeamIds } from "../utils/permissions"
interface ExportFilters {
  teamId: number
  search?: string
  estado?: string
  etiqueta?: string
  plataforma?: string
  fechaDesde?: string
  fechaHasta?: string
  responsableId?: number
  prioridad?: string
}

async function assertManagerAndQuery(user: AuthPayload, filters: ExportFilters) {
  const managed = await getManagedTeamIds(user)
  if (!managed.includes(filters.teamId)) {
    throw new AppError(403, "Solo gestores pueden exportar datos del equipo")
  }

  const where: Record<string, unknown> = { teamId: filters.teamId }
  if (filters.search) {
    where["OR"] = [
      { titulo: { contains: filters.search, mode: "insensitive" } },
      { descripcionTecnica: { contains: filters.search, mode: "insensitive" } },
    ]
  }
  if (filters.estado) where["estado"] = filters.estado
  if (filters.etiqueta) where["etiqueta"] = filters.etiqueta
  if (filters.plataforma) where["plataforma"] = filters.plataforma
  if (filters.prioridad) where["prioridad"] = filters.prioridad
  if (filters.responsableId) where["asignadoAId"] = filters.responsableId

  const dateFilter: Record<string, Date> = {}
  if (filters.fechaDesde) dateFilter["gte"] = new Date(filters.fechaDesde)
  if (filters.fechaHasta) dateFilter["lte"] = new Date(filters.fechaHasta)
  if (Object.keys(dateFilter).length > 0) where["fecha"] = dateFilter

  return prisma.task.findMany({
    where,
    orderBy: [{ fecha: "desc" }],
    take: 5000,
  })
}

export async function exportExcel(
  user: AuthPayload,
  filters: ExportFilters,
  res: Response,
): Promise<void> {
  const tasks = await assertManagerAndQuery(user, filters)

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("Tareas")

  sheet.columns = [
    { header: "Responsable", key: "responsable", width: 25 },
    { header: "Título", key: "titulo", width: 40 },
    { header: "Fecha", key: "fecha", width: 15 },
    { header: "Etiqueta", key: "etiqueta", width: 20 },
    { header: "Plataforma", key: "plataforma", width: 15 },
    { header: "Tiempo (min)", key: "tiempo", width: 15 },
    { header: "Estado", key: "estado", width: 15 },
    { header: "Prioridad", key: "prioridad", width: 12 },
  ]

  // Header styling
  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true }
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E79" } }
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } }
  })

  for (const t of tasks) {
    sheet.addRow({
      responsable: t.asignadoANombre ?? t.subidoPorNombre,
      titulo: t.titulo,
      fecha: t.fecha.toISOString().slice(0, 10),
      etiqueta: t.etiqueta,
      plataforma: t.plataforma,
      tiempo: t.tiempoTotalMinutos ?? "",
      estado: t.estado,
      prioridad: t.prioridad,
    })
  }

  const dateStr = new Date().toISOString().slice(0, 10)
  const filename = `tareas_${dateStr}.xlsx`

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`)

  await workbook.xlsx.write(res)
}

export async function exportPdf(
  user: AuthPayload,
  filters: ExportFilters,
  res: Response,
): Promise<void> {
  const tasks = await assertManagerAndQuery(user, filters)

  const dateStr = new Date().toISOString().slice(0, 10)
  const filename = `tareas_${dateStr}.pdf`

  res.setHeader("Content-Type", "application/pdf")
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`)

  const doc = new PDFDocument({ margin: 40, size: "A4", layout: "landscape" })
  doc.pipe(res)

  doc.fontSize(16).font("Helvetica-Bold").text("Reporte de Tareas", { align: "center" })
  doc.fontSize(10).font("Helvetica").text(`Exportado: ${dateStr}`, { align: "center" })
  doc.moveDown()

  const cols = [
    { header: "Responsable", width: 100 },
    { header: "Título", width: 180 },
    { header: "Fecha", width: 70 },
    { header: "Etiqueta", width: 80 },
    { header: "Plataforma", width: 70 },
    { header: "Tiempo", width: 50 },
    { header: "Estado", width: 70 },
    { header: "Prioridad", width: 60 },
  ]

  // Table header
  let x = 40
  const headerY = doc.y
  doc.font("Helvetica-Bold").fontSize(9)
  for (const col of cols) {
    doc.rect(x, headerY, col.width, 20).fillAndStroke("#1f4e79", "#1f4e79")
    doc.fillColor("white").text(col.header, x + 3, headerY + 5, { width: col.width - 6 })
    x += col.width
  }
  doc.fillColor("black")

  // Table rows
  doc.font("Helvetica").fontSize(8)
  let y = headerY + 22

  for (const t of tasks) {
    if (y > 500) {
      doc.addPage()
      y = 40
    }

    const values = [
      t.asignadoANombre ?? t.subidoPorNombre,
      t.titulo,
      t.fecha.toISOString().slice(0, 10),
      t.etiqueta,
      t.plataforma,
      t.tiempoTotalMinutos ? `${t.tiempoTotalMinutos}m` : "-",
      t.estado,
      t.prioridad,
    ]

    x = 40
    const rowColor = tasks.indexOf(t) % 2 === 0 ? "#f8f9fa" : "#ffffff"
    for (let i = 0; i < cols.length; i++) {
      doc.rect(x, y, cols[i].width, 18).fillAndStroke(rowColor, "#dee2e6")
      doc.fillColor("#212529").text(values[i], x + 3, y + 4, {
        width: cols[i].width - 6,
        ellipsis: true,
      })
      x += cols[i].width
    }
    y += 19
  }

  doc.end()
}
