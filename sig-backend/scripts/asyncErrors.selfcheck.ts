// Regresión del 2026-10-01: un handler `async` que lanza NO debe tumbar el proceso (Express 4).
// Sin src/utils/asyncErrors.ts, el `unhandledRejection` de abajo mata el proceso (Node >= 15).
import assert from "assert"
import express, { NextFunction, Request, Response } from "express"
import "../src/utils/asyncErrors"

async function main(): Promise<void> {
  let unhandled = 0
  process.on("unhandledRejection", () => { unhandled++ })

  const app = express()
  app.get("/ok", async (_req, res) => { res.json({ ok: true }) })
  app.get("/async-throw", async () => { throw new Error("boom async") })
  app.get("/sync-throw", () => { throw new Error("boom sync") })
  app.get("/after-response", async (_req, res) => { res.json({ sent: true }); throw new Error("tras responder") })
  app.use((_err: Error, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) return next(_err)
    res.status(500).json({ error: "interno" })
  })

  const server = app.listen(0)
  const port = (server.address() as { port: number }).port
  const get = async (path: string) => {
    // sin el parche, el handler que lanza nunca responde: el timeout lo convierte en un fallo claro
    const r = await fetch(`http://127.0.0.1:${port}${path}`, { signal: AbortSignal.timeout(3000) })
    return { status: r.status, body: await r.json().catch(() => null) }
  }
  const quiet = console.error
  console.error = () => {}
  try {
    assert.deepStrictEqual(await get("/ok"), { status: 200, body: { ok: true } })
    assert.strictEqual((await get("/async-throw")).status, 500, "un throw async debe dar 500, no colgar ni caer")
    assert.strictEqual((await get("/sync-throw")).status, 500)
    assert.strictEqual((await get("/after-response")).status, 200, "si ya respondió, el error no debe romper la respuesta")
    assert.strictEqual((await get("/ok")).status, 200, "el servidor sigue vivo tras los errores")
    await new Promise((r) => setTimeout(r, 50))
    assert.strictEqual(unhandled, 0, "no debe quedar ningún unhandledRejection")
  } finally {
    console.error = quiet
    server.close()
  }
  console.log("asyncErrors.selfcheck: OK")
}

main().catch((e) => { console.error(e); process.exit(1) })
