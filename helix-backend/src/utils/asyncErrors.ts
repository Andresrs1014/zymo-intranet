// Express 4 no atiende los rechazos de los handlers `async`: si uno lanza (p. ej. Prisma ante un
// parámetro inválido o la BD caída), la promesa queda rechazada sin dueño y Node ≥ 15 tumba TODO el
// proceso -> 502 para todos hasta que Docker lo reinicia (pasó en producción el 2026-10-01).
// Este parche reenvía el rechazo al error handler de app.ts, como ya hace Express con los throw síncronos.
// Importar UNA vez, antes de montar rutas. (Equivale a `express-async-errors`, sin la dependencia.)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Layer = require("express/lib/router/layer");

Layer.prototype.handle_request = function handleRequest(req: unknown, res: unknown, next: (err?: unknown) => void) {
  const fn = this.handle;
  if (fn.length > 3) return next(); // es un error handler: no se ejecuta en el camino normal
  try {
    const ret = fn(req, res, next);
    if (ret && typeof ret.catch === "function") ret.catch(next);
  } catch (err) {
    next(err);
  }
}
