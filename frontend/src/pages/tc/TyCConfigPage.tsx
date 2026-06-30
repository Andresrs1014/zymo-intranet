import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "@/lib/api"
import { useAuthStore } from "@/store/authStore"
import { canEditTyC } from "@/lib/permissions"
import { PageLayout } from "@/components/layout/PageLayout"
import {
  Plus, Trash2, Save, ChevronDown, ChevronRight,
  Package, Bell, Eye, EyeOff, Users, ArrowRight,
} from "lucide-react"

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface PaqueteItem { id?: number; titulo: string; horas: number | null; orden: number }
interface Paquete { id: number; nombre: string; descripcion: string; activo: boolean; items: PaqueteItem[] }
interface SmtpConfig {
  host: string; port: number; usuario: string
  from_email: string; from_nombre: string; activo: boolean
}
interface WaConfig { phone_number_id: string; activo: boolean }

type Tab = "notificaciones" | "lideres" | "paquetes"

// ── Componente ────────────────────────────────────────────────────────────────

export function TyCConfigPage() {
  const navigate    = useNavigate()
  const user        = useAuthStore((s) => s.user)
  const puedeEditar = user ? canEditTyC(user.role, user.app_permissions) : false
  const [tab, setTab] = useState<Tab>("notificaciones")

  return (
    <PageLayout title="Configuración T&C" mainClassName="flex-1 overflow-y-auto">
      <div className="border-b border-border px-8 pt-6 pb-0">
        <div className="max-w-4xl mx-auto">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-teal-500 mb-1">
            Talento y Cultura
          </p>
          <h1 className="text-xl font-bold mb-4">Configuración</h1>
          <div className="flex gap-0 -mb-px">
            {(["notificaciones", "lideres", "paquetes"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium border-b-2 capitalize transition-colors ${
                  tab === t ? "border-teal-500 text-teal-400" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t === "notificaciones" ? <Bell className="w-3.5 h-3.5" /> :
                  t === "lideres" ? <Users className="w-3.5 h-3.5" /> :
                  <Package className="w-3.5 h-3.5" />}
                {t === "notificaciones" ? "Notificaciones" :
                  t === "lideres" ? "Líderes de área" :
                  "Paquetes de capacitación"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-8 py-6">
        <div className="animate-fade-in">
          {tab === "notificaciones" && <NotificacionesTab puedeEditar={puedeEditar} />}
          {tab === "lideres" && <LideresTab navigate={navigate} />}
          {tab === "paquetes" && <PaquetesTab puedeEditar={puedeEditar} />}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.2s ease-out; }
      `}</style>
    </PageLayout>
  )
}

// ── Tab Paquetes ──────────────────────────────────────────────────────────────

function PaquetesTab({ puedeEditar }: { puedeEditar: boolean }) {
  const [paquetes, setPaquetes] = useState<Paquete[]>([])
  const [expanded, setExpanded] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)
  const [newNombre, setNewNombre] = useState("")
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    api.get("/tc/paquetes").then((r) => setPaquetes(r.data))
  }, [])
  useEffect(() => { load() }, [load])

  async function crearPaquete() {
    if (!newNombre.trim()) return
    setSaving(true)
    try {
      const r = await api.post("/tc/paquetes", { nombre: newNombre.trim(), descripcion: "", activo: true })
      setPaquetes((p) => [...p, { ...r.data, items: [] }])
      setNewNombre("")
      setCreating(false)
      setExpanded(r.data.id)
    } finally { setSaving(false) }
  }

  async function eliminar(id: number) {
    await api.delete(`/tc/paquetes/${id}`)
    setPaquetes((p) => p.filter((x) => x.id !== id))
    if (expanded === id) setExpanded(null)
  }

  return (
    <div className="space-y-3 max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          Define plantillas de capacitaciones que se pre-cargan al crear un evento.
        </p>
        {puedeEditar && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500/15 hover:bg-teal-500/25 text-teal-400 text-xs font-semibold transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Nuevo paquete
          </button>
        )}
      </div>

      {creating && (
        <div className="flex gap-2 p-3 rounded-xl border border-teal-500/30 bg-teal-500/5">
          <input
            autoFocus
            value={newNombre}
            onChange={(e) => setNewNombre(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && crearPaquete()}
            placeholder="Nombre del paquete (ej. Inducción nuevos empleados)"
            className="input-base flex-1 text-sm"
          />
          <button onClick={crearPaquete} disabled={saving || !newNombre.trim()}
            className="px-3 py-1.5 rounded-lg bg-teal-500/20 text-teal-400 text-xs font-semibold disabled:opacity-40">
            {saving ? "..." : "Crear"}
          </button>
          <button onClick={() => setCreating(false)} className="text-muted-foreground hover:text-foreground">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {paquetes.map((p) => (
        <PaqueteCard
          key={p.id}
          paquete={p}
          expanded={expanded === p.id}
          onToggle={() => setExpanded(expanded === p.id ? null : p.id)}
          onDelete={() => eliminar(p.id)}
          onUpdated={(updated) => setPaquetes((prev) => prev.map((x) => x.id === updated.id ? updated : x))}
          puedeEditar={puedeEditar}
        />
      ))}

      {paquetes.length === 0 && !creating && (
        <div className="text-center py-12 text-muted-foreground text-xs">
          <Package className="w-10 h-10 mx-auto mb-3 opacity-20" />
          Sin paquetes configurados
        </div>
      )}
    </div>
  )
}

// ── Card de un paquete ────────────────────────────────────────────────────────

function PaqueteCard({
  paquete, expanded, onToggle, onDelete, onUpdated, puedeEditar,
}: {
  paquete: Paquete
  expanded: boolean
  onToggle: () => void
  onDelete: () => void
  onUpdated: (p: Paquete) => void
  puedeEditar: boolean
}) {
  const [items, setItems] = useState<PaqueteItem[]>(paquete.items)
  const [saving, setSaving] = useState(false)

  useEffect(() => { setItems(paquete.items) }, [paquete.items])

  function addItem() {
    setItems((prev) => [...prev, { titulo: "", horas: null, orden: prev.length }])
  }

  function updateItem(i: number, field: keyof PaqueteItem, value: string | number | null) {
    setItems((prev) => prev.map((x, j) => j === i ? { ...x, [field]: value } : x))
  }

  async function saveItems() {
    setSaving(true)
    try {
      const r = await api.put(`/tc/paquetes/${paquete.id}/items`,
        items.filter((x) => x.titulo.trim()).map((x, i) => ({ titulo: x.titulo, horas: x.horas, orden: i }))
      )
      onUpdated(r.data)
    } finally { setSaving(false) }
  }

  return (
    <div className={`rounded-xl border transition-colors ${expanded ? "border-teal-500/20 bg-teal-500/5" : "border-border bg-muted/5"}`}>
      <div className="flex items-center gap-3 p-4">
        <button onClick={onToggle} className="flex items-center gap-2 flex-1 text-left">
          {expanded ? <ChevronDown className="w-3.5 h-3.5 text-teal-400" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
          <div>
            <p className="text-sm font-semibold">{paquete.nombre}</p>
            <p className="text-[10px] text-muted-foreground">
              {paquete.items.length} capacitación{paquete.items.length !== 1 ? "es" : ""}
            </p>
          </div>
        </button>
        {puedeEditar && (
          <button onClick={onDelete} className="opacity-30 hover:opacity-100 transition-opacity text-rose-400">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-border/50 pt-3 space-y-2">
          {items.map((item, i) => (
            <div key={i} className="flex gap-2 items-center">
              <span className="text-[10px] text-muted-foreground tabular-nums w-4 shrink-0">{i + 1}</span>
              <input
                value={item.titulo}
                onChange={(e) => updateItem(i, "titulo", e.target.value)}
                placeholder="Título de la capacitación"
                className="input-base text-xs flex-[3]"
                readOnly={!puedeEditar}
              />
              <input
                type="number"
                value={item.horas ?? ""}
                onChange={(e) => updateItem(i, "horas", e.target.value ? parseFloat(e.target.value) : null)}
                placeholder="Horas"
                className="input-base text-xs w-20"
                readOnly={!puedeEditar}
              />
              <span className="text-[10px] text-muted-foreground shrink-0">h</span>
              {puedeEditar && (
                <button onClick={() => setItems((prev) => prev.filter((_, j) => j !== i))}
                  className="text-rose-400/40 hover:text-rose-400 transition-colors">
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}

          {puedeEditar && (
            <div className="flex items-center gap-3 pt-1">
              <button onClick={addItem}
                className="flex items-center gap-1 text-xs text-teal-400 hover:text-teal-300 transition-colors">
                <Plus className="w-3.5 h-3.5" /> Agregar ítem
              </button>
              <button onClick={saveItems} disabled={saving}
                className="flex items-center gap-1 text-xs text-teal-400 hover:text-teal-300 transition-colors ml-auto disabled:opacity-40">
                <Save className="w-3.5 h-3.5" />
                {saving ? "Guardando..." : "Guardar items"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Tab Líderes de área ───────────────────────────────────────────────────────

function LideresTab({ navigate }: { navigate: ReturnType<typeof import("react-router-dom").useNavigate> }) {
  return (
    <div className="max-w-xl">
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground -mt-1">
          Teléfono y email del líder por área. WhatsApp de eventos usa estos contactos.
        </p>
        <button
          onClick={() => navigate("/tc/area-config")}
          className="flex items-center justify-between gap-4 p-5 rounded-xl border border-border bg-muted/5 hover:bg-muted/10 hover:border-teal-500/30 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-500/10">
              <Users className="w-5 h-5 text-teal-400" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold">Configurar líderes de área</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Nombre, teléfono y correo del responsable de cada área.
              </p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-teal-400 group-hover:translate-x-0.5 transition-all shrink-0" />
        </button>
      </div>
    </div>
  )
}

// ── Tab Notificaciones (WA + SMTP) ────────────────────────────────────────────

function NotificacionesTab({ puedeEditar }: { puedeEditar: boolean }) {
  return (
    <div className="space-y-8 max-w-xl">
      <WaSection puedeEditar={puedeEditar} />
      <div className="h-px bg-border" />
      <SmtpSection puedeEditar={puedeEditar} />
    </div>
  )
}

function WaSection({ puedeEditar }: { puedeEditar: boolean }) {
  const [form, setForm] = useState<WaConfig & { token: string }>({
    phone_number_id: "", token: "", activo: false,
  })
  const [showToken, setShowToken] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    api.get("/tc/wa-config").then((r) => setForm((p) => ({ ...p, ...r.data, token: "" })))
  }, [])

  function f(field: keyof typeof form, value: string | boolean) {
    setForm((p) => ({ ...p, [field]: value }))
  }

  async function guardar() {
    setSaving(true)
    try {
      await api.put("/tc/wa-config", {
        phone_number_id: form.phone_number_id,
        token: form.token || undefined,
        activo: form.activo,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally { setSaving(false) }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        {/* WhatsApp logo */}
        <svg viewBox="0 0 32 32" className="w-4 h-4 shrink-0" fill="#25D366">
          <path d="M16 3C9.373 3 4 8.373 4 15c0 2.385.68 4.61 1.857 6.5L4 29l7.7-1.82A12.93 12.93 0 0 0 16 28c6.627 0 12-5.373 12-12S22.627 3 16 3zm0 2c5.523 0 10 4.477 10 10S21.523 25 16 25a10.93 10.93 0 0 1-5.5-1.48l-.4-.24-4.57 1.08 1.1-4.44-.27-.41A9.94 9.94 0 0 1 6 15c0-5.523 4.477-10 10-10zm-3.5 5.5c-.28 0-.73.1-1.11.5-.38.4-1.39 1.35-1.39 3.3s1.42 3.82 1.62 4.08c.2.26 2.77 4.23 6.72 5.93 3.94 1.7 3.94 1.13 4.65 1.06.71-.07 2.29-.93 2.61-1.83.33-.9.33-1.67.23-1.83-.1-.16-.36-.26-.75-.46s-2.29-1.13-2.65-1.26c-.36-.13-.62-.2-.88.2-.26.4-1 1.26-1.23 1.52-.23.26-.46.29-.85.1-.39-.2-1.64-.6-3.12-1.92-1.15-1.02-1.93-2.28-2.16-2.67-.23-.39-.02-.6.17-.79.17-.17.39-.46.58-.69.2-.23.26-.39.39-.66.13-.26.07-.49-.03-.69-.1-.2-.88-2.12-1.2-2.9-.32-.76-.64-.65-.88-.66-.23-.01-.49-.01-.75-.01z"/>
        </svg>
        <p className="text-sm font-semibold">WhatsApp Business API</p>
      </div>
      <p className="text-xs text-muted-foreground -mt-1">
        Configura el token y el Phone Number ID de la Meta Business API para enviar notificaciones por WhatsApp.
      </p>

      <div>
        <Label>Phone Number ID</Label>
        <input
          value={form.phone_number_id}
          onChange={(e) => f("phone_number_id", e.target.value)}
          placeholder="123456789012345"
          className="input-base text-sm"
          readOnly={!puedeEditar}
        />
      </div>

      <div>
        <Label>
          Token de acceso{" "}
          {form.token === "" && <span className="text-muted-foreground font-normal">(dejar vacío para no cambiar)</span>}
        </Label>
        <div className="relative">
          <input
            type={showToken ? "text" : "password"}
            value={form.token}
            onChange={(e) => f("token", e.target.value)}
            placeholder="EAABkxxx..."
            className="input-base text-sm pr-9"
            readOnly={!puedeEditar}
          />
          <button onClick={() => setShowToken((v) => !v)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
            {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      <label className="flex items-center gap-2 cursor-pointer select-none pt-1">
        <input
          type="checkbox"
          checked={form.activo}
          onChange={(e) => f("activo", e.target.checked)}
          disabled={!puedeEditar}
          className="w-4 h-4 accent-teal-500"
        />
        <span className="text-sm">Activar notificaciones por WhatsApp</span>
      </label>

      {puedeEditar && (
        <button
          onClick={guardar}
          disabled={saving}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
            saved ? "bg-emerald-500/15 text-emerald-400" : "bg-teal-500/15 hover:bg-teal-500/25 text-teal-400"
          } disabled:opacity-40`}
        >
          <Save className="w-3.5 h-3.5" />
          {saving ? "Guardando..." : saved ? "Guardado ✓" : "Guardar configuración WhatsApp"}
        </button>
      )}
    </div>
  )
}

