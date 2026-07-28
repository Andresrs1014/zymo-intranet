import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer"
import type { LibertadoraProspecto } from "@prisma/client"

// PDF real generado en el servidor (sin pasar por el diálogo de impresión del
// navegador) — decisión explícita del usuario: el "Guardar como PDF" del
// navegador agrega su propio pie de página con la URL de la página, algo que
// no se puede desactivar desde el código por razones de seguridad del propio
// navegador. Generándolo acá no hay diálogo de por medio, así que no hay pie
// de página que quitar.

const COLORS = {
  navy: "#1E3A5F",
  navy2: "#2D5F8A",
  teal: "#009B8E",
  tealD: "#007A6F",
  tealL: "#D9F5F3",
  orange: "#F5821F",
  green: "#38A169",
  warn: "#DD6B20",
  red: "#E53E3E",
  gray: "#A0AEC0",
  ink: "#27272a",
  muted: "#71717a",
  border: "#e4e4e7",
}

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 9, fontFamily: "Helvetica", color: COLORS.ink },
  headerBox: { backgroundColor: COLORS.navy, borderRadius: 8, padding: 14, marginBottom: 12 },
  headerTitle: { color: "#ffffff", fontSize: 15, fontFamily: "Helvetica-Bold" },
  headerSub: { color: "#ffffff", fontSize: 9, marginTop: 4, opacity: 0.85 },
  headerSub2: { color: "#ffffff", fontSize: 8, marginTop: 2, opacity: 0.65 },
  card: { border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: 12, marginBottom: 10 },
  cardTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#18181b", marginBottom: 8 },
  fRow: { flexDirection: "row", alignItems: "center", marginBottom: 5 },
  fLabel: { width: 150, fontSize: 8.5, fontFamily: "Helvetica-Bold", color: "#3f3f46" },
  fBarBg: { flex: 1, height: 14, backgroundColor: "#f4f4f5", borderRadius: 3 },
  fBarFill: { height: 14, borderRadius: 3, justifyContent: "center", paddingLeft: 5 },
  fBarText: { color: "#ffffff", fontSize: 8, fontFamily: "Helvetica-Bold" },
  fValue: { width: 28, textAlign: "right", fontSize: 8.5, fontFamily: "Helvetica-Bold", color: "#3f3f46" },
  tHeadRow: { flexDirection: "row", borderBottom: `1px solid ${COLORS.border}`, paddingBottom: 4, marginBottom: 3 },
  tHeadCell: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: "#a1a1aa", textTransform: "uppercase" },
  tRow: { flexDirection: "row", borderTop: `1px solid #f4f4f5`, paddingVertical: 4 },
  tCell: { fontSize: 8.5, color: "#3f3f46" },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  kpiBox: { width: "31%", border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: 8, marginBottom: 8 },
  kpiLabel: { fontSize: 7, fontFamily: "Helvetica-Bold", color: "#a1a1aa", textTransform: "uppercase" },
  kpiValue: { fontSize: 13, fontFamily: "Helvetica-Bold", color: "#18181b", marginTop: 2 },
  kpiSub: { fontSize: 7.5, color: "#a1a1aa", marginTop: 2 },
})

function formatCOP(value: number): string {
  if (!value || value <= 0) return "—"
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(value)
}

export interface InformeKpis {
  tot: number
  ci: number
  ii: number
  ep: number
  ni: number
  mo: number
  po: number
  conv: number
}

