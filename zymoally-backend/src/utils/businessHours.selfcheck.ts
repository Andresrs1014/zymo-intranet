import assert from "assert"
import { businessHoursBetween } from "./businessHours"

// Lunes 7:00 local → 19:00 local (mismo día, dentro de ventana) = 12h
assert.strictEqual(
  businessHoursBetween(new Date("2026-07-01T12:00:00Z"), new Date("2026-07-02T00:00:00Z")),
  12,
  "mismo día dentro de ventana",
)

// 5:00 local → 9:00 local: se recorta a [7,9) = 2h
assert.strictEqual(
  businessHoursBetween(new Date("2026-07-01T10:00:00Z"), new Date("2026-07-01T14:00:00Z")),
  2,
  "recorte por inicio antes de ventana",
)

// Lunes 7:00 local → Miércoles 7:00 local = 12h (lun) + 12h (mar) + 0h (mié) = 24h
assert.strictEqual(
  businessHoursBetween(new Date("2026-07-01T12:00:00Z"), new Date("2026-07-03T12:00:00Z")),
  24,
  "abarca varios días",
)

// end <= start = 0
assert.strictEqual(
  businessHoursBetween(new Date("2026-07-02T12:00:00Z"), new Date("2026-07-01T12:00:00Z")),
  0,
  "end antes de start",
)

// Fuera de ventana por completo (22:00 a 23:00 local) = 0
assert.strictEqual(
  businessHoursBetween(new Date("2026-07-01T03:00:00Z"), new Date("2026-07-01T04:00:00Z")),
  0,
  "totalmente fuera de ventana",
)

console.log("businessHours: OK")