function SmtpSection({ puedeEditar }: { puedeEditar: boolean }) {
  const [form, setForm] = useState<SmtpConfig & { password: string }>({
    host: "", port: 587, usuario: "", password: "",
    from_email: "", from_nombre: "T&C Zymo", activo: false,
  })
  const [showPass, setShowPass] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    api.get("/tc/smtp-config").then((r) => setForm((p) => ({ ...p, ...r.data, password: "" })))
  }, [])

  async function guardar() {
    setSaving(true)
    try {
      await api.put("/tc/smtp-config", {
        ...form,
        password: form.password || undefined,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally { setSaving(false) }
  }

  function f(field: keyof typeof form, value: string | number | boolean) {
    setForm((p) => ({ ...p, [field]: value }))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0 text-sky-400" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
          <polyline points="22,6 12,13 2,6"/>
        </svg>
        <p className="text-sm font-semibold">Email SMTP</p>
      </div>
      <p className="text-xs text-muted-foreground -mt-1">
        Configura el servidor SMTP para enviar notificaciones de eventos por correo al líder del área.
      </p>

      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <Label>Servidor SMTP (host)</Label>
            <input value={form.host} onChange={(e) => f("host", e.target.value)}
              placeholder="smtp.gmail.com" className="input-base text-sm" readOnly={!puedeEditar} />
          </div>
          <div>
            <Label>Puerto</Label>
            <input type="number" value={form.port} onChange={(e) => f("port", parseInt(e.target.value) || 587)}
              className="input-base text-sm" readOnly={!puedeEditar} />
          </div>
        </div>

        <div>
          <Label>Usuario / Email de envío</Label>
          <input value={form.usuario} onChange={(e) => f("usuario", e.target.value)}
            placeholder="notificaciones@empresa.com" className="input-base text-sm" readOnly={!puedeEditar} />
        </div>

        <div>
          <Label>Contraseña {form.password === "" && <span className="text-muted-foreground font-normal">(dejar vacío para no cambiar)</span>}</Label>
          <div className="relative">
            <input
              type={showPass ? "text" : "password"}
              value={form.password}
              onChange={(e) => f("password", e.target.value)}
              placeholder="••••••••"
              className="input-base text-sm pr-9"
              readOnly={!puedeEditar}
            />
            <button onClick={() => setShowPass((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
              {showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>From email</Label>
            <input value={form.from_email} onChange={(e) => f("from_email", e.target.value)}
              placeholder="tyc@zymologistica.com" className="input-base text-sm" readOnly={!puedeEditar} />
          </div>
          <div>
            <Label>Nombre del remitente</Label>
            <input value={form.from_nombre} onChange={(e) => f("from_nombre", e.target.value)}
              placeholder="T&C Zymo" className="input-base text-sm" readOnly={!puedeEditar} />
          </div>
        </div>

        <label className="flex items-center gap-2 cursor-pointer select-none pt-1">
          <input
            type="checkbox"
            checked={form.activo}
            onChange={(e) => f("activo", e.target.checked)}
            disabled={!puedeEditar}
            className="w-4 h-4 accent-teal-500"
          />
          <span className="text-sm">Activar notificaciones por email</span>
        </label>
      </div>

      {puedeEditar && (
        <button
          onClick={guardar}
          disabled={saving}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
            saved
              ? "bg-emerald-500/15 text-emerald-400"
              : "bg-teal-500/15 hover:bg-teal-500/25 text-teal-400"
          } disabled:opacity-40`}
        >
          <Save className="w-3.5 h-3.5" />
          {saving ? "Guardando..." : saved ? "Guardado ✓" : "Guardar configuración SMTP"}
        </button>
      )}

      <div className="mt-4 p-3 rounded-xl border border-border bg-muted/5 text-xs text-muted-foreground space-y-1">
        <p className="font-semibold text-foreground mb-1">Para Gmail / Workspace:</p>
        <p>Host: <code className="text-teal-400">smtp.gmail.com</code> · Puerto: <code className="text-teal-400">587</code></p>
        <p>Requiere contraseña de aplicación (no la contraseña de cuenta).</p>
      </div>
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{children}</label>
}