export function InformePdfDocument({ kpis, prospectos }: { kpis: InformeKpis; prospectos: LibertadoraProspecto[] }) {
  const cerrados = prospectos.filter((p) => p.estado === "CERRADO")
  const contactados = kpis.tot - prospectos.filter((p) => p.estado === "EN_PROCESO" && (p.gestion ?? "").toLowerCase().includes("programar")).length
  const steps = [
    { label: "Total prospectos identificados", value: kpis.tot, color: COLORS.navy2 },
    { label: "Contactados / cita realizada", value: contactados, color: COLORS.teal },
    { label: "Con interés confirmado", value: kpis.ci + kpis.ii, color: COLORS.orange },
    { label: "Cierres exitosos", value: kpis.ci, color: COLORS.green },
  ]
  const calientes = prospectos
    .filter((p) => p.estado === "INTERESADO" || (p.estado === "EN_PROCESO" && p.prioridad === "ALTA"))
    .sort((a, b) => (a.estado === "INTERESADO" && b.estado !== "INTERESADO" ? -1 : 1))
    .slice(0, 10)
  const altaPrioridad = prospectos.filter((p) => p.prioridad === "ALTA").length
  const pj = prospectos.filter((p) => p.tipo === "PJ").length
  const pn = prospectos.filter((p) => p.tipo === "PN").length

  const kpiCards = [
    { label: "Tasa conversión", value: `${kpis.conv}%`, sub: "Cierres / total base" },
    { label: "Pipeline potencial/mes", value: formatCOP(kpis.po), sub: "Suma prospectos interesados" },
    { label: "Monto real cerrado/mes", value: formatCOP(kpis.mo), sub: "Aportes mensuales activos" },
    { label: "Alta prioridad", value: String(altaPrioridad), sub: "Acción inmediata requerida" },
    { label: "Personas jurídicas", value: String(pj), sub: "Empresas / compañías" },
    { label: "Personas naturales", value: String(pn), sub: "Clientes individuales" },
  ]

  return (
    <Document title="Informe SKANDIA CREA - Libertadora Seguros">
      <Page size="A4" style={styles.page}>
        <View style={styles.headerBox}>
          <Text style={styles.headerTitle}>Informe ejecutivo de gestión comercial</Text>
          <Text style={styles.headerSub}>
            Producto: SKANDIA CREA · {new Date().toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" })}
          </Text>
          <Text style={styles.headerSub2}>Presentado ante: Gerencia General · Libertadora Seguros</Text>
        </View>

        <View style={styles.card} wrap={false}>
          <Text style={styles.cardTitle}>Embudo de conversión comercial</Text>
          {steps.map((s) => {
            const pct = kpis.tot > 0 ? Math.max(4, Math.round((s.value / kpis.tot) * 100)) : 0
            return (
              <View key={s.label} style={styles.fRow}>
                <Text style={styles.fLabel}>{s.label}</Text>
                <View style={styles.fBarBg}>
                  <View style={[styles.fBarFill, { width: `${pct}%`, backgroundColor: s.color }]}>
                    <Text style={styles.fBarText}>{s.value}</Text>
                  </View>
                </View>
                <Text style={styles.fValue}>{s.value}</Text>
              </View>
            )
          })}
        </View>

        <View style={styles.card} wrap={false}>
          <Text style={styles.cardTitle}>Cierres exitosos 2026</Text>
          <View style={styles.tHeadRow}>
            <Text style={[styles.tHeadCell, { width: "30%" }]}>Cliente / empresa</Text>
            <Text style={[styles.tHeadCell, { width: "22%" }]}>Producto</Text>
            <Text style={[styles.tHeadCell, { width: "22%" }]}>Aporte mensual</Text>
            <Text style={[styles.tHeadCell, { width: "13%" }]}>Trimestre</Text>
            <Text style={[styles.tHeadCell, { width: "13%" }]}>Tipo</Text>
          </View>
          {cerrados.map((p) => (
            <View key={p.id} style={styles.tRow}>
              <Text style={[styles.tCell, { width: "30%", fontFamily: "Helvetica-Bold" }]}>{p.empresa}</Text>
              <Text style={[styles.tCell, { width: "22%" }]}>{p.producto}</Text>
              <Text style={[styles.tCell, { width: "22%", color: COLORS.tealD, fontFamily: "Helvetica-Bold" }]}>
                {p.monto > 0 ? `${formatCOP(p.monto)}/mes` : "ARL — Afiliación"}
              </Text>
              <Text style={[styles.tCell, { width: "13%" }]}>{p.trimestre ?? "—"}</Text>
              <Text style={[styles.tCell, { width: "13%" }]}>{p.tipo ?? "—"}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card} wrap={false}>
          <Text style={styles.cardTitle}>Top prospectos calientes — acción inmediata requerida</Text>
          <View style={styles.tHeadRow}>
            <Text style={[styles.tHeadCell, { width: "24%" }]}>Cliente / empresa</Text>
            <Text style={[styles.tHeadCell, { width: "20%" }]}>Producto</Text>
            <Text style={[styles.tHeadCell, { width: "16%" }]}>Estado</Text>
            <Text style={[styles.tHeadCell, { width: "26%" }]}>Próxima acción</Text>
            <Text style={[styles.tHeadCell, { width: "14%" }]}>Fecha</Text>
          </View>
          {calientes.map((p) => (
            <View key={p.id} style={styles.tRow}>
              <Text style={[styles.tCell, { width: "24%", fontFamily: "Helvetica-Bold" }]}>{p.empresa}</Text>
              <Text style={[styles.tCell, { width: "20%" }]}>{p.producto}</Text>
              <Text style={[styles.tCell, { width: "16%", color: p.estado === "INTERESADO" ? COLORS.warn : COLORS.gray }]}>
                {p.estado === "INTERESADO" ? "Interesado" : "Alta prioridad"}
              </Text>
              <Text style={[styles.tCell, { width: "26%" }]}>{p.accion || "—"}</Text>
              <Text style={[styles.tCell, { width: "14%", color: COLORS.muted }]}>{p.fecha || "Por definir"}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card} wrap={false}>
          <Text style={styles.cardTitle}>KPIs de efectividad comercial</Text>
          <View style={styles.kpiGrid}>
            {kpiCards.map((k) => (
              <View key={k.label} style={styles.kpiBox}>
                <Text style={styles.kpiLabel}>{k.label}</Text>
                <Text style={styles.kpiValue}>{k.value}</Text>
                <Text style={styles.kpiSub}>{k.sub}</Text>
              </View>
            ))}
          </View>
        </View>
      </Page>
    </Document>
  )
}
