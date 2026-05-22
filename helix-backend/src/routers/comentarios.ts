// Placeholder router — full CRUD implementation in T3
import { Router } from "express";

const router = Router();

router.all("*", (_req, res) => {
  res.status(501).json({ error: "Not implemented" });
});

export default router;
