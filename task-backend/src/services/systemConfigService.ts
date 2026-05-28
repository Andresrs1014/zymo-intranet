import crypto from "crypto"
import prisma from "../config/prisma"
import { env } from "../config/env"

// 32-byte key from JWT_SECRET
function getDerivedKey(): Buffer {
  return crypto.createHash("sha256").update(env.JWT_SECRET).digest()
}

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv("aes-256-cbc", getDerivedKey(), iv)
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()])
  return iv.toString("hex") + ":" + encrypted.toString("hex")
}

function decrypt(text: string): string {
  const [ivHex, encHex] = text.split(":")
  const iv = Buffer.from(ivHex, "hex")
  const encrypted = Buffer.from(encHex, "hex")
  const decipher = crypto.createDecipheriv("aes-256-cbc", getDerivedKey(), iv)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8")
}

// Cache in memory (60 seconds)
let cache: Map<string, string> = new Map()
let cacheExpiry = 0

async function loadCache(): Promise<void> {
  if (Date.now() < cacheExpiry) return
  const rows = await prisma.systemConfig.findMany()
  cache = new Map(rows.map((r) => [r.key, r.encrypted && r.value ? decrypt(r.value) : (r.value ?? "")]))
  cacheExpiry = Date.now() + 60_000
}

export async function getConfig(key: string): Promise<string | null> {
  await loadCache()
  return cache.get(key) ?? null
}

export async function getAllConfig(): Promise<Record<string, string>> {
  await loadCache()
  return Object.fromEntries(cache.entries())
}

export async function setConfig(key: string, value: string, encrypted = false): Promise<void> {
  const storedValue = encrypted ? encrypt(value) : value
  await prisma.systemConfig.upsert({
    where: { key },
    update: { value: storedValue, encrypted },
    create: { key, value: storedValue, encrypted },
  })
  // invalidate cache
  cacheExpiry = 0
}

export async function setManyConfig(entries: Array<{ key: string; value: string; encrypted?: boolean }>): Promise<void> {
  for (const e of entries) {
    await setConfig(e.key, e.value, e.encrypted ?? false)
  }
}

// Keys that are encrypted
export const ENCRYPTED_KEYS = new Set(["smtp_password"])

// All known config keys with defaults
export const CONFIG_KEYS = [
  "smtp_host",
  "smtp_port",
  "smtp_user",
  "smtp_password",
  "smtp_from",
  "smtp_enabled",
  "webhook_powerautomate_url",
  "webhook_enabled",
] as const
