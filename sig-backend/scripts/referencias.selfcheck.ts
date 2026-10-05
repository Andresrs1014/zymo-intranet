// Self-check del contrato de POST /api/referencias (sin BD): lo que el MCP puede mandar y lo que el backend rechaza.
// Ejecutar: npx ts-node scripts/referencias.selfcheck.ts   (también corre en `npm run selfcheck`)
import assert from "node:assert/strict"
import { ReferenciaBody } from "../src/routers/referencias"

const base = { procedimientoId: 14, origenTipo: "procedimiento", origenId: 14, destinoTipo: "instructivo", destinoCodigo: "INS-005-GAD", frase: "según instructivo" }

// resuelta: exige destino
assert.equal(ReferenciaBody.safeParse({ ...base, estado: "resuelta", destinoId: 77 }).success, true)
assert.equal(ReferenciaBody.safeParse({ ...base, estado: "resuelta" }).success, false, "resuelta sin destinoId")
assert.equal(ReferenciaBody.safeParse({ ...base, estado: "resuelta", destinoTipo: "area", destinoId: 3 }).success, false, "resuelta hacia un área")

// ausente / otra_area: NO llevan destino
assert.equal(ReferenciaBody.safeParse({ ...base, estado: "ausente", destinoId: null }).success, true)
assert.equal(ReferenciaBody.safeParse({ ...base, estado: "ausente" }).success, true)
assert.equal(ReferenciaBody.safeParse({ ...base, estado: "ausente", destinoId: 9 }).success, false, "ausente con destinoId")
assert.equal(ReferenciaBody.safeParse({ ...base, estado: "otra_area", destinoTipo: "area", destinoId: 9 }).success, false)

// valores fuera del contrato
assert.equal(ReferenciaBody.safeParse({ ...base, estado: "inventada" }).success, false)
assert.equal(ReferenciaBody.safeParse({ ...base, estado: "ausente", origenTipo: "area" }).success, false, "origen de tipo área")
assert.equal(ReferenciaBody.safeParse({ ...base, estado: "ausente", destinoCodigo: "X".repeat(81) }).success, false)
// el MCP recorta frase a 500 y nota a 500; el backend acepta hasta 500 y 2000
assert.equal(ReferenciaBody.safeParse({ ...base, estado: "ausente", frase: "f".repeat(500), nota: "n".repeat(500) }).success, true)

console.log("referencias.selfcheck OK")
