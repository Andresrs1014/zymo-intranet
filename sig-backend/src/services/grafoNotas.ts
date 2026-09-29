// Notas con wikilinks para el vault de Obsidian. El grafo sale de los links, no de un plugin.

import type { ArchivoSig, CitaExtraida, Hogar } from "./citasSig"

export interface NotaGrafo {
  ruta: string
  cuerpo: string
}

export function renderGrafo(
  archivos: ArchivoSig[],
  citas: CitaExtraida[],
  hogares: Hogar[],
): NotaGrafo[] {
  const hogarDe = new Map(hogares.map((h) => [h.codigo, h]))
  const notas: NotaGrafo[] = [notaIndice(archivos, citas)]
  notas.push(notaAreaHub(archivos))

  for (const archivo of archivos) {
    const propias = citas.filter((c) => c.origenCodigo === archivo.codigo)
    notas.push(notaArchivo(archivo, propias, hogarDe.get(archivo.codigo)))
  }

  for (const dest of destinosSinArchivo(citas, archivos)) {
    const quienes = citas.filter((c) => c.destinoCodigo === dest.destinoCodigo && c.destinoTipo === dest.destinoTipo)
    notas.push(dest.destinoTipo === "area" ? notaAreaVacia(dest.destinoCodigo, quienes) : notaAusente(dest, quienes))
  }
  return notas
}

function notaIndice(archivos: ArchivoSig[], citas: CitaExtraida[]): NotaGrafo {
  const ausentes = new Set(citas.filter((c) => c.estado === "ausente" || c.estado === "otro_codigo").map((c) => c.destinoCodigo))
  const areas = new Set(citas.filter((c) => c.estado === "otra_area").map((c) => c.destinoCodigo))
  const lineas = [
    "---",
    "tags: [sig]",
    "---",
    "",
    "# Grafo SIG",
    "",
    "La operación no está en un procedimiento suelto. Está en el pase entre el procedimiento, el instructivo, el formato que alguien llena y el protocolo que dice qué hacer cuando la pregunta se sale del paso. Si ese pase está roto, la persona inventa el paso.",
    "",
    "Este grafo guarda el orden mínimo con el que los archivos se citan hoy, aunque la cita esté mal. No reescribe los Word. Un nodo vacío de otra área todavía no se abrió: cuando lleguemos a esa carpeta se comprueba si el enlace era real.",
    "",
    `- Documentos en Administrativo: ${archivos.length}`,
    `- Citas: ${citas.length}`,
    `- Códigos citados que no tienen archivo: ${ausentes.size}`,
    `- Áreas mencionadas y no abiertas: ${areas.size}`,
    "",
    ...(citas.length ? [] : ["Todavía no hay citas leídas del texto. El inventario de códigos está abajo; las aristas salen al correr el extractor sobre los Word de Administrativo.", ""]),
    "## Administrativo",
    "",
    "[[Administrativo]]",
    "",
  ]
  if (ausentes.size) {
    lineas.push("## Citados y sin archivo", "")
    for (const codigo of [...ausentes].sort()) lineas.push(`- [[${codigo}]]`)
    lineas.push("")
  }
  if (areas.size) {
    lineas.push("## Otras áreas, sin abrir", "")
    for (const nombre of [...areas].sort()) lineas.push(`- [[${nombre}]]`)
    lineas.push("")
  }
  return { ruta: "Grafo SIG.md", cuerpo: lineas.join("\n") }
}

function notaAreaHub(archivos: ArchivoSig[]): NotaGrafo {
  const lineas = [
    "---",
    "tipo: area",
    "area: Administrativo",
    "tags: [sig, administrativo]",
    "---",
    "",
    "# Administrativo",
    "",
    "Carpeta leída: `Procedimientos/procedimientos_nuevos/Administrativo`. Las otras carpetas no se abrieron.",
    "",
  ]
  for (const tipo of ["procedimiento", "instructivo", "protocolo", "formato"] as const) {
    const grupo = archivos.filter((a) => a.tipo === tipo)
    if (!grupo.length) continue
    lineas.push(`## ${tipo}`, "")
    for (const a of grupo) lineas.push(`- [[${a.codigo}]] ${a.titulo}`)
    lineas.push("")
  }
  lineas.push("[[Grafo SIG]]", "")
  return { ruta: "Administrativo/Administrativo.md", cuerpo: lineas.join("\n") }
}

function notaArchivo(archivo: ArchivoSig, citas: CitaExtraida[], hogar?: Hogar): NotaGrafo {
  const lineas = [
    "---",
    `tipo: ${archivo.tipo}`,
    `codigo: ${archivo.codigo}`,
    "area: Administrativo",
    "tags: [sig, administrativo]",
    "---",
    "",
    `# ${archivo.codigo}`,
    "",
    archivo.titulo,
    "",
    `Archivo: \`${archivo.ruta}\``,
    "",
  ]
  if (hogar?.procedimientoCodigo && archivo.tipo !== "procedimiento") {
    lineas.push(`Casa en la intranet: [[${hogar.procedimientoCodigo}]]`, "")
  }
  if (hogar?.instructivoCodigo) {
    lineas.push(`Formato citado sobre todo desde [[${hogar.instructivoCodigo}]]`, "")
  }
  if (hogar?.nota) lineas.push(hogar.nota, "")
  lineas.push("## Citas", "")
  if (!citas.length) lineas.push("Ningún código ni área en el texto.", "")
  for (const c of citas) {
    const marca = c.estado === "resuelta" ? "" : ` — ${c.estado}`
    lineas.push(`- [[${c.destinoCodigo}]]${marca}`)
    if (c.nota) lineas.push(`  - ${c.nota}`)
    if (c.frase) lineas.push(`  - “${c.frase}”`)
  }
  lineas.push("", "[[Administrativo]]", "")
  return { ruta: `Administrativo/${archivo.codigo}.md`, cuerpo: lineas.join("\n") }
}

function notaAusente(
  dest: { destinoCodigo: string; estado: CitaExtraida["estado"] },
  quienes: CitaExtraida[],
): NotaGrafo {
  const lineas = [
    "---",
    "tipo: ausente",
    `codigo: ${dest.destinoCodigo}`,
    `estado: ${dest.estado}`,
    "tags: [sig, referencia-ausente]",
    "---",
    "",
    `# ${dest.destinoCodigo}`,
    "",
    "Se cita y el archivo no está en Administrativo. No se inventó un Word para llenar el hueco.",
    "",
  ]
  for (const c of quienes) {
    lineas.push(`- Desde [[${c.origenCodigo}]] (${c.estado})`)
    if (c.nota) lineas.push(`  - ${c.nota}`)
    if (c.frase) lineas.push(`  - “${c.frase}”`)
  }
  lineas.push("", "[[Grafo SIG]]", "")
  return { ruta: `ausentes/${dest.destinoCodigo}.md`, cuerpo: lineas.join("\n") }
}

function notaAreaVacia(nombre: string, quienes: CitaExtraida[]): NotaGrafo {
  const lineas = [
    "---",
    "tipo: area",
    `area: ${nombre}`,
    "tags: [sig, area-sin-leer]",
    "---",
    "",
    `# ${nombre}`,
    "",
    "Citada desde Administrativo. Los archivos de esta área no se abrieron.",
    "",
  ]
  for (const c of quienes) {
    lineas.push(`- Desde [[${c.origenCodigo}]]`)
    if (c.frase) lineas.push(`  - “${c.frase}”`)
  }
  lineas.push("", "[[Grafo SIG]]", "")
  return { ruta: `areas/${nombre}.md`, cuerpo: lineas.join("\n") }
}

function destinosSinArchivo(citas: CitaExtraida[], archivos: ArchivoSig[]) {
  const tienen = new Set(archivos.map((a) => a.codigo))
  const vistos = new Set<string>()
  const out: { destinoTipo: CitaExtraida["destinoTipo"]; destinoCodigo: string; estado: CitaExtraida["estado"] }[] = []
  for (const c of citas) {
    if (c.estado === "resuelta" || tienen.has(c.destinoCodigo)) continue
    const key = `${c.destinoTipo}|${c.destinoCodigo}`
    if (vistos.has(key)) continue
    vistos.add(key)
    out.push({ destinoTipo: c.destinoTipo, destinoCodigo: c.destinoCodigo, estado: c.estado })
  }
  return out
}
